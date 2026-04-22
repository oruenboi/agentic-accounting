import { ForbiddenException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { AuthenticatedActor, RequestActorContext } from './authenticated-request.interface';

interface MembershipRow {
  app_user_id: string;
  auth_user_id: string;
  organization_role: string | null;
  firm_role: string | null;
  firm_id: string;
}

@Injectable()
export class TenantAccessService {
  constructor(private readonly databaseService: DatabaseService) {}

  async assertOrganizationAccess(
    actor: AuthenticatedActor,
    organizationId: string
  ): Promise<RequestActorContext> {
    const result = await this.databaseService.query<MembershipRow>(
      `
        select
          u.id as app_user_id,
          u.auth_user_id::text,
          om.role as organization_role,
          fm.role as firm_role,
          o.firm_id::text as firm_id
        from public.organizations o
        join public.users u
          on u.auth_user_id = $1::uuid
         and u.status = 'active'
        left join public.organization_members om
          on om.organization_id = o.id
         and om.user_id = u.id
         and om.status = 'active'
        left join public.firm_members fm
          on fm.firm_id = o.firm_id
         and fm.user_id = u.id
         and fm.status = 'active'
        where o.id = $2::uuid
          and o.status = 'active'
          and (
            om.id is not null
            or fm.role in ('firm_owner', 'firm_admin', 'firm_manager')
          )
        limit 1
      `,
      [actor.authUserId, organizationId]
    );

    const membership = result.rows[0];

    if (membership === undefined) {
      throw new ForbiddenException('Actor is not allowed to access the requested organization.');
    }

    return {
      appUserId: membership.app_user_id,
      authUserId: membership.auth_user_id,
      organizationRole: membership.organization_role,
      firmRole: membership.firm_role,
      firmId: membership.firm_id
    };
  }
}

