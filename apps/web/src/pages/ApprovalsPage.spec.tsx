import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ApprovalsPage } from './ApprovalsPage';
import { OperatorSessionProvider } from '../session/OperatorSessionContext';
import * as api from '../lib/api';
import { SESSION_STORAGE_KEY } from '../lib/session';

describe('ApprovalsPage', () => {
  it('renders approval queue rows from the tool client', async () => {
    window.localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        apiBaseUrl: 'https://api.example.com',
        bearerToken: 'token',
        organizationId: 'org-1'
      })
    );

    vi.spyOn(api, 'listApprovalRequests').mockResolvedValue([
      {
        approvalRequestId: 'approval-1',
        organizationId: 'org-1',
        targetEntityType: 'journal_entry_draft',
        targetEntityId: 'draft-1',
        draftNumber: 'JE-000001',
        title: 'Revenue recognition review',
        status: 'pending',
        priority: 'high',
        currentApproverUserId: 'user-1',
        submittedAt: '2026-04-23T07:20:14.118Z'
      }
    ]);

    render(
      <MemoryRouter>
        <OperatorSessionProvider>
          <ApprovalsPage />
        </OperatorSessionProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('JE-000001')).toBeInTheDocument();
    });

    expect(screen.getByText('Revenue recognition review')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
  });
});
