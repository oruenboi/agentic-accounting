import { useState } from 'react';
import { Link } from 'react-router-dom';
import { createScheduleDefinition, generateScheduleRun, listAccounts, listScheduleDefinitions, listScheduleRuns } from '../lib/api';
import { formatCurrency, formatDateTime } from '../lib/format';
import { useOperatorSession } from '../session/OperatorSessionContext';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
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
  const [asOfDate, setAsOfDate] = useState(today());
  const [refreshKey, setRefreshKey] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [definitionName, setDefinitionName] = useState('');
  const [definitionDescription, setDefinitionDescription] = useState('');
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [creatingDefinition, setCreatingDefinition] = useState(false);
  const [definitionError, setDefinitionError] = useState<string | null>(null);

  const {
    data: definitions,
    loading: definitionsLoading,
    error: definitionsError
  } = useAsyncData(
    () =>
      listScheduleDefinitions(session!, {
        scheduleType: scheduleType === 'all' ? undefined : scheduleType,
        isActive: true,
        limit: 50
      }),
    [refreshKey, scheduleType, session]
  );

  const {
    data: accounts,
    loading: accountsLoading,
    error: accountsError
  } = useAsyncData(
    () =>
      listAccounts(session!, {
        status: 'active',
        postableOnly: true,
        limit: 250
      }),
    [refreshKey, session]
  );

  const { data, loading, error } = useAsyncData(
    () =>
      listScheduleRuns(session!, {
        scheduleType: scheduleType === 'all' ? undefined : scheduleType,
        status: status === 'all' ? undefined : status,
        asOfDate: asOfDate === '' ? undefined : asOfDate,
        limit: 50
      }),
    [asOfDate, refreshKey, scheduleType, session, status]
  );

  async function handleGenerate() {
    if (scheduleType === 'all' || asOfDate === '') {
      setGenerationError('Choose a specific schedule type and as-of date before generating.');
      return;
    }

    setGenerating(true);
    setGenerationError(null);

    try {
      await generateScheduleRun(session!, { scheduleType, asOfDate });
      setRefreshKey((value) => value + 1);
    } catch (cause) {
      setGenerationError(cause instanceof Error ? cause.message : 'Schedule generation failed.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleCreateDefinition() {
    if (scheduleType === 'all' || definitionName.trim() === '' || selectedAccountIds.length === 0) {
      setDefinitionError('Choose a specific schedule type, enter a name, and select at least one GL account.');
      return;
    }

    setCreatingDefinition(true);
    setDefinitionError(null);

    try {
      await createScheduleDefinition(session!, {
        scheduleType,
        name: definitionName,
        description: definitionDescription.trim() === '' ? undefined : definitionDescription,
        glAccountIds: selectedAccountIds
      });
      setDefinitionName('');
      setDefinitionDescription('');
      setSelectedAccountIds([]);
      setRefreshKey((value) => value + 1);
    } catch (cause) {
      setDefinitionError(cause instanceof Error ? cause.message : 'Schedule definition creation failed.');
    } finally {
      setCreatingDefinition(false);
    }
  }

  function toggleAccount(accountId: string) {
    setSelectedAccountIds((current) =>
      current.includes(accountId) ? current.filter((selected) => selected !== accountId) : [...current, accountId]
    );
  }

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
        <div className="grid gap-3 md:grid-cols-4 xl:min-w-[820px]">
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
          <div className="flex items-end">
            <Button className="w-full" onClick={handleGenerate} disabled={generating || scheduleType === 'all' || asOfDate === ''}>
              {generating ? 'Generating…' : 'Generate'}
            </Button>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>Definitions</CardTitle>
            <p className="mt-1 text-sm text-black/55">Ledger-derived schedule mappings for this organization.</p>
          </div>
          <Badge value={`${definitions?.length ?? 0} active`} />
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
            <Field label="Definition name">
              <TextInput value={definitionName} onChange={(event) => setDefinitionName(event.target.value)} placeholder="Trade payables" />
            </Field>
            <Field label="Description">
              <TextInput
                value={definitionDescription}
                onChange={(event) => setDefinitionDescription(event.target.value)}
                placeholder="Optional"
              />
            </Field>
            <Button onClick={handleCreateDefinition} disabled={creatingDefinition || scheduleType === 'all'}>
              {creatingDefinition ? 'Creating…' : 'Create'}
            </Button>
          </div>

          <div className="rounded-2xl border border-black/8 bg-white/70 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-ink">GL accounts</div>
                <div className="text-xs text-black/55">Select the accounts that feed the definition.</div>
              </div>
              <Badge value={`${selectedAccountIds.length} selected`} />
            </div>
            {accountsLoading ? <LoadingState label="Loading accounts…" /> : null}
            {accountsError !== null ? <ErrorState title="Account list failed" body={accountsError} /> : null}
            {!accountsLoading && accountsError === null && accounts !== null && accounts.length === 0 ? (
              <EmptyState title="No active accounts" body="Add active postable GL accounts before creating schedule definitions." />
            ) : null}
            {!accountsLoading && accountsError === null && accounts !== null && accounts.length > 0 ? (
              <div className="grid max-h-72 gap-2 overflow-auto pr-1 md:grid-cols-2 xl:grid-cols-3">
                {accounts.map((account) => (
                  <label
                    key={account.accountId}
                    className="flex min-h-16 cursor-pointer items-start gap-3 rounded-xl border border-black/8 bg-white px-3 py-3 text-sm transition hover:border-accent/40"
                  >
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-black/20 text-accent focus:ring-accent/30"
                      checked={selectedAccountIds.includes(account.accountId)}
                      onChange={() => toggleAccount(account.accountId)}
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-ink">
                        {account.code} {account.name}
                      </span>
                      <span className="block text-xs text-black/50">{titleCase(account.type)}</span>
                    </span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>

          {definitionsLoading ? <LoadingState label="Loading definitions…" /> : null}
          {definitionsError !== null ? <ErrorState title="Definition list failed" body={definitionsError} /> : null}
          {definitionError !== null ? <ErrorState title="Definition creation failed" body={definitionError} /> : null}
          {!definitionsLoading && definitionsError === null && definitions !== null && definitions.length === 0 ? (
            <EmptyState title="No definitions" body="Create a schedule definition before generating a run for this schedule type." />
          ) : null}
          {!definitionsLoading && definitionsError === null && definitions !== null && definitions.length > 0 ? (
            <Table columns={['Name', 'Type', 'Strategy', 'Accounts']}>
              {definitions.map((definition) => (
                <TableRow key={definition.scheduleDefinitionId}>
                  <TableCell>
                    <div className="font-semibold text-ink">{definition.name}</div>
                    <div className="text-xs text-black/55">{definition.description ?? definition.scheduleDefinitionId}</div>
                  </TableCell>
                  <TableCell>{titleCase(definition.scheduleType)}</TableCell>
                  <TableCell>
                    <Badge value={definition.generationStrategy} />
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-ink">
                      {definition.accounts.length > 0
                        ? definition.accounts.map((account) => `${account.code ?? 'No code'} ${account.name ?? account.accountId}`).join(', ')
                        : definition.glAccountIds.join(', ')}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </Table>
          ) : null}
        </CardContent>
      </Card>

      {loading ? <LoadingState label="Loading schedule runs…" /> : null}
      {error !== null ? <ErrorState title="Schedule list failed" body={error} /> : null}
      {generationError !== null ? <ErrorState title="Schedule generation failed" body={generationError} /> : null}
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
