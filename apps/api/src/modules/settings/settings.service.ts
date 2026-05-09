import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedActor, RequestActorContext } from '../auth/authenticated-request.interface';
import { TenantAccessService } from '../auth/tenant-access.service';
import { DatabaseService } from '../database/database.service';
import type { OrganizationSettingsQueryDto, UpdateOrganizationMemberDto, UpdateOrganizationSettingsDto } from './dto/settings.dto';

interface OrganizationSettingsRow {
  organization_id: string;
  firm_id: string;
  name: string;
  legal_name: string | null;
  slug: string;
  status: string;
  base_currency: string;
  fiscal_year_start_month: number;
  country_code: string | null;
  timezone: string | null;
  created_at: string;
  updated_at: string;
}

interface OrganizationMemberRow {
  organization_member_id: string;
  user_id: string;
  auth_user_id: string;
  email: string | null;
  display_name: string | null;
  role: string;
  status: string;
  is_external_client: boolean;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class SettingsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly tenantAccessService: TenantAccessService
  ) {}

  async getOrganizationSettings(query: OrganizationSettingsQueryDto, actor: AuthenticatedActor) {
    const actorContext = await this.tenantAccessService.assertOrganizationAccess(actor, query.organization_id);
    const organization = await this.getOrganization(query.organization_id, actorContext.firmId);

    return {
      ...organization,
      actor_context: actorContext
    };
  }

  async updateOrganizationSettings(input: UpdateOrganizationSettingsDto, actor: AuthenticatedActor) {
    const actorContext = await this.tenantAccessService.assertOrganizationAccess(actor, input.organization_id);
    this.assertElevatedRole(actorContext);

    if (Object.keys(input).every((key) => key === 'organization_id')) {
      throw new BadRequestException('At least one organization setting must be provided for update.');
    }

    const name = input.name === undefined ? undefined : this.trimRequiredString(input.name);
    const legalName = input.legal_name === undefined ? undefined : this.trimOptionalString(input.legal_name);
    const baseCurrency = input.base_currency === undefined ? undefined : this.trimRequiredString(input.base_currency);
    const countryCode = input.country_code === undefined ? undefined : this.trimOptionalString(input.country_code);
    const timezone = input.timezone === undefined ? undefined : this.trimOptionalString(input.timezone);

    const result = await this.databaseService.query<OrganizationSettingsRow>(
      `
        update public.organizations
        set
          name = coalesce($3::text, name),
          legal_name = case when $4::boolean then $5::text else legal_name end,
          base_currency = coalesce($6::text, base_currency),
          fiscal_year_start_month = coalesce($7::int, fiscal_year_start_month),
          country_code = case when $8::boolean then $9::text else country_code end,
          timezone = case when $10::boolean then $11::text else timezone end,
          updated_at = now()
        where id = $1::uuid
          and firm_id = $2::uuid
        returning
          id::text as organization_id,
          firm_id::text,
          name,
          legal_name,
          slug,
          status,
          base_currency,
          fiscal_year_start_month,
          country_code,
          timezone,
          created_at,
          updated_at
      `,
      [
        input.organization_id,
        actorContext.firmId,
        name ?? null,
        input.legal_name !== undefined,
        legalName ?? null,
        baseCurrency ?? null,
        input.fiscal_year_start_month ?? null,
        input.country_code !== undefined,
        countryCode ?? null,
        input.timezone !== undefined,
        timezone ?? null
      ]
    );

    const organization = result.rows[0];
    if (!organization) {
      throw new NotFoundException('Organization was not found for the requested firm.');
    }

    return {
      ...organization,
      actor_context: actorContext
    };
  }

  async listOrganizationMembers(query: OrganizationSettingsQueryDto, actor: AuthenticatedActor) {
    const actorContext = await this.tenantAccessService.assertOrganizationAccess(actor, query.organization_id);
    const result = await this.databaseService.query<OrganizationMemberRow>(
      `
        select
          om.id::text as organization_member_id,
          u.id::text as user_id,
          u.auth_user_id::text,
          u.email,
          u.display_name,
          om.role,
          om.status,
          om.is_external_client,
          om.created_at,
          om.updated_at
        from public.organization_members om
        join public.organizations o
          on o.id = om.organization_id
         and o.firm_id = $2::uuid
        join public.users u
          on u.id = om.user_id
        where om.organization_id = $1::uuid
        order by u.email, u.display_name, om.created_at
      `,
      [query.organization_id, actorContext.firmId]
    );

    return {
      organization_id: query.organization_id,
      actor_context: actorContext,
      items: result.rows
    };
  }

  async updateOrganizationMember(membershipId: string, input: UpdateOrganizationMemberDto, actor: AuthenticatedActor) {
    const actorContext = await this.tenantAccessService.assertOrganizationAccess(actor, input.organization_id);
    this.assertElevatedRole(actorContext);

    if (Object.keys(input).every((key) => key === 'organization_id')) {
      throw new BadRequestException('At least one organization member field must be provided for update.');
    }

    const result = await this.databaseService.query<OrganizationMemberRow>(
      `
        update public.organization_members om
        set
          role = coalesce($4::text, om.role),
          status = coalesce($5::text, om.status),
          is_external_client = coalesce($6::boolean, om.is_external_client),
          updated_at = now()
        from public.organizations o,
             public.users u
        where om.id = $1::uuid
          and om.organization_id = $2::uuid
          and o.id = om.organization_id
          and o.firm_id = $3::uuid
          and u.id = om.user_id
        returning
          om.id::text as organization_member_id,
          u.id::text as user_id,
          u.auth_user_id::text,
          u.email,
          u.display_name,
          om.role,
          om.status,
          om.is_external_client,
          om.created_at,
          om.updated_at
      `,
      [
        membershipId,
        input.organization_id,
        actorContext.firmId,
        input.role ?? null,
        input.status ?? null,
        input.is_external_client ?? null
      ]
    );

    const member = result.rows[0];
    if (!member) {
      throw new NotFoundException('Organization member was not found for the requested organization.');
    }

    return {
      organization_id: input.organization_id,
      actor_context: actorContext,
      item: member
    };
  }

  private async getOrganization(organizationId: string, firmId: string): Promise<OrganizationSettingsRow> {
    const result = await this.databaseService.query<OrganizationSettingsRow>(
      `
        select
          id::text as organization_id,
          firm_id::text,
          name,
          legal_name,
          slug,
          status,
          base_currency,
          fiscal_year_start_month,
          country_code,
          timezone,
          created_at,
          updated_at
        from public.organizations
        where id = $1::uuid
          and firm_id = $2::uuid
      `,
      [organizationId, firmId]
    );

    const organization = result.rows[0];
    if (!organization) {
      throw new NotFoundException('Organization was not found for the requested firm.');
    }

    return organization;
  }

  private assertElevatedRole(actorContext: RequestActorContext): void {
    if (
      actorContext.organizationRole === 'org_admin' ||
      actorContext.firmRole === 'firm_owner' ||
      actorContext.firmRole === 'firm_admin' ||
      actorContext.firmRole === 'firm_manager'
    ) {
      return;
    }

    throw new ForbiddenException('Actor does not have permission to update organization settings.');
  }

  private trimRequiredString(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
      throw new BadRequestException('Organization text fields cannot be blank.');
    }

    return trimmed;
  }

  private trimOptionalString(value: string | null | undefined): string | null | undefined {
    if (value === null || value === undefined) {
      return value;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      throw new BadRequestException('Organization text fields cannot be blank.');
    }

    return trimmed;
  }
}
