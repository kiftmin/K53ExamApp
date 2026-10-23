import { useMemo, useRef, useState, useEffect, type TouchEvent as ReactTouchEvent } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { StudyRule } from "@shared/schema";
import { Layout } from "@/components/layout";
import { FlashcardsHint } from "@/components/flashcards-hint";
import { FormattedText } from "@/components/formatted-text";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { getFavoriteRuleIds, rateRule, getAllRuleLearning, initRuleSync } from "@/lib/rule-storage";
import { practiseDeckItems } from "@/lib/mastery-summary";
import { ensureLocalOwner } from "@/lib/progress-owner";
import { ArrowLeft, ChevronLeft, ChevronRight, RotateCcw, Shuffle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStudyGate } from "./study";
import RulesCodeGate from "@/components/rules-code-gate";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function StudyRulesFlashcards() {
  const [, setLocation] = useLocation();
  const allowed = useStudyGate();
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [newOnly, setNewOnly] = useState(false);
  const [shuffled, setShuffled] = useState(true);
  const [reshuffleKey, setReshuffleKey] = useState(0);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [syncTick, setSyncTick] = useState(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);

  useEffect(() => {
    if (allowed) {
      ensureLocalOwner();
      initRuleSync().then(() => setSyncTick((t) => t + 1));
    }
  }, [allowed]);

  return (
    <Layout>
      <RulesCodeGate>
        {(code, reset) => (
          <Deck
            code={code}
            reset={reset}
            allowed={allowed}
            setLocation={setLocation}
            favoritesOnly={favoritesOnly}
            setFavoritesOnly={setFavoritesOnly}
            newOnly={newOnly}
            setNewOnly={setNewOnly}
            shuffled={shuffled}
            setShuffled={setShuffled}
            reshuffleKey={reshuffleKey}
            setReshuffleKey={setReshuffleKey}
            index={index}
            setIndex={setIndex}
            flipped={flipped}
            setFlipped={setFlipped}
            touchStart={touchStart}
            swiped={swiped}
            syncTick={syncTick}
          />
        )}
      </RulesCodeGate>
    </Layout>
  );
}

function Deck({
  code, reset, allowed, setLocation,
  favoritesOnly, setFavoritesOnly, newOnly, setNewOnly,
  shuffled, setShuffled, reshuffleKey, setReshuffleKey,
  index, setIndex, flipped, setFlipped, touchStart, swiped,
  syncTick,
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

  const revision = useMemo(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    if (params.get("revision") !== "1") return null;
    return {
      heading: params.get("heading"),
      subheading: params.get("subheading"),
    };
  }, []);

  const deck = useMemo(() => {
    if (revision) {
      // Practise mode: missed cards first, then this group's untried cards.
      return practiseDeckItems(rules, getAllRuleLearning(), {
        heading: revision.heading,
        subheading: revision.subheading,
      });
    }
    const favs = new Set(getFavoriteRuleIds());
    const learning = getAllRuleLearning();
    let pool = rules.filter((r: StudyRule) => {
      if (favoritesOnly && !favs.has(r.id)) return false;
      if (newOnly && (learning[r.id]?.status ?? "new") !== "new") return false;
      return true;
    });
    pool = [...pool].sort((a: StudyRule, b: StudyRule) => a.id - b.id);
    if (shuffled) pool = shuffle(pool);
    return pool;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rules, favoritesOnly, newOnly, shuffled, reshuffleKey, revision, syncTick]);

  const resetDeck = () => { setIndex(0); setFlipped(false); };
  const changeFilter = (fn: () => void) => { fn(); resetDeck(); };

  const current: StudyRule | null = deck.length > 0 ? deck[Math.min(index, deck.length - 1)] : null;
  const progress = deck.length > 0 ? ((Math.min(index, deck.length - 1) + 1) / deck.length) * 100 : 0;

  const advance = (delta: number) => {
    if (deck.length === 0) return;
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

  if (!allowed) return null;

  return (
    <div className="py-4 space-y-4">
      <div className="flex items-center justify-between px-1">
        <button onClick={() => setLocation("/study/rules")} className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Rules
        </button>
        <div className="flex items-center gap-2">
          <button onClick={reset} className="text-xs font-semibold text-primary">Code {code} ▾</button>
          <span className="text-xs font-bold text-muted-foreground">
            {deck.length > 0 ? `${Math.min(index, deck.length - 1) + 1} / ${deck.length}` : "0 / 0"}
          </span>
        </div>
      </div>

      <FlashcardsHint />

      <Progress value={progress} className="h-1.5" />

      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-10">Loading deck…</p>
      ) : deck.length === 0 ? (
        <div className="rounded-2xl border border-border p-10 text-center space-y-2">
          {revision ? (
            <>
              <p className="font-bold">All caught up. Nothing to practise here.</p>
              <Button variant="outline" size="sm" onClick={() => setLocation("/")}>
                Back to Home
              </Button>
            </>
          ) : (
            <>
              <p className="font-bold">Deck is empty</p>
              <p className="text-sm text-muted-foreground">Adjust the filters.</p>
            </>
          )}
        </div>
      ) : (
        current && (
          <div className="select-none [perspective:1200px]" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} onClick={onCardClick}>
            <div className={cn("relative w-full min-h-[320px] transition-transform duration-300 [transform-style:preserve-3d]", flipped && "[transform:rotateX(180deg)]")}>
              <div className="absolute inset-0 rounded-3xl border border-border bg-card p-6 flex flex-col items-center justify-center gap-4 [backface-visibility:hidden]">
                <p className="text-[11px] font-mono font-bold text-muted-foreground">{current.section_ref}</p>
                <p className="font-display text-xl font-bold leading-snug text-center">
                  {current.question || current.body}
                </p>
                <p className="text-xs text-muted-foreground text-center">{current.heading} › {current.subheading}</p>
                <p className="text-[11px] text-muted-foreground font-semibold text-center">Tap or swipe up/down to reveal the answer · swipe left/right to move</p>
              </div>
              <div className="absolute inset-0 rounded-3xl border border-primary/30 bg-primary/5 p-6 flex flex-col items-start gap-3 overflow-y-auto [transform:rotateX(180deg)] [backface-visibility:hidden]">
                <p className="text-[11px] font-mono font-bold text-muted-foreground">{current.section_ref}</p>
                <FormattedText text={current.body} className="text-base leading-relaxed text-left" />
                <p className="mt-auto w-full text-[11px] text-muted-foreground font-semibold text-center">Tap or swipe up/down to flip back</p>
              </div>
            </div>
          </div>
        )
      )}

      {deck.length > 0 && flipped && current && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => { rateRule(current.id, "again"); advance(1); }}
            className="h-11 rounded-xl border text-xs font-bold bg-red-500/10 text-red-600 border-red-200"
          >
            Not yet
          </button>
          <button
            type="button"
            onClick={() => { rateRule(current.id, "good"); advance(1); }}
            className="h-11 rounded-xl border text-xs font-bold bg-green-500/10 text-green-700 border-green-200"
          >
            Got it
          </button>
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
          <Label className="text-xs font-semibold">Saved only</Label>
          <Switch checked={favoritesOnly} onCheckedChange={(v) => changeFilter(() => setFavoritesOnly(v))} />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold">New cards only</Label>
          <Switch checked={newOnly} onCheckedChange={(v) => changeFilter(() => setNewOnly(v))} />
        </div>
      </div>
    </div>
  );
}
