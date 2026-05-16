import { cookies } from "next/headers";
import Link from "next/link";
import { AiProvider, SubscriptionPlan, type SourceType } from "@prisma/client";
import { db } from "@/lib/db";
import { AI_PROVIDER_PRESETS, getAiProviderPreset } from "@/lib/ai-providers";
import { isPlaceholderSummary } from "@/lib/article-extract";
import { getDiscussionUrl } from "@/lib/discussion";
import { ActionSubmitButton } from "@/components/action-submit-button";
import { AutoRefreshFeeds } from "@/components/auto-refresh-feeds";
import { AiProviderSettingsForm } from "@/components/ai-provider-settings-form";
import { BriefAllRunner } from "@/components/brief-all-runner";
import { BriefingCitations } from "@/components/briefing-citations";
import { CopyButton } from "@/components/copy-button";
import { FlashBanner, InlineFlash, type Flash } from "@/components/flash-banner";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { ScheduledIngestPoller } from "@/components/scheduled-ingest-poller";
import { getKnownFeedUrlFix } from "@/lib/feed-url-fixes";
import {
  buildItemWhere,
  filtersToSearchString,
  hasActiveFilters,
  sourceDisplayName,
  type ItemListFilters,
} from "@/lib/item-filters";
import {
  buildStoryClusters,
  getSignalProfile,
  parseWatchTerms,
  type SignalProfile,
  type StoryCluster,
} from "@/lib/intelligence";
import {
  addRecommended,
  addSource,
  applySourceUrlFix,
  briefAllNew,
  deleteAiApiKey,
  discoverFeedsAction,
  ingestAll,
  ingestNow,
  generateDigest,
  saveAutomationSettings,
  saveAiSettings,
  saveWorkspacePlan,
  summarize,
  summarizeDiscussion,
  summarizeSmartPulse,
} from "../actions";
import { signOut } from "@/app/auth/actions";
import { getWorkspaceContext } from "@/lib/auth";
import { itemsInWorkspaceWhere } from "@/lib/workspace";

const RECOMMENDED_SOURCES: Array<{
  type: "RSS" | "ARXIV";
  title: string;
  url: string;
  tier: string;
}> = [
  { type: "RSS", title: "Hacker News", url: "https://news.ycombinator.com/rss", tier: "Signal" },
  {
    type: "RSS",
    title: "Reddit r/MachineLearning",
    url: "https://www.reddit.com/r/MachineLearning/.rss",
    tier: "Community",
  },
  { type: "RSS", title: "OpenAI News", url: "https://openai.com/news/rss.xml", tier: "Vendor" },
  {
    type: "RSS",
    title: "Google AI Blog",
    url: "https://ai.googleblog.com/feeds/posts/default",
    tier: "Research",
  },
  {
    type: "RSS",
    title: "DeepMind Blog",
    url: "https://deepmind.google/blog/rss.xml",
    tier: "Research",
  },
  {
    type: "RSS",
    title: "AWS Machine Learning Blog",
    url: "https://aws.amazon.com/blogs/machine-learning/feed/",
    tier: "Platform",
  },
  {
    type: "ARXIV",
    title: "arXiv cs.AI",
    url: "http://export.arxiv.org/api/query?search_query=cat:cs.AI&start=0&max_results=25",
    tier: "Papers",
  },
  {
    type: "ARXIV",
    title: "arXiv cs.LG",
    url: "http://export.arxiv.org/api/query?search_query=cat:cs.LG&start=0&max_results=25",
    tier: "Papers",
  },
  {
    type: "ARXIV",
    title: "arXiv stat.ML",
    url: "http://export.arxiv.org/api/query?search_query=cat:stat.ML&start=0&max_results=25",
    tier: "Papers",
  },
];

type PortalView = "overview" | "sources" | "briefings" | "digest" | "settings";
type Citation = { quote?: unknown };

function parseListFilters(sp: Record<string, string | string[] | undefined>): ItemListFilters {
  const q = typeof sp.q === "string" ? sp.q : "";
  const watch = typeof sp.watch === "string" ? sp.watch : "";
  const sourceId = typeof sp.source === "string" ? sp.source : "";
  const t = typeof sp.type === "string" ? sp.type : "";
  const type: "" | SourceType = t === "RSS" || t === "ARXIV" ? t : "";
  const s = typeof sp.summarized === "string" ? sp.summarized : "all";
  const summarized = s === "yes" || s === "no" ? s : "all";
  return { q, watch, sourceId, type, summarized };
}

function parseView(sp: Record<string, string | string[] | undefined>): PortalView {
  const view = typeof sp.view === "string" ? sp.view : "overview";
  if (view === "sources" || view === "briefings" || view === "digest" || view === "settings") return view;
  return "overview";
}

