import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A wrapped chip row that collapses to `rows` lines with a show all/less
 * toggle whenever its content would need more space than that. Content
 * changes are noticed via `recheckKey` (e.g. the chip list size) and on
 * window resizes; remount with `key` to reset the expanded state.
 */
export function ChipCollapsible({
  children,
  recheckKey = "",
  rows = 2,
  className,
}: {
  children: ReactNode;
  recheckKey?: string;
  rows?: number;
  className?: string;
}) {
  const inner = useRef<HTMLDivElement>(null);
  const [limit, setLimit] = useState<number | null>(null);
  const [overflow, setOverflow] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const el = inner.current;
    if (!el) return;
    const check = () => {
      const first = el.firstElementChild as HTMLElement | null;
      const rowHeight = (first ? first.offsetHeight : 26) + 6; // chip height + gap
      const max = rowHeight * rows;
      setLimit(max);
      setOverflow(el.scrollHeight > max + 2);
    };
    check();
    window.addEventListener("resize", check);
    // A later layout pass may still be settling (fonts, images) — recheck once.
    const t = setTimeout(check, 200);
    return () => {
      window.removeEventListener("resize", check);
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, recheckKey]);

  return (
    <div className={className}>
      <div
        ref={inner}
        className={cn("flex flex-wrap gap-1.5 overflow-hidden", limit !== null && !expanded && "transition-none")}
        style={{ maxHeight: limit !== null && !expanded ? limit : "none" }}
      >
        {children}
      </div>
      {overflow && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-0.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold text-primary flex items-center gap-0.5"
          aria-expanded={expanded}
        >
          {expanded ? "Less" : "Show more"}
          <ChevronDown className={cn("h-3 w-3 transition-transform", expanded && "rotate-180")} />
        </button>
      )}
    </div>
  );
}
