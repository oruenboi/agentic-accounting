import { useState } from 'react';
import { Link } from 'react-router-dom';
import { listScheduleRuns } from '../lib/api';
import { formatCurrency, formatDateTime } from '../lib/format';
import { useOperatorSession } from '../session/OperatorSessionContext';
import { Badge } from '../components/ui/Badge';
import { Field, Select, TextInput } from '../components/ui/Field';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States';
import { Table, TableCell, TableRow } from '../components/ui/Table';
import { useAsyncData } from './useAsyncData';

const scheduleTypes = [
  ['all', 'All schedules'],
  ['bank', 'Bank'],
  ['accounts_receivable', 'Accounts receivable'],
  ['accounts_payable', 'Accounts payable'],
  ['accruals', 'Accruals'],
  ['prepayments', 'Prepayments'],
  ['fixed_assets', 'Fixed assets'],
  ['tax_payable', 'Tax payable']
];

const statuses = [
  ['all', 'All statuses'],
  ['generated', 'Generated'],
  ['variance_detected', 'Variance detected'],
  ['reconciled', 'Reconciled'],
  ['reviewed', 'Reviewed'],
  ['superseded', 'Superseded']
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function titleCase(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function SchedulesPage() {
  const { session } = useOperatorSession();
  const [scheduleType, setScheduleType] = useState('all');
  const [status, setStatus] = useState('all');
  const [asOfDate, setAsOfDate] = useState('');

  const { data, loading, error } = useAsyncData(
    () =>
      listScheduleRuns(session!, {
        scheduleType: scheduleType === 'all' ? undefined : scheduleType,
        status: status === 'all' ? undefined : status,
        asOfDate: asOfDate === '' ? undefined : asOfDate,
        limit: 50
      }),
    [asOfDate, scheduleType, session, status]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-black/45">Schedules</p>
          <h2 className="mt-2 font-serif text-4xl text-ink">Balance sheet support</h2>
          <p className="mt-3 max-w-3xl text-sm text-black/65">
            Review generated schedule runs, tie-out status, and variance state for the active organization.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-3 xl:min-w-[720px]">
          <Field label="Type">
            <Select value={scheduleType} onChange={(event) => setScheduleType(event.target.value)}>
              {scheduleTypes.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={status} onChange={(event) => setStatus(event.target.value)}>
              {statuses.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="As of date" hint="Optional exact date filter">
            <TextInput type="date" value={asOfDate} max={today()} onChange={(event) => setAsOfDate(event.target.value)} />
          </Field>
        </div>
      </div>

      {loading ? <LoadingState label="Loading schedule runs…" /> : null}
      {error !== null ? <ErrorState title="Schedule list failed" body={error} /> : null}
      {!loading && error === null && data !== null && data.length === 0 ? (
        <EmptyState title="No schedule runs" body="Generate balance sheet schedules first, then return here to review tie-outs and variances." />
      ) : null}
      {!loading && error === null && data !== null && data.length > 0 ? (
        <Table columns={['Schedule', 'Status', 'As of', 'GL balance', 'Schedule total', 'Variance', 'Open']}>
          {data.map((run) => (
            <TableRow key={run.scheduleRunId}>
              <TableCell>
                <div className="font-semibold text-ink">{run.scheduleName ?? titleCase(run.scheduleType)}</div>
                <div className="text-xs text-black/55">{titleCase(run.scheduleType)}</div>
              </TableCell>
              <TableCell>
                <Badge value={run.reconciliationStatus ?? run.status} />
              </TableCell>
              <TableCell>{run.asOfDate}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">{formatCurrency(run.glBalance)}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">{formatCurrency(run.scheduleTotal)}</TableCell>
              <TableCell className="text-right font-semibold tabular-nums text-ink">{formatCurrency(run.variance)}</TableCell>
              <TableCell>
                <Link className="text-sm font-semibold text-accent" to={`/schedules/runs/${run.scheduleRunId}`}>
                  Review
                </Link>
                <div className="mt-1 text-xs text-black/45">{formatDateTime(run.generatedAt)}</div>
              </TableCell>
            </TableRow>
          ))}
        </Table>
      ) : null}
    </div>
  );
}
