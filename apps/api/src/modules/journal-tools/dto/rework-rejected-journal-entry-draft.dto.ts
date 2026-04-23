import { IsUUID } from 'class-validator';
import { ValidateJournalEntryInputDto } from './validate-journal-entry.dto';

export class ReworkRejectedJournalEntryDraftInputDto extends ValidateJournalEntryInputDto {
  @IsUUID()
  draft_id!: string;
}
