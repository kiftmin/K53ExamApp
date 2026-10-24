import { useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Check, CheckCircle2, ChevronDown, Heart, HeartOff, RotateCcw, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Learned items stay fully readable: dark charcoal copy on a pale surface with a
 * solid green bar down the left edge. Every row carries the same 3px inset so
 * the text of learned and unlearned rows stays aligned.
 */
export const STUDY_ROW_BORDER_CLASS = "border-l-[3px] border-l-transparent";
// The important modifier beats the divide-y border colour on rows that are
// direct children of a divided group card.
export const STUDY_KNOWN_ROW_CLASS = "!border-l-success bg-[#F8FAF8]";
export const STUDY_KNOWN_TEXT_CLASS = "text-[#4A5568]";

/** Solid green badge once learned, empty outline ring while it is still to learn. */
export function StudyKnownBadge({ known }: { known: boolean }) {
  if (known) {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success text-white">
        <Check className="h-3 w-3" strokeWidth={4} />
      </span>
    );
  }
  return <span className="flex h-5 w-5 items-center justify-center rounded-full border-[1.5px] border-[#718096]" />;
}

/**
 * Chips wrap onto as many rows as they need, so a long list of headings is
 * always fully visible instead of running off the right edge.
 */
function StudyChipRow({
  tabs,
  value,
  onChange,
  activeClassName,
  inactiveClassName,
}: {
  tabs: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  activeClassName: string;
  inactiveClassName: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            "shrink-0 whitespace-nowrap transition-colors",
            value === tab.id ? activeClassName : inactiveClassName
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/** Search field used on every category browse screen. */
export function StudySearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="pl-9 h-11 bg-background/60 rounded-xl"
      />
    </div>
  );
}

/** Single row of main categories. */
export function StudyCategoryTabs({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <StudyChipRow
      tabs={tabs}
      value={value}
      onChange={onChange}
      activeClassName="h-7 px-2 rounded-lg border text-[10px] font-semibold bg-primary text-primary-foreground border-primary shadow-sm"
      inactiveClassName="h-7 px-2 rounded-lg border text-[10px] font-semibold bg-card text-muted-foreground border-border hover:text-foreground"
    />
  );
}

/** Above this many sub-sections a chip row stops being readable, so it opens a picker. */
const SUB_PICKER_THRESHOLD = 12;

/**
 * Word-prefix matching only. The default fuzzy matcher pulls in unrelated
 * sections ("tyre" also matched a long sentence about carrying goods).
 */
function filterByWordPrefix(value: string, search: string): number {
  const query = search.trim().toLowerCase();
  if (!query) return 1;
  const target = value.toLowerCase();
  if (target.includes(query)) return 1;
  return target.split(/[\s/&-]+/).some((word) => word.startsWith(query)) ? 1 : 0;
}

