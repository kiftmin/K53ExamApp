import { useMemo, useRef, useState, type TouchEvent as ReactTouchEvent } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { StudyControl } from "@shared/schema";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { getFavoriteControlIds, getSeenControlIds, markControlSeen, rateControl, getAllControlLearning, type RecallRating } from "@/lib/control-storage";
import { ArrowLeft, ChevronLeft, ChevronRight, RotateCcw, Shuffle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStudyGate } from "./study";
import ControlsStudyGate from "@/components/controls-study-gate";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function StudyControlsFlashcards() {
  const [, setLocation] = useLocation();
  const allowed = useStudyGate();
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [unseenOnly, setUnseenOnly] = useState(false);
  const [shuffled, setShuffled] = useState(true);
  const [reshuffleKey, setReshuffleKey] = useState(0);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [direction, setDirection] = useState<"recognition" | "recall">("recognition");
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);

  return (
    <Layout>
      <ControlsStudyGate>
        {(licence, gearbox, reset) => (
          <Deck
            licence={licence} gearbox={gearbox} reset={reset} allowed={allowed} setLocation={setLocation}
            favoritesOnly={favoritesOnly} setFavoritesOnly={setFavoritesOnly}
            unseenOnly={unseenOnly} setUnseenOnly={setUnseenOnly}
            shuffled={shuffled} setShuffled={setShuffled}
            reshuffleKey={reshuffleKey} setReshuffleKey={setReshuffleKey}
            index={index} setIndex={setIndex} flipped={flipped} setFlipped={setFlipped}
            direction={direction} setDirection={setDirection}
            touchStart={touchStart} swiped={swiped}
          />
        )}
      </ControlsStudyGate>
    </Layout>
  );
}

