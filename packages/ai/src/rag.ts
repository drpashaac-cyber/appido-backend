import { sql } from "drizzle-orm";
import type { Pool } from "pg";
import { runWithRls, schema } from "@appido/db";
import type { LiteLlmClient } from "./client";
import { chunkText } from "./chunking";

export async function indexKnowledge(
  pool: Pool,
  client: LiteLlmClient,
  input: { tenantId: string; source: "file" | "product"; sourceId?: string | null; text: string; meta?: Record<string, unknown> },
): Promise<number> {
  const chunks = chunkText(input.text);
  if (chunks.length === 0) return 0;
  const { embeddings } = await client.embed(chunks);
  await runWithRls(pool, { platform: false, tenantId: input.tenantId }, async (tx) => {
    for (let i = 0; i < chunks.length; i++) {
      await tx.insert(schema.knowledgeChunks).values({
        tenantId: input.tenantId,
        source: input.source,
        sourceId: input.sourceId ?? null,
        chunkText: chunks[i],
        embedding: embeddings[i],
        meta: input.meta ?? null,
      });
    }
  });
  return chunks.length;
}

export async function searchKnowledge(
  pool: Pool,
  client: LiteLlmClient,
  input: { tenantId: string; query: string; k?: number },
): Promise<{ text: string; score: number }[]> {
  if (!input.query.trim()) return [];
  const { embeddings } = await client.embed([input.query]);
  const vec = `[${embeddings[0].join(",")}]`;
  const k = input.k ?? 5;
  return runWithRls(pool, { platform: false, tenantId: input.tenantId }, async (tx) => {
    const result = await tx.execute(
      sql`SELECT chunk_text, 1 - (embedding <=> ${vec}::vector) AS score
          FROM knowledge_chunks
          WHERE embedding IS NOT NULL
          ORDER BY embedding <=> ${vec}::vector
          LIMIT ${k}`,
    );
    const rows = (result as unknown as { rows: { chunk_text: string; score: number }[] }).rows;
    return rows.map((r) => ({ text: r.chunk_text, score: Number(r.score) }));
  });
}
