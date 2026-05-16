import Link from "next/link";

const proofPoints = [
  "RSS and arXiv ingestion",
  "SQLite local-first storage",
  "Multi-provider BYOK AI",
  "Exact-quote citation evidence",
];

const features = [
  {
    title: "Signal intake",
    copy: "Connect the sources your team already watches: technical blogs, vendor feeds, community channels, and arXiv categories.",
  },
  {
    title: "Research memory",
    copy: "Every item, extracted text block, summary, and citation is persisted so your team can search the record instead of re-reading feeds.",
  },
  {
    title: "Cited briefings",
    copy: "Generate concise AI briefs with exact quotes attached, giving leaders a source-backed view of what changed and why it matters.",
  },
  {
    title: "Operator controls",
    copy: "Filter by source, type, text, and summary state so analysts can triage what needs attention without leaving the workspace.",
  },
];

const useCases = [
  "AI labs tracking model releases, benchmark shifts, and paper velocity",
  "Platform teams monitoring cloud, infra, and ML engineering updates",
  "Founders turning a messy reading list into weekly investor-ready intelligence",
  "Research teams creating source-backed internal briefs without a heavy CMS",
];

const pricing = [
  {
    name: "Starter",
    price: "$29",
    period: "per seat / month",
    description: "For solo operators building a personal research command center.",
    points: [
      "25 sources",
      "Local SQLite workspace",
      "Manual ingest",
      "BYOK AI provider locked",
    ],
  },
  {
    name: "Team",
    price: "$149",
    period: "per workspace / month",
    description: "For teams that need a shared intelligence workflow.",
    points: [
      "Unlimited sources",
      "Shared brief queue",
      "OpenAI, Anthropic, OpenRouter, Groq, Mistral and more",
      "Export-ready summaries",
    ],
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "annual contract",
    description: "For regulated teams that need deployment and data controls.",
    points: ["Private deployment", "SSO roadmap", "Custom AI provider routing", "Onboarding support"],
  },
];

const faqs = [
  {
    q: "Is this only a marketing mockup?",
    a: "No. The demo links to the working product route with source ingestion, filtering, SQLite persistence, and AI summarization.",
  },
  {
    q: "Can it run with local AI?",
    a: "Yes. The current product is configured for an OpenAI-compatible endpoint and defaults nicely to local Ollama.",
  },
  {
    q: "What makes it sellable?",
    a: "The product has a clear buyer, a focused pain point, a live demo path, pricing, and a differentiated promise: cited research intelligence instead of another feed reader.",
  },
];

