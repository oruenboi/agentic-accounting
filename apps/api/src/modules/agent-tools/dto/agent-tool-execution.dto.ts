import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested
} from 'class-validator';

export class AgentToolExecutionRequestDto {
  @IsString()
  @IsNotEmpty()
  tool!: string;

  @IsObject()
  input!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  request_id?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  idempotency_key?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  correlation_id?: string;
}

export class AgentToolBatchExecutionRequestDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AgentToolExecutionRequestDto)
  items!: AgentToolExecutionRequestDto[];
}
