import { AiProvider } from "@prisma/client";

export type AiProviderMode = "openai-compatible" | "anthropic";

export type AiProviderPreset = {
  id: AiProvider;
  label: string;
  mode: AiProviderMode;
  defaultBaseUrl: string | null;
  defaultModel: string;
  modelOptions: string[];
  keyHint: string;
};

export const AI_PROVIDER_PRESETS: AiProviderPreset[] = [
  {
    id: AiProvider.OPENAI,
    label: "OpenAI",
    mode: "openai-compatible",
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-5.2",
    modelOptions: [
      "gpt-5.2",
      "gpt-5.1",
      "gpt-5",
      "gpt-5-mini",
      "gpt-5-nano",
      "gpt-4.1",
      "gpt-4.1-mini",
      "gpt-4.1-nano",
      "gpt-4o",
      "gpt-4o-mini",
    ],
    keyHint: "OPENAI_API_KEY",
  },
  {
    id: AiProvider.ANTHROPIC,
    label: "Anthropic",
    mode: "anthropic",
    defaultBaseUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-sonnet-4-6",
    modelOptions: [
      "claude-sonnet-4-6",
      "claude-opus-4-6",
      "claude-haiku-4-5",
      "claude-opus-4-1",
      "claude-sonnet-4-20250514",
      "claude-opus-4-20250514",
      "claude-3-7-sonnet-20250219",
      "claude-3-5-haiku-20241022",
    ],
    keyHint: "ANTHROPIC_API_KEY",
  },
  {
    id: AiProvider.OPENROUTER,
    label: "OpenRouter",
    mode: "openai-compatible",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "openrouter/auto",
    modelOptions: [
      "openrouter/auto",
      "openai/gpt-5.2",
      "openai/gpt-5.1",
      "anthropic/claude-sonnet-4.6",
      "google/gemini-2.5-pro",
      "x-ai/grok-4.3",
      "deepseek/deepseek-v4-pro",
      "meta-llama/llama-3.3-70b-instruct",
    ],
    keyHint: "OPENROUTER_API_KEY",
  },
  {
    id: AiProvider.GROQ,
    label: "Groq",
    mode: "openai-compatible",
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
    modelOptions: [
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "openai/gpt-oss-120b",
      "openai/gpt-oss-20b",
      "meta-llama/llama-4-maverick-17b-128e-instruct",
      "meta-llama/llama-4-scout-17b-16e-instruct",
    ],
    keyHint: "GROQ_API_KEY",
  },
  {
    id: AiProvider.MISTRAL,
    label: "Mistral",
    mode: "openai-compatible",
    defaultBaseUrl: "https://api.mistral.ai/v1",
    defaultModel: "mistral-medium-3.5",
    modelOptions: [
      "mistral-medium-3.5",
      "mistral-large-2512",
      "mistral-large-latest",
      "mistral-medium-latest",
      "mistral-small-latest",
      "mistral-small-2506",
      "magistral-medium-latest",
      "ministral-14b-latest",
      "ministral-8b-latest",
      "ministral-3b-latest",
      "codestral-latest",
      "devstral-medium-latest",
    ],
    keyHint: "MISTRAL_API_KEY",
  },
  {
    id: AiProvider.TOGETHER,
    label: "Together AI",
    mode: "openai-compatible",
    defaultBaseUrl: "https://api.together.xyz/v1",
    defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    modelOptions: [
      "meta-llama/Llama-3.3-70B-Instruct-Turbo",
      "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
      "deepseek-ai/DeepSeek-V3.1",
      "deepseek-ai/DeepSeek-R1",
      "openai/gpt-oss-120b",
      "openai/gpt-oss-20b",
      "moonshotai/Kimi-K2-Instruct-0905",
      "zai-org/GLM-4.6",
      "Qwen/Qwen3-235B-A22B-fp8-tput",
    ],
    keyHint: "TOGETHER_API_KEY",
  },
  {
    id: AiProvider.FIREWORKS,
    label: "Fireworks AI",
    mode: "openai-compatible",
    defaultBaseUrl: "https://api.fireworks.ai/inference/v1",
    defaultModel: "accounts/fireworks/models/llama-v3p1-70b-instruct",
    modelOptions: [
      "accounts/fireworks/models/llama-v3p1-70b-instruct",
      "accounts/fireworks/models/llama-v3p1-8b-instruct",
      "accounts/fireworks/models/llama-v3p3-70b-instruct",
      "accounts/fireworks/models/qwen3-235b-a22b",
      "accounts/fireworks/models/deepseek-v3p1",
      "accounts/fireworks/models/deepseek-v3",
      "accounts/fireworks/models/deepseek-r1",
    ],
    keyHint: "FIREWORKS_API_KEY",
  },
  {
    id: AiProvider.PERPLEXITY,
    label: "Perplexity",
    mode: "openai-compatible",
    defaultBaseUrl: "https://api.perplexity.ai",
    defaultModel: "sonar-pro",
    modelOptions: ["sonar-pro", "sonar", "sonar-reasoning-pro"],
    keyHint: "PERPLEXITY_API_KEY",
  },
  {
    id: AiProvider.DEEPSEEK,
    label: "DeepSeek",
    mode: "openai-compatible",
    defaultBaseUrl: "https://api.deepseek.com",
    defaultModel: "deepseek-v4-pro",
    modelOptions: ["deepseek-v4-pro", "deepseek-v4-flash", "deepseek-chat", "deepseek-reasoner"],
    keyHint: "DEEPSEEK_API_KEY",
  },
  {
    id: AiProvider.XAI,
    label: "xAI",
    mode: "openai-compatible",
    defaultBaseUrl: "https://api.x.ai/v1",
    defaultModel: "grok-4.3",
    modelOptions: [
      "grok-4.3",
      "grok-4.20-multi-agent-0309",
      "grok-4.20-0309-reasoning",
      "grok-4.20-0309-non-reasoning",
      "grok-4-1-fast-reasoning",
      "grok-4-1-fast-non-reasoning",
      "grok-4-fast-reasoning",
      "grok-4-fast-non-reasoning",
      "grok-3",
    ],
    keyHint: "XAI_API_KEY",
  },
  {
    id: AiProvider.CEREBRAS,
    label: "Cerebras",
    mode: "openai-compatible",
    defaultBaseUrl: "https://api.cerebras.ai/v1",
    defaultModel: "gpt-oss-120b",
    modelOptions: [
      "gpt-oss-120b",
      "llama3.1-8b",
      "qwen-3-235b-a22b-instruct-2507",
      "zai-glm-4.7",
    ],
    keyHint: "CEREBRAS_API_KEY",
  },
  {
    id: AiProvider.OLLAMA,
    label: "Ollama",
    mode: "openai-compatible",
    defaultBaseUrl: "http://127.0.0.1:11434/v1",
    defaultModel: "llama3.2:latest",
    modelOptions: [
      "llama3.2:latest",
      "llama3.1:latest",
      "qwen3:latest",
      "gemma3:latest",
      "mistral:latest",
    ],
    keyHint: "No key required locally",
  },
  {
    id: AiProvider.LM_STUDIO,
    label: "LM Studio",
    mode: "openai-compatible",
    defaultBaseUrl: "http://127.0.0.1:1234/v1",
    defaultModel: "local-model",
    modelOptions: ["local-model", "loaded-model"],
    keyHint: "No key required locally",
  },
  {
    id: AiProvider.CUSTOM,
    label: "Custom OpenAI-compatible",
    mode: "openai-compatible",
    defaultBaseUrl: null,
    defaultModel: "",
    modelOptions: [],
    keyHint: "Provider API key",
  },
  {
    id: AiProvider.OPENAI_COMPATIBLE,
    label: "OpenAI-compatible legacy",
    mode: "openai-compatible",
    defaultBaseUrl: null,
    defaultModel: "gpt-4.1-mini",
    modelOptions: ["gpt-4.1-mini"],
    keyHint: "Provider API key",
  },
];

