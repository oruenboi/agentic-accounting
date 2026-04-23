import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested
} from 'class-validator';

export class ValidateJournalEntryLineDto {
  @IsUUID()
  account_id!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  debit!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  credit!: number;
}

export class ValidateJournalEntryInputDto {
  @IsUUID()
  organization_id!: string;

  @IsOptional()
  @IsUUID()
  accounting_period_id?: string;

  @IsDateString()
  entry_date!: string;

  @IsString()
  @IsNotEmpty()
  source_type!: string;

  @IsOptional()
  @IsString()
  memo?: string;

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => ValidateJournalEntryLineDto)
  lines!: ValidateJournalEntryLineDto[];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
