create or replace view public.v_posted_journal_lines
with (security_invoker = true)
as
select
  je.firm_id,
  je.organization_id,
  je.id as journal_entry_id,
  jel.id as journal_entry_line_id,
  je.entry_number,
  je.entry_date,
  je.posted_at,
  je.status as journal_entry_status,
  je.source_type,
  je.source_id,
  je.memo as journal_entry_memo,
  je.posted_by_actor_type,
  je.posted_by_actor_id,
  je.reversal_of_journal_entry_id,
  je.draft_id,
  jel.line_number,
  jel.description as line_description,
  jel.account_id,
  a.code as account_code,
  a.name as account_name,
  a.type as account_type,
  a.subtype as account_subtype,
  jel.debit,
  jel.credit,
  (jel.debit - jel.credit)::numeric(18, 2) as signed_amount,
  jel.dimensions,
  jel.metadata as line_metadata,
  je.metadata as entry_metadata
from public.journal_entries je
join public.journal_entry_lines jel
  on jel.journal_entry_id = je.id
join public.accounts a
  on a.id = jel.account_id
where je.status in ('posted', 'reversed');

create or replace function public.fn_trial_balance(
  p_organization_id uuid,
  p_as_of_date date,
  p_include_zero_balances boolean default false
)
returns table (
  organization_id uuid,
  as_of_date date,
  account_id uuid,
  account_code text,
  account_name text,
  account_type text,
  account_subtype text,
  debit_balance numeric(18, 2),
  credit_balance numeric(18, 2),
  net_balance numeric(18, 2)
)
language sql
stable
as $$
  with account_scope as (
    select
      a.id,
      a.code,
      a.name,
      a.type,
      a.subtype
    from public.accounts a
    where a.organization_id = p_organization_id
      and a.status = 'active'
      and (
        p_include_zero_balances
        or exists (
          select 1
          from public.v_posted_journal_lines vpl
          where vpl.organization_id = a.organization_id
            and vpl.account_id = a.id
            and vpl.entry_date <= p_as_of_date
        )
      )
  ),
  account_balances as (
    select
      a.id as account_id,
      a.code as account_code,
      a.name as account_name,
      a.type as account_type,
      a.subtype as account_subtype,
      coalesce(sum(vpl.signed_amount), 0)::numeric(18, 2) as net_balance
    from account_scope a
    left join public.v_posted_journal_lines vpl
      on vpl.organization_id = p_organization_id
     and vpl.account_id = a.id
     and vpl.entry_date <= p_as_of_date
    group by
      a.id,
      a.code,
      a.name,
      a.type,
      a.subtype
  )
  select
    p_organization_id as organization_id,
    p_as_of_date as as_of_date,
    ab.account_id,
    ab.account_code,
    ab.account_name,
    ab.account_type,
    ab.account_subtype,
    greatest(ab.net_balance, 0)::numeric(18, 2) as debit_balance,
    greatest(-ab.net_balance, 0)::numeric(18, 2) as credit_balance,
    ab.net_balance
  from account_balances ab
  where p_include_zero_balances or ab.net_balance <> 0
  order by ab.account_code, ab.account_name;
$$;

create or replace function public.fn_balance_sheet(
  p_organization_id uuid,
  p_as_of_date date,
  p_include_zero_balances boolean default false
)
returns table (
  organization_id uuid,
  as_of_date date,
  section text,
  display_order integer,
  account_id uuid,
  account_code text,
  account_name text,
  account_type text,
  account_subtype text,
  amount numeric(18, 2),
  section_total numeric(18, 2),
  balance_check numeric(18, 2)
)
language sql
stable
as $$
  with trial_balance as (
    select
      tb.account_id,
      tb.account_code,
      tb.account_name,
      tb.account_type,
      tb.account_subtype,
      tb.net_balance
    from public.fn_trial_balance(p_organization_id, p_as_of_date, p_include_zero_balances) tb
    where tb.account_type in ('asset', 'liability', 'equity')
  ),
  statement_rows as (
    select
      p_organization_id as organization_id,
      p_as_of_date as as_of_date,
      case trial_balance.account_type
        when 'asset' then 'assets'
        when 'liability' then 'liabilities'
        else 'equity'
      end as section,
      case trial_balance.account_type
        when 'asset' then 1
        when 'liability' then 2
        else 3
      end as section_order,
      row_number() over (
        partition by case trial_balance.account_type
          when 'asset' then 'assets'
          when 'liability' then 'liabilities'
          else 'equity'
        end
        order by trial_balance.account_code, trial_balance.account_name
      ) as display_order,
      trial_balance.account_id,
      trial_balance.account_code,
      trial_balance.account_name,
      trial_balance.account_type,
      trial_balance.account_subtype,
      case trial_balance.account_type
        when 'asset' then trial_balance.net_balance
        else -trial_balance.net_balance
      end::numeric(18, 2) as amount
    from trial_balance
    where p_include_zero_balances or trial_balance.net_balance <> 0
  ),
  enriched_rows as (
    select
      statement_rows.*,
      sum(statement_rows.amount) over (partition by statement_rows.section)::numeric(18, 2) as section_total,
      (
        sum(case when statement_rows.section = 'assets' then statement_rows.amount else 0 end) over ()
        - sum(case when statement_rows.section in ('liabilities', 'equity') then statement_rows.amount else 0 end) over ()
      )::numeric(18, 2) as balance_check
    from statement_rows
  )
  select
    organization_id,
    as_of_date,
    section,
    display_order,
    account_id,
    account_code,
    account_name,
    account_type,
    account_subtype,
    amount,
    section_total,
    balance_check
  from enriched_rows
  order by
    case section
      when 'assets' then 1
      when 'liabilities' then 2
      else 3
    end,
    display_order;
