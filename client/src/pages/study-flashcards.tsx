import { useMemo, useRef, useState, type TouchEvent as ReactTouchEvent } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { StudySign } from "@shared/schema";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getFavoriteSignIds, getSeenSignIds, markSignSeen, rateSign, getAllSignLearning, type RecallRating } from "@/lib/sign-storage";
import { summarizeSigns } from "@/lib/mastery-summary";
import { ArrowLeft, ChevronLeft, ChevronRight, RotateCcw, Shuffle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStudyGate } from "./study";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function StudySignsFlashcards() {
  const [, setLocation] = useLocation();
  const allowed = useStudyGate();
  const [heading, setHeading] = useState("all");
  const [subheading, setSubheading] = useState("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [unseenOnly, setUnseenOnly] = useState(false);
  const [shuffled, setShuffled] = useState(true);
  const [reshuffleKey, setReshuffleKey] = useState(0);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);

  const { data: signs = [], isLoading } = useQuery<StudySign[]>({
    queryKey: ["/api/signs"],
    enabled: allowed,
  });

  const headings = useMemo(() => Array.from(new Set(signs.map((s) => s.heading))).sort(), [signs]);
  const subheadings = useMemo(
    () => Array.from(new Set(signs.filter((s) => heading === "all" || s.heading === heading).map((s) => s.subheading))).sort(),
    [signs, heading]
  );

  const deck = useMemo(() => {
    // Revision mode (?revision=1): items that are still shaky, weakest groups first
    const revisionMode = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("revision") === "1";
    if (revisionMode) {
      const learning = getAllSignLearning();
      const groupPct = new Map<string, number>();
      for (const s of summarizeSigns(signs)) {
        groupPct.set(`${s.heading}|||${s.subheading}`, s.pct);
      }
      return signs
        .filter((s) => {
          const rec = learning[s.id];
          const status = rec?.status ?? "new";
          return status === "learning" || status === "new";
        })
        .sort((a, b) => {
          const pa = groupPct.get(`${a.heading}|||${a.subheading}`) ?? 100;
          const pb = groupPct.get(`${b.heading}|||${b.subheading}`) ?? 100;
          return pa - pb;
        });
    }
    const favs = new Set(getFavoriteSignIds());
    const seen = new Set(getSeenSignIds());
    let pool = signs.filter((s) => {
      if (heading !== "all" && s.heading !== heading) return false;
      if (subheading !== "all" && s.subheading !== subheading) return false;
      if (favoritesOnly && !favs.has(s.id)) return false;
      if (unseenOnly && seen.has(s.id)) return false;
      return true;
    });
    // stable base order, then optional shuffle (reshuffleKey re-deals)
    pool = [...pool].sort((a, b) => a.id - b.id);
    if (shuffled) pool = shuffle(pool);
    return pool;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signs, heading, subheading, favoritesOnly, unseenOnly, shuffled, reshuffleKey]);

  const resetDeck = () => {
    setIndex(0);
    setFlipped(false);
  };

  const changeFilter = (fn: () => void) => {
    fn();
    resetDeck();
  };

  const current = deck.length > 0 ? deck[Math.min(index, deck.length - 1)] : null;
  const progress = deck.length > 0 ? ((Math.min(index, deck.length - 1) + 1) / deck.length) * 100 : 0;

  const advance = (delta: number) => {
    if (deck.length === 0) return;
    if (current) markSignSeen(current.id);
    setFlipped(false);
    setIndex((i) => (i + delta + deck.length) % deck.length);
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
      setFlipped((f) => !f);
    }
    touchStart.current = null;
  };

  const onCardClick = () => {
    if (swiped.current) {
      swiped.current = false;
      return;
    }
    setFlipped((f) => !f);
  };

  if (!allowed) return null;

  return (
    <Layout>
      <div className="py-4 space-y-4">
        <div className="flex items-center justify-between px-1">
          <button onClick={() => setLocation("/study/signs")} className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Signs
          </button>
          <span className="text-xs font-bold text-muted-foreground">
            {deck.length > 0 ? `${Math.min(index, deck.length - 1) + 1} / ${deck.length}` : "0 / 0"}
          </span>
        </div>

        <Progress value={progress} className="h-1.5" />

        <div className="grid grid-cols-2 gap-2">
          <Select value={heading} onValueChange={(v) => changeFilter(() => { setHeading(v); setSubheading("all"); })}>
            <SelectTrigger className="h-10 bg-background/60 rounded-xl text-xs font-semibold">
              <SelectValue placeholder="Heading" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All headings</SelectItem>
              {headings.map((h) => (
                <SelectItem key={h} value={h}>{h}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={subheading} onValueChange={(v) => changeFilter(() => setSubheading(v))}>
            <SelectTrigger className="h-10 bg-background/60 rounded-xl text-xs font-semibold">
              <SelectValue placeholder="Subheading" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All subheadings</SelectItem>
              {subheadings.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-10">Loading deck…</p>
        ) : deck.length === 0 ? (
          <div className="rounded-2xl border border-border p-10 text-center space-y-2">
            <p className="font-bold">Deck is empty</p>
            <p className="text-sm text-muted-foreground">Widen the filters or turn off favorites / unseen-only.</p>
            {(favoritesOnly || unseenOnly) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => changeFilter(() => { setFavoritesOnly(false); setUnseenOnly(false); })}
              >
                Clear toggles
              </Button>
            )}
          </div>
        ) : (
          current && (
            <div
              className="select-none [perspective:1200px]"
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
              onClick={onCardClick}
            >
              <div
                className={cn(
                  "relative w-full min-h-[380px] transition-transform duration-300 [transform-style:preserve-3d]",
                  flipped && "[transform:rotateX(180deg)]"
                )}
              >
                {/* Front */}
                <div className="absolute inset-0 rounded-3xl border border-border bg-card p-5 flex flex-col items-center justify-center gap-3 [backface-visibility:hidden]">
                  {(current.images || [])[0]?.image_url ? (
                    <img
                      src={current.images![0].image_url}
                      alt={current.name}
                      className="max-h-64 w-full object-contain bg-white rounded-2xl"
                      draggable={false}
                    />
                  ) : (
                    <div className="text-center space-y-1">
                      {(current.codes || []).map((c) => (
                        <p key={c} className="text-3xl font-mono font-extrabold">{c}</p>
                      ))}
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground font-semibold">Tap or swipe up/down to flip · swipe left/right to move</p>
                </div>
                {/* Back */}
                <div className="rounded-3xl border border-primary/30 bg-primary/5 p-5 space-y-3 min-h-[380px] [transform:rotateX(180deg)] [backface-visibility:hidden]">
                  <p className="font-display font-extrabold text-lg">{current.name}</p>
                  <div className="flex flex-wrap gap-1">
                    {(current.codes || []).map((c) => (
                      <span key={c} className="text-[11px] font-mono bg-background border border-border rounded-md px-2 py-0.5">{c}</span>
                    ))}
                  </div>
                  {[
                    { label: "Where", text: current.where_text },
                    { label: "Purpose", text: current.purpose_text },
                    { label: "Action", text: current.action_text },
                  ].filter((x) => x.text).map((x) => (
                    <div key={x.label}>
                      <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">{x.label}</p>
                      <p className="text-sm mt-0.5">{x.text}</p>
                    </div>
                  ))}
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
                onClick={(e) => {
                  e.stopPropagation();
                  rateSign(current.id, r);
                  advance(1);
                }}
                className={cn("h-11 rounded-xl border text-xs font-bold", cls)}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {deck.length > 0 && (
          <div className="flex items-center justify-between gap-2">
            <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl" onClick={() => advance(-1)} aria-label="Previous card">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              variant="outline"
              className="h-11 rounded-xl font-bold"
              onClick={() => { setReshuffleKey((k) => k + 1); resetDeck(); }}
            >
              <RotateCcw className="h-4 w-4 mr-1" /> Redeal
            </Button>
            <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl" onClick={() => advance(1)} aria-label="Next card">
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        )}

        <div className="glass-card rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="fc-shuffle" className="text-xs font-semibold flex items-center gap-1.5">
              <Shuffle className="h-3.5 w-3.5" /> Shuffle deck
            </Label>
            <Switch id="fc-shuffle" checked={shuffled} onCheckedChange={(v) => changeFilter(() => setShuffled(v))} />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="fc-fav" className="text-xs font-semibold">Favorites only</Label>
            <Switch id="fc-fav" checked={favoritesOnly} onCheckedChange={(v) => changeFilter(() => setFavoritesOnly(v))} />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="fc-unseen" className="text-xs font-semibold">Unseen only</Label>
            <Switch id="fc-unseen" checked={unseenOnly} onCheckedChange={(v) => changeFilter(() => setUnseenOnly(v))} />
          </div>
        </div>
      </div>
    </Layout>
  );
}
