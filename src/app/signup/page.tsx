import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { signUp } from "@/app/auth/actions";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; next?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const error = sp.error ? decodeURIComponent(sp.error) : null;
  const next = sp.next ?? "/radar";

  return (
    <AuthShell
      title="Create your workspace"
      subtitle="Start on Starter (free tier locally). Your feeds, briefings, and AI keys are isolated to this account."
      alternate={{ label: "Already have an account?", href: "/login", cta: "Sign in" }}
    >
      {error ? (
        <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}
      <form action={signUp} className="grid gap-4">
        <input type="hidden" name="next" value={next} />
        <label className="grid gap-1.5">
          <span className="text-[11px] font-bold uppercase text-slate-500">Name</span>
          <input
            name="name"
            type="text"
            autoComplete="name"
            placeholder="Optional"
            className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-[11px] font-bold uppercase text-slate-500">Email</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-[11px] font-bold uppercase text-slate-500">Password</span>
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
          <span className="text-[11px] text-slate-400">At least 8 characters</span>
        </label>
        <button
          type="submit"
          className="h-11 rounded-xl bg-emerald-500 text-sm font-bold text-white hover:bg-emerald-600"
        >
          Create account
        </button>
      </form>
      <p className="mt-4 text-center text-xs leading-5 text-slate-400">
        By signing up you get a private SQLite-backed workspace on this instance.{" "}
        <Link href="/" className="hover:text-slate-600">
          Learn more
        </Link>
      </p>
    </AuthShell>
  );
}
