/**
 * Display formatters for the web UI (S6 attendance + shared).
 *
 * Timezone-safe: attendance timestamps are stored UTC; the UI renders them in
 * Asia/Jakarta (WIB) so clock-in/out times match the office clock.
 */

const TZ = 'Asia/Jakarta';

/** "HH:MM" in Asia/Jakarta; null/undefined → "—". */
export function formatTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: TZ,
  }).format(d);
}

/** "DD Mon YYYY" in Asia/Jakarta; null/undefined → "—". */
export function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: TZ,
  }).format(d);
}

/** Minutes → "2j 15m"; null → "—". */
export function formatMinutes(min: number | null | undefined): string {
  if (min == null) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  return `${h}j ${m}m`;
}
