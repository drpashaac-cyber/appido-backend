export interface Page<T> {
    items: T[];
    nextCursor: string | null;
}
export declare const DEFAULT_LIMIT = 25;
export declare const MAX_LIMIT = 100;
export declare function clampLimit(limit?: number): number;
export declare function cursorToDate(cursor?: string): Date | null;
/**
 * Keyset pagination (no OFFSET): fetch `limit + 1` rows ordered by a timestamp
 * DESC, then derive the next cursor from the trimmed tail.
 */
export declare function buildPage<T>(rows: T[], limit: number, keyOf: (row: T) => Date): Page<T>;
