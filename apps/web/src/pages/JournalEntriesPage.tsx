import { useState } from 'react';
import { Link } from 'react-router-dom';
import { listJournalEntries } from '../lib/api';
import { useOperatorSession } from '../session/OperatorSessionContext';
import { useAsyncData } from './useAsyncData';
import { Badge } from '../components/ui/Badge';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States';
import { Table, TableCell, TableRow } from '../components/ui/Table';
import { Field, Select } from '../components/ui/Field';
import { formatDateTime } from '../lib/format';

export function JournalEntriesPage() {
  const { session } = useOperatorSession();
  const [status, setStatus] = useState('posted');
  const { data, loading, error } = useAsyncData(() => listJournalEntries(session!, { status, limit: 25 }), [session, status]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-black/45">Posted entries</p>
          <h2 className="mt-2 font-serif text-4xl text-ink">Immutable ledger explorer</h2>
        </div>
        <div className="w-full lg:max-w-xs">
          <Field label="Status filter">
            <Select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="posted">Posted</option>
              <option value="reversed">Reversed</option>
            </Select>
          </Field>
        </div>
      </div>

      {loading ? <LoadingState label="Loading journal entries…" /> : null}
      {error !== null ? <ErrorState title="Journal entry list failed" body={error} /> : null}
      {!loading && error === null && data !== null && data.length === 0 ? (
        <EmptyState title="No entries for this status" body="Adjust the filter or post a new approved journal entry first." />
      ) : null}
      {!loading && error === null && data !== null && data.length > 0 ? (
        <Table columns={['Entry', 'Status', 'Date', 'Memo', 'Open']}>
          {data.map((entry) => (
            <TableRow key={entry.journalEntryId}>
              <TableCell>
                <div className="font-semibold text-ink">{entry.entryNumber ?? entry.journalEntryId}</div>
                <div className="text-xs text-black/55">{entry.sourceType ?? 'Journal entry'}</div>
              </TableCell>
              <TableCell>
                <Badge value={entry.status} />
              </TableCell>
              <TableCell>{formatDateTime(entry.postedAt ?? entry.entryDate)}</TableCell>
              <TableCell>{entry.memo ?? '—'}</TableCell>
              <TableCell>
                <Link className="text-sm font-semibold text-accent" to={`/ledger/entries/${entry.journalEntryId}`}>
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
