import type {
  ApprovalRequestDetail,
  ApprovalRequestSummary,
  AuditEvent,
  DashboardSnapshot,
  JournalDraftDetail,
  JournalEntryDetail,
  JournalEntrySummary,
  GeneralLedgerRow,
  ProposalDetail,
  ProposalSummary,
  ReportEnvelope,
  ScheduleDefinitionSummary,
  ScheduleRunDetail,
  ScheduleRunSummary,
  StatementRow,
  TrialBalanceRow
} from './types';
import type { ActorContext } from './types';
import type { OperatorSession as Session } from './session';

interface ToolEnvelope<TResult> {
  ok: boolean;
  tool: string;
  request_id: string;
  result: TResult | null;
  errors: Array<{ code: string; message: string }>;
  human_summary?: string;
}

interface ApiEnvelope<TResult> {
  ok: boolean;
  request_id: string | null;
  timestamp: string;
  result: TResult;
}

export class OperatorApiError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

function path(baseUrl: string, value: string) {
  return `${baseUrl.replace(/\/$/, '')}${value}`;
}

async function parseResponse<TResult>(response: Response): Promise<TResult> {
  const body = (await response.json()) as ToolEnvelope<TResult> | TResult;

  if ('ok' in (body as Record<string, unknown>) && 'tool' in (body as Record<string, unknown>)) {
    const envelope = body as ToolEnvelope<TResult>;

    if (!envelope.ok || envelope.result === null) {
      const firstError = envelope.errors[0];
      throw new OperatorApiError(firstError?.code ?? 'TOOL_EXECUTION_FAILED', firstError?.message ?? 'Tool execution failed.');
    }

    return envelope.result;
  }

  return body as TResult;
}

async function parseApiResponse<TResult>(response: Response): Promise<TResult> {
  const body = (await response.json()) as ApiEnvelope<TResult> | TResult;

  if ('ok' in (body as Record<string, unknown>) && 'result' in (body as Record<string, unknown>)) {
    const envelope = body as ApiEnvelope<TResult>;

    if (!envelope.ok) {
      throw new OperatorApiError('API_REQUEST_FAILED', 'API request failed.');
    }

    return envelope.result;
  }

  return body as TResult;
}

async function fetchReport<TResult>(session: Session, reportPath: string, params: Record<string, string | boolean | undefined>) {
  const query = new URLSearchParams();
  query.set('organization_id', session.organizationId);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      query.set(key, String(value));
    }
  });

  const response = await fetch(path(session.apiBaseUrl, `/api/v1/reports/${reportPath}?${query.toString()}`), {
    headers: {
      Authorization: `Bearer ${session.bearerToken}`
    }
  });

  if (!response.ok) {
    throw new OperatorApiError('HTTP_ERROR', `Report request failed with status ${response.status}.`);
  }

  return parseApiResponse<TResult>(response);
}

async function fetchApi<TResult>(session: Session, apiPath: string, params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  query.set('organization_id', session.organizationId);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      query.set(key, String(value));
    }
  });

  const response = await fetch(path(session.apiBaseUrl, `${apiPath}?${query.toString()}`), {
    headers: {
      Authorization: `Bearer ${session.bearerToken}`
    }
  });

  if (!response.ok) {
    throw new OperatorApiError('HTTP_ERROR', `API request failed with status ${response.status}.`);
  }

  return parseApiResponse<TResult>(response);
}

async function postApi<TInput extends object, TResult>(session: Session, apiPath: string, input: TInput) {
  const response = await fetch(path(session.apiBaseUrl, apiPath), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.bearerToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw new OperatorApiError('HTTP_ERROR', `API request failed with status ${response.status}.`);
  }

  return parseApiResponse<TResult>(response);
}

