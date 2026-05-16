import { db } from "@/lib/db";

export async function sourceBelongsToWorkspace(sourceId: string, workspaceId: string) {
  const source = await db.source.findFirst({
    where: { id: sourceId, workspaceId },
    select: { id: true },
  });
  return Boolean(source);
}

export async function itemBelongsToWorkspace(itemId: string, workspaceId: string) {
  const item = await db.item.findFirst({
    where: { id: itemId, source: { workspaceId } },
    select: { id: true },
  });
  return Boolean(item);
}

export async function jobBelongsToWorkspace(jobId: string, workspaceId: string) {
  const job = await db.backgroundJob.findFirst({
    where: { id: jobId, workspaceId },
    select: { id: true },
  });
  return Boolean(job);
}
