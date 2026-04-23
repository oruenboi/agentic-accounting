import { useState } from 'react';
import { Link } from 'react-router-dom';
import { listAgentProposals } from '../lib/api';
import { useOperatorSession } from '../session/OperatorSessionContext';
import { useAsyncData } from './useAsyncData';
import { Badge } from '../components/ui/Badge';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States';
import { Table, TableCell, TableRow } from '../components/ui/Table';
import { Field, Select } from '../components/ui/Field';
import { formatDateTime } from '../lib/format';

export function ProposalsPage() {
  const { session } = useOperatorSession();
  const [status, setStatus] = useState('needs_review');
  const { data, loading, error } = useAsyncData(() => listAgentProposals(session!, { status, limit: 25 }), [session, status]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-black/45">Proposals</p>
          <h2 className="mt-2 font-serif text-4xl text-ink">Agent-backed review queue</h2>
        </div>
        <div className="w-full lg:max-w-xs">
          <Field label="Status filter">
            <Select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="needs_review">Needs review</option>
              <option value="pending_approval">Pending approval</option>
              <option value="approved">Approved</option>
              <option value="posted">Posted</option>
              <option value="rejected">Rejected</option>
            </Select>
          </Field>
        </div>
      </div>

      {loading ? <LoadingState label="Loading proposals…" /> : null}
      {error !== null ? <ErrorState title="Proposal queue failed" body={error} /> : null}
      {!loading && error === null && data !== null && data.length === 0 ? (
        <EmptyState title="No proposals for this filter" body="Adjust the queue filter or create new agent-backed draft work first." />
      ) : null}
      {!loading && error === null && data !== null && data.length > 0 ? (
        <Table columns={['Draft', 'Proposal', 'Status', 'Created', 'Open']}>
          {data.map((proposal) => (
            <TableRow key={proposal.proposalId}>
              <TableCell>
                <div className="font-semibold text-ink">{proposal.draftNumber ?? 'Unlinked draft'}</div>
                <div className="text-xs text-black/55">{proposal.title ?? proposal.proposalType}</div>
              </TableCell>
              <TableCell className="font-mono text-xs text-black/65">{proposal.proposalId}</TableCell>
              <TableCell>
                <Badge value={proposal.status} />
              </TableCell>
              <TableCell>{formatDateTime(proposal.createdAt)}</TableCell>
              <TableCell>
                <Link className="text-sm font-semibold text-accent" to={`/proposals/${proposal.proposalId}`}>
                  Inspect
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </Table>
      ) : null}
    </div>
  );
}