export async function fetchToolSchema(session: Session) {
  const response = await fetch(path(session.apiBaseUrl, '/api/v1/agent-tools/schema'), {
    headers: {
      Authorization: `Bearer ${session.bearerToken}`
    }
  });

  if (!response.ok) {
    throw new OperatorApiError('HTTP_ERROR', `Schema request failed with status ${response.status}.`);
  }

  return response.json() as Promise<{ version: string; tools: Array<{ name: string }> }>;
}

export async function executeTool<TInput extends object, TResult>(
  session: Session,
  tool: string,
  input: TInput,
  options?: { idempotencyKey?: string }
) {
  const response = await fetch(path(session.apiBaseUrl, '/api/v1/agent-tools/execute'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.bearerToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      tool,
      idempotency_key: options?.idempotencyKey,
      input
    })
  });

  if (!response.ok) {
    throw new OperatorApiError('HTTP_ERROR', `Tool request failed with status ${response.status}.`);
  }

  return parseResponse<TResult>(response);
}

function actorContext(value: Record<string, unknown> | null | undefined): ActorContext | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  return {
    appUserId: (value.appUserId ?? value.app_user_id) as string | null | undefined,
    authUserId: (value.authUserId ?? value.auth_user_id) as string | null | undefined,
    organizationRole: (value.organizationRole ?? value.organization_role) as string | null | undefined,
    firmRole: (value.firmRole ?? value.firm_role) as string | null | undefined,
    firmId: (value.firmId ?? value.firm_id) as string | null | undefined
  };
}

export async function listAgentProposals(
  session: Session,
  filters: { status?: string; limit?: number }
): Promise<ProposalSummary[]> {
  const result = await executeTool<
    { organization_id: string; status?: string; limit?: number },
    { items?: Array<Record<string, unknown>> }
  >(session, 'list_agent_proposals', {
    organization_id: session.organizationId,
    status: filters.status,
    limit: filters.limit ?? 10
  });

  return (result.items ?? []).map((item) => ({
    proposalId: String(item.proposal_id),
    organizationId: String(item.organization_id),
    draftId: item.target_entity_id ? String(item.target_entity_id) : null,
    draftNumber: item.draft_number ? String(item.draft_number) : null,
    status: String(item.status ?? 'unknown'),
    proposalType: String(item.proposal_type ?? 'journal_entry_draft'),
    title: item.title ? String(item.title) : null,
    createdAt: item.created_at ? String(item.created_at) : null
  }));
}

export async function getAgentProposal(session: Session, proposalId: string): Promise<ProposalDetail> {
  const result = await executeTool<
    { organization_id: string; proposal_id: string },
    Record<string, unknown>
  >(session, 'get_agent_proposal', {
    organization_id: session.organizationId,
    proposal_id: proposalId
  });

  const target = (result.target ?? {}) as Record<string, unknown>;

  return {
    proposalId: String(result.proposal_id),
    organizationId: String(result.organization_id),
    draftId: target.entity_id ? String(target.entity_id) : null,
    draftNumber: target.draft_number ? String(target.draft_number) : null,
    status: String(result.status ?? 'unknown'),
    proposalType: String(result.proposal_type ?? 'journal_entry_draft'),
    title: result.title ? String(result.title) : null,
    createdAt: result.created_at ? String(result.created_at) : null,
    description: result.description ? String(result.description) : null,
    payload: (result.payload ?? null) as Record<string, unknown> | null,
    metadata: (result.metadata ?? null) as Record<string, unknown> | null,
    actorContext: actorContext(result.actor_context as Record<string, unknown> | undefined),
    target: {
      entityType: target.entity_type ? String(target.entity_type) : null,
      entityId: target.entity_id ? String(target.entity_id) : null,
      draftNumber: target.draft_number ? String(target.draft_number) : null,
      draftStatus: target.draft_status ? String(target.draft_status) : null
    }
  };
}

