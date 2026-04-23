import { IsUUID } from 'class-validator';

export class GetJournalEntryReversalChainInputDto {
  @IsUUID()
  organization_id!: string;

  @IsUUID()
  journal_entry_id!: string;
}
