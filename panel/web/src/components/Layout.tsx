import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { authClient, signOut, useSession } from "../lib/auth-client";
import { useTheme } from "../lib/theme";
import { Logo } from "./Logo";
import {
  IconBell,
  IconGrid,
  IconMoon,
  IconNode,
  IconPuzzle,
  IconSearch,
  IconServer,
  IconShield,
  IconSun,
  IconUsers,
} from "./icons";

const NAV = [
  {
    section: "Management",
    items: [
      { to: "/", label: "Dashboard", end: true, icon: IconGrid },
      { to: "/servers", label: "Servers", icon: IconServer },
      { to: "/nodes", label: "Nodes", icon: IconNode },
    ],
  },
  {
    section: "Addons",
    items: [{ to: "/addons", label: "Marketplace", icon: IconPuzzle }],
  },
  {
    section: "Account",
    items: [
      { to: "/members", label: "Members", icon: IconUsers },
      { to: "/security", label: "Security", icon: IconShield },
    ],
  },
];

const CRUMB: Record<string, string> = {
  "": "Dashboard",
  servers: "Servers",
  nodes: "Nodes",
  addons: "Marketplace",
  members: "Members",
  security: "Security",
  files: "Files",
};

export function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: session } = useSession();
  const { data: activeOrg } = authClient.useActiveOrganization();
  const [theme, toggleTheme] = useTheme();

  async function handleSignOut() {
    await signOut();
    navigate("/login", { replace: true });
  }

  const crumbs = location.pathname.split("/").filter(Boolean);
  const initial = (session?.user.name ?? session?.user.email ?? "?").charAt(0).toUpperCase();

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <Logo />
          <b>Xylonode</b>
        </div>
        {NAV.map((group) => (
          <div className="nav-section" key={group.section}>
            <div className="label">{group.section}</div>
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink key={item.to} to={item.to} end={item.end} className="nav-item">
                  <Icon />
                  {item.label}
                </NavLink>
              );
            })}
          </div>
        ))}
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="search">
            <IconSearch size={16} />
            <input placeholder="Search…" aria-label="Search" />
          </div>
          {activeOrg && <span className="org-chip">{activeOrg.name}</span>}
          <button className="icon-btn" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === "light" ? <IconMoon /> : <IconSun />}
          </button>
          <button className="icon-btn" aria-label="Notifications">
            <IconBell />
          </button>
          <button className="avatar" onClick={handleSignOut} title="Sign out">
            {initial}
          </button>
        </header>

        <nav className="breadcrumb">
          <b>Home</b>
          {crumbs.map((c, i) => (
            <span key={i}> › {CRUMB[c] ?? c}</span>
          ))}
        </nav>

        <main className="content">
          <Outlet />
        </main>

        <footer className="footer">
          <span>© 2026 Xylonode.gg — All rights reserved.</span>
          <span>
            <span className="badge">preview</span> &nbsp;v0.5.0
          </span>
        </footer>
      </div>
    </div>
  );
}
