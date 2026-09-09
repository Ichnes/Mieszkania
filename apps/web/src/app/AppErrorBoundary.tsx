import { Component, type ReactNode } from "react";
import { recoverModuleError } from "../shared/lib/module-recovery";

export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    try {
      recoverModuleError(error, {
        online: navigator.onLine,
        storage: window.sessionStorage,
        now: Date.now(),
        reload: () => window.location.reload(),
      });
    } catch {
      // The fallback also works when the browser blocks access to sessionStorage.
    }
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="startup-shell">
        <section className="startup-card is-error" role="alert">
          <p className="eyebrow">Mieszkania</p>
          <h1>Nie udało się wczytać widoku</h1>
          <p className="startup-copy">
            Odśwież aplikację, aby pobrać aktualną wersję. Jeśli jesteś offline, najpierw przywróć
            połączenie.
          </p>
          <button className="action-button" onClick={() => window.location.reload()}>
            Odśwież aplikację
          </button>
        </section>
      </main>
    );
  }
}