export async function getJournalEntryDraft(session: Session, draftId: string): Promise<JournalDraftDetail> {
  const result = await executeTool<
    { organization_id: string; draft_id: string },
    Record<string, unknown>
  >(session, 'get_journal_entry_draft', {
    organization_id: session.organizationId,
    draft_id: draftId
  });

  return {
    draftId: String(result.draft_id),
    draftNumber: result.draft_number ? String(result.draft_number) : null,
    organizationId: String(result.organization_id),
    status: String(result.status ?? 'unknown'),
    memo: result.memo ? String(result.memo) : null,
    entryDate: String(result.entry_date),
    sourceType: String(result.source_type ?? 'unknown'),
    proposalId: result.proposal_id ? String(result.proposal_id) : null,
    proposalStatus: result.proposal_status ? String(result.proposal_status) : null,
    validationSummary: (result.validation_summary ?? null) as Record<string, unknown> | null,
    lines: ((result.lines ?? []) as Array<Record<string, unknown>>).map((line) => ({
      id: String(line.id),
      lineNumber: Number(line.line_number ?? 0),
      accountId: String(line.account_id),
      accountCode: line.account_code ? String(line.account_code) : null,
      accountName: line.account_name ? String(line.account_name) : null,
      description: line.description ? String(line.description) : null,
      debit: String(line.debit ?? '0.00'),
      credit: String(line.credit ?? '0.00')
    })),
    actorContext: actorContext(result.actor_context as Record<string, unknown> | undefined)
  };
}

export async function listApprovalRequests(
  session: Session,
  filters: { status?: string; assignedOnly?: boolean; limit?: number }
): Promise<ApprovalRequestSummary[]> {
  const tool = filters.assignedOnly ? 'list_assigned_approval_requests' : 'list_approval_requests';
  const result = await executeTool<
    { organization_id: string; status?: string; limit?: number },
    { items?: Array<Record<string, unknown>> }
  >(session, tool, {
    organization_id: session.organizationId,
    status: filters.status,
    limit: filters.limit ?? 10
  });

  return (result.items ?? []).map((item) => ({
    approvalRequestId: String(item.approval_request_id),
    organizationId: String(item.organization_id),
    targetEntityType: item.target_entity_type ? String(item.target_entity_type) : null,
    targetEntityId: item.target_entity_id ? String(item.target_entity_id) : null,
    draftNumber: item.draft_number ? String(item.draft_number) : null,
    title: item.title ? String(item.title) : null,
    status: String(item.status ?? 'unknown'),
    priority: item.priority ? String(item.priority) : null,
    currentApproverUserId: item.current_approver_user_id ? String(item.current_approver_user_id) : null,
    submittedAt: item.submitted_at ? String(item.submitted_at) : null
  }));
}

export async function getApprovalRequest(session: Session, approvalRequestId: string): Promise<ApprovalRequestDetail> {
  const result = await executeTool<
    { organization_id: string; approval_request_id: string },
    Record<string, unknown>
  >(session, 'get_approval_request', {
    organization_id: session.organizationId,
    approval_request_id: approvalRequestId
  });

  return {
    approvalRequestId: String(result.approval_request_id),
    organizationId: String(result.organization_id),
    targetEntityType: result.target_entity_type ? String(result.target_entity_type) : null,
    targetEntityId: result.target_entity_id ? String(result.target_entity_id) : null,
    draftNumber: result.draft_number ? String(result.draft_number) : null,
    title: result.title ? String(result.title) : null,
    status: String(result.status ?? 'unknown'),
    priority: result.priority ? String(result.priority) : null,
    currentApproverUserId: result.current_approver_user_id ? String(result.current_approver_user_id) : null,
    submittedAt: result.submitted_at ? String(result.submitted_at) : null,
    proposalId: result.proposal_id ? String(result.proposal_id) : null,
    draftId: result.draft_id ? String(result.draft_id) : null,
    draftStatus: result.draft_status ? String(result.draft_status) : null,
    approvalStatus: String(result.approval_status ?? result.status ?? 'unknown'),
    policySnapshot: (result.policy_snapshot ?? null) as Record<string, unknown> | null,
    actorContext: actorContext(result.actor_context as Record<string, unknown> | undefined),
    actionHistory: ((result.action_history ?? []) as Array<Record<string, unknown>>).map((action) => ({
      actionId: String(action.action_id ?? action.id ?? crypto.randomUUID()),
      action: String(action.action ?? 'unknown'),
      actorType: action.actor_type ? String(action.actor_type) : null,
      actorUserId: action.actor_user_id ? String(action.actor_user_id) : null,
      reason: action.reason ? String(action.reason) : null,
      occurredAt: action.occurred_at ? String(action.occurred_at) : null
    }))
  };
}

