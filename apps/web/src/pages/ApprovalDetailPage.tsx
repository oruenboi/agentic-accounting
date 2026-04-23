import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { escalateApprovalRequest, getApprovalRequest, resolveApprovalRequest } from '../lib/api';
import { useOperatorSession } from '../session/OperatorSessionContext';
import { useAsyncData } from './useAsyncData';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { DetailList } from '../components/DetailList';
import { Field, TextArea } from '../components/ui/Field';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States';
import { formatDateTime } from '../lib/format';

export function ApprovalDetailPage() {
  const { approvalId = '' } = useParams();
  const navigate = useNavigate();
  const { session } = useOperatorSession();
  const [reason, setReason] = useState('Threshold review complete');
  const [escalationReason, setEscalationReason] = useState('Primary reviewer unavailable');
  const [actionError, setActionError] = useState<string | null>(null);
  const approvalState = useAsyncData(() => getApprovalRequest(session!, approvalId), [session, approvalId]);

  async function resolve(resolution: 'approved' | 'rejected') {
    try {
      setActionError(null);
      await resolveApprovalRequest(session!, approvalId, resolution, reason);
      navigate(0);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Resolution failed.');
    }
  }

  async function escalate() {
    try {
      setActionError(null);
      await escalateApprovalRequest(session!, approvalId, escalationReason);
      navigate(0);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Escalation failed.');
    }
  }

  if (approvalState.loading) {
    return <LoadingState label="Loading approval detail…" />;
  }

  if (approvalState.error !== null) {
    return <ErrorState title="Approval detail failed" body={approvalState.error} />;
  }

  if (approvalState.data === null) {
    return <EmptyState title="Approval not found" body="This approval request is not available for the active operator session." />;
  }

  const approval = approvalState.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-black/45">Approval detail</p>
          <h2 className="mt-2 font-serif text-4xl text-ink">{approval.draftNumber ?? approval.approvalRequestId}</h2>
        </div>
        <Badge value={approval.status} />
      </div>

      {actionError !== null ? <ErrorState title="Action failed" body={actionError} /> : null}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Approval request</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <DetailList
              items={[
                { label: 'Approval request', value: approval.approvalRequestId },
                { label: 'Status', value: <Badge value={approval.status} /> },
                { label: 'Priority', value: approval.priority ?? 'normal' },
                { label: 'Current approver', value: approval.currentApproverUserId ?? 'Unassigned' },
                {
                  label: 'Linked draft',
                  value:
                    approval.draftId !== null ? (
                      <Link className="font-semibold text-accent" to={`/audit/journal_entry_draft/${approval.draftId}`}>
                        {approval.draftNumber ?? approval.draftId}
                      </Link>
                    ) : (
                      'Unlinked'
                    )
                },
                { label: 'Submitted', value: formatDateTime(approval.submittedAt) }
              ]}
            />

            <div>
              <p className="text-sm font-semibold text-ink">Action history</p>
              <div className="mt-3 space-y-3">
                {approval.actionHistory.map((action) => (
                  <div key={action.actionId} className="rounded-2xl bg-black/[0.03] px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <Badge value={action.action} />
                      <span className="text-xs text-black/50">{formatDateTime(action.occurredAt)}</span>
                    </div>
                    <p className="mt-2 text-sm text-black/65">{action.reason ?? 'No reason recorded.'}</p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Operator controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Decision note">
              <TextArea value={reason} onChange={(event) => setReason(event.target.value)} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Button onClick={() => void resolve('approved')}>Approve</Button>
              <Button variant="danger" onClick={() => void resolve('rejected')}>
                Reject
              </Button>
            </div>
            <Field label="Escalation reason">
              <TextArea value={escalationReason} onChange={(event) => setEscalationReason(event.target.value)} />
            </Field>
            <Button variant="secondary" onClick={() => void escalate()}>
              Escalate approval
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
