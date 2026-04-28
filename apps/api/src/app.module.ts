import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { validateEnvironment } from './config/env.validation';
import { AccountsModule } from './modules/accounts/accounts.module';
import { AgentToolsModule } from './modules/agent-tools/agent-tools.module';
import { AuthModule } from './modules/auth/auth.module';
import { CloseModule } from './modules/close/close.module';
import { DatabaseModule } from './modules/database/database.module';
import { HealthModule } from './modules/health/health.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SchedulesModule } from './modules/schedules/schedules.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validate: validateEnvironment
    }),
    DatabaseModule,
    AuthModule,
    HealthModule,
    AccountsModule,
    CloseModule,
    ReportsModule,
    SchedulesModule,
    AgentToolsModule
  ]
})
export class AppModule {}
