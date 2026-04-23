import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import type { AuthenticatedActor } from '../auth/authenticated-request.interface';
import { TenantAccessService } from '../auth/tenant-access.service';
import { DatabaseService, type Queryable } from '../database/database.service';
import { AppError } from '../shared/app-error';
import { CreateJournalEntryDraftInputDto } from './dto/create-journal-entry-draft.dto';
import { GetApprovalRequestInputDto } from './dto/get-approval-request.dto';
import { GetAgentProposalInputDto } from './dto/get-agent-proposal.dto';
import { GetJournalEntryInputDto } from './dto/get-journal-entry.dto';
import { GetJournalEntryReversalChainInputDto } from './dto/get-journal-entry-reversal-chain.dto';
import { GetJournalEntryDraftInputDto } from './dto/get-journal-entry-draft.dto';
import { ListApprovalRequestsInputDto } from './dto/list-approval-requests.dto';
import { ListAgentProposalsInputDto } from './dto/list-agent-proposals.dto';
import { ListJournalEntriesInputDto } from './dto/list-journal-entries.dto';
import { PostApprovedJournalEntryInputDto } from './dto/post-approved-journal-entry.dto';
import { ReversePostedJournalEntryInputDto } from './dto/reverse-posted-journal-entry.dto';
import { ResolveApprovalRequestInputDto } from './dto/resolve-approval-request.dto';
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

interface ApprovalRequestSummaryRow {
  approval_request_id: string;
  status: string;
  priority: string;
  action_type: string;
  target_entity_type: string;
  target_entity_id: string;
  submitted_at: string;
  submitted_by_actor_type: string;
  submitted_by_actor_id: string;
  submitted_by_user_id: string | null;
  current_approver_user_id: string | null;
  expires_at: string | null;
  resolved_at: string | null;
  resolved_by_user_id: string | null;
  resolution_reason: string | null;
  metadata: Record<string, unknown> | null;
  draft_number: string | null;
  draft_status: string | null;
  proposal_id: string | null;
  proposal_status: string | null;
}

interface ApprovalActionRow {
  approval_action_id: string;
  action: string;
  action_timestamp: string;
  actor_type: string;
  actor_id: string;
  actor_display_name: string | null;
  user_id: string | null;
  decision_reason: string | null;
  comments: string | null;
  request_id: string | null;
  correlation_id: string | null;
  idempotency_key: string | null;
  metadata: Record<string, unknown> | null;
}

interface DraftPostingRow {
  draft_id: string;
  draft_number: string | null;
  status: string;
  entry_date: string;
  memo: string | null;
  source_type: string;
  source_id: string | null;
  accounting_period_id: string | null;
  approval_request_id: string | null;
  approval_status: string | null;
  proposal_id: string | null;
}

interface JournalEntryRow {
  journal_entry_id: string;
  entry_number: string;
  posted_at: string;
}

interface OriginalJournalEntryRow {
  journal_entry_id: string;
  entry_number: string;
  entry_date: string;
  memo: string | null;
  source_type: string;
  source_id: string | null;
  status: string;
  accounting_period_id: string | null;
  reversal_of_journal_entry_id: string | null;
  reversal_record_id: string | null;
  reversal_journal_entry_id: string | null;
}

interface JournalEntryLineDetailRow {
  id: string;
  line_number: number;
  account_id: string;
  account_code?: string;
  account_name?: string;
  description: string | null;
  debit: string;
  credit: string;
  dimensions: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
}

interface JournalEntryListRow {
  journal_entry_id: string;
  entry_number: string;
  entry_date: string;
  memo: string | null;
  source_type: string;
  source_id: string | null;
  status: string;
  posted_at: string;
  draft_id: string | null;
  draft_number: string | null;
  proposal_id: string | null;
  proposal_status: string | null;
  reversal_of_journal_entry_id: string | null;
  reversal_journal_entry_id: string | null;
  line_count: string | number;
}

interface JournalEntryDetailRow {
  journal_entry_id: string;
  entry_number: string;
  entry_date: string;
  memo: string | null;
  source_type: string;
  source_id: string | null;
  status: string;
  posted_at: string;
  accounting_period_id: string | null;
  posted_by_actor_type: string;
  posted_by_actor_id: string;
  posted_by_user_id: string | null;
  metadata: Record<string, unknown> | null;
  draft_id: string | null;
  draft_number: string | null;
  draft_status: string | null;
  proposal_id: string | null;
  proposal_status: string | null;
  proposal_title: string | null;
  posted_entity_type: string | null;
  posted_entity_id: string | null;
  reversal_of_journal_entry_id: string | null;
  journal_entry_reversal_id: string | null;
  reversed_by_journal_entry_id: string | null;
  reversal_date: string | null;
  reversal_reason: string | null;
}

interface AccountingPeriodRow {
  accounting_period_id: string;
}

interface JournalEntryReversalRow {
  journal_entry_reversal_id: string;
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

