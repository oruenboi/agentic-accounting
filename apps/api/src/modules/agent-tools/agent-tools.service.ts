import { ForbiddenException, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';
import { randomUUID } from 'node:crypto';
import type { AuthenticatedActor } from '../auth/authenticated-request.interface';
import { HealthService } from '../health/health.service';
import { AppError } from '../shared/app-error';
import { CreateJournalEntryDraftInputDto } from '../journal-tools/dto/create-journal-entry-draft.dto';
import { GetApprovalRequestInputDto } from '../journal-tools/dto/get-approval-request.dto';
import { GetAgentProposalInputDto } from '../journal-tools/dto/get-agent-proposal.dto';
import { GetEntityTimelineInputDto } from '../journal-tools/dto/get-entity-timeline.dto';
import { GetJournalEntryInputDto } from '../journal-tools/dto/get-journal-entry.dto';
import { GetJournalEntryReversalChainInputDto } from '../journal-tools/dto/get-journal-entry-reversal-chain.dto';
import { GetJournalEntryDraftInputDto } from '../journal-tools/dto/get-journal-entry-draft.dto';
import { JournalDraftService } from '../journal-tools/journal-draft.service';
import { ListAuditEventsInputDto } from '../journal-tools/dto/list-audit-events.dto';
import { ListApprovalRequestsInputDto } from '../journal-tools/dto/list-approval-requests.dto';
import { ListAgentProposalsInputDto } from '../journal-tools/dto/list-agent-proposals.dto';
import { ListJournalEntriesInputDto } from '../journal-tools/dto/list-journal-entries.dto';
import { PostApprovedJournalEntryInputDto } from '../journal-tools/dto/post-approved-journal-entry.dto';
import { ReversePostedJournalEntryInputDto } from '../journal-tools/dto/reverse-posted-journal-entry.dto';
import { ResolveApprovalRequestInputDto } from '../journal-tools/dto/resolve-approval-request.dto';
import { SubmitJournalEntryDraftForApprovalInputDto } from '../journal-tools/dto/submit-journal-entry-draft-for-approval.dto';
import { JournalValidationService } from '../journal-tools/journal-validation.service';
import { ValidateJournalEntryInputDto } from '../journal-tools/dto/validate-journal-entry.dto';
import {
  BalanceSheetQueryDto,
  GeneralLedgerQueryDto,
  ProfitAndLossQueryDto,
  TrialBalanceQueryDto
} from '../reports/dto/report-query.dto';
import { ReportsService } from '../reports/reports.service';
import { AgentToolBatchExecutionRequestDto, AgentToolExecutionRequestDto } from './dto/agent-tool-execution.dto';

type ToolCategory = 'read' | 'proposal' | 'commit' | 'explain' | 'workflow';
type ToolMutability = 'read' | 'proposal' | 'commit';

interface ToolSchemaDescription {
  type: string;
  required?: string[];
  properties?: Record<string, unknown>;
  items?: unknown;
}

interface AgentToolDefinition<TInput extends object = object, TResult = unknown> {
  name: string;
  description: string;
  category: ToolCategory;
  mutability: ToolMutability;
  requires_approval: boolean;
  requires_tenant: boolean;
  idempotent: boolean;
  delegated_user_required: boolean;
  input_dto?: new () => TInput;
  input_schema: ToolSchemaDescription;
  output_schema: ToolSchemaDescription;
  execute: (input: TInput, actor: AuthenticatedActor, context: ToolExecutionContext) => Promise<TResult>;
  summarize: (result: TResult) => string;
}

interface ToolExecutionContext {
  requestId: string;
  correlationId: string | null;
  idempotencyKey: string | null;
  toolName: string;
}

interface AgentToolError {
  code: string;
  message: string;
}

interface AgentToolExecutionEnvelope {
  ok: boolean;
  tool: string;
  request_id: string;
  correlation_id: string | null;
  result: unknown | null;
  warnings: string[];
  errors: AgentToolError[];
  requires_approval: boolean;
  human_summary: string;
  machine_summary: Record<string, unknown>;
}

@Injectable()
export class AgentToolsService {
  constructor(
    private readonly healthService: HealthService,
    private readonly reportsService: ReportsService,
    private readonly journalValidationService: JournalValidationService,
    private readonly journalDraftService: JournalDraftService
  ) {}

  getSchema() {
    return {
      version: 'v1',
      tools: this.getToolDefinitions().map((tool) => ({
        name: tool.name,
        description: tool.description,
        category: tool.category,
        mutability: tool.mutability,
        requires_approval: tool.requires_approval,
        requires_tenant: tool.requires_tenant,
        delegated_user_required: tool.delegated_user_required,
        idempotent: tool.idempotent,
        input_schema: tool.input_schema,
        output_schema: tool.output_schema
      }))
    };
  }

  getTool(toolName: string) {
    const tool = this.findTool(toolName);

    if (tool === undefined) {
      return null;
    }

    return {
      name: tool.name,
      description: tool.description,
      category: tool.category,
      mutability: tool.mutability,
      requires_approval: tool.requires_approval,
      requires_tenant: tool.requires_tenant,
      delegated_user_required: tool.delegated_user_required,
      idempotent: tool.idempotent,
      input_schema: tool.input_schema,
      output_schema: tool.output_schema
    };
  }

  async execute(
    actor: AuthenticatedActor,
    request: AgentToolExecutionRequestDto,
    fallbackRequestId?: string
  ): Promise<AgentToolExecutionEnvelope> {
    const tool = this.findTool(request.tool);
    const requestId = request.request_id ?? fallbackRequestId ?? randomUUID();

    if (tool === undefined) {
      return this.buildErrorEnvelope(request.tool, requestId, request.correlation_id, 'UNKNOWN_TOOL', 'Unknown tool name.');
    }

    const validatedInput = await this.validateToolInput(tool, request.input);

    if (!validatedInput.ok) {
      return this.buildErrorEnvelope(
        tool.name,
        requestId,
        request.correlation_id,
        'TOOL_INPUT_INVALID',
        validatedInput.message
      );
    }

    if (tool.mutability !== 'read' && request.idempotency_key === undefined) {
      return this.buildErrorEnvelope(
        tool.name,
        requestId,
        request.correlation_id,
        'IDEMPOTENCY_CONFLICT',
        'Mutating tools require an idempotency_key.'
      );
    }

    if (
      tool.delegated_user_required &&
      actor.actorType === 'agent' &&
      (actor.delegatedAuthUserId === null || actor.delegatedAuthUserId === undefined || actor.delegatedAuthUserId === '')
    ) {
      return this.buildErrorEnvelope(
        tool.name,
        requestId,
        request.correlation_id,
        'INVALID_DELEGATION',
        'Tenant-scoped agent tool execution requires x-delegated-auth-user-id.'
      );
    }

    try {
      const result = await tool.execute(validatedInput.value, actor, {
        requestId,
        correlationId: request.correlation_id ?? null,
        idempotencyKey: request.idempotency_key ?? null,
        toolName: tool.name
      });
      return {
        ok: true,
        tool: tool.name,
        request_id: requestId,
        correlation_id: request.correlation_id ?? null,
        result,
        warnings: [],
        errors: [],
        requires_approval: false,
        human_summary: tool.summarize(result),
        machine_summary: {
          category: tool.category,
          mutability: tool.mutability,
          requires_tenant: tool.requires_tenant,
          actor_type: actor.actorType,
          delegated_user_required: tool.delegated_user_required
        }
      };
    } catch (error) {
      if (error instanceof ForbiddenException) {
        return this.buildErrorEnvelope(
          tool.name,
          requestId,
          request.correlation_id,
          'TENANT_ACCESS_DENIED',
          error.message
        );
      }

      if (error instanceof AppError) {
        return this.buildErrorEnvelope(tool.name, requestId, request.correlation_id, error.code, error.message);
      }

      const message = error instanceof Error ? error.message : 'Tool execution failed.';
      return this.buildErrorEnvelope(tool.name, requestId, request.correlation_id, 'TOOL_EXECUTION_FAILED', message);
    }
  }

  async executeBatch(
    actor: AuthenticatedActor,
    request: AgentToolBatchExecutionRequestDto,
    fallbackRequestId?: string
  ) {
    const items = await Promise.all(
      request.items.map((item) => this.execute(actor, item, fallbackRequestId ?? randomUUID()))
    );

    return {
      ok: items.every((item) => item.ok),
      request_id: fallbackRequestId ?? randomUUID(),
      timestamp: new Date().toISOString(),
      items
    };
  }

  private getToolDefinitions(): AgentToolDefinition[] {
    return [
      {
        name: 'get_health_status',
        description: 'Returns API and database health for the current runtime.',
        category: 'read',
        mutability: 'read',
        requires_approval: false,
        requires_tenant: false,
        delegated_user_required: false,
        idempotent: true,
        input_schema: {
          type: 'object',
          required: [],
          properties: {}
        },
        output_schema: {
          type: 'object',
          required: ['status', 'database'],
          properties: {
            status: { type: 'string' },
            database: { type: 'string' }
          }
        },
        execute: async () => this.healthService.getStatus(),
        summarize: (result) =>
          `Health status is ${(result as { status: string }).status} and database is ${(result as { database: string }).database}.`
      },
      {
        name: 'get_trial_balance',
        description: 'Returns the trial balance for an organization as of a date.',
        category: 'read',
        mutability: 'read',
        requires_approval: false,
        requires_tenant: true,
        delegated_user_required: true,
        idempotent: true,
        input_dto: TrialBalanceQueryDto,
        input_schema: {
          type: 'object',
          required: ['organization_id', 'as_of_date'],
          properties: {
            organization_id: { type: 'string', format: 'uuid' },
            as_of_date: { type: 'string', format: 'date' },
            include_zero_balances: { type: 'boolean' }
          }
        },
        output_schema: {
          type: 'object',
          required: ['organization_id', 'as_of_date', 'actor_context', 'items'],
          properties: {
            organization_id: { type: 'string' },
            as_of_date: { type: 'string' },
            actor_context: { type: 'object' },
            items: { type: 'array' }
          }
        },
        execute: async (input, actor) => this.reportsService.getTrialBalance(input as TrialBalanceQueryDto, actor),
        summarize: (result) =>
          `Trial balance returned ${this.countItems(result)} rows for organization ${(result as { organization_id: string }).organization_id}.`
      },
      {
        name: 'get_balance_sheet',
        description: 'Returns the balance sheet for an organization as of a date.',
        category: 'read',
        mutability: 'read',
        requires_approval: false,
        requires_tenant: true,
        delegated_user_required: true,
        idempotent: true,
        input_dto: BalanceSheetQueryDto,
        input_schema: {
          type: 'object',
          required: ['organization_id', 'as_of_date'],
          properties: {
            organization_id: { type: 'string', format: 'uuid' },
            as_of_date: { type: 'string', format: 'date' },
            include_zero_balances: { type: 'boolean' }
          }
        },
        output_schema: {
          type: 'object',
          required: ['organization_id', 'as_of_date', 'actor_context', 'items'],
          properties: {
            organization_id: { type: 'string' },
            as_of_date: { type: 'string' },
            actor_context: { type: 'object' },
            items: { type: 'array' }
          }
        },
        execute: async (input, actor) => this.reportsService.getBalanceSheet(input as BalanceSheetQueryDto, actor),
        summarize: (result) =>
          `Balance sheet returned ${this.countItems(result)} rows for organization ${(result as { organization_id: string }).organization_id}.`
      },
      {
        name: 'get_profit_and_loss',
        description: 'Returns the profit and loss report for an organization over a date range.',
        category: 'read',
        mutability: 'read',
        requires_approval: false,
        requires_tenant: true,
        delegated_user_required: true,
        idempotent: true,
        input_dto: ProfitAndLossQueryDto,
        input_schema: {
          type: 'object',
          required: ['organization_id', 'from_date', 'to_date'],
          properties: {
            organization_id: { type: 'string', format: 'uuid' },
            from_date: { type: 'string', format: 'date' },
            to_date: { type: 'string', format: 'date' },
            include_zero_balances: { type: 'boolean' }
          }
        },
        output_schema: {
          type: 'object',
          required: ['organization_id', 'from_date', 'to_date', 'actor_context', 'items'],
          properties: {
            organization_id: { type: 'string' },
            from_date: { type: 'string' },
            to_date: { type: 'string' },
            actor_context: { type: 'object' },
            items: { type: 'array' }
          }
        },
        execute: async (input, actor) => this.reportsService.getProfitAndLoss(input as ProfitAndLossQueryDto, actor),
        summarize: (result) =>
          `Profit and loss returned ${this.countItems(result)} rows for organization ${(result as { organization_id: string }).organization_id}.`
      },
      {
        name: 'validate_journal_entry',
        description: 'Validates a candidate journal entry without creating draft or posted ledger rows.',
        category: 'proposal',
        mutability: 'proposal',
        requires_approval: false,
        requires_tenant: true,
        delegated_user_required: true,
        idempotent: true,
        input_dto: ValidateJournalEntryInputDto,
        input_schema: {
          type: 'object',
          required: ['organization_id', 'entry_date', 'source_type', 'lines'],
          properties: {
            organization_id: { type: 'string', format: 'uuid' },
            accounting_period_id: { type: 'string', format: 'uuid' },
            entry_date: { type: 'string', format: 'date' },
            source_type: { type: 'string' },
            memo: { type: 'string' },
            metadata: { type: 'object' },
            lines: {
              type: 'array',
              items: {
                type: 'object',
                required: ['account_id', 'debit', 'credit'],
                properties: {
                  account_id: { type: 'string', format: 'uuid' },
                  description: { type: 'string' },
                  debit: { type: 'number' },
                  credit: { type: 'number' }
                }
              }
            }
          }
        },
        output_schema: {
          type: 'object',
          required: [
            'organization_id',
            'entry_date',
            'actor_context',
            'valid',
            'requires_approval',
            'errors',
            'warnings',
            'impact_preview',
            'validation_result'
          ],
          properties: {
            organization_id: { type: 'string' },
            entry_date: { type: 'string' },
            actor_context: { type: 'object' },
            valid: { type: 'boolean' },
            requires_approval: { type: 'boolean' },
            errors: { type: 'array' },
            warnings: { type: 'array' },
            impact_preview: { type: 'object' },
            validation_result: { type: 'object' }
          }
        },
        execute: async (input, actor) =>
          this.journalValidationService.validateJournalEntry(input as ValidateJournalEntryInputDto, actor),
        summarize: (result) =>
          `Journal entry validation ${(result as { valid: boolean }).valid ? 'passed' : 'failed'} for organization ${(result as { organization_id: string }).organization_id}.`
      },
      {
        name: 'list_approval_requests',
        description: 'Returns approval requests for an organization, with optional status filtering.',
        category: 'read',
        mutability: 'read',
        requires_approval: false,
        requires_tenant: true,
        delegated_user_required: true,
        idempotent: true,
        input_dto: ListApprovalRequestsInputDto,
        input_schema: {
          type: 'object',
          required: ['organization_id'],
          properties: {
            organization_id: { type: 'string', format: 'uuid' },
            status: { type: 'string', enum: ['pending', 'approved', 'rejected', 'cancelled', 'expired'] },
            limit: { type: 'number' }
          }
        },
        output_schema: {
          type: 'object',
          required: ['organization_id', 'actor_context', 'filters', 'items'],
          properties: {
            organization_id: { type: 'string' },
            actor_context: { type: 'object' },
            filters: { type: 'object' },
            items: { type: 'array' }
          }
        },
        execute: async (input, actor) =>
          this.journalDraftService.listApprovalRequests(input as ListApprovalRequestsInputDto, actor),
        summarize: (result) =>
          `Approval request listing returned ${this.countItems(result)} item(s) for organization ${(result as { organization_id: string }).organization_id}.`
      },
      {
        name: 'get_approval_request',
        description: 'Returns one approval request with linked draft context and approval action history.',
        category: 'read',
        mutability: 'read',
        requires_approval: false,
        requires_tenant: true,
        delegated_user_required: true,
        idempotent: true,
        input_dto: GetApprovalRequestInputDto,
        input_schema: {
          type: 'object',
          required: ['organization_id', 'approval_request_id'],
          properties: {
            organization_id: { type: 'string', format: 'uuid' },
            approval_request_id: { type: 'string', format: 'uuid' }
          }
        },
        output_schema: {
          type: 'object',
          required: [
            'organization_id',
            'approval_request_id',
            'actor_context',
            'status',
            'priority',
            'action_type',
            'submitted_at',
            'submitted_by',
            'target',
            'metadata',
            'actions'
          ],
          properties: {
            organization_id: { type: 'string' },
            approval_request_id: { type: 'string', format: 'uuid' },
            actor_context: { type: 'object' },
            status: { type: 'string' },
            priority: { type: 'string' },
            action_type: { type: 'string' },
            submitted_at: { type: 'string' },
            submitted_by: { type: 'object' },
            target: { type: 'object' },
            metadata: { type: 'object' },
            actions: { type: 'array' }
          }
        },
        execute: async (input, actor) =>
          this.journalDraftService.getApprovalRequest(input as GetApprovalRequestInputDto, actor),
        summarize: (result) =>
          `Approval request ${(result as { approval_request_id: string }).approval_request_id} loaded successfully.`
      },
      {
        name: 'get_agent_proposal',
        description: 'Returns one persisted agent proposal with linked draft context when present.',
        category: 'read',
        mutability: 'read',
        requires_approval: false,
        requires_tenant: true,
        delegated_user_required: true,
        idempotent: true,
        input_dto: GetAgentProposalInputDto,
        input_schema: {
          type: 'object',
          required: ['organization_id', 'proposal_id'],
          properties: {
            organization_id: { type: 'string', format: 'uuid' },
            proposal_id: { type: 'string', format: 'uuid' }
          }
        },
        output_schema: {
          type: 'object',
          required: [
            'organization_id',
            'proposal_id',
            'proposal_type',
            'status',
            'title',
            'actor_context',
            'source',
            'created_by',
            'payload',
            'metadata',
            'created_at',
            'updated_at'
          ],
          properties: {
            organization_id: { type: 'string' },
            proposal_id: { type: 'string', format: 'uuid' },
            proposal_type: { type: 'string' },
            status: { type: 'string' },
            title: { type: 'string' },
            actor_context: { type: 'object' },
            source: { type: 'object' },
            created_by: { type: 'object' },
            target: { type: 'object' },
            payload: { type: 'object' },
            metadata: { type: 'object' },
            created_at: { type: 'string' },
            updated_at: { type: 'string' }
          }
        },
        execute: async (input, actor) =>
          this.journalDraftService.getAgentProposal(input as GetAgentProposalInputDto, actor),
        summarize: (result) =>
          `Agent proposal ${(result as { proposal_id: string }).proposal_id} loaded successfully.`
      },
      {
        name: 'list_audit_events',
        description: 'Returns normalized audit and approval-history events for an organization with optional filters.',
        category: 'read',
        mutability: 'read',
        requires_approval: false,
        requires_tenant: true,
        delegated_user_required: true,
        idempotent: true,
        input_dto: ListAuditEventsInputDto,
        input_schema: {
          type: 'object',
          required: ['organization_id'],
          properties: {
            organization_id: { type: 'string', format: 'uuid' },
            entity_type: { type: 'string' },
            entity_id: { type: 'string' },
            event_name: { type: 'string' },
            actor_type: { type: 'string', enum: ['user', 'agent', 'system'] },
            request_id: { type: 'string' },
            correlation_id: { type: 'string' },
            from_timestamp: { type: 'string', format: 'date-time' },
            to_timestamp: { type: 'string', format: 'date-time' },
            limit: { type: 'number' }
          }
        },
        output_schema: {
          type: 'object',
          required: ['organization_id', 'actor_context', 'filters', 'items'],
          properties: {
            organization_id: { type: 'string' },
            actor_context: { type: 'object' },
            filters: { type: 'object' },
            items: { type: 'array' }
          }
        },
        execute: async (input, actor) =>
          this.journalDraftService.listAuditEvents(input as ListAuditEventsInputDto, actor),
        summarize: (result) =>
          `Audit event listing returned ${this.countItems(result)} item(s) for organization ${(result as { organization_id: string }).organization_id}.`
      },
      {
        name: 'get_entity_timeline',
        description: 'Returns a normalized entity timeline combining audit logs and approval-history events.',
        category: 'read',
        mutability: 'read',
        requires_approval: false,
        requires_tenant: true,
        delegated_user_required: true,
        idempotent: true,
        input_dto: GetEntityTimelineInputDto,
        input_schema: {
          type: 'object',
          required: ['organization_id', 'entity_type', 'entity_id'],
          properties: {
            organization_id: { type: 'string', format: 'uuid' },
            entity_type: { type: 'string' },
            entity_id: { type: 'string' }
          }
        },
        output_schema: {
          type: 'object',
          required: ['organization_id', 'entity_type', 'entity_id', 'actor_context', 'items'],
          properties: {
            organization_id: { type: 'string' },
            entity_type: { type: 'string' },
            entity_id: { type: 'string' },
            actor_context: { type: 'object' },
            items: { type: 'array' }
          }
        },
        execute: async (input, actor) =>
          this.journalDraftService.getEntityTimeline(input as GetEntityTimelineInputDto, actor),
        summarize: (result) =>
          `Entity timeline loaded for ${(result as { entity_type: string }).entity_type} ${(result as { entity_id: string }).entity_id}.`
      },
      {
        name: 'list_journal_entries',
        description: 'Returns posted journal entries for an organization with optional status and date filters.',
        category: 'read',
        mutability: 'read',
        requires_approval: false,
        requires_tenant: true,
        delegated_user_required: true,
        idempotent: true,
        input_dto: ListJournalEntriesInputDto,
        input_schema: {
          type: 'object',
          required: ['organization_id'],
          properties: {
            organization_id: { type: 'string', format: 'uuid' },
            status: { type: 'string', enum: ['posted', 'reversed'] },
            from_date: { type: 'string', format: 'date' },
            to_date: { type: 'string', format: 'date' },
            limit: { type: 'number' }
          }
        },
        output_schema: {
          type: 'object',
          required: ['organization_id', 'actor_context', 'filters', 'items'],
          properties: {
            organization_id: { type: 'string' },
            actor_context: { type: 'object' },
            filters: { type: 'object' },
            items: { type: 'array' }
          }
        },
        execute: async (input, actor) =>
          this.journalDraftService.listJournalEntries(input as ListJournalEntriesInputDto, actor),
        summarize: (result) =>
          `Journal entry listing returned ${this.countItems(result)} item(s) for organization ${(result as { organization_id: string }).organization_id}.`
      },
      {
        name: 'get_journal_entry',
        description: 'Returns one posted journal entry with lines, source context, and reversal linkage.',
        category: 'read',
        mutability: 'read',
        requires_approval: false,
        requires_tenant: true,
        delegated_user_required: true,
        idempotent: true,
        input_dto: GetJournalEntryInputDto,
        input_schema: {
          type: 'object',
          required: ['organization_id', 'journal_entry_id'],
          properties: {
            organization_id: { type: 'string', format: 'uuid' },
            journal_entry_id: { type: 'string', format: 'uuid' }
          }
        },
        output_schema: {
          type: 'object',
          required: [
            'organization_id',
            'journal_entry_id',
            'entry_number',
            'entry_date',
            'status',
            'posted_at',
            'actor_context',
            'posted_by',
            'metadata',
            'lines'
          ],
          properties: {
            organization_id: { type: 'string' },
            journal_entry_id: { type: 'string', format: 'uuid' },
            entry_number: { type: 'string' },
            entry_date: { type: 'string' },
            status: { type: 'string' },
            posted_at: { type: 'string' },
            actor_context: { type: 'object' },
            posted_by: { type: 'object' },
            draft: { type: 'object' },
            proposal: { type: 'object' },
            reversal_linkage: { type: 'object' },
            metadata: { type: 'object' },
            lines: { type: 'array' }
          }
        },
        execute: async (input, actor) =>
          this.journalDraftService.getJournalEntry(input as GetJournalEntryInputDto, actor),
        summarize: (result) =>
          `Journal entry ${(result as { entry_number: string }).entry_number} loaded successfully.`
      },
      {
        name: 'get_journal_entry_reversal_chain',
        description: 'Returns the original and reversal journal entry lineage for one posted entry.',
        category: 'read',
        mutability: 'read',
        requires_approval: false,
        requires_tenant: true,
        delegated_user_required: true,
        idempotent: true,
        input_dto: GetJournalEntryReversalChainInputDto,
        input_schema: {
          type: 'object',
          required: ['organization_id', 'journal_entry_id'],
          properties: {
            organization_id: { type: 'string', format: 'uuid' },
            journal_entry_id: { type: 'string', format: 'uuid' }
          }
        },
        output_schema: {
          type: 'object',
          required: ['organization_id', 'requested_journal_entry_id', 'actor_context', 'original_entry'],
          properties: {
            organization_id: { type: 'string' },
            requested_journal_entry_id: { type: 'string', format: 'uuid' },
            actor_context: { type: 'object' },
            original_entry: { type: 'object' },
            reversal: { type: 'object' }
          }
        },
        execute: async (input, actor) =>
          this.journalDraftService.getJournalEntryReversalChain(input as GetJournalEntryReversalChainInputDto, actor),
        summarize: (result) =>
          `Journal entry reversal chain loaded for ${(result as { requested_journal_entry_id: string }).requested_journal_entry_id}.`
      },
      {
        name: 'list_agent_proposals',
        description: 'Returns recent agent proposals for an organization, with optional status filtering.',
        category: 'read',
        mutability: 'read',
        requires_approval: false,
        requires_tenant: true,
        delegated_user_required: true,
        idempotent: true,
        input_dto: ListAgentProposalsInputDto,
        input_schema: {
          type: 'object',
          required: ['organization_id'],
          properties: {
            organization_id: { type: 'string', format: 'uuid' },
            status: { type: 'string' },
            limit: { type: 'number' }
          }
        },
        output_schema: {
          type: 'object',
          required: ['organization_id', 'actor_context', 'filters', 'items'],
          properties: {
            organization_id: { type: 'string' },
            actor_context: { type: 'object' },
            filters: { type: 'object' },
            items: { type: 'array' }
          }
        },
        execute: async (input, actor) =>
          this.journalDraftService.listAgentProposals(input as ListAgentProposalsInputDto, actor),
        summarize: (result) =>
          `Agent proposal listing returned ${this.countItems(result)} item(s) for organization ${(result as { organization_id: string }).organization_id}.`
      },
      {
        name: 'get_journal_entry_draft',
        description: 'Returns a persisted journal draft, its lines, and linked proposal state.',
        category: 'read',
        mutability: 'read',
        requires_approval: false,
        requires_tenant: true,
        delegated_user_required: true,
        idempotent: true,
        input_dto: GetJournalEntryDraftInputDto,
        input_schema: {
          type: 'object',
          required: ['organization_id', 'draft_id'],
          properties: {
            organization_id: { type: 'string', format: 'uuid' },
            draft_id: { type: 'string', format: 'uuid' }
          }
        },
        output_schema: {
          type: 'object',
          required: [
            'organization_id',
            'draft_id',
            'draft_number',
            'status',
            'entry_date',
            'actor_context',
            'created_by',
            'validation_summary',
            'metadata',
            'lines'
          ],
          properties: {
            organization_id: { type: 'string' },
            draft_id: { type: 'string', format: 'uuid' },
            draft_number: { type: 'string' },
            status: { type: 'string' },
            entry_date: { type: 'string' },
            actor_context: { type: 'object' },
            created_by: { type: 'object' },
            proposal: { type: 'object' },
            validation_summary: { type: 'object' },
            metadata: { type: 'object' },
            lines: { type: 'array' }
          }
        },
        execute: async (input, actor) =>
          this.journalDraftService.getJournalEntryDraft(input as GetJournalEntryDraftInputDto, actor),
        summarize: (result) =>
          `Journal draft ${(result as { draft_number: string | null }).draft_number ?? (result as { draft_id: string }).draft_id} loaded successfully.`
      },
      {
        name: 'create_journal_entry_draft',
        description: 'Creates a validated journal draft and linked agent proposal for later review.',
        category: 'proposal',
        mutability: 'proposal',
        requires_approval: false,
        requires_tenant: true,
        delegated_user_required: true,
        idempotent: true,
        input_dto: CreateJournalEntryDraftInputDto,
        input_schema: {
          type: 'object',
          required: ['organization_id', 'entry_date', 'source_type', 'lines'],
          properties: {
            organization_id: { type: 'string', format: 'uuid' },
            accounting_period_id: { type: 'string', format: 'uuid' },
            entry_date: { type: 'string', format: 'date' },
            source_type: { type: 'string' },
            memo: { type: 'string' },
            metadata: { type: 'object' },
            lines: {
              type: 'array',
              items: {
                type: 'object',
                required: ['account_id', 'debit', 'credit'],
                properties: {
                  account_id: { type: 'string', format: 'uuid' },
                  description: { type: 'string' },
                  debit: { type: 'number' },
                  credit: { type: 'number' }
                }
              }
            }
          }
        },
        output_schema: {
          type: 'object',
          required: [
            'organization_id',
            'draft_id',
            'draft_number',
            'proposal_id',
            'actor_context',
            'status',
            'requires_approval',
            'entry_date',
            'line_count',
            'validation_result',
            'impact_preview'
          ],
          properties: {
            organization_id: { type: 'string' },
            draft_id: { type: 'string', format: 'uuid' },
            draft_number: { type: 'string' },
            proposal_id: { type: 'string', format: 'uuid' },
            actor_context: { type: 'object' },
            status: { type: 'string' },
            requires_approval: { type: 'boolean' },
            entry_date: { type: 'string' },
            line_count: { type: 'number' },
            validation_result: { type: 'object' },
            impact_preview: { type: 'object' }
          }
        },
        execute: async (input, actor, context) => {
          if (context.idempotencyKey === null) {
            throw new AppError('IDEMPOTENCY_CONFLICT', 'Mutating tools require an idempotency_key.');
          }

          return this.journalDraftService.createJournalEntryDraft(
            input as CreateJournalEntryDraftInputDto,
            actor,
            {
              requestId: context.requestId,
              correlationId: context.correlationId,
              idempotencyKey: context.idempotencyKey,
              toolName: context.toolName
            }
          );
        },
        summarize: (result) =>
          `Created journal draft ${(result as { draft_number: string }).draft_number} for organization ${(result as { organization_id: string }).organization_id}.`
      },
      {
        name: 'post_approved_journal_entry',
        description: 'Posts an approved journal draft into immutable journal entry records.',
        category: 'commit',
        mutability: 'commit',
        requires_approval: false,
        requires_tenant: true,
        delegated_user_required: true,
        idempotent: true,
        input_dto: PostApprovedJournalEntryInputDto,
        input_schema: {
          type: 'object',
          required: ['organization_id', 'draft_id'],
          properties: {
            organization_id: { type: 'string', format: 'uuid' },
            draft_id: { type: 'string', format: 'uuid' }
          }
        },
        output_schema: {
          type: 'object',
          required: [
            'organization_id',
            'draft_id',
            'journal_entry_id',
            'entry_number',
            'actor_context',
            'status',
            'draft_status',
            'proposal_status',
            'posted_at',
            'line_count'
          ],
          properties: {
            organization_id: { type: 'string' },
            draft_id: { type: 'string', format: 'uuid' },
            draft_number: { type: 'string' },
            proposal_id: { type: 'string', format: 'uuid' },
            journal_entry_id: { type: 'string', format: 'uuid' },
            entry_number: { type: 'string' },
            actor_context: { type: 'object' },
            status: { type: 'string' },
            draft_status: { type: 'string' },
            proposal_status: { type: 'string' },
            posted_at: { type: 'string' },
            line_count: { type: 'number' }
          }
        },
        execute: async (input, actor, context) => {
          if (context.idempotencyKey === null) {
            throw new AppError('IDEMPOTENCY_CONFLICT', 'Mutating tools require an idempotency_key.');
          }

          return this.journalDraftService.postApprovedJournalEntry(
            input as PostApprovedJournalEntryInputDto,
            actor,
            {
              requestId: context.requestId,
              correlationId: context.correlationId,
              idempotencyKey: context.idempotencyKey,
              toolName: context.toolName
            }
          );
        },
        summarize: (result) =>
          `Posted journal entry ${(result as { entry_number: string }).entry_number} from draft ${(result as { draft_number: string | null }).draft_number ?? (result as { draft_id: string }).draft_id}.`
      },
      {
        name: 'reverse_posted_journal_entry',
        description: 'Creates an immutable reversal journal entry linked to an existing posted journal entry.',
        category: 'commit',
        mutability: 'commit',
        requires_approval: false,
        requires_tenant: true,
        delegated_user_required: true,
        idempotent: true,
        input_dto: ReversePostedJournalEntryInputDto,
        input_schema: {
          type: 'object',
          required: ['organization_id', 'journal_entry_id', 'reversal_date', 'reason'],
          properties: {
            organization_id: { type: 'string', format: 'uuid' },
            journal_entry_id: { type: 'string', format: 'uuid' },
            reversal_date: { type: 'string', format: 'date' },
            reason: { type: 'string' }
          }
        },
        output_schema: {
          type: 'object',
          required: [
            'organization_id',
            'original_journal_entry_id',
            'original_entry_number',
            'reversal_journal_entry_id',
            'reversal_entry_number',
            'journal_entry_reversal_id',
            'actor_context',
            'status',
            'reversal_status',
            'reversal_date',
            'reason',
            'line_count',
            'posted_at'
          ],
          properties: {
            organization_id: { type: 'string' },
            original_journal_entry_id: { type: 'string', format: 'uuid' },
            original_entry_number: { type: 'string' },
            reversal_journal_entry_id: { type: 'string', format: 'uuid' },
            reversal_entry_number: { type: 'string' },
            journal_entry_reversal_id: { type: 'string', format: 'uuid' },
            actor_context: { type: 'object' },
            status: { type: 'string' },
            reversal_status: { type: 'string' },
            reversal_date: { type: 'string' },
            reason: { type: 'string' },
            line_count: { type: 'number' },
            posted_at: { type: 'string' }
          }
        },
        execute: async (input, actor, context) => {
          if (context.idempotencyKey === null) {
            throw new AppError('IDEMPOTENCY_CONFLICT', 'Mutating tools require an idempotency_key.');
          }

          return this.journalDraftService.reversePostedJournalEntry(
            input as ReversePostedJournalEntryInputDto,
            actor,
            {
              requestId: context.requestId,
              correlationId: context.correlationId,
              idempotencyKey: context.idempotencyKey,
              toolName: context.toolName
            }
          );
        },
        summarize: (result) =>
          `Created reversal ${(result as { reversal_entry_number: string }).reversal_entry_number} for journal entry ${(result as { original_entry_number: string }).original_entry_number}.`
      },
      {
        name: 'resolve_approval_request',
        description: 'Resolves a pending approval request as approved or rejected and transitions linked draft/proposal state.',
        category: 'workflow',
        mutability: 'proposal',
        requires_approval: false,
        requires_tenant: true,
        delegated_user_required: true,
        idempotent: true,
        input_dto: ResolveApprovalRequestInputDto,
        input_schema: {
          type: 'object',
          required: ['organization_id', 'approval_request_id', 'resolution'],
          properties: {
            organization_id: { type: 'string', format: 'uuid' },
            approval_request_id: { type: 'string', format: 'uuid' },
            resolution: { type: 'string', enum: ['approved', 'rejected'] },
            reason: { type: 'string' },
            comments: { type: 'string' }
          }
        },
        output_schema: {
          type: 'object',
          required: [
            'organization_id',
            'approval_request_id',
            'actor_context',
            'status',
            'draft_status',
            'proposal_status',
            'resolved_at'
          ],
          properties: {
            organization_id: { type: 'string' },
            approval_request_id: { type: 'string', format: 'uuid' },
            draft_id: { type: 'string', format: 'uuid' },
            draft_number: { type: 'string' },
            proposal_id: { type: 'string', format: 'uuid' },
            actor_context: { type: 'object' },
            status: { type: 'string' },
            draft_status: { type: 'string' },
            proposal_status: { type: 'string' },
            resolved_at: { type: 'string' },
            resolution_reason: { type: 'string' }
          }
        },
        execute: async (input, actor, context) => {
          if (context.idempotencyKey === null) {
            throw new AppError('IDEMPOTENCY_CONFLICT', 'Mutating tools require an idempotency_key.');
          }

          return this.journalDraftService.resolveApprovalRequest(
            input as ResolveApprovalRequestInputDto,
            actor,
            {
              requestId: context.requestId,
              correlationId: context.correlationId,
              idempotencyKey: context.idempotencyKey,
              toolName: context.toolName
            }
          );
        },
        summarize: (result) =>
          `Approval request ${(result as { approval_request_id: string }).approval_request_id} resolved as ${(result as { status: string }).status}.`
      },
      {
        name: 'submit_journal_entry_draft_for_approval',
        description: 'Submits a validated journal draft into approval workflow and links its approval request.',
        category: 'workflow',
        mutability: 'proposal',
        requires_approval: true,
        requires_tenant: true,
        delegated_user_required: true,
        idempotent: true,
        input_dto: SubmitJournalEntryDraftForApprovalInputDto,
        input_schema: {
          type: 'object',
          required: ['organization_id', 'draft_id'],
          properties: {
            organization_id: { type: 'string', format: 'uuid' },
            draft_id: { type: 'string', format: 'uuid' },
            priority: { type: 'string', enum: ['low', 'normal', 'high', 'critical'] },
            expires_at: { type: 'string', format: 'date-time' }
          }
        },
        output_schema: {
          type: 'object',
          required: [
            'organization_id',
            'draft_id',
            'approval_request_id',
            'actor_context',
            'status',
            'approval_status',
            'requires_approval',
            'priority',
            'submitted_at'
          ],
          properties: {
            organization_id: { type: 'string' },
            draft_id: { type: 'string', format: 'uuid' },
            draft_number: { type: 'string' },
            proposal_id: { type: 'string', format: 'uuid' },
            approval_request_id: { type: 'string', format: 'uuid' },
            actor_context: { type: 'object' },
            status: { type: 'string' },
            approval_status: { type: 'string' },
            requires_approval: { type: 'boolean' },
            priority: { type: 'string' },
            submitted_at: { type: 'string' }
          }
        },
        execute: async (input, actor, context) => {
          if (context.idempotencyKey === null) {
            throw new AppError('IDEMPOTENCY_CONFLICT', 'Mutating tools require an idempotency_key.');
          }

          return this.journalDraftService.submitJournalEntryDraftForApproval(
            input as SubmitJournalEntryDraftForApprovalInputDto,
            actor,
            {
              requestId: context.requestId,
              correlationId: context.correlationId,
              idempotencyKey: context.idempotencyKey,
              toolName: context.toolName
            }
          );
        },
        summarize: (result) =>
          `Submitted journal draft ${(result as { draft_number: string | null }).draft_number ?? (result as { draft_id: string }).draft_id} for approval.`
      },
      {
        name: 'get_general_ledger',
        description: 'Returns general ledger lines for an organization over a date range.',
        category: 'read',
        mutability: 'read',
        requires_approval: false,
        requires_tenant: true,
        delegated_user_required: true,
        idempotent: true,
        input_dto: GeneralLedgerQueryDto,
        input_schema: {
          type: 'object',
          required: ['organization_id', 'from_date', 'to_date'],
          properties: {
            organization_id: { type: 'string', format: 'uuid' },
            from_date: { type: 'string', format: 'date' },
            to_date: { type: 'string', format: 'date' },
            account_ids: {
              type: 'array',
              items: { type: 'string', format: 'uuid' }
            }
          }
        },
        output_schema: {
          type: 'object',
          required: ['organization_id', 'from_date', 'to_date', 'actor_context', 'items'],
          properties: {
            organization_id: { type: 'string' },
            from_date: { type: 'string' },
            to_date: { type: 'string' },
            actor_context: { type: 'object' },
            items: { type: 'array' }
          }
        },
        execute: async (input, actor) => this.reportsService.getGeneralLedger(input as GeneralLedgerQueryDto, actor),
        summarize: (result) =>
          `General ledger returned ${this.countItems(result)} rows for organization ${(result as { organization_id: string }).organization_id}.`
      }
    ];
  }

  private findTool(toolName: string): AgentToolDefinition | undefined {
    return this.getToolDefinitions().find((tool) => tool.name === toolName);
  }

  private async validateToolInput<T extends object>(
    tool: AgentToolDefinition<T>,
    input: Record<string, unknown>
  ): Promise<{ ok: true; value: T } | { ok: false; message: string }> {
    if (tool.input_dto === undefined) {
      return { ok: true, value: {} as T };
    }

    const dto = plainToInstance(tool.input_dto, input);
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true
    });

    if (errors.length > 0) {
      return {
        ok: false,
        message: this.flattenValidationErrors(errors).join('; ')
      };
    }

    return { ok: true, value: dto };
  }

  private flattenValidationErrors(errors: ValidationError[], parent = ''): string[] {
    return errors.flatMap((error) => {
      const propertyPath = parent === '' ? error.property : `${parent}.${error.property}`;
      const ownMessages = Object.values(error.constraints ?? {}).map((message) => `${propertyPath}: ${message}`);
      const childMessages = this.flattenValidationErrors(error.children ?? [], propertyPath);
      return [...ownMessages, ...childMessages];
    });
  }

  private buildErrorEnvelope(
    toolName: string,
    requestId: string,
    correlationId: string | undefined,
    code: string,
    message: string
  ): AgentToolExecutionEnvelope {
    return {
      ok: false,
      tool: toolName,
      request_id: requestId,
      correlation_id: correlationId ?? null,
      result: null,
      warnings: [],
      errors: [{ code, message }],
      requires_approval: false,
      human_summary: message,
      machine_summary: {
        error_code: code
      }
    };
  }

  private countItems(result: unknown): number {
    if (typeof result !== 'object' || result === null || !('items' in result)) {
      return 0;
    }

    const { items } = result as { items?: unknown };
    return Array.isArray(items) ? items.length : 0;
  }
}
