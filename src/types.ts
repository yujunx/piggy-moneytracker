export type TxType = 'income' | 'expense' | 'transfer';
export type CategoryType = 'income' | 'expense';
export type AccountGroup = 'cash' | 'bank' | 'ewallet' | 'card' | 'savings' | 'other';

export const ACCOUNT_GROUPS: { key: AccountGroup; label: string }[] = [
  { key: 'cash', label: 'Cash' },
  { key: 'bank', label: 'Bank Accounts' },
  { key: 'ewallet', label: 'E-Wallets' },
  { key: 'card', label: 'Cards' },
  { key: 'savings', label: 'Savings' },
  { key: 'other', label: 'Others' },
];

export interface Account {
  id: number;
  name: string;
  grp: AccountGroup;
  initial_sen: number;
  color: string | null;
  archived: number;
  sort: number;
}

export interface AccountWithBalance extends Account {
  balance_sen: number;
}

export interface Category {
  id: number;
  name: string;
  type: CategoryType;
  icon: string;
  sort: number;
  archived: number;
}

export interface Transaction {
  id: number;
  type: TxType;
  amount_sen: number;
  account_id: number;
  to_account_id: number | null;
  category_id: number | null;
  datetime: string;
  /** Short title shown in lists (e.g. merchant). */
  note: string;
  /** Free-form context the user adds. */
  memo: string;
  image_uri: string | null;
  source: 'manual' | 'scan';
  created_at: string;
}

export type NewTransaction = Omit<Transaction, 'id' | 'created_at'>;

export interface TxRow extends Transaction {
  category_name: string | null;
  category_icon: string | null;
  account_name: string;
  to_account_name: string | null;
}

export interface Budget {
  id: number;
  category_id: number | null;
  amount_sen: number;
}

export interface MerchantRule {
  keyword: string;
  category_id: number;
}
