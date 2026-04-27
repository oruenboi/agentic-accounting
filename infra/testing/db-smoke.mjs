import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Client } = pg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const migrationsDir = path.join(repoRoot, 'infra/supabase/migrations');
const databaseUrl =
  process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:55432/agentic_accounting_test';

const ids = {
  firm: '00000000-0000-4000-8000-000000000001',
  orgA: '00000000-0000-4000-8000-000000000002',
  orgB: '00000000-0000-4000-8000-000000000003',
  userA: '00000000-0000-4000-8000-000000000004',
  authA: '00000000-0000-4000-8000-000000000005',
  userB: '00000000-0000-4000-8000-000000000006',
  authB: '00000000-0000-4000-8000-000000000007',
  periodA: '00000000-0000-4000-8000-000000000008',
  cashA: '00000000-0000-4000-8000-000000000009',
  revenueA: '00000000-0000-4000-8000-000000000010',
  cashB: '00000000-0000-4000-8000-000000000011',
  balancedEntry: '00000000-0000-4000-8000-000000000012',
  unbalancedEntry: '00000000-0000-4000-8000-000000000013',
  scheduleDefinition: '00000000-0000-4000-8000-000000000014',
  scheduleRun: '00000000-0000-4000-8000-000000000015'
};

function assertDisposableDatabase(url) {
  const parsed = new URL(url);
  const host = parsed.hostname;
  const port = parsed.port;
  const dbName = parsed.pathname.replace(/^\//, '');
  const localHost = host === '127.0.0.1' || host === 'localhost';

  if (!localHost || port !== '55432' || !dbName.includes('test')) {
    throw new Error(
      `Refusing to run DB smoke tests against non-disposable database URL: ${host}:${port}/${dbName}`
    );
  }
}

async function withClient(callback) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    return await callback(client);
  } finally {
    await client.end();
  }
}

async function expectFailure(label, callback, pattern) {
  try {
    await callback();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (pattern.test(message)) {
      console.log(`ok - ${label}`);
      return;
    }

    throw new Error(`${label} failed with unexpected error: ${message}`);
  }

  throw new Error(`${label} unexpectedly succeeded`);
}

async function applyMigrations(client) {
  await client.query('create extension if not exists pgcrypto');
  await client.query('create schema if not exists auth');
  await client.query(`
    create or replace function auth.uid()
    returns uuid
    language sql
    stable
    as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
  `);

  const files = [
    '202604020001_audit_schema.sql',
    '202604020002_tenant_schema.sql',
    '202604020003_ledger_schema.sql',
    '202604020004_ledger_guards.sql',
    '202604030001_approval_requests.sql',
    '202604070001_idempotency_keys.sql',
    '202604070002_agent_proposals.sql',
    '202604070003_ledger_write_path_guards.sql',
    '202604070004_reporting_sql.sql',
    '202604070005_schedule_schema.sql',
    '202604230001_agent_proposals_pending_approval.sql',
    '202604230002_approval_actions_escalated.sql'
  ];

  for (const file of files) {
    const sql = await readFile(path.join(migrationsDir, file), 'utf8');
    await client.query(sql);
    console.log(`ok - applied ${file}`);
  }
}

async function seedTenantData(client) {
  await client.query(
    `
      insert into public.firms (id, name, slug, status)
      values ($1, 'Harness Firm', 'harness-firm', 'active')
    `,
    [ids.firm]
  );
  await client.query(
    `
      insert into public.users (id, auth_user_id, email, status)
      values
        ($1, $2, 'user-a@example.com', 'active'),
        ($3, $4, 'user-b@example.com', 'active')
    `,
    [ids.userA, ids.authA, ids.userB, ids.authB]
  );
  await client.query(
    `
      insert into public.organizations (
        id, firm_id, name, slug, status, base_currency, fiscal_year_start_month, timezone
      )
      values
        ($1, $3, 'Org A', 'org-a', 'active', 'USD', 1, 'UTC'),
        ($2, $3, 'Org B', 'org-b', 'active', 'USD', 1, 'UTC')
    `,
    [ids.orgA, ids.orgB, ids.firm]
  );
  await client.query(
    `
      insert into public.organization_members (firm_id, organization_id, user_id, role, status)
      values
        ($1, $2, $4, 'accountant', 'active'),
        ($1, $3, $5, 'accountant', 'active')
    `,
    [ids.firm, ids.orgA, ids.orgB, ids.userA, ids.userB]
  );
  await client.query(
    `
      insert into public.accounting_periods (id, firm_id, organization_id, name, period_start, period_end, status)
      values ($1, $2, $3, 'FY2026', '2026-01-01', '2026-12-31', 'open')
    `,
    [ids.periodA, ids.firm, ids.orgA]
  );
  await client.query(
    `
      insert into public.accounts (id, firm_id, organization_id, code, name, type, subtype, status, is_postable)
      values
        ($1, $4, $5, '1000', 'Cash', 'asset', 'cash', 'active', true),
        ($2, $4, $5, '4000', 'Revenue', 'revenue', 'operating_revenue', 'active', true),
        ($3, $4, $6, '1000', 'Other Org Cash', 'asset', 'cash', 'active', true)
    `,
    [ids.cashA, ids.revenueA, ids.cashB, ids.firm, ids.orgA, ids.orgB]
  );
}

