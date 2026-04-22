import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { CurrentActor } from '../auth/current-actor.decorator';
import type { AuthenticatedActor, AuthenticatedRequest } from '../auth/authenticated-request.interface';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { buildApiResponse } from '../shared/api-response';
import {
  BalanceSheetQueryDto,
  GeneralLedgerQueryDto,
  ProfitAndLossQueryDto,
  TrialBalanceQueryDto
} from './dto/report-query.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(SupabaseAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('trial-balance')
  async getTrialBalance(
    @Query() query: TrialBalanceQueryDto,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: AuthenticatedRequest
  ) {
    const result = await this.reportsService.getTrialBalance(query, actor);
    return buildApiResponse(request, result);
  }

  @Get('balance-sheet')
  async getBalanceSheet(
    @Query() query: BalanceSheetQueryDto,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: AuthenticatedRequest
  ) {
    const result = await this.reportsService.getBalanceSheet(query, actor);
    return buildApiResponse(request, result);
  }

  @Get('profit-and-loss')
  async getProfitAndLoss(
    @Query() query: ProfitAndLossQueryDto,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: AuthenticatedRequest
  ) {
    const result = await this.reportsService.getProfitAndLoss(query, actor);
    return buildApiResponse(request, result);
  }

  @Get('general-ledger')
  async getGeneralLedger(
    @Query() query: GeneralLedgerQueryDto,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: AuthenticatedRequest
  ) {
    const result = await this.reportsService.getGeneralLedger(query, actor);
    return buildApiResponse(request, result);
  }
}

