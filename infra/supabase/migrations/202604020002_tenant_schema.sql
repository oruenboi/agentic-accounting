create table if not exists public.firms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active' check (status in ('active', 'inactive')),
  base_country_code text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint firms_name_not_blank check (btrim(name) <> ''),
  constraint firms_slug_not_blank check (btrim(slug) <> '')
);

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique,
  email text not null unique,
  display_name text null,
  status text not null default 'active' check (status in ('active', 'inactive', 'invited')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_email_not_blank check (btrim(email) <> '')
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id),
  name text not null,
  legal_name text null,
  slug text not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  base_currency text not null,
  fiscal_year_start_month integer not null check (fiscal_year_start_month between 1 and 12),
  country_code text null,
  timezone text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_name_not_blank check (btrim(name) <> ''),
  constraint organizations_slug_not_blank check (btrim(slug) <> ''),
  constraint organizations_base_currency_not_blank check (btrim(base_currency) <> ''),
  constraint organizations_timezone_not_blank check (btrim(timezone) <> ''),
  constraint organizations_firm_slug_key unique (firm_id, slug)
);

create table if not exists public.firm_members (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id),
  user_id uuid not null references public.users(id),
  role text not null check (role in ('firm_owner', 'firm_admin', 'firm_manager', 'firm_staff', 'firm_auditor')),
  status text not null default 'active' check (status in ('active', 'inactive', 'invited')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint firm_members_unique unique (firm_id, user_id)
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id),
  organization_id uuid not null references public.organizations(id),
  user_id uuid not null references public.users(id),
  role text not null check (role in ('org_admin', 'reviewer', 'accountant', 'bookkeeper', 'client_viewer')),
  status text not null default 'active' check (status in ('active', 'inactive', 'invited')),
  is_external_client boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_members_unique unique (organization_id, user_id)
);

create index if not exists organizations_firm_idx
  on public.organizations (firm_id, status);

create index if not exists firm_members_user_idx
  on public.firm_members (user_id, status);

create index if not exists organization_members_user_idx
  on public.organization_members (user_id, status);

create index if not exists organization_members_org_idx
  on public.organization_members (organization_id, status);

create or replace function public.current_app_user_id()
returns uuid
language sql
stable
as $$
  select u.id
  from public.users u
  where u.auth_user_id = auth.uid()
  limit 1
$$;

create or replace function public.is_active_firm_member(target_firm_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.firm_members fm
    join public.users u on u.id = fm.user_id
    where fm.firm_id = target_firm_id
      and fm.status = 'active'
      and u.auth_user_id = auth.uid()
  )
$$;

create or replace function public.is_active_org_member(target_organization_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.organization_members om
    join public.users u on u.id = om.user_id
    where om.organization_id = target_organization_id
      and om.status = 'active'
      and u.auth_user_id = auth.uid()
  )
$$;

create or replace function public.has_firm_role(target_firm_id uuid, allowed_roles text[])
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.firm_members fm
    join public.users u on u.id = fm.user_id
    where fm.firm_id = target_firm_id
      and fm.status = 'active'
      and fm.role = any(allowed_roles)
      and u.auth_user_id = auth.uid()
  )
$$;

create or replace function public.has_org_role(target_organization_id uuid, allowed_roles text[])
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.organization_members om
    join public.users u on u.id = om.user_id
    where om.organization_id = target_organization_id
      and om.status = 'active'
      and om.role = any(allowed_roles)
      and u.auth_user_id = auth.uid()
  )
$$;

alter table public.firms enable row level security;
alter table public.users enable row level security;
alter table public.organizations enable row level security;
alter table public.firm_members enable row level security;
alter table public.organization_members enable row level security;

create policy firms_select_members
  on public.firms
  for select
  using (
    public.is_active_firm_member(id)
  );

create policy users_select_self
  on public.users
  for select
  using (
    auth_user_id = auth.uid()
  );

create policy organizations_select_members
  on public.organizations
  for select
  using (
    public.is_active_org_member(id)
    or public.has_firm_role(firm_id, array['firm_owner', 'firm_admin', 'firm_manager'])
  );

create policy firm_members_select_same_firm
  on public.firm_members
  for select
  using (
    public.is_active_firm_member(firm_id)
  );

create policy organization_members_select_same_org
  on public.organization_members
  for select
  using (
    public.is_active_org_member(organization_id)
    or public.has_firm_role(firm_id, array['firm_owner', 'firm_admin', 'firm_manager'])
  );
