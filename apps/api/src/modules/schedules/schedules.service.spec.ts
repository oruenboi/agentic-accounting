import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SchedulesService } from './schedules.service';
import type { AuthenticatedActor } from '../auth/authenticated-request.interface';

describe('SchedulesService', () => {
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

  let service: SchedulesService;

  beforeEach(() => {
    jest.resetAllMocks();
    tenantAccessService.assertOrganizationAccess.mockResolvedValue(actorContext);
    service = new SchedulesService(databaseService as never, tenantAccessService as never);
  });

  it('lists schedule definitions after asserting organization access', async () => {
    databaseService.query.mockResolvedValueOnce({
      rows: [
        {
          schedule_definition_id: 'definition-1',
          organization_id: 'org-1',
          schedule_type: 'accounts_payable',
          name: 'Trade payables',
          gl_account_ids: ['account-1'],
          generation_strategy: 'ledger_derived',
          is_active: true
        }
      ]
    });

    await expect(
      service.listScheduleDefinitions(
        {
          organization_id: '550e8400-e29b-41d4-a716-446655440000',
          schedule_type: 'accounts_payable',
          is_active: 'true',
          limit: 20
        },
        actor
      )
    ).resolves.toEqual({
      organization_id: '550e8400-e29b-41d4-a716-446655440000',
      actor_context: actorContext,
      filters: {
        schedule_type: 'accounts_payable',
        is_active: true,
        limit: 20
      },
      items: [
        {
          schedule_definition_id: 'definition-1',
          organization_id: 'org-1',
          schedule_type: 'accounts_payable',
          name: 'Trade payables',
          gl_account_ids: ['account-1'],
          generation_strategy: 'ledger_derived',
          is_active: true
        }
      ]
    });

    expect(tenantAccessService.assertOrganizationAccess).toHaveBeenCalledWith(actor, '550e8400-e29b-41d4-a716-446655440000');
    expect(databaseService.query).toHaveBeenCalledWith(expect.stringContaining('from public.schedule_definitions sd'), [
      '550e8400-e29b-41d4-a716-446655440000',
      'firm-1',
      'accounts_payable',
      true,
      20
    ]);
  });

  it('creates a ledger-derived schedule definition after validating accounts', async () => {
    databaseService.query
      .mockResolvedValueOnce({
        rows: [{ account_id: '660e8400-e29b-41d4-a716-446655440001' }]
      })
      .mockResolvedValueOnce({
        rows: [
          {
            schedule_definition_id: 'definition-1',
            firm_id: 'firm-1',
            organization_id: '550e8400-e29b-41d4-a716-446655440000',
            schedule_type: 'accounts_payable',
            name: 'Trade payables',
            gl_account_ids: ['660e8400-e29b-41d4-a716-446655440001'],
            generation_strategy: 'ledger_derived',
            is_active: true
          }
        ]
      });

    await expect(
      service.createScheduleDefinition(
        {
          organization_id: '550e8400-e29b-41d4-a716-446655440000',
          schedule_type: 'accounts_payable',
          name: ' Trade payables ',
          gl_account_ids: ['660e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440001']
        },
        actor
      )
    ).resolves.toEqual(
      expect.objectContaining({
        schedule_definition_id: 'definition-1',
        schedule_type: 'accounts_payable',
        name: 'Trade payables',
        gl_account_ids: ['660e8400-e29b-41d4-a716-446655440001'],
        generation_strategy: 'ledger_derived',
        actor_context: actorContext
      })
    );

    expect(databaseService.query).toHaveBeenNthCalledWith(1, expect.stringContaining('from public.accounts'), [
      '550e8400-e29b-41d4-a716-446655440000',
      'firm-1',
      ['660e8400-e29b-41d4-a716-446655440001']
    ]);
    expect(databaseService.query).toHaveBeenNthCalledWith(2, expect.stringContaining('insert into public.schedule_definitions'), [
      'firm-1',
      '550e8400-e29b-41d4-a716-446655440000',
      'accounts_payable',
      'Trade payables',
      null,
      ['660e8400-e29b-41d4-a716-446655440001'],
      null
    ]);
  });

  it('rejects schedule definitions with accounts outside the organization', async () => {
    databaseService.query.mockResolvedValueOnce({ rows: [] });

    await expect(
      service.createScheduleDefinition(
        {
          organization_id: '550e8400-e29b-41d4-a716-446655440000',
          schedule_type: 'accounts_payable',
          name: 'Trade payables',
          gl_account_ids: ['660e8400-e29b-41d4-a716-446655440001']
        },
        actor
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lists schedule runs after asserting organization access', async () => {
    databaseService.query.mockResolvedValueOnce({
      rows: [
        {
          schedule_run_id: 'run-1',
          organization_id: 'org-1',
          schedule_type: 'bank',
          status: 'reconciled'
        }
      ]
    });

    await expect(
      service.listScheduleRuns(
        {
          organization_id: '550e8400-e29b-41d4-a716-446655440000',
          schedule_type: 'bank',
          status: 'reconciled',
          as_of_date: '2026-04-30',
          limit: 10
        },
        actor
      )
    ).resolves.toEqual({
      organization_id: '550e8400-e29b-41d4-a716-446655440000',
      actor_context: actorContext,
      filters: {
        schedule_type: 'bank',
        status: 'reconciled',
        as_of_date: '2026-04-30',
        limit: 10
      },
      items: [
        {
          schedule_run_id: 'run-1',
          organization_id: 'org-1',
          schedule_type: 'bank',
          status: 'reconciled'
        }
      ]
    });

    expect(tenantAccessService.assertOrganizationAccess).toHaveBeenCalledWith(actor, '550e8400-e29b-41d4-a716-446655440000');
    expect(databaseService.query).toHaveBeenCalledWith(expect.stringContaining('from public.schedule_runs sr'), [
      '550e8400-e29b-41d4-a716-446655440000',
      'bank',
      'reconciled',
      '2026-04-30',
      10
    ]);
  });

  it('returns a schedule run with rows', async () => {
    databaseService.query
      .mockResolvedValueOnce({
        rows: [
          {
            schedule_run_id: 'run-1',
            organization_id: 'org-1',
            schedule_type: 'bank',
            status: 'generated'
          }
        ]
      })
      .mockResolvedValueOnce({
        rows: [
          {
            schedule_run_row_id: 'row-1',
            row_order: 1,
            closing_amount: '100.00'
          }
        ]
      });

    await expect(
      service.getScheduleRun('660e8400-e29b-41d4-a716-446655440000', { organization_id: '550e8400-e29b-41d4-a716-446655440000' }, actor)
    ).resolves.toEqual({
      schedule_run_id: 'run-1',
      organization_id: 'org-1',
      schedule_type: 'bank',
      status: 'generated',
      actor_context: actorContext,
      rows: [
        {
          schedule_run_row_id: 'row-1',
          row_order: 1,
          closing_amount: '100.00'
        }
      ]
    });
  });

  it('throws not found when the run is outside the requested organization', async () => {
    databaseService.query.mockResolvedValueOnce({ rows: [] });

    await expect(
      service.getScheduleRun('660e8400-e29b-41d4-a716-446655440000', { organization_id: '550e8400-e29b-41d4-a716-446655440000' }, actor)
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('generates a ledger-derived schedule run', async () => {
    const transactionClient = {
      query: jest.fn()
    };

    (databaseService as unknown as { withTransaction: jest.Mock }).withTransaction = jest.fn(async (callback) => callback(transactionClient));

    transactionClient.query
      .mockResolvedValueOnce({
        rows: [
          {
            schedule_definition_id: 'definition-1',
            firm_id: 'firm-1',
            organization_id: 'org-1',
            schedule_type: 'accruals',
            schedule_name: 'Accruals',
            gl_account_ids: ['account-1'],
            generation_strategy: 'ledger_derived',
            group_by: null
          }
        ]
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            account_id: 'account-1',
            account_code: '2100',
            account_name: 'Accrued expenses',
            account_type: 'liability',
            account_subtype: 'accruals',
            net_balance: '-250.00'
          }
        ]
      })
      .mockResolvedValueOnce({ rows: [{ schedule_run_id: 'run-1' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      service.generateScheduleRun(
        {
          organization_id: '550e8400-e29b-41d4-a716-446655440000',
          schedule_type: 'accruals',
          as_of_date: '2026-04-30'
        },
        actor
      )
    ).resolves.toEqual(
      expect.objectContaining({
        schedule_run_id: 'run-1',
        schedule_definition_id: 'definition-1',
        schedule_type: 'accruals',
        as_of_date: '2026-04-30',
        gl_balance: -250,
        schedule_total: -250,
        variance: 0,
        rows: [
          expect.objectContaining({
            reference_type: 'gl_account',
            reference_id: 'account-1',
            closing_amount: '-250.00'
          })
        ]
      })
    );

    expect(transactionClient.query).toHaveBeenCalledWith(expect.stringContaining('insert into public.schedule_runs'), expect.any(Array));
    expect(transactionClient.query).toHaveBeenCalledWith(expect.stringContaining('insert into public.schedule_run_rows'), expect.any(Array));
    expect(transactionClient.query).toHaveBeenCalledWith(expect.stringContaining('insert into public.schedule_reconciliations'), expect.any(Array));
  });

  it('marks a zero-variance schedule run reconciled', async () => {
    const transactionClient = {
      query: jest.fn()
    };

    (databaseService as unknown as { withTransaction: jest.Mock }).withTransaction = jest.fn(async (callback) => callback(transactionClient));

    transactionClient.query
      .mockResolvedValueOnce({
        rows: [
          {
            schedule_run_id: 'run-1',
            organization_id: 'org-1',
            schedule_definition_id: 'definition-1',
            schedule_type: 'bank',
            as_of_date: '2026-04-30',
            status: 'reconciled',
            gl_balance: '100.00',
            schedule_total: '100.00',
            variance: '0.00',
            reconciliation_id: 'reconciliation-1'
          }
        ]
      })
      .mockResolvedValueOnce({
        rows: [
          {
            reconciliation_id: 'reconciliation-1',
            reconciliation_status: 'reconciled',
            reconciliation_reviewed_by_user_id: 'user-1',
            reconciliation_notes: null
          }
        ]
      })
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      service.reviewScheduleRun(
        '660e8400-e29b-41d4-a716-446655440000',
        {
          organization_id: '550e8400-e29b-41d4-a716-446655440000',
          resolution: 'reconciled'
        },
        actor
      )
    ).resolves.toEqual(
      expect.objectContaining({
        schedule_run_id: 'run-1',
        status: 'reviewed',
        reconciliation_status: 'reconciled',
        reviewed_by_user_id: 'user-1',
        actor_context: actorContext
      })
    );

    expect(transactionClient.query).toHaveBeenNthCalledWith(2, expect.stringContaining('update public.schedule_reconciliations'), [
      'reconciled',
      'user-1',
      null,
      'reconciliation-1'
    ]);
    expect(transactionClient.query).toHaveBeenNthCalledWith(3, expect.stringContaining('update public.schedule_runs'), [
      'user-1',
      '660e8400-e29b-41d4-a716-446655440000'
    ]);
  });

  it('requires notes when approving a variance', async () => {
    await expect(
      service.reviewScheduleRun(
        '660e8400-e29b-41d4-a716-446655440000',
        {
          organization_id: '550e8400-e29b-41d4-a716-446655440000',
          resolution: 'approved_with_variance'
        },
        actor
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
