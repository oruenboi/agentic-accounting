import { Injectable } from '@nestjs/common';
import { TenantAccessService } from '../auth/tenant-access.service';
import type { AuthenticatedActor } from '../auth/authenticated-request.interface';
import { DatabaseService } from '../database/database.service';
import {
  ValidateJournalEntryInputDto,
  type ValidateJournalEntryLineDto
} from './dto/validate-journal-entry.dto';

interface AccountRow {
  id: string;
  code: string;
  name: string;
  type: string;
  status: string;
  is_postable: boolean;
  organization_id: string;
}

interface PeriodRow {
  id: string;
  period_start: string;
  period_end: string;
  status: string;
}

@Injectable()
export class JournalValidationService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly tenantAccessService: TenantAccessService
  ) {}

  async validateJournalEntry(input: ValidateJournalEntryInputDto, actor: AuthenticatedActor) {
    const actorContext = await this.tenantAccessService.assertOrganizationAccess(actor, input.organization_id);

    const errors: Array<{ code: string; message: string }> = [];
    const warnings: string[] = [];

    const lineValidation = this.validateLineShapes(input.lines);
    errors.push(...lineValidation.errors);

    const totals = {
      total_debit: this.sumAmounts(input.lines, 'debit'),
      total_credit: this.sumAmounts(input.lines, 'credit')
    };

    if (totals.total_debit !== totals.total_credit) {
      errors.push({
        code: 'ENTRY_NOT_BALANCED',
        message: `Debits ${totals.total_debit.toFixed(2)} do not equal credits ${totals.total_credit.toFixed(2)}.`
      });
    }

    const accountsById = await this.loadAccounts(input.organization_id, input.lines.map((line) => line.account_id));
    const accountValidation = this.validateAccounts(input.lines, accountsById, input.organization_id);
    errors.push(...accountValidation.errors);
    warnings.push(...accountValidation.warnings);

    const periodValidation = await this.validateAccountingPeriod(
      input.organization_id,
      input.entry_date,
      input.accounting_period_id
    );
    errors.push(...periodValidation.errors);
    warnings.push(...periodValidation.warnings);

    return {
      organization_id: input.organization_id,
      entry_date: input.entry_date,
      actor_context: actorContext,
      valid: errors.length === 0,
      requires_approval: false,
      errors,
      warnings,
      impact_preview: {
        line_count: input.lines.length,
        ...totals,
        account_ids: Array.from(new Set(input.lines.map((line) => line.account_id)))
      },
      validation_result: {
        balanced: totals.total_debit === totals.total_credit,
        account_count: accountsById.size,
        period: periodValidation.period
      }
    };
  }

  private validateLineShapes(lines: ValidateJournalEntryLineDto[]) {
    const errors: Array<{ code: string; message: string }> = [];

    lines.forEach((line, index) => {
      const debit = Number(line.debit);
      const credit = Number(line.credit);

      if ((debit === 0 && credit === 0) || (debit > 0 && credit > 0)) {
        errors.push({
          code: 'INVALID_REQUEST',
          message: `Line ${index + 1} must have exactly one populated amount side.`
        });
      }
    });

    return { errors };
  }

  private async loadAccounts(organizationId: string, accountIds: string[]) {
    if (accountIds.length === 0) {
      return new Map<string, AccountRow>();
    }

    const result = await this.databaseService.query<AccountRow>(
      `
        select
          id::text,
          code,
          name,
          type,
          status,
          is_postable,
          organization_id::text
        from public.accounts
        where organization_id = $1::uuid
          and id = any($2::uuid[])
      `,
      [organizationId, accountIds]
    );

    return new Map(result.rows.map((row) => [row.id, row]));
  }

  private validateAccounts(
    lines: ValidateJournalEntryLineDto[],
    accountsById: Map<string, AccountRow>,
    organizationId: string
  ) {
    const errors: Array<{ code: string; message: string }> = [];
    const warnings: string[] = [];

    lines.forEach((line, index) => {
      const account = accountsById.get(line.account_id);

      if (account === undefined) {
        errors.push({
          code: 'ACCOUNT_NOT_FOUND',
          message: `Line ${index + 1} references unknown account ${line.account_id} for organization ${organizationId}.`
        });
        return;
      }

      if (account.status !== 'active') {
        errors.push({
          code: 'ACCOUNT_INACTIVE',
          message: `Line ${index + 1} references inactive account ${account.code}.`
        });
      }

      if (!account.is_postable) {
        errors.push({
          code: 'INVALID_REQUEST',
          message: `Line ${index + 1} references non-postable account ${account.code}.`
        });
      }

      if (account.type === 'equity') {
        warnings.push(`Line ${index + 1} touches equity account ${account.code}.`);
      }
    });

    return { errors, warnings };
  }

  private async validateAccountingPeriod(
    organizationId: string,
    entryDate: string,
    accountingPeriodId?: string
  ) {
    const errors: Array<{ code: string; message: string }> = [];
    const warnings: string[] = [];

    let period: PeriodRow | null = null;

    if (accountingPeriodId !== undefined) {
      const result = await this.databaseService.query<PeriodRow>(
        `
          select
            id::text,
            period_start::text,
            period_end::text,
            status
          from public.accounting_periods
          where id = $1::uuid
            and organization_id = $2::uuid
          limit 1
        `,
        [accountingPeriodId, organizationId]
      );

      period = result.rows[0] ?? null;

      if (period === null) {
        errors.push({
          code: 'INVALID_REQUEST',
          message: `Accounting period ${accountingPeriodId} does not belong to organization ${organizationId}.`
        });
        return { errors, warnings, period };
      }

      if (entryDate < period.period_start || entryDate > period.period_end) {
        errors.push({
          code: 'INVALID_DATE_RANGE',
          message: `Entry date ${entryDate} falls outside accounting period ${period.id}.`
        });
      }
    } else {
      const result = await this.databaseService.query<PeriodRow>(
        `
          select
            id::text,
            period_start::text,
            period_end::text,
            status
          from public.accounting_periods
          where organization_id = $1::uuid
            and $2::date between period_start and period_end
          order by period_start desc
          limit 1
        `,
        [organizationId, entryDate]
      );

      period = result.rows[0] ?? null;
    }

    if (period !== null && period.status === 'closed') {
      errors.push({
        code: 'PERIOD_LOCKED',
        message: `Accounting period ${period.id} is closed for posting.`
      });
    }

    if (period === null) {
      warnings.push(`No accounting period matched entry date ${entryDate}; validation used organization/date-only checks.`);
    }

    return { errors, warnings, period };
  }

  private sumAmounts(lines: ValidateJournalEntryLineDto[], side: 'debit' | 'credit') {
    const total = lines.reduce((sum, line) => sum + Number(line[side]), 0);
    return Number(total.toFixed(2));
  }
}
