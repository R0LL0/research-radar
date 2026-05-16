/** Known-broken feed URLs saved in older DB rows → current working URLs. */
const FEED_URL_REWRITES: Record<string, string> = {
  "https://openai.com/blog/rss/": "https://openai.com/news/rss.xml",
  "https://openai.com/blog/rss": "https://openai.com/news/rss.xml",
  "http://openai.com/blog/rss/": "https://openai.com/news/rss.xml",
  "http://openai.com/blog/rss": "https://openai.com/news/rss.xml",
  "https://ai.googleblog.com/feeds/posts/default": "https://blog.google/technology/ai/rss/",
  "https://ai.googleblog.com/feeds/posts/default/": "https://blog.google/technology/ai/rss/",
  "http://ai.googleblog.com/feeds/posts/default": "https://blog.google/technology/ai/rss/",
  "http://ai.googleblog.com/feeds/posts/default/": "https://blog.google/technology/ai/rss/",
  "https://deepmind.google/discover/blog/rss.xml": "https://deepmind.google/blog/rss.xml",
  "https://deepmind.google/discover/blog/rss.xml/": "https://deepmind.google/blog/rss.xml",
  "http://deepmind.google/discover/blog/rss.xml": "https://deepmind.google/blog/rss.xml",
  "http://deepmind.google/discover/blog/rss.xml/": "https://deepmind.google/blog/rss.xml",
};

export function rewriteFeedUrlIfKnown(url: string): string {
  const key = url.trim();
  return FEED_URL_REWRITES[key] ?? key;
}

export function getKnownFeedUrlFix(url: string): string | null {
  const key = url.trim();
  const next = FEED_URL_REWRITES[key];
  return next && next !== key ? next : null;
}
