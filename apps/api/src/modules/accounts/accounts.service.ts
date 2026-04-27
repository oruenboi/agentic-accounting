import { Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../auth/authenticated-request.interface';
import { TenantAccessService } from '../auth/tenant-access.service';
import { DatabaseService } from '../database/database.service';
import type { ListAccountsQueryDto } from './dto/account-query.dto';

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
}
