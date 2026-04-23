export function formatDateTime(value: string | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return 'Unknown';
  }

  return new Intl.DateTimeFormat('en-SG', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

export function formatCurrency(value: number | string | null | undefined) {
  const numeric = typeof value === 'string' ? Number(value) : value;

  if (numeric === null || numeric === undefined || Number.isNaN(numeric)) {
    return '—';
  }

  return new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency: 'SGD',
    maximumFractionDigits: 2
  }).format(numeric);
}

export function formatCount(value: number | undefined) {
  return new Intl.NumberFormat('en-SG').format(value ?? 0);
}
