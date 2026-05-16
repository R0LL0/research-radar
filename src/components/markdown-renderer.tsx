import type { ReactNode } from "react";

type ListItem = {
  text: string;
  children: string[];
};

const SECTION_STYLES: Array<[RegExp, { icon: string; className: string }]> = [
  [/vibe|sentiment/i, { icon: "😊", className: "border-emerald-200 bg-emerald-50 text-emerald-900" }],
  [/worr|risk|concern/i, { icon: "⚠️", className: "border-amber-200 bg-amber-50 text-amber-900" }],
  [/disagreement|debate|pushback/i, { icon: "🥊", className: "border-rose-200 bg-rose-50 text-rose-900" }],
  [/takeaway|action|practical/i, { icon: "✅", className: "border-cyan-200 bg-cyan-50 text-cyan-900" }],
  [/question|follow/i, { icon: "❓", className: "border-violet-200 bg-violet-50 text-violet-900" }],
  [/signal|summary|core/i, { icon: "🧠", className: "border-slate-200 bg-white text-slate-950" }],
];

function renderInline(text: string) {
  const parts: ReactNode[] = [];
  const pattern = /\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <strong key={`${match.index}-${match[1]}`} className="font-bold text-slate-900">
        {match[1]}
      </strong>,
    );
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length ? parts : text;
}

function headingStyle(text: string) {
  const cleaned = text.replace(/[^\p{L}\p{N}\s]/gu, "");
  return (
    SECTION_STYLES.find(([pattern]) => pattern.test(cleaned))?.[1] ?? {
      icon: "✦",
      className: "border-slate-200 bg-white text-slate-950",
    }
  );
}

function flushList(items: ListItem[], blocks: ReactNode[]) {
  if (!items.length) return;
  blocks.push(
    <ul key={`list-${blocks.length}`} className="grid gap-2 pl-5 text-sm leading-6 text-slate-700">
      {items.map((item, index) => (
        <li key={`${index}-${item.text}`} className="list-disc">
          <span>{renderInline(item.text)}</span>
          {item.children.length ? (
            <ul className="mt-1.5 grid gap-1.5 pl-5">
              {item.children.map((child, childIndex) => (
                <li key={`${childIndex}-${child}`} className="list-[circle]">
                  {renderInline(child)}
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ul>,
  );
  items.length = 0;
}

export function MarkdownRenderer({ markdown }: { markdown: string }) {
  const blocks: ReactNode[] = [];
  const listItems: ListItem[] = [];

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      flushList(listItems, blocks);
      continue;
    }

    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    if (heading) {
      flushList(listItems, blocks);
      blocks.push(
        <h4
          key={`heading-${blocks.length}`}
          className={[
            "mt-1 inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs font-black uppercase",
            headingStyle(heading[2]).className,
          ].join(" ")}
        >
          <span className="briefing-icon">{headingStyle(heading[2]).icon}</span>
          <span>{renderInline(heading[2].replace(/^[^\p{L}\p{N}]+/u, ""))}</span>
        </h4>,
      );
      continue;
    }

    const bullet = /^(\s*)[-*]\s+(.+)$/.exec(rawLine);
    if (bullet) {
      const indent = bullet[1].replace(/\t/g, "  ").length;
      const text = bullet[2].trim();
      if (indent > 0 && listItems.length) {
        listItems[listItems.length - 1]!.children.push(text);
      } else {
        listItems.push({ text, children: [] });
      }
      continue;
    }

    if (listItems.length && /^\s{2,}\S/.test(rawLine)) {
      const current = listItems[listItems.length - 1]!;
      if (current.children.length) {
        const childIndex = current.children.length - 1;
        current.children[childIndex] = `${current.children[childIndex]} ${line}`;
      } else {
        current.text = `${current.text} ${line}`;
      }
      continue;
    }

    flushList(listItems, blocks);
    blocks.push(
      <p key={`paragraph-${blocks.length}`} className="text-sm leading-6 text-slate-700">
        {renderInline(line)}
      </p>,
    );
  }

  flushList(listItems, blocks);

  return <div className="mt-3 grid gap-3">{blocks}</div>;
}
