import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { accountStatuses, accountTypes } from './account-query.dto';

function trimString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class CreateAccountDto {
  @IsUUID()
  organization_id!: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  code!: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsIn(accountTypes)
  type!: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  subtype?: string;

  @IsOptional()
  @IsUUID()
  parent_account_id?: string;

  @IsOptional()
  @IsIn(accountStatuses)
  status?: string;

  @IsOptional()
  @IsBoolean()
  is_postable?: boolean;
}

export class UpdateAccountDto {
  @IsUUID()
  organization_id!: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  subtype?: string | null;

  @IsOptional()
  @IsUUID()
  parent_account_id?: string | null;

  @IsOptional()
  @IsIn(accountStatuses)
  status?: string;

  @IsOptional()
  @IsBoolean()
  is_postable?: boolean;
}

export class UpdateAccountStatusDto {
  @IsUUID()
  organization_id!: string;

  @IsIn(accountStatuses)
  status!: string;
}
