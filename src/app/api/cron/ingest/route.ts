import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ingestAllEnabledSources } from "@/lib/ingest-all";

function authorize(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return true;
  const header = request.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  const url = new URL(request.url);
  return url.searchParams.get("secret") === secret;
}

async function runIngestForWorkspace(workspaceId: string) {
  const settings = await db.workspaceSettings.findUnique({ where: { workspaceId } });
  const enabled = settings?.autoIngestEnabled ?? true;
  const intervalMinutes = settings?.autoIngestIntervalMinutes ?? 360;
  if (!enabled) return { workspaceId, ran: false as const, reason: "disabled" };

  const last = settings?.lastScheduledIngestAt;
  const dueAt = last ? last.getTime() + intervalMinutes * 60_000 : 0;
  if (Date.now() < dueAt) {
    return {
      workspaceId,
      ran: false as const,
      reason: "not_due",
      nextAt: new Date(dueAt).toISOString(),
    };
  }

  const result = await ingestAllEnabledSources(workspaceId);
  await db.workspaceSettings.upsert({
    where: { workspaceId },
    update: { lastScheduledIngestAt: new Date() },
    create: { workspaceId, lastScheduledIngestAt: new Date() },
  });

  return { workspaceId, ran: true as const, ...result };
}

export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaces = await db.workspace.findMany({ select: { id: true } });
  const results = [];
  for (const workspace of workspaces) {
    results.push(await runIngestForWorkspace(workspace.id));
  }

  return NextResponse.json({ workspaces: results });
}

export async function POST(request: Request) {
  return GET(request);
}
