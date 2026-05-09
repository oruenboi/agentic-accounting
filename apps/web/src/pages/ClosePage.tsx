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

function pluralize(value: number, singular: string, plural = `${singular}s`) {
  return `${formatCount(value)} ${value === 1 ? singular : plural}`;
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

  const blockerCount = data.counts.pendingApprovals + data.counts.openProposals + data.counts.scheduleBlockers;
  const closeReady = blockerCount === 0;
  const cards = [
    { label: 'Pending approvals', count: data.counts.pendingApprovals, tone: 'pending', href: '#pending-approvals', action: 'Resolve' },
    { label: 'Open proposals', count: data.counts.openProposals, tone: 'needs_review', href: '#open-proposals', action: 'Review' },
    { label: 'Schedule blockers', count: data.counts.scheduleBlockers, tone: 'variance_detected', href: '#schedule-blockers', action: 'Clear' },
    { label: 'Recent entries', count: data.counts.recentEntries, tone: 'posted', href: '#recent-entries', action: 'Inspect' }
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

      <Card>
        <CardContent className="flex flex-col gap-4 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <Badge value={closeReady ? 'ready_to_close' : 'close_blocked'} />
              <span className="text-sm font-semibold text-ink">
                {closeReady ? 'No close blockers returned for this date.' : `${pluralize(blockerCount, 'blocker')} need attention.`}
              </span>
            </div>
            <p className="mt-2 text-sm text-black/60">
              {closeReady
                ? 'Review recent posted entries, then keep the close evidence trail with schedules and reports.'
                : 'Work the queue from approvals to proposals to schedule variances, then confirm recent ledger movement.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a className="rounded-xl bg-white/70 px-3 py-2 text-sm font-semibold text-ink ring-1 ring-black/10 hover:bg-white" href="#schedule-blockers">
              Schedules
            </a>
            <a className="rounded-xl bg-white/70 px-3 py-2 text-sm font-semibold text-ink ring-1 ring-black/10 hover:bg-white" href="#pending-approvals">
              Approvals
            </a>
            <Link className="rounded-xl bg-ink px-3 py-2 text-sm font-semibold text-paper hover:bg-accent" to="/reports">
              Reports
            </Link>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-4">
        {cards.map((card) => (
          <a key={card.label} href={card.href} className="block focus:outline-none focus:ring-2 focus:ring-accent/40">
            <Card className="h-full transition hover:-translate-y-0.5 hover:bg-white">
            <CardContent className="space-y-3 py-6">
              <div className="flex items-start justify-between gap-3">
                <span className="text-sm font-medium text-black/60">{card.label}</span>
                <Badge value={card.tone} className="text-[10px]" />
              </div>
              <p className="text-4xl font-semibold text-ink">{formatCount(card.count)}</p>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">{card.action}</p>
            </CardContent>
            </Card>
          </a>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card id="schedule-blockers">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Schedule blockers</CardTitle>
              <Badge value={pluralize(data.counts.scheduleBlockers, 'open')} />
            </div>
          </CardHeader>
          <CardContent>
            {data.scheduleBlockers.length === 0 ? (
              <EmptyState title="No schedule blockers" body="No unreconciled or variance schedules were returned for this as-of date." />
            ) : (
              <Table columns={['Schedule', 'As of', 'Variance', 'Action']}>
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
                        Open review
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </Table>
            )}
          </CardContent>
        </Card>

        <Card id="pending-approvals">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Pending approvals</CardTitle>
              <Badge value={pluralize(data.counts.pendingApprovals, 'open')} />
            </div>
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
                  <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                    <span className="text-black/50">{formatDateTime(approval.submittedAt)}</span>
                    <span className="font-semibold text-accent">Open decision</span>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card id="open-proposals">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Open proposals</CardTitle>
              <Badge value={pluralize(data.counts.openProposals, 'open')} />
            </div>
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
                  <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                    <span className="text-black/50">{formatDateTime(proposal.createdAt)}</span>
                    <span className="font-semibold text-accent">Open proposal</span>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card id="recent-entries">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Recent posted entries</CardTitle>
              <Badge value={pluralize(data.counts.recentEntries, 'entry', 'entries')} />
            </div>
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
                  <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                    <span className="text-black/50">{entry.entryDate}</span>
                    <span className="font-semibold text-accent">Inspect entry</span>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
