import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import type { AuthenticatedActor } from '../auth/authenticated-request.interface';
import { TenantAccessService } from '../auth/tenant-access.service';
import { DatabaseService, type Queryable } from '../database/database.service';
import { AppError } from '../shared/app-error';
import { CreateJournalEntryDraftInputDto } from './dto/create-journal-entry-draft.dto';
import { GetAgentProposalInputDto } from './dto/get-agent-proposal.dto';
import { GetJournalEntryDraftInputDto } from './dto/get-journal-entry-draft.dto';
import { ListAgentProposalsInputDto } from './dto/list-agent-proposals.dto';
import { SubmitJournalEntryDraftForApprovalInputDto } from './dto/submit-journal-entry-draft-for-approval.dto';
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

interface DraftDetailRow {
  draft_id: string;
  draft_number: string | null;
  status: string;
  entry_date: string;
  memo: string | null;
  source_type: string;
  source_id: string | null;
  accounting_period_id: string | null;
  created_by_actor_type: string;
  created_by_actor_id: string;
  created_by_user_id: string | null;
  proposal_id: string | null;
  proposal_status: string | null;
  validation_summary: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
}

interface DraftLineRow {
  id: string;
  line_number: number;
  account_id: string;
  account_code: string;
  account_name: string;
  description: string | null;
  debit: string;
  credit: string;
}

interface ProposalListRow {
  proposal_id: string;
  proposal_type: string;
  status: string;
  title: string;
  created_at: string;
  updated_at: string;
  source_tool_name: string | null;
  source_request_id: string | null;
  correlation_id: string | null;
  idempotency_key: string | null;
  target_entity_type: string | null;
  target_entity_id: string | null;
  draft_number: string | null;
}

interface ProposalDetailRow {
  proposal_id: string;
  proposal_type: string;
  status: string;
  title: string;
  description: string | null;
  source_agent_name: string | null;
  source_agent_run_id: string | null;
  source_tool_name: string | null;
  source_request_id: string | null;
  correlation_id: string | null;
  idempotency_key: string | null;
  target_entity_type: string | null;
  target_entity_id: string | null;
  payload: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_by_actor_type: string;
  created_by_actor_id: string;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  draft_number: string | null;
  draft_status: string | null;
}

interface DraftApprovalRow {
  draft_id: string;
  draft_number: string | null;
  status: string;
  entry_date: string;
  memo: string | null;
  accounting_period_id: string | null;
  validation_summary: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  proposal_id: string | null;
}

interface ApprovalRequestInsertRow {
  approval_request_id: string;
  status: string;
  priority: string;
  created_at: string;
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