$$;

create or replace function public.fn_profit_and_loss(
  p_organization_id uuid,
  p_from_date date,
  p_to_date date,
  p_include_zero_balances boolean default false
)
returns table (
  organization_id uuid,
  from_date date,
  to_date date,
  section text,
  display_order integer,
  account_id uuid,
  account_code text,
  account_name text,
  account_type text,
  account_subtype text,
  amount numeric(18, 2),
  section_total numeric(18, 2),
  net_income numeric(18, 2)
)
language sql
stable
as $$
  with period_balances as (
    select
      a.id as account_id,
      a.code as account_code,
      a.name as account_name,
      a.type as account_type,
      a.subtype as account_subtype,
      coalesce(sum(vpl.signed_amount), 0)::numeric(18, 2) as net_balance
    from public.accounts a
    left join public.v_posted_journal_lines vpl
      on vpl.organization_id = p_organization_id
     and vpl.account_id = a.id
     and vpl.entry_date between p_from_date and p_to_date
    where a.organization_id = p_organization_id
      and a.status = 'active'
      and a.type in ('revenue', 'expense')
    group by
      a.id,
      a.code,
      a.name,
      a.type,
      a.subtype
  ),
  statement_rows as (
    select
      p_organization_id as organization_id,
      p_from_date as from_date,
      p_to_date as to_date,
      case period_balances.account_type
        when 'revenue' then 'revenue'
        else 'expense'
      end as section,
      case period_balances.account_type
        when 'revenue' then 1
        else 2
      end as section_order,
      row_number() over (
        partition by period_balances.account_type
        order by period_balances.account_code, period_balances.account_name
      ) as display_order,
      period_balances.account_id,
      period_balances.account_code,
      period_balances.account_name,
      period_balances.account_type,
      period_balances.account_subtype,
      case period_balances.account_type
        when 'revenue' then -period_balances.net_balance
        else period_balances.net_balance
      end::numeric(18, 2) as amount
    from period_balances
    where p_include_zero_balances or period_balances.net_balance <> 0
  ),
  enriched_rows as (
    select
      statement_rows.*,
      sum(statement_rows.amount) over (partition by statement_rows.section)::numeric(18, 2) as section_total,
      (
        sum(case when statement_rows.section = 'revenue' then statement_rows.amount else 0 end) over ()
        - sum(case when statement_rows.section = 'expense' then statement_rows.amount else 0 end) over ()
      )::numeric(18, 2) as net_income
    from statement_rows
  )
  select
    organization_id,
    from_date,
    to_date,
    section,
    display_order,
    account_id,
    account_code,
    account_name,
    account_type,
    account_subtype,
    amount,
    section_total,
    net_income
  from enriched_rows
  order by
    case section
      when 'revenue' then 1
      else 2
    end,
    display_order;
$$;

