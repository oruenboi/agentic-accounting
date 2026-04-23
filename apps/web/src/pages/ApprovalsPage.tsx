import { useState } from 'react';
import { Link } from 'react-router-dom';
import { listApprovalRequests } from '../lib/api';
import { useOperatorSession } from '../session/OperatorSessionContext';
import { useAsyncData } from './useAsyncData';
import { Badge } from '../components/ui/Badge';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States';
import { Table, TableCell, TableRow } from '../components/ui/Table';
import { Field, Select } from '../components/ui/Field';

export function ApprovalsPage() {
  const { session } = useOperatorSession();
  const [mode, setMode] = useState<'all' | 'assigned'>('all');
  const [status, setStatus] = useState('pending');
  const { data, loading, error } = useAsyncData(
    () => listApprovalRequests(session!, { assignedOnly: mode === 'assigned', status, limit: 25 }),
    [session, mode, status]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-black/45">Approvals</p>
          <h2 className="mt-2 font-serif text-4xl text-ink">Review queue</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Queue">
            <Select value={mode} onChange={(event) => setMode(event.target.value as 'all' | 'assigned')}>
              <option value="all">All pending approvals</option>
              <option value="assigned">Assigned to me</option>
            </Select>
          </Field>
          <Field label="Status">
            <Select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </Select>
          </Field>
        </div>
      </div>

      {loading ? <LoadingState label="Loading approvals…" /> : null}
      {error !== null ? <ErrorState title="Approval queue failed" body={error} /> : null}
      {!loading && error === null && data !== null && data.length === 0 ? (
        <EmptyState title="No approvals in this view" body="Switch queue mode or status to inspect more approval history." />
      ) : null}
      {!loading && error === null && data !== null && data.length > 0 ? (
        <Table columns={['Draft', 'Status', 'Priority', 'Current approver', 'Open']}>
          {data.map((approval) => (
            <TableRow key={approval.approvalRequestId}>
              <TableCell>
                <div className="font-semibold text-ink">{approval.draftNumber ?? approval.approvalRequestId}</div>
                <div className="text-xs text-black/55">{approval.title ?? approval.targetEntityType ?? 'Approval request'}</div>
              </TableCell>
              <TableCell>
                <Badge value={approval.status} />
              </TableCell>
              <TableCell>{approval.priority ?? 'normal'}</TableCell>
              <TableCell className="font-mono text-xs text-black/65">{approval.currentApproverUserId ?? 'Unassigned'}</TableCell>
              <TableCell>
                <Link className="text-sm font-semibold text-accent" to={`/approvals/${approval.approvalRequestId}`}>
                  Review
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </Table>
      ) : null}
    </div>
  );
}