export async function resolveApprovalRequest(
  session: Session,
  approvalRequestId: string,
  resolution: 'approved' | 'rejected',
  reason: string
) {
  return executeTool<
    { organization_id: string; approval_request_id: string; resolution: string; reason: string },
    Record<string, unknown>
  >(
    session,
    'resolve_approval_request',
    {
      organization_id: session.organizationId,
      approval_request_id: approvalRequestId,
      resolution,
      reason
    },
    { idempotencyKey: crypto.randomUUID() }
  );
}

export async function escalateApprovalRequest(session: Session, approvalRequestId: string, reason: string) {
  return executeTool<
    { organization_id: string; approval_request_id: string; reason: string },
    Record<string, unknown>
  >(
    session,
    'escalate_approval_request',
    {
      organization_id: session.organizationId,
      approval_request_id: approvalRequestId,
      reason
    },
    { idempotencyKey: crypto.randomUUID() }
  );
}

export async function listJournalEntries(
  session: Session,
  filters: { status?: string; limit?: number }
): Promise<JournalEntrySummary[]> {
  const result = await executeTool<
    { organization_id: string; status?: string; limit?: number },
    { items?: Array<Record<string, unknown>> }
  >(session, 'list_journal_entries', {
    organization_id: session.organizationId,
    status: filters.status,
    limit: filters.limit ?? 10
  });

  return (result.items ?? []).map((item) => ({
    journalEntryId: String(item.journal_entry_id),
    organizationId: String(item.organization_id),
    entryNumber: item.entry_number ? String(item.entry_number) : null,
    entryDate: String(item.entry_date),
    status: String(item.status ?? 'unknown'),
    sourceType: item.source_type ? String(item.source_type) : null,
    memo: item.memo ? String(item.memo) : null,
    reversalJournalEntryId: item.reversal_journal_entry_id ? String(item.reversal_journal_entry_id) : null,
    postedAt: item.posted_at ? String(item.posted_at) : null
  }));
}

export async function getJournalEntry(session: Session, journalEntryId: string): Promise<JournalEntryDetail> {
  const result = await executeTool<
    { organization_id: string; journal_entry_id: string },
    Record<string, unknown>
  >(session, 'get_journal_entry', {
    organization_id: session.organizationId,
    journal_entry_id: journalEntryId
  });

  return {
    journalEntryId: String(result.journal_entry_id),
    organizationId: String(result.organization_id),
    entryNumber: result.entry_number ? String(result.entry_number) : null,
    entryDate: String(result.entry_date),
    status: String(result.status ?? 'unknown'),
    sourceType: result.source_type ? String(result.source_type) : null,
    memo: result.memo ? String(result.memo) : null,
    reversalJournalEntryId: result.reversal_journal_entry_id ? String(result.reversal_journal_entry_id) : null,
    postedAt: result.posted_at ? String(result.posted_at) : null,
    postedByUserId: result.posted_by_user_id ? String(result.posted_by_user_id) : null,
    linkedProposalId: result.linked_proposal_id ? String(result.linked_proposal_id) : null,
    reversedByJournalEntryId: result.reversed_by_journal_entry_id ? String(result.reversed_by_journal_entry_id) : null,
    reversalDate: result.reversal_date ? String(result.reversal_date) : null,
    reversalReason: result.reversal_reason ? String(result.reversal_reason) : null,
    lines: ((result.lines ?? []) as Array<Record<string, unknown>>).map((line) => ({
      id: String(line.id),
      lineNumber: Number(line.line_number ?? 0),
      accountId: String(line.account_id),
      accountCode: line.account_code ? String(line.account_code) : null,
      accountName: line.account_name ? String(line.account_name) : null,
      description: line.description ? String(line.description) : null,
      debit: String(line.debit ?? '0.00'),
      credit: String(line.credit ?? '0.00')
    })),
    actorContext: actorContext(result.actor_context as Record<string, unknown> | undefined)
  };
}

