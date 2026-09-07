import { useEffect, useState } from "react";

type InputValue<T> = T extends number ? number : T extends boolean ? boolean : T;

/** Local simulation inputs are separate from shared, saved search preferences. */
export function useMortgageInput<T extends number | string | boolean>(key: string, initial: T) {
  const storageKey = `mieszkania-mortgage-${key}-v1`;
  const [value, setValue] = useState<InputValue<T>>(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "null");
      if (typeof saved !== typeof initial) return initial as InputValue<T>;
      if (typeof saved === "number" && (!Number.isFinite(saved) || saved < 0))
        return initial as InputValue<T>;
      return saved as InputValue<T>;
    } catch {
      return initial as InputValue<T>;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      /* Storage may be disabled. */
    }
  }, [storageKey, value]);
  return [value, setValue] as const;
}
