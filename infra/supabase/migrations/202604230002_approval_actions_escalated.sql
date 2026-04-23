alter table public.approval_actions
  drop constraint if exists approval_actions_action_check;

alter table public.approval_actions
  add constraint approval_actions_action_check
  check (action in ('submitted', 'approved', 'rejected', 'cancelled', 'expired', 'recalled', 'escalated'));
