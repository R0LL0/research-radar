import Parser from "rss-parser";
import { XMLParser } from "fast-xml-parser";
import { isThinExtractedText } from "@/lib/article-extract";
import { stripHtml, truncate } from "@/lib/text";

export type IngestedItem = {
  externalId?: string | null;
  url?: string | null;
  title: string;
  author?: string | null;
  publishedAt?: Date | null;
  raw?: unknown;
  extractedText?: string | null;
};

const rss = new Parser();

type ArxivLink = {
  href?: string;
  rel?: string;
  title?: string;
  type?: string;
};

type ArxivAuthor = {
  name?: string;
};

type ArxivEntry = {
  id?: string;
  link?: ArxivLink | ArxivLink[];
  summary?: string;
  title?: string;
  author?: ArxivAuthor | ArxivAuthor[];
  published?: string;
};

type ArxivResponse = {
  feed?: {
    entry?: ArxivEntry | ArxivEntry[];
  };
};

function absolutizeLink(href: string | null | undefined, base: string): string | null {
  if (!href) return null;
  const t = href.trim();
  if (!t) return null;
  try {
    return new URL(t, base).href;
  } catch {
    return t;
  }
}

function normalizeAuthor(value: unknown): string | null {
  if (typeof value === "string") {
    const text = value.trim();
    return text || null;
  }

  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  const candidates = [record.name, record.title, record.email];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    if (Array.isArray(candidate)) {
      const text = candidate.find(
        (entry): entry is string => typeof entry === "string" && entry.trim().length > 0,
      );
      if (text) return text.trim();
    }
  }

  return null;
}

export async function ingestRss(url: string): Promise<IngestedItem[]> {
  const res = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": "Research-Radar/0.1 (+local)" },
  });
  if (!res.ok) {
    throw new Error(`Feed request failed (${res.status}) for ${url}`);
  }

  const xml = await res.text();
  const feed = await rss.parseString(xml);
  const base =
    (typeof feed.link === "string" && feed.link.trim()) ? feed.link.trim() : url;

  return (feed.items ?? []).map((it) => {
    const raw = it as unknown as Record<string, unknown>;
    const content =
      (raw["content:encoded"] as string | undefined) ??
      (raw["content"] as string | undefined) ??
      (it.contentSnippet as string | undefined) ??
      "";

    const extractedText = truncate(stripHtml(content), 20_000);

    return {
      externalId: (it.guid ?? it.id ?? null) as string | null,
      url: absolutizeLink(it.link as string | undefined, base),
      title: (it.title ?? "(untitled)") as string,
      author: normalizeAuthor(raw["creator"] ?? raw["author"]),
      publishedAt: it.isoDate ? new Date(it.isoDate) : null,
      raw,
      extractedText: isThinExtractedText(extractedText) ? null : extractedText,
    };
  });
}

export async function ingestArxiv(apiUrl: string): Promise<IngestedItem[]> {
  const res = await fetch(apiUrl, {
    headers: { "user-agent": "research-radar/0.1 (+local)" },
  });
  if (!res.ok) throw new Error(`arXiv fetch failed (${res.status})`);

  const xml = await res.text();
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
  });
  const parsed = parser.parse(xml) as ArxivResponse;

  const entries = parsed?.feed?.entry
    ? Array.isArray(parsed.feed.entry)
      ? parsed.feed.entry
      : [parsed.feed.entry]
    : [];

  return entries.map((e) => {
    const links = e?.link
      ? Array.isArray(e.link)
        ? e.link
        : [e.link]
      : [];
    const abs = links.find((l) => l.rel === "alternate") ?? links[0];
    const pdf = links.find((l) => l.title === "pdf" || l.type === "application/pdf");

    const summary = typeof e?.summary === "string" ? e.summary : "";
    const extractedText = truncate(stripHtml(summary), 20_000);
    const author = e?.author
      ? Array.isArray(e.author)
        ? e.author
            .map((a) => a?.name)
            .filter((name): name is string => Boolean(name))
            .join(", ")
        : e.author?.name ?? null
      : null;

    return {
      externalId: (e?.id ?? null) as string | null,
      url: (abs?.href ?? pdf?.href ?? null) as string | null,
      title: (e?.title ?? "(untitled)") as string,
      author,
      publishedAt: e?.published ? new Date(e.published) : null,
      raw: e,
      extractedText: isThinExtractedText(extractedText) ? null : extractedText,
    };
  });
}
