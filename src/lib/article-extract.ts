import { stripHtml, truncate } from "@/lib/text";

const MIN_USEFUL_TEXT_LENGTH = 160;

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

export function isThinExtractedText(value: string | null | undefined) {
  const text = value?.trim() ?? "";
  if (text.length < MIN_USEFUL_TEXT_LENGTH) return true;
  return /^(comments?|open source|read more|continue reading)$/i.test(text);
}

export function isPlaceholderSummary(summary: string | null | undefined, sourceText: string | null | undefined) {
  if (!isThinExtractedText(sourceText)) return false;
  const text = summary?.trim().toLowerCase() ?? "";
  if (!text) return false;

  return (
    text.includes("no substantive") ||
    text.includes("provided text contains no") ||
    text.includes("only shows a comments") ||
    text.includes("comments marker")
  );
}

function firstMatch(html: string, pattern: RegExp) {
  return pattern.exec(html)?.[1] ?? null;
}

function extractReadableHtml(html: string) {
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ");

  return (
    firstMatch(cleaned, /<article\b[^>]*>([\s\S]*?)<\/article>/i) ??
    firstMatch(cleaned, /<main\b[^>]*>([\s\S]*?)<\/main>/i) ??
    firstMatch(cleaned, /<body\b[^>]*>([\s\S]*?)<\/body>/i) ??
    cleaned
  );
}

export async function fetchArticleText(url: string | null | undefined) {
  if (!url) return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!["http:", "https:"].includes(parsed.protocol)) return null;

  const res = await fetch(parsed.href, {
    redirect: "follow",
    cache: "no-store",
    headers: {
      accept: "text/html,application/xhtml+xml,text/plain;q=0.8,*/*;q=0.1",
      "user-agent": "Research-Radar/0.1 (+local)",
    },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) return null;

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
    return null;
  }

  const html = await res.text();
  const source = contentType.includes("text/plain") ? html : extractReadableHtml(html);
  const text = truncate(decodeEntities(stripHtml(source)).replace(/\s+/g, " ").trim(), 20_000);

  return isThinExtractedText(text) ? null : text;
}