async function assertCoreObjects(client) {
  const result = await client.query(
    `
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name = any($1::text[])
      order by table_name
    `,
    [
      [
        'accounts',
        'accounting_periods',
        'audit_logs',
        'journal_entries',
        'journal_entry_lines',
        'schedule_definitions',
        'schedule_runs',
        'schedule_reconciliations'
      ]
    ]
  );

  if (result.rowCount !== 8) {
    throw new Error(`Expected 8 core tables, found ${result.rowCount}`);
  }

  console.log('ok - core tables exist');
}

async function assertRlsIsolation() {
  await withClient(async (client) => {
    await client.query('drop role if exists app_rls_tester');
    await client.query('create role app_rls_tester login');
    await client.query('grant usage on schema public, auth to app_rls_tester');
    await client.query('grant select on all tables in schema public to app_rls_tester');
    await client.query('grant execute on all functions in schema public to app_rls_tester');
  });

  await withClient(async (client) => {
    await client.query('set role app_rls_tester');
    await client.query(`select set_config('request.jwt.claim.sub', $1, false)`, [ids.authA]);
    const result = await client.query('select organization_id::text from public.accounts order by code, name');
    const visibleOrganizationIds = new Set(result.rows.map((row) => row.organization_id));

    if (!visibleOrganizationIds.has(ids.orgA) || visibleOrganizationIds.has(ids.orgB)) {
      throw new Error(`RLS isolation failed: ${JSON.stringify(result.rows)}`);
    }

    console.log('ok - RLS hides other organization accounts');
  });
}

async function assertAccountingPeriodGuard(client) {
  await expectFailure(
    'accounting period overlap guard rejects overlap',
    () =>
      client.query(
        `
          insert into public.accounting_periods (firm_id, organization_id, name, period_start, period_end, status)
          values ($1, $2, 'Overlapping', '2026-06-01', '2026-12-31', 'open')
        `,
        [ids.firm, ids.orgA]
      ),
    /may not overlap/
  );
}

async function assertUnbalancedJournalGuard() {
  await expectFailure(
    'balanced journal guard rejects unbalanced entry',
    () =>
      withClient(async (client) => {
        await client.query('begin');
        await client.query(
          `
            insert into public.journal_entries (
              id, firm_id, organization_id, accounting_period_id, entry_number, entry_date, source_type,
              posted_by_actor_type, posted_by_actor_id
            )
            values ($1, $2, $3, $4, 'JE-UNBALANCED', '2026-04-30', 'harness', 'system', 'harness')
          `,
          [ids.unbalancedEntry, ids.firm, ids.orgA, ids.periodA]
        );
        await client.query(
          `
            insert into public.journal_entry_lines (journal_entry_id, line_number, account_id, debit, credit)
            values ($1, 1, $2, 100, 0)
          `,
          [ids.unbalancedEntry, ids.cashA]
        );
        await client.query('commit');
      }),
    /must contain at least two lines|is not balanced/
  );
}

async function assertLedgerImmutability(client) {
  await client.query('begin');
  await client.query(
    `
      insert into public.journal_entries (
        id, firm_id, organization_id, accounting_period_id, entry_number, entry_date, source_type,
        posted_by_actor_type, posted_by_actor_id
      )
      values ($1, $2, $3, $4, 'JE-BALANCED', '2026-04-30', 'harness', 'system', 'harness')
    `,
    [ids.balancedEntry, ids.firm, ids.orgA, ids.periodA]
  );
  await client.query(
    `
      insert into public.journal_entry_lines (journal_entry_id, line_number, account_id, debit, credit)
      values
        ($1, 1, $2, 100, 0),
        ($1, 2, $3, 0, 100)
    `,
    [ids.balancedEntry, ids.cashA, ids.revenueA]
  );
  await client.query('commit');

  await expectFailure(
    'posted ledger immutability guard rejects update',
    () => client.query('update public.journal_entries set memo = $1 where id = $2', ['mutated', ids.balancedEntry]),
    /immutable/
  );
}

async function assertScheduleConstraints(client) {
  await client.query(
    `
      insert into public.schedule_definitions (
        id, firm_id, organization_id, schedule_type, name, gl_account_ids, generation_strategy
      )
      values ($1, $2, $3, 'bank', 'Cash schedule', array[$4]::uuid[], 'ledger_derived')
    `,
    [ids.scheduleDefinition, ids.firm, ids.orgA, ids.cashA]
  );
  await client.query(
    `
      insert into public.schedule_runs (
        id, firm_id, organization_id, schedule_definition_id, schedule_type, as_of_date,
        status, gl_balance, schedule_total, variance, generated_by_actor_type, generated_by_actor_id
      )
      values ($1, $2, $3, $4, 'bank', '2026-04-30', 'reconciled', 100, 100, 0, 'system', 'harness')
    `,
    [ids.scheduleRun, ids.firm, ids.orgA, ids.scheduleDefinition]
  );

  await expectFailure(
    'schedule reconciliation status constraint rejects invalid status',
    () =>
      client.query(
        `
          insert into public.schedule_reconciliations (
            schedule_run_id, firm_id, organization_id, gl_balance, schedule_total, variance, status
          )
          values ($1, $2, $3, 100, 100, 0, 'invalid_status')
        `,
        [ids.scheduleRun, ids.firm, ids.orgA]
      ),
    /violates check constraint/
  );
}

async function main() {
  assertDisposableDatabase(databaseUrl);

  await withClient(async (client) => {
    await applyMigrations(client);
    await seedTenantData(client);
    await assertCoreObjects(client);
    await assertAccountingPeriodGuard(client);
    await assertUnbalancedJournalGuard();
    await assertLedgerImmutability(client);
    await assertScheduleConstraints(client);
  });

  await assertRlsIsolation();
  console.log('ok - disposable DB smoke suite completed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
