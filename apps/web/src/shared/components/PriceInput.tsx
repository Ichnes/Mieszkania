import { useState } from "react";

const groupThousands = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");

function formatAmount(text: string) {
  const [integer, fraction] = text.split(/[.,]/);
  const whole = groupThousands(integer.replace(/^0+(?=\d)/, ""));
  return fraction === undefined ? whole : (whole || "0") + "," + fraction;
}

export function PriceInput({
  value,
  onChange,
}: {
  value?: number;
  onChange: (amount?: number) => void;
}) {
  const [draft, setDraft] = useState<{ amount?: number; text: string }>();
  const display = draft && draft.amount === value ? draft.text : formatAmount(String(value ?? ""));
  return (
    <input
      className="text-input"
      inputMode="decimal"
      value={display}
      onBlur={() => setDraft(undefined)}
      onKeyDown={(event) => {
        const input = event.currentTarget;
        const pos = input.selectionStart ?? 0;
        if (pos !== input.selectionEnd || event.ctrlKey || event.metaKey || event.altKey) return;
        if (event.key === "Backspace" && input.value[pos - 1] === "\u00a0")
          input.setSelectionRange(Math.max(0, pos - 2), pos);
        if (event.key === "Delete" && input.value[pos] === "\u00a0")
          input.setSelectionRange(pos, pos + 2);
      }}
      onPaste={(event) => {
        const pasted = event.clipboardData
          .getData("text")
          .trim()
          .replace(/\s*(?:zł|PLN)$/i, "")
          .replace(/\s/g, "");
        // Accept a price copied from a source using comma or dot thousands separators.
        const grouped = pasted.match(/^\d{1,3}([.,])\d{3}(?:\1\d{3})*(?:[.,]\d{1,2})?$/);
        const normalized = grouped ? pasted.split(grouped[1]).join("") : pasted;
        if (normalized === event.clipboardData.getData("text")) return;
        event.preventDefault();
        const input = event.currentTarget;
        input.setRangeText(normalized, input.selectionStart ?? 0, input.selectionEnd ?? 0, "end");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }}
      onChange={(event) => {
        const input = event.currentTarget;
        const raw = input.value.replace(/\s/g, "");
        if (!/^\d*(?:[.,]\d{0,2})?$/.test(raw)) return;
        const amount = raw ? Number(raw.replace(",", ".")) : undefined;
        if (amount !== undefined && (!Number.isFinite(amount) || amount > Number.MAX_SAFE_INTEGER))
          return;
        const before = input.value
          .slice(0, input.selectionStart ?? input.value.length)
          .replace(/\s/g, "");
        const formatted = formatAmount(raw);
        let caret = 0;
        for (let count = 0; caret < formatted.length && count < before.length; caret++) {
          if (formatted[caret] !== "\u00a0") count++;
        }
        input.value = formatted;
        input.setSelectionRange(caret, caret);
        setDraft({ amount, text: formatted });
        onChange(amount);
      }}
    />
  );
}
