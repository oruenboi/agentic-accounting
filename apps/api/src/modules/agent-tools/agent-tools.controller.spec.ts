import { ValidationPipe, ForbiddenException, INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AgentToolsController } from './agent-tools.controller';
import { AgentToolsService } from './agent-tools.service';
import { AgentToolsAuthGuard } from '../auth/agent-tools-auth.guard';
import { AgentClientAuthService } from '../auth/agent-client-auth.service';
import { SupabaseAuthService } from '../auth/supabase-auth.service';
import { HealthService } from '../health/health.service';
import { JournalValidationService } from '../journal-tools/journal-validation.service';
import { ReportsService } from '../reports/reports.service';

describe('AgentToolsController', () => {
  let app: INestApplication;
  const organizationId = '550e8400-e29b-41d4-a716-446655440000';
  const delegatedAuthUserId = '11111111-1111-4111-8111-111111111111';

  const healthService = {
    getStatus: jest.fn()
  };

  const reportsService = {
    getTrialBalance: jest.fn(),
    getBalanceSheet: jest.fn(),
    getProfitAndLoss: jest.fn(),
    getGeneralLedger: jest.fn()
  };

  const journalValidationService = {
    validateJournalEntry: jest.fn()
  };

  const supabaseAuthService = {
    verifyAccessToken: jest.fn()
  };

  const agentClientAuthService = {
    authenticate: jest.fn()
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    healthService.getStatus.mockResolvedValue({
      status: 'ok',
      database: 'ok'
    });

    reportsService.getTrialBalance.mockResolvedValue({
      organization_id: organizationId,
      as_of_date: '2026-04-01',
      actor_context: {
        appUserId: 'app-user-1',
        authUserId: delegatedAuthUserId,
        organizationRole: 'accountant',
        firmRole: null,
        firmId: 'firm-1'
      },
      items: []
    });

    journalValidationService.validateJournalEntry.mockResolvedValue({
      organization_id: organizationId,
      entry_date: '2026-04-01',
      actor_context: {
        appUserId: 'app-user-1',
        authUserId: delegatedAuthUserId,
        organizationRole: 'accountant',
        firmRole: null,
        firmId: 'firm-1'
      },
      valid: true,
      requires_approval: false,
      errors: [],
      warnings: [],
      impact_preview: {
        line_count: 2,
        total_debit: 100,
        total_credit: 100,
        account_ids: [
          '660e8400-e29b-41d4-a716-446655440000',
          '770e8400-e29b-41d4-a716-446655440000'
        ]
      },
      validation_result: {
        balanced: true,
        account_count: 2,
        period: null
      }
    });

    supabaseAuthService.verifyAccessToken.mockResolvedValue({
      actorType: 'user',
      authUserId: delegatedAuthUserId,
      email: 'user@example.com',
      clientId: null,
      agentName: null,
      agentRunId: null,
      delegatedAuthUserId: null
    });

    agentClientAuthService.authenticate.mockImplementation((headers: { delegatedAuthUserId?: string; agentRunId?: string }) => ({
      actorType: 'agent',
      authUserId: headers.delegatedAuthUserId ?? '',
      email: null,
      clientId: 'test-agent-client',
      agentName: 'test-agent',
      agentRunId: headers.agentRunId ?? null,
      delegatedAuthUserId: headers.delegatedAuthUserId ?? null
    }));

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AgentToolsController],
      providers: [
        AgentToolsService,
        AgentToolsAuthGuard,
        {
          provide: HealthService,
          useValue: healthService
        },
        {
          provide: ReportsService,
          useValue: reportsService
        },
        {
          provide: JournalValidationService,
          useValue: journalValidationService
        },
        {
          provide: SupabaseAuthService,
          useValue: supabaseAuthService
        },
        {
          provide: AgentClientAuthService,
          useValue: agentClientAuthService
        }
      ]
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns the tool schema for bearer-authenticated callers', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/agent-tools/schema')
      .set('Authorization', 'Bearer test-token')
      .expect(200);

    expect(supabaseAuthService.verifyAccessToken).toHaveBeenCalledWith('test-token');
    expect(response.body.ok).toBe(true);
    expect(response.body.result.tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'get_health_status' }),
        expect.objectContaining({ name: 'get_trial_balance' })
      ])
    );
  });

  it('returns the tool schema for configured agent clients', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/agent-tools/schema')
      .set('x-agent-client-id', 'test-agent-client')
      .set('x-agent-client-secret', 'test-secret')
      .expect(200);

    expect(agentClientAuthService.authenticate).toHaveBeenCalled();
    expect(response.body.ok).toBe(true);
  });

  it('executes get_health_status for configured agent clients', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/agent-tools/execute')
      .set('x-agent-client-id', 'test-agent-client')
      .set('x-agent-client-secret', 'test-secret')
      .send({
        tool: 'get_health_status',
        input: {}
      })
      .expect(201);

    expect(response.body.ok).toBe(true);
    expect(response.body.result).toEqual({
      status: 'ok',
      database: 'ok'
    });
  });

  it('rejects tenant-scoped agent reads without delegated auth user context', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/agent-tools/execute')
      .set('x-agent-client-id', 'test-agent-client')
      .set('x-agent-client-secret', 'test-secret')
      .send({
        tool: 'get_trial_balance',
        input: {
          organization_id: organizationId,
          as_of_date: '2026-04-01'
        }
      })
      .expect(201);

    expect(response.body.ok).toBe(false);
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'INVALID_DELEGATION' })
      ])
    );
    expect(reportsService.getTrialBalance).not.toHaveBeenCalled();
  });

  it('returns tenant access denied when delegated agent reads fail membership checks', async () => {
    reportsService.getTrialBalance.mockRejectedValueOnce(
      new ForbiddenException('Actor is not allowed to access the requested organization.')
    );

    const response = await request(app.getHttpServer())
      .post('/api/v1/agent-tools/execute')
      .set('x-agent-client-id', 'test-agent-client')
      .set('x-agent-client-secret', 'test-secret')
      .set('x-delegated-auth-user-id', delegatedAuthUserId)
      .send({
        tool: 'get_trial_balance',
        input: {
          organization_id: organizationId,
          as_of_date: '2026-04-01'
        }
      })
      .expect(201);

    expect(response.body.ok).toBe(false);
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'TENANT_ACCESS_DENIED' })
      ])
    );
  });

  it('validates journal entries for delegated agent callers', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/agent-tools/execute')
      .set('x-agent-client-id', 'test-agent-client')
      .set('x-agent-client-secret', 'test-secret')
      .set('x-delegated-auth-user-id', delegatedAuthUserId)
      .send({
        tool: 'validate_journal_entry',
        idempotency_key: 'idem-validate-journal-entry',
        input: {
          organization_id: organizationId,
          entry_date: '2026-04-01',
          source_type: 'manual_adjustment',
          lines: [
            {
              account_id: '660e8400-e29b-41d4-a716-446655440000',
              debit: 100,
              credit: 0
            },
            {
              account_id: '770e8400-e29b-41d4-a716-446655440000',
              debit: 0,
              credit: 100
            }
          ]
        }
      })
      .expect(201);

    expect(response.body.ok).toBe(true);
    expect(journalValidationService.validateJournalEntry).toHaveBeenCalled();
    expect(response.body.result.valid).toBe(true);
  });

  it('returns validation errors for invalid journal entry payloads', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/agent-tools/execute')
      .set('x-agent-client-id', 'test-agent-client')
      .set('x-agent-client-secret', 'test-secret')
      .set('x-delegated-auth-user-id', delegatedAuthUserId)
      .send({
        tool: 'validate_journal_entry',
        idempotency_key: 'idem-invalid-journal-entry',
        input: {
          organization_id: organizationId,
          entry_date: '2026-04-01',
          source_type: 'manual_adjustment',
          lines: [
            {
              account_id: '660e8400-e29b-41d4-a716-446655440000',
              debit: 100,
              credit: 100
            }
          ]
        }
      })
      .expect(201);

    expect(response.body.ok).toBe(false);
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'TOOL_INPUT_INVALID' })
      ])
    );
    expect(journalValidationService.validateJournalEntry).not.toHaveBeenCalled();
  });
});
