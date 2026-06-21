import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { runWithRls, schema, type DbHandle } from "@appido/db";
import { DB } from "../db/db.module";

const PLATFORM = { platform: true as const };
const TRIAL_MIN = 0;
const TRIAL_MAX = 365;
const TRIAL_DEFAULT = 14;
const PII_MODES = ["off", "mask_before_llm", "mask_at_rest"];
const RESIDENCY = ["global", "eu", "us", "ir", "ru"];

@Injectable()
export class SettingsService {
  constructor(@Inject(DB) private readonly dbh: DbHandle) {}

  private async raw(key: string): Promise<unknown> {
    const [row] = await runWithRls(this.dbh.pool, PLATFORM, (tx) =>
      tx.select({ value: schema.appidoSettings.value }).from(schema.appidoSettings).where(eq(schema.appidoSettings.key, key)).limit(1),
    );
    return row ? row.value : undefined;
  }

  private async setRaw(key: string, value: unknown) {
    await runWithRls(this.dbh.pool, PLATFORM, (tx) =>
      tx
        .insert(schema.appidoSettings)
        .values({ key, value, updatedAt: new Date() })
        .onConflictDoUpdate({ target: schema.appidoSettings.key, set: { value, updatedAt: new Date() } }),
    );
  }

  async trialDays(): Promise<number> {
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

  async setTrialDays(days: number): Promise<{ trialDays: number }> {
    const n = Math.min(TRIAL_MAX, Math.max(TRIAL_MIN, Math.round(days)));
    await this.setRaw("trial_days", n);
    return { trialDays: n };
  }

  // ---- Governance policy (platform-wide; reuses the KV store) ----
  private async boolKey(key: string, def: boolean): Promise<boolean> {
    const v = await this.raw(key);
    return typeof v === "boolean" ? v : v === "true" || v === 1 ? true : v === undefined ? def : !!v;
  }
  private async strKey(key: string, def: string): Promise<string> {
    const v = await this.raw(key);
    return typeof v === "string" && v ? v : def;
  }
  private async intKey(key: string, def: number): Promise<number> {
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

  async setGovernance(patch: Partial<{ requireOptin: boolean; aiRequiresConsent: boolean; piiRedaction: string; dataRetentionDays: number; residency: string }>) {
    if (patch.requireOptin !== undefined) await this.setRaw("require_optin", !!patch.requireOptin);
    if (patch.aiRequiresConsent !== undefined) await this.setRaw("ai_requires_consent", !!patch.aiRequiresConsent);
    if (patch.piiRedaction !== undefined && PII_MODES.includes(patch.piiRedaction)) await this.setRaw("pii_redaction", patch.piiRedaction);
    if (patch.dataRetentionDays !== undefined) await this.setRaw("data_retention_days", Math.max(0, Math.min(3650, Math.round(patch.dataRetentionDays))));
    if (patch.residency !== undefined && RESIDENCY.includes(patch.residency)) await this.setRaw("residency", patch.residency);
    return this.governanceView();
  }
}
