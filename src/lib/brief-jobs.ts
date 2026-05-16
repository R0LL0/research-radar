import { db } from "@/lib/db";
import { summarizeWithCitations } from "@/lib/ai";
import { fetchArticleText, isPlaceholderSummary, isThinExtractedText } from "@/lib/article-extract";
import type { Prisma } from "@prisma/client";
import type { ItemListFilters } from "@/lib/item-filters";
import { buildItemWhere } from "@/lib/item-filters";

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

type JobPayload = {
  itemIds: string[];
  filters: ItemListFilters;
};

export async function createBriefAllJob(
  filters: ItemListFilters,
  filterQs = "",
  workspaceId: string,
) {
  const where = buildItemWhere({ ...filters, summarized: "no" });
  const items = await db.item.findMany({
    where: {
      AND: [where, { content: { isNot: null } }, { source: { workspaceId } }],
    },
    orderBy: [{ publishedAt: "desc" }, { fetchedAt: "desc" }],
    take: 25,
    select: { id: true },
  });

  const itemIds = items.map((item) => item.id);
  if (!itemIds.length) {
    return null;
  }

  return db.backgroundJob.create({
    data: {
      workspaceId,
      kind: "BRIEF_ALL",
      status: "PENDING",
      progress: 0,
      total: itemIds.length,
      message: "Queued",
      filterQs,
      payload: toJson({ itemIds, filters } satisfies JobPayload),
    },
  });
}

export async function tickBriefAllJob(jobId: string, workspaceId?: string) {
  const job = await db.backgroundJob.findFirst({
    where: workspaceId ? { id: jobId, workspaceId } : { id: jobId },
  });
  if (!job || job.kind !== "BRIEF_ALL") return null;
  if (job.status === "DONE" || job.status === "FAILED") return job;

  const payload = job.payload as JobPayload | null;
  const itemIds = payload?.itemIds ?? [];
  if (!itemIds.length) {
    return db.backgroundJob.update({
      where: { id: jobId },
      data: { status: "DONE", message: "Nothing to brief", progress: 0, total: 0 },
    });
  }

  const index = job.progress;
  if (index >= itemIds.length) {
    return db.backgroundJob.update({
      where: { id: jobId },
      data: { status: "DONE", message: "All items briefed" },
    });
  }

  const itemId = itemIds[index]!;
  await db.backgroundJob.update({
    where: { id: jobId },
    data: { status: "RUNNING", message: `Briefing item ${index + 1} of ${itemIds.length}` },
  });

  const item = await db.item.findUnique({
    where: { id: itemId },
    include: { content: true, summary: true },
  });

  if (!item) {
    return db.backgroundJob.update({
      where: { id: jobId },
      data: {
        progress: index + 1,
        message: `Skipped missing item (${index + 1}/${itemIds.length})`,
        status: index + 1 >= itemIds.length ? "DONE" : "PENDING",
      },
    });
  }

  let textForSummary = item.content?.text ?? null;
  if (isThinExtractedText(textForSummary)) {
    const fetched = await fetchArticleText(item.url);
    if (fetched) {
      textForSummary = fetched;
      await db.itemContent.upsert({
        where: { itemId: item.id },
        update: { text: fetched },
        create: { itemId: item.id, text: fetched },
      });
    }
  }

  if (!textForSummary || isThinExtractedText(textForSummary)) {
    return db.backgroundJob.update({
      where: { id: jobId },
      data: {
        progress: index + 1,
        message: `Skipped (no text): ${item.title.slice(0, 60)}`,
        status: index + 1 >= itemIds.length ? "DONE" : "PENDING",
      },
    });
  }

  if (item.summary && !isPlaceholderSummary(item.summary.summaryMd, textForSummary)) {
    return db.backgroundJob.update({
      where: { id: jobId },
      data: {
        progress: index + 1,
        message: `Already briefed: ${item.title.slice(0, 50)}`,
        status: index + 1 >= itemIds.length ? "DONE" : "PENDING",
      },
    });
  }

  try {
    const result = await summarizeWithCitations({
      workspaceId: job.workspaceId,
      title: item.title,
      url: item.url,
      text: textForSummary,
    });
    await db.itemSummary.upsert({
      where: { itemId: item.id },
      update: {
        model: result.model,
        summaryMd: result.summaryMd,
        citations: toJson(result.citations),
      },
      create: {
        itemId: item.id,
        model: result.model,
        summaryMd: result.summaryMd,
        citations: toJson(result.citations),
      },
    });
    return db.backgroundJob.update({
      where: { id: jobId },
      data: {
        progress: index + 1,
        message: `Briefed: ${item.title.slice(0, 50)}`,
        status: index + 1 >= itemIds.length ? "DONE" : "PENDING",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "AI failed";
    return db.backgroundJob.update({
      where: { id: jobId },
      data: {
        progress: index + 1,
        message: `Failed: ${message.slice(0, 120)}`,
        status: index + 1 >= itemIds.length ? "FAILED" : "PENDING",
      },
    });
  }
}
