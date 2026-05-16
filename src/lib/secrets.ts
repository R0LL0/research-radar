import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const PREFIX = "rr:v1";

function secretKey() {
  const secret =
    process.env.AI_SETTINGS_SECRET ??
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    process.env.DATABASE_URL ??
    "research-radar-local-dev-secret";
  return createHash("sha256").update(secret).digest();
}

export function encryptSecret(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, secretKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(
    ".",
  );
}

export function decryptSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  const [prefix, ivRaw, tagRaw, encryptedRaw] = value.split(".");
  if (prefix !== "rr:v1" || !ivRaw || !tagRaw || !encryptedRaw) return null;

  try {
    const decipher = createDecipheriv(ALGORITHM, secretKey(), Buffer.from(ivRaw, "base64"));
    decipher.setAuthTag(Buffer.from(tagRaw, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedRaw, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}
