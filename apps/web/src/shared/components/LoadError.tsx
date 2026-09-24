export function LoadError({
  message,
  onRetry,
  busy = false,
}: {
  message: string;
  onRetry: () => void | Promise<void>;
  busy?: boolean;
}) {
  return (
    <div className="load-feedback" role="alert">
      <p>{message}</p>
      <button
        className="action-button secondary-button"
        type="button"
        disabled={busy}
        onClick={() => void onRetry()}
      >
        Ponów
      </button>
    </div>
  );
}
