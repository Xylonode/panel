import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { authClient, signOut, useSession } from "../lib/auth-client";

/** Authenticated chrome: header, nav, active-org indicator, sign-out. */
export function Layout() {
  const navigate = useNavigate();
  const { data: session } = useSession();
  const { data: activeOrg } = authClient.useActiveOrganization();

  async function handleSignOut() {
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <strong>Game Panel</strong>
          {activeOrg && <span className="org-chip">{activeOrg.name}</span>}
        </div>
        <nav className="nav">
          <NavLink to="/" end>
            Dashboard
          </NavLink>
          <NavLink to="/nodes">Nodes</NavLink>
          <NavLink to="/servers">Servers</NavLink>
          <NavLink to="/members">Members</NavLink>
          <NavLink to="/security">Security</NavLink>
        </nav>
        <div className="who">
          <span>{session?.user.email}</span>
          <button onClick={handleSignOut}>Sign out</button>
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
