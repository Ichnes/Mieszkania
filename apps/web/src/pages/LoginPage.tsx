import { useState, type FormEvent } from "react";
import { apiBaseUrl } from "../shared/lib/api";
import { apiFetch } from "../shared/lib/http";
export function LoginPage({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await apiFetch(`${apiBaseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!r.ok) {
        const body = await r.json();
        throw new Error(body.message ?? "Logowanie nie powiodło się.");
      }
      setPassword("");
      onSuccess();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Sprawdź połączenie i spróbuj ponownie.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-screen">
      <section className="auth-card">
        <a className="auth-brand" href="/oferty">
          Mieszkania
        </a>
        <p className="eyebrow">Twoje poszukiwania, w jednym miejscu</p>
        <h1>Wróć do mieszkań</h1>
        <p className="muted">Zaloguj się, aby zobaczyć zapisane oferty.</p>
        <form onSubmit={submit}>
          <label htmlFor="auth-email">Email</label>
          <input
            className="text-input"
            id="auth-email"
            name="email"
            type="email"
            autoComplete="username"
            required
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
          />
          <label htmlFor="auth-password">Hasło</label>
          <input
            className="text-input"
            id="auth-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
          />
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          <button className="action-button" type="submit" disabled={busy}>
            {busy ? "Logowanie…" : "Zaloguj się"}
          </button>
        </form>
        <p className="muted auth-help">Dostęp nadaje osoba, która udostępnia Ci tę aplikację.</p>
      </section>
    </main>
  );
}
