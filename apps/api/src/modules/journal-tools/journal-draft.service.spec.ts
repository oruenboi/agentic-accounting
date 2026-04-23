import { AppError } from '../shared/app-error';
import type { AuthenticatedActor } from '../auth/authenticated-request.interface';
import { JournalDraftService } from './journal-draft.service';

describe('JournalDraftService', () => {
  const actor: AuthenticatedActor = {
    actorType: 'agent',
    authUserId: '11111111-1111-4111-8111-111111111111',
    email: null,
    clientId: 'test-agent-client',
    agentName: 'test-agent',
    agentRunId: 'run-1',
    delegatedAuthUserId: '11111111-1111-4111-8111-111111111111'
  };

  const input = {
    organization_id: '10000000-0000-4000-8000-000000000003',
    accounting_period_id: '10000000-0000-4000-8000-000000000004',
    entry_date: '2026-04-23',
    source_type: 'manual_adjustment',
    memo: 'Utilities accrual',
    lines: [
      {
        account_id: '10000000-0000-4000-8000-000000000501',
        debit: 100,
        credit: 0
      },
      {
        account_id: '10000000-0000-4000-8000-000000000201',
        debit: 0,
        credit: 100
      }
    ],
    metadata: {
      source: 'test'
    }
  };

  const reversalInput = {
    organization_id: input.organization_id,
    journal_entry_id: 'entry-1',
    reversal_date: '2026-04-24',
    reason: 'Customer invoice voided'
  };

  const reworkInput = {
    ...input,
    draft_id: 'draft-1',
    memo: 'Utilities accrual revised'
  };

  const actorContext = {
    appUserId: '10000000-0000-4000-8000-000000000002',
    authUserId: '11111111-1111-4111-8111-111111111111',
    organizationRole: 'org_admin',
    firmRole: 'firm_owner',
    firmId: '10000000-0000-4000-8000-000000000001'
  };

  const validation = {
    organization_id: input.organization_id,
    entry_date: input.entry_date,
    actor_context: actorContext,
    valid: true,
    requires_approval: false,
    errors: [],
    warnings: [],
    impact_preview: {
      line_count: 2,
      total_debit: 100,
      total_credit: 100,
      account_ids: input.lines.map((line) => line.account_id)
    },
    validation_result: {
      balanced: true,
      account_count: 2,
      period: {
        id: input.accounting_period_id,
        period_start: '2026-01-01',
        period_end: '2026-12-31',
        status: 'open'
      }
    }
  };

  const databaseService = {
    query: jest.fn(),
    withTransaction: jest.fn()
  };

  const tenantAccessService = {
    assertOrganizationAccess: jest.fn()
  };

  const journalValidationService = {
    validateJournalEntry: jest.fn()
  };

  let service: JournalDraftService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new JournalDraftService(
      databaseService as never,
      tenantAccessService as never,
      journalValidationService as never
    );

    journalValidationService.validateJournalEntry.mockResolvedValue(validation);
  });

  it('creates a validated draft, proposal, and succeeded idempotency record', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ prefix: 'JE', allocated_value: 1, padding_width: 6 }] })
      .mockResolvedValueOnce({ rows: [{ id: 'draft-1' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'proposal-1' }] })
      .mockResolvedValueOnce({ rows: [] });

    databaseService.withTransaction.mockImplementation(async (callback: (runner: { query: typeof query }) => unknown) =>
      callback({ query })
    );

    const result = await service.createJournalEntryDraft(input, actor, {
      requestId: 'request-1',
      correlationId: 'corr-1',
      idempotencyKey: 'idem-1',
      toolName: 'create_journal_entry_draft'
    });

    expect(journalValidationService.validateJournalEntry).toHaveBeenCalledWith(input, actor);
    expect(result).toEqual(
      expect.objectContaining({
        draft_id: 'draft-1',
        draft_number: 'JE-000001',
        proposal_id: 'proposal-1',
        organization_id: input.organization_id,
        line_count: 2,
        status: 'validated'
      })
    );
    expect(query).toHaveBeenCalledTimes(8);
  });

  it('replays a succeeded idempotent response when the same payload is retried', async () => {
    const replayedResponse = {
      draft_id: 'draft-1',
      draft_number: 'JE-000001',
      proposal_id: 'proposal-1'
    };
    const requestHash = (service as unknown as { hashRequestPayload: (value: typeof input) => string }).hashRequestPayload(
      input
    );

    const query = jest.fn().mockResolvedValueOnce({
      rows: [
        {
          request_hash: requestHash,
          status: 'succeeded',
          response_body: replayedResponse
        }
      ]
    });

    databaseService.withTransaction.mockImplementation(async (callback: (runner: { query: typeof query }) => unknown) =>
      callback({ query })
    );

    const result = await service.createJournalEntryDraft(input, actor, {
      requestId: 'request-1',
      correlationId: 'corr-1',
      idempotencyKey: 'idem-1',
      toolName: 'create_journal_entry_draft'
    });

    expect(result).toBe(replayedResponse);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('rejects reused idempotency keys when the stored payload hash differs', async () => {
    const query = jest.fn().mockResolvedValueOnce({
      rows: [
        {
          request_hash: 'different-hash',
          status: 'succeeded',
          response_body: null
        }
      ]
    });

    databaseService.withTransaction.mockImplementation(async (callback: (runner: { query: typeof query }) => unknown) =>
      callback({ query })
    );

    await expect(
      service.createJournalEntryDraft(input, actor, {
        requestId: 'request-1',
        correlationId: 'corr-1',
        idempotencyKey: 'idem-1',
        toolName: 'create_journal_entry_draft'
      })
    ).rejects.toMatchObject({
      code: 'IDEMPOTENCY_CONFLICT'
    });
  });

  it('returns a persisted journal draft with lines and linked proposal state', async () => {
    tenantAccessService.assertOrganizationAccess.mockResolvedValue(actorContext);
    databaseService.query
      .mockResolvedValueOnce({
        rows: [
          {
            draft_id: 'draft-1',
            draft_number: 'JE-000001',
            status: 'validated',
            entry_date: '2026-04-23',
            memo: 'Utilities accrual',
            source_type: 'manual_adjustment',
            source_id: 'request-1',
            accounting_period_id: 'period-1',
            created_by_actor_type: 'agent',
            created_by_actor_id: 'test-agent-client',
            created_by_user_id: actorContext.appUserId,
            proposal_id: 'proposal-1',
            proposal_status: 'needs_review',
            validation_summary: { valid: true },
            metadata: { source: 'test' }
          }
        ]
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'line-1',
            line_number: 1,
            account_id: input.lines[0].account_id,
            account_code: '5000',
            account_name: 'Operating Expense',
            description: null,
            debit: '100.00',
            credit: '0.00'
          },
          {
            id: 'line-2',
            line_number: 2,
            account_id: input.lines[1].account_id,
            account_code: '2000',
            account_name: 'Accounts Payable',
            description: null,
            debit: '0.00',
            credit: '100.00'
          }
        ]
      });

    const result = await service.getJournalEntryDraft(
      {
        organization_id: input.organization_id,
        draft_id: 'draft-1'
      },
      actor
    );

    expect(tenantAccessService.assertOrganizationAccess).toHaveBeenCalledWith(actor, input.organization_id);
    expect(result).toEqual(
      expect.objectContaining({
        draft_id: 'draft-1',
        draft_number: 'JE-000001',
        proposal: {
          proposal_id: 'proposal-1',
          status: 'needs_review'
        }
      })
    );
    expect(result.lines).toHaveLength(2);
  });

  it('lists agent proposals for an organization', async () => {
    tenantAccessService.assertOrganizationAccess.mockResolvedValue(actorContext);
    databaseService.query.mockResolvedValueOnce({
      rows: [
        {
          proposal_id: 'proposal-1',
          proposal_type: 'journal_entry',
          status: 'needs_review',
          title: 'Journal draft: Utilities accrual',
          created_at: '2026-04-23T10:00:00.000Z',
          updated_at: '2026-04-23T10:00:00.000Z',
          source_tool_name: 'create_journal_entry_draft',
          source_request_id: 'request-1',
          correlation_id: 'corr-1',
          idempotency_key: 'idem-1',
          target_entity_type: 'journal_entry_draft',
          target_entity_id: 'draft-1',
          draft_number: 'JE-000001'
        }
      ]
    });

    const result = await service.listAgentProposals(
      {
        organization_id: input.organization_id,
        status: 'needs_review',
        limit: 10
      },
      actor
    );

    expect(tenantAccessService.assertOrganizationAccess).toHaveBeenCalledWith(actor, input.organization_id);
    expect(result).toEqual(
      expect.objectContaining({
        organization_id: input.organization_id,
        filters: {
          status: 'needs_review',
          limit: 10
        }
      })
    );
    expect(result.items).toEqual([
      expect.objectContaining({
        proposal_id: 'proposal-1',
        draft_number: 'JE-000001',
        status: 'needs_review'
      })
    ]);
  });

  it('returns a persisted agent proposal with linked draft context', async () => {
    tenantAccessService.assertOrganizationAccess.mockResolvedValue(actorContext);
    databaseService.query.mockResolvedValueOnce({
      rows: [
        {
          proposal_id: 'proposal-1',
          proposal_type: 'journal_entry',
          status: 'needs_review',
          title: 'Journal draft: Utilities accrual',
          description: 'Utilities accrual',
          source_agent_name: 'test-agent',
          source_agent_run_id: 'run-1',
          source_tool_name: 'create_journal_entry_draft',
          source_request_id: 'request-1',
          correlation_id: 'corr-1',
          idempotency_key: 'idem-1',
          target_entity_type: 'journal_entry_draft',
          target_entity_id: 'draft-1',
          payload: {
            draft_id: 'draft-1',
            draft_number: 'JE-000001'
          },
          metadata: {
            warnings: []
          },
          created_by_actor_type: 'agent',
          created_by_actor_id: 'test-agent-client',
          created_by_user_id: actorContext.appUserId,
          created_at: '2026-04-23T10:00:00.000Z',
          updated_at: '2026-04-23T10:00:00.000Z',
          draft_number: 'JE-000001',
          draft_status: 'validated'
        }
      ]
    });

    const result = await service.getAgentProposal(
      {
        organization_id: input.organization_id,
        proposal_id: 'proposal-1'
      },
      actor
    );

    expect(tenantAccessService.assertOrganizationAccess).toHaveBeenCalledWith(actor, input.organization_id);
    expect(result).toEqual(
      expect.objectContaining({
        proposal_id: 'proposal-1',
        proposal_type: 'journal_entry',
        target: {
          entity_type: 'journal_entry_draft',
          entity_id: 'draft-1',
          draft_number: 'JE-000001',
          draft_status: 'validated'
        }
      })
    );
  });

  it('lists normalized audit events for an organization', async () => {
    tenantAccessService.assertOrganizationAccess.mockResolvedValue(actorContext);
    databaseService.query.mockResolvedValueOnce({
      rows: [
        {
          event_id: 'audit-1',
          source: 'approval_action',
          organization_id: input.organization_id,
          event_name: 'approval.action.approved',
          event_timestamp: '2026-04-23T11:00:00.000Z',
          actor_type: 'agent',
          actor_id: 'test-agent-client',
          actor_display_name: 'test-agent',
          user_id: actorContext.appUserId,
          agent_name: null,
          agent_run_id: null,
          tool_name: null,
          request_id: 'request-3',
          correlation_id: 'corr-3',
          idempotency_key: 'idem-resolve-1',
          entity_type: 'journal_entry_draft',
          entity_id: 'draft-1',
          parent_entity_type: 'approval_request',
          parent_entity_id: 'approval-1',
          action_status: 'succeeded',
          approval_request_id: 'approval-1',
          approval_required: true,
          summary: 'Threshold review complete',
          metadata: { decision_reason: 'Threshold review complete' }
        }
      ]
    });

    const result = await service.listAuditEvents(
      {
        organization_id: input.organization_id,
        entity_type: 'journal_entry_draft',
        entity_id: 'draft-1',
        limit: 20
      },
      actor
    );

    expect(result).toEqual(
      expect.objectContaining({
        organization_id: input.organization_id,
        filters: expect.objectContaining({
          entity_type: 'journal_entry_draft',
          entity_id: 'draft-1',
          limit: 20
        })
      })
    );
    expect(result.items).toEqual([
      expect.objectContaining({
        event_id: 'audit-1',
        event_name: 'approval.action.approved',
        entity: expect.objectContaining({
          entity_type: 'journal_entry_draft',
          entity_id: 'draft-1'
        })
      })
    ]);
  });

  it('returns an entity timeline with normalized approval-history events', async () => {
    tenantAccessService.assertOrganizationAccess.mockResolvedValue(actorContext);
    databaseService.query.mockResolvedValueOnce({
      rows: [
        {
          event_id: 'audit-1',
          source: 'approval_action',
          organization_id: input.organization_id,
          event_name: 'approval.action.submitted',
          event_timestamp: '2026-04-23T10:00:00.000Z',
          actor_type: 'agent',
          actor_id: 'test-agent-client',
          actor_display_name: 'test-agent',
          user_id: actorContext.appUserId,
          agent_name: null,
          agent_run_id: null,
          tool_name: null,
          request_id: 'request-2',
          correlation_id: 'corr-2',
          idempotency_key: 'idem-submit-1',
          entity_type: 'journal_entry_draft',
          entity_id: 'draft-1',
          parent_entity_type: 'approval_request',
          parent_entity_id: 'approval-1',
          action_status: 'succeeded',
          approval_request_id: 'approval-1',
          approval_required: true,
          summary: 'Approval action submitted recorded',
          metadata: {}
        },
        {
          event_id: 'audit-2',
          source: 'approval_action',
          organization_id: input.organization_id,
          event_name: 'approval.action.approved',
          event_timestamp: '2026-04-23T11:00:00.000Z',
          actor_type: 'agent',
          actor_id: 'test-agent-client',
          actor_display_name: 'test-agent',
          user_id: actorContext.appUserId,
          agent_name: null,
          agent_run_id: null,
          tool_name: null,
          request_id: 'request-3',
          correlation_id: 'corr-3',
          idempotency_key: 'idem-resolve-1',
          entity_type: 'journal_entry_draft',
          entity_id: 'draft-1',
          parent_entity_type: 'approval_request',
          parent_entity_id: 'approval-1',
          action_status: 'succeeded',
          approval_request_id: 'approval-1',
          approval_required: true,
          summary: 'Threshold review complete',
          metadata: { decision_reason: 'Threshold review complete' }
        }
      ]
    });

    const result = await service.getEntityTimeline(
      {
        organization_id: input.organization_id,
        entity_type: 'journal_entry_draft',
        entity_id: 'draft-1'
      },
      actor
    );

    expect(result).toEqual(
      expect.objectContaining({
        organization_id: input.organization_id,
        entity_type: 'journal_entry_draft',
        entity_id: 'draft-1'
      })
    );
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        event_name: 'approval.action.submitted'
      })
    );
  });

  it('lists posted journal entries for an organization', async () => {
    tenantAccessService.assertOrganizationAccess.mockResolvedValue(actorContext);
    databaseService.query.mockResolvedValueOnce({
      rows: [
        {
          journal_entry_id: 'entry-1',
          entry_number: 'JE-000001',
          entry_date: '2026-04-23',
          memo: 'Utilities accrual',
          source_type: 'manual_adjustment',
          source_id: 'request-1',
          status: 'reversed',
          posted_at: '2026-04-23T12:00:00.000Z',
          draft_id: 'draft-1',
          draft_number: 'JE-000001',
          proposal_id: 'proposal-1',
          proposal_status: 'posted',
          reversal_of_journal_entry_id: null,
          reversal_journal_entry_id: 'entry-2',
          line_count: '2'
        }
      ]
    });

    const result = await service.listJournalEntries(
      {
        organization_id: input.organization_id,
        status: 'reversed',
        from_date: '2026-04-01',
        to_date: '2026-04-30',
        limit: 10
      },
      actor
    );

    expect(result).toEqual(
      expect.objectContaining({
        organization_id: input.organization_id,
        filters: {
          status: 'reversed',
          from_date: '2026-04-01',
          to_date: '2026-04-30',
          limit: 10
        }
      })
    );
    expect(result.items).toEqual([
      expect.objectContaining({
        journal_entry_id: 'entry-1',
        entry_number: 'JE-000001',
        status: 'reversed',
        reversal_journal_entry_id: 'entry-2',
        line_count: 2
      })
    ]);
  });

  it('returns a posted journal entry with lines and reversal linkage', async () => {
    tenantAccessService.assertOrganizationAccess.mockResolvedValue(actorContext);
    databaseService.query
      .mockResolvedValueOnce({
        rows: [
          {
            journal_entry_id: 'entry-1',
            entry_number: 'JE-000001',
            entry_date: '2026-04-23',
            memo: 'Utilities accrual',
            source_type: 'manual_adjustment',
            source_id: 'request-1',
            status: 'reversed',
            posted_at: '2026-04-23T12:00:00.000Z',
            accounting_period_id: input.accounting_period_id,
            posted_by_actor_type: 'agent',
            posted_by_actor_id: 'test-agent-client',
            posted_by_user_id: actorContext.appUserId,
            metadata: { source: 'test' },
            draft_id: 'draft-1',
            draft_number: 'JE-000001',
            draft_status: 'posted',
            proposal_id: 'proposal-1',
            proposal_status: 'posted',
            proposal_title: 'Journal draft: Utilities accrual',
            posted_entity_type: 'journal_entry',
            posted_entity_id: 'entry-1',
            reversal_of_journal_entry_id: null,
            journal_entry_reversal_id: 'reversal-1',
            reversed_by_journal_entry_id: 'entry-2',
            reversal_date: '2026-04-24',
            reversal_reason: 'Customer invoice voided'
          }
        ]
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'line-1',
            line_number: 1,
            account_id: input.lines[0].account_id,
            account_code: '5000',
            account_name: 'Operating Expense',
            description: null,
            debit: '100.00',
            credit: '0.00',
            dimensions: {},
            metadata: {}
          },
          {
            id: 'line-2',
            line_number: 2,
            account_id: input.lines[1].account_id,
            account_code: '2000',
            account_name: 'Accounts Payable',
            description: null,
            debit: '0.00',
            credit: '100.00',
            dimensions: {},
            metadata: {}
          }
        ]
      });

    const result = await service.getJournalEntry(
      {
        organization_id: input.organization_id,
        journal_entry_id: 'entry-1'
      },
      actor
    );

    expect(result).toEqual(
      expect.objectContaining({
        journal_entry_id: 'entry-1',
        entry_number: 'JE-000001',
        status: 'reversed',
        proposal: expect.objectContaining({
          proposal_id: 'proposal-1'
        }),
        reversal_linkage: expect.objectContaining({
          journal_entry_reversal_id: 'reversal-1',
          reversed_by_journal_entry_id: 'entry-2'
        })
      })
    );
    expect(result.lines).toHaveLength(2);
  });

  it('returns journal entry reversal lineage for posted entries', async () => {
    tenantAccessService.assertOrganizationAccess.mockResolvedValue(actorContext);
    databaseService.query
      .mockResolvedValueOnce({
        rows: [
          {
            journal_entry_id: 'entry-2',
            entry_number: 'JE-000002',
            entry_date: '2026-04-24',
            memo: 'Reversal of JE-000001: Customer invoice voided',
            source_type: 'journal_entry_reversal',
            source_id: 'entry-1',
            status: 'posted',
            accounting_period_id: input.accounting_period_id,
            reversal_of_journal_entry_id: 'entry-1',
            reversal_record_id: null,
            reversal_journal_entry_id: null
          }
        ]
      })
      .mockResolvedValueOnce({
        rows: [
          {
            journal_entry_id: 'entry-1',
            entry_number: 'JE-000001',
            entry_date: '2026-04-23',
            memo: 'Utilities accrual',
            source_type: 'manual_adjustment',
            source_id: 'request-1',
            status: 'reversed',
            posted_at: '2026-04-23T12:00:00.000Z',
            accounting_period_id: input.accounting_period_id,
            posted_by_actor_type: 'agent',
            posted_by_actor_id: 'test-agent-client',
            posted_by_user_id: actorContext.appUserId,
            metadata: { source: 'test' },
            draft_id: 'draft-1',
            draft_number: 'JE-000001',
            draft_status: 'posted',
            proposal_id: 'proposal-1',
            proposal_status: 'posted',
            proposal_title: 'Journal draft: Utilities accrual',
            posted_entity_type: 'journal_entry',
            posted_entity_id: 'entry-1',
            reversal_of_journal_entry_id: null,
            journal_entry_reversal_id: 'reversal-1',
            reversed_by_journal_entry_id: 'entry-2',
            reversal_date: '2026-04-24',
            reversal_reason: 'Customer invoice voided'
          },
          {
            journal_entry_id: 'entry-2',
            entry_number: 'JE-000002',
            entry_date: '2026-04-24',
            memo: 'Reversal of JE-000001: Customer invoice voided',
            source_type: 'journal_entry_reversal',
            source_id: 'entry-1',
            status: 'posted',
            posted_at: '2026-04-24T09:00:00.000Z',
            accounting_period_id: input.accounting_period_id,
            posted_by_actor_type: 'agent',
            posted_by_actor_id: 'test-agent-client',
            posted_by_user_id: actorContext.appUserId,
            metadata: {},
            draft_id: null,
            draft_number: null,
            draft_status: null,
            proposal_id: null,
            proposal_status: null,
            proposal_title: null,
            posted_entity_type: null,
            posted_entity_id: null,
            reversal_of_journal_entry_id: 'entry-1',
            journal_entry_reversal_id: 'reversal-1',
            reversed_by_journal_entry_id: null,
            reversal_date: '2026-04-24',
            reversal_reason: 'Customer invoice voided'
          }
        ]
      });

    const result = await service.getJournalEntryReversalChain(
      {
        organization_id: input.organization_id,
        journal_entry_id: 'entry-2'
      },
      actor
    );

    expect(result).toEqual(
      expect.objectContaining({
        requested_journal_entry_id: 'entry-2',
        original_entry: expect.objectContaining({
          journal_entry_id: 'entry-1',
          entry_number: 'JE-000001',
          status: 'reversed'
        }),
        reversal: expect.objectContaining({
          journal_entry_reversal_id: 'reversal-1',
          reason: 'Customer invoice voided',
          journal_entry: expect.objectContaining({
            journal_entry_id: 'entry-2',
            entry_number: 'JE-000002'
          })
        })
      })
    );
  });

  it('submits a validated draft for approval and updates the linked proposal state', async () => {
    tenantAccessService.assertOrganizationAccess.mockResolvedValue(actorContext);

    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            draft_id: 'draft-1',
            draft_number: 'JE-000001',
            status: 'validated',
            entry_date: '2026-04-23',
            memo: 'Utilities accrual',
            accounting_period_id: input.accounting_period_id,
            validation_summary: { valid: true },
            metadata: { source: 'test' },
            proposal_id: 'proposal-1'
          }
        ]
      })
      .mockResolvedValueOnce({
        rows: [
          {
            user_id: 'approver-1',
            role: 'reviewer',
            scope: 'organization',
            rank: 1
          }
        ]
      })
      .mockResolvedValueOnce({
        rows: [
          {
            approval_request_id: 'approval-1',
            status: 'pending',
            priority: 'high',
            current_approver_user_id: 'approver-1',
            policy_snapshot: {
              route_status: 'assigned',
              assigned_approver_user_id: 'approver-1',
              assigned_role: 'reviewer',
              assigned_scope: 'organization'
            },
            created_at: '2026-04-23T10:00:00.000Z'
          }
        ]
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    databaseService.withTransaction.mockImplementation(async (callback: (runner: { query: typeof query }) => unknown) =>
      callback({ query })
    );

    const result = await service.submitJournalEntryDraftForApproval(
      {
        organization_id: input.organization_id,
        draft_id: 'draft-1',
        priority: 'high'
      },
      actor,
      {
        requestId: 'request-2',
        correlationId: 'corr-2',
        idempotencyKey: 'idem-submit-1',
        toolName: 'submit_journal_entry_draft_for_approval'
      }
    );

    expect(tenantAccessService.assertOrganizationAccess).toHaveBeenCalledWith(actor, input.organization_id);
    expect(result).toEqual(
      expect.objectContaining({
        draft_id: 'draft-1',
        draft_number: 'JE-000001',
        proposal_id: 'proposal-1',
        approval_request_id: 'approval-1',
        status: 'pending_approval',
        approval_status: 'pending',
        requires_approval: true,
        priority: 'high',
        current_approver_user_id: 'approver-1'
      })
    );
    expect(query).toHaveBeenCalledTimes(9);
  });

  it('reworks a rejected draft back to validated state and replaces its lines', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            draft_id: 'draft-1',
            draft_number: 'JE-000001',
            status: 'rejected',
            entry_date: '2026-04-23',
            memo: 'Utilities accrual',
            accounting_period_id: input.accounting_period_id,
            validation_summary: { valid: true },
            metadata: { source: 'test' },
            proposal_id: 'proposal-1',
            approval_request_id: 'approval-1',
            approval_status: 'rejected',
            proposal_status: 'rejected'
          }
        ]
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    databaseService.withTransaction.mockImplementation(async (callback: (runner: { query: typeof query }) => unknown) =>
      callback({ query })
    );

    const result = await service.reworkRejectedJournalEntryDraft(
      reworkInput,
      actor,
      {
        requestId: 'request-6',
        correlationId: 'corr-6',
        idempotencyKey: 'idem-rework-1',
        toolName: 'rework_rejected_journal_entry_draft'
      }
    );

    expect(journalValidationService.validateJournalEntry).toHaveBeenCalledWith(reworkInput, actor);
    expect(result).toEqual(
      expect.objectContaining({
        draft_id: 'draft-1',
        draft_number: 'JE-000001',
        proposal_id: 'proposal-1',
        status: 'validated',
        line_count: 2
      })
    );
    expect(query).toHaveBeenCalledTimes(9);
  });

  it('replays a succeeded rework response when the same payload is retried', async () => {
    const replayedResponse = {
      draft_id: 'draft-1',
      draft_number: 'JE-000001',
      status: 'validated'
    };
    const requestHash = (service as unknown as { hashRequestPayload: (value: typeof reworkInput) => string }).hashRequestPayload(
      reworkInput
    );

    const query = jest.fn().mockResolvedValueOnce({
      rows: [
        {
          request_hash: requestHash,
          status: 'succeeded',
          response_body: replayedResponse
        }
      ]
    });

    databaseService.withTransaction.mockImplementation(async (callback: (runner: { query: typeof query }) => unknown) =>
      callback({ query })
    );

    const result = await service.reworkRejectedJournalEntryDraft(
      reworkInput,
      actor,
      {
        requestId: 'request-6',
        correlationId: 'corr-6',
        idempotencyKey: 'idem-rework-1',
        toolName: 'rework_rejected_journal_entry_draft'
      }
    );

    expect(result).toBe(replayedResponse);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('rejects rework when the draft is not rejected', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            draft_id: 'draft-1',
            draft_number: 'JE-000001',
            status: 'validated',
            entry_date: '2026-04-23',
            memo: 'Utilities accrual',
            accounting_period_id: input.accounting_period_id,
            validation_summary: { valid: true },
            metadata: { source: 'test' },
            proposal_id: 'proposal-1',
            approval_request_id: 'approval-1',
            approval_status: 'rejected',
            proposal_status: 'rejected'
          }
        ]
      });

    databaseService.withTransaction.mockImplementation(async (callback: (runner: { query: typeof query }) => unknown) =>
      callback({ query })
    );

    await expect(
      service.reworkRejectedJournalEntryDraft(
        reworkInput,
        actor,
        {
          requestId: 'request-6',
          correlationId: 'corr-6',
          idempotencyKey: 'idem-rework-1',
          toolName: 'rework_rejected_journal_entry_draft'
        }
      )
    ).rejects.toMatchObject({
      code: 'DRAFT_REWORK_INVALID_STATE'
    });
  });

  it('resubmits a previously rejected draft for approval with a fresh approval request', async () => {
    tenantAccessService.assertOrganizationAccess.mockResolvedValue(actorContext);

    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            draft_id: 'draft-1',
            draft_number: 'JE-000001',
            status: 'validated',
            entry_date: '2026-04-23',
            memo: 'Utilities accrual revised',
            accounting_period_id: input.accounting_period_id,
            validation_summary: { valid: true },
            metadata: { source: 'test' },
            proposal_id: 'proposal-1',
            approval_request_id: 'approval-1',
            approval_status: 'rejected',
            proposal_status: 'needs_review'
          }
        ]
      })
      .mockResolvedValueOnce({
        rows: [
          {
            user_id: 'approver-2',
            role: 'firm_owner',
            scope: 'firm',
            rank: 3
          }
        ]
      })
      .mockResolvedValueOnce({
        rows: [
          {
            approval_request_id: 'approval-2',
            status: 'pending',
            priority: 'high',
            current_approver_user_id: 'approver-2',
            policy_snapshot: {
              route_status: 'assigned',
              assigned_approver_user_id: 'approver-2',
              assigned_role: 'firm_owner',
              assigned_scope: 'firm',
              fallback_used: true
            },
            created_at: '2026-04-23T12:30:00.000Z'
          }
        ]
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    databaseService.withTransaction.mockImplementation(async (callback: (runner: { query: typeof query }) => unknown) =>
      callback({ query })
    );

    const result = await service.resubmitJournalEntryDraftForApproval(
      {
        organization_id: input.organization_id,
        draft_id: 'draft-1',
        priority: 'high'
      },
      actor,
      {
        requestId: 'request-7',
        correlationId: 'corr-7',
        idempotencyKey: 'idem-resubmit-1',
        toolName: 'resubmit_journal_entry_draft_for_approval'
      }
    );

    expect(result).toEqual(
      expect.objectContaining({
        draft_id: 'draft-1',
        draft_number: 'JE-000001',
        proposal_id: 'proposal-1',
        approval_request_id: 'approval-2',
        status: 'pending_approval',
        approval_status: 'pending',
        priority: 'high',
        current_approver_user_id: 'approver-2'
      })
    );
    expect(query).toHaveBeenCalledTimes(9);
  });

  it('rejects resubmission when the draft is not in validated state with a prior rejected approval', async () => {
    tenantAccessService.assertOrganizationAccess.mockResolvedValue(actorContext);

    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            draft_id: 'draft-1',
            draft_number: 'JE-000001',
            status: 'pending_approval',
            entry_date: '2026-04-23',
            memo: 'Utilities accrual revised',
            accounting_period_id: input.accounting_period_id,
            validation_summary: { valid: true },
            metadata: { source: 'test' },
            proposal_id: 'proposal-1',
            approval_request_id: 'approval-1',
            approval_status: 'pending',
            proposal_status: 'pending_approval'
          }
        ]
      });

    databaseService.withTransaction.mockImplementation(async (callback: (runner: { query: typeof query }) => unknown) =>
      callback({ query })
    );

    await expect(
      service.resubmitJournalEntryDraftForApproval(
        {
          organization_id: input.organization_id,
          draft_id: 'draft-1'
        },
        actor,
        {
          requestId: 'request-7',
          correlationId: 'corr-7',
          idempotencyKey: 'idem-resubmit-1',
          toolName: 'resubmit_journal_entry_draft_for_approval'
        }
      )
    ).rejects.toMatchObject({
      code: 'DRAFT_RESUBMISSION_INVALID_STATE'
    });
  });

  it('rejects approval submission when the draft is not validated', async () => {
    tenantAccessService.assertOrganizationAccess.mockResolvedValue(actorContext);

    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            draft_id: 'draft-1',
            draft_number: 'JE-000001',
            status: 'draft',
            entry_date: '2026-04-23',
            memo: 'Utilities accrual',
            accounting_period_id: input.accounting_period_id,
            validation_summary: { valid: true },
            metadata: { source: 'test' },
            proposal_id: 'proposal-1'
          }
        ]
      });

    databaseService.withTransaction.mockImplementation(async (callback: (runner: { query: typeof query }) => unknown) =>
      callback({ query })
    );

    await expect(
      service.submitJournalEntryDraftForApproval(
        {
          organization_id: input.organization_id,
          draft_id: 'draft-1'
        },
        actor,
        {
          requestId: 'request-2',
          correlationId: 'corr-2',
          idempotencyKey: 'idem-submit-1',
          toolName: 'submit_journal_entry_draft_for_approval'
        }
      )
    ).rejects.toMatchObject({
      code: 'DRAFT_SUBMISSION_INVALID_STATE'
    });
  });

  it('lists approval requests for an organization', async () => {
    tenantAccessService.assertOrganizationAccess.mockResolvedValue(actorContext);
    databaseService.query.mockResolvedValueOnce({
      rows: [
        {
          approval_request_id: 'approval-1',
          status: 'pending',
          priority: 'high',
          action_type: 'ledger.journal_draft.submitted_for_approval',
          target_entity_type: 'journal_entry_draft',
          target_entity_id: 'draft-1',
          submitted_at: '2026-04-23T10:00:00.000Z',
          submitted_by_actor_type: 'agent',
          submitted_by_actor_id: 'test-agent-client',
          submitted_by_user_id: actorContext.appUserId,
          current_approver_user_id: null,
          expires_at: null,
          resolved_at: null,
          resolved_by_user_id: null,
          resolution_reason: null,
          metadata: {},
          draft_number: 'JE-000001',
          draft_status: 'pending_approval',
          proposal_id: 'proposal-1',
          proposal_status: 'pending_approval'
        }
      ]
    });

    const result = await service.listApprovalRequests(
      {
        organization_id: input.organization_id,
        status: 'pending',
        limit: 10
      },
      actor
    );

    expect(result).toEqual(
      expect.objectContaining({
        organization_id: input.organization_id,
        filters: { status: 'pending', limit: 10 }
      })
    );
    expect(result.items).toEqual([
      expect.objectContaining({
        approval_request_id: 'approval-1',
        target: expect.objectContaining({
          draft_number: 'JE-000001',
          proposal_status: 'pending_approval'
        })
      })
    ]);
  });

  it('lists approval requests assigned to the delegated actor', async () => {
    tenantAccessService.assertOrganizationAccess.mockResolvedValue(actorContext);
    databaseService.query.mockResolvedValueOnce({
      rows: [
        {
          approval_request_id: 'approval-1',
          status: 'pending',
          priority: 'high',
          action_type: 'ledger.journal_draft.submitted_for_approval',
          target_entity_type: 'journal_entry_draft',
          target_entity_id: 'draft-1',
          submitted_at: '2026-04-23T10:00:00.000Z',
          submitted_by_actor_type: 'agent',
          submitted_by_actor_id: 'test-agent-client',
          submitted_by_user_id: actorContext.appUserId,
          current_approver_user_id: actorContext.appUserId,
          expires_at: null,
          resolved_at: null,
          resolved_by_user_id: null,
          resolution_reason: null,
          policy_snapshot: {
            route_status: 'assigned'
          },
          metadata: {},
          draft_number: 'JE-000001',
          draft_status: 'pending_approval',
          proposal_id: 'proposal-1',
          proposal_status: 'pending_approval'
        }
      ]
    });

    const result = await service.listAssignedApprovalRequests(
      {
        organization_id: input.organization_id
      },
      actor
    );

    expect(result).toEqual(
      expect.objectContaining({
        assigned_user_id: actorContext.appUserId,
        filters: { status: 'pending', limit: 20 }
      })
    );
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        approval_request_id: 'approval-1',
        current_approver_user_id: actorContext.appUserId
      })
    );
  });

  it('returns one approval request with action history', async () => {
    tenantAccessService.assertOrganizationAccess.mockResolvedValue(actorContext);
    databaseService.query
      .mockResolvedValueOnce({
        rows: [
          {
            approval_request_id: 'approval-1',
            status: 'pending',
            priority: 'high',
            action_type: 'ledger.journal_draft.submitted_for_approval',
            target_entity_type: 'journal_entry_draft',
            target_entity_id: 'draft-1',
            submitted_at: '2026-04-23T10:00:00.000Z',
            submitted_by_actor_type: 'agent',
            submitted_by_actor_id: 'test-agent-client',
            submitted_by_user_id: actorContext.appUserId,
            current_approver_user_id: null,
            expires_at: null,
            resolved_at: null,
            resolved_by_user_id: null,
            resolution_reason: null,
            metadata: {},
            draft_number: 'JE-000001',
            draft_status: 'pending_approval',
            proposal_id: 'proposal-1',
            proposal_status: 'pending_approval'
          }
        ]
      })
      .mockResolvedValueOnce({
        rows: [
          {
            approval_action_id: 'action-1',
            action: 'submitted',
            action_timestamp: '2026-04-23T10:00:00.000Z',
            actor_type: 'agent',
            actor_id: 'test-agent-client',
            actor_display_name: 'test-agent',
            user_id: actorContext.appUserId,
            decision_reason: null,
            comments: null,
            request_id: 'request-2',
            correlation_id: 'corr-2',
            idempotency_key: 'idem-submit-1',
            metadata: {}
          }
        ]
      });

    const result = await service.getApprovalRequest(
      {
        organization_id: input.organization_id,
        approval_request_id: 'approval-1'
      },
      actor
    );

    expect(result).toEqual(
      expect.objectContaining({
        approval_request_id: 'approval-1',
        target: expect.objectContaining({
          draft_number: 'JE-000001',
          proposal_id: 'proposal-1'
        })
      })
    );
    expect(result.actions).toHaveLength(1);
  });

  it('escalates a pending approval request to a firm-level fallback reviewer', async () => {
    tenantAccessService.assertOrganizationAccess.mockResolvedValue(actorContext);

    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            approval_request_id: 'approval-1',
            status: 'pending',
            priority: 'high',
            action_type: 'ledger.journal_draft.submitted_for_approval',
            target_entity_type: 'journal_entry_draft',
            target_entity_id: 'draft-1',
            submitted_at: '2026-04-23T10:00:00.000Z',
            submitted_by_actor_type: 'agent',
            submitted_by_actor_id: 'test-agent-client',
            submitted_by_user_id: 'submitter-1',
            current_approver_user_id: 'reviewer-1',
            expires_at: null,
            resolved_at: null,
            resolved_by_user_id: null,
            resolution_reason: null,
            policy_snapshot: {
              route_status: 'assigned',
              assigned_approver_user_id: 'reviewer-1'
            },
            metadata: {},
            draft_number: 'JE-000001',
            draft_status: 'pending_approval',
            proposal_id: 'proposal-1',
            proposal_status: 'pending_approval'
          }
        ]
      })
      .mockResolvedValueOnce({
        rows: [
          {
            user_id: 'firm-owner-1',
            role: 'firm_owner',
            scope: 'firm',
            rank: 1
          }
        ]
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    databaseService.withTransaction.mockImplementation(async (callback: (runner: { query: typeof query }) => unknown) =>
      callback({ query })
    );

    const result = await service.escalateApprovalRequest(
      {
        organization_id: input.organization_id,
        approval_request_id: 'approval-1',
        reason: 'Primary reviewer unavailable'
      },
      actor,
      {
        requestId: 'request-8',
        correlationId: 'corr-8',
        idempotencyKey: 'idem-escalate-1',
        toolName: 'escalate_approval_request'
      }
    );

    expect(result).toEqual(
      expect.objectContaining({
        approval_request_id: 'approval-1',
        previous_approver_user_id: 'reviewer-1',
        current_approver_user_id: 'firm-owner-1',
        escalation_reason: 'Primary reviewer unavailable'
      })
    );
    expect(query).toHaveBeenCalledTimes(7);
  });

  it('resolves a pending approval request and updates linked draft and proposal state', async () => {
    tenantAccessService.assertOrganizationAccess.mockResolvedValue(actorContext);

    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            approval_request_id: 'approval-1',
            status: 'pending',
            priority: 'high',
            action_type: 'ledger.journal_draft.submitted_for_approval',
            target_entity_type: 'journal_entry_draft',
            target_entity_id: 'draft-1',
            submitted_at: '2026-04-23T10:00:00.000Z',
            submitted_by_actor_type: 'agent',
            submitted_by_actor_id: 'test-agent-client',
            submitted_by_user_id: actorContext.appUserId,
            current_approver_user_id: null,
            expires_at: null,
            resolved_at: null,
            resolved_by_user_id: null,
            resolution_reason: null,
            metadata: {},
            draft_number: 'JE-000001',
            draft_status: 'pending_approval',
            proposal_id: 'proposal-1',
            proposal_status: 'pending_approval'
          }
        ]
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    databaseService.withTransaction.mockImplementation(async (callback: (runner: { query: typeof query }) => unknown) =>
      callback({ query })
    );

    const result = await service.resolveApprovalRequest(
      {
        organization_id: input.organization_id,
        approval_request_id: 'approval-1',
        resolution: 'approved',
        reason: 'Threshold review complete'
      },
      actor,
      {
        requestId: 'request-3',
        correlationId: 'corr-3',
        idempotencyKey: 'idem-resolve-1',
        toolName: 'resolve_approval_request'
      }
    );

    expect(result).toEqual(
      expect.objectContaining({
        approval_request_id: 'approval-1',
        draft_id: 'draft-1',
        draft_number: 'JE-000001',
        proposal_id: 'proposal-1',
        status: 'approved',
        draft_status: 'approved',
        proposal_status: 'approved',
        resolution_reason: 'Threshold review complete'
      })
    );
    expect(query).toHaveBeenCalledTimes(8);
  });

  it('rejects approval resolution when the request is not pending', async () => {
    tenantAccessService.assertOrganizationAccess.mockResolvedValue(actorContext);

    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            approval_request_id: 'approval-1',
            status: 'approved',
            priority: 'high',
            action_type: 'ledger.journal_draft.submitted_for_approval',
            target_entity_type: 'journal_entry_draft',
            target_entity_id: 'draft-1',
            submitted_at: '2026-04-23T10:00:00.000Z',
            submitted_by_actor_type: 'agent',
            submitted_by_actor_id: 'test-agent-client',
            submitted_by_user_id: actorContext.appUserId,
            current_approver_user_id: null,
            expires_at: null,
            resolved_at: '2026-04-23T11:00:00.000Z',
            resolved_by_user_id: actorContext.appUserId,
            resolution_reason: 'Done',
            metadata: {},
            draft_number: 'JE-000001',
            draft_status: 'approved',
            proposal_id: 'proposal-1',
            proposal_status: 'approved'
          }
        ]
      });

    databaseService.withTransaction.mockImplementation(async (callback: (runner: { query: typeof query }) => unknown) =>
      callback({ query })
    );

    await expect(
      service.resolveApprovalRequest(
        {
          organization_id: input.organization_id,
          approval_request_id: 'approval-1',
          resolution: 'approved'
        },
        actor,
        {
          requestId: 'request-3',
          correlationId: 'corr-3',
          idempotencyKey: 'idem-resolve-1',
          toolName: 'resolve_approval_request'
        }
      )
    ).rejects.toMatchObject({
      code: 'APPROVAL_REQUEST_INVALID_STATE'
    });
  });

  it('rejects approval resolution when the current actor is not the assigned approver and lacks firm override access', async () => {
    tenantAccessService.assertOrganizationAccess.mockResolvedValue({
      ...actorContext,
      firmRole: 'firm_staff'
    });

    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            approval_request_id: 'approval-1',
            status: 'pending',
            priority: 'high',
            action_type: 'ledger.journal_draft.submitted_for_approval',
            target_entity_type: 'journal_entry_draft',
            target_entity_id: 'draft-1',
            submitted_at: '2026-04-23T10:00:00.000Z',
            submitted_by_actor_type: 'agent',
            submitted_by_actor_id: 'test-agent-client',
            submitted_by_user_id: actorContext.appUserId,
            current_approver_user_id: 'another-approver',
            expires_at: null,
            resolved_at: null,
            resolved_by_user_id: null,
            resolution_reason: null,
            policy_snapshot: {
              route_status: 'assigned'
            },
            metadata: {},
            draft_number: 'JE-000001',
            draft_status: 'pending_approval',
            proposal_id: 'proposal-1',
            proposal_status: 'pending_approval'
          }
        ]
      });

    databaseService.withTransaction.mockImplementation(async (callback: (runner: { query: typeof query }) => unknown) =>
      callback({ query })
    );

    await expect(
      service.resolveApprovalRequest(
        {
          organization_id: input.organization_id,
          approval_request_id: 'approval-1',
          resolution: 'approved'
        },
        actor,
        {
          requestId: 'request-3',
          correlationId: 'corr-3',
          idempotencyKey: 'idem-resolve-1',
          toolName: 'resolve_approval_request'
        }
      )
    ).rejects.toMatchObject({
      code: 'APPROVAL_ASSIGNMENT_REQUIRED'
    });
  });

  it('posts an approved journal draft and updates linked proposal state', async () => {
    tenantAccessService.assertOrganizationAccess.mockResolvedValue(actorContext);

    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            draft_id: 'draft-1',
            draft_number: 'JE-000001',
            status: 'approved',
            entry_date: '2026-04-23',
            memo: 'Utilities accrual',
            source_type: 'manual_adjustment',
            source_id: 'request-1',
            accounting_period_id: input.accounting_period_id,
            approval_request_id: 'approval-1',
            approval_status: 'approved',
            proposal_id: 'proposal-1'
          }
        ]
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'line-1',
            line_number: 1,
            account_id: input.lines[0].account_id,
            account_code: '5000',
            account_name: 'Operating Expense',
            description: null,
            debit: '100.00',
            credit: '0.00'
          },
          {
            id: 'line-2',
            line_number: 2,
            account_id: input.lines[1].account_id,
            account_code: '2000',
            account_name: 'Accounts Payable',
            description: null,
            debit: '0.00',
            credit: '100.00'
          }
        ]
      })
      .mockResolvedValueOnce({
        rows: [
          {
            journal_entry_id: 'entry-1',
            entry_number: 'JE-000001',
            posted_at: '2026-04-23T12:00:00.000Z'
          }
        ]
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    databaseService.withTransaction.mockImplementation(async (callback: (runner: { query: typeof query }) => unknown) =>
      callback({ query })
    );

    const result = await service.postApprovedJournalEntry(
      {
        organization_id: input.organization_id,
        draft_id: 'draft-1'
      },
      actor,
      {
        requestId: 'request-4',
        correlationId: 'corr-4',
        idempotencyKey: 'idem-post-1',
        toolName: 'post_approved_journal_entry'
      }
    );

    expect(result).toEqual(
      expect.objectContaining({
        draft_id: 'draft-1',
        journal_entry_id: 'entry-1',
        entry_number: 'JE-000001',
        proposal_id: 'proposal-1',
        status: 'posted',
        draft_status: 'posted',
        proposal_status: 'posted',
        line_count: 2
      })
    );
    expect(query).toHaveBeenCalledTimes(10);
  });

  it('replays a succeeded posted journal entry response when the same payload is retried', async () => {
    tenantAccessService.assertOrganizationAccess.mockResolvedValue(actorContext);

    const replayedResponse = {
      journal_entry_id: 'entry-1',
      entry_number: 'JE-000001',
      status: 'posted'
    };
    const requestHash = (service as unknown as { hashRequestPayload: (value: { organization_id: string; draft_id: string }) => string }).hashRequestPayload(
      {
        organization_id: input.organization_id,
        draft_id: 'draft-1'
      }
    );

    const query = jest.fn().mockResolvedValueOnce({
      rows: [
        {
          request_hash: requestHash,
          status: 'succeeded',
          response_body: replayedResponse
        }
      ]
    });

    databaseService.withTransaction.mockImplementation(async (callback: (runner: { query: typeof query }) => unknown) =>
      callback({ query })
    );

    const result = await service.postApprovedJournalEntry(
      {
        organization_id: input.organization_id,
        draft_id: 'draft-1'
      },
      actor,
      {
        requestId: 'request-4',
        correlationId: 'corr-4',
        idempotencyKey: 'idem-post-1',
        toolName: 'post_approved_journal_entry'
      }
    );

    expect(result).toBe(replayedResponse);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('rejects posting when the draft is not approved', async () => {
    tenantAccessService.assertOrganizationAccess.mockResolvedValue(actorContext);

    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            draft_id: 'draft-1',
            draft_number: 'JE-000001',
            status: 'pending_approval',
            entry_date: '2026-04-23',
            memo: 'Utilities accrual',
            source_type: 'manual_adjustment',
            source_id: 'request-1',
            accounting_period_id: input.accounting_period_id,
            approval_request_id: 'approval-1',
            approval_status: 'pending',
            proposal_id: 'proposal-1'
          }
        ]
      });

    databaseService.withTransaction.mockImplementation(async (callback: (runner: { query: typeof query }) => unknown) =>
      callback({ query })
    );

    await expect(
      service.postApprovedJournalEntry(
        {
          organization_id: input.organization_id,
          draft_id: 'draft-1'
        },
        actor,
        {
          requestId: 'request-4',
          correlationId: 'corr-4',
          idempotencyKey: 'idem-post-1',
          toolName: 'post_approved_journal_entry'
        }
      )
    ).rejects.toMatchObject({
      code: 'DRAFT_POST_INVALID_STATE'
    });
  });

  it('creates a reversal journal entry and immutable reversal linkage for a posted journal entry', async () => {
    tenantAccessService.assertOrganizationAccess.mockResolvedValue(actorContext);

    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            journal_entry_id: 'entry-1',
            entry_number: 'JE-000001',
            entry_date: '2026-04-23',
            memo: 'Utilities accrual',
            source_type: 'manual_adjustment',
            source_id: 'request-1',
            status: 'posted',
            accounting_period_id: input.accounting_period_id,
            reversal_of_journal_entry_id: null,
            reversal_record_id: null,
            reversal_journal_entry_id: null
          }
        ]
      })
      .mockResolvedValueOnce({
        rows: [
          {
            accounting_period_id: input.accounting_period_id
          }
        ]
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'posted-line-1',
            line_number: 1,
            account_id: input.lines[0].account_id,
            description: null,
            debit: '100.00',
            credit: '0.00',
            dimensions: {},
            metadata: {}
          },
          {
            id: 'posted-line-2',
            line_number: 2,
            account_id: input.lines[1].account_id,
            description: null,
            debit: '0.00',
            credit: '100.00',
            dimensions: {},
            metadata: {}
          }
        ]
      })
      .mockResolvedValueOnce({ rows: [{ prefix: 'JE', allocated_value: 2, padding_width: 6 }] })
      .mockResolvedValueOnce({
        rows: [
          {
            journal_entry_id: 'entry-2',
            entry_number: 'JE-000002',
            posted_at: '2026-04-24T09:00:00.000Z'
          }
        ]
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            journal_entry_reversal_id: 'reversal-1'
          }
        ]
      })
      .mockResolvedValueOnce({ rows: [] });

    databaseService.withTransaction.mockImplementation(async (callback: (runner: { query: typeof query }) => unknown) =>
      callback({ query })
    );

    const result = await service.reversePostedJournalEntry(
      reversalInput,
      actor,
      {
        requestId: 'request-5',
        correlationId: 'corr-5',
        idempotencyKey: 'idem-reverse-1',
        toolName: 'reverse_posted_journal_entry'
      }
    );

    expect(result).toEqual(
      expect.objectContaining({
        original_journal_entry_id: 'entry-1',
        original_entry_number: 'JE-000001',
        reversal_journal_entry_id: 'entry-2',
        reversal_entry_number: 'JE-000002',
        journal_entry_reversal_id: 'reversal-1',
        status: 'reversed',
        reversal_status: 'posted',
        reason: 'Customer invoice voided',
        line_count: 2
      })
    );
    expect(query).toHaveBeenCalledTimes(11);
  });

  it('replays a succeeded reversal response when the same payload is retried', async () => {
    tenantAccessService.assertOrganizationAccess.mockResolvedValue(actorContext);

    const replayedResponse = {
      reversal_journal_entry_id: 'entry-2',
      reversal_entry_number: 'JE-000002',
      status: 'reversed'
    };
    const requestHash = (
      service as unknown as { hashRequestPayload: (value: typeof reversalInput) => string }
    ).hashRequestPayload(reversalInput);

    const query = jest.fn().mockResolvedValueOnce({
      rows: [
        {
          request_hash: requestHash,
          status: 'succeeded',
          response_body: replayedResponse
        }
      ]
    });

    databaseService.withTransaction.mockImplementation(async (callback: (runner: { query: typeof query }) => unknown) =>
      callback({ query })
    );

    const result = await service.reversePostedJournalEntry(
      reversalInput,
      actor,
      {
        requestId: 'request-5',
        correlationId: 'corr-5',
        idempotencyKey: 'idem-reverse-1',
        toolName: 'reverse_posted_journal_entry'
      }
    );

    expect(result).toBe(replayedResponse);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('rejects reversal when the journal entry has already been reversed', async () => {
    tenantAccessService.assertOrganizationAccess.mockResolvedValue(actorContext);

    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            journal_entry_id: 'entry-1',
            entry_number: 'JE-000001',
            entry_date: '2026-04-23',
            memo: 'Utilities accrual',
            source_type: 'manual_adjustment',
            source_id: 'request-1',
            status: 'posted',
            accounting_period_id: input.accounting_period_id,
            reversal_of_journal_entry_id: null,
            reversal_record_id: 'reversal-1',
            reversal_journal_entry_id: 'entry-2'
          }
        ]
      });

    databaseService.withTransaction.mockImplementation(async (callback: (runner: { query: typeof query }) => unknown) =>
      callback({ query })
    );

    await expect(
      service.reversePostedJournalEntry(
        reversalInput,
        actor,
        {
          requestId: 'request-5',
          correlationId: 'corr-5',
          idempotencyKey: 'idem-reverse-1',
          toolName: 'reverse_posted_journal_entry'
        }
      )
    ).rejects.toMatchObject({
      code: 'REVERSAL_NOT_ALLOWED'
    });
  });

  it('rejects reversal when the original journal entry is not posted', async () => {
    tenantAccessService.assertOrganizationAccess.mockResolvedValue(actorContext);

    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            journal_entry_id: 'entry-1',
            entry_number: 'JE-000001',
            entry_date: '2026-04-23',
            memo: 'Utilities accrual',
            source_type: 'manual_adjustment',
            source_id: 'request-1',
            status: 'reversed',
            accounting_period_id: input.accounting_period_id,
            reversal_of_journal_entry_id: null,
            reversal_record_id: null,
            reversal_journal_entry_id: null
          }
        ]
      });

    databaseService.withTransaction.mockImplementation(async (callback: (runner: { query: typeof query }) => unknown) =>
      callback({ query })
    );

    await expect(
      service.reversePostedJournalEntry(
        reversalInput,
        actor,
        {
          requestId: 'request-5',
          correlationId: 'corr-5',
          idempotencyKey: 'idem-reverse-1',
          toolName: 'reverse_posted_journal_entry'
        }
      )
    ).rejects.toMatchObject({
      code: 'REVERSAL_NOT_ALLOWED'
    });
  });
});
