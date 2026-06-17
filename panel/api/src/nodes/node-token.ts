import { randomBytes, createHash } from "node:crypto";

/**
 * Node/daemon tokens. The plaintext token is shown to the operator exactly once
 * at creation; we persist only its sha256 hash and match against that when a
 * daemon authenticates. (better-auth has no apiKey plugin in this build, so we
 * own this — see auth/auth.ts.)
 */

const PREFIX = "gpn_"; // game-panel node

export function generateNodeToken(): { token: string; tokenHash: string } {
  const token = PREFIX + randomBytes(32).toString("base64url");
  return { token, tokenHash: hashNodeToken(token) };
}

export function hashNodeToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
