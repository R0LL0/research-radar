import type { SourceType } from "@prisma/client";

export type ExportItem = {
  id: string;
  title: string;
  author: string | null;
  url: string | null;
  publishedAt: Date | null;
  source: { title: string | null; url: string; type: SourceType };
  content: { text: string } | null;
  summary: { model: string; summaryMd: string; citations: unknown } | null;
};

function formatCitationList(citations: unknown) {
  if (!Array.isArray(citations) || !citations.length) return "";
  return citations
    .slice(0, 8)
    .map((c, i) => {
      const quote = typeof (c as { quote?: unknown })?.quote === "string" ? (c as { quote: string }).quote : "";
      return `${i + 1}. "${quote}"`;
    })
    .join("\n");
}

export function buildBriefingsMarkdown(items: ExportItem[], meta: { title: string; generatedAt: Date }) {
  const lines: string[] = [
    `# ${meta.title}`,
    "",
    `Generated: ${meta.generatedAt.toISOString()}`,
    `Items: ${items.length}`,
    "",
    "---",
    "",
  ];

  for (const item of items) {
    lines.push(`## ${item.title}`);
    lines.push("");
    lines.push(`- **Source:** ${item.source.title ?? item.source.url} (${item.source.type})`);
    if (item.author) lines.push(`- **Author:** ${item.author}`);
    if (item.publishedAt) lines.push(`- **Published:** ${item.publishedAt.toISOString()}`);
    if (item.url) lines.push(`- **Link:** ${item.url}`);
    lines.push("");

    if (item.summary?.summaryMd) {
      lines.push("### Briefing");
      lines.push("");
      lines.push(item.summary.summaryMd);
      lines.push("");
      const cites = formatCitationList(item.summary.citations);
      if (cites) {
        lines.push("### Citations");
        lines.push("");
        lines.push(cites);
        lines.push("");
      }
    } else if (item.content?.text) {
      lines.push("### Excerpt");
      lines.push("");
      lines.push(item.content.text.slice(0, 1200));
      lines.push("");
    }

    lines.push("---");
    lines.push("");
  }

  return lines.join("\n");
}

export function buildBriefingsHtml(items: ExportItem[], meta: { title: string; generatedAt: Date }) {
  const md = buildBriefingsMarkdown(items, meta);
  const escaped = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
  .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br/>");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>${meta.title}</title>
  <style>
    body { font-family: Georgia, serif; max-width: 720px; margin: 2rem auto; line-height: 1.55; color: #0f172a; }
    h1 { font-size: 1.75rem; }
    h2 { margin-top: 2rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.25rem; }
    h3 { margin-top: 1rem; color: #334155; }
    li { margin: 0.35rem 0; }
    @media print { body { margin: 1cm; } }
  </style>
</head>
<body>
  <p>${escaped}</p>
</body>
</html>`;
}
