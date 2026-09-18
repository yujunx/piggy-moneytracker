import type { SQLiteDatabase } from 'expo-sqlite';
import type {
  Account,
  AccountWithBalance,
  Budget,
  Category,
  CategoryType,
  MerchantRule,
  NewTransaction,
  TxRow,
  TxType,
} from '../types';
import type { Range } from '../utils/date';

// ---------------------------------------------------------------- accounts

// Keep in sync with computeBalance() in utils/summary.ts.
const BALANCE_SQL = `
  a.initial_sen
  + COALESCE((SELECT SUM(amount_sen) FROM transactions t WHERE t.account_id = a.id AND t.type = 'income'), 0)
  - COALESCE((SELECT SUM(amount_sen) FROM transactions t WHERE t.account_id = a.id AND t.type IN ('expense', 'transfer')), 0)
  + COALESCE((SELECT SUM(amount_sen) FROM transactions t WHERE t.to_account_id = a.id AND t.type = 'transfer'), 0)`;

export function getAccounts(db: SQLiteDatabase, includeArchived = false) {
  return db.getAllAsync<AccountWithBalance>(
    `SELECT a.*, ${BALANCE_SQL} AS balance_sen FROM accounts a
     ${includeArchived ? '' : 'WHERE a.archived = 0'}
     ORDER BY a.sort, a.id`,
  );
}

export function getAccount(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<AccountWithBalance>(`SELECT a.*, ${BALANCE_SQL} AS balance_sen FROM accounts a WHERE a.id = ?`, id);
}

export async function saveAccount(db: SQLiteDatabase, a: Omit<Account, 'id' | 'sort'>, id?: number): Promise<number> {
  if (id) {
    await db.runAsync(
      'UPDATE accounts SET name = ?, grp = ?, initial_sen = ?, color = ?, archived = ? WHERE id = ?',
      a.name, a.grp, a.initial_sen, a.color, a.archived, id,
    );
    return id;
  }
  const r = await db.runAsync(
    'INSERT INTO accounts (name, grp, initial_sen, color, archived, sort) VALUES (?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort), 0) + 1 FROM accounts))',
    a.name, a.grp, a.initial_sen, a.color, a.archived,
  );
  return r.lastInsertRowId;
}

/** Deletes the account and (via ON DELETE CASCADE) every record that touches it. */
export async function deleteAccount(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM accounts WHERE id = ?', id);
}

export async function countAccountTransactions(db: SQLiteDatabase, id: number) {
  const r = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM transactions WHERE account_id = ? OR to_account_id = ?', id, id,
  );
  return r?.n ?? 0;
}

// ---------------------------------------------------------------- categories

export function getCategories(db: SQLiteDatabase, type?: CategoryType) {
  return type
    ? db.getAllAsync<Category>('SELECT * FROM categories WHERE archived = 0 AND type = ? ORDER BY sort, id', type)
    : db.getAllAsync<Category>('SELECT * FROM categories WHERE archived = 0 ORDER BY type, sort, id');
}

export async function saveCategory(db: SQLiteDatabase, c: { name: string; icon: string; type: CategoryType }, id?: number) {
  if (id) {
    await db.runAsync('UPDATE categories SET name = ?, icon = ? WHERE id = ?', c.name, c.icon, id);
    return id;
  }
  const r = await db.runAsync(
    'INSERT INTO categories (name, type, icon, sort) VALUES (?, ?, ?, (SELECT COALESCE(MAX(sort), 0) + 1 FROM categories WHERE type = ?))',
    c.name, c.type, c.icon, c.type,
  );
  return r.lastInsertRowId;
}

/** Existing records keep their data but lose the category (ON DELETE SET NULL). */
export async function deleteCategory(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM categories WHERE id = ?', id);
}

export async function moveCategory(db: SQLiteDatabase, cats: Category[], index: number, delta: -1 | 1) {
  const j = index + delta;
  if (j < 0 || j >= cats.length) return;
  const order = [...cats];
  [order[index], order[j]] = [order[j], order[index]];
  await db.withTransactionAsync(async () => {
    for (const [i, c] of order.entries()) await db.runAsync('UPDATE categories SET sort = ? WHERE id = ?', i, c.id);
  });
}

