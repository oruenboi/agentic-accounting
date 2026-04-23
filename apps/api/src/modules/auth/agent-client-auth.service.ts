import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthenticatedActor } from './authenticated-request.interface';

@Injectable()
export class AgentClientAuthService {
  constructor(private readonly configService: ConfigService) {}

  authenticate(headers: {
    clientId?: string;
    clientSecret?: string;
    delegatedAuthUserId?: string;
    agentRunId?: string;
  }): AuthenticatedActor {
    const configuredClientId = this.configService.get<string>('agentClientId');
    const configuredClientSecret = this.configService.get<string>('agentClientSecret');
    const configuredAgentName = this.configService.get<string>('agentClientName') ?? 'agent-tools-client';

    if (
      configuredClientId === undefined ||
      configuredClientId.trim() === '' ||
      configuredClientSecret === undefined ||
      configuredClientSecret.trim() === ''
    ) {
      throw new UnauthorizedException('Agent client auth is not configured.');
    }

    if (headers.clientId !== configuredClientId || headers.clientSecret !== configuredClientSecret) {
      throw new UnauthorizedException('Invalid agent client credentials.');
    }

    return {
      actorType: 'agent',
      authUserId: headers.delegatedAuthUserId ?? '',
      email: null,
      clientId: configuredClientId,
      agentName: configuredAgentName,
      agentRunId: headers.agentRunId ?? null,
      delegatedAuthUserId: headers.delegatedAuthUserId ?? null
    };
  }
}
