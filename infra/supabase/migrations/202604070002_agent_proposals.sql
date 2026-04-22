create table if not exists public.agent_proposals (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id),
  organization_id uuid not null references public.organizations(id),
  proposal_type text not null,
  status text not null check (
    status in ('draft', 'proposed', 'needs_review', 'approved', 'rejected', 'posted', 'superseded', 'cancelled')
  ),
  title text not null,
  description text null,
  source_agent_name text null,
  source_agent_run_id text null,
  source_tool_name text null,
  source_request_id text null,
  correlation_id text null,
  idempotency_key text null,
  confidence numeric(5,4) null check (confidence is null or (confidence >= 0 and confidence <= 1)),
  disambiguation_required boolean not null default false,
  disambiguation_notes text null,
  target_entity_type text null,
  target_entity_id uuid null,
  approval_request_id uuid null references public.approval_requests(id),
  posted_entity_type text null,
  posted_entity_id uuid null,
  payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by_actor_type text not null check (created_by_actor_type in ('user', 'agent', 'system')),
  created_by_actor_id text not null,
  created_by_user_id uuid null references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz null,
  resolved_by_user_id uuid null references public.users(id),
  constraint agent_proposals_type_not_blank check (btrim(proposal_type) <> ''),
  constraint agent_proposals_title_not_blank check (btrim(title) <> ''),
  constraint agent_proposals_created_by_actor_id_not_blank check (btrim(created_by_actor_id) <> ''),
  constraint agent_proposals_resolution_pair check (
    (resolved_at is null and resolved_by_user_id is null)
    or (resolved_at is not null)
  )
);

create index if not exists agent_proposals_org_status_created_idx
  on public.agent_proposals (organization_id, status, created_at desc);

create index if not exists agent_proposals_agent_run_idx
  on public.agent_proposals (source_agent_run_id)
  where source_agent_run_id is not null;

create index if not exists agent_proposals_tool_created_idx
  on public.agent_proposals (source_tool_name, created_at desc)
  where source_tool_name is not null;

create index if not exists agent_proposals_approval_idx
  on public.agent_proposals (approval_request_id)
  where approval_request_id is not null;

create index if not exists agent_proposals_target_idx
  on public.agent_proposals (target_entity_type, target_entity_id)
  where target_entity_type is not null and target_entity_id is not null;

create index if not exists agent_proposals_posted_idx
  on public.agent_proposals (posted_entity_type, posted_entity_id)
  where posted_entity_type is not null and posted_entity_id is not null;

alter table public.agent_proposals enable row level security;

create policy agent_proposals_select_members
  on public.agent_proposals
  for select
  using (
    public.is_active_org_member(organization_id)
    or public.has_firm_role(firm_id, array['firm_owner', 'firm_admin', 'firm_manager'])
  );
