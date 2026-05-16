"use client";

import { useMemo, useState } from "react";

type ProviderPreset = {
  id: string;
  label: string;
  mode: "openai-compatible" | "anthropic";
  defaultBaseUrl: string | null;
  defaultModel: string;
  modelOptions: string[];
  keyHint: string;
};

type Props = {
  presets: ProviderPreset[];
  selectedProvider: string;
  initialModel: string | null;
  initialBaseUrl: string | null;
  plan: string;
  byokUnlocked: boolean;
  hasAiKey: boolean;
  keyUpdatedLabel: string | null;
  filterState: string;
  saveAiSettings: (formData: FormData) => Promise<void>;
  deleteAiApiKey: (formData: FormData) => Promise<void>;
};

function inputClass(disabled = false, readonly = false) {
  return [
    "h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100",
    disabled ? "cursor-not-allowed bg-slate-100 text-slate-400" : "",
    readonly && !disabled ? "bg-slate-50 text-slate-600" : "",
  ].join(" ");
}

function fieldLabel(label: string) {
  return <span className="text-[11px] font-bold uppercase text-slate-500">{label}</span>;
}

const CUSTOM_MODEL_VALUE = "__custom_model__";

function uniqueOptions(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean))) as string[];
}

function presetModelOptions(preset: ProviderPreset | undefined) {
  return Array.isArray(preset?.modelOptions) ? preset.modelOptions : [];
}

