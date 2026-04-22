import { Body, Controller, Get, NotFoundException, Param, Post, Req, UseGuards } from '@nestjs/common';
import { CurrentActor } from '../auth/current-actor.decorator';
import type { AuthenticatedActor, AuthenticatedRequest } from '../auth/authenticated-request.interface';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { AgentToolBatchExecutionRequestDto, AgentToolExecutionRequestDto } from './dto/agent-tool-execution.dto';
import { AgentToolsService } from './agent-tools.service';

@Controller('agent-tools')
@UseGuards(SupabaseAuthGuard)
export class AgentToolsController {
  constructor(private readonly agentToolsService: AgentToolsService) {}

  @Get('schema')
  getSchema(@Req() request: AuthenticatedRequest) {
    return {
      ok: true,
      request_id: request.requestId ?? null,
      timestamp: new Date().toISOString(),
      result: this.agentToolsService.getSchema()
    };
  }

  @Get('tool/:toolName')
  getTool(@Param('toolName') toolName: string, @Req() request: AuthenticatedRequest) {
    const tool = this.agentToolsService.getTool(toolName);

    if (tool === null) {
      throw new NotFoundException('Unknown tool name.');
    }

    return {
      ok: true,
      request_id: request.requestId ?? null,
      timestamp: new Date().toISOString(),
      result: tool
    };
  }

  @Post('execute')
  async execute(
    @Body() body: AgentToolExecutionRequestDto,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: AuthenticatedRequest
  ) {
    return {
      ...(await this.agentToolsService.execute(actor, body, request.requestId)),
      timestamp: new Date().toISOString()
    };
  }

  @Post('execute-batch')
  async executeBatch(
    @Body() body: AgentToolBatchExecutionRequestDto,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: AuthenticatedRequest
  ) {
    return this.agentToolsService.executeBatch(actor, body, request.requestId);
  }
}