/** Second level categories, only meaningful once a main category is picked. */
export function StudySubCategoryTabs({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = tabs.find((tab) => tab.id === value);

  if (tabs.length <= SUB_PICKER_THRESHOLD) {
    return (
      <StudyChipRow
        tabs={tabs}
        value={value}
        onChange={onChange}
        activeClassName="h-7 px-2 rounded-lg text-[10px] font-medium bg-foreground text-background"
        inactiveClassName="h-7 px-2 rounded-lg text-[10px] font-medium bg-muted/70 text-muted-foreground"
      />
    );
  }

  const labelFor = (id: string, label: string) => (id === "all" ? "All sub-sections" : label);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-full items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 text-xs font-semibold"
      >
        <span className="min-w-0 truncate">{current ? labelFor(current.id, current.label) : "All sub-sections"}</span>
        <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-muted-foreground">
          {tabs.length} sections
          <ChevronDown className="h-3.5 w-3.5" />
        </span>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen} filter={filterByWordPrefix}>
        <DialogTitle className="sr-only">Sub-sections</DialogTitle>
        <CommandInput placeholder="Search sub-sections…" />
        <CommandList>
          <CommandEmpty>No sub-section found.</CommandEmpty>
          <CommandGroup>
            {tabs.map((tab) => (
              <CommandItem
                key={tab.id}
                value={labelFor(tab.id, tab.label)}
                onSelect={() => {
                  onChange(tab.id);
                  setOpen(false);
                }}
              >
                <Check className={cn("h-4 w-4 shrink-0", value === tab.id ? "opacity-100" : "opacity-0")} />
                <span className="min-w-0 line-clamp-2">{labelFor(tab.id, tab.label)}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}

/** Study status metrics, kept apart from the content categories. */
export function StudyStatusBar({
  learned,
  notLearned,
  saved,
  learnedFilter,
  onLearnedFilter,
  savedOnly,
  onSavedOnly,
}: {
  learned: number;
  notLearned: number;
  saved: number;
  learnedFilter: "all" | "learned" | "not";
  onLearnedFilter: (filter: "all" | "learned" | "not") => void;
  savedOnly: boolean;
  onSavedOnly: (active: boolean) => void;
}) {
  const cell = "flex flex-col items-center justify-center gap-0.5 px-1 py-2.5 transition-colors";

  return (
    <div className="grid grid-cols-3 divide-x divide-border rounded-2xl border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => onLearnedFilter(learnedFilter === "learned" ? "all" : "learned")}
        className={cn(cell, learnedFilter === "learned" ? "bg-success/10" : "hover:bg-muted/40")}
      >
        <span
          className={cn(
            "flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide",
            learnedFilter === "learned" ? "text-success" : "text-muted-foreground"
          )}
        >
          <CheckCircle2 className="h-3 w-3" /> Learned
        </span>
        <span className="text-base font-bold leading-none">{learned}</span>
      </button>

      <button
        type="button"
        onClick={() => onLearnedFilter(learnedFilter === "not" ? "all" : "not")}
        className={cn(cell, learnedFilter === "not" ? "bg-secondary/15" : "hover:bg-muted/40")}
      >
        <span
          className={cn(
            "flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide",
            learnedFilter === "not" ? "text-secondary" : "text-muted-foreground"
          )}
        >
          <RotateCcw className="h-3 w-3" /> Not learned
        </span>
        <span className="text-base font-bold leading-none">{notLearned}</span>
      </button>

      <button
        type="button"
        onClick={() => onSavedOnly(!savedOnly)}
        className={cn(cell, savedOnly ? "bg-destructive/10" : "hover:bg-muted/40")}
      >
        <span
          className={cn(
            "flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide",
            savedOnly ? "text-destructive" : "text-muted-foreground"
          )}
        >
          <Heart className={cn("h-3 w-3", savedOnly && "fill-destructive")} /> Saved
        </span>
        <span className="text-base font-bold leading-none">{saved}</span>
      </button>
    </div>
  );
}

/** One card holds a main category with its progress and all of its sub rows. */
export function StudyGroupCard({
  icon: Icon,
  title,
  known,
  total,
  savedCount,
  onClearSaved,
  onReset,
  children,
}: {
  icon?: LucideIcon;
  title: string;
  known: number;
  total: number;
  savedCount: number;
  onClearSaved?: () => void;
  onReset?: () => void;
  children: ReactNode;
}) {
  const percentage = total > 0 ? (known / total) * 100 : 0;
  const allKnown = total > 0 && known === total;

  return (
    <section className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <header className="flex items-start gap-3 px-4 py-3.5">
        {Icon && (
          <span className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Icon className="h-5 w-5" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h2 className="min-w-0 font-display text-base font-bold leading-tight">{title}</h2>
            {allKnown && <CheckCircle2 className="h-4 w-4 text-success shrink-0" />}
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">
              {known} of {total} learned
            </span>
            <Progress
              value={percentage}
              className="h-1.5 w-16 bg-muted"
              indicatorClassName={allKnown ? "bg-success" : "bg-primary"}
            />
            {savedCount > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground whitespace-nowrap">
                <Heart className="h-3 w-3 fill-red-500 text-red-500" /> {savedCount}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {onClearSaved && (
            <button
              type="button"
              aria-label="Clear saved for this section"
              title="Clear saved"
              onClick={onClearSaved}
              className="p-1.5 text-red-500"
            >
              <HeartOff className="h-4 w-4" />
            </button>
          )}
          {onReset && (
            <button
              type="button"
              aria-label="Reset this section"
              title="Reset this section"
              onClick={onReset}
              className="p-1.5 text-muted-foreground"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>
      <div className="border-t border-border/70 px-2 py-1 divide-y divide-border/60">{children}</div>
    </section>
  );
}

/** Flat sub category row inside a group card. */
export function StudySubRow({
  icon: Icon,
  title,
  countLabel,
  known,
  total,
  open,
  onToggle,
  actions,
  children,
}: {
  icon: LucideIcon;
  title: string;
  countLabel: string;
  known?: number;
  total?: number;
  open: boolean;
  onToggle: () => void;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  const learned = known ?? 0;
  const items = total ?? 0;
  const complete = items > 0 && learned === items;
  const statusLabel = learned > 0 ? `${learned} of ${items} learned` : countLabel;

  return (
    <div className="py-0.5">
      <div className="flex items-center gap-1">
        <button type="button" onClick={onToggle} className="flex flex-1 items-center gap-3 py-2.5 pl-1.5 pr-2 text-left min-w-0">
          <span className="h-9 w-9 rounded-xl bg-muted/70 text-muted-foreground flex items-center justify-center shrink-0">
            <Icon className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-start gap-1.5">
              <span className="min-w-0 text-sm font-medium leading-tight">{title}</span>
              {complete && <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-success" />}
            </span>
            <span className={cn("block text-[11px]", complete ? "font-semibold text-success" : "text-muted-foreground")}>
              {statusLabel}
            </span>
          </span>
          <ChevronDown
            className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          />
        </button>
        {actions && <div className="flex items-center gap-0.5 pr-1">{actions}</div>}
      </div>
      {open && children ? <div className="pb-2 pl-2 space-y-1.5">{children}</div> : null}
    </div>
  );
}

/** Icon button used for the save and known toggles on cards. */
export function StudyRowAction({
  label,
  active,
  activeClassName = "",
  inactiveClassName = "",
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  activeClassName?: string;
  inactiveClassName?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={cn("p-1.5", active ? activeClassName : inactiveClassName)}
    >
      {children}
    </button>
  );
}
