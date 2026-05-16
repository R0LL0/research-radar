import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { signIn } from "@/app/auth/actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; next?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const error = sp.error ? decodeURIComponent(sp.error) : null;
  const next = sp.next ?? "/radar";

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your workspace — sources, briefings, and digests stay private to your account."
      alternate={{ label: "New here?", href: "/signup", cta: "Create an account" }}
    >
      {error ? (
        <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}
      <form action={signIn} className="grid gap-4">
        <input type="hidden" name="next" value={next} />
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
            autoComplete="current-password"
            required
            className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </label>
        <button
          type="submit"
          className="h-11 rounded-xl bg-slate-950 text-sm font-bold text-white hover:bg-slate-800"
        >
          Sign in
        </button>
      </form>
      <p className="mt-4 text-center text-xs text-slate-400">
        <Link href="/" className="hover:text-slate-600">
          Back to marketing site
        </Link>
      </p>
    </AuthShell>
  );
}
