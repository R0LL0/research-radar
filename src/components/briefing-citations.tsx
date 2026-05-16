"use client";

import { useCallback, useMemo, useState } from "react";

type Citation = { quote?: unknown };

function normalizeQuote(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function findQuoteRange(source: string, quote: string): { start: number; end: number } | null {
  const needle = quote.trim();
  if (!needle || !source) return null;

  const direct = source.indexOf(needle);
  if (direct >= 0) return { start: direct, end: direct + needle.length };

  const compactNeedle = normalizeQuote(needle);
  const window = Math.min(source.length, 8000);
  const slice = source.slice(0, window);
  const compactSource = normalizeQuote(slice);
  const compactIndex = compactSource.indexOf(compactNeedle);
  if (compactIndex < 0) return null;

  const ratio = slice.length / Math.max(compactSource.length, 1);
  const start = Math.floor(compactIndex * ratio);
  const end = Math.min(source.length, start + needle.length + 40);
  return { start, end };
}

export function BriefingCitations(props: {
  itemId: string;
  sourceText: string | null;
  citations: Citation[];
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const sourceText = props.sourceText ?? "";

  const highlight = useMemo(() => {
    if (activeIndex === null) return null;
    const quote = String(props.citations[activeIndex]?.quote ?? "");
    return findQuoteRange(sourceText, quote);
  }, [activeIndex, props.citations, sourceText]);

  const onCitationClick = useCallback(
    (index: number) => {
      setActiveIndex(index);
      document.getElementById(`source-text-${props.itemId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    },
    [props.itemId],
  );

  if (!props.citations.length) return null;

  return (
    <>
      <EvidenceList citations={props.citations} activeIndex={activeIndex} onPick={onCitationClick} />
      {sourceText ? (
        <div
          id={`source-text-${props.itemId}`}
          className="mt-4 scroll-mt-24 rounded-xl border border-slate-200 bg-white p-4"
        >
          <div className="text-xs font-bold uppercase text-slate-500">
            Source text
            {activeIndex !== null ? (
              <span className="text-amber-700"> · highlighted</span>
            ) : null}
          </div>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">
            {highlight ? (
              <>
                {sourceText.slice(0, highlight.start)}
                <mark className="rounded bg-amber-200 px-0.5 text-slate-900 ring-2 ring-amber-300">
                  {sourceText.slice(highlight.start, highlight.end)}
                </mark>
                {sourceText.slice(highlight.end, 6000)}
                {sourceText.length > 6000 ? "…" : ""}
              </>
            ) : (
              sourceText.slice(0, 6000) + (sourceText.length > 6000 ? "…" : "")
            )}
          </p>
        </div>
      ) : null}
    </>
  );
}

function EvidenceList({
  citations,
  activeIndex,
  onPick,
}: {
  citations: Citation[];
  activeIndex: number | null;
  onPick: (index: number) => void;
}) {
  return (
    <div className="mt-4 border-t border-slate-200 pt-4">
      <div className="text-xs font-bold uppercase text-slate-500">
        Evidence · click a quote to jump to source
      </div>
      <ul className="mt-2 grid gap-2 md:grid-cols-2">
        {citations.slice(0, 6).map((c, idx) => (
          <li key={idx}>
            <button
              type="button"
              onClick={() => onPick(idx)}
              className={[
                "w-full rounded-lg border p-3 text-left text-xs leading-5 transition",
                activeIndex === idx
                  ? "border-amber-400 bg-amber-50 text-slate-800 ring-2 ring-amber-200"
                  : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50",
              ].join(" ")}
            >
              &quot;{String(c.quote)}&quot;
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
