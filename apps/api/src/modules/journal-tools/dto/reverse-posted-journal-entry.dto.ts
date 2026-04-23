import { IsDateString, IsString, IsUUID, MinLength } from 'class-validator';

export class ReversePostedJournalEntryInputDto {
  @IsUUID()
  organization_id!: string;

  @IsUUID()
  journal_entry_id!: string;

  @IsDateString()
  reversal_date!: string;

  @IsString()
  @MinLength(1)
  reason!: string;
}
