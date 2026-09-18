/**
 * Turns OCR'd text from a receipt / e-wallet / bank screenshot into a draft record.
 * Pure functions only (no React Native imports) so everything here is unit-testable.
 */
import type { CategoryType, TxType } from '../types';
import { daysInMonth, pad } from '../utils/date';
import { ACCOUNT_HINTS, EXPENSE_RULES, INCOME_RULES } from './rules';

export interface OcrLine {
  text: string;
  top?: number;
  left?: number;
  height?: number;
}

export type Confidence = 'high' | 'low' | 'none';

export interface CategoryRef {
  id: number;
  name: string;
  type: CategoryType;
}

export interface AccountRef {
  id: number;
  name: string;
}

export interface LearnedRule {
  keyword: string;
  category_id: number;
}

export interface ParseContext {
  categories: CategoryRef[];
  accounts: AccountRef[];
  learnedRules: LearnedRule[];
  now?: Date;
}

export interface ParseResult {
  amountSen: number | null;
  amountConfidence: Confidence;
  /** Other plausible amounts, best first (excluding amountSen). */
  amountCandidates: number[];
  type: TxType;
  typeConfidence: Confidence;
  datetime: string | null; // 'YYYY-MM-DD HH:mm'
  dateConfidence: Confidence;
  merchant: string | null;
  accountHint: string | null;
  accountId: number | null;
  categoryId: number | null;
  categoryConfidence: Confidence;
  text: string;
}

// ---------------------------------------------------------------- amounts

const MONEY_SOURCE = '([+-])?\\s*(RM|MYR)?\\s*([+-])?\\s*(\\d{1,3}(?:,\\d{3})+|\\d+)\\.(\\d{2})';

export interface MoneyToken {
  sen: number;
  hasCurrency: boolean;
  sign: '+' | '-' | null;
}

export function findMoney(text: string): MoneyToken[] {
  const out: MoneyToken[] = [];
  for (const m of text.matchAll(new RegExp(MONEY_SOURCE, 'gi'))) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    const before = text[start - 1];
    const after = text.slice(end, end + 2);
    // Reject pieces of dates/versions like 18.09.2026, and percentages.
    if (before !== undefined && /[\d.]/.test(before)) continue;
    if (/^(\d|\.\d|\s*%)/.test(after)) continue;
    const sen = parseInt(m[4].replace(/,/g, ''), 10) * 100 + parseInt(m[5], 10);
    if (sen <= 0) continue;
    const sign = (m[1] || m[3] || null) as MoneyToken['sign'];
    out.push({ sen, hasCurrency: !!m[2], sign });
  }
  return out;
}

const TOTAL_RE = /\b(grand\s*total|total\s*amount|amount\s*paid|total\s*paid|you\s*paid|net\s*total|total|amount|amaun|jumlah|payment\s*amount|transfer\s*amount|paid)\b/i;
const NOT_TOTAL_RE = /\b(sub\s*-?\s*total|tax|sst|gst|service\s*(charge|tax)|rounding|round(ing)?\s*adj\w*|change|tender(ed)?|cash|balance|baki|discount|disc|voucher|points?|saving|saved|before|limit|available|qty|unit\s*price)\b/i;

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function sameRow(a: OcrLine, b: OcrLine): boolean {
  if (a.top == null || b.top == null || !a.height || !b.height) return false;
  return Math.abs(a.top - b.top) < 0.5 * Math.max(a.height, b.height);
}

interface ScoredAmount extends MoneyToken {
  score: number;
}

function scoreAmounts(lines: OcrLine[]): ScoredAmount[] {
  const medH = median(lines.map((l) => l.height ?? 0).filter((h) => h > 0));
  const scored: ScoredAmount[] = [];
  lines.forEach((line, i) => {
    const tokens = findMoney(line.text);
    if (!tokens.length) return;
    const ctx = [line.text];
    lines.forEach((other, j) => {
      if (j !== i && sameRow(line, other)) ctx.push(other.text);
    });
    // A bare value ("RM 250.00") takes its label from the line above.
    const hasOwnLabel = letterCount(line.text.replace(/\b(RM|MYR)\b/gi, '')) >= 2;
    const prev = lines[i - 1];
    if (!hasOwnLabel && prev && !findMoney(prev.text).length) ctx.push(prev.text);
    const context = ctx.join(' | ');
    for (const t of tokens) {
      let score = 0;
      if (t.hasCurrency) score += 3;
      if (t.sign) score += 1;
      if (TOTAL_RE.test(context)) score += 5;
      if (NOT_TOTAL_RE.test(context)) score -= 6;
      if (medH > 0 && (line.height ?? 0) >= medH * 1.4) score += 3;
      scored.push({ ...t, score });
    }
  });
  // Best score first; ties → larger value (on receipts the total is the biggest figure).
  return scored.sort((a, b) => b.score - a.score || b.sen - a.sen);
}