  async getJournalEntryDraft(input: GetJournalEntryDraftInputDto, actor: AuthenticatedActor) {
    const actorContext = await this.tenantAccessService.assertOrganizationAccess(actor, input.organization_id);

    const draftResult = await this.databaseService.query<DraftDetailRow>(
      `
        select
          d.id::text as draft_id,
          d.draft_number,
          d.status,
          d.entry_date::text,
          d.memo,
          d.source_type,
          d.source_id,
          d.accounting_period_id::text,
          d.created_by_actor_type,
          d.created_by_actor_id,
          d.created_by_user_id::text,
          ap.id::text as proposal_id,
          ap.status as proposal_status,
          d.validation_summary,
          d.metadata
        from public.journal_entry_drafts d
        left join public.agent_proposals ap
          on ap.target_entity_type = 'journal_entry_draft'
         and ap.target_entity_id = d.id
        where d.id = $1::uuid
          and d.organization_id = $2::uuid
        order by ap.created_at desc nulls last
        limit 1
      `,
      [input.draft_id, input.organization_id]
    );

    const draft = draftResult.rows[0];

    if (draft === undefined) {
      throw new AppError(
        'DRAFT_NOT_FOUND',
        `Journal draft ${input.draft_id} was not found for organization ${input.organization_id}.`
      );
    }

    const linesResult = await this.databaseService.query<DraftLineRow>(
      `
        select
          l.id::text,
          l.line_number,
          l.account_id::text,
          a.code as account_code,
          a.name as account_name,
          l.description,
          l.debit::text,
          l.credit::text
        from public.journal_entry_draft_lines l
        join public.accounts a
          on a.id = l.account_id
        where l.draft_id = $1::uuid
        order by l.line_number asc
      `,
      [input.draft_id]
    );

    return {
      organization_id: input.organization_id,
      draft_id: draft.draft_id,
      draft_number: draft.draft_number,
      status: draft.status,
      entry_date: draft.entry_date,
      memo: draft.memo,
      source_type: draft.source_type,
      source_id: draft.source_id,
      accounting_period_id: draft.accounting_period_id,
      actor_context: actorContext,
      created_by: {
        actor_type: draft.created_by_actor_type,
        actor_id: draft.created_by_actor_id,
        user_id: draft.created_by_user_id
      },
      proposal:
        draft.proposal_id === null
          ? null
          : {
              proposal_id: draft.proposal_id,
              status: draft.proposal_status
            },
      validation_summary: draft.validation_summary ?? {},
      metadata: draft.metadata ?? {},
      lines: linesResult.rows.map((line) => ({
        id: line.id,
        line_number: line.line_number,
        account_id: line.account_id,
        account_code: line.account_code,
        account_name: line.account_name,
        description: line.description,
        debit: Number(line.debit),
        credit: Number(line.credit)
      }))
    };
  }

  async listAgentProposals(input: ListAgentProposalsInputDto, actor: AuthenticatedActor) {
    const actorContext = await this.tenantAccessService.assertOrganizationAccess(actor, input.organization_id);
    const limit = input.limit ?? 20;

    const result = await this.databaseService.query<ProposalListRow>(
      `
        select
          ap.id::text as proposal_id,
          ap.proposal_type,
          ap.status,
          ap.title,
          ap.created_at::text,
          ap.updated_at::text,
          ap.source_tool_name,
          ap.source_request_id,
          ap.correlation_id,
          ap.idempotency_key,
          ap.target_entity_type,
          ap.target_entity_id::text,
          d.draft_number
        from public.agent_proposals ap
        left join public.journal_entry_drafts d
          on ap.target_entity_type = 'journal_entry_draft'
         and ap.target_entity_id = d.id
        where ap.organization_id = $1::uuid
          and ($2::text is null or ap.status = $2::text)
        order by ap.created_at desc
        limit $3
      `,
      [input.organization_id, input.status ?? null, limit]
    );

    return {
      organization_id: input.organization_id,
      actor_context: actorContext,
      filters: {
        status: input.status ?? null,
        limit
      },
      items: result.rows.map((row) => ({
        proposal_id: row.proposal_id,
        proposal_type: row.proposal_type,
        status: row.status,
        title: row.title,
        created_at: row.created_at,
        updated_at: row.updated_at,
        source_tool_name: row.source_tool_name,
        source_request_id: row.source_request_id,
        correlation_id: row.correlation_id,
        idempotency_key: row.idempotency_key,
        target_entity_type: row.target_entity_type,
        target_entity_id: row.target_entity_id,
        draft_number: row.draft_number
      }))
    };
  }

