# Research Radar

**Local-first research intelligence** — ingest RSS and arXiv, store everything in SQLite, and generate **AI briefings with exact-quote citations**. Built for operators who want a private command center, with an optional SaaS path (accounts, workspaces, BYOK).

[Launch app → `/radar`](http://localhost:3000/radar) · [Marketing site → `/`](http://localhost:3000)

---

## Why it exists

Feeds are noisy. Reading everything is slow. Copy-pasting into ChatGPT loses provenance. Research Radar:

1. **Pulls** from RSS and arXiv on a schedule or on demand  
2. **Remembers** titles, extracted text, and prior briefings in your database  
3. **Briefs** with markdown summaries where every claim can jump back to a **verbatim quote** in the source  

---

## Highlights

| Area | What you get |
|------|----------------|
| **Ingest** | RSS + arXiv, deduped items, article text extraction, source health tracking |
| **Briefings** | One-click brief, smart pulse (article + HN discussion), batch “Brief all new” with progress |
| **Citations** | Click a quote → scroll and highlight in source text |
| **Intelligence** | Signal scores, story clusters, watchlist terms, daily digest + optional webhook |
| **Discovery** | Paste a site URL → suggest RSS/Atom feeds |
| **Export** | Markdown download or print-friendly HTML (PDF via browser) |
| **Automation** | Auto-ingest interval, CLI/cron hook (`/api/cron/ingest`) |
| **Auth** | Email/password signup, per-user workspace isolation |
| **AI** | Local **Ollama** by default, or **BYOK** cloud keys (OpenAI, Anthropic, Groq, …) on Team plan |

---

## Stack

- **Next.js 16** (App Router) + React 19 + TypeScript  
- **Prisma 6** + **SQLite** (`dev.db` on disk — no Docker DB required)  
- **AI**: OpenAI-compatible chat completions (+ native Anthropic path for BYOK)  
- **Auth**: scrypt passwords, httpOnly session cookie, AES-256-GCM for stored API keys  

---

## Quick start

### Prerequisites

- **Node.js 20+**
- **Ollama** (recommended for local AI) — [https://ollama.com](https://ollama.com)

### 1. Clone and install

```bash
git clone https://github.com/R0LL0/research-radar.git
cd research-radar
npm install
```

### 2. Environment

```bash
cp .env.example .env
```

Edit `.env` if needed. Defaults target **Ollama** at `http://127.0.0.1:11434/v1`.

Pull a model (name must match `AI_MODEL`):

```bash
ollama pull llama3.2
```

### 3. Database

```bash
npx prisma migrate dev
```

### 4. Run

```bash
npm run dev
```

| URL | Purpose |
|-----|---------|
| [http://localhost:3000](http://localhost:3000) | Landing / marketing |
| [http://localhost:3000/signup](http://localhost:3000/signup) | Create account |
| [http://localhost:3000/radar](http://localhost:3000/radar) | Main product (requires login) |

---

## First session (5 minutes)

1. **Sign up** at `/signup` — you get a private workspace.  
2. Open **Sources** → add a feed or use **Discover feed from site** (homepage URL).  
3. **Ingest** (per source or **Refresh feeds** on Briefings).  
4. Open **Briefings** → **Generate brief** on an item (needs Ollama running).  
5. Click a citation quote to see it highlighted in the source text.  

**Recommended starter sources** (built into the UI): Hacker News, arXiv cs.AI / cs.LG, major AI blogs.

---

## AI configuration

### Option A — Local Ollama (default)

In `.env`:

```env
AI_BASE_URL="http://127.0.0.1:11434/v1"
AI_MODEL="llama3.2:latest"
AI_API_KEY=""
```

On Windows, use `127.0.0.1` instead of `localhost` if the app cannot reach Ollama.

Verify:

```bash
ollama list
curl http://127.0.0.1:11434/api/tags
```

### Option B — Your own cloud API key (BYOK)

1. In Radar → **Settings** → set **Workspace plan** to **Team** (dev toggle; no Stripe yet).  
2. Under **AI provider routing**, choose provider (OpenAI, Anthropic, Groq, OpenRouter, …).  
3. Paste **API key** → **Save** (encrypted in SQLite).  
4. Briefings use **your** key and model, not the server `.env`.  

Ollama / LM Studio as BYOK providers do not require an API key — only base URL + model.

### Option C — Server-wide cloud key (`.env`)

Set `AI_BASE_URL`, `AI_API_KEY`, and `AI_MODEL` for all workspaces still on **Starter** without saved BYOK settings.

---

## Auth & workspaces

- Each account has one **workspace** (sources, items, briefings, settings are isolated).  
- Sessions last **30 days** (`rr_session` cookie).  
- **Production**: set `AUTH_SECRET` in `.env` (see `.env.example`).  

**Local dev without login** (access pre-migration `legacy-local` data only):

```env
AUTH_OPTIONAL=true
```

Do **not** enable this on a public deployment.

---

## Automation

### In-app

**Settings → Automation**: auto-ingest interval while the app is open.

### Cron / Task Scheduler

```bash
npm run ingest:cron
```

Calls `GET /api/cron/ingest`. Optional:

```env
CRON_SECRET="your-secret"
RADAR_BASE_URL="http://127.0.0.1:3000"
```

Pass secret as `Authorization: Bearer …` or `?secret=…`.

### Digest webhook

**Settings → Automation** → enable webhook URL. Generating a digest POSTs JSON to Slack/Zapier/etc.

---

## Environment reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | SQLite path, e.g. `file:./dev.db` |
| `AUTH_SECRET` | Prod | Session + encryption salt |
| `AUTH_OPTIONAL` | No | `true` = skip login (local only) |
| `AI_BASE_URL` | No | Default OpenAI-compatible endpoint |
| `AI_API_KEY` | No | Default API key (cloud) |
| `AI_MODEL` | No | Default model name |
| `AI_SETTINGS_SECRET` | No | Override for BYOK encryption |
| `CRON_SECRET` | No | Protect `/api/cron/ingest` |
| `RADAR_BASE_URL` | No | Base URL for `ingest:cron` script |

---

## Scripts

```bash
npm run dev          # Development server
npm run build        # Production build
npm run start        # Run production server
npm run lint         # ESLint
npm run ingest:cron  # Trigger scheduled ingest via HTTP
```

---

## Project layout

```
prisma/           Schema + migrations (SQLite)
src/app/radar/    Main intelligence UI
src/app/actions.ts Server actions (ingest, brief, settings)
src/lib/          AI, ingest, auth, intelligence, export
src/components/   UI (citations, batch jobs, auth forms)
scripts/          Cron helper
```

---

## Deploying (outline)

SQLite is ideal for **single-user local** use. For multi-tenant hosting:

1. Switch Prisma to **PostgreSQL** (or Turso).  
2. Set strong `AUTH_SECRET`; never use `AUTH_OPTIONAL`.  
3. Do not rely on a shared `AI_API_KEY` in `.env` — require BYOK or a dedicated inference proxy.  
4. Run `npx prisma migrate deploy` + `npm run build` + `npm run start`.  

---

## Roadmap (not yet shipped)

- Stripe billing tied to Starter / Team  
- OAuth (Google/GitHub) + password reset  
- Team invites (shared workspace)  
- Real background job worker (vs. browser-polled batch brief)  
- Shareable digest links  

---

## License

MIT — see [LICENSE](LICENSE).
