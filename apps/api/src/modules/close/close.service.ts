import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedActor } from '../auth/authenticated-request.interface';
import { TenantAccessService } from '../auth/tenant-access.service';
import { DatabaseService, type Queryable } from '../database/database.service';
import type { CloseOverviewQueryDto, ClosePeriodActionDto } from './dto/close-query.dto';

function itemRows(rows: Array<Record<string, unknown>>) {
  return rows.map(({ total_count: _totalCount, ...row }) => row);
}

const PERIOD_COLUMNS = `
  id::text as period_id,
  name,
  period_start::text,
  period_end::text,
  status,
  closed_at,
  closed_by_user_id::text,
  reopened_at,
  reopened_by_user_id::text
`;

type PeriodRow = {
  period_id: string;
  name: string;
  period_start: string;
  period_end: string;
  status: 'open' | 'pre_close_review' | 'closed' | 'reopened';
  closed_at: Date | string | null;
  closed_by_user_id: string | null;
  reopened_at: Date | string | null;
  reopened_by_user_id: string | null;
};

type BlockerCounts = {
  pending_approvals: number;
  open_proposals: number;
  schedule_blockers: number;
};

@Injectable()
export class CloseService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly tenantAccessService: TenantAccessService
  ) {}

  async getOverview(query: CloseOverviewQueryDto, actor: AuthenticatedActor) {
    const actorContext = await this.tenantAccessService.assertOrganizationAccess(actor, query.organization_id);
    const asOfDate = query.as_of_date ?? new Date().toISOString().slice(0, 10);
    const limit = query.limit ?? 10;

    const [period, pendingApprovals, openProposals, scheduleBlockers, recentEntries] = await Promise.all([
      this.databaseService.query<PeriodRow>(
        `
          select ${PERIOD_COLUMNS}
          from public.accounting_periods
          where organization_id = $1::uuid
            and firm_id = $2::uuid
            and period_start <= $3::date
            and period_end >= $3::date
          order by period_start desc
          limit 1
        `,
        [query.organization_id, actorContext.firmId, asOfDate]
      ),
      this.databaseService.query(
        `
          select
            count(*) over() as total_count,
            ar.id::text as approval_request_id,
            ar.organization_id::text,
            ar.target_entity_type,
            ar.target_entity_id,
            d.draft_number,
            ar.action_type as title,
            ar.status,
            ar.priority,
            ar.current_approver_user_id::text,
            ar.created_at as submitted_at
          from public.approval_requests ar
          left join public.journal_entry_drafts d
            on d.approval_request_id = ar.id
          where ar.organization_id = $1::uuid
            and ar.status = 'pending'
          order by
            case ar.priority
              when 'critical' then 1
              when 'high' then 2
              when 'normal' then 3
              else 4
            end,
            ar.created_at asc
          limit $2::int
        `,
        [query.organization_id, limit]
      ),
      this.databaseService.query(
        `
          select
            count(*) over() as total_count,
            ap.id::text as proposal_id,
            ap.organization_id::text,
            ap.target_entity_id::text as draft_id,
            d.draft_number,
            ap.status,
            ap.proposal_type,
            ap.title,
            ap.created_at
          from public.agent_proposals ap
          left join public.journal_entry_drafts d
            on d.id = ap.target_entity_id
          where ap.organization_id = $1::uuid
            and ap.status in ('draft', 'proposed', 'needs_review')
          order by ap.created_at desc
          limit $2::int
        `,
        [query.organization_id, limit]
      ),
      this.databaseService.query(
        `
          select
            count(*) over() as total_count,
            sr.id::text as schedule_run_id,
            sr.organization_id::text,
            sr.schedule_definition_id::text,
            sd.name as schedule_name,
            sd.description as schedule_description,
            sr.schedule_type,
            sr.as_of_date::text,
            sr.status,
            sr.gl_balance,
            sr.schedule_total,
            sr.variance,
            sr.generated_at,
            sr.reviewed_at,
            sr.reviewed_by_user_id::text,
            rec.status as reconciliation_status,
            rec.reviewed_at as reconciliation_reviewed_at,
            rec.reviewed_by_user_id::text as reconciliation_reviewed_by_user_id
          from public.schedule_runs sr
          join public.schedule_definitions sd
            on sd.id = sr.schedule_definition_id
          left join public.schedule_reconciliations rec
            on rec.schedule_run_id = sr.id
          where sr.organization_id = $1::uuid
            and sr.as_of_date <= $2::date
            and sr.status <> 'superseded'
            and coalesce(rec.status, 'unreviewed') in ('unreviewed', 'variance_detected')
          order by sr.as_of_date desc, sr.generated_at desc
          limit $3::int
        `,
        [query.organization_id, asOfDate, limit]
      ),
      this.databaseService.query(
        `
          select
            count(*) over() as total_count,
            je.id::text as journal_entry_id,
            je.organization_id::text,
            je.entry_number,
            je.entry_date::text,
            je.status,
            je.source_type,
            je.memo,
            je.reversal_of_journal_entry_id::text as reversal_journal_entry_id,
            je.posted_at
          from public.journal_entries je
          where je.organization_id = $1::uuid
            and je.entry_date <= $2::date
          order by je.entry_date desc, je.posted_at desc
          limit $3::int
        `,
        [query.organization_id, asOfDate, limit]
      )
    ]);

    return {
      organization_id: query.organization_id,
      as_of_date: asOfDate,
      actor_context: actorContext,
      period: period.rows[0] ?? null,
      counts: {
        pending_approvals: Number(pendingApprovals.rows[0]?.total_count ?? 0),
        open_proposals: Number(openProposals.rows[0]?.total_count ?? 0),
        schedule_blockers: Number(scheduleBlockers.rows[0]?.total_count ?? 0),
        recent_entries: Number(recentEntries.rows[0]?.total_count ?? 0)
      },
      pending_approvals: itemRows(pendingApprovals.rows),
      open_proposals: itemRows(openProposals.rows),
      schedule_blockers: itemRows(scheduleBlockers.rows),
      recent_entries: itemRows(recentEntries.rows)
    };
  }

  async startPeriodReview(periodId: string, input: ClosePeriodActionDto, actor: AuthenticatedActor) {
    const actorContext = await this.tenantAccessService.assertOrganizationAccess(actor, input.organization_id);

    return this.databaseService.withTransaction(async (client) => {
      const period = await this.loadPeriodForUpdate(client, periodId, input.organization_id, actorContext.firmId);

      if (!['open', 'reopened'].includes(period.status)) {
        throw new ConflictException(`Accounting period ${periodId} must be open or reopened before review can start.`);
      }

      const result = await client.query<PeriodRow>(
        `
          update public.accounting_periods
          set status = 'pre_close_review',
              updated_at = now()
          where id = $1::uuid
            and organization_id = $2::uuid
            and firm_id = $3::uuid
          returning ${PERIOD_COLUMNS}
        `,
        [periodId, input.organization_id, actorContext.firmId]
      );
      await this.recordPeriodAudit(client, {
        eventName: 'accounting_period.review_started',
        actor,
        userId: actorContext.appUserId ?? null,
        firmId: actorContext.firmId,
        organizationId: input.organization_id,
        periodId,
        accountingDate: period.period_end,
        beforeState: period,
        afterState: result.rows[0],
        note: input.note
      });

      return {
        period: result.rows[0],
        actor_context: actorContext
      };
    });
  }

  async closePeriod(periodId: string, input: ClosePeriodActionDto, actor: AuthenticatedActor) {
    const actorContext = await this.tenantAccessService.assertOrganizationAccess(actor, input.organization_id);

    return this.databaseService.withTransaction(async (client) => {
      const period = await this.loadPeriodForUpdate(client, periodId, input.organization_id, actorContext.firmId);

      if (period.status !== 'pre_close_review') {
        throw new ConflictException(`Accounting period ${periodId} must be in pre_close_review before it can be closed.`);
      }

      const blockerCounts = await this.getBlockerCounts(client, input.organization_id, period.period_end);
      if (blockerCounts.pending_approvals > 0 || blockerCounts.open_proposals > 0 || blockerCounts.schedule_blockers > 0) {
        throw new ConflictException({
          message: 'Accounting period cannot be closed while blockers remain.',
          blocker_counts: blockerCounts
        });
      }

      const result = await client.query<PeriodRow>(
        `
          update public.accounting_periods
          set status = 'closed',
              closed_at = now(),
              closed_by_user_id = $4::uuid,
              updated_at = now()
          where id = $1::uuid
            and organization_id = $2::uuid
            and firm_id = $3::uuid
          returning ${PERIOD_COLUMNS}
        `,
        [periodId, input.organization_id, actorContext.firmId, actorContext.appUserId ?? null]
      );
      await this.recordPeriodAudit(client, {
        eventName: 'accounting_period.closed',
        actor,
        userId: actorContext.appUserId ?? null,
        firmId: actorContext.firmId,
        organizationId: input.organization_id,
        periodId,
        accountingDate: period.period_end,
        beforeState: period,
        afterState: result.rows[0],
        note: input.note,
        metadata: { blocker_counts: blockerCounts }
      });

      return {
        period: result.rows[0],
        actor_context: actorContext,
        blocker_counts: blockerCounts
      };
    });
  }

  async reopenPeriod(periodId: string, input: ClosePeriodActionDto, actor: AuthenticatedActor) {
    const actorContext = await this.tenantAccessService.assertOrganizationAccess(actor, input.organization_id);

    return this.databaseService.withTransaction(async (client) => {
      const period = await this.loadPeriodForUpdate(client, periodId, input.organization_id, actorContext.firmId);

      if (period.status !== 'closed') {
        throw new ConflictException(`Accounting period ${periodId} must be closed before it can be reopened.`);
      }

      const result = await client.query<PeriodRow>(
        `
          update public.accounting_periods
          set status = 'reopened',
              reopened_at = now(),
              reopened_by_user_id = $4::uuid,
              updated_at = now()
          where id = $1::uuid
            and organization_id = $2::uuid
            and firm_id = $3::uuid
          returning ${PERIOD_COLUMNS}
        `,
        [periodId, input.organization_id, actorContext.firmId, actorContext.appUserId ?? null]
      );
      await this.recordPeriodAudit(client, {
        eventName: 'accounting_period.reopened',
        actor,
        userId: actorContext.appUserId ?? null,
        firmId: actorContext.firmId,
        organizationId: input.organization_id,
        periodId,
        accountingDate: period.period_end,
        beforeState: period,
        afterState: result.rows[0],
        reason: input.reason
      });

      return {
        period: result.rows[0],
        actor_context: actorContext
      };
    });
  }

  private async loadPeriodForUpdate(client: Queryable, periodId: string, organizationId: string, firmId: string) {
    const result = await client.query<PeriodRow>(
      `
        select ${PERIOD_COLUMNS}
        from public.accounting_periods
        where id = $1::uuid
          and organization_id = $2::uuid
          and firm_id = $3::uuid
        for update
      `,
      [periodId, organizationId, firmId]
    );

    const period = result.rows[0];
    if (period === undefined) {
      throw new NotFoundException(`Accounting period ${periodId} was not found for organization ${organizationId}.`);
    }

    return period;
  }

  private async getBlockerCounts(client: Queryable, organizationId: string, asOfDate: string): Promise<BlockerCounts> {
    const pendingApprovals = await client.query<{ total_count: string }>(
      `
        select count(*)::text as total_count
        from public.approval_requests ar
        where ar.organization_id = $1::uuid
          and ar.status = 'pending'
      `,
      [organizationId]
    );
    const openProposals = await client.query<{ total_count: string }>(
      `
        select count(*)::text as total_count
        from public.agent_proposals ap
        where ap.organization_id = $1::uuid
          and ap.status in ('draft', 'proposed', 'needs_review')
      `,
      [organizationId]
    );
    const scheduleBlockers = await client.query<{ total_count: string }>(
      `
        select count(*)::text as total_count
        from public.schedule_runs sr
        left join public.schedule_reconciliations rec
          on rec.schedule_run_id = sr.id
        where sr.organization_id = $1::uuid
          and sr.as_of_date <= $2::date
          and sr.status <> 'superseded'
          and coalesce(rec.status, 'unreviewed') in ('unreviewed', 'variance_detected')
      `,
      [organizationId, asOfDate]
    );

    return {
      pending_approvals: Number(pendingApprovals.rows[0]?.total_count ?? 0),
      open_proposals: Number(openProposals.rows[0]?.total_count ?? 0),
      schedule_blockers: Number(scheduleBlockers.rows[0]?.total_count ?? 0)
    };
  }

  private async recordPeriodAudit(
    client: Queryable,
    input: {
      eventName: string;
      actor: AuthenticatedActor;
      userId: string | null;
      firmId: string;
      organizationId: string;
      periodId: string;
      accountingDate: string;
      beforeState: PeriodRow;
      afterState: PeriodRow | undefined;
      note?: string;
      reason?: string;
      metadata?: Record<string, unknown>;
    }
  ) {
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
          entity_type,
          entity_id,
          action_status,
          organization_period_id,
          accounting_date,
          before_state,
          after_state,
          metadata,
          source_channel,
          source_route
        )
        values (
          $1::uuid,
          $2::uuid,
          $3::text,
          $4::text,
          $5::text,
          $6::text,
          $7::uuid,
          'accounting_period',
          $8::text,
          'succeeded',
          $8::uuid,
          $9::date,
          $10::jsonb,
          $11::jsonb,
          $12::jsonb,
          'api',
          $13::text
        )
      `,
      [
        input.firmId,
        input.organizationId,
        input.eventName,
        input.actor.actorType,
        input.actor.authUserId,
        input.actor.email ?? null,
        input.userId,
        input.periodId,
        input.accountingDate,
        JSON.stringify(input.beforeState),
        JSON.stringify(input.afterState ?? null),
        JSON.stringify({
          ...input.metadata,
          note: input.note ?? null,
          reason: input.reason ?? null
        }),
        `/api/v1/close/periods/${input.periodId}`
      ]
    );
  }
}
