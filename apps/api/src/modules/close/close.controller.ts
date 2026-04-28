import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { CurrentActor } from '../auth/current-actor.decorator';
import type { AuthenticatedActor, AuthenticatedRequest } from '../auth/authenticated-request.interface';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { buildApiResponse } from '../shared/api-response';
import { CloseService } from './close.service';
import { CloseOverviewQueryDto } from './dto/close-query.dto';

@Controller('close')
@UseGuards(SupabaseAuthGuard)
export class CloseController {
  constructor(private readonly closeService: CloseService) {}

  @Get('overview')
  async getOverview(
    @Query() query: CloseOverviewQueryDto,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: AuthenticatedRequest
  ) {
    const result = await this.closeService.getOverview(query, actor);
    return buildApiResponse(request, result);
  }
}
