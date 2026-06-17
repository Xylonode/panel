const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

/** The panel origin — used to build daemon install commands shown to operators. */
export const PANEL_ORIGIN = API_URL;

/** WebSocket origin (ws://… / wss://…) for the live console. */
export const WS_ORIGIN = API_URL.replace(/^http/, "ws");

/** Thin fetch wrapper for our own API: same-origin cookies, JSON, error unwrap. */
export async function api<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers ?? {}) },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? `Request failed (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
