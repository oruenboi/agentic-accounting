create table if not exists public.schedule_definitions (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id),
  organization_id uuid null references public.organizations(id),
  schedule_type text not null check (schedule_type in (
    'bank',
    'accounts_receivable',
    'accounts_payable',
    'accruals',
    'prepayments',
    'fixed_assets',
    'tax_payable'
  )),
  name text not null,
  description text null,
  gl_account_ids uuid[] not null default '{}'::uuid[],
  generation_strategy text not null check (generation_strategy in (
    'subledger_derived',
    'ledger_derived',
    'register_derived',
    'hybrid_bank'
  )),
  group_by text null,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_definitions_name_not_blank check (btrim(name) <> ''),
  constraint schedule_definitions_description_not_blank check (description is null or btrim(description) <> ''),
  constraint schedule_definitions_group_by_not_blank check (group_by is null or btrim(group_by) <> ''),
  constraint schedule_definitions_gl_account_ids_not_empty check (coalesce(array_length(gl_account_ids, 1), 0) > 0)
);

create index if not exists schedule_definitions_firm_type_active_idx
  on public.schedule_definitions (firm_id, schedule_type, is_active);

create index if not exists schedule_definitions_org_type_active_idx
  on public.schedule_definitions (organization_id, schedule_type, is_active);

create index if not exists schedule_definitions_scope_idx
  on public.schedule_definitions (firm_id, organization_id, schedule_type);

create table if not exists public.schedule_runs (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id),
  organization_id uuid not null references public.organizations(id),
  schedule_definition_id uuid not null references public.schedule_definitions(id) on delete restrict,
  supersedes_schedule_run_id uuid null references public.schedule_runs(id) on delete set null,
  schedule_type text not null check (schedule_type in (
    'bank',
    'accounts_receivable',
    'accounts_payable',
    'accruals',
    'prepayments',
    'fixed_assets',
    'tax_payable'
  )),
  as_of_date date not null,
  status text not null default 'generated' check (status in (
    'generated',
    'variance_detected',
    'reconciled',
    'reviewed',
    'superseded'
  )),
  gl_balance numeric(18, 2) not null default 0,
  schedule_total numeric(18, 2) not null default 0,
  variance numeric(18, 2) not null default 0,
  generated_at timestamptz not null default now(),
  generated_by_actor_type text not null check (generated_by_actor_type in ('user', 'agent', 'system')),
  generated_by_actor_id text not null,
  reviewed_at timestamptz null,
  reviewed_by_user_id uuid null references public.users(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_runs_generated_by_actor_id_not_blank check (btrim(generated_by_actor_id) <> ''),
  constraint schedule_runs_variance_consistency check (variance = (gl_balance - schedule_total)),
  constraint schedule_runs_review_consistency check (
    (reviewed_at is null and reviewed_by_user_id is null)
    or (reviewed_at is not null and reviewed_by_user_id is not null)
  ),
  constraint schedule_runs_supersession_self_check check (
    supersedes_schedule_run_id is null or supersedes_schedule_run_id <> id
  )
);

create index if not exists schedule_runs_org_type_date_idx
  on public.schedule_runs (organization_id, schedule_type, as_of_date desc);

create index if not exists schedule_runs_definition_idx
  on public.schedule_runs (schedule_definition_id);

create index if not exists schedule_runs_status_idx
  on public.schedule_runs (status);

create index if not exists schedule_runs_generated_at_idx
  on public.schedule_runs (generated_at desc);

create index if not exists schedule_runs_reviewed_at_idx
  on public.schedule_runs (reviewed_at desc);

create index if not exists schedule_runs_supersedes_idx
  on public.schedule_runs (supersedes_schedule_run_id);