// ---------------------------------------------------------------- type

const INCOME_PATTERNS: [RegExp, number][] = [
  [/\b(you\s*received|received\s*from|money\s*received|payment\s*received|transfer\s*received|incoming\s*transfer)\b/i, 3],
  [/\breceived?\b/i, 1],
  [/\bcredited\b/i, 2],
  [/\brefund(ed)?\b/i, 2],
  [/\bcash\s*back\b/i, 2],
  [/\b(money\s*in|incoming|deposit)\b/i, 2],
  [/\b(salary|gaji)\b/i, 2],
  [/\btransfer(red)?\s*from\b/i, 2],
];

const EXPENSE_PATTERNS: [RegExp, number][] = [
  [/\b(payment\s*successful|paid\s*to|you\s*paid|pay\s*to|transfer(red)?\s*to|money\s*sent|debited)\b/i, 3],
  [/\b(paid|payment|purchase|spent|sent)\b/i, 1],
  [/\bduitnow\s*qr\b/i, 2],
  [/\b(receipt|invoice|total|subtotal|cashier)\b/i, 1],
];

const TRANSFER_PATTERNS: [RegExp, number][] = [
  [/\b(top\s*-?\s*up|reload)\s*(successful|from|to|amount)?\b/i, 3],
  [/\bown\s*account\b/i, 3],
  [/\b(atm\s*)?withdrawal\b/i, 2],
];

function detectType(text: string, amountSign: '+' | '-' | null): { type: TxType; confidence: Confidence } {
  const score = (patterns: [RegExp, number][]) => patterns.reduce((s, [re, w]) => s + (re.test(text) ? w : 0), 0);
  const scores: Record<TxType, number> = {
    income: score(INCOME_PATTERNS) + (amountSign === '+' ? 3 : 0),
    expense: score(EXPENSE_PATTERNS) + (amountSign === '-' ? 3 : 0),
    transfer: score(TRANSFER_PATTERNS),
  };
  const ranked = (Object.keys(scores) as TxType[]).sort((a, b) => scores[b] - scores[a]);
  const [best, second] = ranked;
  if (scores[best] === 0) return { type: 'expense', confidence: 'none' };
  // Ties go to expense, the common case.
  if (scores[best] === scores[second] && (best === 'expense' || second === 'expense')) {
    return { type: 'expense', confidence: 'low' };
  }
  return { type: best, confidence: scores[best] - scores[second] >= 2 ? 'high' : 'low' };
}

// ---------------------------------------------------------------- date

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, januari: 1, feb: 2, february: 2, februari: 2, mar: 3, march: 3, mac: 3,
  apr: 4, april: 4, may: 5, mei: 5, jun: 6, june: 6, jul: 7, july: 7, julai: 7,
  aug: 8, august: 8, ogos: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, okt: 10, oktober: 10,
  nov: 11, november: 11, dec: 12, december: 12, dis: 12, disember: 12,
};

const monthFromName = (s: string): number | null => MONTHS[s.toLowerCase().replace(/\.$/, '')] ?? null;

interface DateHit {
  y: number | null;
  m: number;
  d: number;
}

function findDate(line: string): DateHit | null {
  let m: RegExpExecArray | null;
  if ((m = /\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/.exec(line))) return { y: +m[1], m: +m[2], d: +m[3] };
  if ((m = /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})\b/.exec(line))) {
    const y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
    return { y, m: +m[2], d: +m[1] }; // Malaysia uses day/month/year
  }
  if ((m = /\b(\d{1,2})(?:st|nd|rd|th)?[\s-]+([A-Za-z]{3,9})\.?,?[\s-]+(\d{4})\b/.exec(line))) {
    const mon = monthFromName(m[2]);
    if (mon) return { y: +m[3], m: mon, d: +m[1] };
  }
  if ((m = /\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/.exec(line))) {
    const mon = monthFromName(m[1]);
    if (mon) return { y: +m[3], m: mon, d: +m[2] };
  }
  if ((m = /\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\b/.exec(line))) {
    const mon = monthFromName(m[2]);
    if (mon) return { y: null, m: mon, d: +m[1] };
  }
  if ((m = /\b([A-Za-z]{3,9})\s+(\d{1,2})\b(?!:)/.exec(line))) {
    const mon = monthFromName(m[1]);
    if (mon) return { y: null, m: mon, d: +m[2] };
  }
  return null;
}

