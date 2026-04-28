import { Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../auth/authenticated-request.interface';
import { TenantAccessService } from '../auth/tenant-access.service';
import { DatabaseService } from '../database/database.service';
import type { CloseOverviewQueryDto } from './dto/close-query.dto';

function itemRows(rows: Array<Record<string, unknown>>) {
  return rows.map(({ total_count: _totalCount, ...row }) => row);
}

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

    const [pendingApprovals, openProposals, scheduleBlockers, recentEntries] = await Promise.all([
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
}
