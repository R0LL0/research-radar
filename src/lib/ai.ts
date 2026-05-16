import { z } from "zod";
import { AiProvider, SubscriptionPlan } from "@prisma/client";
import { db } from "@/lib/db";
import { getAiProviderPreset, resolveBriefingModel } from "@/lib/ai-providers";
import { decryptSecret } from "@/lib/secrets";

const envSchema = z.object({
  AI_BASE_URL: z.string().url().optional(),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().optional(),
});

export type AiCitation = {
  quote: string;
  url?: string | null;
};

export type AiSummary = {
  model: string;
  summaryMd: string;
  citations: AiCitation[];
};

function stripTrailingSlash(s: string) {
  return s.replace(/\/+$/, "");
}

function getEnv() {
  const parsed = envSchema.safeParse({
    AI_BASE_URL: process.env.AI_BASE_URL,
    AI_API_KEY: process.env.AI_API_KEY,
    AI_MODEL: process.env.AI_MODEL,
  });
  if (!parsed.success) return {};
  return parsed.data;
}

const aiResponseSchema = z.object({
  summaryMd: z.string(),
  citations: z
    .array(
      z.object({
        quote: z.string(),
        url: z.string().url().optional(),
      }),
    )
    .max(8),
});

function ollamaHostFromOpenAICompatBase(baseUrl: string): string {
  const normalized = stripTrailingSlash(baseUrl);
  return normalized.endsWith("/v1") ? normalized.slice(0, -3) : normalized;
}

function isLikelyOllamaOpenAICompat(baseUrl: string): boolean {
  const b = baseUrl.toLowerCase();
  return b.includes(":11434") || b.includes("ollama");
}

type OllamaTagsResult = {
  host: string;
  names: string[];
  /** Set when we should not call /v1/chat/completions (no models or unreachable). */
  blockReason?: string;
};

async function getOllamaTagsResult(baseUrl: string): Promise<OllamaTagsResult> {
  const host = ollamaHostFromOpenAICompatBase(baseUrl);
  let res: Response;
  try {
    res = await fetch(`${host}/api/tags`, { method: "GET", cache: "no-store" });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "network error";
    return {
      host,
      names: [],
      blockReason: [
        `Cannot reach Ollama at ${host}/api/tags (${msg}).`,
        "Start the Ollama app (or run `ollama serve`) and try again.",
        "On Windows, if Ollama runs but this still fails, set AI_BASE_URL=http://127.0.0.1:11434/v1 in .env (Next.js sometimes resolves localhost differently than the Ollama CLI).",
      ].join(" "),
    };
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return {
      host,
      names: [],
      blockReason: `Ollama at ${host} returned HTTP ${res.status} for /api/tags. ${body.slice(0, 300)}`,
    };
  }

  const json = (await res.json().catch(() => null)) as { models?: unknown } | null;
  const models: unknown[] = Array.isArray(json?.models) ? json!.models! : [];
  const names = models
    .map((m) => (m as { name?: unknown })?.name)
    .filter((n): n is string => typeof n === "string" && n.trim() !== "");

  if (names.length === 0) {
    return {
      host,
      names: [],
      blockReason: [
        `Ollama at ${host} is reachable but reports no models.`,
        'Install one with: ollama pull llama3.2',
        "Then confirm `ollama list` shows a name and either set AI_MODEL to that exact name or leave it unset to use the first installed model.",
      ].join(" "),
    };
  }

  return { host, names };
}

function pickInstalledOllamaModel(installed: string[], preferred: string): string {
  const p = preferred.trim();
  if (p && installed.includes(p)) return p;
  return installed[0]!;
}

type ChatArgs = {
  baseUrl: string;
  apiKey?: string;
  model: string;
  system: string;
  user: string;
};

async function chatCompletion(args: ChatArgs) {
  return await fetch(`${stripTrailingSlash(args.baseUrl)}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(args.apiKey ? { authorization: `Bearer ${args.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: args.model,
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.user },
      ],
      response_format: { type: "json_object" },
    }),
  });
}

type AnthropicArgs = {
  baseUrl: string;
  apiKey: string;
  model: string;
  system: string;
  user: string;
};

