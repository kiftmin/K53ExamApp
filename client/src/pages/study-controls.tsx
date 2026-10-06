import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { StudyControl, ControlDiagram } from "@shared/schema";
import { Layout } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, Layers, Search, ArrowLeft, CheckCircle2, HeartOff, CircleX } from "lucide-react";
import { toggleFavoriteControl, getFavoriteControlIds, getDoneControlIds, toggleDoneControl, removeControlBookmarks } from "@/lib/control-storage";
import ControlDiagramView from "@/components/control-diagram-view";
import ControlsPractice from "@/components/controls-practice";
import { useStudyGate } from "./study";
import ControlsStudyGate from "@/components/controls-study-gate";
import { cn } from "@/lib/utils";

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
  const { data: diagrams = [] } = useQuery<ControlDiagram[]>({ queryKey: ["/api/control-diagrams"] });

  const byDiagram = useMemo(() => {
    const q = search.trim().toLowerCase();
    const favSet = new Set(getFavoriteControlIds());
    const map = new Map<number, StudyControl[]>();
    for (const c of controls) {
      if (favOnly && !favSet.has(c.id)) continue;
      if (q && !(c.component_name.toLowerCase().includes(q) || (c.function_notes || "").toLowerCase().includes(q) || String(c.component_number ?? "").includes(q))) continue;
      if (!map.has(c.diagram_id)) map.set(c.diagram_id, []);
      map.get(c.diagram_id)!.push(c);
    }
    return map;
  }, [controls, search, favOnly, favsTick]);

  const favorites = useMemo(() => getFavoriteControlIds(), [favsTick]);
  const doneIds = useMemo(() => getDoneControlIds(), [favsTick]);

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
        <Heart className="h-3 w-3 inline mr-1" /> Favorites {favorites.length > 0 && `(${favorites.length})`}
      </button>

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
      ) : byDiagram.size === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No components match.</p>
      ) : (
        Array.from(byDiagram.entries()).map(([diagramId, list]) => {
          const diagram = diagrams.find((d) => d.id === diagramId);
          const numbered = list.filter((c) => c.component_number != null).sort((a, b) => (a.component_number ?? 0) - (b.component_number ?? 0));
          const recognition = list.filter((c) => c.component_number == null);
          return (
            <div key={diagramId} className="space-y-2">
              <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground px-1 flex items-center gap-1.5">
                {list.length > 0 && list.every((c) => doneIds.includes(c.id)) && <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
                {diagram?.label || `Diagram ${diagramId}`}
                {list.some((c) => favorites.includes(c.id)) && (
                  <button
                    aria-label="Clear favorites for this diagram"
                    title="Clear favorites"
                    onClick={() => { removeControlBookmarks("favorite", list.map((c) => c.id)); setFavsTick((t: number) => t + 1); }}
                    className="text-red-500 ml-auto p-1"
                  >
                    <HeartOff className="h-3.5 w-3.5" />
                  </button>
                )}
                {list.some((c) => doneIds.includes(c.id)) && (
                  <button
                    aria-label="Clear done for this diagram"
                    title="Clear done"
                    onClick={() => { removeControlBookmarks("done", list.map((c) => c.id)); setFavsTick((t: number) => t + 1); }}
                    className="text-green-600 p-1"
                  >
                    <CircleX className="h-3.5 w-3.5" />
                  </button>
                )}
              </p>
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
                const done = doneIds.includes(c.id);
                return (
                  <div key={c.id} className="rounded-2xl border border-border bg-card p-4 flex items-start gap-3">
                    <span className="w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center shrink-0">{c.component_number}</span>
                    <div className="flex-1">
                      <p className={cn("font-bold text-sm", done && "text-muted-foreground line-through")}>{c.component_name}</p>
                      {c.function_notes && <p className="text-xs text-muted-foreground mt-1">{c.function_notes}</p>}
                    </div>
                    <button onClick={() => { toggleFavoriteControl(c.id); setFavsTick((t: number) => t + 1); }} aria-label="Favorite" className="pt-1">
                      <Heart className={cn("h-4 w-4", fav ? "fill-red-500 text-red-500" : "text-muted-foreground")} />
                    </button>
                    <button onClick={() => { toggleDoneControl(c.id); setFavsTick((t: number) => t + 1); }} aria-label="Mark done" className="pt-1">
                      <CheckCircle2 className={cn("h-4 w-4", done ? "fill-green-600 text-green-600" : "text-muted-foreground")} />
                    </button>
                  </div>
                );
              })}
              {recognition.length > 0 && (
                <div className="ml-2 border-l-2 border-dashed border-border pl-3 space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Recognition only</p>
                  {recognition.map((c) => {
                    const fav = favorites.includes(c.id);
                    const done = doneIds.includes(c.id);
                    return (
                      <div key={c.id} className="rounded-2xl border border-border/60 bg-card/60 p-3 flex items-start gap-3">
                        <div className="flex-1">
                          <p className={cn("font-bold text-sm", done && "text-muted-foreground line-through")}>{c.component_name}</p>
                          {c.function_notes && <p className="text-xs text-muted-foreground mt-1">{c.function_notes}</p>}
                        </div>
                        <button onClick={() => { toggleFavoriteControl(c.id); setFavsTick((t: number) => t + 1); }} aria-label="Favorite" className="pt-1">
                          <Heart className={cn("h-4 w-4", fav ? "fill-red-500 text-red-500" : "text-muted-foreground")} />
                        </button>
                        <button onClick={() => { toggleDoneControl(c.id); setFavsTick((t: number) => t + 1); }} aria-label="Mark done" className="pt-1">
                          <CheckCircle2 className={cn("h-4 w-4", done ? "fill-green-600 text-green-600" : "text-muted-foreground")} />
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
