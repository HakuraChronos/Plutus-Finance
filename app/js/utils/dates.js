const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad2 = value => String(value).padStart(2, '0');

export function localDateKey(date = new Date()) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new TypeError('A valid Date is required.');
  }
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function localMonthKey(date = new Date()) {
  return localDateKey(date).slice(0, 7);
}

export function parseLocalDateKey(value) {
  const match = DATE_KEY.exec(String(value));
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

function dateKeyOrdinal(value) {
  const date = parseLocalDateKey(value);
  if (!date) return null;
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;
}

export function calendarDaysBetween(startDateKey, endDateKey) {
  const start = dateKeyOrdinal(startDateKey);
  const end = dateKeyOrdinal(endDateKey);
  return start === null || end === null ? null : end - start;
}

export function monthsRemaining(deadlineDateKey, today = new Date()) {
  const days = calendarDaysBetween(localDateKey(today), deadlineDateKey);
  if (days === null) return null;
  if (days <= 0) return 0;
  return Math.max(1, Math.ceil(days / 30.4375));
}

export function endOfLocalMonth(date = new Date()) {
  return localDateKey(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

export function advanceDateKey(value, frequency = 'monthly') {
  const date = parseLocalDateKey(value);
  if (!date) return null;
  const originalDay = date.getDate();
  const targetYear = frequency === 'yearly' ? date.getFullYear() + 1 : date.getFullYear();
  const targetMonth = frequency === 'yearly' ? date.getMonth() : date.getMonth() + 1;
  const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
  return localDateKey(new Date(targetYear, targetMonth, Math.min(originalDay, lastDay)));
}
