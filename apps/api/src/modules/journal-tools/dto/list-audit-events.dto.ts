import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class ListAuditEventsInputDto {
  @IsUUID()
  organization_id!: string;

  @IsOptional()
  @IsString()
  entity_type?: string;

  @IsOptional()
  @IsString()
  entity_id?: string;

  @IsOptional()
  @IsString()
  event_name?: string;

  @IsOptional()
  @IsIn(['user', 'agent', 'system'])
  actor_type?: 'user' | 'agent' | 'system';

  @IsOptional()
  @IsString()
  request_id?: string;

  @IsOptional()
  @IsString()
  correlation_id?: string;

  @IsOptional()
  @IsDateString()
  from_timestamp?: string;

  @IsOptional()
  @IsDateString()
  to_timestamp?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
