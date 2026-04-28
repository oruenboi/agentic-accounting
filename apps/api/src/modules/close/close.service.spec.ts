import { CloseService } from './close.service';
import type { AuthenticatedActor } from '../auth/authenticated-request.interface';

describe('CloseService', () => {
  const actor: AuthenticatedActor = {
    actorType: 'user',
    authUserId: '11111111-1111-4111-8111-111111111111',
    email: 'operator@example.com'
  };

  const actorContext = {
    appUserId: 'user-1',
    authUserId: actor.authUserId,
    organizationRole: 'accountant',
    firmRole: null,
    firmId: 'firm-1'
  };

  const databaseService = {
    query: jest.fn()
  };

  const tenantAccessService = {
    assertOrganizationAccess: jest.fn()
  };

  let service: CloseService;

  beforeEach(() => {
    jest.resetAllMocks();
    tenantAccessService.assertOrganizationAccess.mockResolvedValue(actorContext);
    service = new CloseService(databaseService as never, tenantAccessService as never);
  });

  it('returns a close overview after asserting organization access', async () => {
    databaseService.query
      .mockResolvedValueOnce({ rows: [{ total_count: '3', approval_request_id: 'approval-1', status: 'pending' }] })
      .mockResolvedValueOnce({ rows: [{ total_count: '2', proposal_id: 'proposal-1', status: 'needs_review' }] })
      .mockResolvedValueOnce({ rows: [{ total_count: '4', schedule_run_id: 'schedule-1', reconciliation_status: 'unreviewed' }] })
      .mockResolvedValueOnce({ rows: [{ total_count: '5', journal_entry_id: 'entry-1', status: 'posted' }] });

    await expect(
      service.getOverview(
        {
          organization_id: '550e8400-e29b-41d4-a716-446655440000',
          as_of_date: '2026-04-30',
          limit: 5
        },
        actor
      )
    ).resolves.toEqual({
      organization_id: '550e8400-e29b-41d4-a716-446655440000',
      as_of_date: '2026-04-30',
      actor_context: actorContext,
      counts: {
        pending_approvals: 3,
        open_proposals: 2,
        schedule_blockers: 4,
        recent_entries: 5
      },
      pending_approvals: [{ approval_request_id: 'approval-1', status: 'pending' }],
      open_proposals: [{ proposal_id: 'proposal-1', status: 'needs_review' }],
      schedule_blockers: [{ schedule_run_id: 'schedule-1', reconciliation_status: 'unreviewed' }],
      recent_entries: [{ journal_entry_id: 'entry-1', status: 'posted' }]
    });

    expect(tenantAccessService.assertOrganizationAccess).toHaveBeenCalledWith(actor, '550e8400-e29b-41d4-a716-446655440000');
    expect(databaseService.query).toHaveBeenCalledTimes(4);
    expect(databaseService.query).toHaveBeenNthCalledWith(3, expect.stringContaining('from public.schedule_runs sr'), [
      '550e8400-e29b-41d4-a716-446655440000',
      '2026-04-30',
      5
    ]);
  });
});
