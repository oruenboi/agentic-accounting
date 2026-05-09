import { useMemo, useState } from 'react';
import { Check, Pencil, Plus, RotateCcw, X } from 'lucide-react';
import { createAccount, listAccounts, updateAccount, updateAccountStatus } from '../lib/api';
import type { AccountSummary } from '../lib/types';
import { useOperatorSession } from '../session/OperatorSessionContext';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Field, Select, TextInput } from '../components/ui/Field';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States';
import { Table, TableCell, TableRow } from '../components/ui/Table';
import { useAsyncData } from './useAsyncData';

const accountTypes = [
  ['all', 'All types'],
  ['asset', 'Asset'],
  ['liability', 'Liability'],
  ['equity', 'Equity'],
  ['revenue', 'Revenue'],
  ['expense', 'Expense']
];

const statusFilters = [
  ['all', 'All statuses'],
  ['active', 'Active'],
  ['inactive', 'Inactive']
];

const postableFilters = [
  ['all', 'All'],
  ['postable', 'Postable'],
  ['non_postable', 'Non-postable']
];

const blankForm = {
  code: '',
  name: '',
  type: 'asset',
  subtype: '',
  parentAccountId: '',
  status: 'active',
  isPostable: true
};

function titleCase(value: string | null) {
  if (value === null || value === '') {
    return 'None';
  }

  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function accountLabel(account: AccountSummary) {
  return `${account.code} ${account.name}`;
}

export function AccountsPage() {
  const { session } = useOperatorSession();
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  const [postableFilter, setPostableFilter] = useState('all');
  const [refreshKey, setRefreshKey] = useState(0);
  const [form, setForm] = useState(blankForm);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [statusChangingId, setStatusChangingId] = useState<string | null>(null);

  const { data, loading, error } = useAsyncData(
    () =>
      listAccounts(session!, {
        type: typeFilter === 'all' ? undefined : typeFilter,
        status: statusFilter === 'all' ? undefined : statusFilter,
        postableOnly: postableFilter === 'postable' ? true : undefined,
        limit: 500
      }),
    [postableFilter, refreshKey, session, statusFilter, typeFilter]
  );

  const accounts = data ?? [];
  const filteredAccounts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return accounts.filter((account) => {
      if (postableFilter === 'non_postable' && account.isPostable) {
        return false;
      }

      if (normalizedQuery === '') {
        return true;
      }

      return [account.code, account.name, account.subtype ?? '', account.accountId]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [accounts, postableFilter, query]);

  function resetForm() {
    setForm(blankForm);
    setEditingAccountId(null);
    setMutationError(null);
  }

  function editAccount(account: AccountSummary) {
    setForm({
      code: account.code,
      name: account.name,
      type: account.type,
      subtype: account.subtype ?? '',
      parentAccountId: account.parentAccountId ?? '',
      status: account.status,
      isPostable: account.isPostable
    });
    setEditingAccountId(account.accountId);
    setMutationError(null);
  }

  async function handleSave() {
    if (form.code.trim() === '' || form.name.trim() === '' || form.type === '') {
      setMutationError('Enter code, name, and type before saving.');
      return;
    }

    setSaving(true);
    setMutationError(null);

    try {
      if (editingAccountId === null) {
        await createAccount(session!, {
          code: form.code.trim(),
          name: form.name.trim(),
          type: form.type,
          subtype: form.subtype.trim() === '' ? undefined : form.subtype.trim(),
          parentAccountId: form.parentAccountId === '' ? undefined : form.parentAccountId,
          status: form.status,
          isPostable: form.isPostable
        });
      } else {
        await updateAccount(session!, editingAccountId, {
          name: form.name.trim(),
          subtype: form.subtype.trim() === '' ? null : form.subtype.trim(),
          parentAccountId: form.parentAccountId === '' ? null : form.parentAccountId,
          isPostable: form.isPostable
        });
      }

      resetForm();
      setRefreshKey((value) => value + 1);
    } catch (cause) {
      setMutationError(cause instanceof Error ? cause.message : 'Account save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(account: AccountSummary, status: string) {
    setStatusChangingId(account.accountId);
    setMutationError(null);

    try {
      await updateAccountStatus(session!, account.accountId, { status });
      if (editingAccountId === account.accountId) {
        setEditingAccountId(null);
        setForm(blankForm);
      }
      setRefreshKey((value) => value + 1);
    } catch (cause) {
      setMutationError(cause instanceof Error ? cause.message : 'Account status update failed.');
    } finally {
      setStatusChangingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-black/45">Accounts</p>
          <h2 className="mt-2 font-serif text-4xl text-ink">Chart of accounts</h2>
          <p className="mt-3 max-w-3xl text-sm text-black/65">
            Maintain GL accounts for the active organization. Deactivation is explicit and preserves account history.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-4 xl:min-w-[920px]">
          <Field label="Search">
            <TextInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Code, name, subtype, id" />
          </Field>
          <Field label="Type">
            <Select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              {accountTypes.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              {statusFilters.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Postable">
            <Select value={postableFilter} onChange={(event) => setPostableFilter(event.target.value)}>
              {postableFilters.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>{editingAccountId === null ? 'Create account' : 'Edit account'}</CardTitle>
            <p className="mt-1 text-sm text-black/55">Use parent only for heading or rollup accounts.</p>
          </div>
          <Badge value={editingAccountId === null ? 'new' : 'editing'} />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[0.7fr_1.4fr_0.9fr_1fr_1.2fr_auto] lg:items-end">
            <Field label="Code">
              <TextInput
                value={form.code}
                onChange={(event) => setForm({ ...form, code: event.target.value })}
                placeholder="1000"
                disabled={editingAccountId !== null}
              />
            </Field>
            <Field label="Name">
              <TextInput value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Cash at bank" />
            </Field>
            <Field label="Type">
              <Select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} disabled={editingAccountId !== null}>
                {accountTypes
                  .filter(([value]) => value !== 'all')
                  .map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="Subtype">
              <TextInput
                value={form.subtype}
                onChange={(event) => setForm({ ...form, subtype: event.target.value })}
                placeholder="cash"
              />
            </Field>
            <Field label="Parent">
              <Select value={form.parentAccountId} onChange={(event) => setForm({ ...form, parentAccountId: event.target.value })}>
                <option value="">No parent</option>
                {accounts
                  .filter((account) => account.accountId !== editingAccountId)
                  .map((account) => (
                    <option key={account.accountId} value={account.accountId}>
                      {accountLabel(account)}
                    </option>
                  ))}
              </Select>
            </Field>
            <div className="flex items-end gap-2">
              <Button onClick={handleSave} disabled={saving}>
                {editingAccountId === null ? <Plus size={16} className="mr-2" /> : <Check size={16} className="mr-2" />}
                {saving ? 'Saving...' : editingAccountId === null ? 'Create' : 'Save'}
              </Button>
              {editingAccountId !== null ? (
                <Button variant="secondary" onClick={resetForm} disabled={saving} aria-label="Cancel edit">
                  <X size={16} />
                </Button>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="inline-flex items-center gap-2 text-sm font-medium text-ink">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-black/20 text-accent focus:ring-accent/30"
                checked={form.isPostable}
                onChange={(event) => setForm({ ...form, isPostable: event.target.checked })}
              />
              Postable account
            </label>
            {editingAccountId === null ? (
              <Field label="Initial status">
                <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </Select>
              </Field>
            ) : null}
          </div>
          {mutationError !== null ? <ErrorState title="Account update failed" body={mutationError} /> : null}
        </CardContent>
      </Card>

      {loading ? <LoadingState label="Loading accounts..." /> : null}
      {error !== null ? <ErrorState title="Account list failed" body={error} /> : null}
      {!loading && error === null && filteredAccounts.length === 0 ? (
        <EmptyState title="No accounts found" body="Adjust filters or create a new chart account for this organization." />
      ) : null}
      {!loading && error === null && filteredAccounts.length > 0 ? (
        <Table columns={['Account', 'Type', 'Subtype', 'Parent', 'Postable', 'Status', 'Actions']}>
          {filteredAccounts.map((account) => (
            <TableRow key={account.accountId}>
              <TableCell>
                <div className="font-semibold text-ink">
                  {account.code} {account.name}
                </div>
                <div className="text-xs text-black/45">{account.accountId}</div>
              </TableCell>
              <TableCell>{titleCase(account.type)}</TableCell>
              <TableCell>{titleCase(account.subtype)}</TableCell>
              <TableCell className="text-xs text-black/60">{account.parentAccountId ?? 'None'}</TableCell>
              <TableCell>
                <Badge value={account.isPostable ? 'postable' : 'heading'} />
              </TableCell>
              <TableCell>
                <Badge value={account.status} />
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" className="px-3" onClick={() => editAccount(account)} aria-label={`Edit ${account.name}`}>
                    <Pencil size={15} />
                  </Button>
                  {account.status === 'active' ? (
                    <Button
                      variant="danger"
                      className="px-3"
                      onClick={() => handleStatusChange(account, 'inactive')}
                      disabled={statusChangingId === account.accountId}
                    >
                      Deactivate
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      className="px-3"
                      onClick={() => handleStatusChange(account, 'active')}
                      disabled={statusChangingId === account.accountId}
                    >
                      <RotateCcw size={15} className="mr-2" />
                      Reactivate
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </Table>
      ) : null}
    </div>
  );
}
