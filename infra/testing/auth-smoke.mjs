const apiBaseUrl = process.env.API_BASE_URL ?? 'http://127.0.0.1:3000';
const token = process.env.TOKEN ?? process.env.BEARER_TOKEN ?? process.env.SUPABASE_ACCESS_TOKEN;
const organizationId = process.env.ORG_ID ?? process.env.ORGANIZATION_ID;
const asOfDate = process.env.SMOKE_AS_OF_DATE ?? new Date().toISOString().slice(0, 10);
const fromDate = process.env.SMOKE_FROM_DATE ?? asOfDate.slice(0, 8).concat('01');
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? 15000);

function fail(message) {
  console.error(`auth-smoke failed: ${message}`);
  process.exit(1);
}

if (!token) {
  fail('set TOKEN, BEARER_TOKEN, or SUPABASE_ACCESS_TOKEN to a valid API bearer token');
}

if (!organizationId) {
  fail('set ORG_ID or ORGANIZATION_ID to the organization UUID to smoke test');
}

function endpoint(path, params = {}) {
  const url = new URL(path, apiBaseUrl.replace(/\/$/, '').concat('/'));
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });
  return url;
}

async function getJson(name, url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`
      },
      signal: controller.signal
    });
    const text = await response.text();
    let body = null;

    if (text.trim() !== '') {
      try {
        body = JSON.parse(text);
      } catch {
        fail(`${name} returned non-JSON response with HTTP ${response.status}`);
      }
    }

    if (!response.ok) {
      fail(`${name} returned HTTP ${response.status}: ${body?.message ?? body?.error ?? 'request failed'}`);
    }

    if (options.expectEnvelope !== false && body?.ok !== true) {
      fail(`${name} did not return an ok API envelope`);
    }

    console.log(`ok ${name} HTTP ${response.status}`);
    return body;
  } catch (error) {
    if (error?.name === 'AbortError') {
      fail(`${name} timed out after ${timeoutMs}ms`);
    }
    fail(`${name} request failed: ${error?.message ?? String(error)}`);
  } finally {
    clearTimeout(timeout);
  }
}

const orgParams = { organization_id: organizationId };

const checks = [
  ['health', endpoint('/api/v1/health')],
  ['accounts', endpoint('/api/v1/accounts', { ...orgParams, limit: 5 })],
  ['close overview', endpoint('/api/v1/close/overview', { ...orgParams, as_of_date: asOfDate, limit: 5 })],
  ['schedule definitions', endpoint('/api/v1/schedules/definitions', { ...orgParams, limit: 5 })],
  ['schedule runs', endpoint('/api/v1/schedules/runs', { ...orgParams, as_of_date: asOfDate, limit: 5 })],
  ['trial balance', endpoint('/api/v1/reports/trial-balance', { ...orgParams, as_of_date: asOfDate, include_zero_balances: false })],
  ['balance sheet', endpoint('/api/v1/reports/balance-sheet', { ...orgParams, as_of_date: asOfDate, include_zero_balances: false })],
  [
    'profit and loss',
    endpoint('/api/v1/reports/profit-and-loss', {
      ...orgParams,
      from_date: fromDate,
      to_date: asOfDate,
      include_zero_balances: false
    })
  ],
  ['general ledger', endpoint('/api/v1/reports/general-ledger', { ...orgParams, from_date: fromDate, to_date: asOfDate })]
];

console.log(`auth-smoke target: ${apiBaseUrl.replace(/\/$/, '')}`);
console.log(`auth-smoke organization: ${organizationId}`);
console.log(`auth-smoke date range: ${fromDate} to ${asOfDate}`);

for (const [name, url] of checks) {
  await getJson(name, url);
}

console.log('auth-smoke passed');
