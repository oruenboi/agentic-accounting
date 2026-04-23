import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { JournalDraftService } from './journal-draft.service';
import { JournalValidationService } from './journal-validation.service';

@Module({
  imports: [AuthModule, DatabaseModule],
  providers: [JournalValidationService, JournalDraftService],
  exports: [JournalValidationService, JournalDraftService]
})
export class JournalToolsModule {}
