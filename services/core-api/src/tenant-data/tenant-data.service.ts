import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, desc, eq, gte, lt, sql, type SQL } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { runWithRls, schema, type DbHandle, type RlsContext } from "@appido/db";
import { SecretCipher } from "@appido/crypto";
import { TelegramApi } from "@appido/telegram";
import { DB } from "../db/db.module";
import { SECRET_CIPHER } from "../crypto/crypto.module";
import { buildPage, clampLimit, cursorToDate, type Page } from "../common/pagination";

const FAR_FUTURE = new Date(8640000000000000);
const n = (v: unknown): number => Number(v ?? 0);

type Tx = NodePgDatabase<typeof schema>;
async function rows<T>(tx: Tx, q: SQL): Promise<T[]> {
  const res = (await tx.execute(q)) as unknown;
  if (Array.isArray(res)) return res as T[];
  const r = (res as { rows?: unknown[] }).rows;
  return (Array.isArray(r) ? r : []) as T[];
}

@Injectable()
export class TenantDataService {
  constructor(
    @Inject(DB) private readonly dbh: DbHandle,
    @Inject(SECRET_CIPHER) private readonly cipher: SecretCipher,
  ) {}

  customers(ctx: RlsContext, limit?: number, cursor?: string): Promise<Page<typeof schema.customers.$inferSelect>> {
    const lim = clampLimit(limit);
    const cur = cursorToDate(cursor) ?? FAR_FUTURE;
    return runWithRls(this.dbh.pool, ctx, async (tx) => {
      const rows = await tx
        .select()
        .from(schema.customers)
        .where(lt(schema.customers.createdAt, cur))
        .orderBy(desc(schema.customers.createdAt))
        .limit(lim + 1);
      return buildPage(rows, lim, (r) => r.createdAt);
    });
  }

  customerDetail(ctx: RlsContext, id: string) {
    return runWithRls(this.dbh.pool, ctx, async (tx) => {
      const [customer] = await tx.select().from(schema.customers).where(eq(schema.customers.id, id)).limit(1);
      if (!customer) throw new NotFoundException("customer_not_found");
      const timeline = await tx
        .select()
        .from(schema.events)
        .where(eq(schema.events.customerId, id))
        .orderBy(desc(schema.events.at))
        .limit(50);
      return { customer, timeline };
    });
  }

  products(ctx: RlsContext) {
    return runWithRls(this.dbh.pool, ctx, (tx) =>
      tx
        .select({
          id: schema.products.id,
          name: schema.products.name,
          priceCents: schema.products.priceCents,
          currency: schema.products.currency,
          durationDays: schema.products.durationDays,
          description: schema.products.description,
          doc: schema.products.doc,
          active: schema.products.active,
          createdAt: schema.products.createdAt,
          sales: sql<number>`(SELECT count(*)::int FROM transactions tx2 WHERE tx2.product_id = ${schema.products.id} AND tx2.status = 'ok')`,
        })
        .from(schema.products)
        .orderBy(desc(schema.products.createdAt)),
    );
  }

  transactions(ctx: RlsContext, limit?: number, cursor?: string) {
    const lim = clampLimit(limit);
    const cur = cursorToDate(cursor) ?? FAR_FUTURE;
    return runWithRls(this.dbh.pool, ctx, async (tx) => {
      const rows = await tx
        .select({
          id: schema.transactions.id,
          amountCents: schema.transactions.amountCents,
          currency: schema.transactions.currency,
          gateway: schema.transactions.gateway,
          status: schema.transactions.status,
          customerId: schema.transactions.customerId,
          productId: schema.transactions.productId,
          customerName: schema.customers.name,
          at: schema.transactions.at,
        })
        .from(schema.transactions)
        .leftJoin(schema.customers, eq(schema.customers.id, schema.transactions.customerId))
        .where(lt(schema.transactions.at, cur))
        .orderBy(desc(schema.transactions.at))
        .limit(lim + 1);
      return buildPage(rows, lim, (r) => r.at);
    });
  }

