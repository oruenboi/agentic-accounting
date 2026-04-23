import { Module } from '@nestjs/common';
import { AgentClientAuthService } from './agent-client-auth.service';
import { AgentToolsAuthGuard } from './agent-tools-auth.guard';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import { SupabaseAuthService } from './supabase-auth.service';
import { TenantAccessService } from './tenant-access.service';

@Module({
  providers: [
    SupabaseAuthService,
    SupabaseAuthGuard,
    AgentClientAuthService,
    AgentToolsAuthGuard,
    TenantAccessService
  ],
  exports: [
    SupabaseAuthService,
    SupabaseAuthGuard,
    AgentClientAuthService,
    AgentToolsAuthGuard,
    TenantAccessService
  ]
})
export class AuthModule {}
