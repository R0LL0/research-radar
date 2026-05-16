export async function sendDigestWebhook(args: {
  url: string;
  title: string;
  digestMd: string;
  stats?: Record<string, unknown>;
}) {
  const res = await fetch(args.url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: args.title,
      text: args.digestMd.slice(0, 4000),
      markdown: args.digestMd,
      stats: args.stats ?? {},
      source: "research-radar",
      sentAt: new Date().toISOString(),
    }),
    signal: AbortSignal.timeout(15_000),
  }).catch((error: unknown) => {
    throw error instanceof Error ? error : new Error("Webhook request failed");
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Webhook returned ${res.status}: ${body.slice(0, 300)}`);
  }
}
