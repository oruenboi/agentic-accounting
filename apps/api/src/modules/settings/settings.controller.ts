import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { CurrentActor } from '../auth/current-actor.decorator';
import type { AuthenticatedActor, AuthenticatedRequest } from '../auth/authenticated-request.interface';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { buildApiResponse } from '../shared/api-response';
import { OrganizationSettingsQueryDto, UpdateOrganizationMemberDto, UpdateOrganizationSettingsDto } from './dto/settings.dto';
import { SettingsService } from './settings.service';

@Controller('settings')
@UseGuards(SupabaseAuthGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('organization')
  async getOrganizationSettings(
    @Query() query: OrganizationSettingsQueryDto,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: AuthenticatedRequest
  ) {
    const result = await this.settingsService.getOrganizationSettings(query, actor);
    return buildApiResponse(request, result);
  }

  @Patch('organization')
  async updateOrganizationSettings(
    @Body() body: UpdateOrganizationSettingsDto,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: AuthenticatedRequest
  ) {
    const result = await this.settingsService.updateOrganizationSettings(body, actor);
    return buildApiResponse(request, result);
  }

  @Get('members')
  async listOrganizationMembers(
    @Query() query: OrganizationSettingsQueryDto,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: AuthenticatedRequest
  ) {
    const result = await this.settingsService.listOrganizationMembers(query, actor);
    return buildApiResponse(request, result);
  }

  @Patch('members/:membershipId')
  async updateOrganizationMember(
    @Param('membershipId') membershipId: string,
    @Body() body: UpdateOrganizationMemberDto,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: AuthenticatedRequest
  ) {
    const result = await this.settingsService.updateOrganizationMember(membershipId, body, actor);
    return buildApiResponse(request, result);
  }
}
