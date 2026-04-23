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
            approval_request_id: 'approval-1',
            status: 'pending',
            priority: 'high',
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
        priority: 'high'
      })
    );
    expect(query).toHaveBeenCalledTimes(8);
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
});
