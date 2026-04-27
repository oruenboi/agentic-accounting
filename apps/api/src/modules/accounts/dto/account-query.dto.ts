import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

const accountTypes = ['asset', 'liability', 'equity', 'revenue', 'expense'] as const;
const accountStatuses = ['active', 'inactive'] as const;

function transformBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === '') {
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

export class ListAccountsQueryDto {
  @IsUUID()
  organization_id!: string;

  @IsOptional()
  @IsIn(accountTypes)
  type?: string;

  @IsOptional()
  @IsIn(accountStatuses)
  status?: string;

  @IsOptional()
  @Transform(({ value }) => transformBoolean(value))
  @IsBoolean()
  postable_only?: boolean;

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === '' ? 100 : Number(value)))
  @IsInt()
  @Min(1)
  @Max(500)
  limit = 100;
}
