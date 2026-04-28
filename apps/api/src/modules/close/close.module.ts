import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CloseController } from './close.controller';
import { CloseService } from './close.service';

@Module({
  imports: [AuthModule],
  controllers: [CloseController],
  providers: [CloseService]
})
export class CloseModule {}
