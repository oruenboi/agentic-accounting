import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createScheduleDefinition,
  executeTool,
  generateScheduleRun,
  getScheduleRun,
  getTrialBalanceReport,
  listScheduleDefinitions,
  listScheduleRuns,
  OperatorApiError
} from './api';
import type { OperatorSession } from './session';

const session: OperatorSession = {
  apiBaseUrl: 'https://api.example.com',
  bearerToken: 'token',
  organizationId: 'org-1'
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('executeTool', () => {
  it('returns the tool result when the envelope succeeds', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          tool: 'list_agent_proposals',
          request_id: 'request-1',
          result: { items: [{ proposal_id: 'proposal-1' }] },
          errors: []
        })
      })
    );

    await expect(executeTool(session, 'list_agent_proposals', { organization_id: 'org-1' })).resolves.toEqual({
      items: [{ proposal_id: 'proposal-1' }]
    });
  });

  it('throws an operator error when the tool envelope fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: false,
          tool: 'resolve_approval_request',
          request_id: 'request-2',
          result: null,
          errors: [{ code: 'APPROVAL_ASSIGNMENT_REQUIRED', message: 'Assignment required.' }]
        })
      })
    );

    await expect(
      executeTool(session, 'resolve_approval_request', { organization_id: 'org-1', approval_request_id: 'approval-1' })
    ).rejects.toEqual(expect.objectContaining<Partial<OperatorApiError>>({ code: 'APPROVAL_ASSIGNMENT_REQUIRED' }));
  });
});

describe('getTrialBalanceReport', () => {
  it('calls the report endpoint with organization and date filters', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        request_id: 'request-3',
        timestamp: '2026-04-27T00:00:00.000Z',
        result: {
          organization_id: 'org-1',
          as_of_date: '2026-04-27',
          items: [
            {
              account_id: 'account-1',
              account_code: '1000',
              account_name: 'Cash',
              account_type: 'asset',
              account_subtype: 'cash',
              debit_balance: '100.00',
              credit_balance: '0.00',
              net_balance: '100.00'
            }
          ]
        }
      })
    });

    vi.stubGlobal('fetch', fetchMock);

    await expect(getTrialBalanceReport(session, { asOfDate: '2026-04-27', includeZeroBalances: true })).resolves.toEqual({
      organizationId: 'org-1',
      asOfDate: '2026-04-27',
      fromDate: undefined,
      toDate: undefined,
      actorContext: undefined,
      items: [
        {
          accountId: 'account-1',
          accountCode: '1000',
          accountName: 'Cash',
          accountType: 'asset',
          accountSubtype: 'cash',
          debitBalance: '100.00',
          creditBalance: '0.00',
          netBalance: '100.00'
        }
      ]
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/api/v1/reports/trial-balance?organization_id=org-1&as_of_date=2026-04-27&include_zero_balances=true',
      {
        headers: {
          Authorization: 'Bearer token'
        }
      }
    );
  });
});

