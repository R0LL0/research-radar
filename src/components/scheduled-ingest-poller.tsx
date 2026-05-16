"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

export function ScheduledIngestPoller({
  enabled,
  intervalMinutes,
}: {
  enabled: boolean;
  intervalMinutes: number;
}) {
  const router = useRouter();
  const lastRun = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const pollMs = Math.max(60_000, Math.min(intervalMinutes * 60_000, 15 * 60_000));

    async function run() {
      if (Date.now() - lastRun.current < pollMs - 5000) return;
      lastRun.current = Date.now();
      try {
        const res = await fetch("/api/cron/ingest", { method: "POST" });
        const data = (await res.json()) as { ran?: boolean };
        if (data.ran) router.refresh();
      } catch {
        // ignore background failures
      }
    }

    void run();
    const id = setInterval(() => void run(), pollMs);
    return () => clearInterval(id);
  }, [enabled, intervalMinutes, router]);

  return null;
}
