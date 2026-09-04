import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

export interface SelectOption { value: string; label: string; description?: string; disabled?: boolean }

/** Select-only combobox. Focus stays on the trigger; the popup is never clipped by a scroll pane. */
export function SelectMenu({ value, options, onChange, label, disabled, className = "" }: {
  value: string; options: SelectOption[]; onChange: (value: string) => void;
  label: string; disabled?: boolean; className?: string;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 240, maxHeight: 280 });
  const search = useRef({ text: "", at: 0 });
  const selected = options.findIndex((option) => option.value === value);
  const close = () => { setOpen(false); search.current.text = ""; };
  const show = () => { setActive(selected >= 0 && !options[selected].disabled ? selected : Math.max(0, options.findIndex(o => !o.disabled))); setOpen(true); };
  const choose = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(option.value); close(); trigger.current?.focus();
  };
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  useLayoutEffect(() => {
    if (!open || !trigger.current) return;
    const rect = trigger.current.getBoundingClientRect();
    const width = Math.min(Math.max(rect.width, 240), window.innerWidth - 24);
    const below = window.innerHeight - rect.bottom - 18;
    const above = rect.top - 18;
    const upward = below < Math.min(options.length * 42 + 12, 200) && above > below;
    const maxHeight = Math.max(40, Math.min(300, upward ? above : below));
    const height = Math.min(popup.current?.scrollHeight ?? options.length * 42 + 12, maxHeight);
    setPosition({ left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)), top: upward ? Math.max(12, rect.top - height - 6) : rect.bottom + 6, width, maxHeight });
  }, [open, options.length]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!trigger.current?.contains(event.target as Node) && !popup.current?.contains(event.target as Node)) close();
    };
    const scroll = (event: Event) => { if (!popup.current?.contains(event.target as Node)) close(); };
    document.addEventListener("pointerdown", outside, true);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", scroll, true);
    return () => { document.removeEventListener("pointerdown", outside, true); window.removeEventListener("resize", close); window.removeEventListener("scroll", scroll, true); };
  }, [open]);
  useEffect(() => {
    if (open) popup.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  return <>
    <button ref={trigger} type="button" className={`select-trigger ${className}`} role="combobox" aria-label={label}
      aria-expanded={open} aria-controls={open ? id : undefined} aria-haspopup="listbox"
      aria-activedescendant={open && options[active] ? `${id}-${active}` : undefined} disabled={disabled || !options.length}
      onClick={() => open ? close() : show()} onBlur={close}
      onKeyDown={(event) => {
        if (event.key === "Tab") { close(); return; }
        if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); close(); return; }
        if (["Enter", " "].includes(event.key) && !(event.key === " " && search.current.text && Date.now() - search.current.at < 700)) {
          event.preventDefault(); open ? choose(active) : show(); return;
        }
        const enabled = options.map((option, index) => option.disabled ? -1 : index).filter(index => index >= 0);
        if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
          event.preventDefault();
          if (!open) { show(); return; }
          const current = enabled.indexOf(active);
          const next = event.key === "Home" ? enabled[0] : event.key === "End" ? enabled.at(-1) : enabled[(current + (event.key === "ArrowDown" ? 1 : -1) + enabled.length) % enabled.length];
          if (next !== undefined) setActive(next);
          return;
        }
        if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
          event.preventDefault();
          const now = Date.now();
          const text = (now - search.current.at < 700 ? search.current.text : "") + event.key.toLocaleLowerCase();
          search.current = { text, at: now };
          const query = [...text].every(char => char === text[0]) ? text[0] : text;
          const start = open ? active : selected;
          const indices = options.map((_, index) => (start + 1 + index + options.length) % options.length);
          const match = indices.find(index => !options[index].disabled && options[index].label.toLocaleLowerCase().startsWith(query));
          if (match !== undefined) { if (open) setActive(match); else onChange(options[match].value); }
        }
      }}><span>{options[selected]?.label ?? "Choose an option"}</span><ChevronDown size={16} aria-hidden="true"/></button>
    {open && createPortal(<div ref={popup} id={id} role="listbox" aria-label={label} className="select-menu" style={position}
      onPointerDown={(event) => event.preventDefault()}>
      {options.map((option, index) => <div id={`${id}-${index}`} key={option.value} role="option" aria-selected={value === option.value}
        aria-disabled={option.disabled || undefined} data-index={index} className={`select-option ${index === active ? "is-highlighted" : ""}`}
        onPointerMove={() => !option.disabled && setActive(index)} onClick={() => choose(index)}>
        <span><strong>{option.label}</strong>{option.description && <small>{option.description}</small>}</span>
        {value === option.value && <Check size={16} aria-hidden="true"/>}
      </div>)}
    </div>, document.body)}
  </>;
}