  async getAgentProposal(input: GetAgentProposalInputDto, actor: AuthenticatedActor) {
    const actorContext = await this.tenantAccessService.assertOrganizationAccess(actor, input.organization_id);

    const result = await this.databaseService.query<ProposalDetailRow>(
      `
        select
          ap.id::text as proposal_id,
          ap.proposal_type,
          ap.status,
          ap.title,
          ap.description,
          ap.source_agent_name,
          ap.source_agent_run_id,
          ap.source_tool_name,
          ap.source_request_id,
          ap.correlation_id,
          ap.idempotency_key,
          ap.target_entity_type,
          ap.target_entity_id::text,
          ap.payload,
          ap.metadata,
          ap.created_by_actor_type,
          ap.created_by_actor_id,
          ap.created_by_user_id::text,
          ap.created_at::text,
          ap.updated_at::text,
          d.draft_number,
          d.status as draft_status
        from public.agent_proposals ap
        left join public.journal_entry_drafts d
          on ap.target_entity_type = 'journal_entry_draft'
         and ap.target_entity_id = d.id
        where ap.id = $1::uuid
          and ap.organization_id = $2::uuid
        limit 1
      `,
      [input.proposal_id, input.organization_id]
    );

    const proposal = result.rows[0];

    if (proposal === undefined) {
      throw new AppError(
        'PROPOSAL_NOT_FOUND',
        `Agent proposal ${input.proposal_id} was not found for organization ${input.organization_id}.`
      );
    }

    return {
      organization_id: input.organization_id,
      proposal_id: proposal.proposal_id,
      proposal_type: proposal.proposal_type,
      status: proposal.status,
      title: proposal.title,
      description: proposal.description,
      actor_context: actorContext,
      source: {
        agent_name: proposal.source_agent_name,
        agent_run_id: proposal.source_agent_run_id,
        tool_name: proposal.source_tool_name,
        request_id: proposal.source_request_id,
        correlation_id: proposal.correlation_id,
        idempotency_key: proposal.idempotency_key
      },
      created_by: {
        actor_type: proposal.created_by_actor_type,
        actor_id: proposal.created_by_actor_id,
        user_id: proposal.created_by_user_id
      },
      target: proposal.target_entity_type === null
        ? null
        : {
            entity_type: proposal.target_entity_type,
            entity_id: proposal.target_entity_id,
            draft_number: proposal.draft_number,
            draft_status: proposal.draft_status
          },
      payload: proposal.payload ?? {},
      metadata: proposal.metadata ?? {},
      created_at: proposal.created_at,
      updated_at: proposal.updated_at
    };
  }

