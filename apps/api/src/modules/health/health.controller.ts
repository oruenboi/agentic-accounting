import { Controller, Get, Req } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request.interface';
import { buildApiResponse } from '../shared/api-response';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async getHealth(@Req() request: AuthenticatedRequest) {
    const result = await this.healthService.getStatus();
    return buildApiResponse(request, result);
  }
}

