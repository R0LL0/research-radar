import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { itemsInWorkspaceWhere } from "@/lib/workspace";
import { buildBriefingsHtml, buildBriefingsMarkdown } from "@/lib/export-briefings";
import { buildItemWhere, type ItemListFilters } from "@/lib/item-filters";
import type { SourceType } from "@prisma/client";

function parseFilters(searchParams: URLSearchParams): ItemListFilters {
  const q = searchParams.get("q") ?? "";
  const watch = searchParams.get("watch") ?? "";
  const sourceId = searchParams.get("source") ?? "";
  const t = searchParams.get("type") ?? "";
  const type: "" | SourceType = t === "RSS" || t === "ARXIV" ? t : "";
  const s = searchParams.get("summarized") ?? "all";
  const summarized = s === "yes" || s === "no" ? s : "all";
  return { q, watch, sourceId, type, summarized };
}

export async function GET(request: Request) {
  const { workspaceId } = await getWorkspaceContext();
  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "md";
  const filters = parseFilters(url.searchParams);
  const filterWhere = buildItemWhere(filters);
  const where =
    Object.keys(filterWhere).length === 0
      ? itemsInWorkspaceWhere(workspaceId)
      : { AND: [filterWhere, itemsInWorkspaceWhere(workspaceId)] };

  const items = await db.item.findMany({
    where,
    orderBy: [{ publishedAt: "desc" }, { fetchedAt: "desc" }],
    take: 80,
    include: { source: true, content: true, summary: true },
  });

  const title = filters.q.trim()
    ? `Research Radar export: ${filters.q.trim()}`
    : "Research Radar briefing export";
  const meta = { title, generatedAt: new Date() };

  if (format === "html" || format === "pdf") {
    const html = buildBriefingsHtml(items, meta);
    return new NextResponse(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "content-disposition": `inline; filename="research-radar-briefings.html"`,
      },
    });
  }

  const markdown = buildBriefingsMarkdown(items, meta);
  return new NextResponse(markdown, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="research-radar-briefings.md"`,
    },
  });
}
