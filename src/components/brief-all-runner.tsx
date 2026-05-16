"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type JobState = {
  id: string;
  status: string;
  progress: number;
  total: number;
  message: string | null;
};

export function BriefAllRunner({ jobId }: { jobId: string | null }) {
  const router = useRouter();
  const [job, setJob] = useState<JobState | null>(null);
  const running = useRef(false);

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      return;
    }
    const activeJobId = jobId;

    let cancelled = false;

    async function tick() {
      if (running.current || cancelled) return;
      running.current = true;
      try {
        const res = await fetch(`/api/jobs/${encodeURIComponent(activeJobId)}/tick`, {
          method: "POST",
        });
        if (!res.ok) return;
        const next = (await res.json()) as JobState;
        if (cancelled) return;
        setJob(next);
        if (next.status === "DONE" || next.status === "FAILED") {
          router.refresh();
        }
      } finally {
        running.current = false;
      }
    }

    void tick();
    const interval = setInterval(() => void tick(), 2500);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [jobId, router]);

  if (!jobId || !job) return null;
  if (job.status === "DONE" || job.status === "FAILED") return null;

  const pct = job.total > 0 ? Math.round((job.progress / job.total) * 100) : 0;

  return (
    <BriefAllProgress job={job} pct={pct} />
  );
}

function BriefAllProgress({ job, pct }: { job: JobState; pct: number }) {
  return (
    <div className="mt-3 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-bold">Batch briefing in progress</span>
        <span className="text-xs font-semibold">
          {job.progress}/{job.total} ({pct}%)
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-cyan-100">
        <div className="h-full rounded-full bg-cyan-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      {job.message ? <p className="mt-2 text-xs text-cyan-800">{job.message}</p> : null}
    </div>
  );
}
