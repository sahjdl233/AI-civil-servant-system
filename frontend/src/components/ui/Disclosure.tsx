import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ChevronDownIcon } from "./icons";

interface DisclosureProps {
  title: string;
  icon?: ReactNode;
  defaultOpen?: boolean;
  onToggle?: (open: boolean) => void;
  children: ReactNode;
}

export default function Disclosure({
  title,
  icon,
  defaultOpen = false,
  onToggle,
  children,
}: DisclosureProps) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyRef = useRef<HTMLDivElement>(null);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    onToggle?.(next);
  };

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    if (open) {
      el.style.maxHeight = `${el.scrollHeight}px`;
    } else {
      el.style.maxHeight = "0px";
    }
  }, [open, children]);

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between py-4 text-left hover:bg-surface-muted px-3 rounded-lg transition-colors"
      >
        <span className="flex items-center gap-2 text-base font-medium text-ink">
          {icon}
          {title}
        </span>
        <ChevronDownIcon
          className={`w-4 h-4 text-ink-tertiary transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      <div
        ref={bodyRef}
        className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
      >
        <div className="px-3 pb-5">{children}</div>
      </div>
    </div>
  );
}