async function anthropicMessage(args: AnthropicArgs) {
  return await fetch(`${stripTrailingSlash(args.baseUrl)}/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": args.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: args.model,
      max_tokens: 1800,
      temperature: 0.2,
      system: args.system,
      messages: [{ role: "user", content: args.user }],
    }),
  });
}

async function getPremiumSettings(workspaceId: string) {
  const settings = await db.workspaceSettings.findUnique({ where: { workspaceId } });
  if (!settings || settings.plan === SubscriptionPlan.STARTER) return null;

  const preset = getAiProviderPreset(settings.aiProvider);
  const apiKey = decryptSecret(settings.aiApiKeyCiphertext);
  const keyOptional =
    settings.aiProvider === AiProvider.OLLAMA || settings.aiProvider === AiProvider.LM_STUDIO;
  if (!apiKey && !keyOptional) return null;

  return {
    provider: settings.aiProvider,
    baseUrl: settings.aiBaseUrl ?? preset.defaultBaseUrl,
    model: resolveBriefingModel(settings.aiProvider, settings.aiModel),
    apiKey: apiKey ?? undefined,
    preset,
  };
}

function parseModelJson(content: string, text: string, url?: string | null): AiSummary {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("AI did not return valid JSON");
  }

  const validated = aiResponseSchema.parse(parsed);

  const citations = validated.citations
    .filter((c) => c.quote.trim().length >= 10 && text.includes(c.quote))
    .map((c) => ({ quote: c.quote, url: c.url ?? url ?? null }));

  return {
    model: "",
    summaryMd: validated.summaryMd,
    citations,
  };
}

export async function summarizeWithCitations(input: {
  workspaceId: string;
  title: string;
  url?: string | null;
  text: string;
  mode?: "document" | "discussion" | "hybrid" | "digest";
}): Promise<AiSummary> {
  const { AI_BASE_URL, AI_API_KEY, AI_MODEL } = getEnv();
  const premium = await getPremiumSettings(input.workspaceId);

  const isDiscussion = input.mode === "discussion";
  const isHybrid = input.mode === "hybrid";
  const isDigest = input.mode === "digest";
  const system = [
    isDigest
      ? "You write a concise intelligence digest for a research monitoring workspace."
      : isHybrid
      ? "You produce a hybrid intelligence brief from article text plus community discussion."
      : isDiscussion
      ? "You analyze a community discussion thread about one link."
      : "You summarize a single document.",
    "Return ONLY valid JSON (no markdown).",
    "Output JSON shape: { summaryMd: string, citations: Array<{ quote: string, url?: string }> }",
    "CITATIONS RULES:",
    "- Every citation.quote must be an exact substring from the provided TEXT.",
    "- Use 3-6 citations. Prefer short, high-signal quotes (1-2 sentences).",
    "- Do not invent facts. If the text is too short, keep the summary short.",
    "SUMMARY RULES:",
    "- summaryMd is markdown.",
    isDigest
      ? "- Structure summaryMd with these headings: ### 🧭 Executive Read, ### 🔥 Top Signals, ### 🧩 Story Clusters, ### 👀 Watchlist Hits, ### 📄 Papers & Research, ### ⚠️ Source Health, ### ✅ Recommended Actions."
      : isHybrid
      ? "- Structure summaryMd with these headings: ### 🧠 Core Signal, ### 😊 Vibe, ### ⚠️ Worries, ### 🥊 Disagreements, ### ✅ Practical Takeaways, ### ❓ Follow-up Questions."
      : isDiscussion
      ? "- Structure summaryMd with these headings: ### 😊 Overall Vibe, ### 👍 What People Like, ### ⚠️ What Worries People, ### 🥊 Notable Disagreements, ### ✅ Practical Takeaways, ### ❓ Follow-up Questions."
      : "- Keep it concise, technical, and structured (bullets are ok).",
    isDiscussion || isHybrid || isDigest
      ? "- Describe sentiment carefully from the comments; do not claim it represents everyone."
      : "",
    isDiscussion || isHybrid || isDigest
      ? "- Include concise vibe tags inline where useful, such as Optimistic, Skeptical, Curious, Concerned, Practical, or Heated."
      : "",
    isDigest
      ? "- Prioritize what changed, what matters, what needs attention, and what the user should do next."
      : "",
  ].join("\n");

  const user = [
    `TITLE: ${input.title}`,
    input.url ? `URL: ${input.url}` : "URL: (none)",
    "",
    "TEXT:",
    input.text,
  ].join("\n");

  if (premium?.provider === AiProvider.ANTHROPIC) {
    const model = premium.model?.trim() || premium.preset.defaultModel;
    const baseUrl = premium.baseUrl ?? premium.preset.defaultBaseUrl;
    if (!baseUrl) throw new Error("Anthropic base URL is missing.");
    if (!premium.apiKey) throw new Error("Anthropic API key is missing.");
    const res = await anthropicMessage({
      baseUrl,
      apiKey: premium.apiKey,
      model,
      system,
      user,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Anthropic request failed (${res.status}): ${body}`);
    }

    const json = await res.json();
    const contentBlocks = Array.isArray(json?.content) ? json.content : [];
    const content = contentBlocks
      .map((block: { type?: unknown; text?: unknown }) =>
        block.type === "text" && typeof block.text === "string" ? block.text : "",
      )
      .join("")
      .trim();
    if (!content) throw new Error("Anthropic response missing text content");

    return { ...parseModelJson(content, input.text, input.url), model: `anthropic:${model}` };
  }

  const baseUrl = premium?.baseUrl ?? AI_BASE_URL ?? "http://localhost:11434/v1";
  const apiKey = premium?.apiKey ?? AI_API_KEY;
  const ollama = isLikelyOllamaOpenAICompat(baseUrl);
  const rawModel = premium?.model?.trim() || AI_MODEL?.trim();
  const defaultModel =
    rawModel && rawModel.length > 0 ? rawModel : ollama ? "" : "gpt-4.1-mini";

  let installed: string[] = [];
  if (ollama) {
    const tags = await getOllamaTagsResult(baseUrl);
    if (tags.blockReason) {
      throw new Error(tags.blockReason);
    }
    installed = tags.names;
  }

  let model = ollama ? pickInstalledOllamaModel(installed, defaultModel) : defaultModel;

  let res = await chatCompletion({
    baseUrl,
    apiKey,
    model,
    system,
    user,
  });

  // Ollama: if the model is missing or wrong, try other installed models from the same /api/tags list.
  if (!res.ok && res.status === 404 && ollama) {
    for (const name of installed) {
      if (name === model) continue;
      model = name;
      res = await chatCompletion({
        baseUrl,
        apiKey,
        model,
        system,
        user,
      });
      if (res.ok) break;
    }
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const hint = ollama ? ` Tried model "${model}". Installed: ${installed.join(", ")}.` : "";
    throw new Error(`AI request failed (${res.status}): ${body}${hint}`);
  }

  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("AI response missing content");

  return { ...parseModelJson(content, input.text, input.url), model };
}