create table if not exists public.schedule_run_rows (
  id uuid primary key default gen_random_uuid(),
  schedule_run_id uuid not null references public.schedule_runs(id) on delete cascade,
  row_order integer not null check (row_order >= 1),
  reference_type text null,
  reference_id text null,
  reference_number text null,
  counterparty_id text null,
  counterparty_name text null,
  document_date date null,
  due_date date null,
  opening_amount numeric(18, 2) not null default 0,
  movement_amount numeric(18, 2) not null default 0,
  closing_amount numeric(18, 2) not null default 0,
  age_bucket text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_run_rows_reference_type_not_blank check (reference_type is null or btrim(reference_type) <> ''),
  constraint schedule_run_rows_reference_id_not_blank check (reference_id is null or btrim(reference_id) <> ''),
  constraint schedule_run_rows_reference_number_not_blank check (reference_number is null or btrim(reference_number) <> ''),
  constraint schedule_run_rows_counterparty_id_not_blank check (counterparty_id is null or btrim(counterparty_id) <> ''),
  constraint schedule_run_rows_counterparty_name_not_blank check (counterparty_name is null or btrim(counterparty_name) <> ''),
  constraint schedule_run_rows_age_bucket_not_blank check (age_bucket is null or btrim(age_bucket) <> ''),
  constraint schedule_run_rows_unique_order unique (schedule_run_id, row_order)
);

create index if not exists schedule_run_rows_run_idx
  on public.schedule_run_rows (schedule_run_id, row_order);

create index if not exists schedule_run_rows_reference_idx
  on public.schedule_run_rows (reference_type, reference_id);

create table if not exists public.schedule_reconciliations (
  id uuid primary key default gen_random_uuid(),
  schedule_run_id uuid not null references public.schedule_runs(id) on delete cascade,
  firm_id uuid not null references public.firms(id),
  organization_id uuid not null references public.organizations(id),
  gl_balance numeric(18, 2) not null default 0,
  schedule_total numeric(18, 2) not null default 0,
  variance numeric(18, 2) not null default 0,
  status text not null default 'unreviewed' check (status in (
    'unreviewed',
    'reconciled',
    'variance_detected',
    'approved_with_variance'
  )),
  reviewed_by_user_id uuid null references public.users(id),
  reviewed_at timestamptz null,
  notes text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_reconciliations_variance_consistency check (variance = (gl_balance - schedule_total)),
  constraint schedule_reconciliations_notes_not_blank check (notes is null or btrim(notes) <> ''),
  constraint schedule_reconciliations_review_consistency check (
    (status in ('unreviewed', 'variance_detected') and reviewed_at is null and reviewed_by_user_id is null)
    or (status in ('reconciled', 'approved_with_variance') and reviewed_at is not null and reviewed_by_user_id is not null)
  )
);

create unique index if not exists schedule_reconciliations_run_unique_idx
  on public.schedule_reconciliations (schedule_run_id);

create index if not exists schedule_reconciliations_org_status_idx
  on public.schedule_reconciliations (organization_id, status);

create index if not exists schedule_reconciliations_reviewed_idx
  on public.schedule_reconciliations (reviewed_at desc);

alter table public.schedule_definitions enable row level security;
alter table public.schedule_runs enable row level security;
alter table public.schedule_run_rows enable row level security;
alter table public.schedule_reconciliations enable row level security;

create policy schedule_definitions_select_members
  on public.schedule_definitions
  for select
  using (
    (
      organization_id is null
      and public.has_firm_role(firm_id, array['firm_owner', 'firm_admin', 'firm_manager'])
    )
    or (
      organization_id is not null
      and (
        public.is_active_org_member(organization_id)
        or public.has_firm_role(firm_id, array['firm_owner', 'firm_admin', 'firm_manager'])
      )
    )
  );

create policy schedule_runs_select_members
  on public.schedule_runs
  for select
  using (
    public.is_active_org_member(organization_id)
    or public.has_firm_role(firm_id, array['firm_owner', 'firm_admin', 'firm_manager'])
  );

create policy schedule_run_rows_select_members
  on public.schedule_run_rows
  for select
  using (
    exists (
      select 1
      from public.schedule_runs sr
      where sr.id = schedule_run_id
        and (
          public.is_active_org_member(sr.organization_id)
          or public.has_firm_role(sr.firm_id, array['firm_owner', 'firm_admin', 'firm_manager'])
        )
    )
  );

create policy schedule_reconciliations_select_members
  on public.schedule_reconciliations
  for select
  using (
    public.is_active_org_member(organization_id)
    or public.has_firm_role(firm_id, array['firm_owner', 'firm_admin', 'firm_manager'])
  );
