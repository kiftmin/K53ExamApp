import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { StudyControl, ControlDiagram } from "@shared/schema";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Heart, Layers, ArrowLeft, CheckCircle2, HeartOff, RotateCcw, Gauge, Cog, Wrench, SearchX, type LucideIcon } from "lucide-react";
import { toggleFavoriteControl, getFavoriteControlIds, setControlKnown, resetControlProgress, removeFavoriteControls, getAllControlLearning, initControlSync } from "@/lib/control-storage";
import { initQuestionSync } from "@/lib/question-results";
import { isKnown, countKnown } from "@/lib/learning-status";
import { ensureLocalOwner } from "@/lib/progress-owner";
import ControlDiagramView from "@/components/control-diagram-view";
import ControlsPractice from "@/components/controls-practice";
import { useStudyGate } from "./study";
import ControlsStudyGate from "@/components/controls-study-gate";
import {
  StudyGroupCard,
  StudyRowAction,
  StudySearchField,
  StudyStatusBar,
} from "@/components/study-browse";
import { cn } from "@/lib/utils";

function resetSectionConfirm(ids: number[], label: string): boolean {
  return typeof window === "undefined" || window.confirm(`Reset this section (${label})? This clears your progress for these ${ids.length} controls.`);
}

/** Icon anchor for a cockpit diagram. */
function diagramIconFor(label: string): LucideIcon {
  const text = label.toLowerCase();
  if (text.includes("motorcycle")) return Gauge;
  if (text.includes("manual") || text.includes("gearbox")) return Cog;
  return Wrench;
}

function ControlRow({
  control,
  fav,
  known,
  onToggleFav,
  onToggleKnown,
}: {
  control: StudyControl;
  fav: boolean;
  known: boolean;
  onToggleFav: () => void;
  onToggleKnown: () => void;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
        {control.component_number ?? "•"}
      </span>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-semibold leading-snug", known && "text-muted-foreground line-through")}>
          {control.component_name}
        </p>
        {control.function_notes && <p className="text-xs text-muted-foreground mt-0.5">{control.function_notes}</p>}
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        <StudyRowAction
          label="Save"
          active={fav}
          activeClassName="fill-red-500 text-red-500"
          inactiveClassName="text-muted-foreground"
          onClick={onToggleFav}
        >
          <Heart className="h-4 w-4" />
        </StudyRowAction>
        <StudyRowAction
          label="I know this"
          active={known}
          activeClassName="fill-green-600 text-green-600"
          inactiveClassName="text-muted-foreground"
          onClick={onToggleKnown}
        >
          <CheckCircle2 className="h-4 w-4" />
        </StudyRowAction>
      </div>
    </div>
  );
}

export default function StudyControlsBrowse() {
  const [, setLocation] = useLocation();
  const allowed = useStudyGate();
  const [search, setSearch] = useState("");
  const [favOnly, setFavOnly] = useState(false);
  const [favsTick, setFavsTick] = useState(0);

  return (
    <Layout>
      <ControlsStudyGate>
        {(licence, gearbox, reset) => (
          <BrowseInner
            key={`${licence}-${gearbox ?? "none"}`}
            licence={licence} gearbox={gearbox} reset={reset} allowed={allowed} setLocation={setLocation}
            search={search} setSearch={setSearch} favOnly={favOnly} setFavOnly={setFavOnly} favsTick={favsTick} setFavsTick={setFavsTick}
          />
        )}
      </ControlsStudyGate>
    </Layout>
  );
}

