import type { SQLiteDatabase } from 'expo-sqlite';

export const DB_NAME = 'piggy.db';

const SCHEMA_V1 = `
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  grp TEXT NOT NULL DEFAULT 'cash',
  initial_sen INTEGER NOT NULL DEFAULT 0,
  color TEXT,
  archived INTEGER NOT NULL DEFAULT 0,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  icon TEXT NOT NULL DEFAULT '📦',
  sort INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  amount_sen INTEGER NOT NULL CHECK (amount_sen > 0),
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  to_account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  datetime TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  memo TEXT NOT NULL DEFAULT '',
  image_uri TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tx_datetime ON transactions(datetime);
CREATE INDEX IF NOT EXISTS idx_tx_account ON transactions(account_id);

CREATE TABLE IF NOT EXISTS budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER UNIQUE REFERENCES categories(id) ON DELETE CASCADE,
  amount_sen INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS merchant_rules (
  keyword TEXT PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE
);
`;

export const DEFAULT_EXPENSE_CATEGORIES: [string, string][] = [
  ['Food', '🍜'],
  ['Groceries', '🛒'],
  ['Transport', '🚗'],
  ['Petrol', '⛽'],
  ['Shopping', '🛍️'],
  ['Bills & Utilities', '💡'],
  ['Subscriptions', '📺'],
  ['Entertainment', '🎬'],
  ['Health', '💊'],
  ['Education', '📚'],
  ['Rent', '🏠'],
  ['Gift', '🎁'],
  ['Other', '📦'],
];

export const DEFAULT_INCOME_CATEGORIES: [string, string][] = [
  ['Salary', '💼'],
  ['Allowance', '💵'],
  ['Bonus', '🎉'],
  ['Refund', '↩️'],
  ['Other', '💰'],
];

async function seed(db: SQLiteDatabase) {
  const accounts: [string, string][] = [
    ['Cash', 'cash'],
    ['Bank Account', 'bank'],
    ['TNG eWallet', 'ewallet'],
  ];
  for (const [i, [name, grp]] of accounts.entries()) {
    await db.runAsync('INSERT INTO accounts (name, grp, sort) VALUES (?, ?, ?)', name, grp, i);
  }
  for (const [i, [name, icon]] of DEFAULT_EXPENSE_CATEGORIES.entries()) {
    await db.runAsync("INSERT INTO categories (name, type, icon, sort) VALUES (?, 'expense', ?, ?)", name, icon, i);
  }
  for (const [i, [name, icon]] of DEFAULT_INCOME_CATEGORIES.entries()) {
    await db.runAsync("INSERT INTO categories (name, type, icon, sort) VALUES (?, 'income', ?, ?)", name, icon, i);
  }
}

/** Runs on app start via <SQLiteProvider onInit>. Bump DB_VERSION and add a step for schema changes. */
export async function migrate(db: SQLiteDatabase) {
  const DB_VERSION = 1;
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  if (current >= DB_VERSION) return;
  await db.withTransactionAsync(async () => {
    if (current < 1) {
      await db.execAsync(SCHEMA_V1);
      await seed(db);
    }
  });
  await db.execAsync(`PRAGMA user_version = ${DB_VERSION}`);
}
