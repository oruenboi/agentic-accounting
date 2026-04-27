import { useMemo, useState } from 'react';
import {
  getBalanceSheetReport,
  getGeneralLedgerReport,
  getProfitAndLossReport,
  getTrialBalanceReport
} from '../lib/api';
import { formatCurrency } from '../lib/format';
import type { GeneralLedgerRow, ReportEnvelope, StatementRow, TrialBalanceRow } from '../lib/types';
import { useOperatorSession } from '../session/OperatorSessionContext';
import { Field, Select, TextInput } from '../components/ui/Field';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States';
import { Table, TableCell, TableRow } from '../components/ui/Table';
import { useAsyncData } from './useAsyncData';

type ReportKind = 'trial-balance' | 'balance-sheet' | 'profit-and-loss' | 'general-ledger';
type ReportRow = TrialBalanceRow | StatementRow | GeneralLedgerRow;
type ReportData = ReportEnvelope<ReportRow>;

function isoDate(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
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

function compactAccount(row: { accountCode: string | null; accountName: string | null }) {
  return [row.accountCode, row.accountName].filter(Boolean).join(' · ') || 'Unknown account';
}

function ReportMeta({ data }: { data: ReportEnvelope<unknown> }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <div className="rounded-2xl border border-black/8 bg-white/65 px-4 py-3">
        <p className="text-xs uppercase tracking-[0.16em] text-black/45">Rows</p>
        <p className="mt-1 text-2xl font-semibold text-ink">{data.items.length}</p>
      </div>
      <div className="rounded-2xl border border-black/8 bg-white/65 px-4 py-3">
        <p className="text-xs uppercase tracking-[0.16em] text-black/45">Period</p>
        <p className="mt-1 text-sm font-semibold text-ink">{data.asOfDate ?? `${data.fromDate} to ${data.toDate}`}</p>
      </div>
      <div className="rounded-2xl border border-black/8 bg-white/65 px-4 py-3">
        <p className="text-xs uppercase tracking-[0.16em] text-black/45">Organization</p>
        <p className="mt-1 break-all text-sm font-semibold text-ink">{data.organizationId}</p>
      </div>
    </div>
  );
}

function TrialBalanceTable({ rows }: { rows: TrialBalanceRow[] }) {
  const totals = rows.reduce(
    (accumulator, row) => ({
      debit: accumulator.debit + Number(row.debitBalance),
      credit: accumulator.credit + Number(row.creditBalance),
      net: accumulator.net + Number(row.netBalance)
    }),
    { debit: 0, credit: 0, net: 0 }
  );

  return (
    <Table columns={['Account', 'Type', 'Debit', 'Credit', 'Net']}>
      {rows.map((row) => (
        <TableRow key={row.accountId}>
          <TableCell>
            <div className="font-semibold text-ink">{compactAccount(row)}</div>
            <div className="text-xs text-black/50">{titleCase(row.accountSubtype)}</div>
          </TableCell>
          <TableCell>{titleCase(row.accountType)}</TableCell>
          <TableCell className="text-right font-medium tabular-nums">{formatCurrency(row.debitBalance)}</TableCell>
          <TableCell className="text-right font-medium tabular-nums">{formatCurrency(row.creditBalance)}</TableCell>
          <TableCell className="text-right font-semibold tabular-nums text-ink">{formatCurrency(row.netBalance)}</TableCell>
        </TableRow>
      ))}
      <TableRow>
        <TableCell>
          <span className="font-semibold text-ink">Total</span>
        </TableCell>
        <TableCell>Trial balance</TableCell>
        <TableCell className="text-right font-semibold tabular-nums text-ink">{formatCurrency(totals.debit)}</TableCell>
        <TableCell className="text-right font-semibold tabular-nums text-ink">{formatCurrency(totals.credit)}</TableCell>
        <TableCell className="text-right font-semibold tabular-nums text-ink">{formatCurrency(totals.net)}</TableCell>
      </TableRow>
    </Table>
  );
}

