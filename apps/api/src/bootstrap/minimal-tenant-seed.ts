export interface MinimalTenantSeedInput {
  authUserId: string;
  userEmail: string;
  userDisplayName?: string;
  firmName?: string;
  firmSlug?: string;
  organizationName?: string;
  organizationLegalName?: string;
  organizationSlug?: string;
  baseCurrency?: string;
  fiscalYearStartMonth?: number;
  timezone?: string;
  countryCode?: string;
  periodName?: string;
  periodStart?: string;
  periodEnd?: string;
}

export const MINIMAL_TENANT_SEED_IDS = {
  firmId: '10000000-0000-4000-8000-000000000001',
  appUserId: '10000000-0000-4000-8000-000000000002',
  organizationId: '10000000-0000-4000-8000-000000000003',
  accountingPeriodId: '10000000-0000-4000-8000-000000000004',
  journalSequenceId: '10000000-0000-4000-8000-000000000005',
  accounts: {
    cash: '10000000-0000-4000-8000-000000000101',
    accountsReceivable: '10000000-0000-4000-8000-000000000102',
    accountsPayable: '10000000-0000-4000-8000-000000000201',
    ownersEquity: '10000000-0000-4000-8000-000000000301',
    serviceRevenue: '10000000-0000-4000-8000-000000000401',
    operatingExpense: '10000000-0000-4000-8000-000000000501'
  }
} as const;

const DEFAULTS = {
  userDisplayName: 'Seeded Operator',
  firmName: 'Nexius Advisory',
  firmSlug: 'nexius-advisory',
  organizationName: 'Nexius Demo Client',
  organizationLegalName: 'Nexius Demo Client Pte. Ltd.',
  organizationSlug: 'nexius-demo-client',
  baseCurrency: 'SGD',
  fiscalYearStartMonth: 1,
  timezone: 'Asia/Singapore',
  countryCode: 'SG',
  periodName: 'FY2026',
  periodStart: '2026-01-01',
  periodEnd: '2026-12-31'
} as const;

const DEFAULT_ACCOUNTS = [
  {
    id: MINIMAL_TENANT_SEED_IDS.accounts.cash,
    code: '1000',
    name: 'Cash at Bank',
    type: 'asset',
    subtype: 'cash_and_cash_equivalents'
  },
  {
    id: MINIMAL_TENANT_SEED_IDS.accounts.accountsReceivable,
    code: '1100',
    name: 'Accounts Receivable',
    type: 'asset',
    subtype: 'trade_receivables'
  },
  {
    id: MINIMAL_TENANT_SEED_IDS.accounts.accountsPayable,
    code: '2000',
    name: 'Accounts Payable',
    type: 'liability',
    subtype: 'trade_payables'
  },
  {
    id: MINIMAL_TENANT_SEED_IDS.accounts.ownersEquity,
    code: '3000',
    name: "Owner's Equity",
    type: 'equity',
    subtype: 'owner_equity'
  },
  {
    id: MINIMAL_TENANT_SEED_IDS.accounts.serviceRevenue,
    code: '4000',
    name: 'Service Revenue',
    type: 'revenue',
    subtype: 'operating_revenue'
  },
  {
    id: MINIMAL_TENANT_SEED_IDS.accounts.operatingExpense,
    code: '5000',
    name: 'Operating Expense',
    type: 'expense',
    subtype: 'operating_expense'
  }
] as const;

