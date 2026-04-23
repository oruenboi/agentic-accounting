import { IsUUID } from 'class-validator';

export class GetJournalEntryInputDto {
  @IsUUID()
  organization_id!: string;

  @IsUUID()
  journal_entry_id!: string;
}
