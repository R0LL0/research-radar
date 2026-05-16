import type { Prisma } from "@prisma/client";
import type { SourceType } from "@prisma/client";

export type ItemListFilters = {
  q: string;
  watch: string;
  sourceId: string;
  type: "" | SourceType;
  summarized: "all" | "yes" | "no";
};

export function sourceDisplayName(source: {
  title: string | null;
  url: string;
  type: SourceType;
}): string {
  const t = source.title?.trim();
  if (t) return t;
  try {
    return new URL(source.url).hostname.replace(/^www\./, "");
  } catch {
    return source.type;
  }
}

export function buildItemWhere(f: ItemListFilters): Prisma.ItemWhereInput {
  const clauses: Prisma.ItemWhereInput[] = [];

  if (f.sourceId) clauses.push({ sourceId: f.sourceId });
  if (f.type) clauses.push({ source: { type: f.type } });

  const q = f.q.trim();
  if (q) {
    clauses.push({
      OR: [
        { title: { contains: q } },
        { author: { contains: q } },
        { content: { text: { contains: q } } },
        { summary: { summaryMd: { contains: q } } },
      ],
    });
  }

  const watchTerms = f.watch
    .split(",")
    .map((term) => term.trim())
    .filter(Boolean)
    .slice(0, 8);
  if (watchTerms.length) {
    clauses.push({
      OR: watchTerms.flatMap((term) => [
        { title: { contains: term } },
        { author: { contains: term } },
        { content: { text: { contains: term } } },
      ]),
    });
  }

  if (f.summarized === "yes") clauses.push({ summary: { isNot: null } });
  if (f.summarized === "no") clauses.push({ summary: null });

  if (clauses.length === 0) return {};
  if (clauses.length === 1) return clauses[0]!;
  return { AND: clauses };
}

export function hasActiveFilters(f: ItemListFilters): boolean {
  return !!(f.q.trim() || f.watch.trim() || f.sourceId || f.type || f.summarized !== "all");
}

/** Stable query string for round-trips after POST (server actions + filters). */
export function filtersToSearchString(f: ItemListFilters): string {
  const p = new URLSearchParams();
  p.set("q", f.q);
  if (f.watch.trim()) p.set("watch", f.watch);
  if (f.sourceId) p.set("source", f.sourceId);
  if (f.type) p.set("type", f.type);
  p.set("summarized", f.summarized);
  return p.toString();
}

export function parseItemListFilters(formData: FormData): ItemListFilters {
  const q = String(formData.get("q") ?? "");
  const watch = String(formData.get("watch") ?? "");
  const sourceId = String(formData.get("sourceId") ?? formData.get("source") ?? "");
  const t = String(formData.get("type") ?? "");
  const type: "" | SourceType = t === "RSS" || t === "ARXIV" ? t : "";
  const s = String(formData.get("summarized") ?? "all");
  const summarized = s === "yes" || s === "no" ? s : "all";
  return { q, watch, sourceId, type, summarized };
}
