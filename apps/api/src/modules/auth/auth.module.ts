import { Module } from '@nestjs/common';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import { SupabaseAuthService } from './supabase-auth.service';
import { TenantAccessService } from './tenant-access.service';

@Module({
  providers: [SupabaseAuthService, SupabaseAuthGuard, TenantAccessService],
  exports: [SupabaseAuthService, SupabaseAuthGuard, TenantAccessService]
})
export class AuthModule {}

