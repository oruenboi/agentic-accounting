import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class EscalateApprovalRequestInputDto {
  @IsUUID()
  organization_id!: string;

  @IsUUID()
  approval_request_id!: string;

  @IsString()
  @MaxLength(1000)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comments?: string;
}
