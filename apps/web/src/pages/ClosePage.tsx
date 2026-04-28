import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Field, TextInput } from '../components/ui/Field';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States';
import { Table, TableCell, TableRow } from '../components/ui/Table';
import { getCloseOverview } from '../lib/api';
import { formatCount, formatCurrency, formatDateTime } from '../lib/format';
import { useOperatorSession } from '../session/OperatorSessionContext';
import { useAsyncData } from './useAsyncData';

function today() {
  return new Date().toISOString().slice(0, 10);
}

function titleCase(value: string | null | undefined) {
  if (!value) {
    return 'Unclassified';
  }

  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function ClosePage() {
  const { session } = useOperatorSession();
  const [asOfDate, setAsOfDate] = useState(today());
  const { data, loading, error } = useAsyncData(
    () => getCloseOverview(session!, { asOfDate, limit: 10 }),
    [asOfDate, session]
  );

  if (loading) {
    return <LoadingState label="Loading close overview..." />;
  }

  if (error !== null) {
    return <ErrorState title="Close overview failed" body={error} />;
  }

  if (data === null) {
    return <EmptyState title="No close data" body="The backend did not return a close overview." />;
  }

  const cards = [
    { label: 'Pending approvals', count: data.counts.pendingApprovals, tone: 'pending' },
    { label: 'Open proposals', count: data.counts.openProposals, tone: 'needs_review' },
    { label: 'Schedule blockers', count: data.counts.scheduleBlockers, tone: 'variance_detected' },
    { label: 'Recent entries', count: data.counts.recentEntries, tone: 'posted' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-black/45">Close</p>
          <h2 className="mt-2 font-serif text-4xl text-ink">Period close cockpit</h2>
          <p className="mt-3 max-w-3xl text-sm text-black/65">
            Track the operational blockers that need review before close: approvals, proposals, support schedules, and recent ledger movement.
          </p>
        </div>
        <div className="w-full xl:max-w-xs">
          <Field label="As of date">
            <TextInput type="date" value={asOfDate} max={today()} onChange={(event) => setAsOfDate(event.target.value)} />
          </Field>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardContent className="space-y-3 py-6">
              <div className="flex items-start justify-between gap-3">
                <span className="text-sm font-medium text-black/60">{card.label}</span>
                <Badge value={card.tone} className="text-[10px]" />
              </div>
              <p className="text-4xl font-semibold text-ink">{formatCount(card.count)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Schedule blockers</CardTitle>
          </CardHeader>
          <CardContent>
            {data.scheduleBlockers.length === 0 ? (
              <EmptyState title="No schedule blockers" body="No unreconciled or variance schedules were returned for this as-of date." />
            ) : (
              <Table columns={['Schedule', 'As of', 'Variance', 'Open']}>
                {data.scheduleBlockers.map((run) => (
                  <TableRow key={run.scheduleRunId}>
                    <TableCell>
                      <div className="font-semibold text-ink">{run.scheduleName ?? titleCase(run.scheduleType)}</div>
                      <div className="text-xs text-black/55">{titleCase(run.reconciliationStatus ?? run.status)}</div>
                    </TableCell>
                    <TableCell>{run.asOfDate}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(run.variance)}</TableCell>
                    <TableCell>
                      <Link className="text-sm font-semibold text-accent" to={`/schedules/runs/${run.scheduleRunId}`}>
                        Review
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending approvals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.pendingApprovals.length === 0 ? (
              <EmptyState title="No pending approvals" body="Approval blockers will appear here when drafts or exceptions need review." />
            ) : (
              data.pendingApprovals.map((approval) => (
                <Link key={approval.approvalRequestId} to={`/approvals/${approval.approvalRequestId}`} className="block rounded-2xl bg-black/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">{approval.draftNumber ?? approval.approvalRequestId}</p>
                      <p className="text-xs text-black/55">{approval.title ?? approval.targetEntityType ?? 'Approval request'}</p>
                    </div>
                    <Badge value={approval.priority ?? approval.status} />
                  </div>
                  <p className="mt-2 text-xs text-black/50">{formatDateTime(approval.submittedAt)}</p>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Open proposals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.openProposals.length === 0 ? (
              <EmptyState title="No open proposals" body="Agent-backed proposals needing close review will appear here." />
            ) : (
              data.openProposals.map((proposal) => (
                <Link key={proposal.proposalId} to={`/proposals/${proposal.proposalId}`} className="block rounded-2xl bg-black/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">{proposal.title ?? proposal.proposalType}</p>
                      <p className="text-xs text-black/55">{proposal.draftNumber ?? proposal.proposalId}</p>
                    </div>
                    <Badge value={proposal.status} />
                  </div>
                  <p className="mt-2 text-xs text-black/50">{formatDateTime(proposal.createdAt)}</p>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent posted entries</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.recentEntries.length === 0 ? (
              <EmptyState title="No recent entries" body="Posted ledger movement through the close date will appear here." />
            ) : (
              data.recentEntries.map((entry) => (
                <Link key={entry.journalEntryId} to={`/ledger/entries/${entry.journalEntryId}`} className="block rounded-2xl bg-black/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">{entry.entryNumber ?? entry.journalEntryId}</p>
                      <p className="text-xs text-black/55">{entry.memo ?? entry.sourceType ?? 'Posted journal entry'}</p>
                    </div>
                    <Badge value={entry.status} />
                  </div>
                  <p className="mt-2 text-xs text-black/50">{entry.entryDate}</p>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
