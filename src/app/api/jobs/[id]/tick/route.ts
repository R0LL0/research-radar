import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth";
import { tickBriefAllJob } from "@/lib/brief-jobs";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { workspaceId } = await getWorkspaceContext();
  const { id } = await context.params;
  const job = await tickBriefAllJob(id, workspaceId);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  return NextResponse.json({
    id: job.id,
    status: job.status,
    progress: job.progress,
    total: job.total,
    message: job.message,
  });
}
