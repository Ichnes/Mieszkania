import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiBaseUrl } from "../../shared/lib/api";
import { apiFetch } from "../../shared/lib/http";
import { Shell } from "../../shared/components/StartupScreen";
import { LoginPage } from "../../pages/LoginPage";
type Session = { enabled: boolean; authenticated: boolean; email?: string };
const AuthContext = createContext<{ session: Session; logout: () => Promise<void> } | null>(null);
export function useAuth() {
  return useContext(AuthContext);
}
export function AuthBoundary({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>();
  const [error, setError] = useState("");
  async function check() {
    try {
      const r = await apiFetch(`${apiBaseUrl}/api/auth/status`);
      if (!r.ok) throw new Error("Nie udało się sprawdzić połączenia.");
      setSession(await r.json());
      setError("");
    } catch {
      setError("Nie udało się sprawdzić połączenia z aplikacją.");
    }
  }
  useEffect(() => {
    void check();
    const requireLogin = () => setSession({ enabled: true, authenticated: false });
    window.addEventListener("auth:required", requireLogin);
    return () => window.removeEventListener("auth:required", requireLogin);
  }, []);
  async function logout() {
    try {
      const r = await apiFetch(`${apiBaseUrl}/api/auth/logout`, { method: "POST" });
      if (!r.ok && r.status !== 401) throw new Error();
      setSession({ enabled: true, authenticated: false });
    } catch {
      setError("Wylogowanie nie powiodło się. Spróbuj ponownie.");
    }
  }
  if (error)
    return (
      <Shell title="Połączenie przerwane" subtitle={error} error onRetry={() => void check()} />
    );
  if (!session) return <Shell title="Ładowanie" subtitle="Łączymy się z aplikacją" />;
  if (session.enabled && !session.authenticated)
    return <LoginPage onSuccess={() => void check()} />;
  return <AuthContext.Provider value={{ session, logout }}>{children}</AuthContext.Provider>;
}
