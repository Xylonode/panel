import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { authClient, useSession } from "../lib/auth-client";
import { api } from "../lib/api";
import { IconUsers, IconServer, IconNode, IconPuzzle } from "../components/icons";

interface Overview {
  users: number;
  orgs: number;
  nodes: number;
  nodesOnline: number;
  servers: number;
  addons: number;
  suspendedOrgs: number;
}
interface OrgRow {
  id: string;
  name: string;
  slug: string;
  members: number;
  nodes: number;
  servers: number;
  suspended: boolean;
}
interface ServerRow {
  id: string;
  name: string;
  org: string;
  state: string;
  primaryPort: number;
}
interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string | null;
  banned: boolean | null;
}
interface AddonRow {
  id: string;
  name: string;
  version: string;
  published: boolean;
}

export function AdminPage() {
  const { data: session, isPending } = useSession();
  const [ov, setOv] = useState<Overview | null>(null);
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [servers, setServers] = useState<ServerRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [addons, setAddons] = useState<AddonRow[]>([]);

  const refresh = useCallback(async () => {
    const [o, og, sv, us, ad] = await Promise.all([
      api<Overview>("/api/admin/overview").catch(() => null),
      api<OrgRow[]>("/api/admin/orgs").catch(() => []),
      api<ServerRow[]>("/api/admin/servers").catch(() => []),
      api<UserRow[]>("/api/admin/users").catch(() => []),
      api<AddonRow[]>("/api/admin/addons").catch(() => []),
    ]);
    setOv(o);
    setOrgs(og);
    setServers(sv);
    setUsers(us);
    setAddons(ad);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!isPending && session?.user.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  async function suspend(org: OrgRow) {
    await api(`/api/admin/orgs/${org.id}/suspend`, {
      method: "POST",
      body: JSON.stringify({ suspended: !org.suspended }),
    });
    await refresh();
  }
  async function publish(a: AddonRow) {
    await api(`/api/admin/addons/${a.id}/publish`, {
      method: "POST",
      body: JSON.stringify({ published: !a.published }),
    });
    await refresh();
  }
  async function impersonate(userId: string) {
    await authClient.admin.impersonateUser({ userId });
    window.location.href = "/";
  }

  return (
    <>
      <div className="page-head">
        <h1>Staff · Platform admin</h1>
      </div>

      {ov && (
        <div className="stat-grid">
          <div className="stat-card lavender">
            <div className="ic">
              <IconUsers size={22} />
            </div>
            <div>
              <div className="label">Users</div>
              <div className="num">{ov.users}</div>
            </div>
          </div>
          <div className="stat-card mint">
            <div className="ic">
              <IconNode size={22} />
            </div>
            <div>
              <div className="label">Nodes online</div>
              <div className="num">
                {ov.nodesOnline}/{ov.nodes}
              </div>
            </div>
          </div>
          <div className="stat-card peach">
            <div className="ic">
              <IconServer size={22} />
            </div>
            <div>
              <div className="label">Servers</div>
              <div className="num">{ov.servers}</div>
            </div>
          </div>
          <div className="stat-card lavender">
            <div className="ic">
              <IconPuzzle size={22} />
            </div>
            <div>
              <div className="label">Orgs ({ov.suspendedOrgs} suspended)</div>
              <div className="num">{ov.orgs}</div>
            </div>
          </div>
        </div>
      )}

      <section className="card">
        <h2>Organizations</h2>
        <ul className="orglist">
          {orgs.map((o) => (
            <li key={o.id}>
              <span>
                {o.suspended && <span className="pill down">suspended</span>} {o.name}{" "}
                <code>{o.members}m · {o.nodes}n · {o.servers}s</code>
              </span>
              <button className={o.suspended ? "" : "danger"} onClick={() => suspend(o)}>
                {o.suspended ? "Unsuspend" : "Suspend"}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>All servers</h2>
        <ul className="orglist">
          {servers.map((s) => (
            <li key={s.id}>
              <span>
                <strong className={`status ${s.state === "running" ? "up" : "down"}`}>●</strong>{" "}
                {s.name} <code>{s.org} · :{s.primaryPort}</code>
              </span>
              <span className="dim">{s.state}</span>
            </li>
          ))}
          {!servers.length && <li className="dim">No servers yet.</li>}
        </ul>
      </section>

      <section className="card">
        <h2>Users</h2>
        <ul className="orglist">
          {users.map((u) => (
            <li key={u.id}>
              <span>
                {u.name} <code>{u.email}</code>
                {u.role === "admin" && <span className="pill"> admin</span>}
                {u.banned && <span className="pill down"> banned</span>}
              </span>
              {u.role !== "admin" && (
                <button onClick={() => impersonate(u.id)}>Impersonate</button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>Addon approval</h2>
        <ul className="orglist">
          {addons.map((a) => (
            <li key={a.id}>
              <span>
                {a.published ? <span className="pill up">published</span> : <span className="pill warn">pending</span>}{" "}
                {a.name} <code>v{a.version}</code>
              </span>
              <button onClick={() => publish(a)}>{a.published ? "Unpublish" : "Approve"}</button>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
