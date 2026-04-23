import { IsUUID } from 'class-validator';

export class GetJournalEntryDraftInputDto {
  @IsUUID()
  organization_id!: string;

  @IsUUID()
  draft_id!: string;
}
