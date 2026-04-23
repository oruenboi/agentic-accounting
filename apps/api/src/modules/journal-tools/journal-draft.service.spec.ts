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
});
