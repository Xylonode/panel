import { useState } from "react";
import { Navigate } from "react-router-dom";
import { signIn, signUp, useSession } from "../lib/auth-client";

/** Combined sign-in / sign-up. Redirects to the dashboard once authenticated. */
export function LoginPage() {
  const { data: session, isPending } = useSession();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!isPending && session) {
    return <Navigate to="/" replace />;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res =
      mode === "signup"
        ? await signUp.email({ name, email, password })
        : await signIn.email({ email, password });
    setBusy(false);
    if (res.error) setError(res.error.message ?? "Something went wrong");
    // On success the useSession hook revalidates and the redirect above fires.
  }

  return (
    <main className="shell">
      <header className="head">
        <h1>Game Panel</h1>
        <p className="tagline">Hosted game-server control plane + addon platform.</p>
      </header>
      <section className="card">
        <div className="tabs">
          <button className={mode === "signup" ? "on" : ""} onClick={() => setMode("signup")}>
            Create account
          </button>
          <button className={mode === "signin" ? "on" : ""} onClick={() => setMode("signin")}>
            Sign in
          </button>
        </div>
        <form onSubmit={submit} className="form">
          {mode === "signup" && (
            <label>
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
          )}
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </label>
          {error && <p className="status down">{error}</p>}
          <button type="submit" className="primary" disabled={busy}>
            {busy ? "…" : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
