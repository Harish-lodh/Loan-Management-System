export function moneyToString(value: number | string | null | undefined): string {
  const numeric = typeof value === 'string' ? Number(value) : Number(value ?? 0);
  if (!Number.isFinite(numeric)) {
    throw new Error('Invalid money value');
  }
  return (Math.round(numeric * 100) / 100).toFixed(2);
}

export function rateToString(value: number | string | null | undefined): string {
  const numeric = typeof value === 'string' ? Number(value) : Number(value ?? 0);
  if (!Number.isFinite(numeric)) {
    throw new Error('Invalid rate value');
  }
  return (Math.round(numeric * 10_000) / 10_000).toFixed(4);
}

export function toCents(value: number | string | null | undefined): number {
  const numeric = typeof value === 'string' ? Number(value) : Number(value ?? 0);
  if (!Number.isFinite(numeric)) {
    throw new Error('Invalid money value');
  }
  return Math.round(numeric * 100);
}

export function centsToMoney(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function percentageOf(amount: number | string, percentage: number | string): string {
  const amountCents = toCents(amount);
  const basisPoints = Math.round(Number(percentage) * 100);
  return centsToMoney(Math.round((amountCents * basisPoints) / 10_000));
}

export function addMoney(...values: Array<number | string | null | undefined>): string {
  return centsToMoney(values.reduce<number>((sum, value) => sum + toCents(value), 0));
}

export function subtractMoney(value: number | string, ...deductions: Array<number | string | null | undefined>): string {
  return centsToMoney(deductions.reduce<number>((sum, deduction) => sum - toCents(deduction), toCents(value)));
}
