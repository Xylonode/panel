import { Navigate, Outlet } from "react-router-dom";
import { useSession } from "../lib/auth-client";

/** Gates child routes on an authenticated session; redirects to /login otherwise. */
export function ProtectedRoute() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <main className="shell">
        <p className="status">Loading…</p>
      </main>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