function BrowseInner({ licence, gearbox, reset, allowed, setLocation, search, setSearch, favOnly, setFavOnly, favsTick, setFavsTick }: any) {
  const [selected, setSelected] = useState<Record<number, StudyControl | null>>({});
  const [view, setView] = useState<"explore" | "practice">("explore");
  const vehicle_type = licence === 1 ? "motorcycle" : licence === 2 ? "lmv" : "hmv";
  const gearboxParam = vehicle_type === "motorcycle" ? undefined : gearbox;

  const { data: controls = [], isLoading } = useQuery<StudyControl[]>({
    queryKey: [`/api/controls?vehicle_type=${vehicle_type}${gearboxParam ? `&gearbox=${gearboxParam}` : ""}`],
    queryFn: async () => {
      const r = await fetch(`/api/controls?vehicle_type=${vehicle_type}${gearboxParam ? `&gearbox=${gearboxParam}` : ""}`);
      if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
      return r.json();
    },
    enabled: allowed,
  });

  useEffect(() => {
    if (allowed) {
      ensureLocalOwner();
      Promise.all([initControlSync(), initQuestionSync()]).then(() => setFavsTick((t: number) => t + 1));
    }
  }, [allowed]);
  const { data: diagrams = [] } = useQuery<ControlDiagram[]>({ queryKey: ["/api/control-diagrams"] });

  const favorites = useMemo(() => getFavoriteControlIds(), [favsTick]);
  const learningMap = useMemo(() => getAllControlLearning(), [favsTick]);
  const [learnedFilter, setLearnedFilter] = useState<"all" | "learned" | "not">("all");

  // Saved/learned chip counts respect every filter except the learned one itself.
  const progressCounts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const favSet = new Set(favorites);
    let learned = 0;
    let notLearned = 0;
    for (const c of controls) {
      if (favOnly && !favSet.has(c.id)) continue;
      if (q && !(c.component_name.toLowerCase().includes(q) || (c.function_notes || "").toLowerCase().includes(q) || String(c.component_number ?? "").includes(q))) continue;
      if (isKnown(learningMap[c.id]?.status)) learned++;
      else notLearned++;
    }
    return { learned, notLearned };
  }, [controls, search, favOnly, favorites, learningMap]);

  const byDiagram = useMemo(() => {
    const q = search.trim().toLowerCase();
    const favSet = new Set(getFavoriteControlIds());
    const map = new Map<number, StudyControl[]>();
    for (const c of controls) {
      if (favOnly && !favSet.has(c.id)) continue;
      if (learnedFilter === "learned" && !isKnown(learningMap[c.id]?.status)) continue;
      if (learnedFilter === "not" && isKnown(learningMap[c.id]?.status)) continue;
      if (q && !(c.component_name.toLowerCase().includes(q) || (c.function_notes || "").toLowerCase().includes(q) || String(c.component_number ?? "").includes(q))) continue;
      if (!map.has(c.diagram_id)) map.set(c.diagram_id, []);
      map.get(c.diagram_id)!.push(c);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controls, search, favOnly, favsTick, learnedFilter, learningMap]);

  const toggleKnown = (id: number) => {
    setControlKnown(id, !isKnown(learningMap[id]?.status));
    setFavsTick((t: number) => t + 1);
  };

  const resetSection = (ids: number[], label: string) => {
    if (!resetSectionConfirm(ids, label)) return;
    resetControlProgress(ids);
    setFavsTick((t: number) => t + 1);
  };

  const clearSaved = (ids: number[]) => {
    removeFavoriteControls(ids);
    setFavsTick((t: number) => t + 1);
  };

  return (
    <div className="py-4 space-y-4">
      <div className="flex items-center justify-between px-1">
        <button onClick={() => setLocation("/study")} className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Study
        </button>
        <div className="flex items-center gap-2">
          <button onClick={reset} className="text-xs font-semibold text-primary">
            Code {licence}{gearbox ? ` · ${gearbox}` : ""} ▾
          </button>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setLocation("/study/controls/flashcards")}>
            <Layers className="h-3.5 w-3.5 mr-1" /> Flashcards
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 rounded-xl border border-border p-1 bg-muted/40">
        {([{ k: "explore", label: "Explore" }, { k: "practice", label: "Diagram quiz" }] as const).map(({ k, label }) => (
          <button
            key={k}
            onClick={() => setView(k)}
            className={cn("h-9 rounded-lg text-xs font-bold", view === k ? "bg-background shadow-sm text-foreground" : "text-muted-foreground")}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "practice" ? (
        <ControlsPractice controls={controls} diagrams={diagrams} />
      ) : (
      <>
      <StudySearchField value={search} onChange={setSearch} placeholder="Search components or function…" />
      <StudyStatusBar
        learned={progressCounts.learned}
        notLearned={progressCounts.notLearned}
        saved={favorites.length}
        learnedFilter={learnedFilter}
        onLearnedFilter={setLearnedFilter}
        savedOnly={favOnly}
        onSavedOnly={setFavOnly}
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
      ) : byDiagram.size === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-3">
          <SearchX className="h-7 w-7 mx-auto text-muted-foreground" />
          <p className="font-semibold">No components match</p>
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
        Array.from(byDiagram.entries()).map(([diagramId, list]) => {
          const diagram = diagrams.find((d) => d.id === diagramId);
          const groupLabel = diagram?.label || `Diagram ${diagramId}`;
          const stats = countKnown(list, learningMap);
          const numbered = list.filter((c) => c.component_number != null).sort((a, b) => (a.component_number ?? 0) - (b.component_number ?? 0));
          const recognition = list.filter((c) => c.component_number == null);
          const savedCount = list.filter((c) => favorites.includes(c.id)).length;
          return (
            <StudyGroupCard
              key={diagramId}
              icon={diagramIconFor(groupLabel)}
              title={groupLabel}
              known={stats.known}
              total={stats.total}
              savedCount={savedCount}
              onClearSaved={savedCount > 0 ? () => clearSaved(list.map((c) => c.id)) : undefined}
              onReset={list.some((c) => learningMap[c.id]) ? () => resetSection(list.map((c) => c.id), groupLabel) : undefined}
            >
              {diagram && (
                <div className="py-3">
                  <ControlDiagramView
                    diagram={diagram}
                    controls={list}
                    mode="explore"
                    onMarkerSelect={(c) => setSelected((s) => ({ ...s, [diagramId]: c }))}
                  />
                  {selected[diagramId] && (
                    <div className="mt-2 rounded-xl bg-primary/5 border border-primary/20 p-3 space-y-1">
                      <p className="font-bold text-sm">
                        {selected[diagramId]!.component_number != null && `Control ${selected[diagramId]!.component_number} — `}
                        {selected[diagramId]!.component_name}
                      </p>
                      {selected[diagramId]!.function_notes && <p className="text-xs text-muted-foreground">{selected[diagramId]!.function_notes}</p>}
                    </div>
                  )}
                </div>
              )}
              {numbered.map((c) => (
                <ControlRow
                  key={c.id}
                  control={c}
                  fav={favorites.includes(c.id)}
                  known={isKnown(learningMap[c.id]?.status)}
                  onToggleFav={() => { toggleFavoriteControl(c.id); setFavsTick((t: number) => t + 1); }}
                  onToggleKnown={() => toggleKnown(c.id)}
                />
              ))}
              {recognition.length > 0 && (
                <>
                  <p className="pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Recognition only</p>
                  {recognition.map((c) => (
                    <ControlRow
                      key={c.id}
                      control={c}
                      fav={favorites.includes(c.id)}
                      known={isKnown(learningMap[c.id]?.status)}
                      onToggleFav={() => { toggleFavoriteControl(c.id); setFavsTick((t: number) => t + 1); }}
                      onToggleKnown={() => toggleKnown(c.id)}
                    />
                  ))}
                </>
              )}
            </StudyGroupCard>
          );
        })
      )}
      </>
      )}
    </div>
  );
}
