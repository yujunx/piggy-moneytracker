/** All money is stored as integer sen (1 RM = 100 sen) to avoid float errors. */

export function formatRM(sen: number, opts: { sign?: boolean; symbol?: boolean } = {}): string {
  const { sign = false, symbol = true } = opts;
  const rounded = Math.round(sen);
  const abs = Math.abs(rounded);
  const ringgit = Math.floor(abs / 100);
  const cents = abs % 100;
  const body = ringgit.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + cents.toString().padStart(2, '0');
  const prefix = rounded < 0 ? '-' : sign && rounded > 0 ? '+' : '';
  return prefix + (symbol ? 'RM ' : '') + body;
}

/** Parses user input like "1,234.5" or "RM 12.50" into sen. Returns null when invalid. */
export function parseMoneyToSen(input: string): number | null {
  const cleaned = input.replace(/[^0-9.,-]/g, '').replace(/,/g, '');
  if (!cleaned || !/^-?\d*(\.\d{0,2})?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/** Sen → plain editable string, e.g. 1250 → "12.50". */
export function senToInput(sen: number): string {
  return formatRM(sen, { symbol: false }).replace(/,/g, '');
}
