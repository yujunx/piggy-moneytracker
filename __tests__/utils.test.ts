import { formatRM, parseMoneyToSen, senToInput } from '../src/utils/money';
import { computeBalance, groupByDay, totals } from '../src/utils/summary';
import { elapsedDays, periodLabel, periodRange, shiftPeriod } from '../src/utils/date';

describe('money', () => {
  it('formats sen as RM', () => {
    expect(formatRM(123456)).toBe('RM 1,234.56');
    expect(formatRM(-500)).toBe('-RM 5.00');
    expect(formatRM(5, { sign: true })).toBe('+RM 0.05');
    expect(formatRM(0)).toBe('RM 0.00');
    expect(senToInput(123456)).toBe('1234.56');
  });

  it('parses user input', () => {
    expect(parseMoneyToSen('12.5')).toBe(1250);
    expect(parseMoneyToSen('RM 1,234.56')).toBe(123456);
    expect(parseMoneyToSen('0.1')).toBe(10);
    expect(parseMoneyToSen('abc')).toBeNull();
    expect(parseMoneyToSen('1.234')).toBeNull();
    expect(parseMoneyToSen('.')).toBeNull();
  });
});

const txs = [
  { type: 'expense' as const, amount_sen: 1000, datetime: '2026-09-18 12:00', account_id: 1, to_account_id: null },
  { type: 'income' as const, amount_sen: 5000, datetime: '2026-09-17 09:00', account_id: 2, to_account_id: null },
  { type: 'transfer' as const, amount_sen: 2000, datetime: '2026-09-18 08:00', account_id: 2, to_account_id: 1 },
  { type: 'expense' as const, amount_sen: 300, datetime: '2026-09-18 19:00', account_id: 2, to_account_id: null },
];

describe('summary', () => {
  it('totals exclude transfers', () => {
    expect(totals(txs)).toEqual({ income: 5000, expense: 1300, net: 3700 });
  });

  it('groups by day, newest first', () => {
    const g = groupByDay(txs);
    expect(g.map((d) => d.day)).toEqual(['2026-09-18', '2026-09-17']);
    expect(g[0].items.map((t) => t.datetime)).toEqual(['2026-09-18 19:00', '2026-09-18 12:00', '2026-09-18 08:00']);
    expect(g[0].expense).toBe(1300);
  });

  it('computes balances including transfers', () => {
    expect(computeBalance(1, 10000, txs)).toBe(10000 - 1000 + 2000);
    expect(computeBalance(2, 0, txs)).toBe(5000 - 2000 - 300);
  });
});

describe('periods', () => {
  const d = new Date(2026, 8, 18); // Fri 18 Sep 2026
  it('month range', () => {
    expect(periodRange('month', d)).toEqual({ start: '2026-09-01 00:00', end: '2026-10-01 00:00', days: 30 });
  });
  it('week range starts Monday', () => {
    expect(periodRange('week', d)).toEqual({ start: '2026-09-14 00:00', end: '2026-09-21 00:00', days: 7 });
    expect(periodLabel('week', d)).toBe('14 Sep – 20 Sep');
  });
  it('year range and shifting', () => {
    expect(periodRange('year', d).days).toBe(365);
    expect(shiftPeriod('month', new Date(2026, 0, 31), -1).getMonth()).toBe(11);
  });
  it('elapsed days', () => {
    expect(elapsedDays(periodRange('month', d), new Date(2026, 8, 18, 10))).toBe(18);
    expect(elapsedDays(periodRange('month', d), new Date(2027, 0, 1))).toBe(30);
  });
});