export async function getEntityTimeline(
  session: Session,
  entityType: string,
  entityId: string
): Promise<AuditEvent[]> {
  const result = await executeTool<
    { organization_id: string; entity_type: string; entity_id: string },
    { items?: Array<Record<string, unknown>> }
  >(session, 'get_entity_timeline', {
    organization_id: session.organizationId,
    entity_type: entityType,
    entity_id: entityId
  });

  return (result.items ?? []).map((item) => {
    const actor = (item.actor ?? {}) as Record<string, unknown>;
    const entity = (item.entity ?? {}) as Record<string, unknown>;

    return {
      eventId: String(item.event_id),
      source: String(item.source ?? 'unknown'),
      eventName: String(item.event_name ?? 'unknown'),
      eventTimestamp: String(item.event_timestamp),
      summary: item.summary ? String(item.summary) : null,
      actionStatus: item.action_status ? String(item.action_status) : null,
      requestId: item.request_id ? String(item.request_id) : null,
      correlationId: item.correlation_id ? String(item.correlation_id) : null,
      metadata: (item.metadata ?? null) as Record<string, unknown> | null,
      actor: {
        actorType: actor.actor_type ? String(actor.actor_type) : null,
        actorId: actor.actor_id ? String(actor.actor_id) : null,
        actorDisplayName: actor.actor_display_name ? String(actor.actor_display_name) : null,
        userId: actor.user_id ? String(actor.user_id) : null
      },
      entity: {
        entityType: entity.entity_type ? String(entity.entity_type) : null,
        entityId: entity.entity_id ? String(entity.entity_id) : null,
        parentEntityType: entity.parent_entity_type ? String(entity.parent_entity_type) : null,
        parentEntityId: entity.parent_entity_id ? String(entity.parent_entity_id) : null
      }
    };
  });
}

export async function loadDashboardSnapshot(session: Session): Promise<DashboardSnapshot> {
  const [openProposals, pendingApprovals, assignedApprovals, recentEntries] = await Promise.all([
    listAgentProposals(session, { status: 'needs_review', limit: 5 }),
    listApprovalRequests(session, { status: 'pending', limit: 5 }),
    listApprovalRequests(session, { status: 'pending', assignedOnly: true, limit: 5 }),
    listJournalEntries(session, { limit: 5 })
  ]);

  return {
    openProposals,
    pendingApprovals,
    assignedApprovals,
    recentEntries
  };
}

function reportEnvelope<TItem>(result: Record<string, unknown>, items: TItem[]): ReportEnvelope<TItem> {
  return {
    organizationId: String(result.organization_id),
    asOfDate: result.as_of_date ? String(result.as_of_date) : undefined,
    fromDate: result.from_date ? String(result.from_date) : undefined,
    toDate: result.to_date ? String(result.to_date) : undefined,
    actorContext: actorContext(result.actor_context as Record<string, unknown> | undefined),
    items
  };
}

