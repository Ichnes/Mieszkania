import { Shell } from "../shared/components/StartupScreen";
import { Workspace } from "./Workspace";
import { useWorkspaceController } from "./useWorkspaceController";

export function App() {
  const model = useWorkspaceController();
  if (model.status === "loading") return <Shell title="Ładowanie" subtitle="Wczytywanie ofert" />;
  if (model.status === "error")
    return <Shell title="Błąd połączenia" subtitle={model.message} error onRetry={model.retry} />;
  return <Workspace model={model} />;
}
