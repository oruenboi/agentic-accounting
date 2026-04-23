import { Link, useParams } from 'react-router-dom';
import { getJournalEntry } from '../lib/api';
import { useOperatorSession } from '../session/OperatorSessionContext';
import { useAsyncData } from './useAsyncData';
import { Badge } from '../components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { DetailList } from '../components/DetailList';
import { JournalLinesTable } from '../components/JournalLinesTable';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States';
import { formatDateTime } from '../lib/format';

export function JournalEntryDetailPage() {
  const { entryId = '' } = useParams();
  const { session } = useOperatorSession();
  const { data, loading, error } = useAsyncData(() => getJournalEntry(session!, entryId), [session, entryId]);

  if (loading) {
    return <LoadingState label="Loading journal entry detail…" />;
  }

  if (error !== null) {
    return <ErrorState title="Journal entry detail failed" body={error} />;
  }

  if (data === null) {
    return <EmptyState title="Journal entry not found" body="This entry is not available for the active operator session." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-black/45">Journal entry detail</p>
          <h2 className="mt-2 font-serif text-4xl text-ink">{data.entryNumber ?? data.journalEntryId}</h2>
        </div>
        <Badge value={data.status} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Entry summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <DetailList
            items={[
              { label: 'Entry date', value: data.entryDate },
              { label: 'Posted at', value: formatDateTime(data.postedAt) },
              { label: 'Source type', value: data.sourceType ?? 'Unknown' },
              { label: 'Memo', value: data.memo ?? '—' },
              { label: 'Reversed by', value: data.reversedByJournalEntryId ?? 'Not reversed' },
              {
                label: 'Audit timeline',
                value: (
                  <Link className="font-semibold text-accent" to={`/audit/journal_entry/${data.journalEntryId}`}>
                    Open entity timeline
                  </Link>
                )
              }
            ]}
          />
          <JournalLinesTable lines={data.lines} />
        </CardContent>
      </Card>
    </div>
  );
}
