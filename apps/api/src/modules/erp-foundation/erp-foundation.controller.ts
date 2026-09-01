import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { CurrentActor } from '../auth/current-actor.decorator';
import type { AuthenticatedActor, AuthenticatedRequest } from '../auth/authenticated-request.interface';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { buildApiResponse } from '../shared/api-response';
import { AddPartyRoleDto, ConfigureModuleDto, CreatePartyDto, ListPartiesQueryDto, OrganizationQueryDto } from './dto/erp-foundation.dto';
import { ErpFoundationService } from './erp-foundation.service';

@Controller('erp')
@UseGuards(SupabaseAuthGuard)
export class ErpFoundationController {
  constructor(private readonly erpFoundationService: ErpFoundationService) {}

  @Get('modules')
  async listModules(
    @Query() query: OrganizationQueryDto,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: AuthenticatedRequest
  ) {
    return buildApiResponse(request, await this.erpFoundationService.listModules(query, actor));
  }

  @Patch('modules/:moduleName')
  async configureModule(
    @Param('moduleName') moduleName: string,
    @Body() body: ConfigureModuleDto,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: AuthenticatedRequest
  ) {
    return buildApiResponse(
      request,
      await this.erpFoundationService.configureModule(moduleName, body, actor, request.requestId)
    );
  }

  @Get('parties')
  async listParties(
    @Query() query: ListPartiesQueryDto,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: AuthenticatedRequest
  ) {
    return buildApiResponse(request, await this.erpFoundationService.listParties(query, actor));
  }

  @Post('parties')
  async createParty(
    @Body() body: CreatePartyDto,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: AuthenticatedRequest
  ) {
    return buildApiResponse(request, await this.erpFoundationService.createParty(body, actor, request.requestId));
  }

  @Post('parties/:partyId/roles')
  async addPartyRole(
    @Param('partyId') partyId: string,
    @Body() body: AddPartyRoleDto,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: AuthenticatedRequest
  ) {
    return buildApiResponse(
      request,
      await this.erpFoundationService.addPartyRole(partyId, body, actor, request.requestId)
    );
  }
}
