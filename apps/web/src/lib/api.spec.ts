import { afterEach, describe, expect, it, vi } from 'vitest';
import { executeTool, getTrialBalanceReport, OperatorApiError } from './api';
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
