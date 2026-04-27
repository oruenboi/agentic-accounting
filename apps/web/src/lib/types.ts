export interface ActorContext {
  appUserId?: string | null;
  authUserId?: string | null;
  organizationRole?: string | null;
  firmRole?: string | null;
  firmId?: string | null;
}

export interface ProposalSummary {
  proposalId: string;
  organizationId: string;
  draftId: string | null;
  draftNumber: string | null;
  status: string;
  proposalType: string;
  title: string | null;
  createdAt: string | null;
}

export interface ProposalDetail extends ProposalSummary {
  description: string | null;
  payload: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  target: {
    entityType: string | null;
    entityId: string | null;
    draftNumber: string | null;
    draftStatus: string | null;
  };
  actorContext?: ActorContext;
}

export interface JournalDraftDetail {
  draftId: string;
  draftNumber: string | null;
  organizationId: string;
  status: string;
  memo: string | null;
  entryDate: string;
  sourceType: string;
  proposalId: string | null;
  proposalStatus: string | null;
  validationSummary: Record<string, unknown> | null;
  lines: Array<{
    id: string;
    lineNumber: number;
    accountId: string;
    accountCode: string | null;
    accountName: string | null;
    description: string | null;
    debit: string | number;
    credit: string | number;
  }>;
  actorContext?: ActorContext;
}

export interface ApprovalRequestSummary {
  approvalRequestId: string;
  organizationId: string;
  targetEntityType: string | null;
  targetEntityId: string | null;
  draftNumber: string | null;
  title: string | null;
  status: string;
  priority: string | null;
  currentApproverUserId: string | null;
  submittedAt: string | null;
}

export interface ApprovalAction {
  actionId: string;
  action: string;
  actorType: string | null;
  actorUserId: string | null;
  reason: string | null;
  occurredAt: string | null;
}

export interface ApprovalRequestDetail extends ApprovalRequestSummary {
  proposalId: string | null;
  draftId: string | null;
  draftStatus: string | null;
  approvalStatus: string;
  policySnapshot: Record<string, unknown> | null;
  actionHistory: ApprovalAction[];
  actorContext?: ActorContext;
}

export interface JournalEntrySummary {
  journalEntryId: string;
  organizationId: string;
  entryNumber: string | null;
  entryDate: string;
  status: string;
  sourceType: string | null;
  memo: string | null;
  reversalJournalEntryId: string | null;
  postedAt: string | null;
}

export interface JournalEntryDetail extends JournalEntrySummary {
  postedByUserId: string | null;
  linkedProposalId: string | null;
  reversedByJournalEntryId: string | null;
  reversalDate: string | null;
  reversalReason: string | null;
  lines: Array<{
    id: string;
    lineNumber: number;
    accountId: string;
    accountCode: string | null;
    accountName: string | null;
    description: string | null;
    debit: string | number;
    credit: string | number;
  }>;
  actorContext?: ActorContext;
}

export interface AuditEvent {
  eventId: string;
  source: string;
  eventName: string;
  eventTimestamp: string;
  summary: string | null;
  actionStatus: string | null;
  requestId: string | null;
  correlationId: string | null;
  metadata: Record<string, unknown> | null;
  actor: {
    actorType: string | null;
    actorId: string | null;
    actorDisplayName: string | null;
    userId: string | null;
  };
  entity: {
    entityType: string | null;
    entityId: string | null;
    parentEntityType: string | null;
    parentEntityId: string | null;
  };
}

export interface DashboardSnapshot {
  openProposals: ProposalSummary[];
  pendingApprovals: ApprovalRequestSummary[];
  assignedApprovals: ApprovalRequestSummary[];
  recentEntries: JournalEntrySummary[];
}

export interface ReportEnvelope<TItem> {
  organizationId: string;
  asOfDate?: string;
  fromDate?: string;
  toDate?: string;
  items: TItem[];
  actorContext?: ActorContext;
}

export interface TrialBalanceRow {
  accountId: string;
  accountCode: string | null;
  accountName: string | null;
  accountType: string | null;
  accountSubtype: string | null;
  debitBalance: string | number;
  creditBalance: string | number;
  netBalance: string | number;
}

export interface StatementRow {
  section: string;
  displayOrder: number;
  accountId: string;
  accountCode: string | null;
  accountName: string | null;
  accountType: string | null;
  accountSubtype: string | null;
  amount: string | number;
  sectionTotal: string | number;
  balanceCheck?: string | number | null;
  netIncome?: string | number | null;
}

export interface GeneralLedgerRow {
  accountId: string;
  accountCode: string | null;
  accountName: string | null;
  accountType: string | null;
  accountSubtype: string | null;
  rowType: string;
  entryDate: string;
  journalEntryId: string | null;
  journalEntryLineId: string | null;
  entryNumber: string | null;
  memo: string | null;
  lineDescription: string | null;
  sourceType: string | null;
  lineNumber: number | null;
  debit: string | number;
  credit: string | number;
  openingBalance: string | number;
  runningBalance: string | number;
}

export interface AccountSummary {
  accountId: string;
  firmId: string | null;
  organizationId: string;
  code: string;
  name: string;
  type: string;
  subtype: string | null;
  parentAccountId: string | null;
  status: string;
  isPostable: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ScheduleRunSummary {
  scheduleRunId: string;
  organizationId: string;
  scheduleDefinitionId: string;
  scheduleName: string | null;
  scheduleDescription: string | null;
  scheduleType: string;
  asOfDate: string;
  status: string;
  glBalance: string | number;
  scheduleTotal: string | number;
  variance: string | number;
  generatedAt: string | null;
  reviewedAt: string | null;
  reviewedByUserId: string | null;
  reconciliationStatus: string | null;
  reconciliationReviewedAt: string | null;
  reconciliationReviewedByUserId: string | null;
}

export interface ScheduleDefinitionAccount {
  accountId: string;
  code: string | null;
  name: string | null;
  type: string | null;
  subtype: string | null;
  status: string | null;
}

export interface ScheduleDefinitionSummary {
  scheduleDefinitionId: string;
  firmId: string | null;
  organizationId: string | null;
  scheduleType: string;
  name: string;
  description: string | null;
  glAccountIds: string[];
  generationStrategy: string;
  groupBy: string | null;
  isActive: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: string | null;
  updatedAt: string | null;
  accounts: ScheduleDefinitionAccount[];
}

export interface ScheduleRunRow {
  scheduleRunRowId: string;
  rowOrder: number;
  referenceType: string | null;
  referenceId: string | null;
  referenceNumber: string | null;
  counterpartyId: string | null;
  counterpartyName: string | null;
  documentDate: string | null;
  dueDate: string | null;
  openingAmount: string | number;
  movementAmount: string | number;
  closingAmount: string | number;
  ageBucket: string | null;
  metadata: Record<string, unknown> | null;
}

export interface ScheduleRunDetail extends ScheduleRunSummary {
  glAccountIds: string[];
  generationStrategy: string | null;
  groupBy: string | null;
  generatedByActorType: string | null;
  generatedByActorId: string | null;
  metadata: Record<string, unknown> | null;
  reconciliationId: string | null;
  reconciliationNotes: string | null;
  reconciliationMetadata: Record<string, unknown> | null;
  actorContext?: ActorContext;
  rows: ScheduleRunRow[];
}
