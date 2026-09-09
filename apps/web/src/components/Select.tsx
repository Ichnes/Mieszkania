import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

export function Select({
  label,
  value,
  options: suppliedOptions,
  children,
  disabled = false,
  onChange,
}: {
  label: string;
  value: string;
  options?: Array<{ value: string; label: string; disabled?: boolean }>;
  children?: ReactNode;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const options =
    suppliedOptions ??
    Children.toArray(children).flatMap((child) => {
      if (!isValidElement<{ value?: string; children?: ReactNode; disabled?: boolean }>(child))
        return [];
      const label = Children.toArray(child.props.children).join("");
      return [{ value: child.props.value ?? label, label, disabled: child.props.disabled }];
    });
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const typeahead = useRef({ text: "", at: 0 });
  const selected = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(selected);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0, maxHeight: 280 });
  const close = () => setOpen(false);
  const choose = (index: number) => {
    if (!options[index] || options[index].disabled || disabled) return;
    onChange(options[index].value);
    close();
    trigger.current?.focus();
  };

  useLayoutEffect(() => {
    if (!open || !trigger.current) return;
    const rect = trigger.current.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - 12;
    const above = rect.top - 12;
    const upward = below < 180 && above > below;
    const height = Math.min(300, Math.max(80, upward ? above : below), options.length * 44 + 12);
    const width = Math.min(Math.max(rect.width, 240), window.innerWidth - 24);
    setPosition({
      left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
      width,
      maxHeight: height,
      top: upward ? rect.top - height - 6 : rect.bottom + 6,
    });
  }, [open, options.length]);

  useEffect(() => {
    if (!open) return;
    menu.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active, open]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (
        !trigger.current?.contains(event.target as Node) &&
        !menu.current?.contains(event.target as Node)
      )
        close();
    };
    const scroll = (event: Event) => {
      if (!menu.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", scroll, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", scroll, true);
    };
  }, [open]);

  function keyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled || !options.length) return;
    if (event.key === "Tab") {
      close();
      return;
    }
    if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (["ArrowDown", "ArrowUp", "Home", "End", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      if (!open) {
        setActive(event.key === "End" ? options.length - 1 : event.key === "Home" ? 0 : selected);
        setOpen(true);
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        choose(active);
        return;
      }
      setActive((current) =>
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? options.length - 1
            : Math.max(
                0,
                Math.min(options.length - 1, current + (event.key === "ArrowDown" ? 1 : -1)),
              ),
      );
    } else if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
      event.preventDefault();
      const now = Date.now();
      typeahead.current = {
        text:
          (now - typeahead.current.at < 700 ? typeahead.current.text : "") +
          event.key.toLocaleLowerCase("pl"),
        at: now,
      };
      const index = options.findIndex((option) =>
        option.label.toLocaleLowerCase("pl").startsWith(typeahead.current.text),
      );
      if (index >= 0) {
        setActive(index);
        setOpen(true);
      }
    }
  }
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="text-input listing-select-trigger"
        disabled={disabled}
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        onKeyDown={keyDown}
        onClick={() => {
          setActive(selected);
          setOpen((current) => !current);
        }}
      >
        <span>{options[selected]?.label ?? "Wybierz"}</span>
        <ChevronDown size={17} aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <div
            ref={menu}
            id={id}
            className="listing-select-menu"
            role="listbox"
            aria-label={label}
            style={position}
          >
            {options.map((option, index) => (
              <div
                key={option.value}
                id={`${id}-${index}`}
                data-index={index}
                role="option"
                aria-selected={option.value === value}
                aria-disabled={option.disabled || undefined}
                className={`listing-select-option${index === active ? " is-focused" : ""}${option.value === value ? " is-selected" : ""}`}
                onPointerMove={() => setActive(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(index)}
              >
                <span>{option.label}</span>
                {option.value === value ? <Check size={17} aria-hidden="true" /> : null}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