export function buildMinimalTenantSeedSql(input: MinimalTenantSeedInput) {
  validateInput(input);

  const seed = {
    authUserId: input.authUserId.trim(),
    userEmail: input.userEmail.trim().toLowerCase(),
    userDisplayName: input.userDisplayName ?? DEFAULTS.userDisplayName,
    firmName: input.firmName ?? DEFAULTS.firmName,
    firmSlug: input.firmSlug ?? DEFAULTS.firmSlug,
    organizationName: input.organizationName ?? DEFAULTS.organizationName,
    organizationLegalName: input.organizationLegalName ?? DEFAULTS.organizationLegalName,
    organizationSlug: input.organizationSlug ?? DEFAULTS.organizationSlug,
    baseCurrency: input.baseCurrency ?? DEFAULTS.baseCurrency,
    fiscalYearStartMonth: input.fiscalYearStartMonth ?? DEFAULTS.fiscalYearStartMonth,
    timezone: input.timezone ?? DEFAULTS.timezone,
    countryCode: input.countryCode ?? DEFAULTS.countryCode,
    periodName: input.periodName ?? DEFAULTS.periodName,
    periodStart: input.periodStart ?? DEFAULTS.periodStart,
    periodEnd: input.periodEnd ?? DEFAULTS.periodEnd
  };

  const accountValues = DEFAULT_ACCOUNTS.map(
    (account) => `(
  ${sqlLiteral(account.id)},
  ${sqlLiteral(MINIMAL_TENANT_SEED_IDS.firmId)},
  ${sqlLiteral(MINIMAL_TENANT_SEED_IDS.organizationId)},
  ${sqlLiteral(account.code)},
  ${sqlLiteral(account.name)},
  ${sqlLiteral(account.type)},
  ${sqlLiteral(account.subtype)},
  null,
  'active',
  true
)`
  ).join(',\n');

  return `-- Minimal tenant bootstrap seed for agentic-accounting.
-- Generated for auth user ${seed.authUserId}.
-- Safe to re-apply: inserts use deterministic keys and conflict handlers.

begin;

insert into public.firms (
  id,
  name,
  slug,
  status,
  base_country_code
)
values (
  ${sqlLiteral(MINIMAL_TENANT_SEED_IDS.firmId)},
  ${sqlLiteral(seed.firmName)},
  ${sqlLiteral(seed.firmSlug)},
  'active',
  ${sqlNullableLiteral(seed.countryCode)}
)
on conflict (id) do update
set
  name = excluded.name,
  slug = excluded.slug,
  status = excluded.status,
  base_country_code = excluded.base_country_code,
  updated_at = now();

insert into public.users (
  id,
  auth_user_id,
  email,
  display_name,
  status
)
values (
  ${sqlLiteral(MINIMAL_TENANT_SEED_IDS.appUserId)},
  ${sqlLiteral(seed.authUserId)},
  ${sqlLiteral(seed.userEmail)},
  ${sqlNullableLiteral(seed.userDisplayName)},
  'active'
)
on conflict (id) do update
set
  auth_user_id = excluded.auth_user_id,
  email = excluded.email,
  display_name = excluded.display_name,
  status = excluded.status,
  updated_at = now();

insert into public.firm_members (
  firm_id,
  user_id,
  role,
  status
)
values (
  ${sqlLiteral(MINIMAL_TENANT_SEED_IDS.firmId)},
  ${sqlLiteral(MINIMAL_TENANT_SEED_IDS.appUserId)},
  'firm_owner',
  'active'
)
on conflict (firm_id, user_id) do update
set
  role = excluded.role,
  status = excluded.status,
  updated_at = now();

insert into public.organizations (
  id,
  firm_id,
  name,
  legal_name,
  slug,
  status,
  base_currency,
  fiscal_year_start_month,
  country_code,
  timezone
)
values (
  ${sqlLiteral(MINIMAL_TENANT_SEED_IDS.organizationId)},
  ${sqlLiteral(MINIMAL_TENANT_SEED_IDS.firmId)},
  ${sqlLiteral(seed.organizationName)},
  ${sqlNullableLiteral(seed.organizationLegalName)},
  ${sqlLiteral(seed.organizationSlug)},
  'active',
  ${sqlLiteral(seed.baseCurrency)},
  ${seed.fiscalYearStartMonth},
  ${sqlNullableLiteral(seed.countryCode)},
  ${sqlLiteral(seed.timezone)}
)
on conflict (id) do update
set
  firm_id = excluded.firm_id,
  name = excluded.name,
  legal_name = excluded.legal_name,
  slug = excluded.slug,
  status = excluded.status,
  base_currency = excluded.base_currency,
  fiscal_year_start_month = excluded.fiscal_year_start_month,
  country_code = excluded.country_code,
  timezone = excluded.timezone,
  updated_at = now();

insert into public.organization_members (
  firm_id,
  organization_id,
  user_id,
  role,
  status,
  is_external_client
)
values (
  ${sqlLiteral(MINIMAL_TENANT_SEED_IDS.firmId)},
  ${sqlLiteral(MINIMAL_TENANT_SEED_IDS.organizationId)},
  ${sqlLiteral(MINIMAL_TENANT_SEED_IDS.appUserId)},
  'org_admin',
  'active',
  false
)
on conflict (organization_id, user_id) do update
set
  firm_id = excluded.firm_id,
  role = excluded.role,
  status = excluded.status,
  is_external_client = excluded.is_external_client,
  updated_at = now();

insert into public.organization_sequences (
  id,
  firm_id,
  organization_id,
  sequence_name,
  prefix,
  next_value,
  padding_width
)
values (
  ${sqlLiteral(MINIMAL_TENANT_SEED_IDS.journalSequenceId)},
  ${sqlLiteral(MINIMAL_TENANT_SEED_IDS.firmId)},
  ${sqlLiteral(MINIMAL_TENANT_SEED_IDS.organizationId)},
  'journal_entry',
  'JE',
  1,
  6
)
on conflict (organization_id, sequence_name) do update
set
  prefix = excluded.prefix,
  next_value = excluded.next_value,
  padding_width = excluded.padding_width,
  updated_at = now();

insert into public.accounting_periods (
  id,
  firm_id,
  organization_id,
  name,
  period_start,
  period_end,
  status
)
values (
  ${sqlLiteral(MINIMAL_TENANT_SEED_IDS.accountingPeriodId)},
  ${sqlLiteral(MINIMAL_TENANT_SEED_IDS.firmId)},
  ${sqlLiteral(MINIMAL_TENANT_SEED_IDS.organizationId)},
  ${sqlLiteral(seed.periodName)},
  ${sqlDateLiteral(seed.periodStart)},
  ${sqlDateLiteral(seed.periodEnd)},
  'open'
)
on conflict (organization_id, period_start, period_end) do update
set
  name = excluded.name,
  status = excluded.status,
  updated_at = now();

insert into public.accounts (
  id,
  firm_id,
  organization_id,
  code,
  name,
  type,
  subtype,
  parent_account_id,
  status,
  is_postable
)
values
${accountValues}
on conflict (organization_id, code) do update
set
  name = excluded.name,
  type = excluded.type,
  subtype = excluded.subtype,
  parent_account_id = excluded.parent_account_id,
  status = excluded.status,
  is_postable = excluded.is_postable,
  updated_at = now();

commit;
`;
}

function validateInput(input: MinimalTenantSeedInput) {
  if (input.authUserId.trim() === '') {
    throw new Error('authUserId is required.');
  }

  if (input.userEmail.trim() === '') {
    throw new Error('userEmail is required.');
  }

  const fiscalYearStartMonth = input.fiscalYearStartMonth ?? DEFAULTS.fiscalYearStartMonth;

  if (fiscalYearStartMonth < 1 || fiscalYearStartMonth > 12) {
    throw new Error('fiscalYearStartMonth must be between 1 and 12.');
  }

  const periodStart = input.periodStart ?? DEFAULTS.periodStart;
  const periodEnd = input.periodEnd ?? DEFAULTS.periodEnd;

  if (periodStart > periodEnd) {
    throw new Error('periodStart must be earlier than or equal to periodEnd.');
  }
}

function sqlLiteral(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlNullableLiteral(value?: string | null) {
  if (value === undefined || value === null || value.trim() === '') {
    return 'null';
  }

  return sqlLiteral(value);
}

function sqlDateLiteral(value: string) {
  return `${sqlLiteral(value)}::date`;
}
