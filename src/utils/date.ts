export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const pad = (n: number) => String(n).padStart(2, '0');

/** Records store local time as 'YYYY-MM-DD HH:mm' so SQL can group by substr(). */
export function toDbDateTime(d: Date): string {
  return `${dayKey(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromDbDateTime(s: string): Date {
  const [datePart, timePart = '00:00'] = s.split(' ');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm] = timePart.split(':').map(Number);
  return new Date(y, m - 1, d, hh || 0, mm || 0);
}

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate();
}

export function formatDateTime(s: string): string {
  const d = fromDbDateTime(s);
  return `${WEEKDAYS_SHORT[d.getDay()]}, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}  ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export type PeriodKind = 'week' | 'month' | 'year';

export interface Range {
  start: string; // inclusive, 'YYYY-MM-DD 00:00'
  end: string; // exclusive
  days: number;
}

const startOf = (d: Date) => `${dayKey(d)} 00:00`;

export function periodRange(kind: PeriodKind, anchor: Date): Range {
  let s: Date;
  let e: Date;
  if (kind === 'year') {
    s = new Date(anchor.getFullYear(), 0, 1);
    e = new Date(anchor.getFullYear() + 1, 0, 1);
  } else if (kind === 'month') {
    s = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    e = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1);
  } else {
    const offset = (anchor.getDay() + 6) % 7; // weeks start on Monday
    s = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - offset);
    e = new Date(s.getFullYear(), s.getMonth(), s.getDate() + 7);
  }
  const days = Math.round((e.getTime() - s.getTime()) / 86400000);
  return { start: startOf(s), end: startOf(e), days };
}

export function shiftPeriod(kind: PeriodKind, anchor: Date, delta: number): Date {
  if (kind === 'year') return new Date(anchor.getFullYear() + delta, anchor.getMonth(), 1);
  if (kind === 'month') return new Date(anchor.getFullYear(), anchor.getMonth() + delta, 1);
  return new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + 7 * delta);
}

export function periodLabel(kind: PeriodKind, anchor: Date): string {
  if (kind === 'year') return String(anchor.getFullYear());
  if (kind === 'month') return `${MONTHS_SHORT[anchor.getMonth()]} ${anchor.getFullYear()}`;
  const s = fromDbDateTime(periodRange('week', anchor).start);
  const e = new Date(s.getFullYear(), s.getMonth(), s.getDate() + 6);
  return `${s.getDate()} ${MONTHS_SHORT[s.getMonth()]} – ${e.getDate()} ${MONTHS_SHORT[e.getMonth()]}`;
}

/** Days of the range elapsed so far (for "average per day"); full length for past periods. */
export function elapsedDays(range: Range, now = new Date()): number {
  const s = fromDbDateTime(range.start).getTime();
  const e = fromDbDateTime(range.end).getTime();
  const t = now.getTime();
  if (t >= e) return range.days;
  if (t < s) return 0;
  return Math.floor((t - s) / 86400000) + 1;
}
