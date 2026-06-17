import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin, organization, twoFactor } from "better-auth/plugins";
import { PrismaClient } from "@prisma/client";

/**
 * The better-auth instance — single source of truth for auth + multi-tenancy.
 *
 * Exported standalone (with its own PrismaClient) so the better-auth CLI can
 * load it to generate the Prisma schema, and so Nest can mount its handler.
 *
 * Plugins map directly onto our requirements:
 *  - organization → multi-tenant orgs, members, roles, invitations
 *  - twoFactor    → TOTP 2FA
 *  - admin        → platform-admin capabilities (impersonate, ban, list users)
 *
 * Node/daemon tokens are NOT handled here — they're a custom Phase 2 concern
 * (random token + stored hash on the Node row) for full control over rotation.
 */
const prisma = new PrismaClient();

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  basePath: "/api/auth",
  trustedOrigins: [process.env.PANEL_WEB_ORIGIN ?? "http://localhost:5173"],
  emailAndPassword: {
    enabled: true,
  },
  plugins: [organization(), twoFactor(), admin()],
});

export type Auth = typeof auth;
