import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashPassword, normalizeEmail, validateEmail, validatePassword, verifyPassword } from "./password";
import { createSession, deleteSession, getSessionUser } from "./session";

export const LEGACY_WORKSPACE_ID = "legacy-local";

export type WorkspaceContext = {
  workspaceId: string;
  userId: string | null;
  email: string | null;
};

export async function getWorkspaceContext(): Promise<WorkspaceContext> {
  const session = await getSessionUser();
  if (session) {
    return {
      workspaceId: session.user.workspaceId,
      userId: session.user.id,
      email: session.user.email,
    };
  }

  if (process.env.AUTH_OPTIONAL === "true") {
    await ensureLegacyWorkspace();
    return { workspaceId: LEGACY_WORKSPACE_ID, userId: null, email: null };
  }

  redirect("/login");
}

export async function getOptionalSessionUser() {
  return getSessionUser();
}

export async function ensureLegacyWorkspace() {
  await db.workspace.upsert({
    where: { id: LEGACY_WORKSPACE_ID },
    update: {},
    create: { id: LEGACY_WORKSPACE_ID, name: "Local workspace" },
  });
  await db.workspaceSettings.upsert({
    where: { workspaceId: LEGACY_WORKSPACE_ID },
    update: {},
    create: { workspaceId: LEGACY_WORKSPACE_ID },
  });
}

async function createUserWithWorkspace(args: { email: string; name: string | null; password: string }) {
  const passwordHash = await hashPassword(args.password);

  return db.$transaction(async (tx) => {
    const workspace = await tx.workspace.create({
      data: { name: args.name ? `${args.name}'s workspace` : "My workspace" },
    });
    await tx.workspaceSettings.create({ data: { workspaceId: workspace.id } });
    const user = await tx.user.create({
      data: {
        email: args.email,
        name: args.name,
        passwordHash,
        workspaceId: workspace.id,
      },
    });
    return user;
  });
}

export async function signUpUser(input: {
  email: string;
  password: string;
  name?: string | null;
}) {
  const emailError = validateEmail(input.email);
  if (emailError) return { error: emailError };

  const passwordError = validatePassword(input.password);
  if (passwordError) return { error: passwordError };

  const email = normalizeEmail(input.email);
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return { error: "An account with this email already exists." };

  const user = await createUserWithWorkspace({
    email,
    name: input.name?.trim() || null,
    password: input.password,
  });

  await createSession(user.id);
  return { ok: true as const };
}

export async function signInUser(input: { email: string; password: string }) {
  const emailError = validateEmail(input.email);
  if (emailError) return { error: emailError };

  const email = normalizeEmail(input.email);
  const user = await db.user.findUnique({ where: { email } });
  if (!user) return { error: "Invalid email or password." };

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) return { error: "Invalid email or password." };

  await createSession(user.id);
  return { ok: true as const };
}

export async function signOutUser() {
  await deleteSession();
}

export { getSessionUser, createSession, deleteSession } from "./session";