export async function getTrialBalanceReport(
  session: Session,
  filters: { asOfDate: string; includeZeroBalances?: boolean }
): Promise<ReportEnvelope<TrialBalanceRow>> {
  const result = await fetchReport<Record<string, unknown>>(session, 'trial-balance', {
    as_of_date: filters.asOfDate,
    include_zero_balances: filters.includeZeroBalances
  });

  return reportEnvelope(
    result,
    ((result.items ?? []) as Array<Record<string, unknown>>).map((item) => ({
      accountId: String(item.account_id),
      accountCode: item.account_code ? String(item.account_code) : null,
      accountName: item.account_name ? String(item.account_name) : null,
      accountType: item.account_type ? String(item.account_type) : null,
      accountSubtype: item.account_subtype ? String(item.account_subtype) : null,
      debitBalance: String(item.debit_balance ?? '0.00'),
      creditBalance: String(item.credit_balance ?? '0.00'),
      netBalance: String(item.net_balance ?? '0.00')
    }))
  );
}

function statementRows(result: Record<string, unknown>): StatementRow[] {
  return ((result.items ?? []) as Array<Record<string, unknown>>).map((item) => ({
    section: String(item.section ?? 'unknown'),
    displayOrder: Number(item.display_order ?? 0),
    accountId: String(item.account_id),
    accountCode: item.account_code ? String(item.account_code) : null,
    accountName: item.account_name ? String(item.account_name) : null,
    accountType: item.account_type ? String(item.account_type) : null,
    accountSubtype: item.account_subtype ? String(item.account_subtype) : null,
    amount: String(item.amount ?? '0.00'),
    sectionTotal: String(item.section_total ?? '0.00'),
    balanceCheck: item.balance_check === null || item.balance_check === undefined ? null : String(item.balance_check),
    netIncome: item.net_income === null || item.net_income === undefined ? null : String(item.net_income)
  }));
}

export async function getBalanceSheetReport(
  session: Session,
  filters: { asOfDate: string; includeZeroBalances?: boolean }
): Promise<ReportEnvelope<StatementRow>> {
  const result = await fetchReport<Record<string, unknown>>(session, 'balance-sheet', {
    as_of_date: filters.asOfDate,
    include_zero_balances: filters.includeZeroBalances
  });

  return reportEnvelope(result, statementRows(result));
}

export async function getProfitAndLossReport(
  session: Session,
  filters: { fromDate: string; toDate: string; includeZeroBalances?: boolean }
): Promise<ReportEnvelope<StatementRow>> {
  const result = await fetchReport<Record<string, unknown>>(session, 'profit-and-loss', {
    from_date: filters.fromDate,
    to_date: filters.toDate,
    include_zero_balances: filters.includeZeroBalances
  });

  return reportEnvelope(result, statementRows(result));
}

export async function getGeneralLedgerReport(
  session: Session,
  filters: { fromDate: string; toDate: string; accountIds?: string }
): Promise<ReportEnvelope<GeneralLedgerRow>> {
  const result = await fetchReport<Record<string, unknown>>(session, 'general-ledger', {
    from_date: filters.fromDate,
    to_date: filters.toDate,
    account_ids: filters.accountIds
  });

  return reportEnvelope(
    result,
    ((result.items ?? []) as Array<Record<string, unknown>>).map((item) => ({
      accountId: String(item.account_id),
      accountCode: item.account_code ? String(item.account_code) : null,
      accountName: item.account_name ? String(item.account_name) : null,
      accountType: item.account_type ? String(item.account_type) : null,
      accountSubtype: item.account_subtype ? String(item.account_subtype) : null,
      rowType: String(item.row_type ?? 'entry'),
      entryDate: String(item.entry_date),
      journalEntryId: item.journal_entry_id ? String(item.journal_entry_id) : null,
      journalEntryLineId: item.journal_entry_line_id ? String(item.journal_entry_line_id) : null,
      entryNumber: item.entry_number ? String(item.entry_number) : null,
      memo: item.memo ? String(item.memo) : null,
      lineDescription: item.line_description ? String(item.line_description) : null,
      sourceType: item.source_type ? String(item.source_type) : null,
      lineNumber: item.line_number === null || item.line_number === undefined ? null : Number(item.line_number),
      debit: String(item.debit ?? '0.00'),
      credit: String(item.credit ?? '0.00'),
      openingBalance: String(item.opening_balance ?? '0.00'),
      runningBalance: String(item.running_balance ?? '0.00')
    }))
  );
}