export function AiProviderSettingsForm(props: Props) {
  const [providerId, setProviderId] = useState(props.selectedProvider);
  const selected = useMemo(
    () => props.presets.find((preset) => preset.id === providerId) ?? props.presets[0]!,
    [providerId, props.presets],
  );
  const savedModelValue =
    providerId === props.selectedProvider
      ? props.initialModel ?? selected.defaultModel
      : selected.defaultModel;
  const savedBaseUrlValue =
    providerId === props.selectedProvider
      ? props.initialBaseUrl ?? selected.defaultBaseUrl ?? ""
      : selected.defaultBaseUrl ?? "";
  const [baseUrl, setBaseUrl] = useState(savedBaseUrlValue);
  const [liveModelOptions, setLiveModelOptions] = useState<Record<string, string[]>>({});
  const [isRefreshingModels, setIsRefreshingModels] = useState(false);
  const [modelRefreshMessage, setModelRefreshMessage] = useState<string | null>(null);
  const modelOptions = useMemo(
    () =>
      uniqueOptions([
        selected.defaultModel,
        ...presetModelOptions(selected),
        ...(liveModelOptions[providerId] ?? []),
      ]),
    [liveModelOptions, providerId, selected],
  );
  const [modelChoice, setModelChoice] = useState(() =>
    modelOptions.includes(savedModelValue) ? savedModelValue : CUSTOM_MODEL_VALUE,
  );
  const [customModel, setCustomModel] = useState(() =>
    modelOptions.includes(savedModelValue) ? "" : savedModelValue,
  );
  const baseDisabled = !props.byokUnlocked;
  const selectedModel = modelChoice === CUSTOM_MODEL_VALUE ? customModel : modelChoice;

  function handleProviderChange(nextProviderId: string) {
    const nextPreset =
      props.presets.find((preset) => preset.id === nextProviderId) ?? props.presets[0]!;
    const nextModel =
      nextProviderId === props.selectedProvider
        ? props.initialModel ?? nextPreset.defaultModel
        : nextPreset.defaultModel;
    const nextOptions = uniqueOptions([
      nextPreset.defaultModel,
      ...presetModelOptions(nextPreset),
      ...(liveModelOptions[nextProviderId] ?? []),
    ]);
    setProviderId(nextProviderId);
    setBaseUrl(
      nextProviderId === props.selectedProvider
        ? props.initialBaseUrl ?? nextPreset.defaultBaseUrl ?? ""
        : nextPreset.defaultBaseUrl ?? "",
    );
    setModelRefreshMessage(null);
    if (nextOptions.includes(nextModel)) {
      setModelChoice(nextModel);
      setCustomModel("");
      return;
    }
    setModelChoice(CUSTOM_MODEL_VALUE);
    setCustomModel(nextModel);
  }

  async function refreshModels() {
    setIsRefreshingModels(true);
    setModelRefreshMessage(null);
    try {
      const qs = new URLSearchParams({ provider: providerId, baseUrl });
      const res = await fetch(`/api/ai-models?${qs.toString()}`, { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as {
        models?: unknown;
        error?: unknown;
      } | null;
      if (!res.ok) {
        throw new Error(typeof json?.error === "string" ? json.error : "Could not refresh models.");
      }
      const models = Array.isArray(json?.models)
        ? json.models.filter((model): model is string => typeof model === "string")
        : [];
      setLiveModelOptions((current) => ({ ...current, [providerId]: models }));
      setModelRefreshMessage(
        models.length > 0
          ? `Loaded ${models.length} live model${models.length === 1 ? "" : "s"}.`
          : "Provider returned no models.",
      );
    } catch (error: unknown) {
      setModelRefreshMessage(error instanceof Error ? error.message : "Could not refresh models.");
    } finally {
      setIsRefreshingModels(false);
    }
  }

  return (
    <>
      <form action={props.saveAiSettings} className="mt-5 grid gap-4">
        <input type="hidden" name="filterQs" value={props.filterState} />
        <input type="hidden" name="plan" value={props.plan} />
        <input type="hidden" name="model" value={selectedModel} />
        <div className="grid gap-3 lg:grid-cols-2">
          <label className="grid gap-1.5">
            {fieldLabel("Provider")}
            <select
              name="provider"
              value={providerId}
              onChange={(event) => handleProviderChange(event.target.value)}
              disabled={!props.byokUnlocked}
              className={inputClass(!props.byokUnlocked)}
            >
              {props.presets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5">
            {fieldLabel("Model")}
            <div className="flex min-w-0 gap-2">
              <select
                value={modelChoice}
                onChange={(event) => setModelChoice(event.target.value)}
                disabled={!props.byokUnlocked}
                className={`${inputClass(!props.byokUnlocked)} min-w-0 flex-1`}
              >
                {modelOptions.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
                <option value={CUSTOM_MODEL_VALUE}>Custom model ID</option>
              </select>
              <button
                type="button"
                onClick={refreshModels}
                disabled={!props.byokUnlocked || isRefreshingModels}
                className="h-10 shrink-0 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              >
                {isRefreshingModels ? "Loading" : "Refresh"}
              </button>
            </div>
            {modelRefreshMessage ? (
              <span className="text-[11px] leading-5 text-slate-500">{modelRefreshMessage}</span>
            ) : null}
          </label>
        </div>

        {modelChoice === CUSTOM_MODEL_VALUE ? (
          <label className="grid gap-1.5">
            {fieldLabel("Custom model ID")}
            <input
              value={customModel}
              onChange={(event) => setCustomModel(event.target.value)}
              placeholder="provider/model-or-model-id"
              disabled={!props.byokUnlocked}
              required
              className={inputClass(!props.byokUnlocked)}
            />
          </label>
        ) : null}

        <label className="grid gap-1.5">
          {fieldLabel("Base URL")}
          <input
            key={`base:${providerId}`}
            name="baseUrl"
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
            placeholder={selected.defaultBaseUrl ?? "https://provider.example/v1"}
            disabled={baseDisabled}
            className={inputClass(baseDisabled)}
          />
          <span className="text-[11px] leading-5 text-slate-500">
            The provider default is inserted automatically, but you can edit it for proxies,
            gateways, or compatible deployments.
          </span>
        </label>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
          <label className="grid gap-1.5">
            {fieldLabel(props.hasAiKey ? "Rotate API key" : "API key")}
            <input
              name="apiKey"
              type="password"
              placeholder={
                props.hasAiKey ? "Leave blank to keep current key" : selected.keyHint
              }
              disabled={!props.byokUnlocked}
              className={inputClass(!props.byokUnlocked)}
            />
          </label>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-[11px] font-bold uppercase text-slate-500">Saved key</div>
            <div className="mt-1 text-sm font-bold">
              {props.hasAiKey ? "Encrypted key saved" : "No key saved"}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {props.keyUpdatedLabel ?? "Add a key to enable cloud providers."}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-slate-500">
            Changing providers updates the model and base URL automatically. Enter a new key when
            switching cloud providers.
          </p>
          <button
            disabled={!props.byokUnlocked}
            className="h-10 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
          >
            {props.hasAiKey ? "Save changes" : "Save provider"}
          </button>
        </div>
      </form>

      <form action={props.deleteAiApiKey} className="mt-3">
        <input type="hidden" name="filterQs" value={props.filterState} />
        <button
          disabled={!props.hasAiKey}
          className="h-10 w-full rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-bold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 sm:w-auto"
        >
          Delete saved API key
        </button>
      </form>
    </>
  );
}
