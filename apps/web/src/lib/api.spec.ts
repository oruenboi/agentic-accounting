import { afterEach, describe, expect, it, vi } from 'vitest';
import { executeTool, OperatorApiError } from './api';
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