  async submitJournalEntryDraftForApproval(
    input: SubmitJournalEntryDraftForApprovalInputDto,
    actor: AuthenticatedActor,
    context: ToolRequestContext
  ) {
    const actorContext = await this.tenantAccessService.assertOrganizationAccess(actor, input.organization_id);
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
            'The supplied idempotency_key was already used with a different submit_journal_entry_draft_for_approval payload.'
          );
        }

        if (existing.status === 'succeeded' && existing.response_body !== null) {
          return existing.response_body;
        }

        throw new AppError(
          'IDEMPOTENCY_CONFLICT',
          `The supplied idempotency_key is already reserved for submit_journal_entry_draft_for_approval with status ${existing.status}.`
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

      const draftResult = await client.query<DraftApprovalRow>(
        `
          select
            d.id::text as draft_id,
            d.draft_number,
            d.status,
            d.entry_date::text,
            d.memo,
            d.accounting_period_id::text,
            d.validation_summary,
            d.metadata,
            ap.id::text as proposal_id
          from public.journal_entry_drafts d
          left join public.agent_proposals ap
            on ap.target_entity_type = 'journal_entry_draft'
           and ap.target_entity_id = d.id
          where d.id = $1::uuid
            and d.organization_id = $2::uuid
          order by ap.created_at desc nulls last
          limit 1
        `,
        [input.draft_id, input.organization_id]
      );

      const draft = draftResult.rows[0];

      if (draft === undefined) {
        throw new AppError(
          'DRAFT_NOT_FOUND',
          `Journal draft ${input.draft_id} was not found for organization ${input.organization_id}.`
        );
      }

      if (draft.status !== 'validated') {
        throw new AppError(
          'DRAFT_SUBMISSION_INVALID_STATE',
          `Journal draft ${input.draft_id} must be in validated status before it can be submitted for approval.`
        );
      }

      const approvalInsert = await client.query<ApprovalRequestInsertRow>(
        `
          insert into public.approval_requests (
            firm_id,
            organization_id,
            action_type,
            target_entity_type,
            target_entity_id,
            target_entity_snapshot,
            submitted_by_actor_type,
            submitted_by_actor_id,
            submitted_by_user_id,
            status,
            priority,
            expires_at,
            policy_snapshot,
            metadata
          )
          values (
            $1::uuid,
            $2::uuid,
            'ledger.journal_draft.submitted_for_approval',
            'journal_entry_draft',
            $3,
            $4::jsonb,
            $5,
            $6,
            $7::uuid,
            'pending',
            $8,
            $9::timestamptz,
            '{}'::jsonb,
            $10::jsonb
          )
          returning
            id::text as approval_request_id,
            status,
            priority,
            created_at::text
        `,
        [
          actorContext.firmId,
          input.organization_id,
          draft.draft_id,
          JSON.stringify({
            draft_id: draft.draft_id,
            draft_number: draft.draft_number,
            status: draft.status,
            entry_date: draft.entry_date,
            memo: draft.memo,
            accounting_period_id: draft.accounting_period_id,
            validation_summary: draft.validation_summary ?? {}
          }),
          actorType,
          actorId,
          actorContext.appUserId,
          input.priority ?? 'normal',
          input.expires_at ?? null,
          JSON.stringify({
            source_tool_name: context.toolName,
            source_request_id: context.requestId,
            correlation_id: context.correlationId,
            idempotency_key: context.idempotencyKey
          })
        ]
      );

      const approvalRequest = approvalInsert.rows[0];

      if (approvalRequest === undefined) {
        throw new AppError('APPROVAL_REQUEST_CREATION_FAILED', 'Failed to create approval request.');
      }

      await client.query(
        `
          insert into public.approval_actions (
            approval_request_id,
            firm_id,
            organization_id,
            action,
            actor_type,
            actor_id,
            actor_display_name,
            user_id,
            request_id,
            correlation_id,
            idempotency_key,
            target_entity_type,
            target_entity_id,
            policy_snapshot,
            metadata
          )
          values (
            $1::uuid,
            $2::uuid,
            $3::uuid,
            'submitted',
            $4,
            $5,
            $6,
            $7::uuid,
            $8,
            $9,
            $10,
            'journal_entry_draft',
            $11,
            '{}'::jsonb,
            $12::jsonb
          )
        `,
        [
          approvalRequest.approval_request_id,
          actorContext.firmId,
          input.organization_id,
          actorType,
          actorId,
          actor.agentName ?? null,
          actorContext.appUserId,
          context.requestId,
          context.correlationId,
          context.idempotencyKey,
          draft.draft_id,
          JSON.stringify({
            draft_id: draft.draft_id,
            draft_number: draft.draft_number,
            submitted_via_tool: context.toolName
          })
        ]
      );

      await client.query(
        `
          update public.journal_entry_drafts
          set
            status = 'pending_approval',
            approval_request_id = $1::uuid,
            submitted_at = now(),
            submitted_by_actor_type = $2,
            submitted_by_actor_id = $3,
            updated_at = now()
          where id = $4::uuid
        `,
        [approvalRequest.approval_request_id, actorType, actorId, draft.draft_id]
      );

      await client.query(
        `
          update public.agent_proposals
          set
            status = 'pending_approval',
            approval_request_id = $1::uuid,
            updated_at = now()
          where organization_id = $2::uuid
            and target_entity_type = 'journal_entry_draft'
            and target_entity_id = $3::uuid
        `,
        [approvalRequest.approval_request_id, input.organization_id, draft.draft_id]
      );

      const response = {
        organization_id: input.organization_id,
        draft_id: draft.draft_id,
        draft_number: draft.draft_number,
        proposal_id: draft.proposal_id,
        approval_request_id: approvalRequest.approval_request_id,
        actor_context: actorContext,
        status: 'pending_approval',
        approval_status: approvalRequest.status,
        requires_approval: true,
        priority: approvalRequest.priority,
        submitted_at: approvalRequest.created_at
      };

      await client.query(
        `
          update public.idempotency_keys
          set
            status = 'succeeded',
            resource_type = 'approval_request',
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
          approvalRequest.approval_request_id,
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

  private hashRequestPayload(input: unknown) {
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
