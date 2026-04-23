import type {
  ApprovalRequestDetail,
  ApprovalRequestSummary,
  AuditEvent,
  DashboardSnapshot,
  JournalDraftDetail,
  JournalEntryDetail,
  JournalEntrySummary,
  ProposalDetail,
  ProposalSummary
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
