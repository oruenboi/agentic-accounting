import { useEffect, useMemo, useState } from 'react';
import { Save } from 'lucide-react';
import {
  getOrganizationSettings,
  listOrganizationMembers,
  updateOrganizationMember,
  updateOrganizationSettings
} from '../lib/api';
import type { OrganizationMember, OrganizationSettings } from '../lib/types';
import { useOperatorSession } from '../session/OperatorSessionContext';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Field, Select, TextInput } from '../components/ui/Field';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States';
import { Table, TableCell, TableRow } from '../components/ui/Table';
import { useAsyncData } from './useAsyncData';

const monthOptions = [
  ['1', 'January'],
  ['2', 'February'],
  ['3', 'March'],
  ['4', 'April'],
  ['5', 'May'],
  ['6', 'June'],
  ['7', 'July'],
  ['8', 'August'],
  ['9', 'September'],
  ['10', 'October'],
  ['11', 'November'],
  ['12', 'December']
];

const roleOptions = [
  ['org_admin', 'Org admin'],
  ['reviewer', 'Reviewer'],
  ['accountant', 'Accountant'],
  ['bookkeeper', 'Bookkeeper'],
  ['client_viewer', 'Client viewer']
];

const statusOptions = [
  ['active', 'Active'],
  ['invited', 'Invited'],
  ['inactive', 'Inactive']
];

const blankSettingsForm = {
  name: '',
  legalName: '',
  baseCurrency: 'USD',
  fiscalYearStartMonth: '1',
  countryCode: '',
  timezone: ''
};

type SettingsForm = typeof blankSettingsForm;

type MemberForm = {
  role: string;
  status: string;
  isExternalClient: boolean;
};

function settingsToForm(settings: OrganizationSettings): SettingsForm {
  return {
    name: settings.name,
    legalName: settings.legalName ?? '',
    baseCurrency: settings.baseCurrency,
    fiscalYearStartMonth: String(settings.fiscalYearStartMonth),
    countryCode: settings.countryCode ?? '',
    timezone: settings.timezone ?? ''
  };
}

function memberToForm(member: OrganizationMember): MemberForm {
  return {
    role: member.role,
    status: member.status,
    isExternalClient: member.isExternalClient
  };
}