function formatDate(date: Date | string | null | undefined) {
  if (!date) return "No activity yet";
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function latestOfDates(...dates: Array<Date | string | null | undefined>) {
  return dates
    .filter(Boolean)
    .map((date) => new Date(date as Date | string))
    .filter((date) => Number.isFinite(date.getTime()))
    .sort((a, b) => b.getTime() - a.getTime())[0];
}

function isStale(date: Date | string | null | undefined, minutes: number) {
  if (!date) return true;
  const parsed = new Date(date);
  if (!Number.isFinite(parsed.getTime())) return true;
  return Date.now() - parsed.getTime() > minutes * 60_000;
}

function percent(part: number, total: number) {
  if (total === 0) return 0;
  return Math.round((part / total) * 100);
}

function viewSearch(view: PortalView, filters?: ItemListFilters) {
  const p = new URLSearchParams(filters ? filtersToSearchString(filters) : "");
  p.set("view", view);
  return p.toString();
}

function providerAllowsEmptyKey(provider: AiProvider) {
  return provider === AiProvider.OLLAMA || provider === AiProvider.LM_STUDIO;
}

function sourceHealth(source: {
  healthStatus: string;
  lastSuccessAt: Date | string | null;
  lastRefreshAt: Date | string | null;
  lastRefreshError: string | null;
  _count?: { items: number };
}) {
  if (source.healthStatus === "FAILING" || source.lastRefreshError) {
    return {
      label: "Failing",
      icon: "⚠️",
      className: "bg-rose-50 text-rose-700",
      detail: source.lastRefreshError ?? "Last refresh failed.",
    };
  }
  if (source.healthStatus === "EMPTY" || source._count?.items === 0) {
    return {
      label: "No items",
      icon: "🫥",
      className: "bg-amber-50 text-amber-700",
      detail: "Refresh works, but no feed items are stored yet.",
    };
  }
  if (isStale(source.lastSuccessAt ?? source.lastRefreshAt, 60 * 12)) {
    return {
      label: "Stale",
      icon: "⏱️",
      className: "bg-amber-50 text-amber-700",
      detail: "No successful refresh in the last 12 hours.",
    };
  }
  return {
    label: "Healthy",
    icon: "✅",
    className: "bg-emerald-50 text-emerald-700",
    detail: "Refreshing successfully.",
  };
}

export default async function RadarPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const filters = parseListFilters(sp);
  const view = parseView(sp);

  const cookieStore = await cookies();
  const flashRaw = cookieStore.get("rr_flash")?.value ?? null;
  let flash: Flash | null = null;
  try {
    flash = flashRaw ? JSON.parse(flashRaw) : null;
  } catch {
    flash = null;
  }

  const { workspaceId, email } = await getWorkspaceContext();

  const sources = await db.source.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { items: true } } },
  });
  const settings = await db.workspaceSettings.findUnique({ where: { workspaceId } });
  const workspaceScope = itemsInWorkspaceWhere(workspaceId);
  const itemsCount = await db.item.count({ where: workspaceScope });
  const summarizedCount = await db.item.count({
    where: { AND: [workspaceScope, { summary: { isNot: null } }] },
  });
  const contentCount = await db.item.count({
    where: { AND: [workspaceScope, { content: { isNot: null } }] },
  });
  const latestItem = await db.item.findFirst({
    where: workspaceScope,
    orderBy: { fetchedAt: "desc" },
    select: { publishedAt: true, fetchedAt: true },
  });
  const latestDigest = await db.intelligenceDigest.findFirst({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
  });
  const filterWhere = buildItemWhere(filters);
  const itemWhere =
    Object.keys(filterWhere).length === 0
      ? workspaceScope
      : { AND: [filterWhere, workspaceScope] };
  const filteredCount = await db.item.count({ where: itemWhere });
  const take = hasActiveFilters(filters) ? 100 : 30;
  const items = await db.item.findMany({
    where: itemWhere,
    orderBy: [{ publishedAt: "desc" }, { fetchedAt: "desc" }],
    take,
    include: { source: true, content: true, summary: true },
  });

  const rssCount = sources.filter((source) => source.type === "RSS").length;
  const arxivCount = sources.filter((source) => source.type === "ARXIV").length;
  const summaryCoverage = percent(summarizedCount, itemsCount);
  const extractionCoverage = percent(contentCount, itemsCount);
  const unsummarizedCount = Math.max(0, itemsCount - summarizedCount);
  const latestActivity = formatDate(latestOfDates(latestItem?.fetchedAt, latestItem?.publishedAt));
  const plan = settings?.plan ?? SubscriptionPlan.STARTER;
  const byokUnlocked = plan !== SubscriptionPlan.STARTER;
  const selectedProvider = settings?.aiProvider ?? AiProvider.OPENAI;
  const providerPreset = getAiProviderPreset(selectedProvider);
  const hasAiKey = Boolean(settings?.aiApiKeyCiphertext);
  const providerConfigured =
    byokUnlocked && (hasAiKey || providerAllowsEmptyKey(selectedProvider));
  const hiddenState = viewSearch(view, filters);
  const latestFetchedAt = latestItem?.fetchedAt ?? null;
  const watchTerms = parseWatchTerms(filters.watch);
  const storyClusters = buildStoryClusters(items, watchTerms);
  const autoIngestEnabled = settings?.autoIngestEnabled ?? true;
  const autoIngestIntervalMinutes = settings?.autoIngestIntervalMinutes ?? 360;
  const briefJobId = cookieStore.get("rr_brief_job")?.value ?? null;
  let discoveredFeeds: Array<{ url: string; title: string }> = [];
  try {
    const raw = cookieStore.get("rr_discovered_feeds")?.value;
    if (raw) discoveredFeeds = JSON.parse(raw);
  } catch {
    discoveredFeeds = [];
  }
  const failingSources = sources.filter(
    (source) => source.healthStatus === "FAILING" || source.lastRefreshError,
  );
  const exportQs = `${filtersToSearchString(filters)}&view=briefings`;

  return (
    <main className="min-h-dvh bg-[#f5f7fb] text-slate-950">
      <ScheduledIngestPoller
        enabled={autoIngestEnabled}
        intervalMinutes={autoIngestIntervalMinutes}
      />
      <div className="mx-auto flex w-full max-w-[1600px] flex-col lg:min-h-dvh lg:flex-row">
        <aside className="bg-slate-950 px-4 py-4 text-white lg:sticky lg:top-0 lg:h-dvh lg:w-72 lg:shrink-0 lg:px-5">
          <div className="flex items-center justify-between gap-4">
            <Link href="/" className="flex min-w-0 items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-300 text-sm font-black text-slate-950">
                RR
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">Research Radar</span>
                <span className="block truncate text-xs text-slate-400">
                  Intelligence workspace
                </span>
              </span>
            </Link>
            <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2.5 py-1 text-[10px] font-bold text-emerald-200">
              {plan}
            </span>
          </div>

          {email ? (
            <div className="mt-4 hidden rounded-xl border border-white/10 bg-white/5 px-3 py-2 lg:block">
              <div className="truncate text-[11px] font-semibold text-slate-200">{email}</div>
              <form action={signOut} className="mt-2">
                <button
                  type="submit"
                  className="text-[11px] font-bold text-emerald-300 hover:text-emerald-200"
                >
                  Sign out
                </button>
              </form>
            </div>
          ) : null}

          <nav className="mt-5 grid grid-cols-5 gap-2 lg:grid-cols-1">
            {[
              ["overview", "Overview"],
              ["sources", "Sources"],
              ["briefings", "Briefings"],
              ["digest", "Digest"],
              ["settings", "Settings"],
            ].map(([id, label]) => (
              <Link
                key={id}
                href={`/radar?${viewSearch(id as PortalView, filters)}`}
                className={[
                  "rounded-xl px-3 py-2.5 text-center text-xs font-semibold transition lg:text-left",
                  view === id
                    ? "bg-white text-slate-950"
                    : "text-slate-300 hover:bg-white/10 hover:text-white",
                ].join(" ")}
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="mt-5 hidden rounded-2xl border border-white/10 bg-white/5 p-4 lg:block">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-slate-200">AI provider</div>
              <span
                className={[
                  "rounded-full px-2 py-0.5 text-[10px] font-bold",
                  providerConfigured
                    ? "bg-emerald-300/15 text-emerald-200"
                    : "bg-amber-300/15 text-amber-100",
                ].join(" ")}
              >
                {providerConfigured ? "Ready" : "Needs setup"}
              </span>
            </div>
            <div className="mt-3 text-sm font-semibold">{providerPreset.label}</div>
            <div className="mt-1 truncate text-xs text-slate-400">
              {settings?.aiModel || providerPreset.defaultModel || "Model not selected"}
            </div>
            <Link
              href={`/radar?${viewSearch("settings", filters)}`}
              className="mt-4 inline-flex h-9 w-full items-center justify-center rounded-lg bg-white text-xs font-bold text-slate-950 hover:bg-slate-100"
            >
              Manage settings
            </Link>
          </div>

          <div className="mt-4 hidden rounded-2xl border border-white/10 bg-white/5 p-4 lg:block">
            <div className="text-xs font-semibold text-slate-200">Coverage</div>
            <Progress label="Extracted text" value={extractionCoverage} color="bg-emerald-300" />
            <Progress label="Summarized" value={summaryCoverage} color="bg-cyan-300" />
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="border-b border-slate-200 bg-white/90 px-4 py-4 backdrop-blur sm:px-6">
            <FlashBanner flash={flash} />
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="text-xs font-bold uppercase text-emerald-700">
                  AI research operations
                </div>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                  {view === "overview"
                    ? "Signal command center"
                    : view === "sources"
                      ? "Source operations"
                      : view === "briefings"
                        ? "Intelligence briefings"
                        : view === "digest"
                          ? "Daily digest"
                          : "Workspace settings"}
                </h1>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                  {view === "settings"
                    ? "Manage plan controls, AI provider keys, model routing, and workspace configuration."
                    : "Track RSS and arXiv sources, ingest fresh intelligence, and turn source text into cited briefings."}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 xl:w-[600px]">
                <Metric label="Sources" value={sources.length} detail={`${rssCount} RSS / ${arxivCount} arXiv`} />
                <Metric label="Items" value={itemsCount} detail={`${contentCount} with text`} />
                <Metric label="Briefed" value={`${summaryCoverage}%`} detail={`${summarizedCount} cached`} />
                <Metric label="Latest" value={latestActivity} detail={`${unsummarizedCount} pending`} />
              </div>
            </div>
          </header>

          <div className="px-4 py-5 sm:px-6 lg:py-6">
            {view === "overview" ? (
              <OverviewView
                sources={sources}
                items={items.slice(0, 6)}
                providerConfigured={providerConfigured}
                providerLabel={providerPreset.label}
                providerModel={settings?.aiModel || providerPreset.defaultModel}
                summaryCoverage={summaryCoverage}
                extractionCoverage={extractionCoverage}
                filterState={hiddenState}
              />
            ) : null}

            {view === "sources" ? (
              <SourcesView
                sources={sources}
                failingSources={failingSources}
                discoveredFeeds={discoveredFeeds}
                filterState={hiddenState}
                addSource={addSource}
                addRecommended={addRecommended}
                ingestNow={ingestNow}
                discoverFeedsAction={discoverFeedsAction}
                applySourceUrlFix={applySourceUrlFix}
              />
            ) : null}

            {view === "briefings" ? (
              <BriefingsView
                filters={filters}
                sources={sources}
                items={items}
                filteredCount={filteredCount}
                itemsCount={itemsCount}
                filterState={hiddenState}
                exportQs={exportQs}
                briefJobId={briefJobId}
                summarize={summarize}
                summarizeDiscussion={summarizeDiscussion}
                summarizeSmartPulse={summarizeSmartPulse}
                ingestAll={ingestAll}
                briefAllNew={briefAllNew}
                flash={flash}
                watchTerms={watchTerms}
                storyClusters={storyClusters}
                autoRefreshEnabled={isStale(latestFetchedAt, 30)}
              />
            ) : null}

            {view === "digest" ? (
              <DigestView
                latestDigest={latestDigest}
                filters={filters}
                filterState={hiddenState}
                generateDigest={generateDigest}
                storyClusters={storyClusters}
                sources={sources}
                items={items}
              />
            ) : null}

            {view === "settings" ? (
              <SettingsView
                plan={plan}
                byokUnlocked={byokUnlocked}
                settings={settings}
                selectedProvider={selectedProvider}
                providerPreset={providerPreset}
                hasAiKey={hasAiKey}
                providerConfigured={providerConfigured}
                filterState={hiddenState}
                saveAiSettings={saveAiSettings}
                saveWorkspacePlan={saveWorkspacePlan}
                saveAutomationSettings={saveAutomationSettings}
                deleteAiApiKey={deleteAiApiKey}
              />
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}

function OverviewView(props: {
  sources: Array<{ id: string; title: string | null; url: string; type: SourceType }>;
  items: Array<{
    id: string;
    title: string;
    publishedAt: Date | null;
    fetchedAt: Date;
    source: { title: string | null; url: string; type: SourceType };
    summary: { id: string } | null;
  }>;
  providerConfigured: boolean;
  providerLabel: string;
  providerModel: string | null;
  summaryCoverage: number;
  extractionCoverage: number;
  filterState: string;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-950">Operations snapshot</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              The shortest path from raw source updates to cited internal briefings.
            </p>
          </div>
          <Link
            href="/radar?view=briefings"
            className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-bold text-white hover:bg-slate-800"
          >
            Review briefings
          </Link>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <StatusCard title="Provider" value={props.providerLabel} detail={props.providerConfigured ? "Ready for AI briefings" : "Needs setup"} tone={props.providerConfigured ? "good" : "warn"} />
          <StatusCard title="Summary coverage" value={`${props.summaryCoverage}%`} detail="Cached item briefings" tone="neutral" />
          <StatusCard title="Extraction coverage" value={`${props.extractionCoverage}%`} detail="Items with usable text" tone="neutral" />
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-bold uppercase text-slate-500">Next actions</div>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            <ActionLink href="/radar?view=sources" title="Ingest sources" copy="Refresh important channels." />
            <ActionLink href="/radar?view=settings" title="Manage AI" copy="Rotate or remove provider keys." />
            <ActionLink href={`/radar?${props.filterState}&view=briefings&summarized=no`} title="Brief pending" copy="Summarize unsolved items." />
          </div>
        </div>
      </section>

      <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-sm font-bold text-slate-950">Recent intelligence</h2>
        <div className="mt-4 grid gap-3">
          {props.items.length ? (
            props.items.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                    {item.source.type}
                  </span>
                  <span
                    className={[
                      "rounded-full px-2 py-0.5 text-[10px] font-bold",
                      item.summary ? "bg-cyan-50 text-cyan-700" : "bg-amber-50 text-amber-700",
                    ].join(" ")}
                  >
                    {item.summary ? "Briefed" : "Needs brief"}
                  </span>
                </div>
                <div className="mt-2 line-clamp-2 text-sm font-semibold leading-5">
                  {item.title}
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  {sourceDisplayName(item.source)} · {formatDate(item.publishedAt ?? item.fetchedAt)}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
              Ingest a source to populate recent intelligence.
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function SourcesView(props: {
  sources: Array<{
    id: string;
    type: SourceType;
    title: string | null;
    url: string;
    lastRefreshAt: Date | null;
    lastSuccessAt: Date | null;
    lastRefreshError: string | null;
    lastItemCount: number;
    healthStatus: string;
    _count: { items: number };
  }>;
  filterState: string;
  addSource: (formData: FormData) => Promise<void>;
  addRecommended: (formData: FormData) => Promise<void>;
  ingestNow: (formData: FormData) => Promise<void>;
  discoverFeedsAction: (formData: FormData) => Promise<void>;
  applySourceUrlFix: (formData: FormData) => Promise<void>;
  failingSources: Array<{
    id: string;
    title: string | null;
    url: string;
    lastRefreshError: string | null;
  }>;
  discoveredFeeds: Array<{ url: string; title: string }>;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[390px_minmax(0,1fr)]">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-sm font-bold">Add source</h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Add RSS feeds or arXiv API URLs, then ingest each channel on demand.
        </p>
        <form action={props.addSource} className="mt-4 grid gap-3">
          <input type="hidden" name="filterQs" value={props.filterState} />
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1.5">
              <FieldLabel>Type</FieldLabel>
              <select name="type" className={inputClass()} defaultValue="RSS">
                <option value="RSS">RSS</option>
                <option value="ARXIV">arXiv</option>
              </select>
            </label>
            <label className="grid gap-1.5 sm:col-span-2">
              <FieldLabel>Display name</FieldLabel>
              <input name="title" placeholder="Optional" className={inputClass()} />
            </label>
          </div>
          <label className="grid gap-1.5">
            <FieldLabel>Feed URL</FieldLabel>
            <input
              name="url"
              placeholder="https://example.com/feed.xml"
              className={inputClass()}
              required
            />
          </label>
          <button className="h-10 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white hover:bg-slate-800">
            Add source
          </button>
        </form>

        <FeedDiscoveryPanel
          filterState={props.filterState}
          discoveredFeeds={props.discoveredFeeds}
          discoverFeedsAction={props.discoverFeedsAction}
          addSource={props.addSource}
        />

        <div className="mt-5 border-t border-slate-100 pt-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xs font-bold uppercase text-slate-500">Recommended</h3>
            <span className="text-[11px] text-slate-400">One click setup</span>
          </div>
          <div className="mt-3 grid max-h-[420px] gap-2 overflow-y-auto pr-1">
            {RECOMMENDED_SOURCES.map((source) => (
              <form key={`${source.type}:${source.url}`} action={props.addRecommended}>
                <input type="hidden" name="filterQs" value={props.filterState} />
                <input type="hidden" name="type" value={source.type} />
                <input type="hidden" name="url" value={source.url} />
                <input type="hidden" name="title" value={source.title} />
                <button className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left transition hover:border-emerald-300 hover:bg-emerald-50">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-xs font-bold text-slate-900">{source.title}</span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500">
                      {source.tier}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-[11px] text-slate-500">{source.url}</div>
                </button>
              </form>
            ))}
          </div>
        </div>
      </section>

      {props.failingSources.length ? (
        <SourceHealthDashboard
          failingSources={props.failingSources}
          filterState={props.filterState}
          applySourceUrlFix={props.applySourceUrlFix}
        />
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold">Connected sources</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Each source refreshes independently and dedupes by feed ID.
            </p>
          </div>
          <span className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-bold text-slate-500">
            {props.sources.length} active
          </span>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {props.sources.length ? (
            props.sources.map((source) => {
              const health = sourceHealth(source);
              return (
              <div key={source.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                    {source.type}
                  </span>
                  <span
                    className={[
                      "rounded-full px-2 py-0.5 text-[10px] font-black",
                      health.className,
                    ].join(" ")}
                  >
                    {health.icon} {health.label}
                  </span>
                  <span className="break-words text-sm font-bold">
                    {source.title ?? "(untitled)"}
                  </span>
                </div>
                <div className="mt-1 break-all text-xs leading-5 text-slate-500">{source.url}</div>
                <div className="mt-3 grid gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="font-bold uppercase text-slate-400">Last success</div>
                      <div className="mt-0.5 font-semibold">
                        {source.lastSuccessAt ? formatDate(source.lastSuccessAt) : "Never"}
                      </div>
                    </div>
                    <div>
                      <div className="font-bold uppercase text-slate-400">Items</div>
                      <div className="mt-0.5 font-semibold">
                        {source._count.items} stored / {source.lastItemCount} seen
                      </div>
                    </div>
                  </div>
                  <div className="text-[11px] leading-5 text-slate-500">
                    {health.detail}
                  </div>
                </div>
                {getKnownFeedUrlFix(source.url) ? (
                  <form action={props.applySourceUrlFix} className="mt-2">
                    <input type="hidden" name="filterQs" value={props.filterState} />
                    <input type="hidden" name="sourceId" value={source.id} />
                    <ActionSubmitButton
                      pendingLabel="Fixing..."
                      className="h-9 w-full rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-bold text-amber-900 hover:bg-amber-100 disabled:cursor-wait"
                    >
                      Apply known URL fix
                    </ActionSubmitButton>
                  </form>
                ) : null}
                <form action={props.ingestNow} className="mt-3">
                  <input type="hidden" name="filterQs" value={props.filterState} />
                  <input type="hidden" name="sourceId" value={source.id} />
                  <ActionSubmitButton
                    pendingLabel="Checking..."
                    className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-bold hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-wait disabled:bg-slate-100"
                  >
                    Ingest now
                  </ActionSubmitButton>
                </form>
              </div>
              );
            })
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500 lg:col-span-2">
              Start with Hacker News and arXiv cs.LG to test the full workflow.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function BriefingsView(props: {
  filters: ItemListFilters;
  sources: Array<{ id: string; title: string | null; url: string; type: SourceType }>;
  items: Array<{
    id: string;
    title: string;
    author: string | null;
    url: string | null;
    sourceId: string;
    publishedAt: Date | null;
    fetchedAt: Date;
    source: { title: string | null; url: string; type: SourceType };
    raw: unknown;
    content: { text: string } | null;
    summary: { model: string; summaryMd: string; citations: unknown } | null;
  }>;
  filteredCount: number;
  itemsCount: number;
  filterState: string;
  summarize: (formData: FormData) => Promise<void>;
  summarizeDiscussion: (formData: FormData) => Promise<void>;
  summarizeSmartPulse: (formData: FormData) => Promise<void>;
  ingestAll: (formData: FormData) => Promise<void>;
  briefAllNew: (formData: FormData) => Promise<void>;
  exportQs: string;
  briefJobId: string | null;
  flash: Flash | null;
  watchTerms: string[];
  storyClusters: StoryCluster[];
  autoRefreshEnabled: boolean;
}) {
  const f = props.filters;
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <BriefAllRunner jobId={props.briefJobId} />
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-bold">Intelligence inbox</h2>
            <AutoRefreshFeeds
              enabled={props.autoRefreshEnabled}
              filterState={props.filterState}
              ingestAll={props.ingestAll}
            />
            <form action={props.ingestAll}>
              <input type="hidden" name="filterQs" value={props.filterState} />
              <ActionSubmitButton
                pendingLabel="Refreshing..."
                className="h-8 rounded-lg bg-emerald-500 px-3 text-xs font-black text-white hover:bg-emerald-600 disabled:cursor-wait disabled:bg-emerald-400"
              >
                🔄 Refresh feeds
              </ActionSubmitButton>
            </form>
            <form action={props.briefAllNew}>
              <input type="hidden" name="filterQs" value={props.filterState} />
              <input type="hidden" name="q" value={f.q} />
              <input type="hidden" name="watch" value={f.watch} />
              <input type="hidden" name="sourceId" value={f.sourceId} />
              <input type="hidden" name="type" value={f.type} />
              <input type="hidden" name="summarized" value={f.summarized} />
              <ActionSubmitButton
                pendingLabel="Queuing..."
                className="h-8 rounded-lg bg-cyan-600 px-3 text-xs font-black text-white hover:bg-cyan-700 disabled:cursor-wait"
              >
                ⚡ Brief all new
              </ActionSubmitButton>
            </form>
            <a
              href={`/api/export/briefings?${props.exportQs}&format=md`}
              className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              Export .md
            </a>
            <a
              href={`/api/export/briefings?${props.exportQs}&format=html`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              Export PDF
            </a>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {hasActiveFilters(f)
              ? `Showing ${props.items.length} of ${props.filteredCount} matching items from ${props.itemsCount} total records.`
              : `Showing the ${props.items.length} newest records with summaries inline.`}
          </p>
        </div>
        <form method="get" action="/radar" className="grid gap-2 sm:grid-cols-2 xl:w-[980px] xl:grid-cols-6">
          <input type="hidden" name="view" value="briefings" />
          <input name="q" defaultValue={f.q} placeholder="Search title, body, briefs" className={`${inputClass()} sm:col-span-2 xl:col-span-1`} />
          <input name="watch" defaultValue={f.watch} placeholder="Watch: auth, agents" className={`${inputClass()} sm:col-span-2 xl:col-span-1`} />
          <select name="source" defaultValue={f.sourceId} className={inputClass()}>
            <option value="">All sources</option>
            {props.sources.map((source) => (
              <option key={source.id} value={source.id}>
                {sourceDisplayName(source)} ({source.type})
              </option>
            ))}
          </select>
          <select name="type" defaultValue={f.type} className={inputClass()}>
            <option value="">All types</option>
            <option value="RSS">RSS</option>
            <option value="ARXIV">arXiv</option>
          </select>
          <select name="summarized" defaultValue={f.summarized} className={inputClass()}>
            <option value="all">All states</option>
            <option value="yes">Briefed</option>
            <option value="no">Needs brief</option>
          </select>
          <div className="grid grid-cols-2 gap-2">
            <button className="h-10 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white hover:bg-slate-800">
              Apply
            </button>
            <Link href="/radar?view=briefings" className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-600 hover:bg-slate-50">
              Clear
            </Link>
          </div>
        </form>
      </div>

      <StoryClusterRail clusters={props.storyClusters} filters={props.filters} />

      <div className="mt-5 grid gap-3">
        {props.items.length ? (
          props.items.map((item) => (
            <BriefingItem
              key={item.id}
              item={item}
              filterState={props.filterState}
              summarize={props.summarize}
              summarizeDiscussion={props.summarizeDiscussion}
              summarizeSmartPulse={props.summarizeSmartPulse}
              flash={props.flash?.itemId === item.id ? props.flash : null}
              signal={getSignalProfile(item, props.watchTerms)}
            />
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
            No records match this view.
          </div>
        )}
      </div>
    </section>
  );
}

function BriefingItem(props: {
  item: {
    id: string;
    title: string;
    author: string | null;
    url: string | null;
    sourceId: string;
    publishedAt: Date | null;
    fetchedAt: Date;
    source: { title: string | null; url: string; type: SourceType };
    raw: unknown;
    content: { text: string } | null;
    summary: { model: string; summaryMd: string; citations: unknown } | null;
  };
  filterState: string;
  summarize: (formData: FormData) => Promise<void>;
  summarizeDiscussion: (formData: FormData) => Promise<void>;
  summarizeSmartPulse: (formData: FormData) => Promise<void>;
  flash: Flash | null;
  signal: SignalProfile;
}) {
  const item = props.item;
  const summary =
    item.summary && !isPlaceholderSummary(item.summary.summaryMd, item.content?.text)
      ? item.summary
      : null;
  const discussionUrl = getDiscussionUrl(item.raw);
  const signal = props.signal;
  const signalFace = summary
    ? summary.summaryMd.toLowerCase().includes("worr") ||
      summary.summaryMd.toLowerCase().includes("risk")
      ? "😬"
      : summary.summaryMd.toLowerCase().includes("skeptic") ||
          summary.summaryMd.toLowerCase().includes("disagree")
        ? "🤔"
        : "😊"
    : "🫥";

  return (
    <article
      id={`item-${item.id}`}
      className={[
        "scroll-mt-24 rounded-xl border p-4 transition hover:border-slate-300 hover:shadow-sm",
        props.flash?.kind === "error"
          ? "border-rose-300 ring-2 ring-rose-100"
          : props.flash
            ? "border-emerald-300 ring-2 ring-emerald-100"
            : "border-slate-200",
      ].join(" ")}
    >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                      {item.source.type}
                    </span>
                    <Link href={`/radar?view=briefings&source=${encodeURIComponent(item.sourceId)}`} className="min-w-0 max-w-full rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100">
                      <span className="break-words">{sourceDisplayName(item.source)}</span>
                    </Link>
                    <span className="signal-face rounded-full bg-white px-2 py-0.5 text-sm shadow-sm">
                      {signalFace}
                    </span>
                    <span className={summary ? "rounded-full bg-cyan-50 px-2.5 py-0.5 text-[10px] font-bold text-cyan-700" : "rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-700"}>
                      {summary ? "Briefed" : "Needs brief"}
                    </span>
                    {discussionUrl ? (
                      <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-[10px] font-bold text-violet-700">
                        💬 Discussion
                      </span>
                    ) : null}
                    <span
                      className={[
                        "rounded-full px-2.5 py-0.5 text-[10px] font-black",
                        signal.label === "Hot" || signal.label === "Watch"
                          ? "bg-rose-50 text-rose-700"
                          : signal.label === "Rising"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-slate-100 text-slate-600",
                      ].join(" ")}
                    >
                      📈 {signal.score} {signal.label}
                    </span>
                  </div>
                  <h3 className="mt-2 text-base font-bold leading-snug">{item.title}</h3>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                    {item.author ? <span className="break-words">{item.author}</span> : null}
                    <span>{formatDate(item.publishedAt ?? item.fetchedAt)}</span>
                    {item.url ? (
                      <a href={item.url} target="_blank" rel="noreferrer" className="break-all font-bold text-slate-800 underline decoration-slate-300 underline-offset-2 hover:decoration-slate-700">
                        Open source
                      </a>
                    ) : null}
                  </div>
                </div>
                <div className="grid w-full gap-2 sm:grid-cols-3 lg:w-auto lg:grid-cols-1">
                  <form action={props.summarizeSmartPulse}>
                    <input type="hidden" name="filterQs" value={props.filterState} />
                    <input type="hidden" name="itemId" value={item.id} />
                    <ActionSubmitButton
                      pendingLabel="Pulsing..."
                      className="smart-pulse-button h-10 w-full rounded-xl bg-emerald-500 px-3 text-xs font-black text-white shadow-sm hover:bg-emerald-600 disabled:cursor-wait disabled:bg-emerald-400 lg:w-auto"
                    >
                      ✨ Smart pulse
                    </ActionSubmitButton>
                  </form>
                  <form action={props.summarize}>
                    <input type="hidden" name="filterQs" value={props.filterState} />
                    <input type="hidden" name="itemId" value={item.id} />
                    <ActionSubmitButton
                      pendingLabel="Briefing..."
                      className="h-10 w-full rounded-xl bg-slate-950 px-3 text-xs font-bold text-white hover:bg-slate-800 disabled:cursor-wait disabled:bg-slate-700 lg:w-auto"
                    >
                      {summary ? "Regenerate brief" : "Generate brief"}
                    </ActionSubmitButton>
                  </form>
                  {discussionUrl ? (
                    <form action={props.summarizeDiscussion}>
                      <input type="hidden" name="filterQs" value={props.filterState} />
                      <input type="hidden" name="itemId" value={item.id} />
                      <ActionSubmitButton
                        pendingLabel="Analyzing..."
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-wait disabled:bg-slate-100 lg:w-auto"
                      >
                        Analyze discussion
                      </ActionSubmitButton>
                    </form>
                  ) : null}
                </div>
              </div>
              <InlineFlash flash={props.flash} />
              <SignalStrip signal={signal} />
              {item.content?.text && !summary ? (
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600 break-words">
                  {item.content.text}
                </p>
              ) : (
                <p className="mt-3 text-sm text-slate-400">
                  No extracted text yet. Some feeds only provide titles and links.
                </p>
              )}
              {summary?.summaryMd ? (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs font-bold uppercase text-slate-500">AI briefing</div>
                    <div className="text-[11px] font-semibold text-slate-400">
                      Cached with {summary.model}
                    </div>
                  </div>
                  <MarkdownRenderer markdown={summary.summaryMd} />
                  {Array.isArray(summary.citations) && summary.citations.length ? (
                    <BriefingCitations
                      itemId={item.id}
                      sourceText={item.content?.text ?? null}
                      citations={summary.citations as Citation[]}
                    />
                  ) : null}
                </div>
              ) : null}
    </article>
  );
}

function StoryClusterRail({
  clusters,
  filters,
}: {
  clusters: StoryCluster[];
  filters: ItemListFilters;
}) {
  if (!clusters.length) return null;

  return (
    <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-black uppercase text-slate-600">Story clusters</h3>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Related signals in this result set, ranked by score and source density.
          </p>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-slate-500">
          🛰️ Live map
        </span>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {clusters.map((cluster) => {
          const p = new URLSearchParams(filtersToSearchString({ ...filters, q: cluster.key }));
          p.set("view", "briefings");
          return (
            <Link
              key={cluster.key}
              href={`/radar?${p.toString()}`}
              className="rounded-xl border border-slate-200 bg-white p-3 transition hover:border-emerald-300 hover:bg-emerald-50"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="signal-face text-lg">{cluster.emoji}</span>
                    <span className="truncate text-sm font-black">{cluster.label}</span>
                  </div>
                  <div className="mt-1 text-[11px] font-semibold text-slate-500">
                    {cluster.count} item{cluster.count === 1 ? "" : "s"} ·{" "}
                    {cluster.sourceTypes.join(" + ")}
                  </div>
                </div>
                <span className="rounded-full bg-slate-950 px-2.5 py-1 text-[10px] font-black text-white">
                  {cluster.score}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function SignalStrip({ signal }: { signal: SignalProfile }) {
  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-950 text-sm font-black text-white">
            {signal.score}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-black uppercase text-slate-500">Signal score</div>
            <div className="text-sm font-bold text-slate-950">{signal.label}</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {signal.reasons.length ? (
            signal.reasons.map((reason) => (
              <span
                key={reason}
                className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600"
              >
                {reason}
              </span>
            ))
          ) : (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">
              baseline
            </span>
          )}
        </div>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={[
            "h-full rounded-full transition-all",
            signal.label === "Hot" || signal.label === "Watch"
              ? "bg-rose-400"
              : signal.label === "Rising"
                ? "bg-amber-400"
                : "bg-slate-400",
          ].join(" ")}
          style={{ width: `${signal.score}%` }}
        />
      </div>
    </div>
  );
}

function DigestView(props: {
  latestDigest: {
    title: string;
    model: string;
    digestMd: string;
    createdAt: Date;
    stats: unknown;
  } | null;
  filters: ItemListFilters;
  filterState: string;
  generateDigest: (formData: FormData) => Promise<void>;
  storyClusters: StoryCluster[];
  sources: Array<{
    title: string | null;
    url: string;
    healthStatus: string;
    lastRefreshError: string | null;
    _count: { items: number };
  }>;
  items: Array<{
    id: string;
    title: string;
    source: { title: string | null; url: string; type: SourceType };
    summary: { summaryMd: string } | null;
    content: { text: string } | null;
    raw: unknown;
    url: string | null;
    publishedAt: Date | null;
    fetchedAt: Date;
  }>;
}) {
  const failingSources = props.sources.filter(
    (source) => source.healthStatus === "FAILING" || source.lastRefreshError,
  );
  const briefedItems = props.items.filter((item) => item.summary).length;
  const discussionItems = props.items.filter((item) => getDiscussionUrl(item.raw)).length;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-sm font-black">Commander’s brief</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Generate a workspace-level report from recent signals, clusters, watchlist hits,
              papers, and source health.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {props.latestDigest ? <CopyButton text={props.latestDigest.digestMd} /> : null}
            <form action={props.generateDigest}>
              <input type="hidden" name="filterQs" value={props.filterState} />
              <input type="hidden" name="watch" value={props.filters.watch} />
              <ActionSubmitButton
                pendingLabel="Generating..."
                className="h-9 rounded-lg bg-slate-950 px-3 text-xs font-black text-white hover:bg-slate-800 disabled:cursor-wait disabled:bg-slate-700"
              >
                Generate daily digest
              </ActionSubmitButton>
            </form>
          </div>
        </div>

        {props.latestDigest ? (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black">{props.latestDigest.title}</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Generated {formatDate(props.latestDigest.createdAt)} · {props.latestDigest.model}
                </p>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black text-emerald-700">
                🧭 Digest ready
              </span>
            </div>
            <MarkdownRenderer markdown={props.latestDigest.digestMd} />
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
            No digest yet. Generate one to turn the workspace into an executive report.
          </div>
        )}
      </section>

      <aside className="grid gap-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-sm font-black">Digest inputs</h2>
          <div className="mt-3 grid gap-2">
            <DigestStat label="Recent items" value={props.items.length} />
            <DigestStat label="Briefed" value={briefedItems} />
            <DigestStat label="Discussions" value={discussionItems} />
            <DigestStat label="Clusters" value={props.storyClusters.length} />
            <DigestStat label="Source issues" value={failingSources.length} />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-sm font-black">Top clusters</h2>
          <div className="mt-3 grid gap-2">
            {props.storyClusters.length ? (
              props.storyClusters.slice(0, 5).map((cluster) => (
                <div key={cluster.key} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold">
                      {cluster.emoji} {cluster.label}
                    </span>
                    <span className="rounded-full bg-slate-950 px-2 py-0.5 text-[10px] font-black text-white">
                      {cluster.score}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {cluster.count} item{cluster.count === 1 ? "" : "s"}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                Clusters appear when related signals are visible.
              </div>
            )}
          </div>
        </section>
      </aside>
    </div>
  );
}

function DigestStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <span className="text-xs font-bold text-slate-500">{label}</span>
      <span className="text-sm font-black">{value}</span>
    </div>
  );
}

function SettingsView(props: {
  plan: SubscriptionPlan;
  byokUnlocked: boolean;
  settings: {
    aiProvider: AiProvider;
    aiBaseUrl: string | null;
    aiModel: string | null;
    aiApiKeyCiphertext: string | null;
    aiApiKeyUpdatedAt: Date | null;
    autoIngestEnabled: boolean;
    autoIngestIntervalMinutes: number;
    digestWebhookEnabled: boolean;
    digestWebhookUrl: string | null;
  } | null;
  selectedProvider: AiProvider;
  providerPreset: ReturnType<typeof getAiProviderPreset>;
  hasAiKey: boolean;
  providerConfigured: boolean;
  filterState: string;
  saveAiSettings: (formData: FormData) => Promise<void>;
  saveWorkspacePlan: (formData: FormData) => Promise<void>;
  saveAutomationSettings: (formData: FormData) => Promise<void>;
  deleteAiApiKey: (formData: FormData) => Promise<void>;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-sm font-bold">AI provider routing</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Configure the provider used for cited AI briefings. Keys are encrypted in local
              storage and can be rotated or deleted at any time.
            </p>
          </div>
          <span
            className={[
              "rounded-full px-2.5 py-1 text-[11px] font-bold",
              props.providerConfigured
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-700",
            ].join(" ")}
          >
            {props.providerConfigured ? "Configured" : "Needs setup"}
          </span>
        </div>

        <AiProviderSettingsForm
          presets={AI_PROVIDER_PRESETS.filter((preset) => preset.id !== "OPENAI_COMPATIBLE").map(
            (preset) => ({
              id: preset.id,
              label: preset.label,
              mode: preset.mode,
              defaultBaseUrl: preset.defaultBaseUrl,
              defaultModel: preset.defaultModel,
              modelOptions: preset.modelOptions,
              keyHint: preset.keyHint,
            }),
          )}
          selectedProvider={props.selectedProvider}
          initialModel={props.settings?.aiModel ?? props.providerPreset.defaultModel}
          initialBaseUrl={props.settings?.aiBaseUrl ?? props.providerPreset.defaultBaseUrl}
          plan={props.plan}
          byokUnlocked={props.byokUnlocked}
          hasAiKey={props.hasAiKey}
          keyUpdatedLabel={
            props.settings?.aiApiKeyUpdatedAt
              ? `Updated ${formatDate(props.settings.aiApiKeyUpdatedAt)}`
              : null
          }
          filterState={props.filterState}
          saveAiSettings={props.saveAiSettings}
          deleteAiApiKey={props.deleteAiApiKey}
        />
      </section>

      <aside className="grid gap-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-sm font-bold">Plan controls</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Developer controls for testing locked and premium states locally.
          </p>
          <form action={props.saveWorkspacePlan} className="mt-4 grid gap-3">
            <input type="hidden" name="filterQs" value={props.filterState} />
            <label className="grid gap-1.5">
              <FieldLabel>Workspace plan</FieldLabel>
              <select name="plan" defaultValue={props.plan} className={inputClass()}>
                <option value="STARTER">Starter</option>
                <option value="TEAM">Team</option>
                <option value="ENTERPRISE">Enterprise</option>
              </select>
            </label>
            <button className="h-10 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white hover:bg-slate-800">
              Update plan
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-sm font-bold">Automation</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Scheduled ingest while the app is open, plus optional digest webhooks (Slack, Zapier, etc.).
          </p>
          <form action={props.saveAutomationSettings} className="mt-4 grid gap-3">
            <input type="hidden" name="filterQs" value={props.filterState} />
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                name="autoIngestEnabled"
                defaultChecked={props.settings?.autoIngestEnabled ?? true}
              />
              Auto-ingest on schedule
            </label>
            <label className="grid gap-1.5">
              <FieldLabel>Ingest interval (minutes)</FieldLabel>
              <input
                name="autoIngestIntervalMinutes"
                type="number"
                min={30}
                max={1440}
                defaultValue={props.settings?.autoIngestIntervalMinutes ?? 360}
                className={inputClass()}
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                name="digestWebhookEnabled"
                defaultChecked={props.settings?.digestWebhookEnabled ?? false}
              />
              Send digest to webhook
            </label>
            <label className="grid gap-1.5">
              <FieldLabel>Webhook URL</FieldLabel>
              <input
                name="digestWebhookUrl"
                type="url"
                placeholder="https://hooks.slack.com/..."
                defaultValue={props.settings?.digestWebhookUrl ?? ""}
                className={inputClass()}
              />
            </label>
            <p className="text-[11px] leading-5 text-slate-500">
              CLI cron: <code className="rounded bg-slate-100 px-1">npm run ingest:cron</code> hits{" "}
              <code className="rounded bg-slate-100 px-1">/api/cron/ingest</code>.
            </p>
            <button className="h-10 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white hover:bg-slate-800">
              Save automation
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-sm font-bold">Provider catalog</h2>
          <div className="mt-3 grid gap-2">
            {AI_PROVIDER_PRESETS.filter((preset) => preset.id !== "OPENAI_COMPATIBLE").map(
              (preset) => (
                <div key={preset.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-bold">{preset.label}</div>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                      {preset.mode === "anthropic" ? "Native" : "OpenAI-compatible"}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-xs text-slate-500">
                    {preset.defaultModel || preset.keyHint}
                  </div>
                </div>
              ),
            )}
          </div>
        </section>
      </aside>
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: number | string; detail: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
      <div className="text-[11px] font-bold uppercase text-slate-500">{label}</div>
      <div className="mt-1 truncate text-sm font-black text-slate-950">{value}</div>
      <div className="mt-0.5 truncate text-[11px] text-slate-500">{detail}</div>
    </div>
  );
}

function Progress({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="mt-3">
      <div className="flex justify-between text-[11px] text-slate-400">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-white/10">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function StatusCard({
  title,
  value,
  detail,
  tone,
}: {
  title: string;
  value: string | number;
  detail: string;
  tone: "good" | "warn" | "neutral";
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-[11px] font-bold uppercase text-slate-500">{title}</div>
      <div className="mt-2 truncate text-2xl font-black">{value}</div>
      <div
        className={[
          "mt-2 text-xs font-semibold",
          tone === "good" ? "text-emerald-700" : tone === "warn" ? "text-amber-700" : "text-slate-500",
        ].join(" ")}
      >
        {detail}
      </div>
    </div>
  );
}

function ActionLink({ href, title, copy }: { href: string; title: string; copy: string }) {
  return (
    <Link href={href} className="rounded-xl border border-slate-200 bg-white p-3 hover:border-emerald-300 hover:bg-emerald-50">
      <div className="text-sm font-bold">{title}</div>
      <div className="mt-1 text-xs leading-5 text-slate-500">{copy}</div>
    </Link>
  );
}

function FeedDiscoveryPanel(props: {
  filterState: string;
  discoveredFeeds: Array<{ url: string; title: string }>;
  discoverFeedsAction: (formData: FormData) => Promise<void>;
  addSource: (formData: FormData) => Promise<void>;
}) {
  return (
    <div className="mt-5 border-t border-slate-100 pt-4">
      <h3 className="text-xs font-bold uppercase text-slate-500">Discover feed from site</h3>
      <p className="mt-1 text-[11px] leading-5 text-slate-500">
        Paste a homepage URL — we scan link tags and common feed paths.
      </p>
      <form action={props.discoverFeedsAction} className="mt-3 grid gap-2">
        <input type="hidden" name="filterQs" value={props.filterState} />
        <input name="siteUrl" placeholder="https://example.com" className={inputClass()} required />
        <ActionSubmitButton
          pendingLabel="Discovering..."
          className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-wait"
        >
          Find RSS / Atom feeds
        </ActionSubmitButton>
      </form>
      {props.discoveredFeeds.length ? (
        <div className="mt-3 grid gap-2">
          {props.discoveredFeeds.map((feed) => (
            <form
              key={feed.url}
              action={props.addSource}
              className="rounded-xl border border-emerald-200 bg-emerald-50 p-2"
            >
              <input type="hidden" name="filterQs" value={props.filterState} />
              <input type="hidden" name="type" value="RSS" />
              <input type="hidden" name="url" value={feed.url} />
              <input type="hidden" name="title" value={feed.title} />
              <button type="submit" className="w-full text-left">
                <div className="text-xs font-bold text-emerald-900">{feed.title}</div>
                <div className="mt-0.5 truncate text-[11px] text-emerald-700">{feed.url}</div>
              </button>
            </form>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SourceHealthDashboard(props: {
  failingSources: Array<{
    id: string;
    title: string | null;
    url: string;
    lastRefreshError: string | null;
  }>;
  filterState: string;
  applySourceUrlFix: (formData: FormData) => Promise<void>;
}) {
  return (
    <section className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm sm:p-5 xl:col-span-2">
      <h2 className="text-sm font-bold text-rose-900">Source health alerts</h2>
      <p className="mt-1 text-xs leading-5 text-rose-800">
        {props.failingSources.length} source{props.failingSources.length === 1 ? "" : "s"} need attention.
      </p>
      <div className="mt-3 grid gap-2">
        {props.failingSources.map((source) => (
          <div key={source.id} className="rounded-xl border border-rose-200 bg-white p-3">
            <div className="text-sm font-bold text-slate-900">{source.title ?? source.url}</div>
            <div className="mt-1 break-all text-xs text-slate-500">{source.url}</div>
            {source.lastRefreshError ? (
              <p className="mt-2 text-xs leading-5 text-rose-700">{source.lastRefreshError}</p>
            ) : null}
            {getKnownFeedUrlFix(source.url) ? (
              <form action={props.applySourceUrlFix} className="mt-2">
                <input type="hidden" name="filterQs" value={props.filterState} />
                <input type="hidden" name="sourceId" value={source.id} />
                <ActionSubmitButton
                  pendingLabel="Fixing..."
                  className="h-9 rounded-lg bg-rose-600 px-3 text-xs font-bold text-white hover:bg-rose-700 disabled:cursor-wait"
                >
                  One-click URL fix
                </ActionSubmitButton>
              </form>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] font-bold uppercase text-slate-500">{children}</span>;
}

function inputClass(disabled = false) {
  return [
    "h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100",
    disabled ? "cursor-not-allowed bg-slate-100 text-slate-400" : "",
  ].join(" ");
}
