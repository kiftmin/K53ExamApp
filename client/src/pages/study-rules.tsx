import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { StudyRule } from "@shared/schema";
import { Layout } from "@/components/layout";
import { FormattedText } from "@/components/formatted-text";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, Layers, Search, ArrowLeft, ChevronDown, CheckCircle2, HeartOff, CircleX } from "lucide-react";
import { toggleFavoriteRule, getFavoriteRuleIds, getDoneRuleIds, toggleDoneRule, removeRuleBookmarks } from "@/lib/rule-storage";
import { useStudyGate } from "./study";
import RulesCodeGate from "@/components/rules-code-gate";
import { cn } from "@/lib/utils";

const CODE_BADGE: Record<number, string> = { 0: "All", 1: "Moto", 2: "Light", 3: "Heavy" };

function SubheadingGroup({ subheading, list, favorites, doneIds, onToggleFav, onToggleDone, onClearBookmarks, forceOpen }: any) {
  const [open, setOpen] = useState(false);
  const isOpen = forceOpen || open;
  const allDone = list.length > 0 && list.every((r: StudyRule) => doneIds.includes(r.id));
  const hasFavs = list.some((r: StudyRule) => favorites.includes(r.id));
  const hasDone = list.some((r: StudyRule) => doneIds.includes(r.id));
  return (
    <div className="rounded-2xl border border-border bg-card/40">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-2.5 text-left">
        <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
          {allDone && <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
          {subheading} <span className="text-muted-foreground/60">({list.length})</span>
        </span>
        <span className="flex items-center gap-1.5">
          {hasFavs && (
            <span
              role="button"
              aria-label="Clear favorites"
              title="Clear favorites"
              onClick={(e) => { e.stopPropagation(); onClearBookmarks("favorite", list.map((r: StudyRule) => r.id)); }}
              className="p-1 text-red-500"
            >
              <HeartOff className="h-3.5 w-3.5" />
            </span>
          )}
          {hasDone && (
            <span
              role="button"
              aria-label="Clear done"
              title="Clear done"
              onClick={(e) => { e.stopPropagation(); onClearBookmarks("done", list.map((r: StudyRule) => r.id)); }}
              className="p-1 text-green-600"
            >
              <CircleX className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
        </span>
      </button>
      {isOpen && (
        <div className="px-3 pb-3 space-y-2">
          {list.map((r: StudyRule) => {
            const fav = favorites.includes(r.id);
            const done = doneIds.includes(r.id);
            return (
              <div key={r.id} className="rounded-2xl border border-border bg-card p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <FormattedText text={r.body} className={cn("text-sm leading-snug flex-1", done && "text-muted-foreground line-through")} />
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => onToggleFav(r.id)}
                      aria-label="Toggle favorite"
                      className="p-1"
                    >
                      <Heart className={cn("h-4 w-4", fav ? "fill-red-500 text-red-500" : "text-muted-foreground")} />
                    </button>
                    <button
                      onClick={() => onToggleDone(r.id)}
                      aria-label="Mark done"
                      className="p-1"
                    >
                      <CheckCircle2 className={cn("h-4 w-4", done ? "fill-green-600 text-green-600" : "text-muted-foreground")} />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 items-center">
                  <span className="text-[10px] font-mono text-muted-foreground">{r.section_ref}</span>
                  {(r.applicable_codes || []).map((c: number) => (
                    <Badge key={c} variant="outline" className="text-[10px] font-mono py-0">
                      {CODE_BADGE[c] ?? c}
                    </Badge>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function StudyRulesBrowse() {
  const [, setLocation] = useLocation();
  const allowed = useStudyGate();
  const [search, setSearch] = useState("");
  const [favOnly, setFavOnly] = useState(false);
  const [favsTick, setFavsTick] = useState(0);

  return (
    <Layout>
      <RulesCodeGate>
        {(code, reset) => <BrowseInner key={code} code={code} reset={reset} allowed={allowed} setLocation={setLocation} search={search} setSearch={setSearch} favOnly={favOnly} setFavOnly={setFavOnly} favsTick={favsTick} setFavsTick={setFavsTick} />}
      </RulesCodeGate>
    </Layout>
  );
}

function BrowseInner({
  code,
  reset,
  allowed,
  setLocation,
  search,
  setSearch,
  favOnly,
  setFavOnly,
  favsTick,
  setFavsTick,
}: any) {
  const { data: rules = [], isLoading } = useQuery<StudyRule[]>({
    queryKey: [`/api/rules?code=${code}`],
    queryFn: async () => {
      const r = await fetch(`/api/rules?code=${code}`);
      if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
      return r.json();
    },
    enabled: allowed,
  });

  const favorites = useMemo(() => getFavoriteRuleIds(), [favsTick]);
  const doneIds = useMemo(() => getDoneRuleIds(), [favsTick]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rules.filter((r) => {
      if (favOnly && !favorites.includes(r.id)) return false;
      if (q && !(r.body.toLowerCase().includes(q) || (r.title || "").toLowerCase().includes(q) || r.section_ref.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [rules, search, favOnly, favorites]);

  const grouped = useMemo(() => {
    const map = new Map<string, Map<string, StudyRule[]>>();
    for (const r of filtered) {
      const heading = r.heading || "General";
      const sub = r.subheading || "(general)";
      if (!map.has(heading)) map.set(heading, new Map());
      const inner = map.get(heading)!;
      if (!inner.has(sub)) inner.set(sub, []);
      inner.get(sub)!.push(r);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([heading, inner]) => [
        heading,
        Array.from(inner.entries()).sort(([a], [b]) => a.localeCompare(b)),
      ] as [string, [string, StudyRule[]][]]);
  }, [filtered]);

  return (
    <div className="py-4 space-y-4">
      <div className="flex items-center justify-between px-1">
        <button onClick={() => setLocation("/study")} className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Study
        </button>
        <div className="flex items-center gap-2">
          <button onClick={reset} className="text-xs font-semibold text-primary">Code {code} ▾</button>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setLocation(`/study/rules/flashcards`)}>
            <Layers className="h-3.5 w-3.5 mr-1" /> Flashcards
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search rules…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-11 bg-background/60 rounded-xl"
        />
      </div>

      <button
        onClick={() => setFavOnly(!favOnly)}
        className={cn(
          "text-xs font-semibold px-3 py-1.5 rounded-full border",
          favOnly ? "bg-red-500/10 border-red-300 text-red-600" : "border-border text-muted-foreground"
        )}
      >
        <Heart className="h-3 w-3 inline mr-1" /> Favorites {favorites.length > 0 && `(${favorites.length})`}
      </button>

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
      ) : grouped.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No rules match.</p>
      ) : (
        grouped.map(([heading, subs]) => {
          const headingDone = subs.every(([, list]) => list.length > 0 && list.every((r: StudyRule) => doneIds.includes(r.id)));
          const sectionIds = subs.flatMap(([, list]) => list.map((r: StudyRule) => r.id));
          const sectionHasFavs = sectionIds.some((id: number) => favorites.includes(id));
          const sectionHasDone = sectionIds.some((id: number) => doneIds.includes(id));
          return (
          <div key={heading} className="space-y-2">
            <p className="text-[11px] font-black uppercase tracking-widest text-primary px-1 flex items-center gap-1.5">
              {headingDone && <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
              {heading}
              {sectionHasFavs && (
                <button
                  aria-label="Clear favorites for this section"
                  title="Clear favorites"
                  onClick={() => { removeRuleBookmarks("favorite", sectionIds); setFavsTick((t: number) => t + 1); }}
                  className="text-red-500 ml-auto p-1"
                >
                  <HeartOff className="h-3.5 w-3.5" />
                </button>
              )}
              {sectionHasDone && (
                <button
                  aria-label="Clear done for this section"
                  title="Clear done"
                  onClick={() => { removeRuleBookmarks("done", sectionIds); setFavsTick((t: number) => t + 1); }}
                  className="text-green-600 p-1"
                >
                  <CircleX className="h-3.5 w-3.5" />
                </button>
              )}
            </p>
            {subs.map(([subheading, list]) => (
              <SubheadingGroup key={subheading} subheading={subheading} list={list} favorites={favorites} doneIds={doneIds} forceOpen={search.trim().length > 0} onToggleFav={(id: number) => { toggleFavoriteRule(id); setFavsTick((t: number) => t + 1); }} onToggleDone={(id: number) => { toggleDoneRule(id); setFavsTick((t: number) => t + 1); }} onClearBookmarks={(kind: "favorite" | "done", ids: number[]) => { removeRuleBookmarks(kind, ids); setFavsTick((t: number) => t + 1); }} />
            ))}
          </div>
          );
        })
      )}
    </div>
  );
}
