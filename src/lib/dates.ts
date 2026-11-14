/** Date helpers that work on plain YYYY-MM-DD strings, avoiding timezone drift. */

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: string, n: number): string {
  const d = parseISODate(s);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 86_400_000);
}

export function dateRange(start: string, end: string): string[] {
  const n = daysBetween(start, end);
  return n < 0 ? [] : Array.from({ length: n + 1 }, (_, i) => addDays(start, i));
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function formatDay(s: string): string {
  return parseISODate(s).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/**
 * Format a 24h time string ("HH:mm") as a 12h time, e.g. "7:30 PM".
 * Returns the original string unchanged if it cannot be parsed.
 */
export function fmt12h(time: string): string {
  const parts = time.split(':');
  const h24 = parseInt(parts[0] ?? '');
  const m = parseInt(parts[1] ?? '');
  if (isNaN(h24) || isNaN(m)) return time;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h = h24 % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${period}`;
}

/**
 * Shorten a geocoding label to "City, Country" (or "City, State" for 2-part labels).
 * "Paris, Île-de-France, France" → "Paris, France"
 * "New York, New York, United States" → "New York, United States"
 */
export function shortLocation(label: string): string {
  const parts = label.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 2) return parts.join(', ');
  return `${parts[0]}, ${parts[1]}`; // City, State/Region
}
