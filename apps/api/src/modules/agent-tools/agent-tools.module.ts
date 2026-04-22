import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HealthModule } from '../health/health.module';
import { ReportsModule } from '../reports/reports.module';
import { AgentToolsController } from './agent-tools.controller';
import { AgentToolsService } from './agent-tools.service';

@Module({
  imports: [AuthModule, HealthModule, ReportsModule],
  controllers: [AgentToolsController],
  providers: [AgentToolsService]
})
export class AgentToolsModule {}
