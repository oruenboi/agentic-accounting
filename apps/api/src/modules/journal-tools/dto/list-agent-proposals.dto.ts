import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class ListAgentProposalsInputDto {
  @IsUUID()
  organization_id!: string;

  @IsOptional()
  @IsIn(['draft', 'proposed', 'needs_review', 'approved', 'rejected', 'posted', 'superseded', 'cancelled'])
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number;
}
