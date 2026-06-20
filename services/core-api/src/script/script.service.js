"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScriptService = void 0;
const common_1 = require("@nestjs/common");
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@appido/db");
const db_module_1 = require("../db/db.module");
const PLATFORM = { platform: true };
// Owner-curated onboarding script (platform-global). The AI worker reads listActive().
let ScriptService = class ScriptService {
    dbh;
    constructor(dbh) {
        this.dbh = dbh;
    }
    slug(s) {
        return (s || "q").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48) || "q";
    }
    /** Active + enabled, ordered — for the AI worker and the tenant read. */
    listActive() {
        return (0, db_1.runWithRls)(this.dbh.pool, PLATFORM, (tx) => tx
            .select()
            .from(db_1.schema.appidoScript)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.appidoScript.active, true), (0, drizzle_orm_1.eq)(db_1.schema.appidoScript.enabled, true)))
            .orderBy((0, drizzle_orm_1.asc)(db_1.schema.appidoScript.sortOrder)));
    }
    /** All non-deleted rows (enabled + paused) — for the owner console. */
    listAll() {
        return (0, db_1.runWithRls)(this.dbh.pool, PLATFORM, (tx) => tx.select().from(db_1.schema.appidoScript).where((0, drizzle_orm_1.eq)(db_1.schema.appidoScript.active, true)).orderBy((0, drizzle_orm_1.asc)(db_1.schema.appidoScript.sortOrder)));
    }
    async create(input) {
        const key = (input.key && input.key.trim()) || this.slug(input.questionEn || "");
        const [row] = await (0, db_1.runWithRls)(this.dbh.pool, PLATFORM, (tx) => tx
            .insert(db_1.schema.appidoScript)
            .values({
            key,
            category: input.category || "onboard",
            questionFa: input.questionFa || "",
            questionEn: input.questionEn || "",
            sortOrder: input.sortOrder ?? 0,
            enabled: input.enabled ?? true,
        })
            .returning());
        return row;
    }
    async update(id, patch) {
        const set = { updatedAt: new Date() };
        if (patch.category !== undefined)
            set.category = patch.category;
        if (patch.questionFa !== undefined)
            set.questionFa = patch.questionFa;
        if (patch.questionEn !== undefined)
            set.questionEn = patch.questionEn;
        if (patch.sortOrder !== undefined)
            set.sortOrder = patch.sortOrder;
        if (patch.enabled !== undefined)
            set.enabled = patch.enabled;
        const [row] = await (0, db_1.runWithRls)(this.dbh.pool, PLATFORM, (tx) => tx.update(db_1.schema.appidoScript).set(set).where((0, drizzle_orm_1.eq)(db_1.schema.appidoScript.id, id)).returning());
        return row ?? null;
    }
    async remove(id) {
        await (0, db_1.runWithRls)(this.dbh.pool, PLATFORM, (tx) => tx.update(db_1.schema.appidoScript).set({ active: false, updatedAt: new Date() }).where((0, drizzle_orm_1.eq)(db_1.schema.appidoScript.id, id)));
        return { ok: true };
    }
};
exports.ScriptService = ScriptService;
exports.ScriptService = ScriptService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(db_module_1.DB)),
    __metadata("design:paramtypes", [Object])
], ScriptService);
//# sourceMappingURL=script.service.js.map