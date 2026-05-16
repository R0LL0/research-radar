import Link from "next/link";
import type { ReactNode } from "react";

export function AuthShell({
  title,
  subtitle,
  children,
  alternate,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  alternate: { href: string; label: string; cta: string };
}) {
  return (
    <main className="min-h-dvh bg-[#f5f7fb] text-slate-950">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
        <Link href="/" className="mb-8 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-300 text-sm font-black text-slate-950">
            RR
          </span>
          <span>
            <span className="block text-sm font-semibold">Research Radar</span>
            <span className="block text-xs text-slate-500">SaaS intelligence workspace</span>
          </span>
        </Link>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-black tracking-tight">{title}</h1>
          <p className="mt-1 text-sm leading-6 text-slate-500">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </section>

        <p className="mt-6 text-center text-sm text-slate-500">
          {alternate.label}{" "}
          <Link href={alternate.href} className="font-bold text-emerald-700 hover:text-emerald-800">
            {alternate.cta}
          </Link>
        </p>
      </div>
    </main>
  );
}
