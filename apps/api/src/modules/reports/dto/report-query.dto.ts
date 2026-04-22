import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsOptional, IsUUID } from 'class-validator';

function transformBoolean(value: unknown): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return value === 'true';
  }

  return undefined;
}

export class BaseOrganizationReportQueryDto {
  @IsUUID()
  organization_id!: string;
}

export class TrialBalanceQueryDto extends BaseOrganizationReportQueryDto {
  @IsDateString()
  as_of_date!: string;

  @IsOptional()
  @Transform(({ value }) => transformBoolean(value))
  @IsBoolean()
  include_zero_balances?: boolean;
}

export class BalanceSheetQueryDto extends BaseOrganizationReportQueryDto {
  @IsDateString()
  as_of_date!: string;

  @IsOptional()
  @Transform(({ value }) => transformBoolean(value))
  @IsBoolean()
  include_zero_balances?: boolean;
}

export class ProfitAndLossQueryDto extends BaseOrganizationReportQueryDto {
  @IsDateString()
  from_date!: string;

  @IsDateString()
  to_date!: string;

  @IsOptional()
  @Transform(({ value }) => transformBoolean(value))
  @IsBoolean()
  include_zero_balances?: boolean;
}

export class GeneralLedgerQueryDto extends BaseOrganizationReportQueryDto {
  @IsDateString()
  from_date!: string;

  @IsDateString()
  to_date!: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === '') {
      return undefined;
    }

    if (Array.isArray(value)) {
      return value;
    }

    return String(value)
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry !== '');
  })
  account_ids?: string[];
}

