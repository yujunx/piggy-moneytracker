/**
 * Realistic fake data for stress testing and screenshots.
 * Demo records are saved with source = 'demo' so they can be removed without touching real ones.
 */
import type { SQLiteDatabase } from 'expo-sqlite';
import type { AccountGroup, NewTransaction } from '../types';
import { toDbDateTime } from '../utils/date';

interface Ref {
  id: number;
  name: string;
}

export interface DemoContext {
  accounts: (Ref & { grp: AccountGroup })[];
  categories: (Ref & { type: 'income' | 'expense' })[];
}

/** Small deterministic PRNG (mulberry32) so the same seed always gives the same data. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// [category, merchants, min RM, max RM, account group]
type Spend = [string, string[], number, number, AccountGroup];

const DAILY: Spend[] = [
  ['Food', ['Nasi Lemak Antarabangsa', 'Mamak Bistro', 'ZUS Coffee', 'Tealive', 'McDonald\'s', 'KFC', 'Restoran Nasi Kandar Pelita', 'Kopitiam', 'Sushi King', 'Marry Brown'], 6, 28, 'ewallet'],
  ['Transport', ['Grab ride', 'LRT', 'MRT', 'Toll', 'Parking'], 3, 25, 'ewallet'],
];

const WEEKLY: Spend[] = [
  ['Groceries', ['99 Speedmart', 'Lotus\'s', 'Jaya Grocer', 'Mydin', 'AEON Big'], 25, 140, 'bank'],
  ['Petrol', ['Petronas', 'Shell', 'Petron'], 40, 85, 'bank'],
];

const OCCASIONAL: Spend[] = [
  ['Shopping', ['Shopee', 'Lazada', 'Uniqlo', 'Mr DIY', 'Watsons'], 15, 250, 'bank'],
  ['Entertainment', ['GSC', 'TGV Cinemas', 'Steam', 'Karaoke'], 15, 90, 'ewallet'],
  ['Health', ['Caring Pharmacy', 'Klinik Mediviron', 'Guardian'], 12, 120, 'cash'],
  ['Gift', ['Birthday gift', 'Wedding angpau'], 30, 200, 'cash'],
];

// [category, merchant, RM, day of month, account group]
const MONTHLY: [string, string, number, number, AccountGroup][] = [
  ['Rent', 'Room rental', 750, 1, 'bank'],
  ['Bills & Utilities', 'TNB', 85, 5, 'bank'],
  ['Bills & Utilities', 'Unifi', 129, 8, 'bank'],
  ['Bills & Utilities', 'Maxis postpaid', 68, 10, 'bank'],
  ['Subscriptions', 'Netflix', 55, 12, 'bank'],
  ['Subscriptions', 'Spotify', 15.9, 15, 'bank'],
];

/** Builds `months` of records ending at `now`. Pure, so it can be unit-tested. */
export function buildDemoRecords(ctx: DemoContext, months: number, now = new Date(), seed = 42): NewTransaction[] {
  const rand = rng(seed);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  const between = (min: number, max: number) => Math.round((min + rand() * (max - min)) * 100); // sen, 2dp
  const acc = (grp: AccountGroup) => (ctx.accounts.find((a) => a.grp === grp) ?? ctx.accounts[0]).id;
  const cat = (name: string, type: 'income' | 'expense') =>
    ctx.categories.find((c) => c.type === type && c.name === name)?.id ?? null;

  const start = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
  const bank = acc('bank');
  const wallet = acc('ewallet');
  const cash = acc('cash');

  const out: NewTransaction[] = [];
  const balance = new Map<number, number>();
  const bump = (id: number, sen: number) => balance.set(id, (balance.get(id) ?? 0) + sen);

  const add = (d: Date, t: Omit<NewTransaction, 'datetime' | 'memo' | 'image_uri' | 'source'>) => {
    if (d > now) return;
    out.push({ ...t, datetime: toDbDateTime(d), memo: '', image_uri: null, source: 'demo' });
    if (t.type === 'income') bump(t.account_id, t.amount_sen);
    else bump(t.account_id, -t.amount_sen);
    if (t.type === 'transfer' && t.to_account_id != null) bump(t.to_account_id, t.amount_sen);
  };

  /** Like a real person: reload the e-wallet / withdraw cash from the bank before it runs dry. */
  const topUp = (d: Date, id: number, needSen: number) => {
    if (id === bank || (id !== wallet && id !== cash)) return;
    const have = balance.get(id) ?? 0;
    if (have >= needSen) return;
    const step = id === wallet ? 10000 : 5000; // reload in RM 100s, withdraw in RM 50s
    const amount = Math.max(id === wallet ? 20000 : 10000, Math.ceil((needSen - have) / step) * step);
    const when = new Date(d.getTime() - (5 + Math.floor(rand() * 40)) * 60000);
    add(when, { type: 'transfer', amount_sen: amount, account_id: bank, to_account_id: id, category_id: null, note: id === wallet ? 'TNG reload' : 'ATM withdrawal' });
  };

  const at = (day: Date, hMin: number, hMax: number) =>
    new Date(day.getFullYear(), day.getMonth(), day.getDate(), hMin + Math.floor(rand() * (hMax - hMin)), Math.floor(rand() * 60));
  const expense = (d: Date, sen: number, id: number, category: string, note: string) => {
    if (d > now) return;
    topUp(d, id, sen);
    add(d, { type: 'expense', amount_sen: sen, account_id: id, to_account_id: null, category_id: cat(category, 'expense'), note });
  };
  const spend = (day: Date, [category, merchants, min, max, grp]: Spend, hMin = 8, hMax = 22) =>
    expense(at(day, hMin, hMax), between(min, max), acc(grp), category, pick(merchants));

  // Savings carried in, so the bank can cover the first month's bills before payday.
  add(new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 1), {
    type: 'income', amount_sen: 300000, account_id: bank, to_account_id: null, category_id: cat('Other', 'income'), note: 'Opening balance',
  });

  for (let d = new Date(start); d <= now; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    const dom = d.getDate();
    const dow = d.getDay();

    // Income
    if (dom === 25) {
      add(at(d, 9, 10), { type: 'income', amount_sen: between(3800, 3800), account_id: bank, to_account_id: null, category_id: cat('Salary', 'income'), note: 'ACME Sdn Bhd' });
    }
    if (dom === 1 && rand() < 0.5) {
      add(at(d, 10, 20), { type: 'income', amount_sen: between(100, 300), account_id: bank, to_account_id: null, category_id: cat('Allowance', 'income'), note: 'Family' });
    }
    if (rand() < 0.02) {
      add(at(d, 10, 20), { type: 'income', amount_sen: between(2, 60), account_id: wallet, to_account_id: null, category_id: cat('Refund', 'income'), note: 'Shopee refund' });
    }

    // Fixed monthly bills
    for (const [category, merchant, rm, day, grp] of MONTHLY) {
      if (dom === day) expense(at(d, 9, 21), Math.round(rm * 100), acc(grp), category, merchant);
    }

    // Everyday spending: 1–3 meals, transport on weekdays
    const meals = 1 + Math.floor(rand() * 3);
    for (let i = 0; i < meals; i++) spend(d, DAILY[0], 7 + i * 5, 11 + i * 5);
    if (dow >= 1 && dow <= 5 && rand() < 0.7) spend(d, DAILY[1], 7, 19);

    // Weekly: groceries on weekends, petrol mid-week
    if (dow === 6 && rand() < 0.85) spend(d, WEEKLY[0], 10, 20);
    if (dow === 3 && rand() < 0.8) spend(d, WEEKLY[1], 7, 21);

    // Occasional
    if (rand() < 0.12) spend(d, pick(OCCASIONAL), 11, 23);
  }
  return out;
}

