import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { StudyRule } from "@shared/schema";
import { Layout } from "@/components/layout";
import { FormattedText } from "@/components/formatted-text";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, Layers, ArrowLeft, ChevronDown, CheckCircle2, HeartOff, RotateCcw, BookOpen, ScrollText, Signpost, Route, Car, Scale, Gavel, SearchX, type LucideIcon } from "lucide-react";
import { toggleFavoriteRule, getFavoriteRuleIds, setRuleKnown, resetRuleProgress, removeFavoriteRules, getAllRuleLearning, initRuleSync } from "@/lib/rule-storage";
import { initQuestionSync } from "@/lib/question-results";
import { isKnown, countKnown } from "@/lib/learning-status";
import { ensureLocalOwner } from "@/lib/progress-owner";
import { useStudyGate } from "./study";
import RulesCodeGate from "@/components/rules-code-gate";
import {
  StudyCategoryTabs,
  StudyGroupCard,
  StudyRowAction,
  StudySearchField,
  StudyStatusBar,
  StudySubCategoryTabs,
  StudySubRow,
} from "@/components/study-browse";
import { sentenceCase, titleCase } from "@/lib/text-case";
import { cn } from "@/lib/utils";

const CODE_BADGE: Record<number, string> = { 0: "All", 1: "Moto", 2: "Light", 3: "Heavy" };

function resetSectionConfirm(ids: number[], label: string): boolean {
  return typeof window === "undefined" || window.confirm(`Reset this section (${label})? This clears your progress for these ${ids.length} rules.`);
}

/** Icon anchor so a rule section is recognisable before it is read. */
function ruleIconFor(label: string): LucideIcon {
  const text = label.toLowerCase();
  if (text.includes("licen")) return ScrollText;
  if (text.includes("sign")) return Signpost;
  if (text.includes("road") || text.includes("lane") || text.includes("street") || text.includes("parking") || text.includes("overtak")) return Route;
  if (text.includes("vehicle") || text.includes("engine") || text.includes("tyre") || text.includes("brake") || text.includes("windscreen")) return Car;
  if (text.includes("accident") || text.includes("insurance") || text.includes("disqualif")) return Scale;
  if (text.includes("rule") || text.includes("traffic")) return Gavel;
  if (text.includes("definition") || text.includes("general")) return BookOpen;
  return ScrollText;
}

