create table if not exists public.idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id),
  organization_id uuid not null references public.organizations(id),
  actor_type text not null check (actor_type in ('user', 'agent', 'service', 'system')),
  actor_id text not null,
  request_id text not null,
  idempotency_key text not null,
  operation_name text not null,
  request_hash text not null,
  normalized_payload jsonb not null default '{}'::jsonb,
  status text not null check (status in ('pending', 'succeeded', 'failed', 'conflicted')),
  resource_type text null,
  resource_id text null,
  response_code integer null,
  response_body jsonb null,
  error_code text null,
  error_message text null,
  created_at timestamptz not null default now(),
  expires_at timestamptz null,
  last_seen_at timestamptz not null default now(),
  constraint idempotency_keys_actor_id_not_blank check (btrim(actor_id) <> ''),
  constraint idempotency_keys_request_id_not_blank check (btrim(request_id) <> ''),
  constraint idempotency_keys_key_not_blank check (btrim(idempotency_key) <> ''),
  constraint idempotency_keys_operation_name_not_blank check (btrim(operation_name) <> ''),
  constraint idempotency_keys_request_hash_not_blank check (btrim(request_hash) <> ''),
  constraint idempotency_keys_expires_after_created check (
    expires_at is null or expires_at >= created_at
  )
);

create unique index if not exists idempotency_keys_scope_key_operation_uniq
  on public.idempotency_keys (
    firm_id,
    organization_id,
    actor_type,
    actor_id,
    idempotency_key,
    operation_name
  );

create index if not exists idempotency_keys_request_id_idx
  on public.idempotency_keys (request_id);

create index if not exists idempotency_keys_org_created_idx
  on public.idempotency_keys (organization_id, created_at desc);

create index if not exists idempotency_keys_operation_created_idx
  on public.idempotency_keys (operation_name, created_at desc);

create index if not exists idempotency_keys_expires_idx
  on public.idempotency_keys (expires_at)
  where expires_at is not null;

alter table public.idempotency_keys enable row level security;

create policy idempotency_keys_select_members
  on public.idempotency_keys
  for select
  using (
    public.is_active_org_member(organization_id)
    or public.has_firm_role(firm_id, array['firm_owner', 'firm_admin', 'firm_manager'])
  );
