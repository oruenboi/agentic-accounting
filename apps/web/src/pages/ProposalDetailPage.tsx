import { Link, useParams } from 'react-router-dom';
import { getAgentProposal, getJournalEntryDraft } from '../lib/api';
import { useOperatorSession } from '../session/OperatorSessionContext';
import { useAsyncData } from './useAsyncData';
import { Badge } from '../components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { DetailList } from '../components/DetailList';
import { JournalLinesTable } from '../components/JournalLinesTable';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States';
import { formatDateTime } from '../lib/format';

export function ProposalDetailPage() {
  const { proposalId = '' } = useParams();
  const { session } = useOperatorSession();
  const proposalState = useAsyncData(() => getAgentProposal(session!, proposalId), [session, proposalId]);
  const draftState = useAsyncData(
    async () => {
      if (proposalState.data?.target.entityId === null || proposalState.data?.target.entityId === undefined) {
        return null;
      }

      return getJournalEntryDraft(session!, proposalState.data.target.entityId);
    },
    [session, proposalState.data?.target.entityId]
  );

  if (proposalState.loading) {
    return <LoadingState label="Loading proposal detail…" />;
  }

  if (proposalState.error !== null) {
    return <ErrorState title="Proposal detail failed" body={proposalState.error} />;
  }

  if (proposalState.data === null) {
    return <EmptyState title="Proposal not found" body="This proposal is not available for the active operator session." />;
  }

  const proposal = proposalState.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-black/45">Proposal detail</p>
          <h2 className="mt-2 font-serif text-4xl text-ink">{proposal.draftNumber ?? proposal.proposalId}</h2>
          <p className="mt-3 text-sm text-black/65">{proposal.description ?? proposal.title ?? 'Agent proposal detail and linked draft context.'}</p>
        </div>
        <Badge value={proposal.status} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Proposal summary</CardTitle>
        </CardHeader>
        <CardContent>
          <DetailList
            items={[
              { label: 'Proposal ID', value: proposal.proposalId },
              { label: 'Type', value: proposal.proposalType },
              { label: 'Created', value: formatDateTime(proposal.createdAt) },
              { label: 'Target', value: proposal.target.entityType ?? 'Unknown' },
              {
                label: 'Linked draft',
                value:
                  proposal.target.entityId !== null ? (
                    <Link className="font-semibold text-accent" to={`/audit/journal_entry_draft/${proposal.target.entityId}`}>
                      {proposal.target.draftNumber ?? proposal.target.entityId}
                    </Link>
                  ) : (
                    'Unlinked'
                  )
              },
              { label: 'Draft status', value: proposal.target.draftStatus ?? 'Unknown' }
            ]}
          />
        </CardContent>
      </Card>

      {draftState.loading ? <LoadingState label="Loading linked draft…" /> : null}
      {draftState.error !== null ? <ErrorState title="Linked draft failed" body={draftState.error} /> : null}
      {draftState.data !== null ? (
        <Card>
          <CardHeader>
            <CardTitle>Linked journal draft</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <DetailList
              items={[
                { label: 'Draft number', value: draftState.data.draftNumber ?? draftState.data.draftId },
                { label: 'Entry date', value: draftState.data.entryDate },
                { label: 'Status', value: <Badge value={draftState.data.status} /> },
                { label: 'Source type', value: draftState.data.sourceType }
              ]}
            />
            <JournalLinesTable lines={draftState.data.lines} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
