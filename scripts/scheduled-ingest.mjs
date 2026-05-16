#!/usr/bin/env node

const base = process.env.RADAR_BASE_URL ?? "http://127.0.0.1:3000";
const secret = process.env.CRON_SECRET ?? "";
const url = new URL("/api/cron/ingest", base);
if (secret) url.searchParams.set("secret", secret);

const res = await fetch(url, { method: "GET" });
const body = await res.text();
if (!res.ok) {
  console.error(`Ingest failed (${res.status}):`, body);
  process.exit(1);
}
console.log(body);
