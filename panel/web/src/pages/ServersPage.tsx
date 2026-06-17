import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { authClient } from "../lib/auth-client";
import { api } from "../lib/api";

interface ServerView {
  id: string;
  name: string;
  state: string;
  nodeId: string;
  primaryPort: number;
  memoryMiB: number;
}
interface NodeOpt {
  id: string;
  name: string;
  status: string;
}
interface EggOpt {
  id: string;
  name: string;
}

export const STATE_CLASS: Record<string, string> = {
  running: "up",
  offline: "down",
  starting: "warn",
  stopping: "warn",
  installing: "warn",
  crashed: "down",
};

export function ServersPage() {
  const { data: activeOrg } = authClient.useActiveOrganization();
  const [servers, setServers] = useState<ServerView[]>([]);
  const [nodes, setNodes] = useState<NodeOpt[]>([]);
  const [eggs, setEggs] = useState<EggOpt[]>([]);
  const [form, setForm] = useState({ name: "", nodeId: "", eggId: "", memoryMiB: 1024 });
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setServers(await api<ServerView[]>("/api/servers"));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void refresh();
    void api<NodeOpt[]>("/api/nodes").then(setNodes).catch(() => {});
    void api<EggOpt[]>("/api/eggs").then(setEggs).catch(() => {});
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [refresh]);

  if (!activeOrg) {
    return (
      <section className="card">
        <h2>Servers</h2>
        <p className="status">
          No active organization. Pick one on the <Link to="/">dashboard</Link> first.
        </p>
      </section>
    );
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      await api("/api/servers", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setForm({ name: "", nodeId: "", eggId: "", memoryMiB: 1024 });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  const onlineNodes = nodes.filter((n) => n.status === "online");

  return (
    <>
      <section className="card">
        <h2>Servers — {activeOrg.name}</h2>
        {!servers.length && <p className="status">No servers yet. Create one below.</p>}
        <ul className="orglist">
          {servers.map((s) => (
            <li key={s.id}>
              <span>
                <strong className={`status ${STATE_CLASS[s.state] ?? ""}`}>●</strong>{" "}
                <Link to={`/servers/${s.id}`}>{s.name}</Link>{" "}
                <code>
                  {s.state} · :{s.primaryPort} · {s.memoryMiB}MB
                </code>
              </span>
              <Link className="btnlink" to={`/servers/${s.id}`}>
                Console →
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>New server</h2>
        <form onSubmit={create} className="form">
          <label>
            Name
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </label>
          <label>
            Node
            <select
              value={form.nodeId}
              onChange={(e) => setForm({ ...form, nodeId: e.target.value })}
              required
            >
              <option value="">Select a node…</option>
              {onlineNodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Egg
            <select
              value={form.eggId}
              onChange={(e) => setForm({ ...form, eggId: e.target.value })}
              required
            >
              <option value="">Select an egg…</option>
              {eggs.map((eg) => (
                <option key={eg.id} value={eg.id}>
                  {eg.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Memory (MB)
            <input
              type="number"
              min={512}
              step={256}
              value={form.memoryMiB}
              onChange={(e) => setForm({ ...form, memoryMiB: Number(e.target.value) })}
            />
          </label>
          {!onlineNodes.length && (
            <p className="status warn">No online nodes — connect a node first.</p>
          )}
          <button type="submit" className="primary" disabled={creating || !onlineNodes.length}>
            {creating ? "Creating…" : "Create server"}
          </button>
        </form>
        {error && <p className="status down">{error}</p>}
      </section>
    </>
  );
}
