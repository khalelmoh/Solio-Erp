export const LIMIT = 1_000_000_000_000;
export function money(value, { zero = false, signed = false } = {}) {
  if (typeof value !== 'string' || !/^-?\d{1,10}(\.\d{1,2})?$/.test(value)) throw new Error('Amount must be a decimal string with at most two decimal places');
  const negative = value.startsWith('-');
  const [whole, fraction = ''] = value.replace('-', '').split('.');
  const cents = Number(BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))) * (negative ? -1 : 1);
  if (Math.abs(cents) > LIMIT || (!signed && cents < 0) || (!zero && cents === 0)) throw new Error('Amount is outside permitted bounds');
  return cents;
}
export function decimal(cents) {
  if (!Number.isSafeInteger(cents)) throw new Error('Unsafe monetary total');
  const n = BigInt(cents); const a = n < 0 ? -n : n;
  return `${n < 0 ? '-' : ''}${a / 100n}.${String(a % 100n).padStart(2, '0')}`;
}
export function split(total, weights) {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!sum) throw new Error('Cannot allocate without weights');
  const values = weights.map(w => Number(BigInt(total) * BigInt(w) / BigInt(sum)));
  let rest = total - values.reduce((a, b) => a + b, 0);
  for (let i = 0; rest > 0; i++, rest--) values[i % values.length]++;
  return values;
}