const TIME_RE = /\b(\d{1,2}):(\d{2})(?::\d{2})?(?:\s*([AaPp])\.?\s*[Mm]\.?)?/;

function findTime(line: string): { h: number; min: number } | null {
  const m = TIME_RE.exec(line);
  if (!m) return null;
  let h = +m[1];
  const min = +m[2];
  const ampm = m[3]?.toLowerCase();
  if (min > 59) return null;
  if (ampm) {
    if (h < 1 || h > 12) return null;
    if (ampm === 'p' && h !== 12) h += 12;
    if (ampm === 'a' && h === 12) h = 0;
  } else if (h > 23) return null;
  return { h, min };
}

function extractDateTime(lines: string[], now: Date): { datetime: string | null; confidence: Confidence } {
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2);
  for (let i = 0; i < lines.length; i++) {
    const hit = findDate(lines[i]);
    if (!hit) continue;
    let y = hit.y ?? now.getFullYear();
    if (hit.m < 1 || hit.m > 12 || hit.d < 1 || y < 2000 || hit.d > daysInMonth(y, hit.m - 1)) continue;
    let date = new Date(y, hit.m - 1, hit.d);
    if (date >= tomorrow) {
      if (hit.y != null) continue; // a future date is probably an expiry, not the transaction
      y -= 1;
      date = new Date(y, hit.m - 1, hit.d);
    }
    // Look for the time on the same line, then nearby lines (not the status-bar clock on line 0).
    const nearby = [i, i + 1, i + 2, i - 1].filter((j) => j >= 0 && j < lines.length && (j > 0 || j === i));
    let time: { h: number; min: number } | null = null;
    for (const j of nearby) {
      time = findTime(lines[j]);
      if (time) break;
    }
    const isToday = date.toDateString() === now.toDateString();
    const h = time?.h ?? (isToday ? now.getHours() : 12);
    const min = time?.min ?? (isToday ? now.getMinutes() : 0);
    return {
      datetime: `${y}-${pad(hit.m)}-${pad(hit.d)} ${pad(h)}:${pad(min)}`,
      confidence: hit.y != null ? 'high' : 'low',
    };
  }
  return { datetime: null, confidence: 'none' };
}

// ---------------------------------------------------------------- merchant

const LABEL_RE = /^(paid\s*to|pay\s*to|payment\s*to|merchant(?:\s*name)?|recipient(?:\s*name)?|transfer(?:red)?\s*to|to|payee|beneficiary(?:\s*name)?|received\s*from|from|sender(?:\s*name)?|store|outlet|shop\s*name)\b\s*[:\-]?\s*(.*)$/i;

const NOISE_RE = /^(transaction\s*details?|details?|receipt|e-?receipt|payment\s*(successful|details|receipt)|transfer\s*(successful|details)|successful(ly)?|success|completed|done|share|back|close|status.*|ref(erence)?\b.*|transaction\s*(id|no|number|type).*|date.*|time.*|amount.*|total.*|wallet.*|approved|paid|pending|order\b.*|invoice.*|tax\s*invoice|cash\s*sale|official\s*receipt|thank\s*you.*|welcome.*|payment\s*method.*|duitnow.*|qr\s*pay.*)$/i;

function letterCount(s: string): number {
  return (s.match(/[A-Za-z]/g) ?? []).length;
}

function cleanMerchant(s: string): string {
  return s.replace(/\s+/g, ' ').replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9)'’.]+$/g, '').trim().slice(0, 40);
}

function isMerchantLike(s: string): boolean {
  const t = s.trim();
  if (t.length < 2 || t.length > 60) return false;
  if (letterCount(t) < 2 || letterCount(t) / t.length < 0.4) return false;
  if (findMoney(t).length || findDate(t) || findTime(t)) return false;
  if (LABEL_RE.test(t) || NOISE_RE.test(t)) return false;
  if (/@|www\.|https?:/i.test(t)) return false;
  return true;
}

