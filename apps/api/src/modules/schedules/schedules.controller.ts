import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { CurrentActor } from '../auth/current-actor.decorator';
import type { AuthenticatedActor, AuthenticatedRequest } from '../auth/authenticated-request.interface';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { buildApiResponse } from '../shared/api-response';
import { GenerateScheduleRunDto, GetScheduleRunQueryDto, ListScheduleRunsQueryDto } from './dto/schedule-query.dto';
import { SchedulesService } from './schedules.service';

@Controller('schedules')
@UseGuards(SupabaseAuthGuard)
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Get('runs')
  async listRuns(
    @Query() query: ListScheduleRunsQueryDto,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: AuthenticatedRequest
  ) {
    const result = await this.schedulesService.listScheduleRuns(query, actor);
    return buildApiResponse(request, result);
  }

  @Get('runs/:runId')
  async getRun(
    @Param('runId') runId: string,
    @Query() query: GetScheduleRunQueryDto,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: AuthenticatedRequest
  ) {
    const result = await this.schedulesService.getScheduleRun(runId, query, actor);
    return buildApiResponse(request, result);
  }

  @Post('runs')
  async generateRun(
    @Body() body: GenerateScheduleRunDto,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: AuthenticatedRequest
  ) {
    const result = await this.schedulesService.generateScheduleRun(body, actor);
    return buildApiResponse(request, result);
  }
}
