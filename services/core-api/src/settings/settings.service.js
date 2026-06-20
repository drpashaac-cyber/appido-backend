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
exports.SettingsService = void 0;
const common_1 = require("@nestjs/common");
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@appido/db");
const db_module_1 = require("../db/db.module");
const PLATFORM = { platform: true };
const TRIAL_MIN = 0;
const TRIAL_MAX = 365;
const TRIAL_DEFAULT = 14;
const PII_MODES = ["off", "mask_before_llm", "mask_at_rest"];
const RESIDENCY = ["global", "eu", "us", "ir", "ru"];
let SettingsService = class SettingsService {
    dbh;
    constructor(dbh) {
        this.dbh = dbh;
    }
    async raw(key) {
        const [row] = await (0, db_1.runWithRls)(this.dbh.pool, PLATFORM, (tx) => tx.select({ value: db_1.schema.appidoSettings.value }).from(db_1.schema.appidoSettings).where((0, drizzle_orm_1.eq)(db_1.schema.appidoSettings.key, key)).limit(1));
        return row ? row.value : undefined;
    }
    async setRaw(key, value) {
        await (0, db_1.runWithRls)(this.dbh.pool, PLATFORM, (tx) => tx
            .insert(db_1.schema.appidoSettings)
            .values({ key, value, updatedAt: new Date() })
            .onConflictDoUpdate({ target: db_1.schema.appidoSettings.key, set: { value, updatedAt: new Date() } }));
    }
    async trialDays() {
        const v = await this.raw("trial_days");
        const n = typeof v === "number" ? v : Number(v);
        return Number.isFinite(n) ? Math.min(TRIAL_MAX, Math.max(TRIAL_MIN, Math.round(n))) : TRIAL_DEFAULT;
    }
    /** Public-safe settings for the landing + dashboard. */
    async publicView() {
        return { trialDays: await this.trialDays() };
    }
    /** Owner view (same shape today; extend as more settings are added). */
    async ownerView() {
        return { trialDays: await this.trialDays() };
    }
    async setTrialDays(days) {
        const n = Math.min(TRIAL_MAX, Math.max(TRIAL_MIN, Math.round(days)));
        await this.setRaw("trial_days", n);
        return { trialDays: n };
    }
    // ---- Governance policy (platform-wide; reuses the KV store) ----
    async boolKey(key, def) {
        const v = await this.raw(key);
        return typeof v === "boolean" ? v : v === "true" || v === 1 ? true : v === undefined ? def : !!v;
    }
    async strKey(key, def) {
        const v = await this.raw(key);
        return typeof v === "string" && v ? v : def;
    }
    async intKey(key, def) {
        const v = await this.raw(key);
        const n = typeof v === "number" ? v : Number(v);
        return Number.isFinite(n) ? n : def;
    }
    async governanceView() {
        return {
            requireOptin: await this.boolKey("require_optin", false),
            aiRequiresConsent: await this.boolKey("ai_requires_consent", false),
            piiRedaction: await this.strKey("pii_redaction", "mask_before_llm"),
            dataRetentionDays: await this.intKey("data_retention_days", 0),
            residency: await this.strKey("residency", "global"),
        };
    }
    async setGovernance(patch) {
        if (patch.requireOptin !== undefined)
            await this.setRaw("require_optin", !!patch.requireOptin);
        if (patch.aiRequiresConsent !== undefined)
            await this.setRaw("ai_requires_consent", !!patch.aiRequiresConsent);
        if (patch.piiRedaction !== undefined && PII_MODES.includes(patch.piiRedaction))
            await this.setRaw("pii_redaction", patch.piiRedaction);
        if (patch.dataRetentionDays !== undefined)
            await this.setRaw("data_retention_days", Math.max(0, Math.min(3650, Math.round(patch.dataRetentionDays))));
        if (patch.residency !== undefined && RESIDENCY.includes(patch.residency))
            await this.setRaw("residency", patch.residency);
        return this.governanceView();
    }
};
exports.SettingsService = SettingsService;
exports.SettingsService = SettingsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(db_module_1.DB)),
    __metadata("design:paramtypes", [Object])
], SettingsService);
//# sourceMappingURL=settings.service.js.map