function scheduleRunSummary(item: Record<string, unknown>): ScheduleRunSummary {
  return {
    scheduleRunId: String(item.schedule_run_id),
    organizationId: String(item.organization_id),
    scheduleDefinitionId: String(item.schedule_definition_id),
    scheduleName: item.schedule_name ? String(item.schedule_name) : null,
    scheduleDescription: item.schedule_description ? String(item.schedule_description) : null,
    scheduleType: String(item.schedule_type ?? 'unknown'),
    asOfDate: String(item.as_of_date),
    status: String(item.status ?? 'unknown'),
    glBalance: String(item.gl_balance ?? '0.00'),
    scheduleTotal: String(item.schedule_total ?? '0.00'),
    variance: String(item.variance ?? '0.00'),
    generatedAt: item.generated_at ? String(item.generated_at) : null,
    reviewedAt: item.reviewed_at ? String(item.reviewed_at) : null,
    reviewedByUserId: item.reviewed_by_user_id ? String(item.reviewed_by_user_id) : null,
    reconciliationStatus: item.reconciliation_status ? String(item.reconciliation_status) : null,
    reconciliationReviewedAt: item.reconciliation_reviewed_at ? String(item.reconciliation_reviewed_at) : null,
    reconciliationReviewedByUserId: item.reconciliation_reviewed_by_user_id ? String(item.reconciliation_reviewed_by_user_id) : null
  };
}

function scheduleDefinitionSummary(item: Record<string, unknown>): ScheduleDefinitionSummary {
  return {
    scheduleDefinitionId: String(item.schedule_definition_id),
    firmId: item.firm_id ? String(item.firm_id) : null,
    organizationId: item.organization_id ? String(item.organization_id) : null,
    scheduleType: String(item.schedule_type ?? 'unknown'),
    name: String(item.name ?? 'Untitled schedule'),
    description: item.description ? String(item.description) : null,
    glAccountIds: Array.isArray(item.gl_account_ids) ? item.gl_account_ids.map(String) : [],
    generationStrategy: String(item.generation_strategy ?? 'unknown'),
    groupBy: item.group_by ? String(item.group_by) : null,
    isActive: Boolean(item.is_active),
    metadata: (item.metadata ?? null) as Record<string, unknown> | null,
    createdAt: item.created_at ? String(item.created_at) : null,
    updatedAt: item.updated_at ? String(item.updated_at) : null,
    accounts: ((item.accounts ?? []) as Array<Record<string, unknown>>).map((account) => ({
      accountId: String(account.account_id),
      code: account.code ? String(account.code) : null,
      name: account.name ? String(account.name) : null,
      type: account.type ? String(account.type) : null,
      subtype: account.subtype ? String(account.subtype) : null,
      status: account.status ? String(account.status) : null
    }))
  };
}

export async function listScheduleDefinitions(
  session: Session,
  filters: { scheduleType?: string; isActive?: boolean; limit?: number }
): Promise<ScheduleDefinitionSummary[]> {
  const result = await fetchApi<{ items?: Array<Record<string, unknown>> }>(session, '/api/v1/schedules/definitions', {
    schedule_type: filters.scheduleType,
    is_active: filters.isActive === undefined ? undefined : String(filters.isActive),
    limit: filters.limit ?? 50
  });

  return (result.items ?? []).map(scheduleDefinitionSummary);
}

