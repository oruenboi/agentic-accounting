import { ConflictException } from '@nestjs/common';
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
    query: jest.fn(),
    withTransaction: jest.fn()
  };

  const tenantAccessService = {
    assertOrganizationAccess: jest.fn()
  };

  let service: CloseService;

  beforeEach(() => {
    jest.resetAllMocks();
    tenantAccessService.assertOrganizationAccess.mockResolvedValue(actorContext);
    databaseService.withTransaction.mockImplementation(async (callback) => callback({ query: databaseService.query }));
    service = new CloseService(databaseService as never, tenantAccessService as never);
  });

  it('returns a close overview with the current period after asserting organization access', async () => {
    databaseService.query
      .mockResolvedValueOnce({
        rows: [
          {
            period_id: 'period-1',
            name: 'Apr 2026',
            period_start: '2026-04-01',
            period_end: '2026-04-30',
            status: 'open',
            closed_at: null,
            closed_by_user_id: null,
            reopened_at: null,
            reopened_by_user_id: null
          }
        ]
      })
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
      period: {
        period_id: 'period-1',
        name: 'Apr 2026',
        period_start: '2026-04-01',
        period_end: '2026-04-30',
        status: 'open',
        closed_at: null,
        closed_by_user_id: null,
        reopened_at: null,
        reopened_by_user_id: null
      },
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
    expect(databaseService.query).toHaveBeenCalledTimes(5);
    expect(databaseService.query).toHaveBeenNthCalledWith(1, expect.stringContaining('from public.accounting_periods'), [
      '550e8400-e29b-41d4-a716-446655440000',
      'firm-1',
      '2026-04-30'
    ]);
    expect(databaseService.query).toHaveBeenNthCalledWith(4, expect.stringContaining('from public.schedule_runs sr'), [
      '550e8400-e29b-41d4-a716-446655440000',
      '2026-04-30',
      5
    ]);
  });

  it('starts review for an open period', async () => {
    databaseService.query
      .mockResolvedValueOnce({
        rows: [{ period_id: 'period-1', name: 'Apr 2026', period_start: '2026-04-01', period_end: '2026-04-30', status: 'open' }]
      })
      .mockResolvedValueOnce({
        rows: [{ period_id: 'period-1', name: 'Apr 2026', period_start: '2026-04-01', period_end: '2026-04-30', status: 'pre_close_review' }]
      });

    await expect(
      service.startPeriodReview('period-1', { organization_id: '550e8400-e29b-41d4-a716-446655440000' }, actor)
    ).resolves.toEqual({
      period: {
        period_id: 'period-1',
        name: 'Apr 2026',
        period_start: '2026-04-01',
        period_end: '2026-04-30',
        status: 'pre_close_review'
      },
      actor_context: actorContext
    });

    expect(databaseService.query).toHaveBeenNthCalledWith(2, expect.stringContaining("set status = 'pre_close_review'"), [
      'period-1',
      '550e8400-e29b-41d4-a716-446655440000',
      'firm-1'
    ]);
  });

  it('rejects closing while blockers remain', async () => {
    databaseService.query
      .mockResolvedValueOnce({
        rows: [
          {
            period_id: 'period-1',
            name: 'Apr 2026',
            period_start: '2026-04-01',
            period_end: '2026-04-30',
            status: 'pre_close_review'
          }
        ]
      })
      .mockResolvedValueOnce({ rows: [{ total_count: '1' }] })
      .mockResolvedValueOnce({ rows: [{ total_count: '2' }] })
      .mockResolvedValueOnce({ rows: [{ total_count: '3' }] });

    let thrown: unknown;
    try {
      await service.closePeriod('period-1', { organization_id: '550e8400-e29b-41d4-a716-446655440000' }, actor);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ConflictException);
    expect((thrown as ConflictException).getResponse()).toMatchObject({
      blocker_counts: {
        pending_approvals: 1,
        open_proposals: 2,
        schedule_blockers: 3
      }
    });
    expect(databaseService.query).toHaveBeenCalledTimes(4);
  });

  it('closes a period when blockers are clear', async () => {
    databaseService.query
      .mockResolvedValueOnce({
        rows: [
          {
            period_id: 'period-1',
            name: 'Apr 2026',
            period_start: '2026-04-01',
            period_end: '2026-04-30',
            status: 'pre_close_review'
          }
        ]
      })
      .mockResolvedValueOnce({ rows: [{ total_count: '0' }] })
      .mockResolvedValueOnce({ rows: [{ total_count: '0' }] })
      .mockResolvedValueOnce({ rows: [{ total_count: '0' }] })
      .mockResolvedValueOnce({
        rows: [
          {
            period_id: 'period-1',
            name: 'Apr 2026',
            period_start: '2026-04-01',
            period_end: '2026-04-30',
            status: 'closed',
            closed_by_user_id: 'user-1'
          }
        ]
      });

    await expect(
      service.closePeriod('period-1', { organization_id: '550e8400-e29b-41d4-a716-446655440000' }, actor)
    ).resolves.toEqual({
      period: {
        period_id: 'period-1',
        name: 'Apr 2026',
        period_start: '2026-04-01',
        period_end: '2026-04-30',
        status: 'closed',
        closed_by_user_id: 'user-1'
      },
      actor_context: actorContext,
      blocker_counts: {
        pending_approvals: 0,
        open_proposals: 0,
        schedule_blockers: 0
      }
    });

    expect(databaseService.query).toHaveBeenNthCalledWith(5, expect.stringContaining("set status = 'closed'"), [
      'period-1',
      '550e8400-e29b-41d4-a716-446655440000',
      'firm-1',
      'user-1'
    ]);
  });

  it('reopens a closed period', async () => {
    databaseService.query
      .mockResolvedValueOnce({
        rows: [{ period_id: 'period-1', name: 'Apr 2026', period_start: '2026-04-01', period_end: '2026-04-30', status: 'closed' }]
      })
      .mockResolvedValueOnce({
        rows: [
          {
            period_id: 'period-1',
            name: 'Apr 2026',
            period_start: '2026-04-01',
            period_end: '2026-04-30',
            status: 'reopened',
            reopened_by_user_id: 'user-1'
          }
        ]
      });

    await expect(
      service.reopenPeriod('period-1', { organization_id: '550e8400-e29b-41d4-a716-446655440000' }, actor)
    ).resolves.toEqual({
      period: {
        period_id: 'period-1',
        name: 'Apr 2026',
        period_start: '2026-04-01',
        period_end: '2026-04-30',
        status: 'reopened',
        reopened_by_user_id: 'user-1'
      },
      actor_context: actorContext
    });

    expect(databaseService.query).toHaveBeenNthCalledWith(2, expect.stringContaining("set status = 'reopened'"), [
      'period-1',
      '550e8400-e29b-41d4-a716-446655440000',
      'firm-1',
      'user-1'
    ]);
  });
});
