"use server";

import { redirect } from "next/navigation";
import { signInUser, signOutUser, signUpUser } from "@/lib/auth";

function safeNextPath(value: FormDataEntryValue | null) {
  const next = String(value ?? "").trim();
  if (next.startsWith("/") && !next.startsWith("//")) return next;
  return "/radar";
}

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim() || null;

  const result = await signUpUser({ email, password, name });
  if ("error" in result && result.error) {
    redirect(`/signup?error=${encodeURIComponent(result.error)}`);
  }

  redirect(safeNextPath(formData.get("next")));
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const result = await signInUser({ email, password });
  if ("error" in result && result.error) {
    redirect(`/login?error=${encodeURIComponent(result.error)}`);
  }

  redirect(safeNextPath(formData.get("next")));
}

export async function signOut() {
  await signOutUser();
  redirect("/login");
}
