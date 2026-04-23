import { buildMinimalTenantSeedSql, MINIMAL_TENANT_SEED_IDS } from './minimal-tenant-seed';

describe('buildMinimalTenantSeedSql', () => {
  it('renders the required tenant bootstrap inserts with stable defaults', () => {
    const sql = buildMinimalTenantSeedSql({
      authUserId: '11111111-1111-4111-8111-111111111111',
      userEmail: 'agent@nexiuslabs.com'
    });

    expect(sql).toContain('insert into public.firms');
    expect(sql).toContain('insert into public.users');
    expect(sql).toContain('insert into public.firm_members');
    expect(sql).toContain('insert into public.organizations');
    expect(sql).toContain('insert into public.organization_members');
    expect(sql).toContain('insert into public.organization_sequences');
    expect(sql).toContain('insert into public.accounting_periods');
    expect(sql).toContain('insert into public.accounts');
    expect(sql).toContain(MINIMAL_TENANT_SEED_IDS.organizationId);
    expect(sql).toContain("'agent@nexiuslabs.com'");
    expect(sql).toContain("'11111111-1111-4111-8111-111111111111'");
    expect(sql).toContain("'1000'");
    expect(sql).toContain("'5000'");
    expect(sql).toContain('on conflict (firm_id, user_id) do update');
    expect(sql).toContain('on conflict (organization_id, user_id) do update');
    expect(sql).toContain('on conflict (organization_id, code) do update');
  });

  it('honors explicit period and organization overrides', () => {
    const sql = buildMinimalTenantSeedSql({
      authUserId: '22222222-2222-4222-8222-222222222222',
      userEmail: 'finance@example.com',
      organizationName: 'Acme APAC',
      organizationSlug: 'acme-apac',
      periodName: 'FY2027',
      periodStart: '2027-01-01',
      periodEnd: '2027-12-31'
    });

    expect(sql).toContain("'Acme APAC'");
    expect(sql).toContain("'acme-apac'");
    expect(sql).toContain("'FY2027'");
    expect(sql).toContain("'2027-01-01'::date");
    expect(sql).toContain("'2027-12-31'::date");
  });

  it('rejects invalid fiscal year month values', () => {
    expect(() =>
      buildMinimalTenantSeedSql({
        authUserId: '33333333-3333-4333-8333-333333333333',
        userEmail: 'finance@example.com',
        fiscalYearStartMonth: 13
      })
    ).toThrow('fiscalYearStartMonth must be between 1 and 12.');
  });

  it('rejects period ranges where start is after end', () => {
    expect(() =>
      buildMinimalTenantSeedSql({
        authUserId: '44444444-4444-4444-8444-444444444444',
        userEmail: 'finance@example.com',
        periodStart: '2027-12-31',
        periodEnd: '2027-01-01'
      })
    ).toThrow('periodStart must be earlier than or equal to periodEnd.');
  });
});
