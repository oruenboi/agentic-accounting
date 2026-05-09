import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { CurrentActor } from '../auth/current-actor.decorator';
import type { AuthenticatedActor, AuthenticatedRequest } from '../auth/authenticated-request.interface';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { buildApiResponse } from '../shared/api-response';
import { AccountsService } from './accounts.service';
import { CreateAccountDto, UpdateAccountDto, UpdateAccountStatusDto } from './dto/account-maintenance.dto';
import { ListAccountsQueryDto } from './dto/account-query.dto';

@Controller('accounts')
@UseGuards(SupabaseAuthGuard)
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  async listAccounts(
    @Query() query: ListAccountsQueryDto,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: AuthenticatedRequest
  ) {
    const result = await this.accountsService.listAccounts(query, actor);
    return buildApiResponse(request, result);
  }

  @Post()
  async createAccount(
    @Body() body: CreateAccountDto,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: AuthenticatedRequest
  ) {
    const result = await this.accountsService.createAccount(body, actor);
    return buildApiResponse(request, result);
  }

  @Patch(':accountId')
  async updateAccount(
    @Param('accountId') accountId: string,
    @Body() body: UpdateAccountDto,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: AuthenticatedRequest
  ) {
    const result = await this.accountsService.updateAccount(accountId, body, actor);
    return buildApiResponse(request, result);
  }

  @Patch(':accountId/status')
  async updateAccountStatus(
    @Param('accountId') accountId: string,
    @Body() body: UpdateAccountStatusDto,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: AuthenticatedRequest
  ) {
    const result = await this.accountsService.updateAccountStatus(accountId, body, actor);
    return buildApiResponse(request, result);
  }
}
