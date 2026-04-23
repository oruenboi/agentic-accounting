import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class ResolveApprovalRequestInputDto {
  @IsUUID()
  organization_id!: string;

  @IsUUID()
  approval_request_id!: string;

  @IsIn(['approved', 'rejected'])
  resolution!: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comments?: string;
}