// ---------------------------------------------------------------- transactions

const TX_SELECT = `
  SELECT t.*, c.name AS category_name, c.icon AS category_icon,
         a.name AS account_name, ta.name AS to_account_name
  FROM transactions t
  JOIN accounts a ON a.id = t.account_id
  LEFT JOIN accounts ta ON ta.id = t.to_account_id
  LEFT JOIN categories c ON c.id = t.category_id`;

export interface TxFilter {
  accountId?: number;
  categoryId?: number | null;
  type?: TxType;
}

export function getTransactions(db: SQLiteDatabase, range: Range | null, filter: TxFilter = {}) {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (range) {
    where.push('t.datetime >= ? AND t.datetime < ?');
    params.push(range.start, range.end);
  }
  if (filter.accountId != null) {
    where.push('(t.account_id = ? OR t.to_account_id = ?)');
    params.push(filter.accountId, filter.accountId);
  }
  if (filter.categoryId !== undefined) {
    if (filter.categoryId === null) where.push('t.category_id IS NULL');
    else {
      where.push('t.category_id = ?');
      params.push(filter.categoryId);
    }
  }
  if (filter.type) {
    where.push('t.type = ?');
    params.push(filter.type);
  }
  const sql = `${TX_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY t.datetime DESC, t.id DESC`;
  return db.getAllAsync<TxRow>(sql, params);
}

export function getTransaction(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<TxRow>(`${TX_SELECT} WHERE t.id = ?`, id);
}

