import { ForbiddenException } from '@nestjs/common';
import type { AuthenticatedActor } from '../auth/authenticated-request.interface';
import { SettingsService } from './settings.service';

describe('SettingsService', () => {
  const actor: AuthenticatedActor = {
    actorType: 'user',
    authUserId: '11111111-1111-4111-8111-111111111111',
    email: 'operator@example.com'
  };

  const actorContext = {
    appUserId: 'user-1',
    authUserId: actor.authUserId,
    organizationRole: 'org_admin',
    firmRole: null,
    firmId: 'firm-1'
  };

  const organizationRow = {
    organization_id: '550e8400-e29b-41d4-a716-446655440000',
    firm_id: 'firm-1',
    name: 'Acme Pte Ltd',
    legal_name: 'Acme Private Limited',
    slug: 'acme',
    status: 'active',
    base_currency: 'SGD',
    fiscal_year_start_month: 1,
    country_code: 'SG',
    timezone: 'Asia/Singapore',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z'
  };

  const databaseService = {
    query: jest.fn()
  };

  const tenantAccessService = {
    assertOrganizationAccess: jest.fn()
  };

  let service: SettingsService;

  beforeEach(() => {
    jest.resetAllMocks();
    tenantAccessService.assertOrganizationAccess.mockResolvedValue(actorContext);
    service = new SettingsService(databaseService as never, tenantAccessService as never);
  });

  it('reads organization settings after asserting organization access', async () => {
    databaseService.query.mockResolvedValueOnce({ rows: [organizationRow] });

    await expect(
      service.getOrganizationSettings(
        {
          organization_id: '550e8400-e29b-41d4-a716-446655440000'
        },
        actor
      )
    ).resolves.toEqual({
      ...organizationRow,
      actor_context: actorContext
    });

    expect(tenantAccessService.assertOrganizationAccess).toHaveBeenCalledWith(actor, '550e8400-e29b-41d4-a716-446655440000');
    expect(databaseService.query).toHaveBeenCalledWith(expect.stringContaining('from public.organizations'), [
      '550e8400-e29b-41d4-a716-446655440000',
      'firm-1'
    ]);
  });

  it('forbids organization updates for non-admin organization members', async () => {
    tenantAccessService.assertOrganizationAccess.mockResolvedValueOnce({
      ...actorContext,
      organizationRole: 'accountant',
      firmRole: null
    });

    await expect(
      service.updateOrganizationSettings(
        {
          organization_id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Updated'
        },
        actor
      )
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(databaseService.query).not.toHaveBeenCalled();
  });

  it('updates organization settings with firm and organization constraints', async () => {
    databaseService.query.mockResolvedValueOnce({
      rows: [
        {
          ...organizationRow,
          name: 'Updated Acme',
          legal_name: null,
          fiscal_year_start_month: 4
        }
      ]
    });

    await expect(
      service.updateOrganizationSettings(
        {
          organization_id: '550e8400-e29b-41d4-a716-446655440000',
          name: '  Updated Acme  ',
          legal_name: null,
          fiscal_year_start_month: 4
        },
        actor
      )
    ).resolves.toMatchObject({
      organization_id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Updated Acme',
      legal_name: null,
      fiscal_year_start_month: 4,
      slug: 'acme',
      status: 'active',
      actor_context: actorContext
    });

    expect(databaseService.query).toHaveBeenCalledWith(expect.stringContaining('update public.organizations'), [
      '550e8400-e29b-41d4-a716-446655440000',
      'firm-1',
      'Updated Acme',
      true,
      null,
      null,
      4,
      false,
      null,
      false,
      null
    ]);
  });

  it('lists organization members joined to users', async () => {
    const memberRow = {
      organization_member_id: 'member-1',
      user_id: 'user-2',
      auth_user_id: '22222222-2222-4222-8222-222222222222',
      email: 'client@example.com',
      display_name: 'Client User',
      role: 'client_viewer',
      status: 'active',
      is_external_client: true,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-02T00:00:00.000Z'
    };
    databaseService.query.mockResolvedValueOnce({ rows: [memberRow] });

    await expect(
      service.listOrganizationMembers(
        {
          organization_id: '550e8400-e29b-41d4-a716-446655440000'
        },
        actor
      )
    ).resolves.toEqual({
      organization_id: '550e8400-e29b-41d4-a716-446655440000',
      actor_context: actorContext,
      items: [memberRow]
    });

    expect(databaseService.query).toHaveBeenCalledWith(expect.stringContaining('from public.organization_members om'), [
      '550e8400-e29b-41d4-a716-446655440000',
      'firm-1'
    ]);
  });

  it('updates an organization member with membership, organization, and firm constraints', async () => {
    const memberRow = {
      organization_member_id: '550e8400-e29b-41d4-a716-446655440099',
      user_id: 'user-2',
      auth_user_id: '22222222-2222-4222-8222-222222222222',
      email: 'client@example.com',
      display_name: 'Client User',
      role: 'reviewer',
      status: 'inactive',
      is_external_client: false,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-02T00:00:00.000Z'
    };
    databaseService.query.mockResolvedValueOnce({ rows: [memberRow] });

    await expect(
      service.updateOrganizationMember(
        '550e8400-e29b-41d4-a716-446655440099',
        {
          organization_id: '550e8400-e29b-41d4-a716-446655440000',
          role: 'reviewer',
          status: 'inactive',
          is_external_client: false
        },
        actor
      )
    ).resolves.toEqual({
      organization_id: '550e8400-e29b-41d4-a716-446655440000',
      actor_context: actorContext,
      item: memberRow
    });

    expect(databaseService.query).toHaveBeenCalledWith(expect.stringContaining('update public.organization_members om'), [
      '550e8400-e29b-41d4-a716-446655440099',
      '550e8400-e29b-41d4-a716-446655440000',
      'firm-1',
      'reviewer',
      'inactive',
      false
    ]);
  });
});
