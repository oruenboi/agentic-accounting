import { ForbiddenException, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';
import { randomUUID } from 'node:crypto';
import type { AuthenticatedActor } from '../auth/authenticated-request.interface';
import { HealthService } from '../health/health.service';
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
  input_dto?: new () => TInput;
  input_schema: ToolSchemaDescription;
  output_schema: ToolSchemaDescription;
  execute: (input: TInput, actor: AuthenticatedActor) => Promise<TResult>;
  summarize: (result: TResult) => string;
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
    private readonly reportsService: ReportsService
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

    try {
      const result = await tool.execute(validatedInput.value, actor);
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
          requires_tenant: tool.requires_tenant
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
        name: 'get_general_ledger',
        description: 'Returns general ledger lines for an organization over a date range.',
        category: 'read',
        mutability: 'read',
        requires_approval: false,
        requires_tenant: true,
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
