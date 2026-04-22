create or replace function public.validate_accounting_period_for_posting(
  target_organization_id uuid,
  target_entry_date date,
  target_accounting_period_id uuid default null
)
returns void
language plpgsql
as $$
declare
  matched_period record;
begin
  if target_accounting_period_id is not null then
    select ap.*
    into matched_period
    from public.accounting_periods ap
    where ap.id = target_accounting_period_id;

    if not found then
      raise exception 'Accounting period % does not exist', target_accounting_period_id
        using errcode = '23503';
    end if;

    if matched_period.organization_id <> target_organization_id then
      raise exception 'Accounting period % does not belong to organization %',
        target_accounting_period_id, target_organization_id
        using errcode = '23514';
    end if;

    if target_entry_date < matched_period.period_start or target_entry_date > matched_period.period_end then
      raise exception 'Entry date % is outside accounting period % (% to %)',
        target_entry_date, target_accounting_period_id, matched_period.period_start, matched_period.period_end
        using errcode = '23514';
    end if;

    if matched_period.status = 'closed' then
      raise exception 'Accounting period % is closed for posting', target_accounting_period_id
        using errcode = '55000';
    end if;

    return;
  end if;

  select ap.*
  into matched_period
  from public.accounting_periods ap
  where ap.organization_id = target_organization_id
    and target_entry_date between ap.period_start and ap.period_end
  order by ap.period_start desc
  limit 1;

  if found and matched_period.status = 'closed' then
    raise exception 'Entry date % falls in closed accounting period %',
      target_entry_date, matched_period.id
      using errcode = '55000';
  end if;
end;
$$;

create or replace function public.enforce_journal_entry_draft_line_org_consistency()
returns trigger
language plpgsql
as $$
declare
  draft_organization_id uuid;
  account_organization_id uuid;
begin
  select d.organization_id into draft_organization_id
  from public.journal_entry_drafts d
  where d.id = new.draft_id;

  select a.organization_id into account_organization_id
  from public.accounts a
  where a.id = new.account_id;

  if draft_organization_id is null or account_organization_id is null then
    raise exception 'Draft line references missing draft/account rows'
      using errcode = '23503';
  end if;

  if draft_organization_id <> account_organization_id then
    raise exception 'Draft line account % does not belong to draft organization %',
      new.account_id, draft_organization_id
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_journal_entry_line_org_consistency()
returns trigger
language plpgsql
as $$
declare
  entry_organization_id uuid;
  account_organization_id uuid;
begin
  select je.organization_id into entry_organization_id
  from public.journal_entries je
  where je.id = new.journal_entry_id;

  select a.organization_id into account_organization_id
  from public.accounts a
  where a.id = new.account_id;

  if entry_organization_id is null or account_organization_id is null then
    raise exception 'Journal line references missing journal/account rows'
      using errcode = '23503';
  end if;

  if entry_organization_id <> account_organization_id then
    raise exception 'Journal line account % does not belong to journal organization %',
      new.account_id, entry_organization_id
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_journal_entry_draft_org_consistency()
returns trigger
language plpgsql
as $$
declare
  period_organization_id uuid;
