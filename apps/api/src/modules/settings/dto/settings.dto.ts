import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export const organizationMemberRoles = ['org_admin', 'reviewer', 'accountant', 'bookkeeper', 'client_viewer'] as const;
export const organizationMemberStatuses = ['active', 'inactive', 'invited'] as const;

function trimString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class OrganizationSettingsQueryDto {
  @IsUUID()
  organization_id!: string;
}

export class UpdateOrganizationSettingsDto {
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
  legal_name?: string | null;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  base_currency?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  fiscal_year_start_month?: number;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  country_code?: string | null;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  timezone?: string | null;
}

export class UpdateOrganizationMemberDto {
  @IsUUID()
  organization_id!: string;

  @IsOptional()
  @IsIn(organizationMemberRoles)
  role?: string;

  @IsOptional()
  @IsIn(organizationMemberStatuses)
  status?: string;

  @IsOptional()
  @IsBoolean()
  is_external_client?: boolean;
}
