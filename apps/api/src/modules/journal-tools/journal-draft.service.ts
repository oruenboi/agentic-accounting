import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import type { AuthenticatedActor } from '../auth/authenticated-request.interface';
import { TenantAccessService } from '../auth/tenant-access.service';
import { DatabaseService, type Queryable } from '../database/database.service';
import { AppError } from '../shared/app-error';
import { CreateJournalEntryDraftInputDto } from './dto/create-journal-entry-draft.dto';
import type { ValidateJournalEntryLineDto } from './dto/validate-journal-entry.dto';
import { JournalValidationService } from './journal-validation.service';

interface ToolRequestContext {
  requestId: string;
  correlationId: string | null;
  idempotencyKey: string;
  toolName: string;
}

interface IdempotencyRow {
  request_hash: string;
  status: string;
  response_body: unknown | null;
}

interface SequenceRow {
  prefix: string | null;
  allocated_value: number | string;
  padding_width: number;
}

interface DraftRow {
  id: string;
}

interface ProposalRow {
  id: string;
}

@Injectable()
export class JournalDraftService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly tenantAccessService: TenantAccessService,
    private readonly journalValidationService: JournalValidationService
  ) {}

  async createJournalEntryDraft(
    input: CreateJournalEntryDraftInputDto,
    actor: AuthenticatedActor,
    context: ToolRequestContext
  ) {
    const validation = await this.journalValidationService.validateJournalEntry(input, actor);

    if (!validation.valid) {
      throw new AppError(
        'JOURNAL_ENTRY_INVALID',
        validation.errors.map((error) => error.message).join('; ') || 'Journal entry validation failed.'
      );
    }

    const actorContext = validation.actor_context;
    const requestHash = this.hashRequestPayload(input);
    const actorType = actor.actorType;
    const actorId = this.resolveActorId(actor);

    return this.databaseService.withTransaction(async (client) => {
      const existing = await this.loadIdempotencyRecord(
        client,
        actorContext.firmId,
        input.organization_id,
        actorType,
        actorId,
        context.idempotencyKey,
        context.toolName
      );

      if (existing !== null) {
        if (existing.request_hash !== requestHash) {
          throw new AppError(
            'IDEMPOTENCY_CONFLICT',
            'The supplied idempotency_key was already used with a different create_journal_entry_draft payload.'
          );
        }

        if (existing.status === 'succeeded' && existing.response_body !== null) {
          return existing.response_body;
        }

        throw new AppError(
          'IDEMPOTENCY_CONFLICT',
          `The supplied idempotency_key is already reserved for create_journal_entry_draft with status ${existing.status}.`
        );
      }

      await client.query(
        `
          insert into public.idempotency_keys (
            firm_id,
            organization_id,
            actor_type,
            actor_id,
            request_id,
            idempotency_key,
            operation_name,
            request_hash,
            normalized_payload,
            status
          )
          values ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9::jsonb, 'pending')
        `,
        [
          actorContext.firmId,
          input.organization_id,
          actorType,
          actorId,
          context.requestId,
          context.idempotencyKey,
          context.toolName,
          requestHash,
          JSON.stringify(this.normalizePayload(input))
        ]
      );

      const draftNumber = await this.allocateDraftNumber(client, input.organization_id);

      const draftInsert = await client.query<DraftRow>(
        `
          insert into public.journal_entry_drafts (
            firm_id,
            organization_id,
            accounting_period_id,
            draft_number,
            entry_date,
            memo,
            source_type,
            source_id,
            status,
            created_by_actor_type,
            created_by_actor_id,
            created_by_user_id,
            validation_summary,
            metadata
          )
          values (
            $1::uuid,
            $2::uuid,
            $3::uuid,
            $4,
            $5::date,
            $6,
            $7,
            $8,
            'validated',
            $9,
            $10,
            $11::uuid,
            $12::jsonb,
            $13::jsonb
          )
          returning id::text
        `,
        [
          actorContext.firmId,
          input.organization_id,
          input.accounting_period_id ?? validation.validation_result.period?.id ?? null,
          draftNumber,
          input.entry_date,
          input.memo ?? null,
          input.source_type,
          context.requestId,
          actorType,
          actorId,
          actorContext.appUserId,
          JSON.stringify({
            valid: validation.valid,
            errors: validation.errors,
            warnings: validation.warnings,
            validation_result: validation.validation_result
          }),
          JSON.stringify(input.metadata ?? {})
        ]
      );

      const draftId = draftInsert.rows[0]?.id;

      if (draftId === undefined) {
        throw new AppError('DRAFT_CREATION_FAILED', 'Failed to create journal draft.');
      }

      await this.insertDraftLines(client, draftId, input.lines);

      const proposalInsert = await client.query<ProposalRow>(
        `
          insert into public.agent_proposals (
            firm_id,
            organization_id,
            proposal_type,
            status,
            title,
            description,
            source_agent_name,
            source_agent_run_id,
            source_tool_name,
            source_request_id,
            correlation_id,
            idempotency_key,
            target_entity_type,
            target_entity_id,
            payload,
            metadata,
            created_by_actor_type,
            created_by_actor_id,
            created_by_user_id
          )
          values (
            $1::uuid,
            $2::uuid,
            'journal_entry',
            'needs_review',
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            'journal_entry_draft',
            $11::uuid,
            $12::jsonb,
            $13::jsonb,
            $14,
            $15,
            $16::uuid
          )
          returning id::text
        `,
        [
          actorContext.firmId,
          input.organization_id,
          this.buildProposalTitle(input),
          input.memo ?? null,
          actor.agentName ?? null,
          actor.agentRunId ?? null,
          context.toolName,
          context.requestId,
          context.correlationId,
          context.idempotencyKey,
          draftId,
          JSON.stringify({
            draft_id: draftId,
            draft_number: draftNumber,
            entry_date: input.entry_date,
            memo: input.memo ?? null,
            source_type: input.source_type,
            lines: input.lines
          }),
          JSON.stringify({
            impact_preview: validation.impact_preview,
            validation_result: validation.validation_result,
            warnings: validation.warnings
          }),
          actorType,
          actorId,
          actorContext.appUserId
        ]
      );

      const proposalId = proposalInsert.rows[0]?.id;

      if (proposalId === undefined) {
        throw new AppError('PROPOSAL_CREATION_FAILED', 'Failed to persist the linked agent proposal.');
      }

      const response = {
        organization_id: input.organization_id,
        draft_id: draftId,
        draft_number: draftNumber,
        proposal_id: proposalId,
        actor_context: actorContext,
        status: 'validated',
        requires_approval: false,
        entry_date: input.entry_date,
        line_count: input.lines.length,
        validation_result: validation.validation_result,
        impact_preview: validation.impact_preview
      };

      await client.query(
        `
          update public.idempotency_keys
          set
            status = 'succeeded',
            resource_type = 'journal_entry_draft',
            resource_id = $1,
            response_code = 201,
            response_body = $2::jsonb,
            last_seen_at = now()
          where firm_id = $3::uuid
            and organization_id = $4::uuid
            and actor_type = $5
            and actor_id = $6
            and idempotency_key = $7
            and operation_name = $8
        `,
        [
          draftId,
          JSON.stringify(response),
          actorContext.firmId,
          input.organization_id,
          actorType,
          actorId,
          context.idempotencyKey,
          context.toolName
        ]
      );

      return response;
    });
  }

  private async loadIdempotencyRecord(
    client: Queryable,
    firmId: string,
    organizationId: string,
    actorType: string,
    actorId: string,
    idempotencyKey: string,
    operationName: string
  ) {
    const result = await client.query<IdempotencyRow>(
      `
        select
          request_hash,
          status,
          response_body
        from public.idempotency_keys
        where firm_id = $1::uuid
          and organization_id = $2::uuid
          and actor_type = $3
          and actor_id = $4
          and idempotency_key = $5
          and operation_name = $6
        limit 1
      `,
      [firmId, organizationId, actorType, actorId, idempotencyKey, operationName]
    );

    return result.rows[0] ?? null;
  }

  private async allocateDraftNumber(client: Queryable, organizationId: string) {
    const result = await client.query<SequenceRow>(
      `
        update public.organization_sequences
        set
          next_value = next_value + 1,
          updated_at = now()
        where organization_id = $1::uuid
          and sequence_name = 'journal_entry'
        returning prefix, (next_value - 1) as allocated_value, padding_width
      `,
      [organizationId]
    );

    const row = result.rows[0];

    if (row === undefined) {
      throw new AppError('SEQUENCE_NOT_FOUND', 'No journal_entry sequence is configured for the organization.');
    }

    const value = String(row.allocated_value).padStart(row.padding_width, '0');
    return row.prefix === null || row.prefix.trim() === '' ? value : `${row.prefix}-${value}`;
  }

  private async insertDraftLines(client: Queryable, draftId: string, lines: ValidateJournalEntryLineDto[]) {
    for (const [index, line] of lines.entries()) {
      await client.query(
        `
          insert into public.journal_entry_draft_lines (
            draft_id,
            line_number,
            account_id,
            description,
            debit,
            credit,
            dimensions,
            metadata
          )
          values (
            $1::uuid,
            $2,
            $3::uuid,
            $4,
            $5,
            $6,
            '{}'::jsonb,
            '{}'::jsonb
          )
        `,
        [draftId, index + 1, line.account_id, line.description ?? null, line.debit, line.credit]
      );
    }
  }

  private buildProposalTitle(input: CreateJournalEntryDraftInputDto) {
    if (input.memo !== undefined && input.memo.trim() !== '') {
      return `Journal draft: ${input.memo.trim()}`;
    }

    return `Journal draft for ${input.entry_date}`;
  }

  private resolveActorId(actor: AuthenticatedActor) {
    if (actor.actorType === 'agent') {
      return actor.clientId ?? actor.agentName ?? actor.authUserId;
    }

    return actor.authUserId;
  }

  private hashRequestPayload(input: CreateJournalEntryDraftInputDto) {
    return createHash('sha256').update(JSON.stringify(this.normalizePayload(input))).digest('hex');
  }

  private normalizePayload(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.normalizePayload(item));
    }

    if (typeof value !== 'object' || value === null) {
      return value;
    }

    return Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((accumulator, key) => {
        const normalizedValue = this.normalizePayload((value as Record<string, unknown>)[key]);

        if (normalizedValue !== undefined) {
          accumulator[key] = normalizedValue;
        }

        return accumulator;
      }, {});
  }
}