create or replace function public.fn_general_ledger(
  p_organization_id uuid,
  p_from_date date,
  p_to_date date,
  p_account_ids uuid[] default null
)
returns table (
  organization_id uuid,
  from_date date,
  to_date date,
  account_id uuid,
  account_code text,
  account_name text,
  account_type text,
  account_subtype text,
  row_type text,
  entry_date date,
  journal_entry_id uuid,
  journal_entry_line_id uuid,
  entry_number text,
  memo text,
  line_description text,
  source_type text,
  source_id text,
  line_number integer,
  debit numeric(18, 2),
  credit numeric(18, 2),
  signed_amount numeric(18, 2),
  opening_balance numeric(18, 2),
  running_balance numeric(18, 2)
)
language sql
stable
as $$
  with account_scope as (
    select
      a.id,
      a.code,
      a.name,
      a.type,
      a.subtype
    from public.accounts a
    where a.organization_id = p_organization_id
      and a.status = 'active'
      and (
        p_account_ids is null
        or a.id = any(p_account_ids)
      )
      and exists (
        select 1
        from public.v_posted_journal_lines vpl
        where vpl.organization_id = a.organization_id
          and vpl.account_id = a.id
          and vpl.entry_date <= p_to_date
      )
  ),
  opening_balances as (
    select
      a.id as account_id,
      coalesce(sum(vpl.signed_amount), 0)::numeric(18, 2) as opening_balance
    from account_scope a
    left join public.v_posted_journal_lines vpl
      on vpl.organization_id = p_organization_id
     and vpl.account_id = a.id
     and vpl.entry_date < p_from_date
    group by a.id
  ),
  opening_rows as (
    select
      p_organization_id as organization_id,
      p_from_date as from_date,
      p_to_date as to_date,
      a.id as account_id,
      a.code as account_code,
      a.name as account_name,
      a.type as account_type,
      a.subtype as account_subtype,
      'opening_balance'::text as row_type,
      (p_from_date - 1) as entry_date,
      null::uuid as journal_entry_id,
      null::uuid as journal_entry_line_id,
      null::text as entry_number,
      'Opening balance'::text as memo,
      null::text as line_description,
      'system'::text as source_type,
      null::text as source_id,
      0::integer as line_number,
      0::numeric(18, 2) as debit,
      0::numeric(18, 2) as credit,
      0::numeric(18, 2) as signed_amount,
      ob.opening_balance,
      ob.opening_balance as running_balance,
      1 as row_order
    from account_scope a
    join opening_balances ob
      on ob.account_id = a.id
    where ob.opening_balance <> 0
       or exists (
         select 1
         from public.v_posted_journal_lines vpl
         where vpl.organization_id = p_organization_id
           and vpl.account_id = a.id
           and vpl.entry_date between p_from_date and p_to_date
       )
  ),
  activity_rows as (
    select
      vpl.organization_id,
      p_from_date as from_date,
      p_to_date as to_date,
      vpl.account_id,
      vpl.account_code,
      vpl.account_name,
      vpl.account_type,
      vpl.account_subtype,
      'entry_line'::text as row_type,
      vpl.entry_date,
      vpl.journal_entry_id,
      vpl.journal_entry_line_id,
      vpl.entry_number,
      coalesce(vpl.line_description, vpl.journal_entry_memo) as memo,
      vpl.line_description,
      vpl.source_type,
      vpl.source_id,
      vpl.line_number,
      vpl.debit,
      vpl.credit,
      vpl.signed_amount,
      ob.opening_balance,
      0::numeric(18, 2) as running_balance,
      2 as row_order
    from public.v_posted_journal_lines vpl
    join account_scope a
      on a.id = vpl.account_id
    join opening_balances ob
      on ob.account_id = vpl.account_id
    where vpl.organization_id = p_organization_id
      and vpl.entry_date between p_from_date and p_to_date
      and (
        p_account_ids is null
        or vpl.account_id = any(p_account_ids)
      )
  ),
  ledger_rows as (
    select * from opening_rows
    union all
    select * from activity_rows
  )
  select
    organization_id,
    from_date,
    to_date,
    account_id,
    account_code,
    account_name,
    account_type,
    account_subtype,
    row_type,
    entry_date,
    journal_entry_id,
    journal_entry_line_id,
    entry_number,
    memo,
    line_description,
    source_type,
    source_id,
    line_number,
    debit,
    credit,
    signed_amount,
    opening_balance,
    (
      opening_balance
      + sum(signed_amount) over (
        partition by account_id
        order by row_order, entry_date, coalesce(entry_number, ''), coalesce(line_number, 0), coalesce(journal_entry_line_id, '00000000-0000-0000-0000-000000000000'::uuid)
        rows between unbounded preceding and current row
      )
    )::numeric(18, 2) as running_balance
  from ledger_rows
  order by
    account_code,
    row_order,
    entry_date,
    entry_number,
    line_number,
    journal_entry_line_id;
$$;
