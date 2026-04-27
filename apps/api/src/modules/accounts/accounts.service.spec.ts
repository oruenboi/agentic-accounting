import { AccountsService } from './accounts.service';
import type { AuthenticatedActor } from '../auth/authenticated-request.interface';

describe('AccountsService', () => {
  const actor: AuthenticatedActor = {
    actorType: 'user',
    authUserId: '11111111-1111-4111-8111-111111111111',
    email: 'operator@example.com'
  };

  const actorContext = {
    appUserId: 'user-1',
    authUserId: actor.authUserId,
    organizationRole: 'accountant',
    firmRole: null,
    firmId: 'firm-1'
  };

  const databaseService = {
    query: jest.fn()
  };

  const tenantAccessService = {
    assertOrganizationAccess: jest.fn()
  };

  let service: AccountsService;

  beforeEach(() => {
    jest.resetAllMocks();
    tenantAccessService.assertOrganizationAccess.mockResolvedValue(actorContext);
    service = new AccountsService(databaseService as never, tenantAccessService as never);
  });

  it('lists active accounts after asserting organization access', async () => {
    databaseService.query.mockResolvedValueOnce({
      rows: [
        {
          account_id: 'account-1',
          organization_id: 'org-1',
          code: '2000',
          name: 'Accounts Payable',
          type: 'liability',
          status: 'active',
          is_postable: true
        }
      ]
    });

    await expect(
      service.listAccounts(
        {
          organization_id: '550e8400-e29b-41d4-a716-446655440000',
          type: 'liability',
          postable_only: true,
          limit: 25
        },
        actor
      )
    ).resolves.toEqual({
      organization_id: '550e8400-e29b-41d4-a716-446655440000',
      actor_context: actorContext,
      filters: {
        type: 'liability',
        status: 'active',
        postable_only: true,
        limit: 25
      },
      items: [
        {
          account_id: 'account-1',
          organization_id: 'org-1',
          code: '2000',
          name: 'Accounts Payable',
          type: 'liability',
          status: 'active',
          is_postable: true
        }
      ]
    });

    expect(tenantAccessService.assertOrganizationAccess).toHaveBeenCalledWith(actor, '550e8400-e29b-41d4-a716-446655440000');
    expect(databaseService.query).toHaveBeenCalledWith(expect.stringContaining('from public.accounts'), [
      '550e8400-e29b-41d4-a716-446655440000',
      'firm-1',
      'liability',
      'active',
      true,
      25
    ]);
  });
});
