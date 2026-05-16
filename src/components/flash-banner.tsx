"use client";

import { useEffect, useState } from "react";

export type Flash = { kind: "error" | "success"; message: string; itemId?: string };

const RR_FLASH = "rr_flash";

function clearFlashCookieClient() {
  document.cookie = `${RR_FLASH}=; Path=/; Max-Age=0; SameSite=Lax`;
}

function FlashNotice({
  flash,
  className = "",
  compact = false,
}: {
  flash: Flash | null;
  className?: string;
  compact?: boolean;
}) {
  const [dismissedMessage, setDismissedMessage] = useState<string | null>(null);
  const shown = flash && flash.message !== dismissedMessage ? flash : null;

  // Drop the cookie via document.cookie only.
  // (Calling a Server Action here refreshes the route and wipes the banner immediately.)
  useEffect(() => {
    if (!flash) return;
    clearFlashCookieClient();
  }, [flash]);

  // Auto-hide after reading time; cookie is already cleared so it won't repeat on refresh.
  useEffect(() => {
    if (!shown) return;
    const message = shown.message;
    const t = window.setTimeout(() => setDismissedMessage(message), 12_000);
    return () => window.clearTimeout(t);
  }, [shown]);

  if (!shown) return null;

  return (
    <div
      className={[
        "flex items-start justify-between gap-4 rounded-2xl border px-4 py-3 text-sm shadow-sm",
        compact ? "" : "mb-6",
        shown.kind === "error"
          ? "border-rose-300 bg-rose-50 text-rose-900"
          : "border-emerald-300 bg-emerald-50 text-emerald-900",
        className,
      ].join(" ")}
      role="status"
      aria-live="polite"
    >
      <p className="min-w-0 flex-1 font-medium leading-relaxed">{shown.message}</p>
      <button
        type="button"
        onClick={() => setDismissedMessage(shown.message)}
        className={[
          "shrink-0 rounded-lg border px-2 py-1 text-[11px] font-semibold",
          shown.kind === "error"
            ? "border-rose-200 bg-white text-rose-800 hover:bg-rose-100"
            : "border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-100",
        ].join(" ")}
      >
        Dismiss
      </button>
    </div>
  );
}

export function FlashBanner({ flash }: { flash: Flash | null }) {
  if (flash?.itemId) return null;
  return <FlashNotice flash={flash} />;
}

export function InlineFlash({ flash }: { flash: Flash | null }) {
  return <FlashNotice flash={flash} compact className="mt-3" />;
}
