import { buildDemoRecords, type DemoContext } from '../src/db/demo';
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from '../src/db/client';
import { computeBalance, totals } from '../src/utils/summary';

const ctx: DemoContext = {
  accounts: [
    { id: 1, name: 'Cash', grp: 'cash' },
    { id: 2, name: 'Bank Account', grp: 'bank' },
    { id: 3, name: 'TNG eWallet', grp: 'ewallet' },
  ],
  categories: [
    ...DEFAULT_EXPENSE_CATEGORIES.map(([name], i) => ({ id: 100 + i, name, type: 'expense' as const })),
    ...DEFAULT_INCOME_CATEGORIES.map(([name], i) => ({ id: 200 + i, name, type: 'income' as const })),
  ],
};

const now = new Date(2026, 8, 21, 18, 0);

describe('buildDemoRecords', () => {
  const records = buildDemoRecords(ctx, 36, now);

  it('produces a stress-test sized dataset', () => {
    expect(records.length).toBeGreaterThan(3000);
    expect(records.length).toBeLessThan(8000);
  });

  it('is deterministic for a given seed', () => {
    expect(buildDemoRecords(ctx, 36, now)).toEqual(records);
    expect(buildDemoRecords(ctx, 36, now, 7)).not.toEqual(records);
  });

  it('only creates valid records inside the range', () => {
    const start = '2023-10-01 00:00';
    const nowStr = '2026-09-21 18:00';
    for (const r of records) {
      expect(r.amount_sen).toBeGreaterThan(0);
      expect(Number.isInteger(r.amount_sen)).toBe(true);
      expect(r.datetime >= start && r.datetime <= nowStr).toBe(true);
      expect(r.source).toBe('demo');
      if (r.type === 'transfer') {
        expect(r.to_account_id).not.toBeNull();
        expect(r.to_account_id).not.toBe(r.account_id);
        expect(r.category_id).toBeNull();
      } else {
        expect(r.category_id).not.toBeNull(); // every name used exists in the seeded categories
      }
    }
  });

  it('looks like a plausible budget (earns more than it spends)', () => {
    const t = totals(records);
    expect(t.income).toBeGreaterThan(t.expense);
  });

  it('keeps every account funded: wallet reloads and ATM withdrawals come from the bank', () => {
    for (const a of ctx.accounts) expect(computeBalance(a.id, 0, records)).toBeGreaterThanOrEqual(0);
    const notes = records.filter((r) => r.type === 'transfer').map((r) => r.note);
    expect(notes).toContain('TNG reload');
    expect(notes).toContain('ATM withdrawal');

    // Replayed in time order, no account should dip noticeably below zero either.
    const running = new Map<number, number>();
    let lowest = 0;
    for (const r of [...records].sort((a, b) => (a.datetime < b.datetime ? -1 : a.datetime > b.datetime ? 1 : 0))) {
      const move = (id: number, sen: number) => {
        const v = (running.get(id) ?? 0) + sen;
        running.set(id, v);
        lowest = Math.min(lowest, v);
      };
      move(r.account_id, r.type === 'income' ? r.amount_sen : -r.amount_sen);
      if (r.type === 'transfer' && r.to_account_id != null) move(r.to_account_id, r.amount_sen);
    }
    expect(lowest).toBeGreaterThan(-5000); // allow a few ringgit of same-day ordering slack
  });

  it('falls back to the first account when groups are missing', () => {
    const r = buildDemoRecords({ ...ctx, accounts: [{ id: 9, name: 'Only', grp: 'cash' }] }, 1, now);
    expect(r.every((x) => x.account_id === 9)).toBe(true);
    expect(r.some((x) => x.type === 'transfer')).toBe(false); // no bank → wallet reloads to itself
  });
});
