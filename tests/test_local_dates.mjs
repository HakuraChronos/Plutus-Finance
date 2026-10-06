import assert from 'node:assert/strict';
import {
  calendarDaysBetween,
  localDateKey,
  localMonthKey,
  monthsRemaining,
  parseLocalDateKey
} from '../app/js/utils/dates.js';

const originalTimezone = process.env.TZ;

try {
  process.env.TZ = 'Asia/Taipei';
  const taipeiAfterMidnight = new Date('2026-10-06T16:30:00.000Z');
  assert.equal(localDateKey(taipeiAfterMidnight), '2026-10-07');
  assert.equal(localMonthKey(taipeiAfterMidnight), '2026-10');

  process.env.TZ = 'America/Los_Angeles';
  const losAngelesLateEvening = new Date('2026-10-07T06:30:00.000Z');
  assert.equal(localDateKey(losAngelesLateEvening), '2026-10-06');

  process.env.TZ = 'America/New_York';
  assert.equal(calendarDaysBetween('2026-03-07', '2026-03-09'), 2, 'DST must not alter calendar-day differences');
  assert.equal(calendarDaysBetween('2026-12-31', '2027-01-01'), 1);
  assert.equal(monthsRemaining('2026-11-06', new Date(2026, 9, 7, 23, 30)), 1);
  assert.equal(monthsRemaining('2026-10-07', new Date(2026, 9, 7, 0, 1)), 0);

  assert.ok(parseLocalDateKey('2024-02-29'));
  assert.equal(parseLocalDateKey('2025-02-29'), null);
  assert.equal(parseLocalDateKey('not-a-date'), null);
} finally {
  if (originalTimezone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimezone;
}

console.log('Local calendar and timezone boundary calculations: PASS');
