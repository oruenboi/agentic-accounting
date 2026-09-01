import { Transform } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min
} from 'class-validator';

export const erpModuleNames = [
  'foundation',
  'receivables',
  'payables',
  'cash',
  'crm',
  'projects',
  'time',
  'procurement',
  'inventory',
  'fixed_assets',
  'hr',
  'payroll',
  'tax',
  'close'
] as const;

export const partyTypes = ['individual', 'company', 'government', 'internal'] as const;
export const partyRoles = ['customer', 'vendor', 'employee', 'client', 'prospect', 'contact'] as const;
export const recordStatuses = ['active', 'inactive'] as const;

function trimString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class OrganizationQueryDto {
  @IsUUID()
  organization_id!: string;
}

export class ConfigureModuleDto extends OrganizationQueryDto {
  @IsIn(['enabled', 'disabled'])
  status!: string;

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}

export class ListPartiesQueryDto extends OrganizationQueryDto {
  @IsOptional()
  @IsIn(partyTypes)
  party_type?: string;

  @IsOptional()
  @IsIn(partyRoles)
  role?: string;

  @IsOptional()
  @IsIn(recordStatuses)
  status?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === '' ? 100 : Number(value)))
  @IsInt()
  @Min(1)
  @Max(500)
  limit = 100;
}

export class CreatePartyDto extends OrganizationQueryDto {
  @IsIn(partyTypes)
  party_type!: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(240)
  display_name!: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(240)
  legal_name?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(120)
  tax_identifier?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(120)
  registration_number?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsEmail()
  email?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(80)
  phone?: string;

  @IsOptional()
  @IsObject()
  billing_address?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  shipping_address?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsIn(partyRoles, { each: true })
  roles!: string[];
}

export class AddPartyRoleDto extends OrganizationQueryDto {
  @IsIn(partyRoles)
  role!: string;

  @IsOptional()
  @IsObject()
  role_metadata?: Record<string, unknown>;
}
