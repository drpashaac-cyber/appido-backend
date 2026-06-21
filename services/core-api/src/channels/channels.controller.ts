import { BadRequestException, Body, Controller, Get, Inject, NotFoundException, Param, Patch, Req, UseGuards } from "@nestjs/common";
import { IsBoolean, IsIn, IsInt, IsOptional, Min } from "class-validator";
import { desc, eq, sql } from "drizzle-orm";
import { runWithRls, schema, type DbHandle } from "@appido/db";
import { DB } from "../db/db.module";
import { AuthGuard, type AuthedRequest } from "../auth/auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

class AiConfigDto {
  @IsOptional() @IsIn(["claude", "gpt", "gemini"]) aiModel?: string;
  @IsOptional() @IsBoolean() aiEnabled?: boolean;
  @IsOptional() @IsInt() @Min(0) aiBudgetCents?: number;
  @IsOptional() @IsBoolean() onboardingEnabled?: boolean;
}

/** RLS-scoped channels for the dashboard. Returns a SAFE projection (never the encrypted bot token)
 * plus each channel's GMV (sum of its OK transactions). */
@Controller("channels")
@UseGuards(AuthGuard)
export class ChannelsController {
  constructor(@Inject(DB) private readonly dbh: DbHandle) {}

  @Get()
  list(@Req() req: AuthedRequest) {
    return runWithRls(this.dbh.pool, req.rls, (tx) =>
      tx
        .select({
          id: schema.channels.id,
          name: schema.channels.name,
          username: schema.channels.username,
          members: schema.channels.members,
          botUsername: schema.channels.botUsername,
          connectedAt: schema.channels.connectedAt,
          aiModel: schema.channels.aiModel,
          aiEnabled: schema.channels.aiEnabled,
          onboardingEnabled: schema.channels.onboardingEnabled,
          aiBudgetCents: schema.channels.aiBudgetCents,
          createdAt: schema.channels.createdAt,
          revCents: sql<number>`(SELECT coalesce(sum(amount_cents),0)::bigint FROM transactions tx2 WHERE tx2.channel_id = ${schema.channels.id} AND tx2.status='ok')`,
        })
        .from(schema.channels)
        .orderBy(desc(schema.channels.createdAt)),
    );
  }

  // The channel's AI config is the single source of truth: the dashboard edits it here, the owner
  // console reads the same fields per tenant. RLS guarantees the channel belongs to this tenant.
  @Patch(":id/ai")
  @UseGuards(AuthGuard, RolesGuard)
  @Roles("tenant_admin")
  async updateAi(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: AiConfigDto) {
    const set: Record<string, unknown> = {};
    if (body.aiModel !== undefined) set.aiModel = body.aiModel;
    if (body.aiEnabled !== undefined) set.aiEnabled = body.aiEnabled;
    if (body.aiBudgetCents !== undefined) set.aiBudgetCents = body.aiBudgetCents;
    if (body.onboardingEnabled !== undefined) set.onboardingEnabled = body.onboardingEnabled;
    if (Object.keys(set).length === 0) throw new BadRequestException("no_changes");
    const rows = await runWithRls(this.dbh.pool, req.rls, (tx) =>
      tx
        .update(schema.channels)
        .set(set)
        .where(eq(schema.channels.id, id))
        .returning({ id: schema.channels.id, aiModel: schema.channels.aiModel, aiEnabled: schema.channels.aiEnabled, aiBudgetCents: schema.channels.aiBudgetCents, onboardingEnabled: schema.channels.onboardingEnabled }),
    );
    if (!rows.length) throw new NotFoundException("channel_not_found");
    return rows[0];
  }
}
