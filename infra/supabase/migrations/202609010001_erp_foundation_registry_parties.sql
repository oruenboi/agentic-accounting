alter table public.organizations
  add constraint organizations_id_firm_key unique (id, firm_id);

create table if not exists public.erp_module_registrations (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id),
  organization_id uuid not null references public.organizations(id),
  module_name text not null,
  status text not null default 'disabled' check (status in ('enabled', 'disabled')),
  enabled_at timestamptz null,
  enabled_by_user_id uuid null references public.users(id),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint erp_module_registrations_name_not_blank check (btrim(module_name) <> ''),
  constraint erp_module_registrations_org_firm_fkey
    foreign key (organization_id, firm_id)
    references public.organizations(id, firm_id),
  constraint erp_module_registrations_org_module_key unique (organization_id, module_name)
);

create index if not exists erp_module_registrations_firm_org_idx
  on public.erp_module_registrations (firm_id, organization_id, status);

create table if not exists public.parties (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id),
  organization_id uuid not null references public.organizations(id),
  party_type text not null check (party_type in ('individual', 'company', 'government', 'internal')),
  display_name text not null,
  legal_name text null,
  tax_identifier text null,
  registration_number text null,
  email text null,
  phone text null,
  billing_address jsonb null,
  shipping_address jsonb null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint parties_display_name_not_blank check (btrim(display_name) <> ''),
  constraint parties_legal_name_not_blank check (legal_name is null or btrim(legal_name) <> ''),
  constraint parties_email_not_blank check (email is null or btrim(email) <> ''),
  constraint parties_org_firm_fkey
    foreign key (organization_id, firm_id)
    references public.organizations(id, firm_id),
  constraint parties_tenant_identity_key unique (id, firm_id, organization_id)
);

create index if not exists parties_firm_org_status_idx
  on public.parties (firm_id, organization_id, status, display_name);

create index if not exists parties_registration_idx
  on public.parties (organization_id, registration_number)
  where registration_number is not null;

create table if not exists public.party_roles (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id),
  organization_id uuid not null references public.organizations(id),
  party_id uuid not null,
  role text not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  role_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint party_roles_role_not_blank check (btrim(role) <> ''),
  constraint party_roles_party_tenant_fkey
    foreign key (party_id, firm_id, organization_id)
    references public.parties(id, firm_id, organization_id),
  constraint party_roles_party_role_key unique (party_id, role)
);

create index if not exists party_roles_org_role_status_idx
  on public.party_roles (organization_id, role, status);

create or replace function public.enforce_active_party_role()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'active' and not exists (
    select 1
    from public.parties p
    where p.id = new.party_id
      and p.firm_id = new.firm_id
      and p.organization_id = new.organization_id
      and p.status = 'active'
  ) then
    raise exception 'Active party roles require an active party.';
  end if;

  return new;
end;
$$;

create trigger party_roles_require_active_party
before insert or update of party_id, firm_id, organization_id, status
on public.party_roles
for each row execute function public.enforce_active_party_role();

create or replace function public.prevent_party_deactivation_with_active_roles()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'active' and new.status = 'inactive' and exists (
    select 1 from public.party_roles pr where pr.party_id = new.id and pr.status = 'active'
  ) then
    raise exception 'Deactivate party roles before deactivating the party.';
  end if;

  return new;
end;
$$;

create trigger parties_guard_deactivation
before update of status on public.parties
for each row execute function public.prevent_party_deactivation_with_active_roles();

alter table public.erp_module_registrations enable row level security;
alter table public.parties enable row level security;
alter table public.party_roles enable row level security;

create policy erp_module_registrations_select_members
  on public.erp_module_registrations
  for select
  using (
    public.is_active_org_member(organization_id)
    or public.has_firm_role(firm_id, array['firm_owner', 'firm_admin', 'firm_manager'])
  );

create policy parties_select_members
  on public.parties
  for select
  using (
    public.is_active_org_member(organization_id)
    or public.has_firm_role(firm_id, array['firm_owner', 'firm_admin', 'firm_manager'])
  );

create policy party_roles_select_members
  on public.party_roles
  for select
  using (
    public.is_active_org_member(organization_id)
    or public.has_firm_role(firm_id, array['firm_owner', 'firm_admin', 'firm_manager'])
  );
