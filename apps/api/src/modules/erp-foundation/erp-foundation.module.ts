import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ErpFoundationController } from './erp-foundation.controller';
import { ErpFoundationService } from './erp-foundation.service';

@Module({
  imports: [AuthModule],
  controllers: [ErpFoundationController],
  providers: [ErpFoundationService],
  exports: [ErpFoundationService]
})
export class ErpFoundationModule {}
