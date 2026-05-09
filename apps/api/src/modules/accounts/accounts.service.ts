import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedActor } from '../auth/authenticated-request.interface';
import { TenantAccessService } from '../auth/tenant-access.service';
import { DatabaseService } from '../database/database.service';
import type { CreateAccountDto, UpdateAccountDto, UpdateAccountStatusDto } from './dto/account-maintenance.dto';
import type { ListAccountsQueryDto } from './dto/account-query.dto';

interface AccountRow {
  account_id: string;
  firm_id: string;
  organization_id: string;
  code: string;
  name: string;
  type: string;
  subtype: string | null;
  parent_account_id: string | null;
  status: string;
  is_postable: boolean;
  created_at: string;
  updated_at: string;
}

interface AccountActivityCounts {
  posted_line_count: number;
  draft_line_count: number;
}

@Injectable()
export class AccountsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly tenantAccessService: TenantAccessService
  ) {}

  async listAccounts(query: ListAccountsQueryDto, actor: AuthenticatedActor) {
    const actorContext = await this.tenantAccessService.assertOrganizationAccess(actor, query.organization_id);
    const result = await this.databaseService.query(
      `
        select
          id::text as account_id,
          firm_id::text,
          organization_id::text,
          code,
          name,
          type,
          subtype,
          parent_account_id::text,
          status,
          is_postable,
          created_at,
          updated_at
        from public.accounts
        where organization_id = $1::uuid
          and firm_id = $2::uuid
          and ($3::text is null or type = $3::text)
          and ($4::text is null or status = $4::text)
          and ($5::boolean is null or is_postable = $5::boolean)
        order by code, name
        limit $6::int
      `,
      [
        query.organization_id,
        actorContext.firmId,
        query.type ?? null,
        query.status ?? 'active',
        query.postable_only ?? null,
        query.limit ?? 100
      ]
    );

    return {
      organization_id: query.organization_id,
      actor_context: actorContext,
      filters: {
        type: query.type ?? null,
        status: query.status ?? 'active',
        postable_only: query.postable_only ?? null,
        limit: query.limit ?? 100
      },
      items: result.rows
    };
  }

  async createAccount(input: CreateAccountDto, actor: AuthenticatedActor) {
    const actorContext = await this.tenantAccessService.assertOrganizationAccess(actor, input.organization_id);
    await this.assertParentAccount(input.parent_account_id ?? null, input.organization_id, actorContext.firmId);
    const code = this.trimRequiredString(input.code);
    const name = this.trimRequiredString(input.name);
    const subtype = this.trimOptionalString(input.subtype);

    try {
      const result = await this.databaseService.query<AccountRow>(
        `
          insert into public.accounts (
            firm_id,
            organization_id,
            code,
            name,
            type,
            subtype,
            parent_account_id,
            status,
            is_postable
          )
          values ($1::uuid, $2::uuid, $3::text, $4::text, $5::text, $6::text, $7::uuid, $8::text, $9::boolean)
          returning
            id::text as account_id,
            firm_id::text,
            organization_id::text,
            code,
            name,
            type,
            subtype,
            parent_account_id::text,
            status,
            is_postable,
            created_at,
            updated_at
        `,
        [
          actorContext.firmId,
          input.organization_id,
          code,
          name,
          input.type,
          subtype ?? null,
          input.parent_account_id ?? null,
          input.status ?? 'active',
          input.is_postable ?? true
        ]
      );

      return {
        organization_id: input.organization_id,
        actor_context: actorContext,
        item: result.rows[0]
      };
    } catch (error) {
      this.handleAccountWriteError(error);
      throw error;
    }
  }

  async updateAccount(accountId: string, input: UpdateAccountDto, actor: AuthenticatedActor) {
    const actorContext = await this.tenantAccessService.assertOrganizationAccess(actor, input.organization_id);
    const currentAccount = await this.getAccountForWrite(accountId, input.organization_id, actorContext.firmId);

    if (Object.keys(input).every((key) => key === 'organization_id')) {
      throw new BadRequestException('At least one account field must be provided for update.');
    }

    if (input.parent_account_id !== undefined) {
      if (input.parent_account_id === accountId) {
        throw new BadRequestException('An account cannot be its own parent.');
      }
      await this.assertParentAccount(input.parent_account_id, input.organization_id, actorContext.firmId);
    }

    let activityCounts: AccountActivityCounts | null = null;
    if (input.status === 'inactive') {
      activityCounts = await this.assertCanDeactivateAccount(accountId, input.organization_id, actorContext.firmId);
    }
    const name = input.name === undefined ? undefined : this.trimRequiredString(input.name);
    const subtype = input.subtype === undefined ? undefined : this.trimOptionalString(input.subtype);

    try {
      const result = await this.databaseService.query<AccountRow>(
        `
          update public.accounts
          set
            name = coalesce($4::text, name),
            subtype = case when $5::boolean then $6::text else subtype end,
            parent_account_id = case when $7::boolean then $8::uuid else parent_account_id end,
            status = coalesce($9::text, status),
            is_postable = coalesce($10::boolean, is_postable),
            updated_at = now()
          where id = $1::uuid
            and organization_id = $2::uuid
            and firm_id = $3::uuid
          returning
            id::text as account_id,
            firm_id::text,
            organization_id::text,
            code,
            name,
            type,
            subtype,
            parent_account_id::text,
            status,
            is_postable,
            created_at,
            updated_at
        `,
        [
          currentAccount.account_id,
          input.organization_id,
          actorContext.firmId,
          name ?? null,
          input.subtype !== undefined,
          subtype ?? null,
          input.parent_account_id !== undefined,
          input.parent_account_id ?? null,
          input.status ?? null,
          input.is_postable ?? null
        ]
      );

      return {
        organization_id: input.organization_id,
        actor_context: actorContext,
        item: result.rows[0],
        activity_counts: activityCounts
      };
    } catch (error) {
      this.handleAccountWriteError(error);
      throw error;
    }
  }

  async updateAccountStatus(accountId: string, input: UpdateAccountStatusDto, actor: AuthenticatedActor) {
    return this.updateAccount(accountId, { organization_id: input.organization_id, status: input.status }, actor);
  }

  private async getAccountForWrite(accountId: string, organizationId: string, firmId: string): Promise<AccountRow> {
    const result = await this.databaseService.query<AccountRow>(
      `
        select
          id::text as account_id,
          firm_id::text,
          organization_id::text,
          code,
          name,
          type,
          subtype,
          parent_account_id::text,
          status,
          is_postable,
          created_at,
          updated_at
        from public.accounts
        where id = $1::uuid
          and organization_id = $2::uuid
          and firm_id = $3::uuid
      `,
      [accountId, organizationId, firmId]
    );

    if (!result.rows[0]) {
      throw new NotFoundException('Account was not found for the requested organization.');
    }

    return result.rows[0];
  }

  private async assertParentAccount(parentAccountId: string | null | undefined, organizationId: string, firmId: string) {
    if (!parentAccountId) {
      return;
    }

    const result = await this.databaseService.query(
      `
        select id
        from public.accounts
        where id = $1::uuid
          and organization_id = $2::uuid
          and firm_id = $3::uuid
      `,
      [parentAccountId, organizationId, firmId]
    );

    if (!result.rows[0]) {
      throw new BadRequestException('Parent account was not found for the requested organization.');
    }
  }

  private async assertCanDeactivateAccount(accountId: string, organizationId: string, firmId: string): Promise<AccountActivityCounts> {
    const postedResult = await this.databaseService.query<{ line_count: string }>(
      `
        select count(*)::int::text as line_count
        from public.journal_entry_lines l
        join public.journal_entries e
          on e.id = l.journal_entry_id
        where l.account_id = $1::uuid
          and e.organization_id = $2::uuid
          and e.firm_id = $3::uuid
      `,
      [accountId, organizationId, firmId]
    );

    const postedLineCount = Number(postedResult.rows[0]?.line_count ?? 0);
    if (postedLineCount > 0) {
      throw new ConflictException({
        message: 'Account cannot be deactivated because posted journal entry lines exist.',
        posted_line_count: postedLineCount
      });
    }

    const draftResult = await this.databaseService.query<{ line_count: string }>(
      `
        select count(*)::int::text as line_count
        from public.journal_entry_draft_lines l
        join public.journal_entry_drafts d
          on d.id = l.draft_id
        where l.account_id = $1::uuid
          and d.organization_id = $2::uuid
          and d.firm_id = $3::uuid
      `,
      [accountId, organizationId, firmId]
    );

    return {
      posted_line_count: postedLineCount,
      draft_line_count: Number(draftResult.rows[0]?.line_count ?? 0)
    };
  }

  private handleAccountWriteError(error: unknown): void {
    if (typeof error === 'object' && error && 'code' in error && error.code === '23505') {
      throw new ConflictException('An account with this code already exists for the organization.');
    }
  }

  private trimRequiredString(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
      throw new BadRequestException('Account text fields cannot be blank.');
    }

    return trimmed;
  }

  private trimOptionalString(value: string | null | undefined): string | null | undefined {
    if (value === null || value === undefined) {
      return value;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      throw new BadRequestException('Account text fields cannot be blank.');
    }

    return trimmed;
  }
}
