import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { authClient } from "../lib/auth-client";
import { api } from "../lib/api";

interface Manifest {
  permissions?: string[];
  network?: { allow?: string[] };
  hooks?: { on: string; handler: string }[];
}
interface RegistryAddon {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  manifest: Manifest;
}
interface Install {
  id: string;
  addonId: string;
  enabled: boolean;
  grantedScopes: string[];
  config: Record<string, string>;
  addon: { name: string; description: string; manifest: Manifest } | null;
}
interface KvRow {
  key: string;
  value: string;
}
interface LogRow {
  id: string;
  level: string;
  message: string;
  createdAt: string;
}

export function AddonsPage() {
  const { data: activeOrg } = authClient.useActiveOrganization();
  const [registry, setRegistry] = useState<RegistryAddon[]>([]);
  const [installs, setInstalls] = useState<Install[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [r, i] = await Promise.all([
        api<RegistryAddon[]>("/api/addons/registry"),
        api<Install[]>("/api/addons"),
      ]);
      setRegistry(r);
      setInstalls(i);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!activeOrg) {
    return (
      <section className="card">
        <h2>Addons</h2>
        <p className="status">
          No active organization. Pick one on the <Link to="/">dashboard</Link> first.
        </p>
      </section>
    );
  }

  const installedIds = new Set(installs.map((i) => i.addonId));

  async function install(id: string) {
    try {
      await api(`/api/addons/${id}/install`, { method: "POST", body: "{}" });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <>
      <section className="card">
        <h2>Marketplace</h2>
        <p className="tagline">Sandboxed WASM addons. They run with only the capabilities you grant.</p>
        <ul className="orglist">
          {registry.map((a) => (
            <li key={a.id}>
              <span>
                <strong>{a.name}</strong> <code>v{a.version}</code>
                <br />
                <small className="dim">{a.description}</small>
                <br />
                <small>scopes: {(a.manifest.permissions ?? []).join(", ") || "none"}</small>
              </span>
              <button
                className="primary"
                disabled={installedIds.has(a.id)}
                onClick={() => install(a.id)}
              >
                {installedIds.has(a.id) ? "Installed" : "Install"}
              </button>
            </li>
          ))}
        </ul>
        {error && <p className="status down">{error}</p>}
      </section>

      {installs.map((i) => (
        <InstallCard key={i.id} install={i} onChange={refresh} />
      ))}
    </>
  );
}

function InstallCard({ install, onChange }: { install: Install; onChange: () => void }) {
  const [kv, setKv] = useState<KvRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [webhookUrl, setWebhookUrl] = useState(install.config?.webhookUrl ?? "");

  const loadDetails = useCallback(async () => {
    setKv(await api<KvRow[]>(`/api/addons/installs/${install.id}/kv`).catch(() => []));
    setLogs(await api<LogRow[]>(`/api/addons/installs/${install.id}/logs`).catch(() => []));
  }, [install.id]);

  useEffect(() => {
    void loadDetails();
    const t = setInterval(loadDetails, 4000);
    return () => clearInterval(t);
  }, [loadDetails]);

  async function toggle() {
    await api(`/api/addons/installs/${install.id}/toggle`, {
      method: "POST",
      body: JSON.stringify({ enabled: !install.enabled }),
    });
    onChange();
  }
  async function saveConfig() {
    await api(`/api/addons/installs/${install.id}/config`, {
      method: "POST",
      body: JSON.stringify({ config: { webhookUrl } }),
    });
    onChange();
  }
  async function uninstall() {
    if (!confirm("Uninstall this addon? Its data and logs are removed.")) return;
    await api(`/api/addons/installs/${install.id}`, { method: "DELETE" });
    onChange();
  }

  return (
    <section className="card">
      <div className="row">
        <h2>
          {install.addon?.name ?? install.addonId}{" "}
          <strong className={`status ${install.enabled ? "up" : "down"}`}>
            {install.enabled ? "enabled" : "disabled"}
          </strong>
        </h2>
        <div className="actions">
          <button onClick={toggle}>{install.enabled ? "Disable" : "Enable"}</button>
          <button onClick={uninstall}>Uninstall</button>
        </div>
      </div>
      <p>
        <small>granted: {install.grantedScopes.join(", ") || "none"}</small>
      </p>

      <div className="inline-form">
        <input
          placeholder="webhook URL (optional, must be on the addon's allowlist)"
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
        />
        <button onClick={saveConfig}>Save config</button>
      </div>

      <h3 className="subhead">Key/Value store</h3>
      {!kv.length && <p className="dim">empty</p>}
      <ul className="kv">
        {kv.map((row) => (
          <li key={row.key}>
            <span>{row.key}</span>
            <strong>{row.value}</strong>
          </li>
        ))}
      </ul>

      <h3 className="subhead">Activity</h3>
      <div className="console" style={{ height: "20vh" }}>
        {!logs.length && <div className="dim">No activity yet. Start/stop a server to trigger it.</div>}
        {logs.map((l) => (
          <div key={l.id} className="line">
            <span className="dim">{new Date(l.createdAt).toLocaleTimeString()} </span>
            {l.level !== "info" ? `[${l.level}] ` : ""}
            {l.message}
          </div>
        ))}
      </div>
    </section>
  );
}