export async function saveTransaction(db: SQLiteDatabase, tx: NewTransaction, id?: number): Promise<number> {
  const values = [
    tx.type,
    tx.amount_sen,
    tx.account_id,
    tx.type === 'transfer' ? tx.to_account_id : null,
    tx.type === 'transfer' ? null : tx.category_id,
    tx.datetime,
    tx.note,
    tx.memo,
    tx.image_uri,
    tx.source,
  ];
  if (id) {
    await db.runAsync(
      `UPDATE transactions SET type = ?, amount_sen = ?, account_id = ?, to_account_id = ?, category_id = ?,
       datetime = ?, note = ?, memo = ?, image_uri = ?, source = ? WHERE id = ?`,
      ...values, id,
    );
    return id;
  }
  const r = await db.runAsync(
    `INSERT INTO transactions (type, amount_sen, account_id, to_account_id, category_id, datetime, note, memo, image_uri, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ...values,
  );
  return r.lastInsertRowId;
}

export async function deleteTransaction(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM transactions WHERE id = ?', id);
}

// ---------------------------------------------------------------- stats

export interface CategoryTotal {
  category_id: number | null;
  name: string;
  icon: string;
  total_sen: number;
}

export function getCategoryTotals(db: SQLiteDatabase, type: CategoryType, range: Range) {
  return db.getAllAsync<CategoryTotal>(
    `SELECT t.category_id, COALESCE(c.name, 'Uncategorized') AS name, COALESCE(c.icon, '❔') AS icon,
            SUM(t.amount_sen) AS total_sen
     FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.type = ? AND t.datetime >= ? AND t.datetime < ?
     GROUP BY t.category_id ORDER BY total_sen DESC`,
    type, range.start, range.end,
  );
}

export interface PeriodTotal {
  key: string; // 'YYYY-MM' or 'YYYY-MM-DD'
  income: number;
  expense: number;
}

/** Sums per month (keyLength 7) or per day (keyLength 10) in the range. */
export function getPeriodTotals(db: SQLiteDatabase, range: Range, keyLength: 7 | 10) {
  return db.getAllAsync<PeriodTotal>(
    `SELECT substr(datetime, 1, ${keyLength}) AS key,
            SUM(CASE WHEN type = 'income' THEN amount_sen ELSE 0 END) AS income,
            SUM(CASE WHEN type = 'expense' THEN amount_sen ELSE 0 END) AS expense
     FROM transactions WHERE datetime >= ? AND datetime < ?
     GROUP BY key ORDER BY key`,
    range.start, range.end,
  );
}

// ---------------------------------------------------------------- budgets

export function getBudgets(db: SQLiteDatabase) {
  return db.getAllAsync<Budget>('SELECT * FROM budgets');
}

/** amountSen null/0 removes the budget. categoryId null = overall monthly budget. */
export async function setBudget(db: SQLiteDatabase, categoryId: number | null, amountSen: number | null) {
  await db.withTransactionAsync(async () => {
    if (categoryId === null) await db.runAsync('DELETE FROM budgets WHERE category_id IS NULL');
    else await db.runAsync('DELETE FROM budgets WHERE category_id = ?', categoryId);
    if (amountSen && amountSen > 0) {
      await db.runAsync('INSERT INTO budgets (category_id, amount_sen) VALUES (?, ?)', categoryId, amountSen);
    }
  });
}

// ---------------------------------------------------------------- learned scan rules

export function getMerchantRules(db: SQLiteDatabase) {
  return db.getAllAsync<MerchantRule & { category_name: string; category_icon: string }>(
    `SELECT r.*, c.name AS category_name, c.icon AS category_icon
     FROM merchant_rules r JOIN categories c ON c.id = r.category_id ORDER BY r.keyword`,
  );
}

export async function saveMerchantRule(db: SQLiteDatabase, keyword: string, categoryId: number) {
  if (keyword.length < 3) return;
  await db.runAsync(
    'INSERT INTO merchant_rules (keyword, category_id) VALUES (?, ?) ON CONFLICT(keyword) DO UPDATE SET category_id = excluded.category_id',
    keyword, categoryId,
  );
}

export async function deleteMerchantRule(db: SQLiteDatabase, keyword: string) {
  await db.runAsync('DELETE FROM merchant_rules WHERE keyword = ?', keyword);
}

// ---------------------------------------------------------------- backup

export const BACKUP_TABLES = ['accounts', 'categories', 'transactions', 'budgets', 'merchant_rules'] as const;

export interface Backup {
  app: 'piggy';
  version: 1;
  exported_at: string;
  data: Record<(typeof BACKUP_TABLES)[number], Record<string, unknown>[]>;
}

export async function exportAll(db: SQLiteDatabase): Promise<Backup> {
  const data = {} as Backup['data'];
  for (const t of BACKUP_TABLES) data[t] = await db.getAllAsync<Record<string, unknown>>(`SELECT * FROM ${t}`);
  return { app: 'piggy', version: 1, exported_at: new Date().toISOString(), data };
}

export function isBackup(x: unknown): x is Backup {
  const b = x as Backup;
  return !!b && b.app === 'piggy' && b.version === 1 && !!b.data && BACKUP_TABLES.every((t) => Array.isArray(b.data[t]));
}

/** Replaces all data with the backup's contents. */
export async function importAll(db: SQLiteDatabase, backup: Backup) {
  const columns: Record<(typeof BACKUP_TABLES)[number], string[]> = {
    accounts: ['id', 'name', 'grp', 'initial_sen', 'color', 'archived', 'sort'],
    categories: ['id', 'name', 'type', 'icon', 'sort', 'archived'],
    transactions: ['id', 'type', 'amount_sen', 'account_id', 'to_account_id', 'category_id', 'datetime', 'note', 'memo', 'image_uri', 'source', 'created_at'],
    budgets: ['id', 'category_id', 'amount_sen'],
    merchant_rules: ['keyword', 'category_id'],
  };
  await db.withTransactionAsync(async () => {
    for (const t of [...BACKUP_TABLES].reverse()) await db.runAsync(`DELETE FROM ${t}`);
    for (const t of BACKUP_TABLES) {
      const cols = columns[t];
      const sql = `INSERT INTO ${t} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`;
      for (const row of backup.data[t]) {
        await db.runAsync(sql, cols.map((c) => (row[c] ?? null) as string | number | null));
      }
    }
  });
}

export function toCsv(rows: TxRow[]): string {
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ['Date', 'Type', 'Amount (RM)', 'Account', 'To Account', 'Category', 'Note', 'Memo', 'Source'];
  const lines = rows.map((r) =>
    [r.datetime, r.type, (r.amount_sen / 100).toFixed(2), r.account_name, r.to_account_name, r.category_name, r.note, r.memo, r.source]
      .map(esc)
      .join(','),
  );
  return [header.join(','), ...lines].join('\n');
}

