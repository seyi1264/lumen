import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const globalBufferRef = globalThis as typeof globalThis & {
  __lumenBufferPreviewSecret__?: string;
};

function encryptionKey(): Uint8Array {
  let secret = process.env.BETTER_AUTH_SECRET?.trim();
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("BETTER_AUTH_SECRET must be configured to store Buffer credentials.");
    }
    globalBufferRef.__lumenBufferPreviewSecret__ ??= randomBytes(32).toString("hex");
    secret = globalBufferRef.__lumenBufferPreviewSecret__;
  }
  return createHash("sha256").update(`lumen-buffer-key:${secret}`).digest();
}

export function encryptBufferApiKey(userId: string, apiKey: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(userId));
  const encrypted = Buffer.concat([cipher.update(apiKey, "utf8"), cipher.final()]);
  return [iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptBufferApiKey(userId: string, ciphertext: string): string {
  const [ivText, tagText, encryptedText] = ciphertext.split(".");
  if (!ivText || !tagText || !encryptedText) throw new Error("Stored Buffer credential is invalid.");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivText, "base64url"),
  );
  decipher.setAAD(Buffer.from(userId));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export async function bufferGraphql<T>(
  apiKey: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch("https://api.buffer.com", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(15_000),
  });

  const payload = (await response.json().catch(() => null)) as
    | { data?: T; errors?: Array<{ message?: string }> }
    | null;
  const apiError = payload?.errors?.map((error) => error.message).filter(Boolean).join("; ");
  if (!response.ok || apiError || payload?.data === undefined) {
    if (response.status === 401 || response.status === 403) {
      throw new Error("Buffer rejected this API key. Check it in Buffer Settings → API.");
    }
    throw new Error(apiError || `Buffer API request failed (${response.status}).`);
  }
  return payload.data;
}