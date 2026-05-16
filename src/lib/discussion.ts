import { stripHtml, truncate } from "@/lib/text";

const HN_ITEM_API = "https://hn.algolia.com/api/v1/items";
const MAX_COMMENTS = 80;
const MAX_COMMENT_CHARS = 900;

type HackerNewsComment = {
  id?: number;
  author?: string | null;
  text?: string | null;
  children?: HackerNewsComment[];
};

type HackerNewsItem = {
  id?: number;
  children?: HackerNewsComment[];
};

function getStringProperty(value: unknown, key: string) {
  if (!value || typeof value !== "object") return null;
  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === "string" ? candidate : null;
}

export function getDiscussionUrl(raw: unknown) {
  const comments = getStringProperty(raw, "comments");
  if (comments) return comments;

  const link = getStringProperty(raw, "link");
  if (link?.includes("news.ycombinator.com/item")) return link;

  return null;
}

function getHackerNewsItemId(raw: unknown) {
  const discussionUrl = getDiscussionUrl(raw);
  if (!discussionUrl) return null;

  try {
    const url = new URL(discussionUrl);
    const id = url.searchParams.get("id");
    return id && /^\d+$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

function flattenComments(comments: HackerNewsComment[] | undefined, out: string[] = []) {
  for (const comment of comments ?? []) {
    if (out.length >= MAX_COMMENTS) break;

    const text = stripHtml(comment.text ?? "").trim();
    if (text.length >= 20) {
      const author = comment.author?.trim() || "unknown";
      out.push(`${author}: ${truncate(text, MAX_COMMENT_CHARS)}`);
    }

    flattenComments(comment.children, out);
  }
  return out;
}

export async function fetchHackerNewsDiscussionText(raw: unknown) {
  const id = getHackerNewsItemId(raw);
  if (!id) return null;

  const res = await fetch(`${HN_ITEM_API}/${id}`, {
    cache: "no-store",
    headers: { "user-agent": "Research-Radar/0.1 (+local)" },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) return null;

  const item = (await res.json().catch(() => null)) as HackerNewsItem | null;
  const comments = flattenComments(item?.children);
  if (comments.length === 0) return null;

  return truncate(
    [
      `Hacker News discussion: ${getDiscussionUrl(raw) ?? `${HN_ITEM_API}/${id}`}`,
      `Fetched comments: ${comments.length}`,
      "",
      ...comments.map((comment, index) => `Comment ${index + 1}: ${comment}`),
    ].join("\n"),
    24_000,
  );
}
