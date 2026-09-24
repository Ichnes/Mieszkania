/** Only the most recent request may publish data, errors or completion. */
export function createLatestRequest() {
  let current: AbortController | undefined;
  return {
    cancel() {
      current?.abort();
      current = undefined;
    },
    async run<T>(
      load: (signal: AbortSignal) => Promise<T>,
      handlers: {
        start: () => void;
        success: (value: T) => void;
        error: (error: unknown) => void;
        finish: () => void;
      },
    ) {
      current?.abort();
      const controller = new AbortController();
      current = controller;
      handlers.start();
      try {
        const result = await load(controller.signal);
        if (current === controller) handlers.success(result);
      } catch (error) {
        if (current === controller) handlers.error(error);
      } finally {
        if (current === controller) {
          current = undefined;
          handlers.finish();
        }
      }
    },
  };
}
