/**
 * Local calendar dates.
 *
 * `new Date().toISOString().split('T')[0]` was used across the app to mean "today". It does
 * not: toISOString converts to UTC first, so for a user in IST (+05:30) every moment between
 * midnight and 05:29 reports YESTERDAY, and a Date built as local midnight
 * (`new Date(2026, 8, 10)`) reports the 9th — which is how a calendar grid matches a visit
 * against the wrong cell.
 *
 * Everything here works off the LOCAL calendar, which is the one the user is looking at.
 * Mirrors the web's `src/utils/dates.js` so both platforms agree on what "today" means.
 */

const pad = (n: number) => String(n).padStart(2, '0');

/** `yyyy-mm-dd` for the local calendar day a date falls on. */
export const isoDate = (value: Date | string | number = new Date()): string => {
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Today, as `yyyy-mm-dd` in the device's own timezone. */
export const todayStr = (): string => isoDate();

/** True when an instant falls on the given local `yyyy-mm-dd`. */
export const isSameLocalDay = (value: Date | string | null | undefined, dateStr: string): boolean =>
  !!value && isoDate(value) === dateStr;

/** How many local days past `dateStr` an instant falls. 0 = that day itself. */
export const dayOffset = (dateStr: string, value: Date | string): number => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const base = new Date(y, (m || 1) - 1, d || 1).getTime();
  const at = value instanceof Date ? new Date(value) : new Date(value);
  at.setHours(0, 0, 0, 0);
  return Math.round((at.getTime() - base) / 86_400_000);
};

/** Local `h:mm am/pm`. */
export const timeOnly = (value: Date | string): string => {
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return '—';
  let h = d.getHours();
  const m = pad(d.getMinutes());
  const ap = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return `${h}:${m} ${ap}`;
};

/**
 * A clock time with the day marked when it is not the day being planned. Times alone lie
 * about a route that does not fit: a third stop landing at 6pm TOMORROW renders as "6:27 pm"
 * and reads as though the day runs backwards from the 9:13 pm stop before it.
 */
export const timeOnDay = (dateStr: string, value: Date | string): string => {
  const off = dayOffset(dateStr, value);
  return off === 0 ? timeOnly(value) : `${timeOnly(value)} ${off > 0 ? `+${off}d` : `${off}d`}`;
};

/** `d MMM` / `EEE d MMM, h:mm am` helpers used across the B2C screens. */
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const shortDate = (value: Date | string): string => {
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? '—' : `${d.getDate()} ${MON[d.getMonth()]}`;
};

/** "Tue 1 Sep, 9:00 am" — how an appointment is spoken about. */
export const appointmentLabel = (value: Date | string): string => {
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return '—';
  return `${WD[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}, ${timeOnly(d)}`;
};

/** Splits an instant into the `yyyy-mm-dd` + `HH:mm` a two-field date/time picker edits. */
export const splitLocal = (value?: string | null): { date: string; time: string } => {
  if (!value) return { date: '', time: '' };
  const d = new Date(value);
  if (isNaN(d.getTime())) return { date: '', time: '' };
  return { date: isoDate(d), time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
};

/** Recombines that pair into the UTC ISO instant the API stores. */
export const joinLocal = (date: string, time: string): string | null => {
  if (!date) return null;
  const [h, m] = (time || '00:00').split(':').map(Number);
  const [y, mo, d] = date.split('-').map(Number);
  const dt = new Date(y, (mo || 1) - 1, d || 1, h || 0, m || 0, 0, 0);
  return isNaN(dt.getTime()) ? null : dt.toISOString();
};