export default function MarketingHome() {
  return (
    <main className="min-h-dvh bg-[#f6f7f9] text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-950 text-xs font-black text-emerald-300">
              RR
            </span>
            <span>
              <span className="block text-sm font-bold">Research Radar</span>
              <span className="block text-[11px] font-medium text-slate-500">
                AI research intelligence
              </span>
            </span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-semibold text-slate-600 md:flex">
            <a href="#product" className="hover:text-slate-950">
              Product
            </a>
            <a href="#workflow" className="hover:text-slate-950">
              Workflow
            </a>
            <a href="#pricing" className="hover:text-slate-950">
              Pricing
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden h-10 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:inline-flex"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Sign up
            </Link>
          </div>
        </div>
      </header>

      <section className="relative isolate overflow-hidden bg-slate-950 text-white">
        <div className="absolute inset-0 opacity-20">
          <div className="h-full w-full bg-[linear-gradient(to_right,rgba(255,255,255,.14)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,.1)_1px,transparent_1px)] bg-[size:54px_54px]" />
        </div>
        <div className="absolute inset-x-0 bottom-0 h-28 bg-white" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 pb-0 pt-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_560px] lg:items-center lg:pt-24">
          <div className="pb-10 lg:pb-24">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-emerald-100">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
              Built for teams drowning in AI and engineering updates
            </div>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
              Research Radar
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
              A sellable AI research intelligence platform that turns feeds, papers, and technical
              blogs into cited briefings your customers can trust.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="inline-flex h-12 items-center justify-center rounded-xl bg-emerald-300 px-5 text-sm font-bold text-slate-950 hover:bg-emerald-200"
              >
                Start free workspace
              </Link>
              <Link
                href="/login"
                className="inline-flex h-12 items-center justify-center rounded-xl border border-white/20 px-5 text-sm font-bold text-white hover:bg-white/10"
              >
                Log in
              </Link>
              <a
                href="#pricing"
                className="inline-flex h-12 items-center justify-center rounded-xl border border-white/20 px-5 text-sm font-bold text-white hover:bg-white/10"
              >
                View pricing
              </a>
            </div>
            <div className="mt-8 grid gap-3 text-xs font-semibold text-slate-300 sm:grid-cols-2">
              {proofPoints.map((point) => (
                <div key={point} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
                  {point}
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="rounded-t-3xl border border-white/15 bg-white p-3 shadow-2xl">
              <div className="rounded-2xl border border-slate-200 bg-[#f6f7f9] p-3 text-slate-950">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div>
                    <div className="text-xs font-bold uppercase text-emerald-700">
                      Signal command center
                    </div>
                    <div className="mt-1 text-lg font-bold">Today&apos;s intelligence</div>
                  </div>
                  <div className="rounded-full bg-slate-950 px-3 py-1 text-[11px] font-bold text-white">
                    84% briefed
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[
                    ["Sources", "42"],
                    ["Items", "1,284"],
                    ["Pending", "19"],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="text-[11px] font-bold uppercase text-slate-500">{label}</div>
                      <div className="mt-1 text-xl font-black">{value}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 space-y-2">
                  {[
                    ["ARXIV", "New inference scaling result changes batch planning assumptions"],
                    ["RSS", "OpenAI platform update adds stronger eval controls"],
                    ["RSS", "Cloud ML team publishes cost controls for fine-tuning pipelines"],
                  ].map(([tag, title]) => (
                    <div key={title} className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700">
                          {tag}
                        </span>
                        <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-[10px] font-black text-cyan-700">
                          Cited brief
                        </span>
                      </div>
                      <div className="mt-2 text-sm font-bold leading-5">{title}</div>
                      <div className="mt-2 rounded-lg bg-slate-50 p-2 text-xs leading-5 text-slate-600">
                        Evidence-backed summary with exact quote citations attached.
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-3 px-4 py-5 text-center text-xs font-bold uppercase text-slate-400 sm:grid-cols-4 sm:px-6">
          <div>RSS</div>
          <div>arXiv</div>
          <div>Anthropic</div>
          <div>OpenAI-compatible providers</div>
        </div>
      </section>

      <section id="product" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="max-w-3xl">
          <div className="text-sm font-bold uppercase text-emerald-700">Product</div>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Sell the outcome, not another feed reader.
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Research Radar packages a messy, high-frequency workflow into a focused SaaS: capture
            sources, dedupe updates, summarize the important parts, and preserve citations for
            review.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <div key={feature.title} className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="text-base font-bold">{feature.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{feature.copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="workflow" className="bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[420px_minmax(0,1fr)]">
          <div>
            <div className="text-sm font-bold uppercase text-emerald-700">Workflow</div>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">
              From noisy feeds to board-ready context.
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              The core loop is simple enough to sell, demo, and support. Customers connect trusted
              sources, ingest updates, and generate source-backed intelligence when an item matters.
            </p>
          </div>
          <div className="grid gap-3">
            {["Connect sources", "Ingest records", "Generate cited briefs", "Search the memory"].map(
              (step, index) => (
                <div key={step} className="flex gap-4 rounded-2xl border border-slate-200 p-4">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-950 text-sm font-black text-white">
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-bold">{step}</div>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {index === 0
                        ? "Seed high-value channels or add a customer-specific feed URL."
                        : index === 1
                          ? "Normalize titles, authors, publish dates, links, and extracted text."
                          : index === 2
                            ? "Create concise AI summaries with exact source quotes attached."
                            : "Filter the stored research base by source, type, text, and brief state."}
                    </p>
                  </div>
                </div>
              ),
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="rounded-3xl bg-slate-950 p-6 text-white sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center">
            <div>
              <div className="text-sm font-bold uppercase text-emerald-300">Use cases</div>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">
                Built for customers who need signal before everyone else.
              </h2>
            </div>
            <div className="grid gap-3">
              {useCases.map((useCase) => (
                <div key={useCase} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-sm font-semibold leading-6 text-slate-100">{useCase}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-sm font-bold uppercase text-emerald-700">Pricing</div>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">Package it to sell.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
              These are launch-ready pricing anchors for a SaaS pilot. The product demo can validate
              demand before you add billing, auth, and team administration.
            </p>
          </div>
          <Link
            href="/radar"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-bold text-white hover:bg-slate-800"
          >
            Try the product
          </Link>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {pricing.map((plan) => (
            <div
              key={plan.name}
              className={[
                "rounded-2xl border p-6",
                plan.featured
                  ? "border-slate-950 bg-slate-950 text-white"
                  : "border-slate-200 bg-white text-slate-950",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold">{plan.name}</h3>
                  <p
                    className={[
                      "mt-2 text-sm leading-6",
                      plan.featured ? "text-slate-300" : "text-slate-600",
                    ].join(" ")}
                  >
                    {plan.description}
                  </p>
                </div>
                {plan.featured ? (
                  <span className="rounded-full bg-emerald-300 px-3 py-1 text-[11px] font-black text-slate-950">
                    Best fit
                  </span>
                ) : null}
              </div>
              <div className="mt-6">
                <span className="text-4xl font-black">{plan.price}</span>
                <span className={plan.featured ? "ml-2 text-sm text-slate-300" : "ml-2 text-sm text-slate-500"}>
                  {plan.period}
                </span>
              </div>
              <ul className="mt-6 grid gap-3 text-sm">
                {plan.points.map((point) => (
                  <li key={point} className="flex gap-2">
                    <span className={plan.featured ? "text-emerald-300" : "text-emerald-700"}>
                      +
                    </span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="grid gap-8 lg:grid-cols-[360px_minmax(0,1fr)]">
            <div>
              <div className="text-sm font-bold uppercase text-emerald-700">FAQ</div>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">Sales-ready answers.</h2>
            </div>
            <div className="grid gap-3">
              {faqs.map((faq) => (
                <div key={faq.q} className="rounded-2xl border border-slate-200 p-5">
                  <h3 className="font-bold">{faq.q}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-7xl rounded-3xl bg-emerald-300 p-6 text-slate-950 sm:p-10">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-center">
            <div>
              <h2 className="text-3xl font-black tracking-tight">
                Turn Research Radar into your next SaaS offer.
              </h2>
              <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-800">
                The demo is live, the positioning is clear, and the product has a concrete workflow
                customers can understand in one call.
              </p>
            </div>
            <Link
              href="/radar"
              className="inline-flex h-12 items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-black text-white hover:bg-slate-800"
            >
              Open the product
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
