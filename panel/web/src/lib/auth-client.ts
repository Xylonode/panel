import { createAuthClient } from "better-auth/react";
import {
  adminClient,
  organizationClient,
  twoFactorClient,
} from "better-auth/client/plugins";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

/**
 * The browser-side better-auth client. Plugin set mirrors the server config in
 * panel/api/src/auth/auth.ts. `useSession`, `signIn`, `signUp`, `signOut`, and
 * `organization.*` come from here.
 */
export const authClient = createAuthClient({
  baseURL: API_URL,
  basePath: "/api/auth",
  plugins: [organizationClient(), twoFactorClient(), adminClient()],
});

export const { useSession, signIn, signUp, signOut, organization } = authClient;
