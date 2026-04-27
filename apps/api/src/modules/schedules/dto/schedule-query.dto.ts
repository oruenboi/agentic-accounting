import { Transform } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

const scheduleTypes = [
  'bank',
  'accounts_receivable',
  'accounts_payable',
  'accruals',
  'prepayments',
  'fixed_assets',
  'tax_payable'
] as const;

const scheduleRunStatuses = ['generated', 'variance_detected', 'reconciled', 'reviewed', 'superseded'] as const;

export class BaseScheduleQueryDto {
  @IsUUID()
  organization_id!: string;
}

export class ListScheduleRunsQueryDto extends BaseScheduleQueryDto {
  @IsOptional()
  @IsIn(scheduleTypes)
  schedule_type?: string;

  @IsOptional()
  @IsIn(scheduleRunStatuses)
  status?: string;

  @IsOptional()
  @IsDateString()
  as_of_date?: string;

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === '' ? 25 : Number(value)))
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 25;
}

export class GetScheduleRunQueryDto extends BaseScheduleQueryDto {}