function StatementTable({ rows, kind }: { rows: StatementRow[]; kind: 'balance-sheet' | 'profit-and-loss' }) {
  const grouped = rows.reduce<Record<string, StatementRow[]>>((accumulator, row) => {
    accumulator[row.section] = [...(accumulator[row.section] ?? []), row];
    return accumulator;
  }, {});

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([section, sectionRows]) => (
        <div key={section} className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-black/50">{titleCase(section)}</h3>
            <span className="text-sm font-semibold text-ink">{formatCurrency(sectionRows[0]?.sectionTotal)}</span>
          </div>
          <Table columns={['Account', 'Type', 'Amount']}>
            {sectionRows.map((row) => (
              <TableRow key={`${section}-${row.accountId}`}>
                <TableCell>
                  <div className="font-semibold text-ink">{compactAccount(row)}</div>
                  <div className="text-xs text-black/50">{titleCase(row.accountSubtype)}</div>
                </TableCell>
                <TableCell>{titleCase(row.accountType)}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums text-ink">{formatCurrency(row.amount)}</TableCell>
              </TableRow>
            ))}
          </Table>
        </div>
      ))}
      {rows.length > 0 ? (
        <div className="rounded-2xl border border-black/8 bg-white/65 px-4 py-3 text-sm text-black/65">
          {kind === 'balance-sheet' ? (
            <>
              Balance check:{' '}
              <span className="font-semibold text-ink">{formatCurrency(rows[0]?.balanceCheck ?? '0.00')}</span>
            </>
          ) : (
            <>
              Net income:{' '}
              <span className="font-semibold text-ink">{formatCurrency(rows[0]?.netIncome ?? '0.00')}</span>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function GeneralLedgerTable({ rows }: { rows: GeneralLedgerRow[] }) {
  return (
    <Table columns={['Date', 'Account', 'Entry', 'Debit', 'Credit', 'Running']}>
      {rows.map((row, index) => (
        <TableRow key={`${row.accountId}-${row.journalEntryLineId ?? row.rowType}-${index}`}>
          <TableCell>
            <div className="font-medium text-ink">{row.entryDate}</div>
            <div className="text-xs text-black/50">{titleCase(row.rowType)}</div>
          </TableCell>
          <TableCell>
            <div className="font-semibold text-ink">{compactAccount(row)}</div>
            <div className="text-xs text-black/50">{titleCase(row.accountSubtype)}</div>
          </TableCell>
          <TableCell>
            <div>{row.entryNumber ?? row.memo ?? 'Opening balance'}</div>
            <div className="text-xs text-black/50">{row.lineDescription ?? row.sourceType ?? '—'}</div>
          </TableCell>
          <TableCell className="text-right font-medium tabular-nums">{formatCurrency(row.debit)}</TableCell>
          <TableCell className="text-right font-medium tabular-nums">{formatCurrency(row.credit)}</TableCell>
          <TableCell className="text-right font-semibold tabular-nums text-ink">{formatCurrency(row.runningBalance)}</TableCell>
        </TableRow>
      ))}
    </Table>
  );
}

export function ReportsPage() {
  const { session } = useOperatorSession();
  const [report, setReport] = useState<ReportKind>('trial-balance');
  const [asOfDate, setAsOfDate] = useState(isoDate());
  const [fromDate, setFromDate] = useState(isoDate(-30));
  const [toDate, setToDate] = useState(isoDate());
  const [includeZeroBalances, setIncludeZeroBalances] = useState(false);
  const [accountIds, setAccountIds] = useState('');

  const loader = useMemo(() => {
    if (report === 'trial-balance') {
      return () => getTrialBalanceReport(session!, { asOfDate, includeZeroBalances }) as Promise<ReportData>;
    }

    if (report === 'balance-sheet') {
      return () => getBalanceSheetReport(session!, { asOfDate, includeZeroBalances }) as Promise<ReportData>;
    }

    if (report === 'profit-and-loss') {
      return () => getProfitAndLossReport(session!, { fromDate, toDate, includeZeroBalances }) as Promise<ReportData>;
    }

    return () => getGeneralLedgerReport(session!, { fromDate, toDate, accountIds }) as Promise<ReportData>;
  }, [accountIds, asOfDate, fromDate, includeZeroBalances, report, session, toDate]);

  const { data, loading, error } = useAsyncData(loader, [loader]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-black/45">Reports</p>
          <h2 className="mt-2 font-serif text-4xl text-ink">Financial statements</h2>
          <p className="mt-3 max-w-3xl text-sm text-black/65">
            Read posted-ledger reports directly from the backend reporting views for the active organization.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:min-w-[560px]">
          <Field label="Report">
            <Select value={report} onChange={(event) => setReport(event.target.value as ReportKind)}>
              <option value="trial-balance">Trial balance</option>
              <option value="balance-sheet">Balance sheet</option>
              <option value="profit-and-loss">Profit and loss</option>
              <option value="general-ledger">General ledger</option>
            </Select>
          </Field>
          {report === 'trial-balance' || report === 'balance-sheet' ? (
            <Field label="As of date">
              <TextInput type="date" value={asOfDate} onChange={(event) => setAsOfDate(event.target.value)} />
            </Field>
          ) : (
            <>
              <Field label="From date">
                <TextInput type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
              </Field>
              <Field label="To date">
                <TextInput type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
              </Field>
            </>
          )}
          {report === 'general-ledger' ? (
            <Field label="Account IDs" hint="Optional comma-separated UUIDs">
              <TextInput value={accountIds} onChange={(event) => setAccountIds(event.target.value)} placeholder="account-id-1, account-id-2" />
            </Field>
          ) : (
            <label className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-medium text-ink">
              <input
                type="checkbox"
                className="h-4 w-4 accent-ink"
                checked={includeZeroBalances}
                onChange={(event) => setIncludeZeroBalances(event.target.checked)}
              />
              Include zero balances
            </label>
          )}
        </div>
      </div>

      {loading ? <LoadingState label="Loading report…" /> : null}
      {error !== null ? <ErrorState title="Report load failed" body={error} /> : null}
      {!loading && error === null && data !== null ? <ReportMeta data={data} /> : null}
      {!loading && error === null && data !== null && data.items.length === 0 ? (
        <EmptyState title="No report rows" body="The selected report returned no posted-ledger rows for this organization and period." />
      ) : null}
      {!loading && error === null && data !== null && data.items.length > 0 && report === 'trial-balance' ? (
        <TrialBalanceTable rows={data.items as unknown as TrialBalanceRow[]} />
      ) : null}
      {!loading && error === null && data !== null && data.items.length > 0 && report === 'balance-sheet' ? (
        <StatementTable rows={data.items as unknown as StatementRow[]} kind="balance-sheet" />
      ) : null}
      {!loading && error === null && data !== null && data.items.length > 0 && report === 'profit-and-loss' ? (
        <StatementTable rows={data.items as unknown as StatementRow[]} kind="profit-and-loss" />
      ) : null}
      {!loading && error === null && data !== null && data.items.length > 0 && report === 'general-ledger' ? (
        <GeneralLedgerTable rows={data.items as unknown as GeneralLedgerRow[]} />
      ) : null}
    </div>
  );
}
