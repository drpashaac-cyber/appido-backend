"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeRetentionProcessor = makeRetentionProcessor;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@appido/db");
// Nightly data-retention purge. When data_retention_days > 0, deletes messages/events older than the
// cutoff across all tenants (platform context). 0 = keep forever (the default). See governance policy.
function makeRetentionProcessor(dbh, log) {
    return async (_job) => {
        const [row] = await (0, db_1.runWithRls)(dbh.pool, { platform: true }, (tx) => tx.select({ value: db_1.schema.appidoSettings.value }).from(db_1.schema.appidoSettings).where((0, drizzle_orm_1.eq)(db_1.schema.appidoSettings.key, "data_retention_days")).limit(1));
        const days = Number(row?.value ?? 0);
        if (!Number.isFinite(days) || days <= 0)
            return { ok: true, purged: 0, days: 0 }; // 0 = keep forever
        const cutoff = new Date(Date.now() - days * 86_400_000);
        let purged = 0;
        await (0, db_1.runWithRls)(dbh.pool, { platform: true }, async (tx) => {
            const m = await tx.delete(db_1.schema.messages).where((0, drizzle_orm_1.lt)(db_1.schema.messages.at, cutoff)).returning({ id: db_1.schema.messages.id });
            const e = await tx.delete(db_1.schema.events).where((0, drizzle_orm_1.lt)(db_1.schema.events.at, cutoff)).returning({ id: db_1.schema.events.id });
            purged = m.length + e.length;
        });
        log.info({ days, purged }, "retention purge done");
        return { ok: true, purged, days };
    };
}
//# sourceMappingURL=retention.js.map