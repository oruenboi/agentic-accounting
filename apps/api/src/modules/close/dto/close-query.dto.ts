import { Transform } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class CloseOverviewQueryDto {
  @IsUUID()
  organization_id!: string;

  @IsOptional()
  @IsDateString()
  as_of_date?: string;

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === '' ? 10 : Number(value)))
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 10;
}

export class ClosePeriodActionDto {
  @IsUUID()
  organization_id!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
