create or replace function public.current_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth
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
security definer
set search_path = public, auth
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
security definer
set search_path = public, auth
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
security definer
set search_path = public, auth
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
security definer
set search_path = public, auth
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
