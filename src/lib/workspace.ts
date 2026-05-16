import { db } from "@/lib/db";

export function getWorkspaceSettings(workspaceId: string) {
  return db.workspaceSettings.findUnique({ where: { workspaceId } });
}

export function upsertWorkspaceSettings(
  workspaceId: string,
  data: Parameters<typeof db.workspaceSettings.upsert>[0]["update"],
  createExtra?: Partial<Parameters<typeof db.workspaceSettings.upsert>[0]["create"]>,
) {
  return db.workspaceSettings.upsert({
    where: { workspaceId },
    update: data,
    create: { workspaceId, ...createExtra, ...data } as Parameters<
      typeof db.workspaceSettings.upsert
    >[0]["create"],
  });
}

export function itemsInWorkspaceWhere(workspaceId: string) {
  return { source: { workspaceId } };
}