export function getAiProviderPreset(provider: AiProvider): AiProviderPreset {
  return (
    AI_PROVIDER_PRESETS.find((preset) => preset.id === provider) ??
    AI_PROVIDER_PRESETS[AI_PROVIDER_PRESETS.length - 1]!
  );
}

export function isModelCompatibleWithBriefings(provider: AiProvider, model: string | null) {
  const id = model?.trim().toLowerCase();
  if (!id) return false;

  if (provider !== AiProvider.OPENAI) return true;

  const blockedFragments = [
    "audio",
    "codex",
    "computer-use",
    "dall-e",
    "embedding",
    "image",
    "moderation",
    "realtime",
    "sora",
    "tts",
    "transcribe",
    "whisper",
  ];
  if (blockedFragments.some((fragment) => id.includes(fragment))) return false;

  // OpenAI "pro" SKUs are not accepted by this app's /v1/chat/completions flow.
  if (id.includes("-pro")) return false;

  return id.startsWith("gpt-") || id.startsWith("o");
}

export function resolveBriefingModel(provider: AiProvider, model: string | null | undefined) {
  const preset = getAiProviderPreset(provider);
  const configured = model?.trim() || preset.defaultModel;
  return isModelCompatibleWithBriefings(provider, configured)
    ? configured
    : preset.defaultModel;
}
