import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { StudyControl, ControlDiagram } from "@shared/schema";
import { Layout } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Heart, Layers, Search, ArrowLeft, CheckCircle2, HeartOff, RotateCcw } from "lucide-react";
import { toggleFavoriteControl, getFavoriteControlIds, setControlKnown, resetControlProgress, removeFavoriteControls, getAllControlLearning, initControlSync } from "@/lib/control-storage";
import { isKnown, countKnown } from "@/lib/learning-status";
import { ensureLocalOwner } from "@/lib/progress-owner";
import ControlDiagramView from "@/components/control-diagram-view";
import ControlsPractice from "@/components/controls-practice";
import { useStudyGate } from "./study";
import ControlsStudyGate from "@/components/controls-study-gate";
import { cn } from "@/lib/utils";

function resetSectionConfirm(ids: number[], label: string): boolean {
  return typeof window === "undefined" || window.confirm(`Reset this section (${label})? This clears your progress for these ${ids.length} controls.`);
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
      initControlSync().then(() => setFavsTick((t: number) => t + 1));
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
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search components or function…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-11 bg-background/60 rounded-xl" />
      </div>
      <button
        onClick={() => setFavOnly(!favOnly)}
        className={cn(
          "text-xs font-semibold px-3 py-1.5 rounded-full border",
          favOnly ? "bg-red-500/10 border-red-300 text-red-600" : "border-border text-muted-foreground"
        )}
      >
        <Heart className="h-3 w-3 inline mr-1" /> Saved {favorites.length > 0 && `(${favorites.length})`}
      </button>
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

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
      ) : byDiagram.size === 0 ? (
        <div className="text-center py-8 space-y-2">
          <p className="text-sm text-muted-foreground">No components match.</p>
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
        Array.from(byDiagram.entries()).map(([diagramId, list]) => {
          const diagram = diagrams.find((d) => d.id === diagramId);
          const groupLabel = diagram?.label || `Diagram ${diagramId}`;
          const stats = countKnown(list, learningMap);
          const allKnown = stats.total > 0 && stats.known === stats.total;
          const numbered = list.filter((c) => c.component_number != null).sort((a, b) => (a.component_number ?? 0) - (b.component_number ?? 0));
          const recognition = list.filter((c) => c.component_number == null);
          return (
            <div key={diagramId} className="space-y-2">
              <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground px-1 flex items-center gap-1.5">
                {allKnown && <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
                {groupLabel}
                {list.some((c) => favorites.includes(c.id)) && (
                  <button
                    aria-label="Clear saved for this diagram"
                    title="Clear saved"
                    onClick={() => clearSaved(list.map((c) => c.id))}
                    className="text-red-500 ml-auto p-1"
                  >
                    <HeartOff className="h-3.5 w-3.5" />
                  </button>
                )}
                {list.some((c) => learningMap[c.id]) && (
                  <button
                    aria-label="Reset this section"
                    title="Reset this section"
                    onClick={() => resetSection(list.map((c) => c.id), groupLabel)}
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
                <Heart className="h-3 w-3 text-red-500 fill-red-500" /> {list.filter((c) => favorites.includes(c.id)).length} saved
              </p>
            </div>
              {diagram && (
                <>
                  <ControlDiagramView
                    diagram={diagram}
                    controls={list}
                    mode="explore"
                    onMarkerSelect={(c) => setSelected((s) => ({ ...s, [diagramId]: c }))}
                  />
                  {selected[diagramId] && (
                    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3 space-y-1">
                      <p className="font-bold text-sm">
                        {selected[diagramId]!.component_number != null && `Control ${selected[diagramId]!.component_number} — `}
                        {selected[diagramId]!.component_name}
                      </p>
                      {selected[diagramId]!.function_notes && <p className="text-xs text-muted-foreground">{selected[diagramId]!.function_notes}</p>}
                    </div>
                  )}
                </>
              )}
              {numbered.map((c) => {
                const fav = favorites.includes(c.id);
                const known = isKnown(learningMap[c.id]?.status);
                return (
                  <div key={c.id} className="rounded-2xl border border-border bg-card p-4 flex items-start gap-3">
                    <span className="w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center shrink-0">{c.component_number}</span>
                    <div className="flex-1">
                      <p className={cn("font-bold text-sm", known && "text-muted-foreground line-through")}>{c.component_name}</p>
                      {c.function_notes && <p className="text-xs text-muted-foreground mt-1">{c.function_notes}</p>}
                    </div>
                    <button onClick={() => { toggleFavoriteControl(c.id); setFavsTick((t: number) => t + 1); }} aria-label="Save" className="pt-1">
                      <Heart className={cn("h-4 w-4", fav ? "fill-red-500 text-red-500" : "text-muted-foreground")} />
                    </button>
                    <button onClick={() => toggleKnown(c.id)} aria-label="I know this" className="pt-1">
                      <CheckCircle2 className={cn("h-4 w-4", known ? "fill-green-600 text-green-600" : "text-muted-foreground")} />
                    </button>
                  </div>
                );
              })}
              {recognition.length > 0 && (
                <div className="ml-2 border-l-2 border-dashed border-border pl-3 space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Recognition only</p>
                  {recognition.map((c) => {
                    const fav = favorites.includes(c.id);
                    const known = isKnown(learningMap[c.id]?.status);
                    return (
                      <div key={c.id} className="rounded-2xl border border-border/60 bg-card/60 p-3 flex items-start gap-3">
                        <div className="flex-1">
                          <p className={cn("font-bold text-sm", known && "text-muted-foreground line-through")}>{c.component_name}</p>
                          {c.function_notes && <p className="text-xs text-muted-foreground mt-1">{c.function_notes}</p>}
                        </div>
                        <button onClick={() => { toggleFavoriteControl(c.id); setFavsTick((t: number) => t + 1); }} aria-label="Save" className="pt-1">
                          <Heart className={cn("h-4 w-4", fav ? "fill-red-500 text-red-500" : "text-muted-foreground")} />
                        </button>
                        <button onClick={() => toggleKnown(c.id)} aria-label="I know this" className="pt-1">
                          <CheckCircle2 className={cn("h-4 w-4", known ? "fill-green-600 text-green-600" : "text-muted-foreground")} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
      )}
      </>
      )}
    </div>
  );
}