  // Conversation list for the inbox/CRM: ONE row per customer (their latest message + key fields),
  // most-recent first. Customers without messages sort last (last=null).
  inbox(ctx: RlsContext, limit?: number) {
    const lim = clampLimit(limit);
    return runWithRls(this.dbh.pool, ctx, (tx) =>
      rows<{
        customerId: string;
        name: string;
        handle: string | null;
        tag: string;
        intent: number;
        segment: string | null;
        aiManaged: boolean;
        isVip: boolean;
        last: string | null;
        author: string | null;
        direction: string | null;
        at: string | null;
        unread: number;
      }>(
        tx,
        sql`SELECT q.* FROM (
              SELECT DISTINCT ON (c.id)
                c.id AS "customerId", c.name, c.handle, c.tag, c.intent, c.segment,
                c.ai_managed AS "aiManaged", c.is_vip AS "isVip",
                m.body AS last, m.author, m.direction, m.at,
                (SELECT count(*) FROM messages mu WHERE mu.customer_id = c.id AND mu.direction = 'in' AND mu.read_at IS NULL)::int AS unread
              FROM customers c
              LEFT JOIN messages m ON m.customer_id = c.id
              ORDER BY c.id, m.at DESC NULLS LAST
            ) q
            ORDER BY q.at DESC NULLS LAST
            LIMIT ${lim}`,
      ),
    );
  }

  // Full chat thread for one customer (oldest → newest) — powers the inbox conversation pane.
  messages(ctx: RlsContext, id: string, limit?: number) {
    const lim = clampLimit(limit);
    return runWithRls(this.dbh.pool, ctx, (tx) =>
      tx
        .select({
          id: schema.messages.id,
          direction: schema.messages.direction,
          author: schema.messages.author,
          body: schema.messages.body,
          at: schema.messages.at,
        })
        .from(schema.messages)
        .where(eq(schema.messages.customerId, id))
        .orderBy(asc(schema.messages.at))
        .limit(lim),
    );
  }

  // Operator manual reply: send via the channel's Telegram bot and record it as a human message.
  async sendReply(ctx: RlsContext, customerId: string, text: string) {
    const body = (text ?? "").trim();
    if (!body) throw new BadRequestException("empty_message");
    if (body.length > 4000) throw new BadRequestException("message_too_long");
    return runWithRls(this.dbh.pool, ctx, async (tx) => {
      const [customer] = await tx
        .select({ tgUserId: schema.customers.tgUserId, channelId: schema.customers.channelId })
        .from(schema.customers)
        .where(eq(schema.customers.id, customerId))
        .limit(1);
      if (!customer) throw new NotFoundException("customer_not_found");
      if (!customer.channelId) throw new BadRequestException("customer_has_no_channel");
      const [channel] = await tx
        .select({ botTokenEnc: schema.channels.botTokenEnc })
        .from(schema.channels)
        .where(eq(schema.channels.id, customer.channelId))
        .limit(1);
      if (!channel?.botTokenEnc) throw new BadRequestException("channel_not_connected");
      if (customer.tgUserId != null) {
        const telegram = new TelegramApi(this.cipher.decrypt(channel.botTokenEnc));
        await telegram.sendMessage(customer.tgUserId, body);
      }
      const [row] = await tx
        .insert(schema.messages)
        .values({ tenantId: ctx.tenantId!, channelId: customer.channelId, customerId, direction: "out", body, author: "human" })
        .returning({ id: schema.messages.id, at: schema.messages.at });
      await tx.insert(schema.events).values({ tenantId: ctx.tenantId!, customerId, type: "message" });
      return { id: row.id, at: row.at, direction: "out", author: "human", body };
    });
  }

  // Mark a customer's inbound messages as read (clears the inbox unread badge).
  async markRead(ctx: RlsContext, customerId: string) {
    return runWithRls(this.dbh.pool, ctx, async (tx) => {
      await tx
        .update(schema.messages)
        .set({ readAt: new Date() })
        .where(and(eq(schema.messages.customerId, customerId), eq(schema.messages.direction, "in"), sql`${schema.messages.readAt} IS NULL`));
      return { ok: true };
    });
  }

