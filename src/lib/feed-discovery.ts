export type DiscoveredFeed = {
  url: string;
  title: string;
  kind: "rss" | "atom" | "unknown";
  source: "html-link" | "common-path" | "probe";
};

const COMMON_FEED_PATHS = [
  "/feed",
  "/feed/",
  "/rss",
  "/rss.xml",
  "/rss/",
  "/atom.xml",
  "/index.xml",
  "/blog/feed",
  "/blog/feed/",
  "/blog/rss",
  "/blog/rss.xml",
  "/feeds/posts/default",
  "/feeds/posts/default?alt=rss",
];

function normalizeSiteUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Enter a website URL.");
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withProtocol);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only http and https URLs are supported.");
  }
  return url.origin;
}

function parseFeedsFromHtml(html: string, baseUrl: string): DiscoveredFeed[] {
  const found: DiscoveredFeed[] = [];
  const linkRe =
    /<link[^>]+rel=["']alternate["'][^>]*>/gi;
  const chunks = html.match(linkRe) ?? [];
  for (const chunk of chunks) {
    const typeMatch = chunk.match(/type=["']([^"']+)["']/i);
    const hrefMatch = chunk.match(/href=["']([^"']+)["']/i);
    if (!hrefMatch) continue;
    const type = (typeMatch?.[1] ?? "").toLowerCase();
    if (type && !type.includes("rss") && !type.includes("atom") && !type.includes("xml")) {
      continue;
    }
    try {
      const feedUrl = new URL(hrefMatch[1], baseUrl).toString();
      found.push({
        url: feedUrl,
        title: type.includes("atom") ? "Atom feed" : "RSS feed",
        kind: type.includes("atom") ? "atom" : "rss",
        source: "html-link",
      });
    } catch {
      // ignore bad href
    }
  }
  return found;
}

async function probeFeedUrl(url: string): Promise<boolean> {
  const res = await fetch(url, {
    method: "GET",
    headers: { accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*" },
    redirect: "follow",
    signal: AbortSignal.timeout(12_000),
  }).catch(() => null);
  if (!res?.ok) return false;
  const text = (await res.text().catch(() => "")).slice(0, 4000).toLowerCase();
  return (
    text.includes("<rss") ||
    text.includes("<feed") ||
    text.includes("<rdf:rdf") ||
    text.includes("xmlns:atom")
  );
}

export async function discoverFeeds(siteUrl: string): Promise<DiscoveredFeed[]> {
  const origin = normalizeSiteUrl(siteUrl);
  const seen = new Set<string>();
  const results: DiscoveredFeed[] = [];

  const push = (feed: DiscoveredFeed) => {
    const key = feed.url.replace(/\/$/, "");
    if (seen.has(key)) return;
    seen.add(key);
    results.push(feed);
  };

  const pageRes = await fetch(origin, {
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
    headers: { "user-agent": "ResearchRadar/1.0 (+feed-discovery)" },
  }).catch(() => null);

  if (pageRes?.ok) {
    const html = await pageRes.text().catch(() => "");
    for (const feed of parseFeedsFromHtml(html, origin)) {
      push(feed);
    }
  }

  const pathCandidates = COMMON_FEED_PATHS.map((path) => `${origin}${path}`);
  const probes = await Promise.all(
    pathCandidates.map(async (url) => ({ url, ok: await probeFeedUrl(url) })),
  );
  for (const probe of probes) {
    if (!probe.ok) continue;
    push({
      url: probe.url,
      title: "Discovered feed",
      kind: "unknown",
      source: "common-path",
    });
  }

  if (!results.length) {
    throw new Error(
      "No RSS or Atom feed found. Try pasting the feed URL directly, or check the site’s subscribe page.",
    );
  }

  return results.slice(0, 12);
}
