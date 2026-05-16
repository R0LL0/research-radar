import type { SourceType } from "@prisma/client";
import { getDiscussionUrl } from "@/lib/discussion";

export type IntelligenceItem = {
  id: string;
  title: string;
  url: string | null;
  publishedAt: Date | string | null;
  fetchedAt: Date | string;
  source: { type: SourceType; title: string | null; url: string };
  raw: unknown;
  content: { text: string } | null;
  summary: { summaryMd: string } | null;
};

export type SignalProfile = {
  score: number;
  label: "Quiet" | "Rising" | "Hot" | "Watch";
  reasons: string[];
};

export type StoryCluster = {
  key: string;
  label: string;
  emoji: string;
  count: number;
  score: number;
  itemIds: string[];
  sourceTypes: SourceType[];
};

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "from",
  "have",
  "into",
  "over",
  "that",
  "the",
  "this",
  "with",
  "your",
  "what",
  "when",
  "where",
  "will",
  "using",
]);

export function parseWatchTerms(value: string) {
  return value
    .split(",")
    .map((term) => term.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 8);
}

function ageHours(item: IntelligenceItem) {
  const date = new Date(item.publishedAt ?? item.fetchedAt);
  const diff = Date.now() - date.getTime();
  if (!Number.isFinite(diff)) return 999;
  return Math.max(0, diff / 3_600_000);
}

function itemText(item: IntelligenceItem) {
  return `${item.title} ${item.content?.text ?? ""} ${item.summary?.summaryMd ?? ""}`.toLowerCase();
}

export function getSignalProfile(item: IntelligenceItem, watchTerms: string[]): SignalProfile {
  const reasons: string[] = [];
  let score = 30;

  const hours = ageHours(item);
  if (hours < 24) {
    score += 18;
    reasons.push("fresh");
  } else if (hours < 72) {
    score += 10;
    reasons.push("recent");
  }

  if (item.summary) {
    score += 10;
    reasons.push("briefed");
  }
  if (item.content?.text && item.content.text.length > 1200) {
    score += 12;
    reasons.push("deep text");
  }
  if (getDiscussionUrl(item.raw)) {
    score += 14;
    reasons.push("discussion");
  }
  if (item.source.type === "ARXIV") {
    score += 8;
    reasons.push("paper");
  }

  const text = itemText(item);
  const matches = watchTerms.filter((term) => text.includes(term));
  if (matches.length) {
    score += 24 + matches.length * 4;
    reasons.push(`watch: ${matches.slice(0, 2).join(", ")}`);
  }

  const clamped = Math.min(100, score);
  return {
    score: clamped,
    label: matches.length ? "Watch" : clamped >= 76 ? "Hot" : clamped >= 55 ? "Rising" : "Quiet",
    reasons: reasons.slice(0, 4),
  };
}

function titleTokens(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 3 && !STOP_WORDS.has(token))
    .slice(0, 8);
}

function clusterEmoji(label: string) {
  const l = label.toLowerCase();
  if (/(auth|login|clerk|supabase)/.test(l)) return "🔐";
  if (/(agent|code|coding|developer)/.test(l)) return "🛠️";
  if (/(model|ai|llm|claude|gpt|openai)/.test(l)) return "🧠";
  if (/(paper|arxiv|research)/.test(l)) return "📄";
  if (/(price|limit|compute|gpu)/.test(l)) return "⚡";
  return "🛰️";
}

export function buildStoryClusters(items: IntelligenceItem[], watchTerms: string[]) {
  const buckets = new Map<string, IntelligenceItem[]>();

  for (const item of items) {
    const tokens = titleTokens(item.title);
    const watchHit = watchTerms.find((term) => itemText(item).includes(term));
    const key = watchHit || tokens[0] || item.source.type.toLowerCase();
    const current = buckets.get(key) ?? [];
    current.push(item);
    buckets.set(key, current);
  }

  return Array.from(buckets.entries())
    .map(([key, bucket]) => {
      const label = key
        .split(/[-_\s]+/)
        .filter(Boolean)
        .map((part) => part[0]!.toUpperCase() + part.slice(1))
        .join(" ");
      const sourceTypes = Array.from(new Set(bucket.map((item) => item.source.type)));
      const score = Math.round(
        bucket.reduce((total, item) => total + getSignalProfile(item, watchTerms).score, 0) /
          bucket.length,
      );
      return {
        key,
        label,
        emoji: clusterEmoji(label),
        count: bucket.length,
        score,
        itemIds: bucket.map((item) => item.id),
        sourceTypes,
      } satisfies StoryCluster;
    })
    .filter((cluster) => cluster.count > 1 || watchTerms.includes(cluster.key))
    .sort((a, b) => b.score - a.score || b.count - a.count)
    .slice(0, 6);
}
