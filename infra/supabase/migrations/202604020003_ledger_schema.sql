create table if not exists public.organization_sequences (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id),
  organization_id uuid not null references public.organizations(id),
  sequence_name text not null,
  prefix text null,
  next_value bigint not null default 1 check (next_value >= 1),
  padding_width integer not null default 6 check (padding_width between 1 and 12),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_sequences_name_not_blank check (btrim(sequence_name) <> ''),
  constraint organization_sequences_unique unique (organization_id, sequence_name)
);

create table if not exists public.accounting_periods (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id),
  organization_id uuid not null references public.organizations(id),
  name text not null,
  period_start date not null,
  period_end date not null,
  status text not null default 'open' check (status in ('open', 'pre_close_review', 'closed', 'reopened')),
  closed_at timestamptz null,
  closed_by_user_id uuid null references public.users(id),
  reopened_at timestamptz null,
  reopened_by_user_id uuid null references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accounting_periods_name_not_blank check (btrim(name) <> ''),
  constraint accounting_periods_valid_range check (period_end >= period_start),
  constraint accounting_periods_unique unique (organization_id, period_start, period_end)
);

create index if not exists accounting_periods_org_dates_idx
  on public.accounting_periods (organization_id, period_start, period_end);

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id),
  organization_id uuid not null references public.organizations(id),
  code text not null,
  name text not null,
  type text not null check (type in ('asset', 'liability', 'equity', 'revenue', 'expense')),
  subtype text null,
  parent_account_id uuid null references public.accounts(id),
  status text not null default 'active' check (status in ('active', 'inactive')),
  is_postable boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accounts_code_not_blank check (btrim(code) <> ''),
  constraint accounts_name_not_blank check (btrim(name) <> ''),
  constraint accounts_unique_code unique (organization_id, code)
);

create index if not exists accounts_org_type_idx
  on public.accounts (organization_id, type, status);

create table if not exists public.journal_entry_drafts (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id),
  organization_id uuid not null references public.organizations(id),
  accounting_period_id uuid null references public.accounting_periods(id),
  draft_number text null,
  entry_date date not null,
  memo text null,
  source_type text not null,
  source_id text null,
  status text not null default 'draft' check (status in ('draft', 'validated', 'pending_approval', 'approved', 'posted', 'rejected', 'cancelled')),
  created_by_actor_type text not null check (created_by_actor_type in ('user', 'agent', 'system')),
  created_by_actor_id text not null,
  created_by_user_id uuid null references public.users(id),
  submitted_at timestamptz null,
  submitted_by_actor_type text null check (submitted_by_actor_type in ('user', 'agent', 'system')),
  submitted_by_actor_id text null,
  approved_at timestamptz null,
  approved_by_user_id uuid null references public.users(id),
  rejection_reason text null,
  approval_request_id uuid null,
  validation_summary jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint journal_entry_drafts_source_type_not_blank check (btrim(source_type) <> ''),
  constraint journal_entry_drafts_created_by_actor_id_not_blank check (btrim(created_by_actor_id) <> ''),
  constraint journal_entry_drafts_submitted_actor_pair check (
    (submitted_by_actor_type is null and submitted_by_actor_id is null)
    or (submitted_by_actor_type is not null and submitted_by_actor_id is not null)
  )
);

create index if not exists journal_entry_drafts_org_status_date_idx
  on public.journal_entry_drafts (organization_id, status, entry_date desc);

create index if not exists journal_entry_drafts_approval_idx
  on public.journal_entry_drafts (approval_request_id);

create table if not exists public.journal_entry_draft_lines (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.journal_entry_drafts(id) on delete cascade,
  line_number integer not null check (line_number >= 1),
  account_id uuid not null references public.accounts(id),
  description text null,
  debit numeric(18, 2) not null default 0 check (debit >= 0),
  credit numeric(18, 2) not null default 0 check (credit >= 0),
  dimensions jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint journal_entry_draft_lines_amount_side check (
    (debit = 0 and credit > 0)
    or (credit = 0 and debit > 0)
  ),
  constraint journal_entry_draft_lines_unique_line unique (draft_id, line_number)
);

create index if not exists journal_entry_draft_lines_draft_idx
  on public.journal_entry_draft_lines (draft_id, line_number);

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id),
  organization_id uuid not null references public.organizations(id),
  accounting_period_id uuid null references public.accounting_periods(id),
  draft_id uuid null references public.journal_entry_drafts(id),
  entry_number text not null,
  entry_date date not null,
  memo text null,
  source_type text not null,
  source_id text null,
  status text not null default 'posted' check (status in ('posted', 'reversed')),
  posted_at timestamptz not null default now(),
  posted_by_actor_type text not null check (posted_by_actor_type in ('user', 'agent', 'system')),
  posted_by_actor_id text not null,
  posted_by_user_id uuid null references public.users(id),
  reversal_of_journal_entry_id uuid null references public.journal_entries(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint journal_entries_entry_number_not_blank check (btrim(entry_number) <> ''),
  constraint journal_entries_source_type_not_blank check (btrim(source_type) <> ''),
  constraint journal_entries_posted_by_actor_id_not_blank check (btrim(posted_by_actor_id) <> ''),
  constraint journal_entries_unique_number unique (organization_id, entry_number),
  constraint journal_entries_reversal_self_check check (
    reversal_of_journal_entry_id is null or reversal_of_journal_entry_id <> id
  )
);