function memberLabel(member: OrganizationMember) {
  return member.displayName ?? member.email ?? member.userId ?? member.membershipId;
}

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export function SettingsPage() {
  const { session } = useOperatorSession();
  const [refreshKey, setRefreshKey] = useState(0);
  const [settingsForm, setSettingsForm] = useState<SettingsForm>(blankSettingsForm);
  const [memberForms, setMemberForms] = useState<Record<string, MemberForm>>({});
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [memberSavingId, setMemberSavingId] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [memberError, setMemberError] = useState<string | null>(null);

  const settingsState = useAsyncData(() => getOrganizationSettings(session!), [refreshKey, session]);
  const membersState = useAsyncData(() => listOrganizationMembers(session!), [refreshKey, session]);

  const members = useMemo(() => membersState.data ?? [], [membersState.data]);

  useEffect(() => {
    if (settingsState.data !== null) {
      setSettingsForm(settingsToForm(settingsState.data));
    }
  }, [settingsState.data]);

  useEffect(() => {
    if (membersState.data !== null) {
      setMemberForms(
        Object.fromEntries(membersState.data.map((member) => [member.membershipId, memberToForm(member)]))
      );
    }
  }, [membersState.data]);

  async function handleSettingsSave() {
    if (settingsForm.name.trim() === '' || settingsForm.baseCurrency.trim() === '') {
      setSettingsError('Enter organization name and base currency before saving.');
      return;
    }

    setSettingsSaving(true);
    setSettingsError(null);

    try {
      await updateOrganizationSettings(session!, {
        name: settingsForm.name.trim(),
        legalName: optionalText(settingsForm.legalName),
        baseCurrency: settingsForm.baseCurrency.trim().toUpperCase(),
        fiscalYearStartMonth: Number(settingsForm.fiscalYearStartMonth),
        countryCode: optionalText(settingsForm.countryCode)?.toUpperCase() ?? null,
        timezone: optionalText(settingsForm.timezone)
      });
      setRefreshKey((value) => value + 1);
    } catch (cause) {
      setSettingsError(cause instanceof Error ? cause.message : 'Organization settings save failed.');
    } finally {
      setSettingsSaving(false);
    }
  }

  async function handleMemberSave(member: OrganizationMember) {
    const form = memberForms[member.membershipId];

    if (form === undefined) {
      return;
    }

    setMemberSavingId(member.membershipId);
    setMemberError(null);

    try {
      await updateOrganizationMember(session!, member.membershipId, {
        role: form.role,
        status: form.status,
        isExternalClient: form.isExternalClient
      });
      setRefreshKey((value) => value + 1);
    } catch (cause) {
      setMemberError(cause instanceof Error ? cause.message : 'Member update failed.');
    } finally {
      setMemberSavingId(null);
    }
  }

  function setMemberForm(membershipId: string, patch: Partial<MemberForm>) {
    setMemberForms((current) => ({
      ...current,
      [membershipId]: {
        ...current[membershipId],
        ...patch
      }
    }));
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-black/45">Settings</p>
        <h2 className="mt-2 font-serif text-4xl text-ink">Organization settings</h2>
        <p className="mt-3 max-w-3xl text-sm text-black/65">
          Maintain organization profile defaults and member access for the active operator session.
        </p>
      </div>

      {settingsState.loading ? <LoadingState label="Loading organization settings..." /> : null}
      {settingsState.error !== null ? <ErrorState title="Organization settings failed" body={settingsState.error} /> : null}
      {settingsState.data !== null ? (
        <Card>
          <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Profile defaults</CardTitle>
              <p className="mt-1 text-sm text-black/55">These values drive reporting and close defaults.</p>
            </div>
            <Badge value={settingsState.data.organizationId} />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-3">
              <Field label="Name">
                <TextInput
                  value={settingsForm.name}
                  onChange={(event) => setSettingsForm({ ...settingsForm, name: event.target.value })}
                  placeholder="Acme Pte Ltd"
                />
              </Field>
              <Field label="Legal name">
                <TextInput
                  value={settingsForm.legalName}
                  onChange={(event) => setSettingsForm({ ...settingsForm, legalName: event.target.value })}
                  placeholder="Acme Private Limited"
                />
              </Field>
              <Field label="Base currency">
                <TextInput
                  value={settingsForm.baseCurrency}
                  onChange={(event) => setSettingsForm({ ...settingsForm, baseCurrency: event.target.value })}
                  placeholder="USD"
                  maxLength={3}
                />
              </Field>
              <Field label="Fiscal year starts">
                <Select
                  value={settingsForm.fiscalYearStartMonth}
                  onChange={(event) => setSettingsForm({ ...settingsForm, fiscalYearStartMonth: event.target.value })}
                >
                  {monthOptions.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Country code">
                <TextInput
                  value={settingsForm.countryCode}
                  onChange={(event) => setSettingsForm({ ...settingsForm, countryCode: event.target.value })}
                  placeholder="US"
                  maxLength={2}
                />
              </Field>
              <Field label="Timezone">
                <TextInput
                  value={settingsForm.timezone}
                  onChange={(event) => setSettingsForm({ ...settingsForm, timezone: event.target.value })}
                  placeholder="America/New_York"
                />
              </Field>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-black/45">
                Last updated {settingsState.data.updatedAt ?? 'not recorded'}
              </p>
              <Button onClick={handleSettingsSave} disabled={settingsSaving}>
                <Save size={16} className="mr-2" />
                {settingsSaving ? 'Saving...' : 'Save settings'}
              </Button>
            </div>
            {settingsError !== null ? <ErrorState title="Organization update failed" body={settingsError} /> : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-black/45">Members</p>
            <h3 className="font-serif text-3xl text-ink">Access roster</h3>
          </div>
          <p className="text-sm text-black/55">{members.length} members</p>
        </div>

        {membersState.loading ? <LoadingState label="Loading organization members..." /> : null}
        {membersState.error !== null ? <ErrorState title="Member list failed" body={membersState.error} /> : null}
        {memberError !== null ? <ErrorState title="Member update failed" body={memberError} /> : null}
        {!membersState.loading && membersState.error === null && members.length === 0 ? (
          <EmptyState title="No members found" body="Members will appear here once they are attached to this organization." />
        ) : null}
        {!membersState.loading && membersState.error === null && members.length > 0 ? (
          <Table columns={['Member', 'Role', 'Status', 'External client', 'Updated', 'Actions']}>
            {members.map((member) => {
              const form = memberForms[member.membershipId] ?? memberToForm(member);

              return (
                <TableRow key={member.membershipId}>
                  <TableCell>
                    <div className="font-semibold text-ink">{memberLabel(member)}</div>
                    <div className="text-xs text-black/45">{member.email ?? member.membershipId}</div>
                  </TableCell>
                  <TableCell>
                    <Select value={form.role} onChange={(event) => setMemberForm(member.membershipId, { role: event.target.value })}>
                      {roleOptions.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select value={form.status} onChange={(event) => setMemberForm(member.membershipId, { status: event.target.value })}>
                      {statusOptions.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  </TableCell>
                  <TableCell>
                    <label className="inline-flex h-11 items-center gap-2 text-sm font-medium text-ink">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-black/20 text-accent focus:ring-accent/30"
                        checked={form.isExternalClient}
                        onChange={(event) => setMemberForm(member.membershipId, { isExternalClient: event.target.checked })}
                      />
                      External
                    </label>
                  </TableCell>
                  <TableCell className="text-xs text-black/55">{member.updatedAt ?? member.createdAt ?? 'None'}</TableCell>
                  <TableCell>
                    <Button
                      className="px-3"
                      onClick={() => handleMemberSave(member)}
                      disabled={memberSavingId === member.membershipId}
                    >
                      <Save size={15} className="mr-2" />
                      {memberSavingId === member.membershipId ? 'Saving...' : 'Save'}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </Table>
        ) : null}
      </div>
    </div>
  );
}
