import { db } from "@/lib/db";
import { ingestArxiv, ingestRss } from "@/lib/ingest";
import { rewriteFeedUrlIfKnown } from "@/lib/feed-url-fixes";
import type { Prisma } from "@prisma/client";

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

async function ingestSource(sourceId: string, workspaceId: string) {
  const source = await db.source.findFirst({ where: { id: sourceId, workspaceId } });
  if (!source) return { count: 0, title: null as string | null };

  const feedUrl = rewriteFeedUrlIfKnown(source.url.trim());
  if (feedUrl !== source.url) {
    await db.source.update({ where: { id: source.id }, data: { url: feedUrl } });
  }

  const items = source.type === "ARXIV" ? await ingestArxiv(feedUrl) : await ingestRss(feedUrl);

  for (const it of items) {
    const fallbackExternalId = (() => {
      const a = (it.externalId ?? "").trim();
      if (a) return a;
      const b = (it.url ?? "").trim();
      if (b) return b;
      const c = `${it.title}|${it.publishedAt ? it.publishedAt.toISOString() : ""}`.trim();
      if (c !== "|") return c;
      return `fallback:${source.id}:${it.title}`;
    })();

    const created = await db.item.upsert({
      where: {
        sourceId_externalId: {
          sourceId: source.id,
          externalId: fallbackExternalId,
        },
      },
      update: {
        title: it.title,
        url: it.url,
        author: it.author,
        publishedAt: it.publishedAt,
        raw: toJson(it.raw),
      },
      create: {
        sourceId: source.id,
        externalId: fallbackExternalId,
        title: it.title,
        url: it.url,
        author: it.author,
        publishedAt: it.publishedAt,
        raw: toJson(it.raw),
      },
    });

    if (it.extractedText) {
      await db.itemContent.upsert({
        where: { itemId: created.id },
        update: { text: it.extractedText },
        create: { itemId: created.id, text: it.extractedText },
      });
    }
  }

  await db.source.update({ where: { id: source.id }, data: { updatedAt: new Date() } });
  return { count: items.length, title: source.title ?? feedUrl };
}

export async function ingestSourceWithHealth(sourceId: string, workspaceId: string) {
  const source = await db.source.findFirst({ where: { id: sourceId, workspaceId } });
  if (!source) return { count: 0, title: null as string | null };

  const attemptedAt = new Date();
  await db.source.update({
    where: { id: source.id },
    data: { lastRefreshAt: attemptedAt, healthStatus: "REFRESHING" },
  });

  try {
    const result = await ingestSource(sourceId, workspaceId);
    await db.source.update({
      where: { id: source.id },
      data: {
        lastRefreshAt: attemptedAt,
        lastSuccessAt: new Date(),
        lastRefreshError: null,
        lastItemCount: result.count,
        healthStatus: result.count > 0 ? "HEALTHY" : "EMPTY",
      },
    });
    return result;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "unknown error";
    await db.source.update({
      where: { id: source.id },
      data: {
        lastRefreshAt: attemptedAt,
        lastRefreshError: message.slice(0, 600),
        healthStatus: "FAILING",
      },
    });
    throw error;
  }
}

export type IngestAllResult = {
  sourceCount: number;
  successCount: number;
  totalItems: number;
  failures: string[];
};

export async function ingestAllEnabledSources(workspaceId: string): Promise<IngestAllResult> {
  const sources = await db.source.findMany({
    where: { enabled: true, workspaceId },
    orderBy: { createdAt: "asc" },
    select: { id: true, title: true, url: true },
  });

  let totalItems = 0;
  const failures: string[] = [];
  let successCount = 0;

  for (const source of sources) {
    try {
      const result = await ingestSourceWithHealth(source.id, workspaceId);
      totalItems += result.count;
      successCount += 1;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "unknown error";
      failures.push(`${source.title ?? source.url}: ${message}`);
    }
  }

  return {
    sourceCount: sources.length,
    successCount,
    totalItems,
    failures,
  };
}