  // ---- Per-customer consent (governance) ----
  listConsent(ctx: RlsContext, customerId: string) {
    return runWithRls(this.dbh.pool, ctx, (tx) =>
      tx
        .select({ purpose: schema.customerConsent.purpose, granted: schema.customerConsent.granted, source: schema.customerConsent.source, at: schema.customerConsent.at })
        .from(schema.customerConsent)
        .where(eq(schema.customerConsent.customerId, customerId)),
    );
  }

  async setConsent(ctx: RlsContext, customerId: string, input: { purpose: string; granted: boolean; source?: string }) {
    return runWithRls(this.dbh.pool, ctx, async (tx) => {
      const [cust] = await tx.select({ id: schema.customers.id }).from(schema.customers).where(eq(schema.customers.id, customerId)).limit(1);
      if (!cust) throw new NotFoundException("customer_not_found");
      const source = input.source ?? "operator";
      await tx
        .insert(schema.customerConsent)
        .values({ tenantId: ctx.tenantId!, customerId, purpose: input.purpose, granted: input.granted, source, at: new Date() })
        .onConflictDoUpdate({
          target: [schema.customerConsent.tenantId, schema.customerConsent.customerId, schema.customerConsent.purpose],
          set: { granted: input.granted, source, at: new Date() },
        });
      return tx
        .select({ purpose: schema.customerConsent.purpose, granted: schema.customerConsent.granted, source: schema.customerConsent.source, at: schema.customerConsent.at })
        .from(schema.customerConsent)
        .where(eq(schema.customerConsent.customerId, customerId));
    });
  }

  // DSAR: machine-readable export of everything held about a customer.
  async exportCustomer(ctx: RlsContext, customerId: string) {
    return runWithRls(this.dbh.pool, ctx, async (tx) => {
      const [customer] = await tx.select().from(schema.customers).where(eq(schema.customers.id, customerId)).limit(1);
      if (!customer) throw new NotFoundException("customer_not_found");
      const messages = await tx
        .select({ direction: schema.messages.direction, body: schema.messages.body, author: schema.messages.author, at: schema.messages.at })
        .from(schema.messages)
        .where(eq(schema.messages.customerId, customerId))
        .orderBy(asc(schema.messages.at));
      const events = await tx
        .select({ type: schema.events.type, amountCents: schema.events.amountCents, currency: schema.events.currency, meta: schema.events.meta, at: schema.events.at })
        .from(schema.events)
        .where(eq(schema.events.customerId, customerId))
        .orderBy(asc(schema.events.at));
      const consent = await tx
        .select({ purpose: schema.customerConsent.purpose, granted: schema.customerConsent.granted, source: schema.customerConsent.source, at: schema.customerConsent.at })
        .from(schema.customerConsent)
        .where(eq(schema.customerConsent.customerId, customerId));
      const transactions = await tx
        .select({ status: schema.transactions.status, amountCents: schema.transactions.amountCents, currency: schema.transactions.currency, at: schema.transactions.createdAt })
        .from(schema.transactions)
        .where(eq(schema.transactions.customerId, customerId))
        .orderBy(asc(schema.transactions.createdAt));
      return {
        exportedAt: new Date().toISOString(),
        customer: {
          id: customer.id,
          name: customer.name,
          handle: customer.handle,
          phone: customer.phone,
          email: customer.email,
          tag: customer.tag,
          intent: customer.intent,
          locale: customer.locale,
          profile: customer.profile,
          createdAt: customer.createdAt,
        },
        messages,
        events,
        consent,
        transactions,
      };
    });
  }

  // Right to erasure: deletes the customer; FK cascades remove messages/events/consent/identities.
  async deleteCustomer(ctx: RlsContext, customerId: string) {
    return runWithRls(this.dbh.pool, ctx, async (tx) => {
      const res = await tx.delete(schema.customers).where(eq(schema.customers.id, customerId)).returning({ id: schema.customers.id });
      if (!res.length) throw new NotFoundException("customer_not_found");
      return { ok: true as const, deleted: res[0].id };
    });
  }
}