describe('schedule helpers', () => {
  it('lists schedule definitions from the schedules API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        request_id: 'request-7',
        timestamp: '2026-04-27T00:00:00.000Z',
        result: {
          organization_id: 'org-1',
          items: [
            {
              schedule_definition_id: 'definition-1',
              firm_id: 'firm-1',
              organization_id: 'org-1',
              schedule_type: 'accounts_payable',
              name: 'Trade payables',
              gl_account_ids: ['account-1'],
              generation_strategy: 'ledger_derived',
              is_active: true,
              accounts: [{ account_id: 'account-1', code: '2000', name: 'Accounts Payable' }]
            }
          ]
        }
      })
    });

    vi.stubGlobal('fetch', fetchMock);

    await expect(listScheduleDefinitions(session, { scheduleType: 'accounts_payable', isActive: true, limit: 10 })).resolves.toEqual([
      expect.objectContaining({
        scheduleDefinitionId: 'definition-1',
        name: 'Trade payables',
        scheduleType: 'accounts_payable',
        glAccountIds: ['account-1'],
        accounts: [expect.objectContaining({ accountId: 'account-1', code: '2000' })]
      })
    ]);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/api/v1/schedules/definitions?organization_id=org-1&schedule_type=accounts_payable&is_active=true&limit=10',
      {
        headers: {
          Authorization: 'Bearer token'
        }
      }
    );
  });

  it('creates a schedule definition through the schedules API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        request_id: 'request-8',
        timestamp: '2026-04-27T00:00:00.000Z',
        result: {
          schedule_definition_id: 'definition-1',
          firm_id: 'firm-1',
          organization_id: 'org-1',
          schedule_type: 'accounts_payable',
          name: 'Trade payables',
          gl_account_ids: ['account-1'],
          generation_strategy: 'ledger_derived',
          is_active: true
        }
      })
    });

    vi.stubGlobal('fetch', fetchMock);

    await expect(
      createScheduleDefinition(session, {
        scheduleType: 'accounts_payable',
        name: 'Trade payables',
        glAccountIds: ['account-1']
      })
    ).resolves.toEqual(expect.objectContaining({ scheduleDefinitionId: 'definition-1', generationStrategy: 'ledger_derived' }));

    expect(fetchMock).toHaveBeenCalledWith('https://api.example.com/api/v1/schedules/definitions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        organization_id: 'org-1',
        schedule_type: 'accounts_payable',
        name: 'Trade payables',
        gl_account_ids: ['account-1']
      })
    });
  });

  it('lists schedule runs from the schedules API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        request_id: 'request-4',
        timestamp: '2026-04-27T00:00:00.000Z',
        result: {
          organization_id: 'org-1',
          items: [
            {
              schedule_run_id: 'run-1',
              organization_id: 'org-1',
              schedule_definition_id: 'definition-1',
              schedule_name: 'Bank schedule',
              schedule_type: 'bank',
              as_of_date: '2026-04-30',
              status: 'reconciled',
              gl_balance: '100.00',
              schedule_total: '100.00',
              variance: '0.00'
            }
          ]
        }
      })
    });

    vi.stubGlobal('fetch', fetchMock);

    await expect(listScheduleRuns(session, { scheduleType: 'bank', status: 'reconciled', limit: 10 })).resolves.toEqual([
      expect.objectContaining({
        scheduleRunId: 'run-1',
        scheduleName: 'Bank schedule',
        scheduleType: 'bank',
        status: 'reconciled',
        variance: '0.00'
      })
    ]);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/api/v1/schedules/runs?organization_id=org-1&schedule_type=bank&status=reconciled&limit=10',
      {
        headers: {
          Authorization: 'Bearer token'
        }
      }
    );
  });

  it('loads one schedule run with rows', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          request_id: 'request-5',
          timestamp: '2026-04-27T00:00:00.000Z',
          result: {
            schedule_run_id: 'run-1',
            organization_id: 'org-1',
            schedule_definition_id: 'definition-1',
            schedule_type: 'bank',
            as_of_date: '2026-04-30',
            status: 'generated',
            gl_balance: '100.00',
            schedule_total: '95.00',
            variance: '5.00',
            gl_account_ids: ['account-1'],
            rows: [
              {
                schedule_run_row_id: 'row-1',
                row_order: 1,
                closing_amount: '95.00'
              }
            ]
          }
        })
      })
    );

    await expect(getScheduleRun(session, 'run-1')).resolves.toEqual(
      expect.objectContaining({
        scheduleRunId: 'run-1',
        glAccountIds: ['account-1'],
        rows: [expect.objectContaining({ scheduleRunRowId: 'row-1', closingAmount: '95.00' })]
      })
    );
  });

  it('generates a schedule run through the schedules API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        request_id: 'request-6',
        timestamp: '2026-04-27T00:00:00.000Z',
        result: {
          schedule_run_id: 'run-1',
          organization_id: 'org-1',
          schedule_definition_id: 'definition-1',
          schedule_name: 'Accruals',
          schedule_type: 'accruals',
          as_of_date: '2026-04-30',
          status: 'reconciled',
          gl_balance: '-250.00',
          schedule_total: '-250.00',
          variance: '0.00'
        }
      })
    });

    vi.stubGlobal('fetch', fetchMock);

    await expect(generateScheduleRun(session, { scheduleType: 'accruals', asOfDate: '2026-04-30' })).resolves.toEqual(
      expect.objectContaining({
        scheduleRunId: 'run-1',
        scheduleType: 'accruals',
        status: 'reconciled'
      })
    );

    expect(fetchMock).toHaveBeenCalledWith('https://api.example.com/api/v1/schedules/runs', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        organization_id: 'org-1',
        schedule_type: 'accruals',
        as_of_date: '2026-04-30'
      })
    });
  });
});