export async function insertDemoData(db: SQLiteDatabase, months: number): Promise<{ count: number; ms: number }> {
  const accounts = await db.getAllAsync<Ref & { grp: AccountGroup }>('SELECT id, name, grp FROM accounts WHERE archived = 0 ORDER BY sort, id');
  const categories = await db.getAllAsync<Ref & { type: 'income' | 'expense' }>('SELECT id, name, type FROM categories');
  if (!accounts.length) throw new Error('Add at least one account first.');
  const records = buildDemoRecords({ accounts, categories }, months);

  const t0 = Date.now();
  await db.withExclusiveTransactionAsync(async (txn) => {
    const stmt = await txn.prepareAsync(
      `INSERT INTO transactions (type, amount_sen, account_id, to_account_id, category_id, datetime, note, memo, image_uri, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    try {
      for (const r of records) {
        await stmt.executeAsync(r.type, r.amount_sen, r.account_id, r.to_account_id, r.category_id, r.datetime, r.note, r.memo, r.image_uri, r.source);
      }
    } finally {
      await stmt.finalizeAsync();
    }
  });
  return { count: records.length, ms: Date.now() - t0 };
}

export async function removeDemoData(db: SQLiteDatabase): Promise<number> {
  const r = await db.runAsync("DELETE FROM transactions WHERE source = 'demo'");
  return r.changes;
}
