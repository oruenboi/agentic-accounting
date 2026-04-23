import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class ListJournalEntriesInputDto {
  @IsUUID()
  organization_id!: string;

  @IsOptional()
  @IsIn(['posted', 'reversed'])
  status?: 'posted' | 'reversed';

  @IsOptional()
  @IsDateString()
  from_date?: string;

  @IsOptional()
  @IsDateString()
  to_date?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
