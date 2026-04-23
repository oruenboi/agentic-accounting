import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AuthenticatedActor } from './authenticated-request.interface';

@Injectable()
export class SupabaseAuthService {
  private readonly client: SupabaseClient;

  constructor(private readonly configService: ConfigService) {
    const supabaseUrl = this.configService.getOrThrow<string>('supabaseUrl');
    const supabaseAnonKey = this.configService.getOrThrow<string>('supabaseAnonKey');

    this.client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }

  async verifyAccessToken(accessToken: string): Promise<AuthenticatedActor> {
    const { data, error } = await this.client.auth.getUser(accessToken);

    if (error !== null || data.user === null) {
      throw new UnauthorizedException('Invalid Supabase access token.');
    }

    return {
      actorType: 'user',
      authUserId: data.user.id,
      email: data.user.email ?? null,
      clientId: null,
      agentName: null,
      agentRunId: null,
      delegatedAuthUserId: null
    };
  }
}
