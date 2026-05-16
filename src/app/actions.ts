"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AiProvider, Prisma, SourceType, SubscriptionPlan } from "@prisma/client";
import { db } from "@/lib/db";
import { summarizeWithCitations } from "@/lib/ai";
import { getAiProviderPreset, isModelCompatibleWithBriefings } from "@/lib/ai-providers";
import { fetchArticleText, isThinExtractedText } from "@/lib/article-extract";
import { createBriefAllJob } from "@/lib/brief-jobs";
import { sendDigestWebhook } from "@/lib/digest-notify";
import { discoverFeeds } from "@/lib/feed-discovery";
import { fetchHackerNewsDiscussionText } from "@/lib/discussion";
import { getKnownFeedUrlFix } from "@/lib/feed-url-fixes";
import { ingestAllEnabledSources, ingestSourceWithHealth } from "@/lib/ingest-all";
import { buildStoryClusters, getSignalProfile } from "@/lib/intelligence";
import { parseItemListFilters } from "@/lib/item-filters";
import { getWorkspaceContext } from "@/lib/auth";
import { encryptSecret } from "@/lib/secrets";
import {
  itemBelongsToWorkspace,
  sourceBelongsToWorkspace,
} from "@/lib/workspace-access";

async function setFlash(kind: "error" | "success", message: string, itemId?: string | null) {
  const cookieStore = await cookies();
  cookieStore.set("rr_flash", JSON.stringify({ kind, message, itemId: itemId || undefined }), {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    maxAge: 20,
  });
}

