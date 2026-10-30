import { useMemo, useRef, useState, useEffect, type TouchEvent as ReactTouchEvent } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { StudySign } from "@shared/schema";
import { Layout } from "@/components/layout";
import { FlashcardsHint } from "@/components/flashcards-hint";
import { SignFaceImages, SignCodeChips, isGenericWhere } from "@/components/sign-images";
import { FormattedText } from "@/components/formatted-text";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getFavoriteSignIds, rateSign, getAllSignLearning, initSignSync } from "@/lib/sign-storage";
import { initQuestionSync } from "@/lib/question-results";
import { ensureLocalOwner } from "@/lib/progress-owner";
import { SHOW_TEMPORARY_SIGNS, isTemporaryOnlyRecord, visibleSigns } from "@/lib/sign-codes";
import { practiseDeckItems } from "@/lib/mastery-summary";
import { getPracticeIdsFromUrl, isFromResults } from "@/lib/practice-ids";
import { ArrowLeft, ChevronLeft, ChevronRight, ChevronDown, RotateCcw, Shuffle } from "lucide-react";
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
  const [newOnly, setNewOnly] = useState(false);
  const [shuffled, setShuffled] = useState(true);
  const [reshuffleKey, setReshuffleKey] = useState(0);
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState(0); // reveal step: 0 front, 1 meaning, 2 action
  const [fullOpen, setFullOpen] = useState(false);
  const [syncTick, setSyncTick] = useState(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);

  const { data: signs = [], isLoading } = useQuery<StudySign[]>({
    queryKey: ["/api/signs"],
    enabled: allowed,
  });

  useEffect(() => {
    if (allowed) {
      ensureLocalOwner();
      Promise.all([initSignSync(), initQuestionSync()]).then(() => setSyncTick((t) => t + 1));
    }
  }, [allowed]);

  const revision = useMemo(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    if (params.get("revision") !== "1") return null;
    return {
      heading: params.get("heading"),
      subheading: params.get("subheading"),
    };
  }, []);

  const practiseIds = useMemo(getPracticeIdsFromUrl, []);
  const fromResults = useMemo(isFromResults, []);

  const headings = useMemo(() => Array.from(new Set(signs.map((s) => s.heading))).sort(), [signs]);
  const subheadings = useMemo(
    () => Array.from(new Set(signs.filter((s) => heading === "all" || s.heading === heading).map((s) => s.subheading))).sort(),
    [signs, heading]
  );

  const deck = useMemo(() => {
    if (practiseIds) {
      const byId = new Map(signs.map((sign) => [sign.id, sign]));
      return practiseIds
        .map((id) => byId.get(id))
        .filter((sign): sign is StudySign =>
          !!sign && (SHOW_TEMPORARY_SIGNS || !isTemporaryOnlyRecord(sign.codes))
        );
    }
    if (revision) {
      // Practise mode: missed cards first, then this group's untried cards.
      return practiseDeckItems(visibleSigns(signs), getAllSignLearning(), {
        heading: revision.heading,
        subheading: revision.subheading,
      });
    }
    const favs = new Set(getFavoriteSignIds());
    const learning = getAllSignLearning();
    let pool = signs.filter((s) => {
      if (!SHOW_TEMPORARY_SIGNS && isTemporaryOnlyRecord(s.codes)) return false;
      if (heading !== "all" && s.heading !== heading) return false;
      if (subheading !== "all" && s.subheading !== subheading) return false;
      if (favoritesOnly && !favs.has(s.id)) return false;
      if (newOnly && (learning[s.id]?.status ?? "new") !== "new") return false;
      return true;
    });
    // stable base order, then optional shuffle (reshuffleKey re-deals)
    pool = [...pool].sort((a, b) => a.id - b.id);
    if (shuffled) pool = shuffle(pool);
    return pool;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signs, heading, subheading, favoritesOnly, newOnly, shuffled, reshuffleKey, revision, practiseIds, syncTick]);

  const resetDeck = () => {
    setIndex(0);
    setStep(0);
    setFullOpen(false);
  };

  const changeFilter = (fn: () => void) => {
    fn();
    resetDeck();
  };

  const current = deck.length > 0 ? deck[Math.min(index, deck.length - 1)] : null;
  const progress = deck.length > 0 ? ((Math.min(index, deck.length - 1) + 1) / deck.length) * 100 : 0;

  const shortText = !!current && current.short_reviewed === true && !!current.short_meaning;
  const lastStep = shortText ? (current!.short_action ? 2 : 1) : 1;
  const flipped = step >= 1;

  // Every new card starts at the front with full manual text collapsed.
  useEffect(() => {
    setStep(0);
    setFullOpen(false);
  }, [current?.id]);

  const advance = (delta: number) => {
    if (deck.length === 0) return;
    setStep(0);
    setFullOpen(false);
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
      setStep((s) => Math.max(0, Math.min(lastStep, dy < 0 ? s + 1 : s - 1)));
    }
    touchStart.current = null;
  };

  const onCardClick = () => {
    if (swiped.current) {
      swiped.current = false;
      return;
    }
    // Tap walks forward a step at a time, then flips back to the sign.
    setStep((s) => (s >= lastStep ? 0 : s + 1));
  };

  if (!allowed) return null;

  return (
    <Layout>
      <div className="py-4 space-y-4">
        <div className="flex items-center justify-between px-1">
          <button onClick={() => setLocation(fromResults ? "/results" : "/study/signs")} className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> {fromResults ? "Results" : "Signs"}
          </button>
          <span className="text-xs font-bold text-muted-foreground">
            {deck.length > 0 ? `${Math.min(index, deck.length - 1) + 1} / ${deck.length}` : "0 / 0"}
          </span>
        </div>

        <FlashcardsHint />

        <Progress value={progress} className="h-1.5" />

        {!revision && !practiseIds && (
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
        )}

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
                {(favoritesOnly || newOnly) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => changeFilter(() => { setFavoritesOnly(false); setNewOnly(false); })}
                  >
                    Clear toggles
                  </Button>
                )}
              </>
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
                  "relative grid w-full min-h-[380px] transition-transform duration-300 [transform-style:preserve-3d]",
                  flipped && "[transform:rotateX(180deg)]"
                )}
              >
                {/* Front */}
                <div className="[grid-area:1/1] rounded-3xl border border-border bg-card p-5 flex flex-col items-center justify-center gap-3 [backface-visibility:hidden]">
                  {(current.images || []).length > 0 ? (
                    <SignFaceImages images={current.images} />
                  ) : (
                    <div className="text-center space-y-1">
                      {(current.codes || []).map((c) => (
                        <p key={c} className="text-3xl font-mono font-extrabold">{c}</p>
                      ))}
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground font-semibold">Tap to reveal · swipe left/right to move</p>
                </div>
                {/* Back: step 1 shows the meaning, step 2 adds the action */}
                <div className="[grid-area:1/1] rounded-3xl border border-primary/30 bg-primary/5 p-5 space-y-3 [transform:rotateX(180deg)] [backface-visibility:hidden]">
                  <p className="font-display font-extrabold text-lg">{current.name}</p>
                  <SignCodeChips codes={current.codes} />
                  {shortText ? (
                    <>
                      <p className="text-sm">{current.short_meaning}</p>
                      {step >= 2 && current.short_action && (
                        <div className="rounded-xl bg-primary/10 border border-primary/30 p-3">
                          <p className="text-[11px] font-black uppercase tracking-widest text-primary">What you must do</p>
                          <FormattedText text={current.short_action} className="text-sm mt-1" />
                        </div>
                      )}
                      {step >= 2 && !isGenericWhere(current.where_text) && (
                        <p className="text-[11px] text-muted-foreground font-semibold">{current.where_text}</p>
                      )}
                      {step >= lastStep && (current.where_text || current.purpose_text || current.action_text) && (
                        <div className="rounded-xl border border-border bg-background/60">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setFullOpen((f) => !f); }}
                            className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-muted-foreground"
                          >
                            Full manual text
                            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", fullOpen && "rotate-180")} />
                          </button>
                          {fullOpen && (
                            <div className="px-3 pb-3 space-y-2" onClick={(e) => e.stopPropagation()}>
                              {[
                                { label: "Where", text: current.where_text },
                                { label: "Purpose", text: current.purpose_text },
                                { label: "Action", text: current.action_text },
                              ].filter((x) => x.text).map((x) => (
                                <div key={x.label}>
                                  <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">{x.label}</p>
                                  <FormattedText text={x.text} className="text-sm mt-0.5" />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    [
                      { label: "Where", text: current.where_text },
                      { label: "Purpose", text: current.purpose_text },
                      { label: "Action", text: current.action_text },
                    ].filter((x) => x.text).map((x) => (
                      <div key={x.label}>
                        <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">{x.label}</p>
                        <FormattedText text={x.text} className="text-sm mt-0.5" />
                      </div>
                    ))
                  )}
                  <p className="text-[11px] text-muted-foreground font-semibold">
                    {step < lastStep ? "Tap or swipe up for more · swipe down to go back" : "Tap to see the sign again · swipe left/right to move"}
                  </p>
                </div>
              </div>
            </div>
          )
        )}

        {deck.length > 0 && current && step >= lastStep && (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                rateSign(current.id, "again");
                advance(1);
              }}
              className="h-11 rounded-xl border text-xs font-bold bg-red-500/10 text-red-600 border-red-200"
            >
              Not yet
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                rateSign(current.id, "good");
                advance(1);
              }}
              className="h-11 rounded-xl border text-xs font-bold bg-green-500/10 text-green-700 border-green-200"
            >
              Got it
            </button>
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

        {fromResults && (
          <Button variant="outline" className="w-full h-11 rounded-xl font-bold" onClick={() => setLocation("/results")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to results
          </Button>
        )}

        <div className="glass-card rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="fc-shuffle" className="text-xs font-semibold flex items-center gap-1.5">
              <Shuffle className="h-3.5 w-3.5" /> Shuffle deck
            </Label>
            <Switch id="fc-shuffle" checked={shuffled} onCheckedChange={(v) => changeFilter(() => setShuffled(v))} />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="fc-fav" className="text-xs font-semibold">Saved only</Label>
            <Switch id="fc-fav" checked={favoritesOnly} onCheckedChange={(v) => changeFilter(() => setFavoritesOnly(v))} />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="fc-new" className="text-xs font-semibold">New cards only</Label>
            <Switch id="fc-new" checked={newOnly} onCheckedChange={(v) => changeFilter(() => setNewOnly(v))} />
          </div>
        </div>
      </div>
    </Layout>
  );
}
