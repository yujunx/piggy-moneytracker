import type { TxType } from '../types';

export interface TxLike {
  type: TxType;
  amount_sen: number;
  datetime: string;
  account_id?: number;
  to_account_id?: number | null;
}

export interface Totals {
  income: number;
  expense: number;
  net: number;
}

/** Income/expense totals. Transfers move money between your own accounts, so they're excluded. */
export function totals(txs: TxLike[]): Totals {
  let income = 0;
  let expense = 0;
  for (const t of txs) {
    if (t.type === 'income') income += t.amount_sen;
    else if (t.type === 'expense') expense += t.amount_sen;
  }
  return { income, expense, net: income - expense };
}

export interface DayGroup<T extends TxLike> extends Totals {
  day: string; // YYYY-MM-DD
  items: T[];
}

/** Groups records by day, newest day first; items newest first. */
export function groupByDay<T extends TxLike>(txs: T[]): DayGroup<T>[] {
  const map = new Map<string, T[]>();
  for (const t of txs) {
    const day = t.datetime.slice(0, 10);
    const list = map.get(day);
    if (list) list.push(t);
    else map.set(day, [t]);
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([day, items]) => {
      const sorted = [...items].sort((a, b) => (a.datetime < b.datetime ? 1 : a.datetime > b.datetime ? -1 : 0));
      return { day, items: sorted, ...totals(sorted) };
    });
}

/** Mirrors the SQL balance query in db/queries.ts. */
export function computeBalance(accountId: number, initialSen: number, txs: TxLike[]): number {
  let bal = initialSen;
  for (const t of txs) {
    if (t.account_id === accountId) bal += t.type === 'income' ? t.amount_sen : -t.amount_sen;
    if (t.type === 'transfer' && t.to_account_id === accountId) bal += t.amount_sen;
  }
  return bal;
}
