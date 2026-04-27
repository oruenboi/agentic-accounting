import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedActor } from '../auth/authenticated-request.interface';
import { TenantAccessService } from '../auth/tenant-access.service';
import { DatabaseService } from '../database/database.service';
import type { GetScheduleRunQueryDto, ListScheduleRunsQueryDto } from './dto/schedule-query.dto';

@Injectable()
export class SchedulesService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly tenantAccessService: TenantAccessService
  ) {}

  async listScheduleRuns(query: ListScheduleRunsQueryDto, actor: AuthenticatedActor) {
    const actorContext = await this.tenantAccessService.assertOrganizationAccess(actor, query.organization_id);
    const result = await this.databaseService.query(
      `
        select
          sr.id as schedule_run_id,
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
          and ($2::text is null or sr.schedule_type = $2::text)
          and ($3::text is null or sr.status = $3::text)
          and ($4::date is null or sr.as_of_date = $4::date)
        order by sr.as_of_date desc, sr.generated_at desc
        limit $5::int
      `,
      [
        query.organization_id,
        query.schedule_type ?? null,
        query.status ?? null,
        query.as_of_date ?? null,
        query.limit ?? 25
      ]
    );

    return {
      organization_id: query.organization_id,
      actor_context: actorContext,
      filters: {
        schedule_type: query.schedule_type ?? null,
        status: query.status ?? null,
        as_of_date: query.as_of_date ?? null,
        limit: query.limit ?? 25
      },
      items: result.rows
    };
  }

  async getScheduleRun(scheduleRunId: string, query: GetScheduleRunQueryDto, actor: AuthenticatedActor) {
    const actorContext = await this.tenantAccessService.assertOrganizationAccess(actor, query.organization_id);
    const runResult = await this.databaseService.query(
      `
        select
          sr.id as schedule_run_id,
          sr.organization_id::text,
          sr.schedule_definition_id::text,
          sd.name as schedule_name,
          sd.description as schedule_description,
          sd.gl_account_ids::text[] as gl_account_ids,
          sd.generation_strategy,
          sd.group_by,
          sr.schedule_type,
          sr.as_of_date::text,
          sr.status,
          sr.gl_balance,
          sr.schedule_total,
          sr.variance,
          sr.generated_at,
          sr.generated_by_actor_type,
          sr.generated_by_actor_id,
          sr.reviewed_at,
          sr.reviewed_by_user_id::text,
          sr.metadata,
          rec.id::text as reconciliation_id,
          rec.status as reconciliation_status,
          rec.reviewed_at as reconciliation_reviewed_at,
          rec.reviewed_by_user_id::text as reconciliation_reviewed_by_user_id,
          rec.notes as reconciliation_notes,
          rec.metadata as reconciliation_metadata
        from public.schedule_runs sr
        join public.schedule_definitions sd
          on sd.id = sr.schedule_definition_id
        left join public.schedule_reconciliations rec
          on rec.schedule_run_id = sr.id
        where sr.id = $1::uuid
          and sr.organization_id = $2::uuid
        limit 1
      `,
      [scheduleRunId, query.organization_id]
    );

    const run = runResult.rows[0];

    if (run === undefined) {
      throw new NotFoundException('Schedule run was not found for the requested organization.');
    }

    const rowsResult = await this.databaseService.query(
      `
        select
          id::text as schedule_run_row_id,
          row_order,
          reference_type,
          reference_id,
          reference_number,
          counterparty_id,
          counterparty_name,
          document_date::text,
          due_date::text,
          opening_amount,
          movement_amount,
          closing_amount,
          age_bucket,
          metadata
        from public.schedule_run_rows
        where schedule_run_id = $1::uuid
        order by row_order asc
      `,
      [scheduleRunId]
    );

    return {
      ...run,
      actor_context: actorContext,
      rows: rowsResult.rows
    };
  }
}