  async listApprovalRequests(input: ListApprovalRequestsInputDto, actor: AuthenticatedActor) {
    const actorContext = await this.tenantAccessService.assertOrganizationAccess(actor, input.organization_id);
    const limit = input.limit ?? 20;

    const result = await this.databaseService.query<ApprovalRequestSummaryRow>(
      `
        select
          ar.id::text as approval_request_id,
          ar.status,
          ar.priority,
          ar.action_type,
          ar.target_entity_type,
          ar.target_entity_id,
          ar.created_at::text as submitted_at,
          ar.submitted_by_actor_type,
          ar.submitted_by_actor_id,
          ar.submitted_by_user_id::text,
          ar.current_approver_user_id::text,
          ar.expires_at::text,
          ar.resolved_at::text,
          ar.resolved_by_user_id::text,
          ar.resolution_reason,
          ar.metadata,
          d.draft_number,
          d.status as draft_status,
          ap.id::text as proposal_id,
          ap.status as proposal_status
        from public.approval_requests ar
        left join public.journal_entry_drafts d
          on ar.target_entity_type = 'journal_entry_draft'
         and d.id::text = ar.target_entity_id
        left join public.agent_proposals ap
          on ap.approval_request_id = ar.id
         and ap.organization_id = ar.organization_id
        where ar.organization_id = $1::uuid
          and ($2::text is null or ar.status = $2::text)
        order by ar.created_at desc
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
        approval_request_id: row.approval_request_id,
        status: row.status,
        priority: row.priority,
        action_type: row.action_type,
        submitted_at: row.submitted_at,
        submitted_by: {
          actor_type: row.submitted_by_actor_type,
          actor_id: row.submitted_by_actor_id,
          user_id: row.submitted_by_user_id
        },
        target: {
          entity_type: row.target_entity_type,
          entity_id: row.target_entity_id,
          draft_number: row.draft_number,
          draft_status: row.draft_status,
          proposal_id: row.proposal_id,
          proposal_status: row.proposal_status
        },
        current_approver_user_id: row.current_approver_user_id,
        expires_at: row.expires_at,
        resolved_at: row.resolved_at,
        resolved_by_user_id: row.resolved_by_user_id,
        resolution_reason: row.resolution_reason,
        metadata: row.metadata ?? {}
      }))
    };
  }

  async getApprovalRequest(input: GetApprovalRequestInputDto, actor: AuthenticatedActor) {
    const actorContext = await this.tenantAccessService.assertOrganizationAccess(actor, input.organization_id);

    const result = await this.databaseService.query<ApprovalRequestSummaryRow>(
      `
        select
          ar.id::text as approval_request_id,
          ar.status,
          ar.priority,
          ar.action_type,
          ar.target_entity_type,
          ar.target_entity_id,
          ar.created_at::text as submitted_at,
          ar.submitted_by_actor_type,
          ar.submitted_by_actor_id,
          ar.submitted_by_user_id::text,
          ar.current_approver_user_id::text,
          ar.expires_at::text,
          ar.resolved_at::text,
          ar.resolved_by_user_id::text,
          ar.resolution_reason,
          ar.metadata,
          d.draft_number,
          d.status as draft_status,
          ap.id::text as proposal_id,
          ap.status as proposal_status
        from public.approval_requests ar
        left join public.journal_entry_drafts d
          on ar.target_entity_type = 'journal_entry_draft'
         and d.id::text = ar.target_entity_id
        left join public.agent_proposals ap
          on ap.approval_request_id = ar.id
         and ap.organization_id = ar.organization_id
        where ar.id = $1::uuid
          and ar.organization_id = $2::uuid
        limit 1
      `,
      [input.approval_request_id, input.organization_id]
    );

    const approvalRequest = result.rows[0];

    if (approvalRequest === undefined) {
      throw new AppError(
        'APPROVAL_REQUEST_NOT_FOUND',
        `Approval request ${input.approval_request_id} was not found for organization ${input.organization_id}.`
      );
    }

    const actionsResult = await this.databaseService.query<ApprovalActionRow>(
      `
        select
          aa.id::text as approval_action_id,
          aa.action,
          aa.action_timestamp::text,
          aa.actor_type,
          aa.actor_id,
          aa.actor_display_name,
          aa.user_id::text,
          aa.decision_reason,
          aa.comments,
          aa.request_id,
          aa.correlation_id,
          aa.idempotency_key,
          aa.metadata
        from public.approval_actions aa
        where aa.approval_request_id = $1::uuid
        order by aa.action_timestamp asc, aa.created_at asc
      `,
      [input.approval_request_id]
    );

    return {
      organization_id: input.organization_id,
      approval_request_id: approvalRequest.approval_request_id,
      actor_context: actorContext,
      status: approvalRequest.status,
      priority: approvalRequest.priority,
      action_type: approvalRequest.action_type,
      submitted_at: approvalRequest.submitted_at,
      submitted_by: {
        actor_type: approvalRequest.submitted_by_actor_type,
        actor_id: approvalRequest.submitted_by_actor_id,
        user_id: approvalRequest.submitted_by_user_id
      },
      target: {
        entity_type: approvalRequest.target_entity_type,
        entity_id: approvalRequest.target_entity_id,
        draft_number: approvalRequest.draft_number,
        draft_status: approvalRequest.draft_status,
        proposal_id: approvalRequest.proposal_id,
        proposal_status: approvalRequest.proposal_status
      },
      current_approver_user_id: approvalRequest.current_approver_user_id,
      expires_at: approvalRequest.expires_at,
      resolved_at: approvalRequest.resolved_at,
      resolved_by_user_id: approvalRequest.resolved_by_user_id,
      resolution_reason: approvalRequest.resolution_reason,
      metadata: approvalRequest.metadata ?? {},
      actions: actionsResult.rows.map((row) => ({
        approval_action_id: row.approval_action_id,
        action: row.action,
        action_timestamp: row.action_timestamp,
        actor_type: row.actor_type,
        actor_id: row.actor_id,
        actor_display_name: row.actor_display_name,
        user_id: row.user_id,
        decision_reason: row.decision_reason,
        comments: row.comments,
        request_id: row.request_id,
        correlation_id: row.correlation_id,
        idempotency_key: row.idempotency_key,
        metadata: row.metadata ?? {}
      }))
    };
  }

  async resolveApprovalRequest(
    input: ResolveApprovalRequestInputDto,
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
            'The supplied idempotency_key was already used with a different resolve_approval_request payload.'
          );
        }

        if (existing.status === 'succeeded' && existing.response_body !== null) {
          return existing.response_body;
        }

        throw new AppError(
          'IDEMPOTENCY_CONFLICT',
          `The supplied idempotency_key is already reserved for resolve_approval_request with status ${existing.status}.`
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

      const result = await client.query<ApprovalRequestSummaryRow>(
        `
          select
            ar.id::text as approval_request_id,
            ar.status,
            ar.priority,
            ar.action_type,
            ar.target_entity_type,
            ar.target_entity_id,
            ar.created_at::text as submitted_at,
            ar.submitted_by_actor_type,
            ar.submitted_by_actor_id,
            ar.submitted_by_user_id::text,
            ar.current_approver_user_id::text,
            ar.expires_at::text,
            ar.resolved_at::text,
            ar.resolved_by_user_id::text,
            ar.resolution_reason,
            ar.metadata,
            d.draft_number,
            d.status as draft_status,
            ap.id::text as proposal_id,
            ap.status as proposal_status
          from public.approval_requests ar
          left join public.journal_entry_drafts d
            on ar.target_entity_type = 'journal_entry_draft'
           and d.id::text = ar.target_entity_id
          left join public.agent_proposals ap
            on ap.approval_request_id = ar.id
           and ap.organization_id = ar.organization_id
          where ar.id = $1::uuid
            and ar.organization_id = $2::uuid
          limit 1
        `,
        [input.approval_request_id, input.organization_id]
      );

      const approvalRequest = result.rows[0];

      if (approvalRequest === undefined) {
        throw new AppError(
          'APPROVAL_REQUEST_NOT_FOUND',
          `Approval request ${input.approval_request_id} was not found for organization ${input.organization_id}.`
        );
      }

      if (approvalRequest.status !== 'pending') {
        throw new AppError(
          'APPROVAL_REQUEST_INVALID_STATE',
          `Approval request ${input.approval_request_id} must be pending before it can be resolved.`
        );
      }

      if (approvalRequest.target_entity_type !== 'journal_entry_draft') {
        throw new AppError(
          'APPROVAL_TARGET_UNSUPPORTED',
          `Approval request ${input.approval_request_id} targets unsupported entity type ${approvalRequest.target_entity_type}.`
        );
      }

      await client.query(
        `
          update public.approval_requests
          set
            status = $1,
            resolved_at = now(),
            resolved_by_user_id = $2::uuid,
            resolution_reason = $3,
            updated_at = now()
          where id = $4::uuid
        `,
        [input.resolution, actorContext.appUserId, input.reason ?? null, input.approval_request_id]
      );

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
            decision_reason,
            comments,
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
            $4,
            $5,
            $6,
            $7,
            $8::uuid,
            $9,
            $10,
            $11,
            $12,
            $13,
            $14,
            $15,
            '{}'::jsonb,
            $16::jsonb
          )
        `,
        [
          input.approval_request_id,
          actorContext.firmId,
          input.organization_id,
          input.resolution,
          actorType,
          actorId,
          actor.agentName ?? null,
          actorContext.appUserId,
          input.reason ?? null,
          input.comments ?? null,
          context.requestId,
          context.correlationId,
          context.idempotencyKey,
          approvalRequest.target_entity_type,
          approvalRequest.target_entity_id,
          JSON.stringify({
            resolved_via_tool: context.toolName
          })
        ]
      );

      const draftStatus = input.resolution === 'approved' ? 'approved' : 'rejected';
      await client.query(
        `
          update public.journal_entry_drafts
          set
            status = $1,
            approved_at = case when $1 = 'approved' then now() else approved_at end,
            approved_by_user_id = case when $1 = 'approved' then $2::uuid else approved_by_user_id end,
            rejection_reason = case when $1 = 'rejected' then $3 else rejection_reason end,
            updated_at = now()
          where id::text = $4
            and organization_id = $5::uuid
        `,
        [draftStatus, actorContext.appUserId, input.reason ?? null, approvalRequest.target_entity_id, input.organization_id]
      );

      await client.query(
        `
          update public.agent_proposals
          set
            status = $1,
            resolved_at = now(),
            resolved_by_user_id = $2::uuid,
            updated_at = now()
          where approval_request_id = $3::uuid
            and organization_id = $4::uuid
        `,
        [input.resolution, actorContext.appUserId, input.approval_request_id, input.organization_id]
      );

      const response = {
        organization_id: input.organization_id,
        approval_request_id: input.approval_request_id,
        draft_id: approvalRequest.target_entity_id,
        draft_number: approvalRequest.draft_number,
        proposal_id: approvalRequest.proposal_id,
        actor_context: actorContext,
        status: input.resolution,
        draft_status: draftStatus,
        proposal_status: input.resolution,
        resolved_at: new Date().toISOString(),
        resolution_reason: input.reason ?? null
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
          input.approval_request_id,
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

  async postApprovedJournalEntry(
    input: PostApprovedJournalEntryInputDto,
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
            'The supplied idempotency_key was already used with a different post_approved_journal_entry payload.'
          );
        }

        if (existing.status === 'succeeded' && existing.response_body !== null) {
          return existing.response_body;
        }

        throw new AppError(
          'IDEMPOTENCY_CONFLICT',
          `The supplied idempotency_key is already reserved for post_approved_journal_entry with status ${existing.status}.`
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

      const draftResult = await client.query<DraftPostingRow>(
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
            d.approval_request_id::text,
            ar.status as approval_status,
            ap.id::text as proposal_id
          from public.journal_entry_drafts d
          left join public.approval_requests ar
            on ar.id = d.approval_request_id
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

      if (draft.status !== 'approved') {
        throw new AppError(
          'DRAFT_POST_INVALID_STATE',
          `Journal draft ${input.draft_id} must be approved before it can be posted.`
        );
      }

      if (draft.approval_request_id !== null && draft.approval_status !== 'approved') {
        throw new AppError(
          'APPROVAL_REQUEST_INVALID_STATE',
          `Approval request ${draft.approval_request_id} must be approved before draft ${input.draft_id} can be posted.`
        );
      }

      const linesResult = await client.query<DraftLineRow>(
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
        [draft.draft_id]
      );

      if (linesResult.rows.length < 2) {
        throw new AppError(
          'DRAFT_POST_INVALID_STATE',
          `Journal draft ${input.draft_id} does not have enough lines to post.`
        );
      }

      const entryNumber = draft.draft_number ?? (await this.allocateDraftNumber(client, input.organization_id));

      const journalEntryInsert = await client.query<JournalEntryRow>(
        `
          insert into public.journal_entries (
            firm_id,
            organization_id,
            accounting_period_id,
            draft_id,
            entry_number,
            entry_date,
            memo,
            source_type,
            source_id,
            status,
            posted_by_actor_type,
            posted_by_actor_id,
            posted_by_user_id,
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
            'posted',
            $10,
            $11,
            $12::uuid,
            $13::jsonb
          )
          returning id::text as journal_entry_id, entry_number, posted_at::text
        `,
        [
          actorContext.firmId,
          input.organization_id,
          draft.accounting_period_id,
          draft.draft_id,
          entryNumber,
          draft.entry_date,
          draft.memo,
          draft.source_type,
          draft.source_id,
          actorType,
          actorId,
          actorContext.appUserId,
          JSON.stringify({
            source_request_id: context.requestId,
            correlation_id: context.correlationId,
            idempotency_key: context.idempotencyKey
          })
        ]
      );

      const journalEntry = journalEntryInsert.rows[0];

      if (journalEntry === undefined) {
        throw new AppError('JOURNAL_ENTRY_POST_FAILED', 'Failed to create posted journal entry.');
      }

      for (const line of linesResult.rows) {
        await client.query(
          `
            insert into public.journal_entry_lines (
              journal_entry_id,
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
          [
            journalEntry.journal_entry_id,
            line.line_number,
            line.account_id,
            line.description,
            Number(line.debit),
            Number(line.credit)
          ]
        );
      }

      await client.query(
        `
          update public.journal_entry_drafts
          set
            status = 'posted',
            updated_at = now()
          where id = $1::uuid
        `,
        [draft.draft_id]
      );

      await client.query(
        `
          update public.agent_proposals
          set
            status = 'posted',
            posted_entity_type = 'journal_entry',
            posted_entity_id = $1::uuid,
            updated_at = now()
          where organization_id = $2::uuid
            and target_entity_type = 'journal_entry_draft'
            and target_entity_id = $3::uuid
        `,
        [journalEntry.journal_entry_id, input.organization_id, draft.draft_id]
      );

      const response = {
        organization_id: input.organization_id,
        draft_id: draft.draft_id,
        draft_number: draft.draft_number,
        proposal_id: draft.proposal_id,
        journal_entry_id: journalEntry.journal_entry_id,
        entry_number: journalEntry.entry_number,
        actor_context: actorContext,
        status: 'posted',
        draft_status: 'posted',
        proposal_status: 'posted',
        posted_at: journalEntry.posted_at,
        line_count: linesResult.rows.length
      };

      await client.query(
        `
          update public.idempotency_keys
          set
            status = 'succeeded',
            resource_type = 'journal_entry',
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
          journalEntry.journal_entry_id,
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

  async reversePostedJournalEntry(
    input: ReversePostedJournalEntryInputDto,
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
            'The supplied idempotency_key was already used with a different reverse_posted_journal_entry payload.'
          );
        }

        if (existing.status === 'succeeded' && existing.response_body !== null) {
          return existing.response_body;
        }

        throw new AppError(
          'IDEMPOTENCY_CONFLICT',
          `The supplied idempotency_key is already reserved for reverse_posted_journal_entry with status ${existing.status}.`
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

      const originalEntryResult = await client.query<OriginalJournalEntryRow>(
        `
          select
            je.id::text as journal_entry_id,
            je.entry_number,
            je.entry_date::text,
            je.memo,
            je.source_type,
            je.source_id,
            je.status,
            je.accounting_period_id::text,
            je.reversal_of_journal_entry_id::text,
            jer.id::text as reversal_record_id,
            jer.reversal_journal_entry_id::text
          from public.journal_entries je
          left join public.journal_entry_reversals jer
            on jer.original_journal_entry_id = je.id
          where je.id = $1::uuid
            and je.organization_id = $2::uuid
          limit 1
        `,
        [input.journal_entry_id, input.organization_id]
      );

      const originalEntry = originalEntryResult.rows[0];

      if (originalEntry === undefined) {
        throw new AppError(
          'JOURNAL_ENTRY_NOT_FOUND',
          `Journal entry ${input.journal_entry_id} was not found for organization ${input.organization_id}.`
        );
      }

      if (originalEntry.status !== 'posted') {
        throw new AppError(
          'REVERSAL_NOT_ALLOWED',
          `Journal entry ${input.journal_entry_id} must be in posted status before it can be reversed.`
        );
      }

      if (originalEntry.reversal_of_journal_entry_id !== null) {
        throw new AppError(
          'REVERSAL_NOT_ALLOWED',
          `Journal entry ${input.journal_entry_id} is itself a reversal entry and cannot be reversed again.`
        );
      }

      if (originalEntry.reversal_record_id !== null) {
        throw new AppError(
          'REVERSAL_NOT_ALLOWED',
          `Journal entry ${input.journal_entry_id} has already been reversed by entry ${originalEntry.reversal_journal_entry_id}.`
        );
      }

      const periodResult = await client.query<AccountingPeriodRow>(
        `
          select ap.id::text as accounting_period_id
          from public.accounting_periods ap
          where ap.organization_id = $1::uuid
            and ap.status = 'open'
            and $2::date between ap.period_start and ap.period_end
          order by ap.period_start asc
          limit 1
        `,
        [input.organization_id, input.reversal_date]
      );

      const accountingPeriodId = periodResult.rows[0]?.accounting_period_id;

      if (accountingPeriodId === undefined) {
        throw new AppError(
          'PERIOD_LOCKED',
          `No open accounting period was found for organization ${input.organization_id} on ${input.reversal_date}.`
        );
      }

      const linesResult = await client.query<JournalEntryLineDetailRow>(
        `
          select
            jel.id::text,
            jel.line_number,
            jel.account_id::text,
            jel.description,
            jel.debit::text,
            jel.credit::text,
            jel.dimensions,
            jel.metadata
          from public.journal_entry_lines jel
          where jel.journal_entry_id = $1::uuid
          order by jel.line_number asc
        `,
        [input.journal_entry_id]
      );

      if (linesResult.rows.length < 2) {
        throw new AppError(
          'REVERSAL_NOT_ALLOWED',
          `Journal entry ${input.journal_entry_id} does not have enough posted lines to reverse.`
        );
      }

      const entryNumber = await this.allocateDraftNumber(client, input.organization_id);

      const reversalEntryInsert = await client.query<JournalEntryRow>(
        `
          insert into public.journal_entries (
            firm_id,
            organization_id,
            accounting_period_id,
            draft_id,
            entry_number,
            entry_date,
            memo,
            source_type,
            source_id,
            status,
            posted_by_actor_type,
            posted_by_actor_id,
            posted_by_user_id,
            reversal_of_journal_entry_id,
            metadata
          )
          values (
            $1::uuid,
            $2::uuid,
            $3::uuid,
            null,
            $4,
            $5::date,
            $6,
            'journal_entry_reversal',
            $7,
            'posted',
            $8,
            $9,
            $10::uuid,
            $11::uuid,
            $12::jsonb
          )
          returning id::text as journal_entry_id, entry_number, posted_at::text
        `,
        [
          actorContext.firmId,
          input.organization_id,
          accountingPeriodId,
          entryNumber,
          input.reversal_date,
          `Reversal of ${originalEntry.entry_number}: ${input.reason}`,
          originalEntry.journal_entry_id,
          actorType,
          actorId,
          actorContext.appUserId,
          originalEntry.journal_entry_id,
          JSON.stringify({
            original_journal_entry_id: originalEntry.journal_entry_id,
            original_entry_number: originalEntry.entry_number,
            original_entry_date: originalEntry.entry_date,
            reason: input.reason,
            source_request_id: context.requestId,
            correlation_id: context.correlationId,
            idempotency_key: context.idempotencyKey
          })
        ]
      );

      const reversalEntry = reversalEntryInsert.rows[0];

      if (reversalEntry === undefined) {
        throw new AppError('REVERSAL_NOT_ALLOWED', 'Failed to create the reversal journal entry.');
      }

      for (const line of linesResult.rows) {
        await client.query(
          `
            insert into public.journal_entry_lines (
              journal_entry_id,
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
              $7::jsonb,
              $8::jsonb
            )
          `,
          [
            reversalEntry.journal_entry_id,
            line.line_number,
            line.account_id,
            line.description ?? `Reversal of line ${line.line_number}`,
            Number(line.credit),
            Number(line.debit),
            JSON.stringify(line.dimensions ?? {}),
            JSON.stringify({
              ...(line.metadata ?? {}),
              reversed_from_journal_entry_line_id: line.id
            })
          ]
        );
      }

      const reversalRecordInsert = await client.query<JournalEntryReversalRow>(
        `
          insert into public.journal_entry_reversals (
            firm_id,
            organization_id,
            original_journal_entry_id,
            reversal_journal_entry_id,
            reversal_date,
            reason,
            created_by_actor_type,
            created_by_actor_id,
            created_by_user_id,
            approval_request_id,
            metadata
          )
          values (
            $1::uuid,
            $2::uuid,
            $3::uuid,
            $4::uuid,
            $5::date,
            $6,
            $7,
            $8,
            $9::uuid,
            null,
            $10::jsonb
          )
          returning id::text as journal_entry_reversal_id
        `,
        [
          actorContext.firmId,
          input.organization_id,
          originalEntry.journal_entry_id,
          reversalEntry.journal_entry_id,
          input.reversal_date,
          input.reason,
          actorType,
          actorId,
          actorContext.appUserId,
          JSON.stringify({
            source_request_id: context.requestId,
            correlation_id: context.correlationId,
            idempotency_key: context.idempotencyKey
          })
        ]
      );

      const reversalRecord = reversalRecordInsert.rows[0];

      if (reversalRecord === undefined) {
        throw new AppError('REVERSAL_NOT_ALLOWED', 'Failed to create the journal reversal link.');
      }

      const response = {
        organization_id: input.organization_id,
        original_journal_entry_id: originalEntry.journal_entry_id,
        original_entry_number: originalEntry.entry_number,
        reversal_journal_entry_id: reversalEntry.journal_entry_id,
        reversal_entry_number: reversalEntry.entry_number,
        journal_entry_reversal_id: reversalRecord.journal_entry_reversal_id,
        actor_context: actorContext,
        status: 'reversed',
        reversal_status: 'posted',
        reversal_date: input.reversal_date,
        reason: input.reason,
        line_count: linesResult.rows.length,
        posted_at: reversalEntry.posted_at
      };

      await client.query(
        `
          update public.idempotency_keys
          set
            status = 'succeeded',
            resource_type = 'journal_entry_reversal',
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
          reversalRecord.journal_entry_reversal_id,
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

  async listJournalEntries(input: ListJournalEntriesInputDto, actor: AuthenticatedActor) {
    const actorContext = await this.tenantAccessService.assertOrganizationAccess(actor, input.organization_id);
    const limit = input.limit ?? 20;

    const result = await this.databaseService.query<JournalEntryListRow>(
      `
        select
          je.id::text as journal_entry_id,
          je.entry_number,
          je.entry_date::text,
          je.memo,
          je.source_type,
          je.source_id,
          case
            when jer_original.id is not null then 'reversed'
            else je.status
          end as status,
          je.posted_at::text,
          je.draft_id::text as draft_id,
          d.draft_number,
          ap.id::text as proposal_id,
          ap.status as proposal_status,
          je.reversal_of_journal_entry_id::text,
          jer_original.reversal_journal_entry_id::text,
          count(jel.id)::text as line_count
        from public.journal_entries je
        left join public.journal_entry_lines jel
          on jel.journal_entry_id = je.id
        left join public.journal_entry_reversals jer_original
          on jer_original.original_journal_entry_id = je.id
        left join public.journal_entry_drafts d
          on d.id = je.draft_id
        left join public.agent_proposals ap
          on ap.posted_entity_type = 'journal_entry'
         and ap.posted_entity_id = je.id
        where je.organization_id = $1::uuid
          and ($2::text is null or (case when jer_original.id is not null then 'reversed' else je.status end) = $2::text)
          and ($3::date is null or je.entry_date >= $3::date)
          and ($4::date is null or je.entry_date <= $4::date)
        group by
          je.id,
          d.draft_number,
          ap.id,
          ap.status,
          jer_original.id,
          jer_original.reversal_journal_entry_id
        order by je.entry_date desc, je.posted_at desc
        limit $5
      `,
      [input.organization_id, input.status ?? null, input.from_date ?? null, input.to_date ?? null, limit]
    );

    return {
      organization_id: input.organization_id,
      actor_context: actorContext,
      filters: {
        status: input.status ?? null,
        from_date: input.from_date ?? null,
        to_date: input.to_date ?? null,
        limit
      },
      items: result.rows.map((row) => ({
        journal_entry_id: row.journal_entry_id,
        entry_number: row.entry_number,
        entry_date: row.entry_date,
        memo: row.memo,
        source_type: row.source_type,
        source_id: row.source_id,
        status: row.status,
        posted_at: row.posted_at,
        draft_id: row.draft_id,
        draft_number: row.draft_number,
        proposal_id: row.proposal_id,
        proposal_status: row.proposal_status,
        reversal_of_journal_entry_id: row.reversal_of_journal_entry_id,
        reversal_journal_entry_id: row.reversal_journal_entry_id,
        line_count: Number(row.line_count)
      }))
    };
  }

  async getJournalEntry(input: GetJournalEntryInputDto, actor: AuthenticatedActor) {
    const actorContext = await this.tenantAccessService.assertOrganizationAccess(actor, input.organization_id);

    const result = await this.databaseService.query<JournalEntryDetailRow>(
      `
        select
          je.id::text as journal_entry_id,
          je.entry_number,
          je.entry_date::text,
          je.memo,
          je.source_type,
          je.source_id,
          case
            when jer_original.id is not null then 'reversed'
            else je.status
          end as status,
          je.posted_at::text,
          je.accounting_period_id::text,
          je.posted_by_actor_type,
          je.posted_by_actor_id,
          je.posted_by_user_id::text,
          je.metadata,
          je.draft_id::text as draft_id,
          d.draft_number,
          d.status as draft_status,
          ap.id::text as proposal_id,
          ap.status as proposal_status,
          ap.title as proposal_title,
          ap.posted_entity_type,
          ap.posted_entity_id::text,
          je.reversal_of_journal_entry_id::text,
          coalesce(jer_original.id::text, jer_reversal.id::text) as journal_entry_reversal_id,
          jer_original.reversal_journal_entry_id::text as reversed_by_journal_entry_id,
          coalesce(jer_original.reversal_date::text, jer_reversal.reversal_date::text) as reversal_date,
          coalesce(jer_original.reason, jer_reversal.reason) as reversal_reason
        from public.journal_entries je
        left join public.journal_entry_drafts d
          on d.id = je.draft_id
        left join public.agent_proposals ap
          on ap.posted_entity_type = 'journal_entry'
         and ap.posted_entity_id = je.id
        left join public.journal_entry_reversals jer_original
          on jer_original.original_journal_entry_id = je.id
        left join public.journal_entry_reversals jer_reversal
          on jer_reversal.reversal_journal_entry_id = je.id
        where je.id = $1::uuid
          and je.organization_id = $2::uuid
        order by ap.created_at desc nulls last
        limit 1
      `,
      [input.journal_entry_id, input.organization_id]
    );

    const entry = result.rows[0];

    if (entry === undefined) {
      throw new AppError(
        'JOURNAL_ENTRY_NOT_FOUND',
        `Journal entry ${input.journal_entry_id} was not found for organization ${input.organization_id}.`
      );
    }

    const linesResult = await this.databaseService.query<JournalEntryLineDetailRow>(
      `
        select
          jel.id::text,
          jel.line_number,
          jel.account_id::text,
          a.code as account_code,
          a.name as account_name,
          jel.description,
          jel.debit::text,
          jel.credit::text,
          jel.dimensions,
          jel.metadata
        from public.journal_entry_lines jel
        join public.accounts a
          on a.id = jel.account_id
        where jel.journal_entry_id = $1::uuid
        order by jel.line_number asc
      `,
      [input.journal_entry_id]
    );

    return {
      organization_id: input.organization_id,
      journal_entry_id: entry.journal_entry_id,
      entry_number: entry.entry_number,
      entry_date: entry.entry_date,
      memo: entry.memo,
      source_type: entry.source_type,
      source_id: entry.source_id,
      status: entry.status,
      posted_at: entry.posted_at,
      accounting_period_id: entry.accounting_period_id,
      actor_context: actorContext,
      posted_by: {
        actor_type: entry.posted_by_actor_type,
        actor_id: entry.posted_by_actor_id,
        user_id: entry.posted_by_user_id
      },
      draft:
        entry.draft_id === null
          ? null
          : {
              draft_id: entry.draft_id,
              draft_number: entry.draft_number,
              status: entry.draft_status
            },
      proposal:
        entry.proposal_id === null
          ? null
          : {
              proposal_id: entry.proposal_id,
              status: entry.proposal_status,
              title: entry.proposal_title,
              posted_entity_type: entry.posted_entity_type,
              posted_entity_id: entry.posted_entity_id
            },
      reversal_linkage: {
        journal_entry_reversal_id: entry.journal_entry_reversal_id,
        reversal_of_journal_entry_id: entry.reversal_of_journal_entry_id,
        reversed_by_journal_entry_id: entry.reversed_by_journal_entry_id,
        reversal_date: entry.reversal_date,
        reversal_reason: entry.reversal_reason
      },
      metadata: entry.metadata ?? {},
      lines: linesResult.rows.map((line) => ({
        id: line.id,
        line_number: line.line_number,
        account_id: line.account_id,
        account_code: line.account_code ?? null,
        account_name: line.account_name ?? null,
        description: line.description,
        debit: Number(line.debit),
        credit: Number(line.credit),
        dimensions: line.dimensions ?? {},
        metadata: line.metadata ?? {}
      }))
    };
  }

  async getJournalEntryReversalChain(input: GetJournalEntryReversalChainInputDto, actor: AuthenticatedActor) {
    const actorContext = await this.tenantAccessService.assertOrganizationAccess(actor, input.organization_id);

    const requestedEntryResult = await this.databaseService.query<OriginalJournalEntryRow>(
      `
        select
          je.id::text as journal_entry_id,
          je.entry_number,
          je.entry_date::text,
          je.memo,
          je.source_type,
          je.source_id,
          je.status,
          je.accounting_period_id::text,
          je.reversal_of_journal_entry_id::text,
          jer.id::text as reversal_record_id,
          jer.reversal_journal_entry_id::text
        from public.journal_entries je
        left join public.journal_entry_reversals jer
          on jer.original_journal_entry_id = je.id
        where je.id = $1::uuid
          and je.organization_id = $2::uuid
        limit 1
      `,
      [input.journal_entry_id, input.organization_id]
    );

    const requestedEntry = requestedEntryResult.rows[0];

    if (requestedEntry === undefined) {
      throw new AppError(
        'JOURNAL_ENTRY_NOT_FOUND',
        `Journal entry ${input.journal_entry_id} was not found for organization ${input.organization_id}.`
      );
    }

    const originalJournalEntryId =
      requestedEntry.reversal_of_journal_entry_id ?? requestedEntry.journal_entry_id;

    const chainResult = await this.databaseService.query<JournalEntryDetailRow>(
      `
        select
          je.id::text as journal_entry_id,
          je.entry_number,
          je.entry_date::text,
          je.memo,
          je.source_type,
          je.source_id,
          case
            when jer_original.id is not null then 'reversed'
            else je.status
          end as status,
          je.posted_at::text,
          je.accounting_period_id::text,
          je.posted_by_actor_type,
          je.posted_by_actor_id,
          je.posted_by_user_id::text,
          je.metadata,
          je.draft_id::text as draft_id,
          d.draft_number,
          d.status as draft_status,
          ap.id::text as proposal_id,
          ap.status as proposal_status,
          ap.title as proposal_title,
          ap.posted_entity_type,
          ap.posted_entity_id::text,
          je.reversal_of_journal_entry_id::text,
          coalesce(jer_original.id::text, jer_reversal.id::text) as journal_entry_reversal_id,
          jer_original.reversal_journal_entry_id::text as reversed_by_journal_entry_id,
          coalesce(jer_original.reversal_date::text, jer_reversal.reversal_date::text) as reversal_date,
          coalesce(jer_original.reason, jer_reversal.reason) as reversal_reason
        from public.journal_entries je
        left join public.journal_entry_drafts d
          on d.id = je.draft_id
        left join public.agent_proposals ap
          on ap.posted_entity_type = 'journal_entry'
         and ap.posted_entity_id = je.id
        left join public.journal_entry_reversals jer_original
          on jer_original.original_journal_entry_id = je.id
        left join public.journal_entry_reversals jer_reversal
          on jer_reversal.reversal_journal_entry_id = je.id
        where je.organization_id = $1::uuid
          and (je.id = $2::uuid or je.id = $3::uuid)
        order by je.posted_at asc
      `,
      [
        input.organization_id,
        originalJournalEntryId,
        requestedEntry.reversal_journal_entry_id ?? requestedEntry.journal_entry_id
      ]
    );

    const originalEntry = chainResult.rows.find((row) => row.journal_entry_id === originalJournalEntryId);

    if (originalEntry === undefined) {
      throw new AppError(
        'JOURNAL_ENTRY_NOT_FOUND',
        `Original journal entry ${originalJournalEntryId} was not found for organization ${input.organization_id}.`
      );
    }

    const reversalEntry = chainResult.rows.find((row) => row.reversal_of_journal_entry_id === originalJournalEntryId);

    return {
      organization_id: input.organization_id,
      requested_journal_entry_id: input.journal_entry_id,
      actor_context: actorContext,
      original_entry: {
        journal_entry_id: originalEntry.journal_entry_id,
        entry_number: originalEntry.entry_number,
        entry_date: originalEntry.entry_date,
        memo: originalEntry.memo,
        source_type: originalEntry.source_type,
        source_id: originalEntry.source_id,
        status: originalEntry.status,
        posted_at: originalEntry.posted_at
      },
      reversal:
        reversalEntry === undefined
          ? null
          : {
              journal_entry_reversal_id: reversalEntry.journal_entry_reversal_id,
              reversal_date: reversalEntry.reversal_date,
              reason: reversalEntry.reversal_reason,
              journal_entry: {
                journal_entry_id: reversalEntry.journal_entry_id,
                entry_number: reversalEntry.entry_number,
                entry_date: reversalEntry.entry_date,
                memo: reversalEntry.memo,
                source_type: reversalEntry.source_type,
                source_id: reversalEntry.source_id,
                status: reversalEntry.status,
                posted_at: reversalEntry.posted_at
              }
            }
    };
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
