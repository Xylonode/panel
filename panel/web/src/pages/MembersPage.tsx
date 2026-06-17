import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { authClient } from "../lib/auth-client";

// Loosely-typed projections of the better-auth getFullOrganization payload —
// just the fields this page renders.
interface Member {
  id: string;
  role: string;
  user: { email: string; name: string };
}
interface Invitation {
  id: string;
  email: string;
  role: string | null;
  status: string;
}

const ROLES = ["member", "admin", "owner"] as const;

/** Manage the active org's members and pending invitations. */
export function MembersPage() {
  const { data: activeOrg } = authClient.useActiveOrganization();
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<(typeof ROLES)[number]>("member");
  const [error, setError] = useState<string | null>(null);

  const orgId = activeOrg?.id;

  const refresh = useCallback(async () => {
    if (!orgId) return;
    const res = await authClient.organization.getFullOrganization({
      query: { organizationId: orgId },
    });
    if (res.error) {
      setError(res.error.message ?? "Could not load organization");
      return;
    }
    const data = res.data as unknown as { members?: Member[]; invitations?: Invitation[] };
    setMembers(data.members ?? []);
    setInvitations((data.invitations ?? []).filter((i) => i.status === "pending"));
  }, [orgId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!activeOrg) {
    return (
      <section className="card">
        <h2>Members</h2>
        <p className="status">
          No active organization. Pick one on the <Link to="/">dashboard</Link> first.
        </p>
      </section>
    );
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await authClient.organization.inviteMember({
      email: inviteEmail,
      role: inviteRole,
      organizationId: orgId,
    });
    if (res.error) {
      setError(res.error.message ?? "Could not send invitation");
      return;
    }
    setInviteEmail("");
    await refresh();
  }

  async function removeMember(memberIdOrEmail: string) {
    await authClient.organization.removeMember({ memberIdOrEmail, organizationId: orgId });
    await refresh();
  }

  async function changeRole(memberId: string, role: string) {
    await authClient.organization.updateMemberRole({
      memberId,
      role: role as "member" | "admin" | "owner",
      organizationId: orgId,
    });
    await refresh();
  }

  async function cancelInvite(invitationId: string) {
    await authClient.organization.cancelInvitation({ invitationId });
    await refresh();
  }

  return (
    <>
      <section className="card">
        <h2>Members — {activeOrg.name}</h2>
        <ul className="orglist">
          {members.map((m) => (
            <li key={m.id}>
              <span>
                {m.user.name} <code>{m.user.email}</code>
              </span>
              <span className="actions">
                <select value={m.role} onChange={(e) => changeRole(m.id, e.target.value)}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <button onClick={() => removeMember(m.user.email)}>Remove</button>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>Invite a member</h2>
        <form onSubmit={invite} className="inline-form">
          <input
            type="email"
            placeholder="email@example.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            required
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as (typeof ROLES)[number])}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <button type="submit" className="primary">
            Invite
          </button>
        </form>
        {error && <p className="status down">{error}</p>}

        {invitations.length > 0 && (
          <>
            <h3 className="subhead">Pending invitations</h3>
            <ul className="orglist">
              {invitations.map((i) => (
                <li key={i.id}>
                  <span>
                    {i.email} <code>{i.role ?? "member"}</code>
                  </span>
                  <button onClick={() => cancelInvite(i.id)}>Cancel</button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </>
  );
}