function SubheadingGroup({ subheading, list, favorites, learningMap, onToggleFav, onToggleKnown, onResetSection, onClearSaved, forceOpen }: any) {
  const [open, setOpen] = useState(false);
  const isOpen = forceOpen || open;
  const hasFavs = list.some((r: StudyRule) => favorites.includes(r.id));
  const hasProgress = list.some((r: StudyRule) => learningMap[r.id]);
  return (
    <StudySubRow
      icon={ruleIconFor(subheading)}
      title={sentenceCase(subheading)}
      countLabel={`${list.length} ${list.length === 1 ? "rule" : "rules"}`}
      open={isOpen}
      onToggle={() => setOpen(!open)}
      actions={
        <>
          {hasFavs && (
            <StudyRowAction
              label="Clear saved"
              active
              activeClassName="text-red-500"
              inactiveClassName="text-red-500"
              onClick={() => onClearSaved(list.map((r: StudyRule) => r.id))}
            >
              <HeartOff className="h-4 w-4" />
            </StudyRowAction>
          )}
          {hasProgress && (
            <StudyRowAction
              label="Reset this section"
              active
              activeClassName="text-muted-foreground"
              inactiveClassName="text-muted-foreground"
              onClick={() => onResetSection(list.map((r: StudyRule) => r.id), subheading)}
            >
              <RotateCcw className="h-4 w-4" />
            </StudyRowAction>
          )}
        </>
      }
    >
      {list.map((r: StudyRule) => {
        const fav = favorites.includes(r.id);
        const known = isKnown(learningMap[r.id]?.status);
        return (
          <div key={r.id} className="rounded-xl bg-muted/40 p-3 flex items-start gap-3">
            <div className="flex-1 min-w-0 space-y-1.5">
              <FormattedText text={r.body} className={cn("text-sm leading-snug", known && "text-muted-foreground line-through")} />
              <div className="flex flex-wrap gap-1 items-center">
                <span className="text-[10px] font-mono text-muted-foreground">{r.section_ref}</span>
                {(r.applicable_codes || []).map((c: number) => (
                  <Badge key={c} variant="outline" className="text-[10px] font-mono py-0">
                    {CODE_BADGE[c] ?? c}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <StudyRowAction
                label="Toggle saved"
                active={fav}
                activeClassName="fill-red-500 text-red-500"
                inactiveClassName="text-muted-foreground"
                onClick={() => onToggleFav(r.id)}
              >
                <Heart className="h-4 w-4" />
              </StudyRowAction>
              <StudyRowAction
                label="I know this"
                active={known}
                activeClassName="fill-green-600 text-green-600"
                inactiveClassName="text-muted-foreground"
                onClick={() => onToggleKnown(r.id)}
              >
                <CheckCircle2 className="h-4 w-4" />
              </StudyRowAction>
            </div>
          </div>
        );
      })}
    </StudySubRow>
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
      Promise.all([initRuleSync(), initQuestionSync()]).then(() => setFavsTick((t: number) => t + 1));
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

      <StudySearchField value={search} onChange={setSearch} placeholder="Search rules…" />

      <StudyCategoryTabs
        tabs={[{ id: "all", label: "All" }, ...headings.map((h) => ({ id: h, label: titleCase(h) }))]}
        value={headingFilter}
        onChange={setHeadingFilter}
      />
      <StudyStatusBar
        learned={progressCounts.learned}
        notLearned={progressCounts.notLearned}
        saved={favorites.length}
        learnedFilter={learnedFilter}
        onLearnedFilter={setLearnedFilter}
        savedOnly={favOnly}
        onSavedOnly={setFavOnly}
      />
      {headingFilter !== "all" && subheadings.length > 1 && (
        <StudySubCategoryTabs
          tabs={[{ id: "all", label: "All" }, ...subheadings.map((s) => ({ id: s, label: sentenceCase(s) }))]}
          value={subheadingFilter}
          onChange={setSubheadingFilter}
        />
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
      ) : grouped.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-3">
          <SearchX className="h-7 w-7 mx-auto text-muted-foreground" />
          <p className="font-semibold">No rules match</p>
          <p className="text-sm text-muted-foreground">Try another search or switch off a filter.</p>
          {(favOnly || learnedFilter !== "all") && (
            <div className="flex flex-wrap justify-center gap-2 pt-1">
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
          const sectionHasFavs = sectionIds.some((id: number) => favorites.includes(id));
          const sectionHasProgress = sectionIds.some((id: number) => learningMap[id]);
          return (
          <StudyGroupCard
            key={heading}
            icon={ruleIconFor(heading)}
            title={titleCase(heading)}
            known={stats.known}
            total={stats.total}
            savedCount={savedCount}
            onClearSaved={sectionHasFavs ? () => clearSaved(sectionIds) : undefined}
            onReset={sectionHasProgress ? () => resetSection(sectionIds, heading) : undefined}
          >
            {subs.map(([subheading, list]) => (
              <SubheadingGroup key={subheading} subheading={subheading} list={list} favorites={favorites} learningMap={learningMap} forceOpen={search.trim().length > 0} onToggleFav={(id: number) => { toggleFavoriteRule(id); setFavsTick((t: number) => t + 1); }} onToggleKnown={toggleKnown} onResetSection={resetSection} onClearSaved={clearSaved} />
            ))}
          </StudyGroupCard>
          );
        })
      )}
    </div>
  );
}
