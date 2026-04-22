create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null,
  organization_id uuid null,
  event_name text not null,
  event_version integer not null default 1,
  event_timestamp timestamptz not null default now(),
  actor_type text not null check (actor_type in ('user', 'agent', 'system')),
  actor_id text not null,
  actor_display_name text null,
  user_id uuid null,
  agent_name text null,
  agent_run_id text null,
  tool_name text null,
  tool_input_hash text null,
  request_id text null,
  correlation_id text null,
  idempotency_key text null,
  session_id text null,
  entity_type text not null,
  entity_id text not null,
  parent_entity_type text null,
  parent_entity_id text null,
  action_status text not null check (action_status in ('attempted', 'succeeded', 'failed', 'rejected')),
  approval_request_id uuid null,
  approval_required boolean not null default false,
  organization_period_id uuid null,
  accounting_date date null,
  before_state jsonb null,
  after_state jsonb null,
  metadata jsonb not null default '{}'::jsonb,
  source_channel text not null check (source_channel in ('ui', 'api', 'agent_tool', 'system_job')),
  source_route text null,
  source_ip inet null,
  user_agent text null,
  created_at timestamptz not null default now(),
  constraint audit_logs_event_name_not_blank check (btrim(event_name) <> ''),
  constraint audit_logs_actor_id_not_blank check (btrim(actor_id) <> ''),
  constraint audit_logs_entity_type_not_blank check (btrim(entity_type) <> ''),
  constraint audit_logs_entity_id_not_blank check (btrim(entity_id) <> ''),
  constraint audit_logs_agent_fields_consistency check (
    actor_type <> 'agent'
    or (agent_name is not null and tool_name is not null)
  )
);

create index if not exists audit_logs_org_time_idx
  on public.audit_logs (organization_id, event_timestamp desc);

create index if not exists audit_logs_entity_idx
  on public.audit_logs (entity_type, entity_id, event_timestamp desc);

create index if not exists audit_logs_request_idx
  on public.audit_logs (request_id);

create index if not exists audit_logs_approval_idx
  on public.audit_logs (approval_request_id);

create index if not exists audit_logs_agent_run_idx
  on public.audit_logs (agent_run_id);

create index if not exists audit_logs_event_name_idx
  on public.audit_logs (event_name);

create table if not exists public.approval_actions (
  id uuid primary key default gen_random_uuid(),
  approval_request_id uuid not null,
  firm_id uuid not null,
  organization_id uuid not null,
  action text not null check (action in ('submitted', 'approved', 'rejected', 'cancelled', 'expired', 'recalled')),
  action_timestamp timestamptz not null default now(),
  actor_type text not null check (actor_type in ('user', 'agent', 'system')),
  actor_id text not null,
  actor_display_name text null,
  user_id uuid null,
  decision_reason text null,
  comments text null,
  request_id text null,
  correlation_id text null,
  idempotency_key text null,
  target_entity_type text not null,
  target_entity_id text not null,
  policy_snapshot jsonb null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint approval_actions_actor_id_not_blank check (btrim(actor_id) <> ''),
  constraint approval_actions_target_entity_type_not_blank check (btrim(target_entity_type) <> ''),
  constraint approval_actions_target_entity_id_not_blank check (btrim(target_entity_id) <> '')
);

create index if not exists approval_actions_request_idx
  on public.approval_actions (approval_request_id, action_timestamp asc);

create index if not exists approval_actions_org_time_idx
  on public.approval_actions (organization_id, action_timestamp desc);

create index if not exists approval_actions_target_idx
  on public.approval_actions (target_entity_type, target_entity_id);
