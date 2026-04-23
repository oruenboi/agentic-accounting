import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States';
import { useOperatorSession } from '../session/OperatorSessionContext';
import { loadDashboardSnapshot } from '../lib/api';
import { useAsyncData } from './useAsyncData';
import { formatCount, formatDateTime } from '../lib/format';

export function DashboardPage() {
  const { session } = useOperatorSession();
  const { data, loading, error } = useAsyncData(() => loadDashboardSnapshot(session!), [session]);

  if (loading) {
    return <LoadingState label="Loading dashboard queues…" />;
  }

  if (error !== null) {
    return <ErrorState title="Dashboard load failed" body={error} />;
  }

  if (data === null) {
    return <EmptyState title="No dashboard data" body="The backend did not return a dashboard snapshot." />;
  }

  const cards = [
    { label: 'Open proposals', count: data.openProposals.length, tone: 'needs_review' },
    { label: 'Pending approvals', count: data.pendingApprovals.length, tone: 'pending_approval' },
    { label: 'Assigned to me', count: data.assignedApprovals.length, tone: 'approved' },
    { label: 'Recent entries', count: data.recentEntries.length, tone: 'posted' }
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-black/45">Dashboard</p>
        <h2 className="mt-2 font-serif text-4xl text-ink">Operator triage</h2>
        <p className="mt-3 max-w-3xl text-sm text-black/65">
          Start from active proposals and approvals, then drill into the posted ledger and audit timeline only when context demands it.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardContent className="space-y-3 py-6">
              <div className="flex items-start justify-between">
                <span className="text-sm font-medium text-black/60">{card.label}</span>
                <Badge value={card.tone} className="text-[10px]" />
              </div>
              <p className="text-4xl font-semibold text-ink">{formatCount(card.count)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Recent proposals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.openProposals.length === 0 ? (
              <EmptyState title="No open proposals" body="Agent-backed proposal work will appear here once drafts need review." />
            ) : (
              data.openProposals.map((proposal) => (
                <Link key={proposal.proposalId} to={`/proposals/${proposal.proposalId}`} className="block rounded-2xl bg-black/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">{proposal.draftNumber ?? proposal.proposalId}</p>
                      <p className="text-xs text-black/55">{proposal.title ?? proposal.proposalType}</p>
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
            <CardTitle>Pending approvals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.pendingApprovals.map((approval) => (
              <Link key={approval.approvalRequestId} to={`/approvals/${approval.approvalRequestId}`} className="block rounded-2xl bg-black/[0.03] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">{approval.draftNumber ?? approval.approvalRequestId}</p>
                    <p className="text-xs text-black/55">{approval.title ?? approval.targetEntityType ?? 'Approval request'}</p>
                  </div>
                  <Badge value={approval.status} />
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent posted entries</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.recentEntries.map((entry) => (
              <Link key={entry.journalEntryId} to={`/ledger/entries/${entry.journalEntryId}`} className="block rounded-2xl bg-black/[0.03] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">{entry.entryNumber ?? entry.journalEntryId}</p>
                    <p className="text-xs text-black/55">{entry.memo ?? entry.sourceType ?? 'Posted journal entry'}</p>
                  </div>
                  <Badge value={entry.status} />
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
