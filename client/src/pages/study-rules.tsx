import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { StudyRule } from "@shared/schema";
import { Layout } from "@/components/layout";
import { ChipCollapsible } from "@/components/chip-collapsible";
import { FormattedText } from "@/components/formatted-text";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Heart, Layers, Search, ArrowLeft, ChevronDown, CheckCircle2, HeartOff, RotateCcw } from "lucide-react";
import { toggleFavoriteRule, getFavoriteRuleIds, setRuleKnown, resetRuleProgress, removeFavoriteRules, getAllRuleLearning, initRuleSync } from "@/lib/rule-storage";
import { isKnown, countKnown } from "@/lib/learning-status";
import { ensureLocalOwner } from "@/lib/progress-owner";
import { useStudyGate } from "./study";
import RulesCodeGate from "@/components/rules-code-gate";
import { cn } from "@/lib/utils";

const CODE_BADGE: Record<number, string> = { 0: "All", 1: "Moto", 2: "Light", 3: "Heavy" };

function resetSectionConfirm(ids: number[], label: string): boolean {
  return typeof window === "undefined" || window.confirm(`Reset this section (${label})? This clears your progress for these ${ids.length} rules.`);
}

function SubheadingGroup({ subheading, list, favorites, learningMap, onToggleFav, onToggleKnown, onResetSection, onClearSaved, forceOpen }: any) {
  const [open, setOpen] = useState(false);
  const isOpen = forceOpen || open;
  const allKnown = list.length > 0 && list.every((r: StudyRule) => isKnown(learningMap[r.id]?.status));
  const hasFavs = list.some((r: StudyRule) => favorites.includes(r.id));
  const hasProgress = list.some((r: StudyRule) => learningMap[r.id]);
  return (
    <div className="rounded-2xl border border-border bg-card/40">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-2.5 text-left">
        <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
          {allKnown && <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
          {subheading} <span className="text-muted-foreground/60">({list.length})</span>
        </span>
        <span className="flex items-center gap-1.5">
          {hasFavs && (
            <span
              role="button"
              aria-label="Clear saved"
              title="Clear saved"
              onClick={(e) => { e.stopPropagation(); onClearSaved(list.map((r: StudyRule) => r.id)); }}
              className="p-1 text-red-500"
            >
              <HeartOff className="h-3.5 w-3.5" />
            </span>
          )}
          {hasProgress && (
            <span
              role="button"
              aria-label="Reset this section"
              title="Reset this section"
              onClick={(e) => { e.stopPropagation(); onResetSection(list.map((r: StudyRule) => r.id), subheading); }}
              className="p-1 text-muted-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
        </span>
      </button>
      {isOpen && (
        <div className="px-3 pb-3 space-y-2">
          {list.map((r: StudyRule) => {
            const fav = favorites.includes(r.id);
            const known = isKnown(learningMap[r.id]?.status);
            return (
              <div key={r.id} className="rounded-2xl border border-border bg-card p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <FormattedText text={r.body} className={cn("text-sm leading-snug flex-1", known && "text-muted-foreground line-through")} />
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => onToggleFav(r.id)}
                      aria-label="Toggle saved"
                      className="p-1"
                    >
                      <Heart className={cn("h-4 w-4", fav ? "fill-red-500 text-red-500" : "text-muted-foreground")} />
                    </button>
                    <button
                      onClick={() => onToggleKnown(r.id)}
                      aria-label="I know this"
                      className="p-1"
                    >
                      <CheckCircle2 className={cn("h-4 w-4", known ? "fill-green-600 text-green-600" : "text-muted-foreground")} />
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

  useEffect(() => {
    if (allowed) {
      ensureLocalOwner();
      initRuleSync().then(() => setFavsTick((t: number) => t + 1));
    }
  }, [allowed]);

  const favorites = useMemo(() => getFavoriteRuleIds(), [favsTick]);
  const learningMap = useMemo(() => getAllRuleLearning(), [favsTick]);

  const [headingFilter, setHeadingFilter] = useState("all");
  const [subheadingFilter, setSubheadingFilter] = useState("all");
  const [learnedFilter, setLearnedFilter] = useState<"all" | "learned" | "not">("all");

  // Subheading chips only make sense once a specific heading is chosen;
  // under "All" the subheadings of every heading would just clutter the bar.
  useEffect(() => {
    setSubheadingFilter("all");
  }, [headingFilter]);

  const headings = useMemo(
    () => Array.from(new Set(rules.map((r) => r.heading || "General"))).sort(),
    [rules]
  );
  const subheadings = useMemo(
    () =>
      headingFilter === "all"
        ? []
        : Array.from(new Set(rules.filter((r) => (r.heading || "General") === headingFilter).map((r) => r.subheading || "(general)"))).sort(),
    [rules, headingFilter]
  );

  // Saved/learned chip counts respect every filter except the learned one itself.
  const progressCounts = useMemo(() => {
    const q = search.trim().toLowerCase();
    let learned = 0;
    let notLearned = 0;
    for (const r of rules) {
      const h = r.heading || "General";
      const s = r.subheading || "(general)";
      if (headingFilter !== "all" && h !== headingFilter) continue;
      if (subheadingFilter !== "all" && s !== subheadingFilter) continue;
      if (favOnly && !favorites.includes(r.id)) continue;
      if (q && !(r.body.toLowerCase().includes(q) || (r.title || "").toLowerCase().includes(q) || r.section_ref.toLowerCase().includes(q))) continue;
      if (isKnown(learningMap[r.id]?.status)) learned++;
      else notLearned++;
    }
    return { learned, notLearned };
  }, [rules, headingFilter, subheadingFilter, search, favOnly, favorites, learningMap]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rules.filter((r) => {
      const h = r.heading || "General";
      const s = r.subheading || "(general)";
      if (headingFilter !== "all" && h !== headingFilter) return false;
      if (subheadingFilter !== "all" && s !== subheadingFilter) return false;
      if (favOnly && !favorites.includes(r.id)) return false;
      if (learnedFilter === "learned" && !isKnown(learningMap[r.id]?.status)) return false;
      if (learnedFilter === "not" && isKnown(learningMap[r.id]?.status)) return false;
      if (q && !(r.body.toLowerCase().includes(q) || (r.title || "").toLowerCase().includes(q) || r.section_ref.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [rules, search, favOnly, favorites, headingFilter, subheadingFilter, learnedFilter, learningMap]);

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

  const toggleKnown = (id: number) => {
    setRuleKnown(id, !isKnown(learningMap[id]?.status));
    setFavsTick((t: number) => t + 1);
  };

  const resetSection = (ids: number[], label: string) => {
    if (!resetSectionConfirm(ids, label)) return;
    resetRuleProgress(ids);
    setFavsTick((t: number) => t + 1);
  };

  const clearSaved = (ids: number[]) => {
    removeFavoriteRules(ids);
    setFavsTick((t: number) => t + 1);
  };

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

      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setFavOnly(!favOnly)}
          className={cn(
            "px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border flex items-center gap-1",
            favOnly ? "bg-red-500/10 border-red-300 text-red-600" : "border-border text-muted-foreground"
          )}
        >
          <Heart className={cn("h-3 w-3", favOnly && "fill-red-500")} />{" "}Saved{favorites.length > 0 ? ` (${favorites.length})` : ""}
        </button>
        {["all", ...headings].map((h) => (
          <button
            key={h}
            onClick={() => setHeadingFilter(h)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border",
              headingFilter === h ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"
            )}
          >
            {h === "all" ? "All" : h}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setLearnedFilter(learnedFilter === "learned" ? "all" : "learned")}
          className={cn(
            "px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap border flex items-center gap-1",
            learnedFilter === "learned"
              ? "bg-green-500/10 border-green-300 text-green-700"
              : "border-border text-muted-foreground"
          )}
        >
          <CheckCircle2 className={cn("h-3 w-3", learnedFilter === "learned" && "text-green-600")} /> Learned ({progressCounts.learned})
        </button>
        <button
          onClick={() => setLearnedFilter(learnedFilter === "not" ? "all" : "not")}
          className={cn(
            "px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap border flex items-center gap-1",
            learnedFilter === "not"
              ? "bg-amber-500/10 border-amber-300 text-amber-700"
              : "border-border text-muted-foreground"
          )}
        >
          <RotateCcw className="h-3 w-3" /> Not learned ({progressCounts.notLearned})
        </button>
      </div>
      {headingFilter !== "all" && subheadings.length > 1 && (
        <ChipCollapsible key={headingFilter} recheckKey={`${headingFilter}|${subheadings.length}`}>
          {["all", ...subheadings].map((s) => (
            <button
              key={s}
              onClick={() => setSubheadingFilter(s)}
              className={cn(
                "px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap",
                subheadingFilter === s ? "bg-accent text-foreground" : "text-muted-foreground"
              )}
            >
              {s === "all" ? "All" : s}
            </button>
          ))}
        </ChipCollapsible>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
      ) : grouped.length === 0 ? (
        <div className="text-center py-8 space-y-2">
          <p className="text-sm text-muted-foreground">No rules match.</p>
          {(favOnly || learnedFilter !== "all") && (
            <div className="flex justify-center gap-2">
              {favOnly && (
                <Button variant="outline" size="sm" onClick={() => setFavOnly(false)}>
                  Turn off Saved filter
                </Button>
              )}
              {learnedFilter !== "all" && (
                <Button variant="outline" size="sm" onClick={() => setLearnedFilter("all")}>
                  Turn off learned filter
                </Button>
              )}
            </div>
          )}
        </div>
      ) : (
        grouped.map(([heading, subs]) => {
          const sectionIds = subs.flatMap(([, list]) => list.map((r: StudyRule) => r.id));
          const stats = countKnown(subs.flatMap(([, list]) => list as StudyRule[]), learningMap);
          const savedCount = sectionIds.filter((id: number) => favorites.includes(id)).length;
          const allKnown = stats.total > 0 && stats.known === stats.total;
          const sectionHasFavs = sectionIds.some((id: number) => favorites.includes(id));
          const sectionHasProgress = sectionIds.some((id: number) => learningMap[id]);
          return (
          <div key={heading} className="space-y-2">
            <p className="text-[11px] font-black uppercase tracking-widest text-primary px-1 flex items-center gap-1.5">
              {allKnown && <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
              {heading}
              {sectionHasFavs && (
                <button
                  aria-label="Clear saved for this section"
                  title="Clear saved"
                  onClick={() => clearSaved(sectionIds)}
                  className="text-red-500 ml-auto p-1"
                >
                  <HeartOff className="h-3.5 w-3.5" />
                </button>
              )}
              {sectionHasProgress && (
                <button
                  aria-label="Reset this section"
                  title="Reset this section"
                  onClick={() => resetSection(sectionIds, heading)}
                  className="text-muted-foreground p-1"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              )}
            </p>
            <div className="px-1 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-muted-foreground whitespace-nowrap">
                  {stats.known} of {stats.total} learned
                </span>
                <Progress value={stats.total > 0 ? (stats.known / stats.total) * 100 : 0} className="h-1 flex-1" />
              </div>
              <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                <Heart className="h-3 w-3 text-red-500 fill-red-500" /> {savedCount} saved
              </p>
            </div>
            {subs.map(([subheading, list]) => (
              <SubheadingGroup key={subheading} subheading={subheading} list={list} favorites={favorites} learningMap={learningMap} forceOpen={search.trim().length > 0} onToggleFav={(id: number) => { toggleFavoriteRule(id); setFavsTick((t: number) => t + 1); }} onToggleKnown={toggleKnown} onResetSection={resetSection} onClearSaved={clearSaved} />
            ))}
          </div>
          );
        })
      )}
    </div>
  );
}
