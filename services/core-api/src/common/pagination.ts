export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export const DEFAULT_LIMIT = 25;
export const MAX_LIMIT = 100;

export function clampLimit(limit?: number): number {
  if (!limit || limit < 1) return DEFAULT_LIMIT;
  return Math.min(limit, MAX_LIMIT);
}

export function cursorToDate(cursor?: string): Date | null {
  if (!cursor) return null;
  const d = new Date(cursor);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Keyset pagination (no OFFSET): fetch `limit + 1` rows ordered by a timestamp
 * DESC, then derive the next cursor from the trimmed tail.
 */
export function buildPage<T>(rows: T[], limit: number, keyOf: (row: T) => Date): Page<T> {
  if (rows.length <= limit) return { items: rows, nextCursor: null };
  const items = rows.slice(0, limit);
  return { items, nextCursor: keyOf(items[items.length - 1]).toISOString() };
}
