import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedActor, RequestActorContext } from '../auth/authenticated-request.interface';
import { TenantAccessService } from '../auth/tenant-access.service';
import { DatabaseService, type Queryable } from '../database/database.service';
import {
  erpModuleNames,
  type AddPartyRoleDto,
  type ConfigureModuleDto,
  type CreatePartyDto,
  type ListPartiesQueryDto,
  type OrganizationQueryDto
} from './dto/erp-foundation.dto';

interface ModuleRegistrationRow {
  module_registration_id: string | null;
  module_name: string;
  status: string;
  enabled_at: string | null;
  enabled_by_user_id: string | null;
  settings: Record<string, unknown>;
  created_at: string | null;
  updated_at: string | null;
}

interface PartyRow {
  party_id: string;
  firm_id: string;
  organization_id: string;
  party_type: string;
  display_name: string;
  legal_name: string | null;
  tax_identifier: string | null;
  registration_number: string | null;
  email: string | null;
  phone: string | null;
  billing_address: Record<string, unknown> | null;
  shipping_address: Record<string, unknown> | null;
  status: string;
  metadata: Record<string, unknown>;
  roles?: Array<Record<string, unknown>>;
  created_at: string;
  updated_at: string;
}

interface PartyRoleRow {
  party_role_id: string;
  party_id: string;
  role: string;
  status: string;
  role_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class ErpFoundationService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly tenantAccessService: TenantAccessService
  ) {}

  async listModules(query: OrganizationQueryDto, actor: AuthenticatedActor) {
    const actorContext = await this.tenantAccessService.assertOrganizationAccess(actor, query.organization_id);
    const result = await this.databaseService.query<ModuleRegistrationRow>(
      `
        select
          r.id::text as module_registration_id,
          catalog.module_name,
          coalesce(r.status, 'disabled') as status,
          r.enabled_at,
          r.enabled_by_user_id::text,
          coalesce(r.settings, '{}'::jsonb) as settings,
          r.created_at,
          r.updated_at
        from unnest($3::text[]) with ordinality as catalog(module_name, module_order)
        left join public.erp_module_registrations r
          on r.organization_id = $1::uuid
         and r.firm_id = $2::uuid
         and r.module_name = catalog.module_name
        order by catalog.module_order
      `,
      [query.organization_id, actorContext.firmId, erpModuleNames]
    );

    return {
      organization_id: query.organization_id,
      actor_context: actorContext,
      items: result.rows
    };
  }

  async configureModule(
    moduleName: string,
    input: ConfigureModuleDto,
    actor: AuthenticatedActor,
    requestId?: string
  ) {
    const actorContext = await this.tenantAccessService.assertOrganizationAccess(actor, input.organization_id);
    this.assertConfigurationPermission(actorContext);
    this.assertModuleName(moduleName);

    return this.databaseService.withTransaction(async (client) => {
      const result = await client.query<ModuleRegistrationRow>(
        `
          insert into public.erp_module_registrations (
            firm_id, organization_id, module_name, status, enabled_at, enabled_by_user_id, settings
          )
          values (
            $1::uuid, $2::uuid, $3::text, $4::text,
            case when $4::text = 'enabled' then now() else null end,
            case when $4::text = 'enabled' then $5::uuid else null end,
            $6::jsonb
          )
          on conflict (organization_id, module_name) do update
          set
            status = excluded.status,
            enabled_at = excluded.enabled_at,
            enabled_by_user_id = excluded.enabled_by_user_id,
            settings = excluded.settings,
            updated_at = now()
          where public.erp_module_registrations.firm_id = excluded.firm_id
          returning
            id::text as module_registration_id,
            module_name,
            status,
            enabled_at,
            enabled_by_user_id::text,
            settings,
            created_at,
            updated_at
        `,
        [
          actorContext.firmId,
          input.organization_id,
          moduleName,
          input.status,
          actorContext.appUserId,
          JSON.stringify(input.settings ?? {})
        ]
      );

      const item = result.rows[0];
      if (!item) {
        throw new ConflictException('Module registration could not be updated for the organization.');
      }

      await this.recordAudit(client, actorContext, actor, {
        eventName: 'erp.module.configured',
        entityType: 'erp_module_registration',
        entityId: item.module_registration_id ?? moduleName,
        organizationId: input.organization_id,
        requestId,
        afterState: item
      });

      return {
        organization_id: input.organization_id,
        actor_context: actorContext,
        item
      };
    });
  }

  async listParties(query: ListPartiesQueryDto, actor: AuthenticatedActor) {
    const actorContext = await this.tenantAccessService.assertOrganizationAccess(actor, query.organization_id);
    const search = query.search?.trim() || null;
    const result = await this.databaseService.query<PartyRow>(
      `
        select
          p.id::text as party_id,
          p.firm_id::text,
          p.organization_id::text,
          p.party_type,
          p.display_name,
          p.legal_name,
          p.tax_identifier,
          p.registration_number,
          p.email,
          p.phone,
          p.billing_address,
          p.shipping_address,
          p.status,
          p.metadata,
          coalesce(
            jsonb_agg(
              jsonb_build_object(
                'party_role_id', pr.id::text,
                'role', pr.role,
                'status', pr.status,
                'role_metadata', pr.role_metadata
              ) order by pr.role
            ) filter (where pr.id is not null),
            '[]'::jsonb
          ) as roles,
          p.created_at,
          p.updated_at
        from public.parties p
        left join public.party_roles pr
          on pr.party_id = p.id
         and pr.firm_id = p.firm_id
         and pr.organization_id = p.organization_id
        where p.organization_id = $1::uuid
          and p.firm_id = $2::uuid
          and ($3::text is null or p.party_type = $3::text)
          and ($4::text is null or p.status = $4::text)
          and (
            $5::text is null
            or exists (
              select 1 from public.party_roles role_filter
              where role_filter.party_id = p.id
                and role_filter.role = $5::text
                and role_filter.status = 'active'
            )
          )
          and (
            $6::text is null
            or p.display_name ilike ('%' || $6::text || '%')
            or p.legal_name ilike ('%' || $6::text || '%')
            or p.registration_number ilike ('%' || $6::text || '%')
            or p.email ilike ('%' || $6::text || '%')
          )
        group by p.id
        order by p.display_name, p.id
        limit $7::int
      `,
      [
        query.organization_id,
        actorContext.firmId,
        query.party_type ?? null,
        query.status ?? 'active',
        query.role ?? null,
        search,
        query.limit ?? 100
      ]
    );

    return {
      organization_id: query.organization_id,
      actor_context: actorContext,
      filters: {
        party_type: query.party_type ?? null,
        role: query.role ?? null,
        status: query.status ?? 'active',
        search,
        limit: query.limit ?? 100
      },
      items: result.rows
    };
  }

  async createParty(input: CreatePartyDto, actor: AuthenticatedActor, requestId?: string) {
    const actorContext = await this.tenantAccessService.assertOrganizationAccess(actor, input.organization_id);
    this.assertMasterDataWritePermission(actorContext);
    const displayName = this.trimRequiredString(input.display_name, 'Party display name cannot be blank.');

    try {
      return await this.databaseService.withTransaction(async (client) => {
        const partyResult = await client.query<PartyRow>(
          `
            insert into public.parties (
              firm_id, organization_id, party_type, display_name, legal_name,
              tax_identifier, registration_number, email, phone,
              billing_address, shipping_address, metadata
            )
            values (
              $1::uuid, $2::uuid, $3::text, $4::text, $5::text,
              $6::text, $7::text, $8::text, $9::text,
              $10::jsonb, $11::jsonb, $12::jsonb
            )
            returning
              id::text as party_id,
              firm_id::text,
              organization_id::text,
              party_type,
              display_name,
              legal_name,
              tax_identifier,
              registration_number,
              email,
              phone,
              billing_address,
              shipping_address,
              status,
              metadata,
              created_at,
              updated_at
          `,
          [
            actorContext.firmId,
            input.organization_id,
            input.party_type,
            displayName,
            this.optionalText(input.legal_name),
            this.optionalText(input.tax_identifier),
            this.optionalText(input.registration_number),
            this.optionalText(input.email)?.toLowerCase() ?? null,
            this.optionalText(input.phone),
            input.billing_address ? JSON.stringify(input.billing_address) : null,
            input.shipping_address ? JSON.stringify(input.shipping_address) : null,
            JSON.stringify(input.metadata ?? {})
          ]
        );

        const party = partyResult.rows[0];
        if (!party) {
          throw new ConflictException('Party could not be created.');
        }

        const rolesResult = await client.query<PartyRoleRow>(
          `
            insert into public.party_roles (firm_id, organization_id, party_id, role)
            select $1::uuid, $2::uuid, $3::uuid, role
            from unnest($4::text[]) as role
            returning
              id::text as party_role_id,
              party_id::text,
              role,
              status,
              role_metadata,
              created_at,
              updated_at
          `,
          [actorContext.firmId, input.organization_id, party.party_id, input.roles]
        );

        const item = { ...party, roles: rolesResult.rows };
        await this.recordAudit(client, actorContext, actor, {
          eventName: 'erp.party.created',
          entityType: 'party',
          entityId: party.party_id,
          organizationId: input.organization_id,
          requestId,
          afterState: item
        });

        return {
          organization_id: input.organization_id,
          actor_context: actorContext,
          item
        };
      });
    } catch (error) {
      this.handlePartyWriteError(error);
      throw error;
    }
  }

  async addPartyRole(
    partyId: string,
    input: AddPartyRoleDto,
    actor: AuthenticatedActor,
    requestId?: string
  ) {
    const actorContext = await this.tenantAccessService.assertOrganizationAccess(actor, input.organization_id);
    this.assertMasterDataWritePermission(actorContext);

    return this.databaseService.withTransaction(async (client) => {
      const party = await this.getParty(client, partyId, input.organization_id, actorContext.firmId);
      if (party.status !== 'active') {
        throw new BadRequestException('Roles cannot be activated for an inactive party.');
      }

      const roleResult = await client.query<PartyRoleRow>(
        `
          insert into public.party_roles (
            firm_id, organization_id, party_id, role, status, role_metadata
          )
          values ($1::uuid, $2::uuid, $3::uuid, $4::text, 'active', $5::jsonb)
          on conflict (party_id, role) do update
          set status = 'active', role_metadata = excluded.role_metadata, updated_at = now()
          returning
            id::text as party_role_id,
            party_id::text,
            role,
            status,
            role_metadata,
            created_at,
            updated_at
        `,
        [
          actorContext.firmId,
          input.organization_id,
          party.party_id,
          input.role,
          JSON.stringify(input.role_metadata ?? {})
        ]
      );

      const item = roleResult.rows[0];
      if (!item) {
        throw new ConflictException('Party role could not be activated.');
      }
      await this.recordAudit(client, actorContext, actor, {
        eventName: 'erp.party_role.activated',
        entityType: 'party_role',
        entityId: item.party_role_id,
        organizationId: input.organization_id,
        requestId,
        afterState: item
      });

      return {
        organization_id: input.organization_id,
        actor_context: actorContext,
        party_id: party.party_id,
        item
      };
    });
  }

  private async getParty(client: Queryable, partyId: string, organizationId: string, firmId: string): Promise<PartyRow> {
    const result = await client.query<PartyRow>(
      `
        select
          id::text as party_id,
          firm_id::text,
          organization_id::text,
          party_type,
          display_name,
          legal_name,
          tax_identifier,
          registration_number,
          email,
          phone,
          billing_address,
          shipping_address,
          status,
          metadata,
          created_at,
          updated_at
        from public.parties
        where id = $1::uuid
          and organization_id = $2::uuid
          and firm_id = $3::uuid
      `,
      [partyId, organizationId, firmId]
    );

    if (!result.rows[0]) {
      throw new NotFoundException('Party was not found for the requested organization.');
    }

    return result.rows[0];
  }

  private async recordAudit(
    client: Queryable,
    actorContext: RequestActorContext,
    actor: AuthenticatedActor,
    input: {
      eventName: string;
      entityType: string;
      entityId: string;
      organizationId: string;
      requestId?: string;
      afterState: unknown;
    }
  ): Promise<void> {
    const actorId = actor.actorType === 'agent' ? actor.agentName ?? actor.clientId ?? actor.authUserId : actor.authUserId;
    await client.query(
      `
        insert into public.audit_logs (
          firm_id,
          organization_id,
          event_name,
          actor_type,
          actor_id,
          actor_display_name,
          user_id,
          agent_name,
          tool_name,
          request_id,
          entity_type,
          entity_id,
          action_status,
          after_state,
          source_channel,
          source_route
        )
        values (
          $1::uuid, $2::uuid, $3::text, $4::text, $5::text, $6::text,
          $7::uuid, $8::text, $9::text, $10::text, $11::text, $12::text,
          'succeeded', $13::jsonb, 'api', '/api/v1/erp'
        )
      `,
      [
        actorContext.firmId,
        input.organizationId,
        input.eventName,
        actor.actorType,
        actorId,
        actor.email,
        actorContext.appUserId,
        actor.actorType === 'agent' ? actor.agentName ?? 'agent' : null,
        actor.actorType === 'agent' ? 'erp_api' : null,
        input.requestId ?? null,
        input.entityType,
        input.entityId,
        JSON.stringify(input.afterState)
      ]
    );
  }

  private assertModuleName(moduleName: string): void {
    if (!(erpModuleNames as readonly string[]).includes(moduleName)) {
      throw new BadRequestException(`Unknown ERP module: ${moduleName}`);
    }
  }

  private assertConfigurationPermission(actorContext: RequestActorContext): void {
    if (
      actorContext.organizationRole === 'org_admin' ||
      actorContext.firmRole === 'firm_owner' ||
      actorContext.firmRole === 'firm_admin' ||
      actorContext.firmRole === 'firm_manager'
    ) {
      return;
    }

    throw new ForbiddenException('Actor does not have permission to configure ERP modules.');
  }

  private assertMasterDataWritePermission(actorContext: RequestActorContext): void {
    if (
      ['org_admin', 'accountant', 'bookkeeper'].includes(actorContext.organizationRole ?? '') ||
      ['firm_owner', 'firm_admin', 'firm_manager', 'firm_staff'].includes(actorContext.firmRole ?? '')
    ) {
      return;
    }

    throw new ForbiddenException('Actor does not have permission to maintain ERP master data.');
  }

  private trimRequiredString(value: string, message: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
      throw new BadRequestException(message);
    }
    return trimmed;
  }

  private optionalText(value: string | undefined): string | null {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private handlePartyWriteError(error: unknown): void {
    if (typeof error === 'object' && error && 'code' in error && error.code === '23505') {
      throw new ConflictException('A duplicate party role or tenant identity was detected.');
    }
  }
}
