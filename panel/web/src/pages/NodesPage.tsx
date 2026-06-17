import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { authClient } from "../lib/auth-client";
import { api, PANEL_ORIGIN } from "../lib/api";

interface NodeView {
  id: string;
  name: string;
  description: string | null;
  status: "online" | "offline";
  lastSeenAt: string | null;
  daemonVersion: string | null;
  dockerAvailable: boolean;
  cpuCores: number | null;
  memoryMiB: number | null;
  diskMiB: number | null;
  createdAt: string;
}

/** Manage the active org's nodes: create (one-time token), connect, delete. */
export function NodesPage() {
  const { data: activeOrg } = authClient.useActiveOrganization();
  const [nodes, setNodes] = useState<NodeView[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [newToken, setNewToken] = useState<{ name: string; token: string } | null>(null);

  const refresh = useCallback(async () => {
    try {
      setNodes(await api<NodeView[]>("/api/nodes"));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const t = setInterval(refresh, 5000); // live-ish status
    return () => clearInterval(t);
  }, [refresh]);

  if (!activeOrg) {
    return (
      <section className="card">
        <h2>Nodes</h2>
        <p className="status">
          No active organization. Pick one on the <Link to="/">dashboard</Link> first.
        </p>
      </section>
    );
  }

  async function createNode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await api<{ node: NodeView; token: string }>("/api/nodes", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      setNewToken({ name: res.node.name, token: res.token });
      setName("");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this node? Its daemon will be disconnected.")) return;
    await api(`/api/nodes/${id}`, { method: "DELETE" });
    await refresh();
  }

  async function rotate(id: string, nodeName: string) {
    const res = await api<{ token: string }>(`/api/nodes/${id}/rotate-token`, { method: "POST" });
    setNewToken({ name: nodeName, token: res.token });
  }

  const installCmd = (token: string) =>
    `curl -fsSL ${PANEL_ORIGIN}/install.sh | sudo PANEL_URL=${PANEL_ORIGIN} DAEMON_TOKEN=${token} bash`;

  return (
    <>
      {newToken && (
        <section className="card token-reveal">
          <h2>Token for “{newToken.name}”</h2>
          <p className="status down">
            Copy this now — it is shown only once. Run it on your node to install the daemon:
          </p>
          <pre className="cmd">{installCmd(newToken.token)}</pre>
          <div className="row">
            <button
              className="primary"
              onClick={() => navigator.clipboard?.writeText(installCmd(newToken.token))}
            >
              Copy command
            </button>
            <button onClick={() => setNewToken(null)}>Dismiss</button>
          </div>
        </section>
      )}

      <section className="card">
        <h2>Nodes — {activeOrg.name}</h2>
        {!nodes.length && <p className="status">No nodes yet. Add one below.</p>}
        <ul className="orglist">
          {nodes.map((n) => (
            <li key={n.id}>
              <span>
                <strong className={`status ${n.status === "online" ? "up" : "down"}`}>
                  ●
                </strong>{" "}
                {n.name}{" "}
                <code>
                  {n.status}
                  {n.daemonVersion ? ` · v${n.daemonVersion}` : ""}
                  {n.dockerAvailable ? " · docker" : ""}
                  {n.cpuCores ? ` · ${n.cpuCores} cores` : ""}
                </code>
              </span>
              <span className="actions">
                <button onClick={() => rotate(n.id, n.name)}>Rotate token</button>
                <button onClick={() => remove(n.id)}>Delete</button>
              </span>
            </li>
          ))}
        </ul>
        <form onSubmit={createNode} className="inline-form">
          <input
            placeholder="Node name (e.g. eu-west-1)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <button type="submit" className="primary">
            Add node
          </button>
        </form>
        {error && <p className="status down">{error}</p>}
      </section>
    </>
  );
}
