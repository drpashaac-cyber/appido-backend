"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_LIMIT = exports.DEFAULT_LIMIT = void 0;
exports.clampLimit = clampLimit;
exports.cursorToDate = cursorToDate;
exports.buildPage = buildPage;
exports.DEFAULT_LIMIT = 25;
exports.MAX_LIMIT = 100;
function clampLimit(limit) {
    if (!limit || limit < 1)
        return exports.DEFAULT_LIMIT;
    return Math.min(limit, exports.MAX_LIMIT);
}
function cursorToDate(cursor) {
    if (!cursor)
        return null;
    const d = new Date(cursor);
    return Number.isNaN(d.getTime()) ? null : d;
}
/**
 * Keyset pagination (no OFFSET): fetch `limit + 1` rows ordered by a timestamp
 * DESC, then derive the next cursor from the trimmed tail.
 */
function buildPage(rows, limit, keyOf) {
    if (rows.length <= limit)
        return { items: rows, nextCursor: null };
    const items = rows.slice(0, limit);
    return { items, nextCursor: keyOf(items[items.length - 1]).toISOString() };
}
//# sourceMappingURL=pagination.js.map