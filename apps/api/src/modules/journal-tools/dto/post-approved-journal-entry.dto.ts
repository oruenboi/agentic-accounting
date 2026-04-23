import { IsUUID } from 'class-validator';

export class PostApprovedJournalEntryInputDto {
  @IsUUID()
  organization_id!: string;

  @IsUUID()
  draft_id!: string;
}