function redirectBack(formData: FormData): never {
  const filterQs = String(formData.get("filterQs") ?? "").trim();
  const itemId = String(formData.get("itemId") ?? "").trim();
  const hash = itemId ? `#item-${encodeURIComponent(itemId)}` : "";
  revalidatePath("/radar", "layout");
  redirect(`${filterQs ? `/radar?${filterQs}` : "/radar"}${hash}`);
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function parseSourceType(value: FormDataEntryValue | null): SourceType {
  return value === SourceType.ARXIV ? SourceType.ARXIV : SourceType.RSS;
}

function parseAiProvider(value: FormDataEntryValue | null): AiProvider {
  const raw = String(value ?? "");
  return Object.values(AiProvider).includes(raw as AiProvider)
    ? (raw as AiProvider)
    : AiProvider.OPENAI;
}

function parsePlan(value: FormDataEntryValue | null): SubscriptionPlan {
  if (value === SubscriptionPlan.TEAM) return SubscriptionPlan.TEAM;
  if (value === SubscriptionPlan.ENTERPRISE) return SubscriptionPlan.ENTERPRISE;
  return SubscriptionPlan.STARTER;
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function isValidUrl(value: string | null) {
  if (!value) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export async function saveAiSettings(formData: FormData) {
  const { workspaceId } = await getWorkspaceContext();
  const plan = parsePlan(formData.get("plan"));
  const provider = parseAiProvider(formData.get("provider"));
  const preset = getAiProviderPreset(provider);
  const model = String(formData.get("model") ?? "").trim() || null;
  const baseUrl =
    String(formData.get("baseUrl") ?? "").trim() || preset.defaultBaseUrl || null;
  const apiKey = String(formData.get("apiKey") ?? "").trim();
  const existing = await db.workspaceSettings.findUnique({ where: { workspaceId } });

  if (plan === SubscriptionPlan.STARTER) {
    await setFlash("error", "BYOK AI is a Team feature. Upgrade to unlock provider settings.");
    redirectBack(formData);
  }

  const keyOptional = provider === AiProvider.OLLAMA || provider === AiProvider.LM_STUDIO;
  const hasExistingProviderKey =
    existing?.aiProvider === provider && Boolean(existing?.aiApiKeyCiphertext);
  if (!apiKey && !hasExistingProviderKey && !keyOptional) {
    await setFlash("error", `Enter a ${preset.label} API key to enable premium AI briefings.`);
    redirectBack(formData);
  }

  if (!isValidUrl(baseUrl)) {
    await setFlash(
      "error",
      `${preset.label} needs a valid base URL, for example ${preset.defaultBaseUrl ?? "https://api.example.com/v1"}.`,
    );
    redirectBack(formData);
  }

  if (!isModelCompatibleWithBriefings(provider, model || preset.defaultModel)) {
    await setFlash(
      "error",
      `${model} is not supported by this app's briefing endpoint. Choose a chat-capable model such as ${preset.defaultModel}.`,
    );
    redirectBack(formData);
  }

  const encryptedKey = apiKey
    ? encryptSecret(apiKey)
    : hasExistingProviderKey
      ? existing?.aiApiKeyCiphertext ?? null
      : null;
  const keyUpdatedAt = apiKey
    ? new Date()
    : existing?.aiApiKeyUpdatedAt
      ? new Date(existing.aiApiKeyUpdatedAt)
      : null;

  await db.workspaceSettings.upsert({
    where: { workspaceId },
    update: {
      plan,
      aiProvider: provider,
      aiBaseUrl: baseUrl,
      aiModel: model || preset.defaultModel || null,
      aiApiKeyCiphertext: encryptedKey,
      aiApiKeyUpdatedAt: keyUpdatedAt,
    },
    create: {
      workspaceId,
      plan,
      aiProvider: provider,
      aiBaseUrl: baseUrl,
      aiModel: model || preset.defaultModel || null,
      aiApiKeyCiphertext: encryptedKey,
      aiApiKeyUpdatedAt: keyUpdatedAt,
    },
  });

  await setFlash("success", `${preset.label} provider settings saved.`);
  redirectBack(formData);
}

export async function deleteAiApiKey(formData: FormData) {
  const { workspaceId } = await getWorkspaceContext();
  const existing = await db.workspaceSettings.findUnique({ where: { workspaceId } });
  if (!existing?.aiApiKeyCiphertext) {
    await setFlash("error", "There is no saved AI API key to delete.");
    redirectBack(formData);
  }

  await db.workspaceSettings.update({
    where: { workspaceId },
    data: {
      aiApiKeyCiphertext: null,
      aiApiKeyUpdatedAt: null,
    },
  });

  await setFlash("success", "Saved AI API key deleted.");
  redirectBack(formData);
}

export async function saveWorkspacePlan(formData: FormData) {
  const { workspaceId } = await getWorkspaceContext();
  const plan = parsePlan(formData.get("plan"));

  await db.workspaceSettings.upsert({
    where: { workspaceId },
    update: { plan },
    create: { workspaceId, plan },
  });

  await setFlash("success", `Workspace plan set to ${plan}.`);
  redirectBack(formData);
}

export async function addSource(formData: FormData) {
  const { workspaceId } = await getWorkspaceContext();
  const type = parseSourceType(formData.get("type"));
  const url = String(formData.get("url") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim() || null;
  if (!url) redirectBack(formData);

  try {
    await db.source.upsert({
      where: { workspaceId_type_url: { workspaceId, type, url } },
      update: { title, enabled: true },
      create: { workspaceId, type, url, title },
    });
    await setFlash("success", "Source added.");
  } catch (error: unknown) {
    await setFlash("error", errorMessage(error, "Failed to add source."));
  }
  redirectBack(formData);
}

export async function addRecommended(formData: FormData) {
  const { workspaceId } = await getWorkspaceContext();
  const type = parseSourceType(formData.get("type"));
  const url = String(formData.get("url") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim() || null;
  if (!url) redirectBack(formData);

  try {
    await db.source.upsert({
      where: { workspaceId_type_url: { workspaceId, type, url } },
      update: { title, enabled: true },
      create: { workspaceId, type, url, title },
    });
    await setFlash("success", `Added: ${title ?? url}`);
  } catch (error: unknown) {
    await setFlash("error", errorMessage(error, "Failed to add source."));
  }
  redirectBack(formData);
}

export async function ingestNow(formData: FormData) {
  const { workspaceId } = await getWorkspaceContext();
  const sourceId = String(formData.get("sourceId") ?? "");
  if (!sourceId) redirectBack(formData);
  if (!(await sourceBelongsToWorkspace(sourceId, workspaceId))) redirectBack(formData);

  try {
    const result = await ingestSourceWithHealth(sourceId, workspaceId);
    if (!result.title) redirectBack(formData);
    await setFlash("success", `Ingested ${result.count} items from ${result.title}.`);
  } catch (error: unknown) {
    await setFlash(
      "error",
      `Ingest failed: ${errorMessage(error, "unknown error")}`,
    );
  }
  redirectBack(formData);
}

export async function ingestAll(formData: FormData) {
  const { workspaceId } = await getWorkspaceContext();
  const result = await ingestAllEnabledSources(workspaceId);

  if (result.failures.length) {
    await setFlash(
      "error",
      `Refreshed ${result.successCount}/${result.sourceCount} sources (${result.totalItems} feed items seen). Failed: ${result.failures.slice(0, 2).join("; ")}`,
    );
  } else {
    await setFlash(
      "success",
      `Refreshed ${result.sourceCount} sources and saw ${result.totalItems} feed items.`,
    );
  }
  redirectBack(formData);
}

export async function runScheduledIngestIfDue() {
  const { workspaceId } = await getWorkspaceContext();
  const settings = await db.workspaceSettings.findUnique({ where: { workspaceId } });
  const enabled = settings?.autoIngestEnabled ?? true;
  const intervalMinutes = settings?.autoIngestIntervalMinutes ?? 360;
  if (!enabled) return { ran: false as const, reason: "disabled" };

  const last = settings?.lastScheduledIngestAt;
  const dueAt = last ? last.getTime() + intervalMinutes * 60_000 : 0;
  if (Date.now() < dueAt) {
    return { ran: false as const, reason: "not_due", nextAt: new Date(dueAt).toISOString() };
  }

  const result = await ingestAllEnabledSources(workspaceId);
  await db.workspaceSettings.upsert({
    where: { workspaceId },
    update: { lastScheduledIngestAt: new Date() },
    create: { workspaceId, lastScheduledIngestAt: new Date() },
  });

  return { ran: true as const, ...result };
}

export async function saveAutomationSettings(formData: FormData) {
  const { workspaceId } = await getWorkspaceContext();
  const autoIngestEnabled = formData.get("autoIngestEnabled") === "on";
  const intervalRaw = Number(formData.get("autoIngestIntervalMinutes") ?? 360);
  const autoIngestIntervalMinutes = Number.isFinite(intervalRaw)
    ? Math.min(24 * 60, Math.max(30, Math.round(intervalRaw)))
    : 360;
  const digestWebhookEnabled = formData.get("digestWebhookEnabled") === "on";
  const digestWebhookUrl = String(formData.get("digestWebhookUrl") ?? "").trim() || null;

  if (digestWebhookEnabled && digestWebhookUrl && !isValidUrl(digestWebhookUrl)) {
    await setFlash("error", "Webhook URL must be a valid https URL.");
    redirectBack(formData);
  }

  await db.workspaceSettings.upsert({
    where: { workspaceId },
    update: {
      autoIngestEnabled,
      autoIngestIntervalMinutes,
      digestWebhookEnabled,
      digestWebhookUrl,
    },
    create: {
      workspaceId,
      autoIngestEnabled,
      autoIngestIntervalMinutes,
      digestWebhookEnabled,
      digestWebhookUrl,
    },
  });

  await setFlash("success", "Automation settings saved.");
  redirectBack(formData);
}

export async function discoverFeedsAction(formData: FormData) {
  const siteUrl = String(formData.get("siteUrl") ?? "").trim();
  if (!siteUrl) redirectBack(formData);

  try {
    const feeds = await discoverFeeds(siteUrl);
    const cookieStore = await cookies();
    cookieStore.set("rr_discovered_feeds", JSON.stringify(feeds.slice(0, 8)), {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      maxAge: 120,
    });
    await setFlash("success", `Found ${feeds.length} feed${feeds.length === 1 ? "" : "s"}. Pick one below.`);
  } catch (error: unknown) {
    await setFlash("error", errorMessage(error, "Feed discovery failed."));
  }
  redirectBack(formData);
}

export async function applySourceUrlFix(formData: FormData) {
  const { workspaceId } = await getWorkspaceContext();
  const sourceId = String(formData.get("sourceId") ?? "");
  if (!sourceId) redirectBack(formData);

  const source = await db.source.findFirst({ where: { id: sourceId, workspaceId } });
  if (!source) redirectBack(formData);

  const nextUrl = getKnownFeedUrlFix(source.url);
  if (!nextUrl) {
    await setFlash("error", "No known URL fix for this source.");
    redirectBack(formData);
  }

  await db.source.update({
    where: { id: source.id },
    data: { url: nextUrl, lastRefreshError: null, healthStatus: "HEALTHY" },
  });

  try {
    const result = await ingestSourceWithHealth(source.id, workspaceId);
    await setFlash(
      "success",
      `URL updated and refreshed (${result.count} items from ${result.title ?? nextUrl}).`,
    );
  } catch (error: unknown) {
    await setFlash(
      "error",
      `URL updated but refresh failed: ${errorMessage(error, "unknown error")}`,
    );
  }
  redirectBack(formData);
}

export async function briefAllNew(formData: FormData) {
  const { workspaceId } = await getWorkspaceContext();
  const filters = parseItemListFilters(formData);
  const filterQs = String(formData.get("filterQs") ?? "").trim();

  try {
    const job = await createBriefAllJob(filters, filterQs, workspaceId);
    if (!job) {
      await setFlash("error", "No unbriefed items with text match your filters (max 25 per batch).");
      redirectBack(formData);
    }

    const cookieStore = await cookies();
    cookieStore.set("rr_brief_job", job.id, {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      maxAge: 600,
    });
    await setFlash(
      "success",
      `Queued ${job.total} item${job.total === 1 ? "" : "s"} for briefing. Progress will update on this page.`,
    );
  } catch (error: unknown) {
    await setFlash("error", errorMessage(error, "Could not start batch briefing."));
  }

  revalidatePath("/radar", "layout");
  redirect(`${filterQs ? `/radar?${filterQs}` : "/radar"}`);
}

export async function summarize(formData: FormData) {
  const { workspaceId } = await getWorkspaceContext();
  const itemId = String(formData.get("itemId") ?? "");
  if (!itemId) redirectBack(formData);
  if (!(await itemBelongsToWorkspace(itemId, workspaceId))) redirectBack(formData);

  const item = await db.item.findUnique({
    where: { id: itemId },
    include: { content: true },
  });
  const textFromItem = item?.content?.text ?? null;
  let textForSummary = textFromItem;

  if (isThinExtractedText(textForSummary)) {
    const fetchedText = await fetchArticleText(item?.url);
    if (fetchedText && item) {
      textForSummary = fetchedText;
      await db.itemContent.upsert({
        where: { itemId: item.id },
        update: { text: fetchedText },
        create: { itemId: item.id, text: fetchedText },
      });
    }
  }

  if (!item || !textForSummary || isThinExtractedText(textForSummary)) {
    await setFlash(
      "error",
      "No useful article text is available yet. The feed only provided a comment link, and the article could not be extracted.",
      itemId,
    );
    redirectBack(formData);
  }

  let result;
  try {
    result = await summarizeWithCitations({
      workspaceId,
      title: item.title,
      url: item.url,
      text: textForSummary,
    });
  } catch (error: unknown) {
    await setFlash("error", errorMessage(error, "AI summarization failed."), itemId);
    redirectBack(formData);
  }

  await db.itemSummary.upsert({
    where: { itemId: item.id },
    update: {
      model: result.model,
      summaryMd: result.summaryMd,
      citations: toJson(result.citations),
    },
    create: {
      itemId: item.id,
      model: result.model,
      summaryMd: result.summaryMd,
      citations: toJson(result.citations),
    },
  });
  await setFlash("success", "Summary generated.", itemId);
  redirectBack(formData);
}

export async function summarizeDiscussion(formData: FormData) {
  const { workspaceId } = await getWorkspaceContext();
  const itemId = String(formData.get("itemId") ?? "");
  if (!itemId) redirectBack(formData);
  if (!(await itemBelongsToWorkspace(itemId, workspaceId))) redirectBack(formData);

  const item = await db.item.findUnique({ where: { id: itemId } });
  if (!item) redirectBack(formData);

  const discussionText = await fetchHackerNewsDiscussionText(item.raw);
  if (!discussionText) {
    await setFlash(
      "error",
      "No analyzable discussion thread was found for this item yet.",
      itemId,
    );
    redirectBack(formData);
  }

  let result;
  try {
    result = await summarizeWithCitations({
      workspaceId,
      title: `Community pulse: ${item.title}`,
      url: item.url,
      text: discussionText,
      mode: "discussion",
    });
  } catch (error: unknown) {
    await setFlash("error", errorMessage(error, "Discussion analysis failed."), itemId);
    redirectBack(formData);
  }

  await db.itemSummary.upsert({
    where: { itemId: item.id },
    update: {
      model: result.model,
      summaryMd: result.summaryMd,
      citations: toJson(result.citations),
    },
    create: {
      itemId: item.id,
      model: result.model,
      summaryMd: result.summaryMd,
      citations: toJson(result.citations),
    },
  });
  await setFlash("success", "Discussion pulse generated.", itemId);
  redirectBack(formData);
}

export async function summarizeSmartPulse(formData: FormData) {
  const { workspaceId } = await getWorkspaceContext();
  const itemId = String(formData.get("itemId") ?? "");
  if (!itemId) redirectBack(formData);
  if (!(await itemBelongsToWorkspace(itemId, workspaceId))) redirectBack(formData);

  const item = await db.item.findUnique({
    where: { id: itemId },
    include: { content: true },
  });
  if (!item) redirectBack(formData);

  let articleText = item.content?.text ?? null;
  if (isThinExtractedText(articleText)) {
    const fetchedText = await fetchArticleText(item.url);
    if (fetchedText) {
      articleText = fetchedText;
      await db.itemContent.upsert({
        where: { itemId: item.id },
        update: { text: fetchedText },
        create: { itemId: item.id, text: fetchedText },
      });
    }
  }

  const discussionText = await fetchHackerNewsDiscussionText(item.raw);
  const sections = [
    articleText && !isThinExtractedText(articleText)
      ? `ARTICLE TEXT\n${articleText}`
      : null,
    discussionText ? `COMMUNITY DISCUSSION\n${discussionText}` : null,
  ].filter(Boolean);

  if (sections.length === 0) {
    await setFlash(
      "error",
      "No article or discussion text is available for a smart pulse yet.",
      itemId,
    );
    redirectBack(formData);
  }

  let result;
  try {
    result = await summarizeWithCitations({
      workspaceId,
      title: `Smart pulse: ${item.title}`,
      url: item.url,
      text: sections.join("\n\n---\n\n"),
      mode: "hybrid",
    });
  } catch (error: unknown) {
    await setFlash("error", errorMessage(error, "Smart pulse failed."), itemId);
    redirectBack(formData);
  }

  await db.itemSummary.upsert({
    where: { itemId: item.id },
    update: {
      model: result.model,
      summaryMd: result.summaryMd,
      citations: toJson(result.citations),
    },
    create: {
      itemId: item.id,
      model: result.model,
      summaryMd: result.summaryMd,
      citations: toJson(result.citations),
    },
  });
  await setFlash("success", "Smart pulse generated.", itemId);
  redirectBack(formData);
}

export async function generateDigest(formData: FormData) {
  const { workspaceId } = await getWorkspaceContext();
  const watch = String(formData.get("watch") ?? "").trim();
  const watchTerms = watch
    .split(",")
    .map((term) => term.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 8);

  const [items, sources] = await Promise.all([
    db.item.findMany({
      where: { source: { workspaceId } },
      orderBy: [{ publishedAt: "desc" }, { fetchedAt: "desc" }],
      take: 40,
      include: { source: true, content: true, summary: true },
    }),
    db.source.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { items: true } } },
    }),
  ]);

  const clusters = buildStoryClusters(items, watchTerms);
  const scored = items
    .map((item) => ({ item, signal: getSignalProfile(item, watchTerms) }))
    .sort((a, b) => b.signal.score - a.signal.score)
    .slice(0, 12);
  const watchHits = scored.filter(({ signal }) => signal.reasons.some((reason) => reason.startsWith("watch:")));
  const papers = items.filter((item) => item.source.type === SourceType.ARXIV).slice(0, 8);
  const failingSources = sources.filter(
    (source) => source.healthStatus === "FAILING" || source.lastRefreshError,
  );

  const digestInput = [
    `Generated at: ${new Date().toISOString()}`,
    watchTerms.length ? `Watchlist: ${watchTerms.join(", ")}` : "Watchlist: none configured",
    "",
    "TOP SCORED ITEMS:",
    ...scored.map(
      ({ item, signal }, index) =>
        `${index + 1}. ${item.title} | score=${signal.score} ${signal.label} | source=${item.source.title ?? item.source.url} | reasons=${signal.reasons.join(", ")} | summary=${item.summary?.summaryMd?.slice(0, 900) ?? item.content?.text?.slice(0, 500) ?? "No summary yet"}`,
    ),
    "",
    "STORY CLUSTERS:",
    ...clusters.map(
      (cluster) =>
        `${cluster.emoji} ${cluster.label}: ${cluster.count} items, score ${cluster.score}, sources ${cluster.sourceTypes.join("+")}`,
    ),
    "",
    "WATCHLIST HITS:",
    ...(watchHits.length
      ? watchHits.map(({ item, signal }) => `${item.title} | ${signal.reasons.join(", ")}`)
      : ["No explicit watchlist hits."]),
    "",
    "PAPERS AND RESEARCH:",
    ...(papers.length
      ? papers.map((item) => `${item.title} | ${item.source.title ?? item.source.url}`)
      : ["No recent papers in this slice."]),
    "",
    "SOURCE HEALTH:",
    ...sources.map(
      (source) =>
        `${source.title ?? source.url}: ${source.healthStatus}, stored=${source._count.items}, lastSeen=${source.lastItemCount}, lastSuccess=${source.lastSuccessAt?.toISOString() ?? "never"}, error=${source.lastRefreshError ?? "none"}`,
    ),
    "",
    failingSources.length
      ? `FAILING SOURCES: ${failingSources.map((source) => source.title ?? source.url).join(", ")}`
      : "FAILING SOURCES: none",
  ].join("\n");

  let result;
  try {
    result = await summarizeWithCitations({
      workspaceId,
      title: "Daily intelligence digest",
      text: digestInput,
      mode: "digest",
    });
  } catch (error: unknown) {
    await setFlash("error", errorMessage(error, "Digest generation failed."));
    redirectBack(formData);
  }

  const digestTitle = watchTerms.length
    ? `Watchlist digest: ${watchTerms.join(", ")}`
    : "Daily intelligence digest";

  await db.intelligenceDigest.create({
    data: {
      workspaceId,
      kind: watchTerms.length ? "watchlist" : "daily",
      title: digestTitle,
      model: result.model,
      digestMd: result.summaryMd,
      stats: toJson({
        itemCount: items.length,
        sourceCount: sources.length,
        clusterCount: clusters.length,
        watchTerms,
        failingSourceCount: failingSources.length,
      }),
    },
  });

  const workspace = await db.workspaceSettings.findUnique({ where: { workspaceId } });
  if (workspace?.digestWebhookEnabled && workspace.digestWebhookUrl) {
    try {
      await sendDigestWebhook({
        url: workspace.digestWebhookUrl,
        title: digestTitle,
        digestMd: result.summaryMd,
        stats: {
          itemCount: items.length,
          sourceCount: sources.length,
          clusterCount: clusters.length,
          watchTerms,
        },
      });
      await setFlash("success", "Digest generated and sent to webhook.");
    } catch (error: unknown) {
      await setFlash(
        "error",
        `Digest saved locally, but webhook failed: ${errorMessage(error, "unknown error")}`,
      );
      redirectBack(formData);
    }
  } else {
    await setFlash("success", "Digest generated.");
  }
  redirectBack(formData);
}
