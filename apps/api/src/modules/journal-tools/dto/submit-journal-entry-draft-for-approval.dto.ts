import { IsDateString, IsIn, IsOptional, IsUUID } from 'class-validator';

export class SubmitJournalEntryDraftForApprovalInputDto {
  @IsUUID()
  organization_id!: string;

  @IsUUID()
  draft_id!: string;

  @IsOptional()
  @IsIn(['low', 'normal', 'high', 'critical'])
  priority?: 'low' | 'normal' | 'high' | 'critical';

  @IsOptional()
  @IsDateString()
  expires_at?: string;
}
