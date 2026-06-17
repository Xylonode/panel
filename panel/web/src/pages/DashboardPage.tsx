import { useEffect, useState } from "react";
import { authClient } from "../lib/auth-client";
import { api } from "../lib/api";
import { IconServer, IconNode, IconUsers } from "../components/icons";

/** Organization overview: at-a-glance stats + org list / create / switch. */
export function DashboardPage() {
  const { data: orgs, isPending } = authClient.useListOrganizations();
  const { data: activeOrg } = authClient.useActiveOrganization();
  const [orgName, setOrgName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState({ servers: 0, nodes: 0, online: 0 });

  useEffect(() => {
    if (!activeOrg) return;
    void Promise.all([
      api<unknown[]>("/api/servers").catch(() => []),
      api<{ status: string }[]>("/api/nodes").catch(() => []),
    ]).then(([servers, nodes]) =>
      setStats({
        servers: servers.length,
        nodes: nodes.length,
        online: nodes.filter((n) => n.status === "online").length,
      }),
    );
  }, [activeOrg]);

  async function createOrg(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const slug = slugify(orgName);
    const res = await authClient.organization.create({ name: orgName, slug });
    setBusy(false);
    if (res.error) {
      setError(res.error.message ?? "Could not create organization");
      return;
    }
    setOrgName("");
    await authClient.organization.setActive({ organizationId: res.data.id });
  }

  return (
    <>
      <div className="page-head">
        <h1>Dashboard</h1>
      </div>

      {activeOrg && (
        <div className="stat-grid">
          <StatCard tint="mint" label="Servers" value={stats.servers} icon={<IconServer size={22} />} />
          <StatCard
            tint="lavender"
            label="Nodes online"
            value={`${stats.online}/${stats.nodes}`}
            icon={<IconNode size={22} />}
          />
          <StatCard
            tint="peach"
            label="Organizations"
            value={orgs?.length ?? 0}
            icon={<IconUsers size={22} />}
          />
        </div>
      )}

      <section className="card">
        <h2>Organizations</h2>
        {isPending && <p className="dim">Loading…</p>}
        {!isPending && !orgs?.length && (
          <p className="dim">No organizations yet — create one below.</p>
        )}
        <ul className="orglist">
          {orgs?.map((o) => (
            <li key={o.id}>
              <span>
                {o.name} <code>{o.slug}</code>
              </span>
              {activeOrg?.id === o.id ? (
                <span className="pill up">● active</span>
              ) : (
                <button onClick={() => authClient.organization.setActive({ organizationId: o.id })}>
                  Switch
                </button>
              )}
            </li>
          ))}
        </ul>
        <form onSubmit={createOrg} className="inline-form">
          <input
            placeholder="New organization name"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            required
          />
          <button type="submit" className="primary" disabled={busy}>
            {busy ? "…" : "Create"}
          </button>
        </form>
        {error && <p className="status down">{error}</p>}
      </section>
    </>
  );
}

function StatCard({
  tint,
  label,
  value,
  icon,
}: {
  tint: "mint" | "peach" | "lavender";
  label: string;
  value: number | string;
  icon: React.ReactNode;
}) {
  return (
    <div className={`stat-card ${tint}`}>
      <div className="ic">{icon}</div>
      <div>
        <div className="label">{label}</div>
        <div className="num">{value}</div>
      </div>
    </div>
  );
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
