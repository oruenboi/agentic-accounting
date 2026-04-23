import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { AuthenticatedRequest } from './authenticated-request.interface';
import { AgentClientAuthService } from './agent-client-auth.service';
import { SupabaseAuthService } from './supabase-auth.service';

@Injectable()
export class AgentToolsAuthGuard implements CanActivate {
  constructor(
    private readonly supabaseAuthService: SupabaseAuthService,
    private readonly agentClientAuthService: AgentClientAuthService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.header('authorization');

    if (authorization !== undefined && authorization.startsWith('Bearer ')) {
      const accessToken = authorization.slice('Bearer '.length).trim();

      if (accessToken === '') {
        throw new UnauthorizedException('Missing bearer token.');
      }

      request.actor = await this.supabaseAuthService.verifyAccessToken(accessToken);
      return true;
    }

    request.actor = this.agentClientAuthService.authenticate({
      clientId: request.header('x-agent-client-id') ?? undefined,
      clientSecret: request.header('x-agent-client-secret') ?? undefined,
      delegatedAuthUserId: request.header('x-delegated-auth-user-id') ?? undefined,
      agentRunId: request.header('x-agent-run-id') ?? undefined
    });

    return true;
  }
}