create index if not exists journal_entries_org_date_idx
  on public.journal_entries (organization_id, entry_date desc, posted_at desc);

create index if not exists journal_entries_draft_idx
  on public.journal_entries (draft_id);

create index if not exists journal_entries_reversal_idx
  on public.journal_entries (reversal_of_journal_entry_id);

create table if not exists public.journal_entry_lines (
  id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null references public.journal_entries(id) on delete restrict,
  line_number integer not null check (line_number >= 1),
  account_id uuid not null references public.accounts(id),
  description text null,
  debit numeric(18, 2) not null default 0 check (debit >= 0),
  credit numeric(18, 2) not null default 0 check (credit >= 0),
  dimensions jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint journal_entry_lines_amount_side check (
    (debit = 0 and credit > 0)
    or (credit = 0 and debit > 0)
  ),
  constraint journal_entry_lines_unique_line unique (journal_entry_id, line_number)
);

create index if not exists journal_entry_lines_entry_idx
  on public.journal_entry_lines (journal_entry_id, line_number);

create index if not exists journal_entry_lines_account_idx
  on public.journal_entry_lines (account_id);

create table if not exists public.journal_entry_reversals (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id),
  organization_id uuid not null references public.organizations(id),
  original_journal_entry_id uuid not null references public.journal_entries(id),
  reversal_journal_entry_id uuid not null references public.journal_entries(id),
  reversal_date date not null,
  reason text not null,
  created_by_actor_type text not null check (created_by_actor_type in ('user', 'agent', 'system')),
  created_by_actor_id text not null,
  created_by_user_id uuid null references public.users(id),
  approval_request_id uuid null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint journal_entry_reversals_reason_not_blank check (btrim(reason) <> ''),
  constraint journal_entry_reversals_created_by_actor_id_not_blank check (btrim(created_by_actor_id) <> ''),
  constraint journal_entry_reversals_distinct_entries check (
    original_journal_entry_id <> reversal_journal_entry_id
  ),
  constraint journal_entry_reversals_unique_original unique (original_journal_entry_id),
  constraint journal_entry_reversals_unique_reversal unique (reversal_journal_entry_id)
);

create index if not exists journal_entry_reversals_org_idx
  on public.journal_entry_reversals (organization_id, reversal_date desc);

alter table public.accounting_periods enable row level security;
alter table public.accounts enable row level security;
alter table public.organization_sequences enable row level security;
alter table public.journal_entry_drafts enable row level security;
alter table public.journal_entry_draft_lines enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_entry_lines enable row level security;
alter table public.journal_entry_reversals enable row level security;

create policy accounting_periods_select_members
  on public.accounting_periods
  for select
  using (
    public.is_active_org_member(organization_id)
    or public.has_firm_role(firm_id, array['firm_owner', 'firm_admin', 'firm_manager'])
  );

create policy accounts_select_members
  on public.accounts
  for select
  using (
    public.is_active_org_member(organization_id)
    or public.has_firm_role(firm_id, array['firm_owner', 'firm_admin', 'firm_manager'])
  );

create policy organization_sequences_select_members
  on public.organization_sequences
  for select
  using (
    public.is_active_org_member(organization_id)
    or public.has_firm_role(firm_id, array['firm_owner', 'firm_admin', 'firm_manager'])
  );

create policy journal_entry_drafts_select_members
  on public.journal_entry_drafts
  for select
  using (
    public.is_active_org_member(organization_id)
    or public.has_firm_role(firm_id, array['firm_owner', 'firm_admin', 'firm_manager'])
  );

create policy journal_entry_draft_lines_select_members
  on public.journal_entry_draft_lines
  for select
  using (
    exists (
      select 1
      from public.journal_entry_drafts d
      where d.id = draft_id
        and (
          public.is_active_org_member(d.organization_id)
          or public.has_firm_role(d.firm_id, array['firm_owner', 'firm_admin', 'firm_manager'])
        )
    )
  );

create policy journal_entries_select_members
  on public.journal_entries
  for select
  using (
    public.is_active_org_member(organization_id)
    or public.has_firm_role(firm_id, array['firm_owner', 'firm_admin', 'firm_manager'])
  );

create policy journal_entry_lines_select_members
  on public.journal_entry_lines
  for select
  using (
    exists (
      select 1
      from public.journal_entries je
      where je.id = journal_entry_id
        and (
          public.is_active_org_member(je.organization_id)
          or public.has_firm_role(je.firm_id, array['firm_owner', 'firm_admin', 'firm_manager'])
        )
    )
  );

create policy journal_entry_reversals_select_members
  on public.journal_entry_reversals
  for select
  using (
    public.is_active_org_member(organization_id)
    or public.has_firm_role(firm_id, array['firm_owner', 'firm_admin', 'firm_manager'])
  );
