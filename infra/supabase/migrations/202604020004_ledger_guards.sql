create or replace function public.enforce_non_overlapping_accounting_periods()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1
    from public.accounting_periods ap
    where ap.organization_id = new.organization_id
      and ap.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and daterange(ap.period_start, ap.period_end, '[]') && daterange(new.period_start, new.period_end, '[]')
  ) then
    raise exception 'Accounting periods may not overlap for organization %', new.organization_id
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_accounting_periods_no_overlap on public.accounting_periods;

create trigger trg_accounting_periods_no_overlap
before insert or update on public.accounting_periods
for each row
execute function public.enforce_non_overlapping_accounting_periods();

create or replace function public.prevent_posted_ledger_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Posted ledger rows are immutable; use reversal records instead'
    using errcode = '55000';
end;
$$;

drop trigger if exists trg_journal_entries_immutable on public.journal_entries;
create trigger trg_journal_entries_immutable
before update or delete on public.journal_entries
for each row
execute function public.prevent_posted_ledger_mutation();

drop trigger if exists trg_journal_entry_lines_immutable on public.journal_entry_lines;
create trigger trg_journal_entry_lines_immutable
before update or delete on public.journal_entry_lines
for each row
execute function public.prevent_posted_ledger_mutation();

drop trigger if exists trg_journal_entry_reversals_immutable on public.journal_entry_reversals;
create trigger trg_journal_entry_reversals_immutable
before update or delete on public.journal_entry_reversals
for each row
execute function public.prevent_posted_ledger_mutation();

create or replace function public.validate_posted_journal_entry_balance(target_journal_entry_id uuid)
returns void
language plpgsql
as $$
declare
  line_count integer;
  total_debit numeric(18, 2);
  total_credit numeric(18, 2);
begin
  select
    count(*),
    coalesce(sum(jel.debit), 0),
    coalesce(sum(jel.credit), 0)
  into line_count, total_debit, total_credit
  from public.journal_entry_lines jel
  where jel.journal_entry_id = target_journal_entry_id;

  if line_count < 2 then
    raise exception 'Journal entry % must contain at least two lines', target_journal_entry_id
      using errcode = '23514';
  end if;

  if total_debit <> total_credit then
    raise exception 'Journal entry % is not balanced: debit %, credit %',
      target_journal_entry_id, total_debit, total_credit
      using errcode = '23514';
  end if;
end;
$$;

create or replace function public.enforce_posted_journal_balance_from_entry()
returns trigger
language plpgsql
as $$
begin
  perform public.validate_posted_journal_entry_balance(new.id);
  return null;
end;
$$;

create or replace function public.enforce_posted_journal_balance_from_line()
returns trigger
language plpgsql
as $$
begin
  perform public.validate_posted_journal_entry_balance(coalesce(new.journal_entry_id, old.journal_entry_id));
  return null;
end;
$$;

drop trigger if exists trg_journal_entries_balance on public.journal_entries;
create constraint trigger trg_journal_entries_balance
after insert on public.journal_entries
deferrable initially deferred
for each row
execute function public.enforce_posted_journal_balance_from_entry();

drop trigger if exists trg_journal_entry_lines_balance on public.journal_entry_lines;
create constraint trigger trg_journal_entry_lines_balance
after insert or update or delete on public.journal_entry_lines
deferrable initially deferred
for each row
execute function public.enforce_posted_journal_balance_from_line();