function extractMerchant(lines: string[]): string | null {
  for (let i = 0; i < lines.length; i++) {
    const m = LABEL_RE.exec(lines[i].trim());
    if (!m) continue;
    const rest = m[2]?.trim() ?? '';
    if (rest && isMerchantLike(rest)) return cleanMerchant(rest);
    const next = lines[i + 1];
    if (!rest && next && isMerchantLike(next)) return cleanMerchant(next);
  }
  // Fallback: first prominent-looking line near the top (store name on receipts).
  const limit = Math.min(lines.length, 12);
  for (let i = 0; i < limit; i++) {
    const l = lines[i];
    if (!isMerchantLike(l)) continue;
    if (ACCOUNT_HINTS.some((h) => h.re.test(l) && l.length < 30)) continue;
    return cleanMerchant(l);
  }
  return null;
}

// ---------------------------------------------------------------- category & account

export function normalizeKeyword(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9&' ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Keyword saved when the user corrects a scan's category: the merchant's first 3 words. */
export function merchantKeyword(merchant: string): string {
  return normalizeKeyword(merchant).split(' ').slice(0, 3).join(' ');
}

function guessCategory(
  type: TxType,
  merchant: string | null,
  text: string,
  ctx: ParseContext,
): { categoryId: number | null; confidence: Confidence } {
  if (type === 'transfer') return { categoryId: null, confidence: 'none' };
  const catType: CategoryType = type;
  const cats = ctx.categories.filter((c) => c.type === catType);
  const byId = new Map(cats.map((c) => [c.id, c]));
  const byName = (name: string) => cats.find((c) => c.name.toLowerCase() === name.toLowerCase());

  const normMerchant = merchant ? normalizeKeyword(merchant) : '';
  const normText = normalizeKeyword(text);

  // 1. Rules learned from the user's own corrections (longest keyword wins).
  const learned = [...ctx.learnedRules]
    .filter((r) => r.keyword.length >= 3 && byId.has(r.category_id))
    .sort((a, b) => b.keyword.length - a.keyword.length);
  for (const r of learned) {
    if (normMerchant.includes(r.keyword)) return { categoryId: r.category_id, confidence: 'high' };
  }
  for (const r of learned) {
    if (normText.includes(r.keyword)) return { categoryId: r.category_id, confidence: 'low' };
  }

  // 2. Built-in keyword rules — merchant first (confident), then anywhere in the text.
  const rules = catType === 'income' ? INCOME_RULES : EXPENSE_RULES;
  for (const [source, confidence] of [
    [merchant ?? '', 'high'],
    [text, 'low'],
  ] as const) {
    if (!source) continue;
    for (const rule of rules) {
      const cat = byName(rule.category);
      if (cat && rule.re.test(source)) return { categoryId: cat.id, confidence };
    }
  }

  // 3. Fall back to "Other".
  return { categoryId: byName('Other')?.id ?? null, confidence: 'none' };
}

function guessAccount(text: string, accounts: AccountRef[]): { hint: string | null; accountId: number | null } {
  const hint = ACCOUNT_HINTS.find((h) => h.re.test(text));
  if (!hint) return { hint: null, accountId: null };
  const acc = accounts.find((a) => hint.keys.some((k) => a.name.toLowerCase().includes(k)));
  return { hint: hint.label, accountId: acc?.id ?? null };
}

// ---------------------------------------------------------------- main

export function parseReceipt(input: OcrLine[] | string, ctx: ParseContext): ParseResult {
  const now = ctx.now ?? new Date();
  const lines: OcrLine[] = (typeof input === 'string' ? input.split(/\r?\n/).map((text) => ({ text })) : input)
    .map((l) => ({ ...l, text: l.text.trim() }))
    .filter((l) => l.text.length > 0);
  const texts = lines.map((l) => l.text);
  const text = texts.join('\n');

  const amounts = scoreAmounts(lines);
  const best = amounts[0];
  const amountCandidates = [...new Set(amounts.map((a) => a.sen))].filter((s) => s !== best?.sen).slice(0, 4);

  const { type, confidence: typeConfidence } = detectType(text, best?.sign ?? null);
  const { datetime, confidence: dateConfidence } = extractDateTime(texts, now);
  const merchant = extractMerchant(texts);
  const { categoryId, confidence: categoryConfidence } = guessCategory(type, merchant, text, ctx);
  const { hint: accountHint, accountId } = guessAccount(text, ctx.accounts);

  return {
    amountSen: best?.sen ?? null,
    amountConfidence: !best ? 'none' : best.score >= 5 ? 'high' : 'low',
    amountCandidates,
    type,
    typeConfidence,
    datetime,
    dateConfidence,
    merchant,
    accountHint,
    accountId,
    categoryId,
    categoryConfidence,
    text,
  };
}
