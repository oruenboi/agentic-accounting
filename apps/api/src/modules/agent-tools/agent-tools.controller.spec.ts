import { ValidationPipe, ForbiddenException, INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AgentToolsController } from './agent-tools.controller';
import { AgentToolsService } from './agent-tools.service';
import { AgentToolsAuthGuard } from '../auth/agent-tools-auth.guard';
import { AgentClientAuthService } from '../auth/agent-client-auth.service';
import { SupabaseAuthService } from '../auth/supabase-auth.service';
import { HealthService } from '../health/health.service';
import { JournalDraftService } from '../journal-tools/journal-draft.service';
import { JournalValidationService } from '../journal-tools/journal-validation.service';
import { ReportsService } from '../reports/reports.service';
import { AppError } from '../shared/app-error';

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

  const journalDraftService = {
    createJournalEntryDraft: jest.fn(),
    reworkRejectedJournalEntryDraft: jest.fn(),
    listAuditEvents: jest.fn(),
    getEntityTimeline: jest.fn(),
    listJournalEntries: jest.fn(),
    getJournalEntry: jest.fn(),
    getJournalEntryReversalChain: jest.fn(),
    getJournalEntryDraft: jest.fn(),
    listAgentProposals: jest.fn(),
    getAgentProposal: jest.fn(),
    submitJournalEntryDraftForApproval: jest.fn(),
    resubmitJournalEntryDraftForApproval: jest.fn(),
    listApprovalRequests: jest.fn(),
    getApprovalRequest: jest.fn(),
    resolveApprovalRequest: jest.fn(),
    postApprovedJournalEntry: jest.fn(),
    reversePostedJournalEntry: jest.fn()
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

    journalDraftService.createJournalEntryDraft.mockResolvedValue({
      organization_id: organizationId,
      draft_id: '880e8400-e29b-41d4-a716-446655440000',
      draft_number: 'JE-000001',
      proposal_id: '990e8400-e29b-41d4-a716-446655440000',
      actor_context: {
        appUserId: 'app-user-1',
        authUserId: delegatedAuthUserId,
        organizationRole: 'accountant',
        firmRole: null,
        firmId: 'firm-1'
      },
      status: 'validated',
      requires_approval: false,
      entry_date: '2026-04-01',
      line_count: 2,
      validation_result: {
        balanced: true,
        account_count: 2,
        period: {
          id: 'period-1',
          status: 'open'
        }
      },
      impact_preview: {
        line_count: 2,
        total_debit: 100,
        total_credit: 100,
        account_ids: [
          '660e8400-e29b-41d4-a716-446655440000',
          '770e8400-e29b-41d4-a716-446655440000'
        ]
      }
    });

    journalDraftService.reworkRejectedJournalEntryDraft.mockResolvedValue({
      organization_id: organizationId,
      draft_id: '880e8400-e29b-41d4-a716-446655440000',
      draft_number: 'JE-000001',
      proposal_id: '990e8400-e29b-41d4-a716-446655440000',
      actor_context: {
        appUserId: 'app-user-1',
        authUserId: delegatedAuthUserId,
        organizationRole: 'accountant',
        firmRole: null,
        firmId: 'firm-1'
      },
      status: 'validated',
      requires_approval: false,
      entry_date: '2026-04-02',
      line_count: 2,
      validation_result: {
        balanced: true,
        account_count: 2,
        period: {
          id: 'period-1',
          status: 'open'
        }
      },
      impact_preview: {
        line_count: 2,
        total_debit: 100,
        total_credit: 100,
        account_ids: [
          '660e8400-e29b-41d4-a716-446655440000',
          '770e8400-e29b-41d4-a716-446655440000'
        ]
      }
    });

    journalDraftService.listAuditEvents.mockResolvedValue({
      organization_id: organizationId,
      actor_context: {
        appUserId: 'app-user-1',
        authUserId: delegatedAuthUserId,
        organizationRole: 'accountant',
        firmRole: null,
        firmId: 'firm-1'
      },
      filters: {
        entity_type: 'journal_entry_draft',
        entity_id: '880e8400-e29b-41d4-a716-446655440000',
        event_name: null,
        actor_type: null,
        request_id: null,
        correlation_id: null,
        from_timestamp: null,
        to_timestamp: null,
        limit: 20
      },
      items: [
        {
          event_id: 'audit-1',
          source: 'approval_action',
          organization_id: organizationId,
          event_name: 'approval.action.approved',
          event_timestamp: '2026-04-23T11:00:00.000Z',
          actor: {
            actor_type: 'agent',
            actor_id: 'test-agent-client',
            actor_display_name: 'test-agent',
            user_id: 'app-user-1',
            agent_name: null,
            agent_run_id: null
          },
          tool_name: null,
          request_id: 'request-3',
          correlation_id: 'corr-3',
          idempotency_key: 'idem-resolve-1',
          entity: {
            entity_type: 'journal_entry_draft',
            entity_id: '880e8400-e29b-41d4-a716-446655440000',
            parent_entity_type: 'approval_request',
            parent_entity_id: 'aa0e8400-e29b-41d4-a716-446655440000'
          },
          action_status: 'succeeded',
          approval_request_id: 'aa0e8400-e29b-41d4-a716-446655440000',
          approval_required: true,
          summary: 'Threshold review complete',
          metadata: {}
        }
      ]
    });

    journalDraftService.getEntityTimeline.mockResolvedValue({
      organization_id: organizationId,
      entity_type: 'journal_entry_draft',
      entity_id: '880e8400-e29b-41d4-a716-446655440000',
      actor_context: {
        appUserId: 'app-user-1',
        authUserId: delegatedAuthUserId,
        organizationRole: 'accountant',
        firmRole: null,
        firmId: 'firm-1'
      },
      items: [
        {
          event_id: 'audit-1',
          source: 'approval_action',
          organization_id: organizationId,
          event_name: 'approval.action.submitted',
          event_timestamp: '2026-04-23T10:00:00.000Z',
          actor: {
            actor_type: 'agent',
            actor_id: 'test-agent-client',
            actor_display_name: 'test-agent',
            user_id: 'app-user-1',
            agent_name: null,
            agent_run_id: null
          },
          tool_name: null,
          request_id: 'request-2',
          correlation_id: 'corr-2',
          idempotency_key: 'idem-submit-1',
          entity: {
            entity_type: 'journal_entry_draft',
            entity_id: '880e8400-e29b-41d4-a716-446655440000',
            parent_entity_type: 'approval_request',
            parent_entity_id: 'aa0e8400-e29b-41d4-a716-446655440000'
          },
          action_status: 'succeeded',
          approval_request_id: 'aa0e8400-e29b-41d4-a716-446655440000',
          approval_required: true,
          summary: 'Approval action submitted recorded',
          metadata: {}
        }
      ]
    });

    journalDraftService.listJournalEntries.mockResolvedValue({
      organization_id: organizationId,
      actor_context: {
        appUserId: 'app-user-1',
        authUserId: delegatedAuthUserId,
        organizationRole: 'accountant',
        firmRole: null,
        firmId: 'firm-1'
      },
      filters: {
        status: 'reversed',
        from_date: '2026-04-01',
        to_date: '2026-04-30',
        limit: 10
      },
      items: [
        {
          journal_entry_id: 'bb0e8400-e29b-41d4-a716-446655440000',
          entry_number: 'JE-000001',
          entry_date: '2026-04-23',
          memo: 'Utilities accrual',
          source_type: 'manual_adjustment',
          source_id: 'request-1',
          status: 'reversed',
          posted_at: '2026-04-23T12:00:00.000Z',
          draft_id: '880e8400-e29b-41d4-a716-446655440000',
          draft_number: 'JE-000001',
          proposal_id: '990e8400-e29b-41d4-a716-446655440000',
          proposal_status: 'posted',
          reversal_of_journal_entry_id: null,
          reversal_journal_entry_id: 'cc0e8400-e29b-41d4-a716-446655440000',
          line_count: 2
        }
      ]
    });

    journalDraftService.getJournalEntry.mockResolvedValue({
      organization_id: organizationId,
      journal_entry_id: 'bb0e8400-e29b-41d4-a716-446655440000',
      entry_number: 'JE-000001',
      entry_date: '2026-04-23',
      memo: 'Utilities accrual',
      source_type: 'manual_adjustment',
      source_id: 'request-1',
      status: 'reversed',
      posted_at: '2026-04-23T12:00:00.000Z',
      accounting_period_id: 'period-1',
      actor_context: {
        appUserId: 'app-user-1',
        authUserId: delegatedAuthUserId,
        organizationRole: 'accountant',
        firmRole: null,
        firmId: 'firm-1'
      },
      posted_by: {
        actor_type: 'agent',
        actor_id: 'test-agent-client',
        user_id: 'app-user-1'
      },
      draft: {
        draft_id: '880e8400-e29b-41d4-a716-446655440000',
        draft_number: 'JE-000001',
        status: 'posted'
      },
      proposal: {
        proposal_id: '990e8400-e29b-41d4-a716-446655440000',
        status: 'posted',
        title: 'Journal draft: Utilities accrual',
        posted_entity_type: 'journal_entry',
        posted_entity_id: 'bb0e8400-e29b-41d4-a716-446655440000'
      },
      reversal_linkage: {
        journal_entry_reversal_id: 'dd0e8400-e29b-41d4-a716-446655440000',
        reversal_of_journal_entry_id: null,
        reversed_by_journal_entry_id: 'cc0e8400-e29b-41d4-a716-446655440000',
        reversal_date: '2026-04-24',
        reversal_reason: 'Customer invoice voided'
      },
      metadata: {
        source: 'test'
      },
      lines: [
        {
          id: 'line-1',
          line_number: 1,
          account_id: '660e8400-e29b-41d4-a716-446655440000',
          account_code: '5000',
          account_name: 'Operating Expense',
          description: null,
          debit: 100,
          credit: 0,
          dimensions: {},
          metadata: {}
        }
      ]
    });

    journalDraftService.getJournalEntryReversalChain.mockResolvedValue({
      organization_id: organizationId,
      requested_journal_entry_id: 'cc0e8400-e29b-41d4-a716-446655440000',
      actor_context: {
        appUserId: 'app-user-1',
        authUserId: delegatedAuthUserId,
        organizationRole: 'accountant',
        firmRole: null,
        firmId: 'firm-1'
      },
      original_entry: {
        journal_entry_id: 'bb0e8400-e29b-41d4-a716-446655440000',
        entry_number: 'JE-000001',
        entry_date: '2026-04-23',
        memo: 'Utilities accrual',
        source_type: 'manual_adjustment',
        source_id: 'request-1',
        status: 'reversed',
        posted_at: '2026-04-23T12:00:00.000Z'
      },
      reversal: {
        journal_entry_reversal_id: 'dd0e8400-e29b-41d4-a716-446655440000',
        reversal_date: '2026-04-24',
        reason: 'Customer invoice voided',
        journal_entry: {
          journal_entry_id: 'cc0e8400-e29b-41d4-a716-446655440000',
          entry_number: 'JE-000002',
          entry_date: '2026-04-24',
          memo: 'Reversal of JE-000001: Customer invoice voided',
          source_type: 'journal_entry_reversal',
          source_id: 'bb0e8400-e29b-41d4-a716-446655440000',
          status: 'posted',
          posted_at: '2026-04-24T09:00:00.000Z'
        }
      }
    });

    journalDraftService.getJournalEntryDraft.mockResolvedValue({
      organization_id: organizationId,
      draft_id: '880e8400-e29b-41d4-a716-446655440000',
      draft_number: 'JE-000001',
      status: 'validated',
      entry_date: '2026-04-01',
      memo: 'Utilities accrual',
      source_type: 'manual_adjustment',
      source_id: 'request-1',
      accounting_period_id: 'period-1',
      actor_context: {
        appUserId: 'app-user-1',
        authUserId: delegatedAuthUserId,
        organizationRole: 'accountant',
        firmRole: null,
        firmId: 'firm-1'
      },
      created_by: {
        actor_type: 'agent',
        actor_id: 'test-agent-client',
        user_id: 'app-user-1'
      },
      proposal: {
        proposal_id: '990e8400-e29b-41d4-a716-446655440000',
        status: 'needs_review'
      },
      validation_summary: {
        valid: true
      },
      metadata: {
        source: 'test'
      },
      lines: [
        {
          id: 'line-1',
          line_number: 1,
          account_id: '660e8400-e29b-41d4-a716-446655440000',
          account_code: '5000',
          account_name: 'Operating Expense',
          description: null,
          debit: 100,
          credit: 0
        },
        {
          id: 'line-2',
          line_number: 2,
          account_id: '770e8400-e29b-41d4-a716-446655440000',
          account_code: '2000',
          account_name: 'Accounts Payable',
          description: null,
          debit: 0,
          credit: 100
        }
      ]
    });

    journalDraftService.listAgentProposals.mockResolvedValue({
      organization_id: organizationId,
      actor_context: {
        appUserId: 'app-user-1',
        authUserId: delegatedAuthUserId,
        organizationRole: 'accountant',
        firmRole: null,
        firmId: 'firm-1'
      },
      filters: {
        status: 'needs_review',
        limit: 10
      },
      items: [
        {
          proposal_id: '990e8400-e29b-41d4-a716-446655440000',
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
          target_entity_id: '880e8400-e29b-41d4-a716-446655440000',
          draft_number: 'JE-000001'
        }
      ]
    });

    journalDraftService.getAgentProposal.mockResolvedValue({
      organization_id: organizationId,
      proposal_id: '990e8400-e29b-41d4-a716-446655440000',
      proposal_type: 'journal_entry',
      status: 'needs_review',
      title: 'Journal draft: Utilities accrual',
      description: 'Utilities accrual',
      actor_context: {
        appUserId: 'app-user-1',
        authUserId: delegatedAuthUserId,
        organizationRole: 'accountant',
        firmRole: null,
        firmId: 'firm-1'
      },
      source: {
        agent_name: 'test-agent',
        agent_run_id: 'run-1',
        tool_name: 'create_journal_entry_draft',
        request_id: 'request-1',
        correlation_id: 'corr-1',
        idempotency_key: 'idem-1'
      },
      created_by: {
        actor_type: 'agent',
        actor_id: 'test-agent-client',
        user_id: 'app-user-1'
      },
      target: {
        entity_type: 'journal_entry_draft',
        entity_id: '880e8400-e29b-41d4-a716-446655440000',
        draft_number: 'JE-000001',
        draft_status: 'validated'
      },
      payload: {
        draft_id: '880e8400-e29b-41d4-a716-446655440000',
        draft_number: 'JE-000001'
      },
      metadata: {
        warnings: []
      },
      created_at: '2026-04-23T10:00:00.000Z',
      updated_at: '2026-04-23T10:00:00.000Z'
    });

    journalDraftService.submitJournalEntryDraftForApproval.mockResolvedValue({
      organization_id: organizationId,
      draft_id: '880e8400-e29b-41d4-a716-446655440000',
      draft_number: 'JE-000001',
      proposal_id: '990e8400-e29b-41d4-a716-446655440000',
      approval_request_id: 'aa0e8400-e29b-41d4-a716-446655440000',
      actor_context: {
        appUserId: 'app-user-1',
        authUserId: delegatedAuthUserId,
        organizationRole: 'accountant',
        firmRole: null,
        firmId: 'firm-1'
      },
      status: 'pending_approval',
      approval_status: 'pending',
      requires_approval: true,
      priority: 'high',
      submitted_at: '2026-04-23T10:00:00.000Z'
    });

    journalDraftService.resubmitJournalEntryDraftForApproval.mockResolvedValue({
      organization_id: organizationId,
      draft_id: '880e8400-e29b-41d4-a716-446655440000',
      draft_number: 'JE-000001',
      proposal_id: '990e8400-e29b-41d4-a716-446655440000',
      approval_request_id: 'ab0e8400-e29b-41d4-a716-446655440000',
      actor_context: {
        appUserId: 'app-user-1',
        authUserId: delegatedAuthUserId,
        organizationRole: 'accountant',
        firmRole: null,
        firmId: 'firm-1'
      },
      status: 'pending_approval',
      approval_status: 'pending',
      requires_approval: true,
      priority: 'high',
      submitted_at: '2026-04-23T12:30:00.000Z'
    });

    journalDraftService.listApprovalRequests.mockResolvedValue({
      organization_id: organizationId,
      actor_context: {
        appUserId: 'app-user-1',
        authUserId: delegatedAuthUserId,
        organizationRole: 'accountant',
        firmRole: null,
        firmId: 'firm-1'
      },
      filters: {
        status: 'pending',
        limit: 10
      },
      items: [
        {
          approval_request_id: 'aa0e8400-e29b-41d4-a716-446655440000',
          status: 'pending',
          priority: 'high',
          action_type: 'ledger.journal_draft.submitted_for_approval',
          submitted_at: '2026-04-23T10:00:00.000Z',
          submitted_by: {
            actor_type: 'agent',
            actor_id: 'test-agent-client',
            user_id: 'app-user-1'
          },
          target: {
            entity_type: 'journal_entry_draft',
            entity_id: '880e8400-e29b-41d4-a716-446655440000',
            draft_number: 'JE-000001',
            draft_status: 'pending_approval',
            proposal_id: '990e8400-e29b-41d4-a716-446655440000',
            proposal_status: 'pending_approval'
          },
          current_approver_user_id: null,
          expires_at: null,
          resolved_at: null,
          resolved_by_user_id: null,
          resolution_reason: null,
          metadata: {}
        }
      ]
    });

    journalDraftService.getApprovalRequest.mockResolvedValue({
      organization_id: organizationId,
      approval_request_id: 'aa0e8400-e29b-41d4-a716-446655440000',
      actor_context: {
        appUserId: 'app-user-1',
        authUserId: delegatedAuthUserId,
        organizationRole: 'accountant',
        firmRole: null,
        firmId: 'firm-1'
      },
      status: 'pending',
      priority: 'high',
      action_type: 'ledger.journal_draft.submitted_for_approval',
      submitted_at: '2026-04-23T10:00:00.000Z',
      submitted_by: {
        actor_type: 'agent',
        actor_id: 'test-agent-client',
        user_id: 'app-user-1'
      },
      target: {
        entity_type: 'journal_entry_draft',
        entity_id: '880e8400-e29b-41d4-a716-446655440000',
        draft_number: 'JE-000001',
        draft_status: 'pending_approval',
        proposal_id: '990e8400-e29b-41d4-a716-446655440000',
        proposal_status: 'pending_approval'
      },
      current_approver_user_id: null,
      expires_at: null,
      resolved_at: null,
      resolved_by_user_id: null,
      resolution_reason: null,
      metadata: {},
      actions: [
        {
          approval_action_id: 'action-1',
          action: 'submitted',
          action_timestamp: '2026-04-23T10:00:00.000Z',
          actor_type: 'agent',
          actor_id: 'test-agent-client',
          actor_display_name: 'test-agent',
          user_id: 'app-user-1',
          decision_reason: null,
          comments: null,
          request_id: 'request-1',
          correlation_id: 'corr-1',
          idempotency_key: 'idem-1',
          metadata: {}
        }
      ]
    });

    journalDraftService.resolveApprovalRequest.mockResolvedValue({
      organization_id: organizationId,
      approval_request_id: 'aa0e8400-e29b-41d4-a716-446655440000',
      draft_id: '880e8400-e29b-41d4-a716-446655440000',
      draft_number: 'JE-000001',
      proposal_id: '990e8400-e29b-41d4-a716-446655440000',
      actor_context: {
        appUserId: 'app-user-1',
        authUserId: delegatedAuthUserId,
        organizationRole: 'accountant',
        firmRole: null,
        firmId: 'firm-1'
      },
      status: 'approved',
      draft_status: 'approved',
      proposal_status: 'approved',
      resolved_at: '2026-04-23T11:00:00.000Z',
      resolution_reason: 'Threshold review complete'
    });

    journalDraftService.postApprovedJournalEntry.mockResolvedValue({
      organization_id: organizationId,
      draft_id: '880e8400-e29b-41d4-a716-446655440000',
      draft_number: 'JE-000001',
      proposal_id: '990e8400-e29b-41d4-a716-446655440000',
      journal_entry_id: 'bb0e8400-e29b-41d4-a716-446655440000',
      entry_number: 'JE-000001',
      actor_context: {
        appUserId: 'app-user-1',
        authUserId: delegatedAuthUserId,
        organizationRole: 'accountant',
        firmRole: null,
        firmId: 'firm-1'
      },
      status: 'posted',
      draft_status: 'posted',
      proposal_status: 'posted',
      posted_at: '2026-04-23T12:00:00.000Z',
      line_count: 2
    });

    journalDraftService.reversePostedJournalEntry.mockResolvedValue({
      organization_id: organizationId,
      original_journal_entry_id: 'bb0e8400-e29b-41d4-a716-446655440000',
      original_entry_number: 'JE-000001',
      reversal_journal_entry_id: 'cc0e8400-e29b-41d4-a716-446655440000',
      reversal_entry_number: 'JE-000002',
      journal_entry_reversal_id: 'dd0e8400-e29b-41d4-a716-446655440000',
      actor_context: {
        appUserId: 'app-user-1',
        authUserId: delegatedAuthUserId,
        organizationRole: 'accountant',
        firmRole: null,
        firmId: 'firm-1'
      },
      status: 'reversed',
      reversal_status: 'posted',
      reversal_date: '2026-04-24',
      reason: 'Customer invoice voided',
      line_count: 2,
      posted_at: '2026-04-24T09:00:00.000Z'
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
          provide: JournalDraftService,
          useValue: journalDraftService
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
        expect.objectContaining({ name: 'get_trial_balance' }),
        expect.objectContaining({ name: 'get_agent_proposal' }),
        expect.objectContaining({ name: 'get_entity_timeline' }),
        expect.objectContaining({ name: 'get_approval_request' }),
        expect.objectContaining({ name: 'get_journal_entry' }),
        expect.objectContaining({ name: 'get_journal_entry_reversal_chain' }),
        expect.objectContaining({ name: 'list_agent_proposals' }),
        expect.objectContaining({ name: 'list_audit_events' }),
        expect.objectContaining({ name: 'list_approval_requests' }),
        expect.objectContaining({ name: 'list_journal_entries' }),
        expect.objectContaining({ name: 'post_approved_journal_entry' }),
        expect.objectContaining({ name: 'rework_rejected_journal_entry_draft' }),
        expect.objectContaining({ name: 'reverse_posted_journal_entry' }),
        expect.objectContaining({ name: 'resubmit_journal_entry_draft_for_approval' }),
        expect.objectContaining({ name: 'resolve_approval_request' }),
        expect.objectContaining({ name: 'get_journal_entry_draft' }),
        expect.objectContaining({ name: 'create_journal_entry_draft' }),
        expect.objectContaining({ name: 'submit_journal_entry_draft_for_approval' })
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

  it('creates journal entry drafts for delegated agent callers', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/agent-tools/execute')
      .set('x-agent-client-id', 'test-agent-client')
      .set('x-agent-client-secret', 'test-secret')
      .set('x-delegated-auth-user-id', delegatedAuthUserId)
      .send({
        tool: 'create_journal_entry_draft',
        idempotency_key: 'idem-create-journal-entry-draft',
        input: {
          organization_id: organizationId,
          entry_date: '2026-04-01',
          source_type: 'manual_adjustment',
          memo: 'Utilities accrual',
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
    expect(journalDraftService.createJournalEntryDraft).toHaveBeenCalled();
    expect(response.body.result).toEqual(
      expect.objectContaining({
        draft_number: 'JE-000001',
        proposal_id: '990e8400-e29b-41d4-a716-446655440000'
      })
    );
  });

  it('reworks rejected journal entry drafts for delegated agent callers', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/agent-tools/execute')
      .set('x-agent-client-id', 'test-agent-client')
      .set('x-agent-client-secret', 'test-secret')
      .set('x-delegated-auth-user-id', delegatedAuthUserId)
      .send({
        tool: 'rework_rejected_journal_entry_draft',
        idempotency_key: 'idem-rework-journal-entry-draft',
        input: {
          organization_id: organizationId,
          draft_id: '880e8400-e29b-41d4-a716-446655440000',
          entry_date: '2026-04-02',
          source_type: 'manual_adjustment',
          memo: 'Utilities accrual revised',
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
    expect(journalDraftService.reworkRejectedJournalEntryDraft).toHaveBeenCalled();
    expect(response.body.result).toEqual(
      expect.objectContaining({
        draft_number: 'JE-000001',
        status: 'validated',
        line_count: 2
      })
    );
  });

  it('returns journal entry drafts for delegated agent callers', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/agent-tools/execute')
      .set('x-agent-client-id', 'test-agent-client')
      .set('x-agent-client-secret', 'test-secret')
      .set('x-delegated-auth-user-id', delegatedAuthUserId)
      .send({
        tool: 'get_journal_entry_draft',
        input: {
          organization_id: organizationId,
          draft_id: '880e8400-e29b-41d4-a716-446655440000'
        }
      })
      .expect(201);

    expect(response.body.ok).toBe(true);
    expect(journalDraftService.getJournalEntryDraft).toHaveBeenCalled();
    expect(response.body.result).toEqual(
      expect.objectContaining({
        draft_number: 'JE-000001',
        proposal: expect.objectContaining({
          proposal_id: '990e8400-e29b-41d4-a716-446655440000'
        })
      })
    );
  });

  it('lists audit events for delegated agent callers', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/agent-tools/execute')
      .set('x-agent-client-id', 'test-agent-client')
      .set('x-agent-client-secret', 'test-secret')
      .set('x-delegated-auth-user-id', delegatedAuthUserId)
      .send({
        tool: 'list_audit_events',
        input: {
          organization_id: organizationId,
          entity_type: 'journal_entry_draft',
          entity_id: '880e8400-e29b-41d4-a716-446655440000',
          limit: 20
        }
      })
      .expect(201);

    expect(response.body.ok).toBe(true);
    expect(journalDraftService.listAuditEvents).toHaveBeenCalled();
    expect(response.body.result.items).toEqual([
      expect.objectContaining({
        event_name: 'approval.action.approved'
      })
    ]);
  });

  it('returns an entity timeline for delegated agent callers', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/agent-tools/execute')
      .set('x-agent-client-id', 'test-agent-client')
      .set('x-agent-client-secret', 'test-secret')
      .set('x-delegated-auth-user-id', delegatedAuthUserId)
      .send({
        tool: 'get_entity_timeline',
        input: {
          organization_id: organizationId,
          entity_type: 'journal_entry_draft',
          entity_id: '880e8400-e29b-41d4-a716-446655440000'
        }
      })
      .expect(201);

    expect(response.body.ok).toBe(true);
    expect(journalDraftService.getEntityTimeline).toHaveBeenCalled();
    expect(response.body.result.items).toEqual([
      expect.objectContaining({
        event_name: 'approval.action.submitted'
      })
    ]);
  });

  it('lists posted journal entries for delegated agent callers', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/agent-tools/execute')
      .set('x-agent-client-id', 'test-agent-client')
      .set('x-agent-client-secret', 'test-secret')
      .set('x-delegated-auth-user-id', delegatedAuthUserId)
      .send({
        tool: 'list_journal_entries',
        input: {
          organization_id: organizationId,
          status: 'reversed',
          from_date: '2026-04-01',
          to_date: '2026-04-30',
          limit: 10
        }
      })
      .expect(201);

    expect(response.body.ok).toBe(true);
    expect(journalDraftService.listJournalEntries).toHaveBeenCalled();
    expect(response.body.result.items).toEqual([
      expect.objectContaining({
        journal_entry_id: 'bb0e8400-e29b-41d4-a716-446655440000',
        reversal_journal_entry_id: 'cc0e8400-e29b-41d4-a716-446655440000'
      })
    ]);
  });

  it('returns one posted journal entry for delegated agent callers', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/agent-tools/execute')
      .set('x-agent-client-id', 'test-agent-client')
      .set('x-agent-client-secret', 'test-secret')
      .set('x-delegated-auth-user-id', delegatedAuthUserId)
      .send({
        tool: 'get_journal_entry',
        input: {
          organization_id: organizationId,
          journal_entry_id: 'bb0e8400-e29b-41d4-a716-446655440000'
        }
      })
      .expect(201);

    expect(response.body.ok).toBe(true);
    expect(journalDraftService.getJournalEntry).toHaveBeenCalled();
    expect(response.body.result).toEqual(
      expect.objectContaining({
        entry_number: 'JE-000001',
        reversal_linkage: expect.objectContaining({
          reversed_by_journal_entry_id: 'cc0e8400-e29b-41d4-a716-446655440000'
        })
      })
    );
  });

  it('returns journal entry reversal chains for delegated agent callers', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/agent-tools/execute')
      .set('x-agent-client-id', 'test-agent-client')
      .set('x-agent-client-secret', 'test-secret')
      .set('x-delegated-auth-user-id', delegatedAuthUserId)
      .send({
        tool: 'get_journal_entry_reversal_chain',
        input: {
          organization_id: organizationId,
          journal_entry_id: 'cc0e8400-e29b-41d4-a716-446655440000'
        }
      })
      .expect(201);

    expect(response.body.ok).toBe(true);
    expect(journalDraftService.getJournalEntryReversalChain).toHaveBeenCalled();
    expect(response.body.result).toEqual(
      expect.objectContaining({
        original_entry: expect.objectContaining({
          entry_number: 'JE-000001'
        }),
        reversal: expect.objectContaining({
          journal_entry: expect.objectContaining({
            entry_number: 'JE-000002'
          })
        })
      })
    );
  });

  it('lists agent proposals for delegated agent callers', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/agent-tools/execute')
      .set('x-agent-client-id', 'test-agent-client')
      .set('x-agent-client-secret', 'test-secret')
      .set('x-delegated-auth-user-id', delegatedAuthUserId)
      .send({
        tool: 'list_agent_proposals',
        input: {
          organization_id: organizationId,
          status: 'needs_review',
          limit: 10
        }
      })
      .expect(201);

    expect(response.body.ok).toBe(true);
    expect(journalDraftService.listAgentProposals).toHaveBeenCalled();
    expect(response.body.result).toEqual(
      expect.objectContaining({
        filters: {
          status: 'needs_review',
          limit: 10
        },
        items: [
          expect.objectContaining({
            proposal_id: '990e8400-e29b-41d4-a716-446655440000',
            draft_number: 'JE-000001'
          })
        ]
      })
    );
  });

  it('returns one agent proposal for delegated agent callers', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/agent-tools/execute')
      .set('x-agent-client-id', 'test-agent-client')
      .set('x-agent-client-secret', 'test-secret')
      .set('x-delegated-auth-user-id', delegatedAuthUserId)
      .send({
        tool: 'get_agent_proposal',
        input: {
          organization_id: organizationId,
          proposal_id: '990e8400-e29b-41d4-a716-446655440000'
        }
      })
      .expect(201);

    expect(response.body.ok).toBe(true);
    expect(journalDraftService.getAgentProposal).toHaveBeenCalled();
    expect(response.body.result).toEqual(
      expect.objectContaining({
        proposal_id: '990e8400-e29b-41d4-a716-446655440000',
        target: expect.objectContaining({
          draft_number: 'JE-000001'
        })
      })
    );
  });

  it('lists approval requests for delegated agent callers', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/agent-tools/execute')
      .set('x-agent-client-id', 'test-agent-client')
      .set('x-agent-client-secret', 'test-secret')
      .set('x-delegated-auth-user-id', delegatedAuthUserId)
      .send({
        tool: 'list_approval_requests',
        input: {
          organization_id: organizationId,
          status: 'pending',
          limit: 10
        }
      })
      .expect(201);

    expect(response.body.ok).toBe(true);
    expect(journalDraftService.listApprovalRequests).toHaveBeenCalled();
    expect(response.body.result).toEqual(
      expect.objectContaining({
        filters: {
          status: 'pending',
          limit: 10
        },
        items: [
          expect.objectContaining({
            approval_request_id: 'aa0e8400-e29b-41d4-a716-446655440000'
          })
        ]
      })
    );
  });

  it('returns one approval request for delegated agent callers', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/agent-tools/execute')
      .set('x-agent-client-id', 'test-agent-client')
      .set('x-agent-client-secret', 'test-secret')
      .set('x-delegated-auth-user-id', delegatedAuthUserId)
      .send({
        tool: 'get_approval_request',
        input: {
          organization_id: organizationId,
          approval_request_id: 'aa0e8400-e29b-41d4-a716-446655440000'
        }
      })
      .expect(201);

    expect(response.body.ok).toBe(true);
    expect(journalDraftService.getApprovalRequest).toHaveBeenCalled();
    expect(response.body.result).toEqual(
      expect.objectContaining({
        approval_request_id: 'aa0e8400-e29b-41d4-a716-446655440000',
        actions: [expect.objectContaining({ action: 'submitted' })]
      })
    );
  });

  it('resolves approval requests for delegated agent callers', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/agent-tools/execute')
      .set('x-agent-client-id', 'test-agent-client')
      .set('x-agent-client-secret', 'test-secret')
      .set('x-delegated-auth-user-id', delegatedAuthUserId)
      .send({
        tool: 'resolve_approval_request',
        idempotency_key: 'idem-resolve-approval-request',
        input: {
          organization_id: organizationId,
          approval_request_id: 'aa0e8400-e29b-41d4-a716-446655440000',
          resolution: 'approved',
          reason: 'Threshold review complete'
        }
      })
      .expect(201);

    expect(response.body.ok).toBe(true);
    expect(journalDraftService.resolveApprovalRequest).toHaveBeenCalled();
    expect(response.body.result).toEqual(
      expect.objectContaining({
        approval_request_id: 'aa0e8400-e29b-41d4-a716-446655440000',
        status: 'approved',
        draft_status: 'approved',
        proposal_status: 'approved'
      })
    );
  });

  it('returns invalid state errors when approval resolution is attempted for an ineligible request', async () => {
    journalDraftService.resolveApprovalRequest.mockRejectedValueOnce(
      new AppError(
        'APPROVAL_REQUEST_INVALID_STATE',
        'Approval request aa0e8400-e29b-41d4-a716-446655440000 must be pending before it can be resolved.'
      )
    );

    const response = await request(app.getHttpServer())
      .post('/api/v1/agent-tools/execute')
      .set('x-agent-client-id', 'test-agent-client')
      .set('x-agent-client-secret', 'test-secret')
      .set('x-delegated-auth-user-id', delegatedAuthUserId)
      .send({
        tool: 'resolve_approval_request',
        idempotency_key: 'idem-resolve-approval-request-invalid',
        input: {
          organization_id: organizationId,
          approval_request_id: 'aa0e8400-e29b-41d4-a716-446655440000',
          resolution: 'approved'
        }
      })
      .expect(201);

    expect(response.body.ok).toBe(false);
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'APPROVAL_REQUEST_INVALID_STATE' })
      ])
    );
  });

  it('posts approved journal entries for delegated agent callers', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/agent-tools/execute')
      .set('x-agent-client-id', 'test-agent-client')
      .set('x-agent-client-secret', 'test-secret')
      .set('x-delegated-auth-user-id', delegatedAuthUserId)
      .send({
        tool: 'post_approved_journal_entry',
        idempotency_key: 'idem-post-approved-journal-entry',
        input: {
          organization_id: organizationId,
          draft_id: '880e8400-e29b-41d4-a716-446655440000'
        }
      })
      .expect(201);

    expect(response.body.ok).toBe(true);
    expect(journalDraftService.postApprovedJournalEntry).toHaveBeenCalled();
    expect(response.body.result).toEqual(
      expect.objectContaining({
        journal_entry_id: 'bb0e8400-e29b-41d4-a716-446655440000',
        entry_number: 'JE-000001',
        status: 'posted'
      })
    );
  });

  it('returns invalid state errors when posting is attempted for an ineligible draft', async () => {
    journalDraftService.postApprovedJournalEntry.mockRejectedValueOnce(
      new AppError(
        'DRAFT_POST_INVALID_STATE',
        'Journal draft 880e8400-e29b-41d4-a716-446655440000 must be approved before it can be posted.'
      )
    );

    const response = await request(app.getHttpServer())
      .post('/api/v1/agent-tools/execute')
      .set('x-agent-client-id', 'test-agent-client')
      .set('x-agent-client-secret', 'test-secret')
      .set('x-delegated-auth-user-id', delegatedAuthUserId)
      .send({
        tool: 'post_approved_journal_entry',
        idempotency_key: 'idem-post-approved-journal-entry-invalid',
        input: {
          organization_id: organizationId,
          draft_id: '880e8400-e29b-41d4-a716-446655440000'
        }
      })
      .expect(201);

    expect(response.body.ok).toBe(false);
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'DRAFT_POST_INVALID_STATE' })
      ])
    );
  });

  it('reverses posted journal entries for delegated agent callers', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/agent-tools/execute')
      .set('x-agent-client-id', 'test-agent-client')
      .set('x-agent-client-secret', 'test-secret')
      .set('x-delegated-auth-user-id', delegatedAuthUserId)
      .send({
        tool: 'reverse_posted_journal_entry',
        idempotency_key: 'idem-reverse-posted-journal-entry',
        input: {
          organization_id: organizationId,
          journal_entry_id: 'bb0e8400-e29b-41d4-a716-446655440000',
          reversal_date: '2026-04-24',
          reason: 'Customer invoice voided'
        }
      })
      .expect(201);

    expect(response.body.ok).toBe(true);
    expect(journalDraftService.reversePostedJournalEntry).toHaveBeenCalled();
    expect(response.body.result).toEqual(
      expect.objectContaining({
        original_entry_number: 'JE-000001',
        reversal_entry_number: 'JE-000002',
        status: 'reversed'
      })
    );
  });

  it('returns invalid state errors when reversal is attempted for an ineligible posted entry', async () => {
    journalDraftService.reversePostedJournalEntry.mockRejectedValueOnce(
      new AppError(
        'REVERSAL_NOT_ALLOWED',
        'Journal entry bb0e8400-e29b-41d4-a716-446655440000 has already been reversed by entry cc0e8400-e29b-41d4-a716-446655440000.'
      )
    );

    const response = await request(app.getHttpServer())
      .post('/api/v1/agent-tools/execute')
      .set('x-agent-client-id', 'test-agent-client')
      .set('x-agent-client-secret', 'test-secret')
      .set('x-delegated-auth-user-id', delegatedAuthUserId)
      .send({
        tool: 'reverse_posted_journal_entry',
        idempotency_key: 'idem-reverse-posted-journal-entry-invalid',
        input: {
          organization_id: organizationId,
          journal_entry_id: 'bb0e8400-e29b-41d4-a716-446655440000',
          reversal_date: '2026-04-24',
          reason: 'Customer invoice voided'
        }
      })
      .expect(201);

    expect(response.body.ok).toBe(false);
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'REVERSAL_NOT_ALLOWED' })
      ])
    );
  });

  it('returns tenant access denied when delegated reversal fails membership checks', async () => {
    journalDraftService.reversePostedJournalEntry.mockRejectedValueOnce(
      new ForbiddenException('Actor is not allowed to access the requested organization.')
    );

    const response = await request(app.getHttpServer())
      .post('/api/v1/agent-tools/execute')
      .set('x-agent-client-id', 'test-agent-client')
      .set('x-agent-client-secret', 'test-secret')
      .set('x-delegated-auth-user-id', delegatedAuthUserId)
      .send({
        tool: 'reverse_posted_journal_entry',
        idempotency_key: 'idem-reverse-posted-journal-entry-denied',
        input: {
          organization_id: organizationId,
          journal_entry_id: 'bb0e8400-e29b-41d4-a716-446655440000',
          reversal_date: '2026-04-24',
          reason: 'Customer invoice voided'
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

  it('returns tenant access denied when delegated posted-entry reads fail membership checks', async () => {
    journalDraftService.getJournalEntry.mockRejectedValueOnce(
      new ForbiddenException('Actor is not allowed to access the requested organization.')
    );

    const response = await request(app.getHttpServer())
      .post('/api/v1/agent-tools/execute')
      .set('x-agent-client-id', 'test-agent-client')
      .set('x-agent-client-secret', 'test-secret')
      .set('x-delegated-auth-user-id', delegatedAuthUserId)
      .send({
        tool: 'get_journal_entry',
        input: {
          organization_id: organizationId,
          journal_entry_id: 'bb0e8400-e29b-41d4-a716-446655440000'
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

  it('returns tenant access denied when delegated audit reads fail membership checks', async () => {
    journalDraftService.getEntityTimeline.mockRejectedValueOnce(
      new ForbiddenException('Actor is not allowed to access the requested organization.')
    );

    const response = await request(app.getHttpServer())
      .post('/api/v1/agent-tools/execute')
      .set('x-agent-client-id', 'test-agent-client')
      .set('x-agent-client-secret', 'test-secret')
      .set('x-delegated-auth-user-id', delegatedAuthUserId)
      .send({
        tool: 'get_entity_timeline',
        input: {
          organization_id: organizationId,
          entity_type: 'journal_entry_draft',
          entity_id: '880e8400-e29b-41d4-a716-446655440000'
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

  it('returns tenant access denied when delegated posting fails membership checks', async () => {
    journalDraftService.postApprovedJournalEntry.mockRejectedValueOnce(
      new ForbiddenException('Actor is not allowed to access the requested organization.')
    );

    const response = await request(app.getHttpServer())
      .post('/api/v1/agent-tools/execute')
      .set('x-agent-client-id', 'test-agent-client')
      .set('x-agent-client-secret', 'test-secret')
      .set('x-delegated-auth-user-id', delegatedAuthUserId)
      .send({
        tool: 'post_approved_journal_entry',
        idempotency_key: 'idem-post-approved-journal-entry-denied',
        input: {
          organization_id: organizationId,
          draft_id: '880e8400-e29b-41d4-a716-446655440000'
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

  it('returns tenant access denied when delegated approval resolution fails membership checks', async () => {
    journalDraftService.resolveApprovalRequest.mockRejectedValueOnce(
      new ForbiddenException('Actor is not allowed to access the requested organization.')
    );

    const response = await request(app.getHttpServer())
      .post('/api/v1/agent-tools/execute')
      .set('x-agent-client-id', 'test-agent-client')
      .set('x-agent-client-secret', 'test-secret')
      .set('x-delegated-auth-user-id', delegatedAuthUserId)
      .send({
        tool: 'resolve_approval_request',
        idempotency_key: 'idem-resolve-approval-request-denied',
        input: {
          organization_id: organizationId,
          approval_request_id: 'aa0e8400-e29b-41d4-a716-446655440000',
          resolution: 'approved'
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

  it('submits journal entry drafts for approval for delegated agent callers', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/agent-tools/execute')
      .set('x-agent-client-id', 'test-agent-client')
      .set('x-agent-client-secret', 'test-secret')
      .set('x-delegated-auth-user-id', delegatedAuthUserId)
      .send({
        tool: 'submit_journal_entry_draft_for_approval',
        idempotency_key: 'idem-submit-journal-entry-draft',
        input: {
          organization_id: organizationId,
          draft_id: '880e8400-e29b-41d4-a716-446655440000',
          priority: 'high'
        }
      })
      .expect(201);

    expect(response.body.ok).toBe(true);
    expect(journalDraftService.submitJournalEntryDraftForApproval).toHaveBeenCalled();
    expect(response.body.result).toEqual(
      expect.objectContaining({
        approval_request_id: 'aa0e8400-e29b-41d4-a716-446655440000',
        draft_number: 'JE-000001',
        status: 'pending_approval'
      })
    );
  });

  it('resubmits rejected journal entry drafts for approval for delegated agent callers', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/agent-tools/execute')
      .set('x-agent-client-id', 'test-agent-client')
      .set('x-agent-client-secret', 'test-secret')
      .set('x-delegated-auth-user-id', delegatedAuthUserId)
      .send({
        tool: 'resubmit_journal_entry_draft_for_approval',
        idempotency_key: 'idem-resubmit-journal-entry-draft',
        input: {
          organization_id: organizationId,
          draft_id: '880e8400-e29b-41d4-a716-446655440000',
          priority: 'high'
        }
      })
      .expect(201);

    expect(response.body.ok).toBe(true);
    expect(journalDraftService.resubmitJournalEntryDraftForApproval).toHaveBeenCalled();
    expect(response.body.result).toEqual(
      expect.objectContaining({
        approval_request_id: 'ab0e8400-e29b-41d4-a716-446655440000',
        draft_number: 'JE-000001',
        status: 'pending_approval'
      })
    );
  });

  it('returns invalid state errors when approval submission is attempted for an ineligible draft', async () => {
    journalDraftService.submitJournalEntryDraftForApproval.mockRejectedValueOnce(
      new AppError(
        'DRAFT_SUBMISSION_INVALID_STATE',
        'Journal draft 880e8400-e29b-41d4-a716-446655440000 must be in validated status before it can be submitted for approval.'
      )
    );

    const response = await request(app.getHttpServer())
      .post('/api/v1/agent-tools/execute')
      .set('x-agent-client-id', 'test-agent-client')
      .set('x-agent-client-secret', 'test-secret')
      .set('x-delegated-auth-user-id', delegatedAuthUserId)
      .send({
        tool: 'submit_journal_entry_draft_for_approval',
        idempotency_key: 'idem-submit-journal-entry-draft-invalid',
        input: {
          organization_id: organizationId,
          draft_id: '880e8400-e29b-41d4-a716-446655440000'
        }
      })
      .expect(201);

    expect(response.body.ok).toBe(false);
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'DRAFT_SUBMISSION_INVALID_STATE' })
      ])
    );
  });

  it('returns invalid state errors when rejected draft rework is attempted for an ineligible draft', async () => {
    journalDraftService.reworkRejectedJournalEntryDraft.mockRejectedValueOnce(
      new AppError(
        'DRAFT_REWORK_INVALID_STATE',
        'Journal draft 880e8400-e29b-41d4-a716-446655440000 must be rejected before it can be reworked.'
      )
    );

    const response = await request(app.getHttpServer())
      .post('/api/v1/agent-tools/execute')
      .set('x-agent-client-id', 'test-agent-client')
      .set('x-agent-client-secret', 'test-secret')
      .set('x-delegated-auth-user-id', delegatedAuthUserId)
      .send({
        tool: 'rework_rejected_journal_entry_draft',
        idempotency_key: 'idem-rework-journal-entry-draft-invalid',
        input: {
          organization_id: organizationId,
          draft_id: '880e8400-e29b-41d4-a716-446655440000',
          entry_date: '2026-04-02',
          source_type: 'manual_adjustment',
          memo: 'Utilities accrual revised',
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

    expect(response.body.ok).toBe(false);
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'DRAFT_REWORK_INVALID_STATE' })
      ])
    );
  });

  it('returns tenant access denied when delegated rejected draft rework fails membership checks', async () => {
    journalDraftService.reworkRejectedJournalEntryDraft.mockRejectedValueOnce(
      new ForbiddenException('Actor is not allowed to access the requested organization.')
    );

    const response = await request(app.getHttpServer())
      .post('/api/v1/agent-tools/execute')
      .set('x-agent-client-id', 'test-agent-client')
      .set('x-agent-client-secret', 'test-secret')
      .set('x-delegated-auth-user-id', delegatedAuthUserId)
      .send({
        tool: 'rework_rejected_journal_entry_draft',
        idempotency_key: 'idem-rework-journal-entry-draft-denied',
        input: {
          organization_id: organizationId,
          draft_id: '880e8400-e29b-41d4-a716-446655440000',
          entry_date: '2026-04-02',
          source_type: 'manual_adjustment',
          memo: 'Utilities accrual revised',
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

    expect(response.body.ok).toBe(false);
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'TENANT_ACCESS_DENIED' })
      ])
    );
  });

  it('returns invalid state errors when draft resubmission is attempted for an ineligible draft', async () => {
    journalDraftService.resubmitJournalEntryDraftForApproval.mockRejectedValueOnce(
      new AppError(
        'DRAFT_RESUBMISSION_INVALID_STATE',
        'Journal draft 880e8400-e29b-41d4-a716-446655440000 must be validated with a prior rejected, expired, or cancelled approval request before it can be resubmitted.'
      )
    );

    const response = await request(app.getHttpServer())
      .post('/api/v1/agent-tools/execute')
      .set('x-agent-client-id', 'test-agent-client')
      .set('x-agent-client-secret', 'test-secret')
      .set('x-delegated-auth-user-id', delegatedAuthUserId)
      .send({
        tool: 'resubmit_journal_entry_draft_for_approval',
        idempotency_key: 'idem-resubmit-journal-entry-draft-invalid',
        input: {
          organization_id: organizationId,
          draft_id: '880e8400-e29b-41d4-a716-446655440000'
        }
      })
      .expect(201);

    expect(response.body.ok).toBe(false);
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'DRAFT_RESUBMISSION_INVALID_STATE' })
      ])
    );
  });

  it('returns tenant access denied when delegated approval submission fails membership checks', async () => {
    journalDraftService.submitJournalEntryDraftForApproval.mockRejectedValueOnce(
      new ForbiddenException('Actor is not allowed to access the requested organization.')
    );

    const response = await request(app.getHttpServer())
      .post('/api/v1/agent-tools/execute')
      .set('x-agent-client-id', 'test-agent-client')
      .set('x-agent-client-secret', 'test-secret')
      .set('x-delegated-auth-user-id', delegatedAuthUserId)
      .send({
        tool: 'submit_journal_entry_draft_for_approval',
        idempotency_key: 'idem-submit-journal-entry-draft-denied',
        input: {
          organization_id: organizationId,
          draft_id: '880e8400-e29b-41d4-a716-446655440000'
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
