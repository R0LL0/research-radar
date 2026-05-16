import { AiProvider } from "@prisma/client";
import { db } from "@/lib/db";
import { getAiProviderPreset, isModelCompatibleWithBriefings } from "@/lib/ai-providers";
import { decryptSecret } from "@/lib/secrets";

export const dynamic = "force-dynamic";

function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function parseProvider(value: string | null): AiProvider {
  return Object.values(AiProvider).includes(value as AiProvider)
    ? (value as AiProvider)
    : AiProvider.OPENAI;
}

function ollamaHostFromOpenAICompatBase(baseUrl: string): string {
  const normalized = stripTrailingSlash(baseUrl);
  return normalized.endsWith("/v1") ? normalized.slice(0, -3) : normalized;
}

function namesFromOpenAiModels(json: unknown) {
  const data = (json as { data?: unknown })?.data;
  if (!Array.isArray(data)) return [];
  return data
    .map((model) => (model as { id?: unknown })?.id)
    .filter((id): id is string => typeof id === "string" && id.trim() !== "");
}

function namesFromOllamaTags(json: unknown) {
  const models = (json as { models?: unknown })?.models;
  if (!Array.isArray(models)) return [];
  return models
    .map((model) => {
      const item = model as { model?: unknown; name?: unknown };
      return typeof item.model === "string" ? item.model : item.name;
    })
    .filter((id): id is string => typeof id === "string" && id.trim() !== "");
}

async function fetchJson(url: string, headers: HeadersInit = {}) {
  const res = await fetch(url, {
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`Provider returned ${res.status}: ${body.slice(0, 300)}`);
  }
  return JSON.parse(body) as unknown;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const provider = parseProvider(url.searchParams.get("provider"));
  const preset = getAiProviderPreset(provider);
  const baseUrl = url.searchParams.get("baseUrl")?.trim() || preset.defaultBaseUrl;

  if (!baseUrl) {
    return Response.json({ error: "Enter a base URL before refreshing models." }, { status: 400 });
  }

  const { getWorkspaceContext } = await import("@/lib/auth");
  const { workspaceId } = await getWorkspaceContext();
  const settings = await db.workspaceSettings.findUnique({ where: { workspaceId } });
  const apiKey =
    settings?.aiProvider === provider ? decryptSecret(settings.aiApiKeyCiphertext) : null;
  const keyOptional = provider === AiProvider.OLLAMA || provider === AiProvider.LM_STUDIO;

  if (!apiKey && !keyOptional) {
    return Response.json(
      { error: `Save a ${preset.label} API key before refreshing live models.` },
      { status: 400 },
    );
  }

  try {
    const normalizedBaseUrl = stripTrailingSlash(baseUrl);
    if (provider === AiProvider.OLLAMA) {
      const json = await fetchJson(`${ollamaHostFromOpenAICompatBase(baseUrl)}/api/tags`);
      return Response.json({
        models: namesFromOllamaTags(json).filter((model) =>
          isModelCompatibleWithBriefings(provider, model),
        ),
      });
    }

    const headers: Record<string, string> = {};
    if (provider === AiProvider.ANTHROPIC) {
      headers["x-api-key"] = apiKey ?? "";
      headers["anthropic-version"] = "2023-06-01";
    } else if (apiKey) {
      headers.authorization = `Bearer ${apiKey}`;
    }
    const json = await fetchJson(`${normalizedBaseUrl}/models`, headers);
    return Response.json({
      models: namesFromOpenAiModels(json).filter((model) =>
        isModelCompatibleWithBriefings(provider, model),
      ),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Could not refresh models.";
    return Response.json({ error: message }, { status: 502 });
  }
}
