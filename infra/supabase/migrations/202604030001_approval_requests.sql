create table if not exists public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id),
  organization_id uuid not null references public.organizations(id),
  approval_number text null,
  action_type text not null,
  target_entity_type text not null,
  target_entity_id text not null,
  target_entity_snapshot jsonb not null default '{}'::jsonb,
  submitted_by_actor_type text not null check (submitted_by_actor_type in ('user', 'agent', 'system')),
  submitted_by_actor_id text not null,
  submitted_by_user_id uuid null references public.users(id),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled', 'expired')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'critical')),
  current_approver_user_id uuid null references public.users(id),
  expires_at timestamptz null,
  resolved_at timestamptz null,
  resolved_by_user_id uuid null references public.users(id),
  resolution_reason text null,
  policy_snapshot jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint approval_requests_action_type_not_blank check (btrim(action_type) <> ''),
  constraint approval_requests_target_entity_type_not_blank check (btrim(target_entity_type) <> ''),
  constraint approval_requests_target_entity_id_not_blank check (btrim(target_entity_id) <> ''),
  constraint approval_requests_submitted_by_actor_id_not_blank check (btrim(submitted_by_actor_id) <> ''),
  constraint approval_requests_resolution_consistency check (
    (status in ('approved', 'rejected', 'cancelled', 'expired') and resolved_at is not null)
    or (status = 'pending' and resolved_at is null)
  )
);

create index if not exists approval_requests_org_status_idx
  on public.approval_requests (organization_id, status, created_at desc);

create index if not exists approval_requests_target_idx
  on public.approval_requests (target_entity_type, target_entity_id);

create index if not exists approval_requests_current_approver_idx
  on public.approval_requests (current_approver_user_id, status);

create index if not exists approval_requests_resolution_idx
  on public.approval_requests (resolved_by_user_id, resolved_at desc);

alter table public.approval_requests enable row level security;

create policy approval_requests_select_members
  on public.approval_requests
  for select
  using (
    public.is_active_org_member(organization_id)
    or public.has_firm_role(firm_id, array['firm_owner', 'firm_admin', 'firm_manager'])
  );

alter table public.audit_logs
  add constraint audit_logs_approval_request_id_fkey
  foreign key (approval_request_id) references public.approval_requests(id);

alter table public.approval_actions
  add constraint approval_actions_approval_request_id_fkey
  foreign key (approval_request_id) references public.approval_requests(id) on delete cascade;

alter table public.journal_entry_drafts
  add constraint journal_entry_drafts_approval_request_id_fkey
  foreign key (approval_request_id) references public.approval_requests(id);

alter table public.journal_entry_reversals
  add constraint journal_entry_reversals_approval_request_id_fkey
  foreign key (approval_request_id) references public.approval_requests(id);
