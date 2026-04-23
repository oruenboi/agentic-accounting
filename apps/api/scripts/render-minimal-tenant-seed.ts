import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  buildMinimalTenantSeedSql,
  type MinimalTenantSeedInput
} from '../src/bootstrap/minimal-tenant-seed';

type OptionName =
  | 'auth-user-id'
  | 'user-email'
  | 'user-display-name'
  | 'firm-name'
  | 'firm-slug'
  | 'organization-name'
  | 'organization-legal-name'
  | 'organization-slug'
  | 'base-currency'
  | 'fiscal-year-start-month'
  | 'timezone'
  | 'country-code'
  | 'period-name'
  | 'period-start'
  | 'period-end'
  | 'out';

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printUsage();
  process.exit(0);
}

const input: MinimalTenantSeedInput = {
  authUserId: readOption(args.values, 'auth-user-id', 'BOOTSTRAP_AUTH_USER_ID'),
  userEmail: readOption(args.values, 'user-email', 'BOOTSTRAP_USER_EMAIL'),
  userDisplayName: readOptionalOption(args.values, 'user-display-name', 'BOOTSTRAP_USER_DISPLAY_NAME'),
  firmName: readOptionalOption(args.values, 'firm-name', 'BOOTSTRAP_FIRM_NAME'),
  firmSlug: readOptionalOption(args.values, 'firm-slug', 'BOOTSTRAP_FIRM_SLUG'),
  organizationName: readOptionalOption(args.values, 'organization-name', 'BOOTSTRAP_ORGANIZATION_NAME'),
  organizationLegalName: readOptionalOption(
    args.values,
    'organization-legal-name',
    'BOOTSTRAP_ORGANIZATION_LEGAL_NAME'
  ),
  organizationSlug: readOptionalOption(args.values, 'organization-slug', 'BOOTSTRAP_ORGANIZATION_SLUG'),
  baseCurrency: readOptionalOption(args.values, 'base-currency', 'BOOTSTRAP_BASE_CURRENCY'),
  fiscalYearStartMonth: readOptionalNumberOption(
    args.values,
    'fiscal-year-start-month',
    'BOOTSTRAP_FISCAL_YEAR_START_MONTH'
  ),
  timezone: readOptionalOption(args.values, 'timezone', 'BOOTSTRAP_TIMEZONE'),
  countryCode: readOptionalOption(args.values, 'country-code', 'BOOTSTRAP_COUNTRY_CODE'),
  periodName: readOptionalOption(args.values, 'period-name', 'BOOTSTRAP_PERIOD_NAME'),
  periodStart: readOptionalOption(args.values, 'period-start', 'BOOTSTRAP_PERIOD_START'),
  periodEnd: readOptionalOption(args.values, 'period-end', 'BOOTSTRAP_PERIOD_END')
};

const sql = buildMinimalTenantSeedSql(input);
const outputPath = readOptionalOption(args.values, 'out', 'BOOTSTRAP_SQL_OUT');

if (outputPath !== undefined) {
  const absoluteOutputPath = resolve(process.cwd(), outputPath);
  mkdirSync(dirname(absoluteOutputPath), { recursive: true });
  writeFileSync(absoluteOutputPath, sql, 'utf8');
  process.stdout.write(`${absoluteOutputPath}\n`);
} else {
  process.stdout.write(sql);
}

function parseArgs(argv: string[]) {
  const values = new Map<string, string>();
  let help = false;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--help' || token === '-h') {
      help = true;
      continue;
    }

    if (!token.startsWith('--')) {
      throw new Error(`Unexpected argument "${token}".`);
    }

    const optionName = token.slice(2) as OptionName;
    const optionValue = argv[index + 1];

    if (optionValue === undefined || optionValue.startsWith('--')) {
      throw new Error(`Missing value for --${optionName}.`);
    }

    values.set(optionName, optionValue);
    index += 1;
  }

  return { values, help };
}

function readOption(values: Map<string, string>, key: OptionName, envKey: string) {
  const value = values.get(key) ?? process.env[envKey];

  if (value === undefined || value.trim() === '') {
    throw new Error(`Missing required value for --${key} or ${envKey}.`);
  }

  return value;
}

function readOptionalOption(values: Map<string, string>, key: OptionName, envKey: string) {
  const value = values.get(key) ?? process.env[envKey];

  if (value === undefined || value.trim() === '') {
    return undefined;
  }

  return value;
}

function readOptionalNumberOption(values: Map<string, string>, key: OptionName, envKey: string) {
  const value = readOptionalOption(values, key, envKey);

  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    throw new Error(`Value for --${key} or ${envKey} must be an integer.`);
  }

  return parsed;
}

function printUsage() {
  process.stdout.write(`Render the deterministic minimal tenant bootstrap SQL.

Required:
  --auth-user-id <uuid>   Existing Supabase auth.users UUID to bind to public.users.auth_user_id
  --user-email <email>    Email stored in public.users

Optional:
  --user-display-name <text>
  --firm-name <text>
  --firm-slug <text>
  --organization-name <text>
  --organization-legal-name <text>
  --organization-slug <text>
  --base-currency <code>
  --fiscal-year-start-month <1-12>
  --timezone <iana name>
  --country-code <code>
  --period-name <text>
  --period-start <yyyy-mm-dd>
  --period-end <yyyy-mm-dd>
  --out <path>

Environment fallbacks:
  BOOTSTRAP_AUTH_USER_ID
  BOOTSTRAP_USER_EMAIL
  BOOTSTRAP_USER_DISPLAY_NAME
  BOOTSTRAP_FIRM_NAME
  BOOTSTRAP_FIRM_SLUG
  BOOTSTRAP_ORGANIZATION_NAME
  BOOTSTRAP_ORGANIZATION_LEGAL_NAME
  BOOTSTRAP_ORGANIZATION_SLUG
  BOOTSTRAP_BASE_CURRENCY
  BOOTSTRAP_FISCAL_YEAR_START_MONTH
  BOOTSTRAP_TIMEZONE
  BOOTSTRAP_COUNTRY_CODE
  BOOTSTRAP_PERIOD_NAME
  BOOTSTRAP_PERIOD_START
  BOOTSTRAP_PERIOD_END
  BOOTSTRAP_SQL_OUT
`);
}
