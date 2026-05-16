"use client";

import { useEffect, useRef, useTransition } from "react";

type Props = {
  enabled: boolean;
  filterState: string;
  ingestAll: (formData: FormData) => Promise<void>;
};

const SESSION_KEY = "rr_auto_refresh_at";
const COOLDOWN_MS = 20 * 60 * 1000;

export function AutoRefreshFeeds({ enabled, filterState, ingestAll }: Props) {
  const started = useRef(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!enabled || started.current) return;

    const last = Number(window.sessionStorage.getItem(SESSION_KEY) ?? "0");
    if (Number.isFinite(last) && Date.now() - last < COOLDOWN_MS) return;

    started.current = true;
    window.sessionStorage.setItem(SESSION_KEY, String(Date.now()));

    const formData = new FormData();
    formData.set("filterQs", filterState);
    startTransition(() => {
      void ingestAll(formData);
    });
  }, [enabled, filterState, ingestAll]);

  if (!enabled && !pending) return null;

  return (
    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700">
      {pending ? "🔄 Auto-refreshing" : "⏱️ Auto-refresh ready"}
    </span>
  );
}