begin
  if new.accounting_period_id is not null then
    select ap.organization_id into period_organization_id
    from public.accounting_periods ap
    where ap.id = new.accounting_period_id;

    if period_organization_id is null then
      raise exception 'Draft references missing accounting period %', new.accounting_period_id
        using errcode = '23503';
    end if;

    if period_organization_id <> new.organization_id then
      raise exception 'Draft accounting period % does not belong to organization %',
        new.accounting_period_id, new.organization_id
        using errcode = '23514';
    end if;
  end if;

  if new.approval_request_id is not null then
    if not exists (
      select 1
      from public.approval_requests ar
      where ar.id = new.approval_request_id
        and ar.organization_id = new.organization_id
        and ar.firm_id = new.firm_id
    ) then
      raise exception 'Draft approval request % does not belong to the same tenant',
        new.approval_request_id
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.enforce_journal_entry_org_consistency_and_period()
returns trigger
language plpgsql
as $$
begin
  if new.accounting_period_id is not null then
    if not exists (
      select 1
      from public.accounting_periods ap
      where ap.id = new.accounting_period_id
        and ap.organization_id = new.organization_id
        and ap.firm_id = new.firm_id
    ) then
      raise exception 'Journal entry accounting period % does not belong to the same tenant',
        new.accounting_period_id
        using errcode = '23514';
    end if;
  end if;

  if new.draft_id is not null then
    if not exists (
      select 1
      from public.journal_entry_drafts d
      where d.id = new.draft_id
        and d.organization_id = new.organization_id
        and d.firm_id = new.firm_id
    ) then
      raise exception 'Journal entry draft % does not belong to the same tenant',
        new.draft_id
        using errcode = '23514';
    end if;
  end if;

  perform public.validate_accounting_period_for_posting(
    new.organization_id,
    new.entry_date,
    new.accounting_period_id
  );

  return new;
end;
$$;

create or replace function public.enforce_journal_entry_reversal_consistency()
returns trigger
language plpgsql
as $$
declare
  original_entry public.journal_entries%rowtype;
  reversal_entry public.journal_entries%rowtype;
begin
  select * into original_entry
  from public.journal_entries
  where id = new.original_journal_entry_id;

  select * into reversal_entry
  from public.journal_entries
  where id = new.reversal_journal_entry_id;

  if not found then
    null;
  end if;

  if original_entry.id is null or reversal_entry.id is null then
    raise exception 'Reversal references missing journal entries'
      using errcode = '23503';
  end if;

  if original_entry.organization_id <> new.organization_id
     or reversal_entry.organization_id <> new.organization_id
     or original_entry.firm_id <> new.firm_id
     or reversal_entry.firm_id <> new.firm_id then
    raise exception 'Reversal entries do not belong to the same tenant as reversal row'
      using errcode = '23514';
  end if;

  if new.approval_request_id is not null then
    if not exists (
      select 1
      from public.approval_requests ar
      where ar.id = new.approval_request_id
        and ar.organization_id = new.organization_id
        and ar.firm_id = new.firm_id
    ) then
      raise exception 'Reversal approval request % does not belong to the same tenant',
        new.approval_request_id
        using errcode = '23514';
    end if;
  end if;

  perform public.validate_accounting_period_for_posting(
    new.organization_id,
    new.reversal_date,
    reversal_entry.accounting_period_id
  );

  return new;
end;
$$;

drop trigger if exists trg_journal_entry_drafts_org_consistency on public.journal_entry_drafts;
create trigger trg_journal_entry_drafts_org_consistency
before insert or update on public.journal_entry_drafts
for each row
execute function public.enforce_journal_entry_draft_org_consistency();

drop trigger if exists trg_journal_entry_draft_lines_org_consistency on public.journal_entry_draft_lines;
create trigger trg_journal_entry_draft_lines_org_consistency
before insert or update on public.journal_entry_draft_lines
for each row
execute function public.enforce_journal_entry_draft_line_org_consistency();

drop trigger if exists trg_journal_entries_org_consistency on public.journal_entries;
create trigger trg_journal_entries_org_consistency
before insert on public.journal_entries
for each row
execute function public.enforce_journal_entry_org_consistency_and_period();

drop trigger if exists trg_journal_entry_lines_org_consistency on public.journal_entry_lines;
create trigger trg_journal_entry_lines_org_consistency
before insert on public.journal_entry_lines
for each row
execute function public.enforce_journal_entry_line_org_consistency();

drop trigger if exists trg_journal_entry_reversals_consistency on public.journal_entry_reversals;
create trigger trg_journal_entry_reversals_consistency
before insert on public.journal_entry_reversals
for each row
execute function public.enforce_journal_entry_reversal_consistency();
