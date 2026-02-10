import { getISOWeek, getISOWeekYear } from 'date-fns';

/**
 * Derive API period string from a date (YYYY-MM-DD) and horizon.
 * Backend expects: month -> "YYYY-MM", year -> "YYYY", week -> "YYYY-Www"
 */
export function getPeriodFromDate(
  fromDate: string,
  horizon: 'week' | 'month' | 'year'
): string {
  if (!fromDate || fromDate.length < 7) {
    const d = new Date();
    if (horizon === 'month') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (horizon === 'year') return String(d.getFullYear());
    const y = getISOWeekYear(d);
    const w = getISOWeek(d);
    return `${y}-W${String(w).padStart(2, '0')}`;
  }
  if (horizon === 'month') return fromDate.slice(0, 7);
  if (horizon === 'year') return fromDate.slice(0, 4);
  const d = new Date(fromDate + 'T12:00:00');
  const y = getISOWeekYear(d);
  const w = getISOWeek(d);
  return `${y}-W${String(w).padStart(2, '0')}`;
}
