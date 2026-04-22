import { Injectable } from '@nestjs/common';
import { TenantAccessService } from '../auth/tenant-access.service';
import type { AuthenticatedActor } from '../auth/authenticated-request.interface';
import { DatabaseService } from '../database/database.service';
import type {
  BalanceSheetQueryDto,
  GeneralLedgerQueryDto,
  ProfitAndLossQueryDto,
  TrialBalanceQueryDto
} from './dto/report-query.dto';

@Injectable()
export class ReportsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly tenantAccessService: TenantAccessService
  ) {}

  async getTrialBalance(query: TrialBalanceQueryDto, actor: AuthenticatedActor) {
    const actorContext = await this.tenantAccessService.assertOrganizationAccess(actor, query.organization_id);
    const result = await this.databaseService.query(
      `
        select *
        from public.fn_trial_balance($1::uuid, $2::date, $3::boolean)
      `,
      [query.organization_id, query.as_of_date, query.include_zero_balances ?? false]
    );

    return {
      organization_id: query.organization_id,
      as_of_date: query.as_of_date,
      actor_context: actorContext,
      items: result.rows
    };
  }

  async getBalanceSheet(query: BalanceSheetQueryDto, actor: AuthenticatedActor) {
    const actorContext = await this.tenantAccessService.assertOrganizationAccess(actor, query.organization_id);
    const result = await this.databaseService.query(
      `
        select *
        from public.fn_balance_sheet($1::uuid, $2::date, $3::boolean)
      `,
      [query.organization_id, query.as_of_date, query.include_zero_balances ?? false]
    );

    return {
      organization_id: query.organization_id,
      as_of_date: query.as_of_date,
      actor_context: actorContext,
      items: result.rows
    };
  }

  async getProfitAndLoss(query: ProfitAndLossQueryDto, actor: AuthenticatedActor) {
    const actorContext = await this.tenantAccessService.assertOrganizationAccess(actor, query.organization_id);
    const result = await this.databaseService.query(
      `
        select *
        from public.fn_profit_and_loss($1::uuid, $2::date, $3::date, $4::boolean)
      `,
      [query.organization_id, query.from_date, query.to_date, query.include_zero_balances ?? false]
    );

    return {
      organization_id: query.organization_id,
      from_date: query.from_date,
      to_date: query.to_date,
      actor_context: actorContext,
      items: result.rows
    };
  }

  async getGeneralLedger(query: GeneralLedgerQueryDto, actor: AuthenticatedActor) {
    const actorContext = await this.tenantAccessService.assertOrganizationAccess(actor, query.organization_id);
    const result = await this.databaseService.query(
      `
        select *
        from public.fn_general_ledger($1::uuid, $2::date, $3::date, $4::uuid[])
      `,
      [query.organization_id, query.from_date, query.to_date, query.account_ids ?? null]
    );

    return {
      organization_id: query.organization_id,
      from_date: query.from_date,
      to_date: query.to_date,
      actor_context: actorContext,
      items: result.rows
    };
  }
}

