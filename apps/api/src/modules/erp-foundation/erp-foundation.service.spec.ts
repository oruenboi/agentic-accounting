import { ForbiddenException } from '@nestjs/common';
import type { AuthenticatedActor } from '../auth/authenticated-request.interface';
import { ErpFoundationService } from './erp-foundation.service';

describe('ErpFoundationService', () => {
  const actor: AuthenticatedActor = {
    actorType: 'user',
    authUserId: '11111111-1111-4111-8111-111111111111',
    email: 'operator@example.com'
  };

  const actorContext = {
    appUserId: '22222222-2222-4222-8222-222222222222',
    authUserId: actor.authUserId,
    organizationRole: 'org_admin',
    firmRole: null,
    firmId: '33333333-3333-4333-8333-333333333333'
  };

  const query = jest.fn();
  const databaseService = {
    query,
    withTransaction: jest.fn(async (callback: (client: { query: typeof query }) => Promise<unknown>) => callback({ query }))
  };
  const tenantAccessService = {
    assertOrganizationAccess: jest.fn()
  };

  let service: ErpFoundationService;

  beforeEach(() => {
    jest.resetAllMocks();
    tenantAccessService.assertOrganizationAccess.mockResolvedValue(actorContext);
    databaseService.withTransaction.mockImplementation(
      async (callback: (client: { query: typeof query }) => Promise<unknown>) => callback({ query })
    );
    service = new ErpFoundationService(databaseService as never, tenantAccessService as never);
  });

  it('lists the complete module catalog after asserting tenant access', async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          module_registration_id: null,
          module_name: 'foundation',
          status: 'disabled',
          settings: {}
        }
      ]
    });

    await expect(
      service.listModules({ organization_id: '44444444-4444-4444-8444-444444444444' }, actor)
    ).resolves.toMatchObject({
      organization_id: '44444444-4444-4444-8444-444444444444',
      actor_context: actorContext,
      items: [{ module_name: 'foundation', status: 'disabled' }]
    });

    expect(query).toHaveBeenCalledWith(expect.stringContaining('from unnest($3::text[])'), [
      '44444444-4444-4444-8444-444444444444',
      actorContext.firmId,
      expect.arrayContaining(['foundation', 'receivables', 'payables'])
    ]);
  });

  it('configures a module and records the mutation in one transaction', async () => {
    const moduleRow = {
      module_registration_id: '55555555-5555-4555-8555-555555555555',
      module_name: 'foundation',
      status: 'enabled',
      enabled_at: '2026-09-01T00:00:00.000Z',
      enabled_by_user_id: actorContext.appUserId,
      settings: { party_duplicates: 'warn' }
    };
    query.mockResolvedValueOnce({ rows: [moduleRow] }).mockResolvedValueOnce({ rows: [] });

    await expect(
      service.configureModule(
        'foundation',
        {
          organization_id: '44444444-4444-4444-8444-444444444444',
          status: 'enabled',
          settings: { party_duplicates: 'warn' }
        },
        actor,
        'request-1'
      )
    ).resolves.toMatchObject({ item: moduleRow, actor_context: actorContext });

    expect(databaseService.withTransaction).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('insert into public.erp_module_registrations'),
      [
        actorContext.firmId,
        '44444444-4444-4444-8444-444444444444',
        'foundation',
        'enabled',
        actorContext.appUserId,
        JSON.stringify({ party_duplicates: 'warn' })
      ]
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('insert into public.audit_logs'),
      expect.arrayContaining(['erp.module.configured', 'request-1', 'erp_module_registration'])
    );
  });

  it('creates a party with roles and an audit record transactionally', async () => {
    const partyRow = {
      party_id: '66666666-6666-4666-8666-666666666666',
      firm_id: actorContext.firmId,
      organization_id: '44444444-4444-4444-8444-444444444444',
      party_type: 'company',
      display_name: 'Acme Pte Ltd',
      status: 'active',
      metadata: {}
    };
    const roleRows = [
      { party_role_id: '77777777-7777-4777-8777-777777777777', party_id: partyRow.party_id, role: 'customer' },
      { party_role_id: '88888888-8888-4888-8888-888888888888', party_id: partyRow.party_id, role: 'vendor' }
    ];
    query
      .mockResolvedValueOnce({ rows: [partyRow] })
      .mockResolvedValueOnce({ rows: roleRows })
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      service.createParty(
        {
          organization_id: partyRow.organization_id,
          party_type: 'company',
          display_name: '  Acme Pte Ltd  ',
          email: 'FINANCE@EXAMPLE.COM',
          roles: ['customer', 'vendor']
        },
        actor,
        'request-2'
      )
    ).resolves.toMatchObject({
      actor_context: actorContext,
      item: { ...partyRow, roles: roleRows }
    });

    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('insert into public.parties'),
      [
        actorContext.firmId,
        partyRow.organization_id,
        'company',
        'Acme Pte Ltd',
        null,
        null,
        null,
        'finance@example.com',
        null,
        null,
        null,
        '{}'
      ]
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('insert into public.party_roles'),
      [actorContext.firmId, partyRow.organization_id, partyRow.party_id, ['customer', 'vendor']]
    );
    expect(query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('insert into public.audit_logs'),
      expect.arrayContaining(['erp.party.created', 'request-2', 'party'])
    );
  });

  it('blocks party writes for client viewers', async () => {
    tenantAccessService.assertOrganizationAccess.mockResolvedValueOnce({
      ...actorContext,
      organizationRole: 'client_viewer'
    });

    await expect(
      service.createParty(
        {
          organization_id: '44444444-4444-4444-8444-444444444444',
          party_type: 'company',
          display_name: 'Acme',
          roles: ['customer']
        },
        actor
      )
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(databaseService.withTransaction).not.toHaveBeenCalled();
  });
});