function Deck({
  licence, gearbox, reset, allowed, setLocation,
  favoritesOnly, setFavoritesOnly, unseenOnly, setUnseenOnly,
  shuffled, setShuffled, reshuffleKey, setReshuffleKey,
  index, setIndex, flipped, setFlipped, direction, setDirection, touchStart, swiped,
}: any) {
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

  const deck = useMemo(() => {
    const favs = new Set(getFavoriteControlIds());
    const seen = new Set(getSeenControlIds());
    let pool = controls.filter((c: StudyControl) => {
      if (favoritesOnly && !favs.has(c.id)) return false;
      if (unseenOnly && seen.has(c.id)) return false;
      return true;
    });
    pool = [...pool].sort((a: any, b: any) => a.id - b.id);
    if (shuffled) pool = shuffle(pool);
    return pool;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controls, favoritesOnly, unseenOnly, shuffled, reshuffleKey]);

  const resetDeck = () => { setIndex(0); setFlipped(false); };
  const changeFilter = (fn: () => void) => { fn(); resetDeck(); };

  const current: StudyControl | null = deck.length > 0 ? deck[Math.min(index, deck.length - 1)] : null;
  const progress = deck.length > 0 ? ((Math.min(index, deck.length - 1) + 1) / deck.length) * 100 : 0;

  const advance = (delta: number) => {
    if (deck.length === 0) return;
    if (current) markControlSeen(current.id);
    setFlipped(false);
    setIndex((i: number) => (i + delta + deck.length) % deck.length);
  };

  const onTouchStart = (e: ReactTouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
    swiped.current = false;
  };
  const onTouchEnd = (e: ReactTouchEvent) => {
    const start = touchStart.current;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      swiped.current = true;
      advance(dx < 0 ? 1 : -1);
    } else if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 30) {
      swiped.current = true;
      setFlipped((f: boolean) => !f);
    }
    touchStart.current = null;
  };
  const onCardClick = () => {
    if (swiped.current) { swiped.current = false; return; }
    setFlipped((f: boolean) => !f);
  };

  // Card face depends on direction:
  // recognition (diagram → name): front shows component number & "which control is this?", back shows name + function.
  // recall (function → number/name): front shows function/notes, back shows number + name.
  const front = current
    ? direction === "recognition"
      ? (
        <div className="text-center space-y-2">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-bold">On the diagram:</p>
          <p className="text-5xl font-display font-extrabold">{current.component_number ?? "?"}</p>
          <p className="text-xs text-muted-foreground">Which control is this?</p>
        </div>
      )
      : (
        <p className="text-base leading-relaxed text-center">{current.function_notes || "Function not noted."}</p>
      )
    : null;

  const back = current
    ? direction === "recognition"
      ? (
        <div className="space-y-2 text-center">
          <p className="text-2xl font-display font-extrabold">{current.component_name}</p>
          {current.component_number != null && (
            <p className="text-xs font-mono text-muted-foreground">Control {current.component_number}</p>
          )}
          {current.function_notes && <p className="text-sm text-muted-foreground">{current.function_notes}</p>}
        </div>
      )
      : (
        <div className="space-y-2 text-center">
          <p className="text-2xl font-display font-extrabold">{current.component_name}</p>
          {current.component_number != null && <p className="text-xs font-mono text-muted-foreground">Control {current.component_number}</p>}
        </div>
      )
    : null;

  if (!allowed) return null;

  return (
    <div className="py-4 space-y-4">
      <div className="flex items-center justify-between px-1">
        <button onClick={() => setLocation("/study/controls")} className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Controls
        </button>
        <div className="flex items-center gap-2">
          <button onClick={reset} className="text-xs font-semibold text-primary">
            Code {licence}{gearbox ? ` · ${gearbox}` : ""} ▾
          </button>
          <span className="text-xs font-bold text-muted-foreground">
            {deck.length > 0 ? `${Math.min(index, deck.length - 1) + 1} / ${deck.length}` : "0 / 0"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 rounded-xl border border-border p-1 bg-muted/40">
        {([
          { k: "recognition", label: "Recognition" },
          { k: "recall", label: "Recall" },
        ] as const).map(({ k, label }) => (
          <button
            key={k}
            onClick={() => { setDirection(k); setFlipped(false); }}
            className={cn("h-9 rounded-lg text-xs font-bold", direction === k ? "bg-background shadow-sm text-foreground" : "text-muted-foreground")}
          >
            {label}
          </button>
        ))}
      </div>

      <Progress value={progress} className="h-1.5" />

      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-10">Loading deck…</p>
      ) : deck.length === 0 ? (
        <div className="rounded-2xl border border-border p-10 text-center space-y-2">
          <p className="font-bold">Deck is empty</p>
          <p className="text-sm text-muted-foreground">Adjust the filters.</p>
        </div>
      ) : (
        current && (
          <div className="select-none [perspective:1200px]" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} onClick={onCardClick}>
            <div className={cn("relative w-full min-h-[320px] transition-transform duration-300 [transform-style:preserve-3d]", flipped && "[transform:rotateX(180deg)]")}>
              <div className="absolute inset-0 rounded-3xl border border-border bg-card p-6 flex flex-col items-center justify-center gap-3 [backface-visibility:hidden]">
                {front}
                <p className="text-[11px] text-muted-foreground font-semibold">Tap or swipe up/down to flip · swipe left/right to move</p>
              </div>
              <div className="absolute inset-0 rounded-3xl border border-primary/30 bg-primary/5 p-6 flex flex-col items-center justify-center gap-2 [transform:rotateX(180deg)] [backface-visibility:hidden]">
                {back}
              </div>
            </div>
          </div>
        )
      )}

      {deck.length > 0 && flipped && current && (
        <div className="grid grid-cols-4 gap-2">
          {([
            { r: "again" as RecallRating, label: "Again", cls: "bg-red-500/10 text-red-600 border-red-200" },
            { r: "hard" as RecallRating, label: "Hard", cls: "bg-amber-500/10 text-amber-700 border-amber-200" },
            { r: "good" as RecallRating, label: "Good", cls: "bg-blue-500/10 text-blue-700 border-blue-200" },
            { r: "easy" as RecallRating, label: "Easy", cls: "bg-green-500/10 text-green-700 border-green-200" },
          ]).map(({ r, label, cls }) => (
            <button
              key={r}
              type="button"
              onClick={() => { rateControl(current.id, r); advance(1); }}
              className={cn("h-11 rounded-xl border text-xs font-bold", cls)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {deck.length > 0 && (
        <div className="flex items-center justify-between gap-2">
          <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl" onClick={() => advance(-1)} aria-label="Previous">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button variant="outline" className="h-11 rounded-xl font-bold" onClick={() => { setReshuffleKey((k: number) => k + 1); resetDeck(); }}>
            <RotateCcw className="h-4 w-4 mr-1" /> Redeal
          </Button>
          <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl" onClick={() => advance(1)} aria-label="Next">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      )}

      <div className="glass-card rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold flex items-center gap-1.5"><Shuffle className="h-3.5 w-3.5" /> Shuffle deck</Label>
          <Switch checked={shuffled} onCheckedChange={(v) => changeFilter(() => setShuffled(v))} />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold">Favorites only</Label>
          <Switch checked={favoritesOnly} onCheckedChange={(v) => changeFilter(() => setFavoritesOnly(v))} />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold">Unseen only</Label>
          <Switch checked={unseenOnly} onCheckedChange={(v) => changeFilter(() => setUnseenOnly(v))} />
        </div>
      </div>
    </div>
  );
}
