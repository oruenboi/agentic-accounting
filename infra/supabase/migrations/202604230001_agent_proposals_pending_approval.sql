alter table public.agent_proposals
  drop constraint if exists agent_proposals_status_check;

alter table public.agent_proposals
  add constraint agent_proposals_status_check check (
    status in ('draft', 'proposed', 'needs_review', 'pending_approval', 'approved', 'rejected', 'posted', 'superseded', 'cancelled')
  );
