import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedActor } from '../auth/authenticated-request.interface';
import { TenantAccessService } from '../auth/tenant-access.service';
import { DatabaseService } from '../database/database.service';
import type {
  CreateScheduleDefinitionDto,
  GenerateScheduleRunDto,
  GetScheduleRunQueryDto,
  ListScheduleDefinitionsQueryDto,
  ListScheduleRunsQueryDto,
  ReviewScheduleRunDto
} from './dto/schedule-query.dto';

@Injectable()
export class SchedulesService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly tenantAccessService: TenantAccessService
  ) {}

  async listScheduleDefinitions(query: ListScheduleDefinitionsQueryDto, actor: AuthenticatedActor) {
    const actorContext = await this.tenantAccessService.assertOrganizationAccess(actor, query.organization_id);
    const result = await this.databaseService.query(
      `
        select
          sd.id::text as schedule_definition_id,
          sd.firm_id::text,
          sd.organization_id::text,
          sd.schedule_type,
          sd.name,
          sd.description,
          sd.gl_account_ids::text[] as gl_account_ids,
          sd.generation_strategy,
          sd.group_by,
          sd.is_active,
          sd.metadata,
          sd.created_at,
          sd.updated_at,
          coalesce(
            jsonb_agg(
              jsonb_build_object(
                'account_id', a.id::text,
                'code', a.code,
                'name', a.name,
                'type', a.type,
                'subtype', a.subtype,
                'status', a.status
              )
              order by a.code, a.name
            ) filter (where a.id is not null),
            '[]'::jsonb
          ) as accounts
        from public.schedule_definitions sd
        left join public.accounts a
          on a.id = any(sd.gl_account_ids)
          and a.organization_id = $1::uuid
        where sd.firm_id = $2::uuid
          and (sd.organization_id = $1::uuid or sd.organization_id is null)
          and ($3::text is null or sd.schedule_type = $3::text)
          and ($4::boolean is null or sd.is_active = $4::boolean)
        group by sd.id
        order by sd.is_active desc, sd.schedule_type, sd.name
        limit $5::int
      `,
      [
        query.organization_id,
        actorContext.firmId,
        query.schedule_type ?? null,
        query.is_active === undefined ? null : query.is_active === 'true',
        query.limit ?? 50
      ]
    );

    return {
      organization_id: query.organization_id,
      actor_context: actorContext,
      filters: {
        schedule_type: query.schedule_type ?? null,
        is_active: query.is_active === undefined ? null : query.is_active === 'true',
        limit: query.limit ?? 50
      },
      items: result.rows
    };
  }

  async createScheduleDefinition(input: CreateScheduleDefinitionDto, actor: AuthenticatedActor) {
    const actorContext = await this.tenantAccessService.assertOrganizationAccess(actor, input.organization_id);
    const glAccountIds = [...new Set(input.gl_account_ids)];
    const name = input.name.trim();
    const description = input.description?.trim() || null;
    const groupBy = input.group_by?.trim() || null;

    if (name === '') {
      throw new BadRequestException('Schedule definition name is required.');
    }

    const accountResult = await this.databaseService.query<{ account_id: string }>(
      `
        select id::text as account_id
        from public.accounts
        where organization_id = $1::uuid
          and firm_id = $2::uuid
          and status = 'active'
          and id = any($3::uuid[])
      `,
      [input.organization_id, actorContext.firmId, glAccountIds]
    );

    const matchedAccountIds = new Set(accountResult.rows.map((row) => row.account_id));
    const missingAccountIds = glAccountIds.filter((accountId) => !matchedAccountIds.has(accountId));

    if (missingAccountIds.length > 0) {
      throw new BadRequestException('All GL accounts must be active accounts in the requested organization.');
    }

    const result = await this.databaseService.query(
      `
        insert into public.schedule_definitions (
          firm_id,
          organization_id,
          schedule_type,
          name,
          description,
          gl_account_ids,
          generation_strategy,
          group_by,
          is_active,
          metadata
        )
        values (
          $1::uuid,
          $2::uuid,
          $3,
          $4,
          $5,
          $6::uuid[],
          'ledger_derived',
          $7,
          true,
          '{}'::jsonb
        )
        returning
          id::text as schedule_definition_id,
          firm_id::text,
          organization_id::text,
          schedule_type,
          name,
          description,
          gl_account_ids::text[] as gl_account_ids,
          generation_strategy,
          group_by,
          is_active,
          metadata,
          created_at,
          updated_at
      `,
      [actorContext.firmId, input.organization_id, input.schedule_type, name, description, glAccountIds, groupBy]
    );

    return {
      ...result.rows[0],
      actor_context: actorContext
    };
  }

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

  async generateScheduleRun(input: GenerateScheduleRunDto, actor: AuthenticatedActor) {
    if (input.schedule_definition_id === undefined && input.schedule_type === undefined) {
      throw new BadRequestException('Either schedule_definition_id or schedule_type is required.');
    }

    const actorContext = await this.tenantAccessService.assertOrganizationAccess(actor, input.organization_id);
    const generatedByActorId = actor.actorType === 'user' ? actorContext.appUserId : actor.clientId ?? actor.authUserId;

    return this.databaseService.withTransaction(async (client) => {
      const definitionResult = await client.query<{
        schedule_definition_id: string;
        firm_id: string;
        organization_id: string | null;
        schedule_type: string;
        schedule_name: string;
        gl_account_ids: string[];
        generation_strategy: string;
        group_by: string | null;
      }>(
        `
          select
            sd.id::text as schedule_definition_id,
            sd.firm_id::text,
            sd.organization_id::text,
            sd.schedule_type,
            sd.name as schedule_name,
            sd.gl_account_ids::text[] as gl_account_ids,
            sd.generation_strategy,
            sd.group_by
          from public.schedule_definitions sd
          where sd.firm_id = $1::uuid
            and sd.is_active = true
            and ($2::uuid is null or sd.id = $2::uuid)
            and ($3::text is null or sd.schedule_type = $3::text)
            and (sd.organization_id = $4::uuid or sd.organization_id is null)
          order by sd.organization_id nulls last, sd.created_at desc
          limit 1
        `,
        [actorContext.firmId, input.schedule_definition_id ?? null, input.schedule_type ?? null, input.organization_id]
      );

      const definition = definitionResult.rows[0];

      if (definition === undefined) {
        throw new NotFoundException('No active schedule definition matched the requested schedule.');
      }

      if (definition.generation_strategy !== 'ledger_derived') {
        throw new BadRequestException(
          `Schedule definition ${definition.schedule_definition_id} uses ${definition.generation_strategy}, but only ledger_derived generation is currently implemented.`
        );
      }

      const priorRunResult = await client.query<{ schedule_run_id: string }>(
        `
          select id::text as schedule_run_id
          from public.schedule_runs
          where organization_id = $1::uuid
            and schedule_definition_id = $2::uuid
            and as_of_date = $3::date
            and status <> 'superseded'
          order by generated_at desc
          limit 1
        `,
        [input.organization_id, definition.schedule_definition_id, input.as_of_date]
      );
      const supersedesScheduleRunId = priorRunResult.rows[0]?.schedule_run_id ?? null;

      const balanceResult = await client.query<{
        account_id: string;
        account_code: string;
        account_name: string;
        account_type: string;
        account_subtype: string | null;
        net_balance: string;
      }>(
        `
          select
            tb.account_id::text,
            tb.account_code,
            tb.account_name,
            tb.account_type,
            tb.account_subtype,
            tb.net_balance::text
          from public.fn_trial_balance($1::uuid, $2::date, true) tb
          where tb.account_id = any($3::uuid[])
          order by tb.account_code, tb.account_name
        `,
        [input.organization_id, input.as_of_date, definition.gl_account_ids]
      );

      const scheduleTotal = balanceResult.rows.reduce((total, row) => total + Number(row.net_balance), 0);
      const glBalance = scheduleTotal;
      const variance = glBalance - scheduleTotal;
      const runStatus = variance === 0 ? 'reconciled' : 'variance_detected';

      if (supersedesScheduleRunId !== null) {
        await client.query(
          `
            update public.schedule_runs
            set status = 'superseded', updated_at = now()
            where id = $1::uuid
          `,
          [supersedesScheduleRunId]
        );
      }

      const runInsert = await client.query<{ schedule_run_id: string }>(
        `
          insert into public.schedule_runs (
            firm_id,
            organization_id,
            schedule_definition_id,
            supersedes_schedule_run_id,
            schedule_type,
            as_of_date,
            status,
            gl_balance,
            schedule_total,
            variance,
            generated_by_actor_type,
            generated_by_actor_id,
            metadata
          )
          values (
            $1::uuid,
            $2::uuid,
            $3::uuid,
            $4::uuid,
            $5,
            $6::date,
            $7,
            $8,
            $9,
            $10,
            $11,
            $12,
            $13::jsonb
          )
          returning id::text as schedule_run_id
        `,
        [
          actorContext.firmId,
          input.organization_id,
          definition.schedule_definition_id,
          supersedesScheduleRunId,
          definition.schedule_type,
          input.as_of_date,
          runStatus,
          glBalance,
          scheduleTotal,
          variance,
          actor.actorType,
          generatedByActorId,
          JSON.stringify({
            generation_strategy: definition.generation_strategy,
            generated_from: 'fn_trial_balance'
          })
        ]
      );

      const scheduleRunId = runInsert.rows[0]?.schedule_run_id;

      if (scheduleRunId === undefined) {
        throw new BadRequestException('Failed to create schedule run.');
      }

      for (const [index, row] of balanceResult.rows.entries()) {
        await client.query(
          `
            insert into public.schedule_run_rows (
              schedule_run_id,
              row_order,
              reference_type,
              reference_id,
              reference_number,
              counterparty_name,
              document_date,
              opening_amount,
              movement_amount,
              closing_amount,
              metadata
            )
            values (
              $1::uuid,
              $2,
              'gl_account',
              $3,
              $4,
              $5,
              $6::date,
              0,
              $7,
              $7,
              $8::jsonb
            )
          `,
          [
            scheduleRunId,
            index + 1,
            row.account_id,
            row.account_code,
            row.account_name,
            input.as_of_date,
            Number(row.net_balance),
            JSON.stringify({
              account_type: row.account_type,
              account_subtype: row.account_subtype
            })
          ]
        );
      }

      await client.query(
        `
          insert into public.schedule_reconciliations (
            schedule_run_id,
            firm_id,
            organization_id,
            gl_balance,
            schedule_total,
            variance,
            status,
            metadata
          )
          values (
            $1::uuid,
            $2::uuid,
            $3::uuid,
            $4,
            $5,
            $6,
            $7,
            $8::jsonb
          )
        `,
        [
          scheduleRunId,
          actorContext.firmId,
          input.organization_id,
          glBalance,
          scheduleTotal,
          variance,
          variance === 0 ? 'unreviewed' : 'variance_detected',
          JSON.stringify({
            schedule_definition_id: definition.schedule_definition_id
          })
        ]
      );

      return {
        schedule_run_id: scheduleRunId,
        organization_id: input.organization_id,
        schedule_definition_id: definition.schedule_definition_id,
        schedule_name: definition.schedule_name,
        schedule_type: definition.schedule_type,
        as_of_date: input.as_of_date,
        status: runStatus,
        gl_balance: glBalance,
        schedule_total: scheduleTotal,
        variance,
        reconciliation_status: variance === 0 ? 'unreviewed' : 'variance_detected',
        supersedes_schedule_run_id: supersedesScheduleRunId,
        actor_context: actorContext,
        rows: balanceResult.rows.map((row, index) => ({
          row_order: index + 1,
          reference_type: 'gl_account',
          reference_id: row.account_id,
          reference_number: row.account_code,
          counterparty_name: row.account_name,
          document_date: input.as_of_date,
          opening_amount: '0.00',
          movement_amount: row.net_balance,
          closing_amount: row.net_balance,
          metadata: {
            account_type: row.account_type,
            account_subtype: row.account_subtype
          }
        }))
      };
    });
  }

  async reviewScheduleRun(scheduleRunId: string, input: ReviewScheduleRunDto, actor: AuthenticatedActor) {
    const actorContext = await this.tenantAccessService.assertOrganizationAccess(actor, input.organization_id);
    const reviewedByUserId = actor.actorType === 'user' ? actorContext.appUserId : null;

    if (reviewedByUserId === null) {
      throw new BadRequestException('Only authenticated users can review schedule runs.');
    }

    const notes = input.notes?.trim() || null;

    if (input.resolution === 'approved_with_variance' && notes === null) {
      throw new BadRequestException('Notes are required when approving a schedule with variance.');
    }

    return this.databaseService.withTransaction(async (client) => {
      const runResult = await client.query<{
        schedule_run_id: string;
        organization_id: string;
        schedule_definition_id: string;
        schedule_type: string;
        as_of_date: string;
        status: string;
        gl_balance: string;
        schedule_total: string;
        variance: string;
        reconciliation_id: string;
        reconciliation_status: string;
      }>(
        `
          select
            sr.id::text as schedule_run_id,
            sr.organization_id::text,
            sr.schedule_definition_id::text,
            sr.schedule_type,
            sr.as_of_date::text,
            sr.status,
            sr.gl_balance::text,
            sr.schedule_total::text,
            sr.variance::text,
            rec.id::text as reconciliation_id,
            rec.status as reconciliation_status
          from public.schedule_runs sr
          join public.schedule_reconciliations rec
            on rec.schedule_run_id = sr.id
          where sr.id = $1::uuid
            and sr.organization_id = $2::uuid
            and sr.firm_id = $3::uuid
          limit 1
        `,
        [scheduleRunId, input.organization_id, actorContext.firmId]
      );

      const run = runResult.rows[0];

      if (run === undefined) {
        throw new NotFoundException('Schedule run was not found for the requested organization.');
      }

      const variance = Number(run.variance);

      if (input.resolution === 'reconciled' && variance !== 0) {
        throw new BadRequestException('Only zero-variance schedules can be marked reconciled.');
      }

      if (input.resolution === 'approved_with_variance' && variance === 0) {
        throw new BadRequestException('Use reconciled for zero-variance schedules.');
      }

      const reconciliationResult = await client.query(
        `
          update public.schedule_reconciliations
          set
            status = $1,
            reviewed_by_user_id = $2::uuid,
            reviewed_at = now(),
            notes = $3,
            updated_at = now()
          where id = $4::uuid
          returning
            id::text as reconciliation_id,
            status as reconciliation_status,
            reviewed_at as reconciliation_reviewed_at,
            reviewed_by_user_id::text as reconciliation_reviewed_by_user_id,
            notes as reconciliation_notes
        `,
        [input.resolution, reviewedByUserId, notes, run.reconciliation_id]
      );

      await client.query(
        `
          update public.schedule_runs
          set
            status = 'reviewed',
            reviewed_by_user_id = $1::uuid,
            reviewed_at = now(),
            updated_at = now()
          where id = $2::uuid
        `,
        [reviewedByUserId, scheduleRunId]
      );

      await client.query(
        `
          insert into public.audit_logs (
            firm_id,
            organization_id,
            event_name,
            actor_type,
            actor_id,
            user_id,
            entity_type,
            entity_id,
            action_status,
            before_state,
            after_state,
            metadata,
            source_channel,
            source_route
          )
          values (
            $1::uuid,
            $2::uuid,
            'schedule.reviewed',
            $3,
            $4,
            $5::uuid,
            'schedule_run',
            $6,
            'succeeded',
            $7::jsonb,
            $8::jsonb,
            $9::jsonb,
            'api',
            $10
          )
        `,
        [
          actorContext.firmId,
          input.organization_id,
          actor.actorType,
          reviewedByUserId,
          reviewedByUserId,
          scheduleRunId,
          JSON.stringify({
            schedule_run_status: run.status,
            reconciliation_status: run.reconciliation_status,
            reviewed_by_user_id: null
          }),
          JSON.stringify({
            schedule_run_status: 'reviewed',
            reconciliation_status: input.resolution,
            reviewed_by_user_id: reviewedByUserId,
            notes
          }),
          JSON.stringify({
            schedule_definition_id: run.schedule_definition_id,
            schedule_type: run.schedule_type,
            as_of_date: run.as_of_date,
            variance: run.variance
          }),
          `/api/v1/schedules/runs/${scheduleRunId}/review`
        ]
      );

      return {
        ...run,
        status: 'reviewed',
        ...reconciliationResult.rows[0],
        reviewed_by_user_id: reviewedByUserId,
        actor_context: actorContext
      };
    });
  }
}