export async function createScheduleDefinition(
  session: Session,
  input: { scheduleType: string; name: string; description?: string; glAccountIds: string[]; groupBy?: string }
): Promise<ScheduleDefinitionSummary> {
  const result = await postApi<
    {
      organization_id: string;
      schedule_type: string;
      name: string;
      description?: string;
      gl_account_ids: string[];
      group_by?: string;
    },
    Record<string, unknown>
  >(session, '/api/v1/schedules/definitions', {
    organization_id: session.organizationId,
    schedule_type: input.scheduleType,
    name: input.name,
    description: input.description,
    gl_account_ids: input.glAccountIds,
    group_by: input.groupBy
  });

  return scheduleDefinitionSummary(result);
}

export async function listScheduleRuns(
  session: Session,
  filters: { scheduleType?: string; status?: string; asOfDate?: string; limit?: number }
): Promise<ScheduleRunSummary[]> {
  const result = await fetchApi<{ items?: Array<Record<string, unknown>> }>(session, '/api/v1/schedules/runs', {
    schedule_type: filters.scheduleType,
    status: filters.status,
    as_of_date: filters.asOfDate,
    limit: filters.limit ?? 25
  });

  return (result.items ?? []).map(scheduleRunSummary);
}

export async function getScheduleRun(session: Session, scheduleRunId: string): Promise<ScheduleRunDetail> {
  const result = await fetchApi<Record<string, unknown>>(session, `/api/v1/schedules/runs/${scheduleRunId}`, {});
  const summary = scheduleRunSummary(result);

  return {
    ...summary,
    glAccountIds: Array.isArray(result.gl_account_ids) ? result.gl_account_ids.map(String) : [],
    generationStrategy: result.generation_strategy ? String(result.generation_strategy) : null,
    groupBy: result.group_by ? String(result.group_by) : null,
    generatedByActorType: result.generated_by_actor_type ? String(result.generated_by_actor_type) : null,
    generatedByActorId: result.generated_by_actor_id ? String(result.generated_by_actor_id) : null,
    metadata: (result.metadata ?? null) as Record<string, unknown> | null,
    reconciliationId: result.reconciliation_id ? String(result.reconciliation_id) : null,
    reconciliationNotes: result.reconciliation_notes ? String(result.reconciliation_notes) : null,
    reconciliationMetadata: (result.reconciliation_metadata ?? null) as Record<string, unknown> | null,
    actorContext: actorContext(result.actor_context as Record<string, unknown> | undefined),
    rows: ((result.rows ?? []) as Array<Record<string, unknown>>).map((row) => ({
      scheduleRunRowId: String(row.schedule_run_row_id),
      rowOrder: Number(row.row_order ?? 0),
      referenceType: row.reference_type ? String(row.reference_type) : null,
      referenceId: row.reference_id ? String(row.reference_id) : null,
      referenceNumber: row.reference_number ? String(row.reference_number) : null,
      counterpartyId: row.counterparty_id ? String(row.counterparty_id) : null,
      counterpartyName: row.counterparty_name ? String(row.counterparty_name) : null,
      documentDate: row.document_date ? String(row.document_date) : null,
      dueDate: row.due_date ? String(row.due_date) : null,
      openingAmount: String(row.opening_amount ?? '0.00'),
      movementAmount: String(row.movement_amount ?? '0.00'),
      closingAmount: String(row.closing_amount ?? '0.00'),
      ageBucket: row.age_bucket ? String(row.age_bucket) : null,
      metadata: (row.metadata ?? null) as Record<string, unknown> | null
    }))
  };
}

export async function generateScheduleRun(
  session: Session,
  input: { scheduleType: string; asOfDate: string }
): Promise<ScheduleRunSummary> {
  const result = await postApi<
    { organization_id: string; schedule_type: string; as_of_date: string },
    Record<string, unknown>
  >(session, '/api/v1/schedules/runs', {
    organization_id: session.organizationId,
    schedule_type: input.scheduleType,
    as_of_date: input.asOfDate
  });

  return scheduleRunSummary(result);
}
