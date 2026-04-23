import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class ListApprovalRequestsInputDto {
  @IsUUID()
  organization_id!: string;

  @IsOptional()
  @IsIn(['pending', 'approved', 'rejected', 'cancelled', 'expired'])
  status?: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
