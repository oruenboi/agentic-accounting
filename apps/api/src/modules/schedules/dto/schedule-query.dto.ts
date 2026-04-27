import { Transform } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

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

export class GenerateScheduleRunDto extends BaseScheduleQueryDto {
  @IsOptional()
  @IsUUID()
  schedule_definition_id?: string;

  @IsOptional()
  @IsIn(scheduleTypes)
  schedule_type?: string;

  @IsDateString()
  as_of_date!: string;
}

export class ListScheduleDefinitionsQueryDto extends BaseScheduleQueryDto {
  @IsOptional()
  @IsIn(scheduleTypes)
  schedule_type?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  is_active?: string;

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === '' ? 50 : Number(value)))
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;
}

export class CreateScheduleDefinitionDto extends BaseScheduleQueryDto {
  @IsIn(scheduleTypes)
  schedule_type!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  description?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  gl_account_ids!: string[];

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  group_by?: string;
}
