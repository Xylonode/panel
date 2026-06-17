import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { authClient, useSession } from "../lib/auth-client";

type Step = "idle" | "scan";

export function SecurityPage() {
  return (
    <>
      <div className="page-head">
        <h1>Security</h1>
      </div>
      <ChangePassword />
      <TwoFactor />
    </>
  );
}

/** Change the account password (requires the current one). */
function ChangePassword() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const res = await authClient.changePassword({
      currentPassword: current,
      newPassword: next,
      revokeOtherSessions: true,
    });
    if (res.error) {
      setMsg({ ok: false, text: res.error.message ?? "Could not change password" });
    } else {
      setMsg({ ok: true, text: "Password changed." });
      setCurrent("");
      setNext("");
    }
  }

  return (
    <section className="card">
      <h2>Password</h2>
      <form onSubmit={submit} className="form">
        <label>
          Current password
          <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
        </label>
        <label>
          New password
          <input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            minLength={8}
            required
          />
        </label>
        <button type="submit" className="primary">
          Change password
        </button>
        {msg && <p className={`status ${msg.ok ? "up" : "down"}`}>{msg.text}</p>}
      </form>
    </section>
  );
}

/** Two-factor (TOTP) enrollment: enable → scan QR → verify, and disable. */
function TwoFactor() {
  const { data: session, refetch } = useSession();
  const enabled = session?.user.twoFactorEnabled ?? false;

  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function enable(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await authClient.twoFactor.enable({ password });
    if (res.error) {
      setError(res.error.message ?? "Could not start 2FA setup");
      return;
    }
    setTotpUri(res.data.totpURI);
    setBackupCodes(res.data.backupCodes ?? []);
    setPassword("");
    setStep("scan");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await authClient.twoFactor.verifyTotp({ code });
    if (res.error) {
      setError(res.error.message ?? "Invalid code");
      return;
    }
    setStep("idle");
    setCode("");
    setNotice("Two-factor authentication is now enabled.");
    await refetch?.();
  }

  async function disable(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await authClient.twoFactor.disable({ password });
    if (res.error) {
      setError(res.error.message ?? "Could not disable 2FA");
      return;
    }
    setPassword("");
    setNotice("Two-factor authentication disabled.");
    await refetch?.();
  }

  return (
    <section className="card">
      <h2>Two-factor authentication</h2>
      <p className="tagline">
        Status:{" "}
        <strong className={`status ${enabled ? "up" : "down"}`}>
          {enabled ? "enabled" : "disabled"}
        </strong>
      </p>
      {notice && <p className="status up">{notice}</p>}

      {!enabled && step === "idle" && (
        <form onSubmit={enable} className="form">
          <label>
            Confirm your password to begin
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <button type="submit" className="primary">
            Set up 2FA
          </button>
        </form>
      )}

      {step === "scan" && totpUri && (
        <div className="twofa">
          <p>Scan this with your authenticator app, then enter the 6-digit code.</p>
          <div className="qr">
            <QRCodeSVG value={totpUri} size={176} />
          </div>
          {backupCodes.length > 0 && (
            <details className="backup">
              <summary>Backup codes (store these somewhere safe)</summary>
              <ul className="codes">
                {backupCodes.map((c) => (
                  <li key={c}>
                    <code>{c}</code>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <form onSubmit={verify} className="inline-form">
            <input
              inputMode="numeric"
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
            <button type="submit" className="primary">
              Verify &amp; enable
            </button>
          </form>
        </div>
      )}

      {enabled && (
        <form onSubmit={disable} className="form">
          <label>
            Confirm your password to disable 2FA
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <button type="submit">Disable 2FA</button>
        </form>
      )}

      {error && <p className="status down">{error}</p>}
    </section>
  );
}
