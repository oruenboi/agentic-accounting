import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { JournalValidationService } from './journal-validation.service';

@Module({
  imports: [AuthModule],
  providers: [JournalValidationService],
  exports: [JournalValidationService]
})
export class JournalToolsModule {}
