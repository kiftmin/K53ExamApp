import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { Question, StudySign } from "@shared/schema";
import { Layout } from "@/components/layout";
import { FormattedText } from "@/components/formatted-text";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useQuiz } from "@/lib/quiz-context";
import { ChipCollapsible } from "@/components/chip-collapsible";
import { getFavoriteSignIds, toggleFavoriteSign, setSignKnown, resetSignProgress, removeFavoriteSigns, getAllSignLearning, initSignSync } from "@/lib/sign-storage";
import { isKnown, countKnown } from "@/lib/learning-status";
import { ensureLocalOwner } from "@/lib/progress-owner";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, BadgeCheck, ChevronDown, CheckCircle2, Heart, ImageOff, Layers, Search, HeartOff, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStudyGate } from "./study";

function resetSectionConfirm(ids: number[], label: string): boolean {
  return typeof window === "undefined" || window.confirm(`Reset this section (${label})? This clears your progress for these ${ids.length} cards.`);
}

function SubheadingSignGroup({
  subheading, list, favorites, learningMap, forceOpen, onOpen, onToggleFav, onToggleKnown, onResetSection, onClearSaved,
}: any) {
  const [open, setOpen] = useState(false);
  const isOpen = forceOpen || open;
  const allKnown = list.length > 0 && list.every((s: StudySign) => isKnown(learningMap[s.id]?.status));
  const hasFavs = list.some((s: StudySign) => favorites.includes(s.id));
  const hasProgress = list.some((s: StudySign) => learningMap[s.id]);
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
              onClick={(e) => { e.stopPropagation(); onClearSaved(list.map((s: StudySign) => s.id)); }}
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
              onClick={(e) => { e.stopPropagation(); onResetSection(list.map((s: StudySign) => s.id), subheading); }}
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
          {list.map((s: StudySign) => {
            const thumb = s.images?.[0]?.image_url;
            const fav = favorites.includes(s.id);
            const known = isKnown(learningMap[s.id]?.status);
            return (
              <button
                key={s.id}
                onClick={() => onOpen(s.id)}
                className="w-full flex items-center gap-3 p-2.5 rounded-2xl border border-border bg-card text-left hover-elevate"
              >
                <div className="h-14 w-14 rounded-xl bg-white border border-border flex items-center justify-center overflow-hidden shrink-0">
                  {thumb ? (
                    <img src={thumb} alt={s.name} className="h-full w-full object-contain" loading="lazy" />
                  ) : (
                    <ImageOff className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-bold leading-snug flex items-center gap-1", known && "text-muted-foreground line-through")}>
                    <span className="truncate">{s.name}</span>
                    {s.is_verified_exam_question && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-green-600" />}
                    {fav && <Heart className="h-3.5 w-3.5 shrink-0 text-red-500 fill-red-500" />}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(s.codes || []).map((c) => (
                      <Badge key={c} variant="outline" className="text-[10px] font-mono">{c}</Badge>
                    ))}
                  </div>
                </div>
                <span onClick={(e) => { e.stopPropagation(); onToggleFav(s.id); }} aria-label="Save" className="p-1">
                  <Heart className={cn("h-4 w-4", fav ? "fill-red-500 text-red-500" : "text-muted-foreground")} />
                </span>
                <span onClick={(e) => { e.stopPropagation(); onToggleKnown(s.id); }} aria-label="I know this" className="p-1">
                  <CheckCircle2 className={cn("h-4 w-4", known ? "fill-green-600 text-green-600" : "text-muted-foreground")} />
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function StudySignsBrowse() {
  const [, setLocation] = useLocation();
  const allowed = useStudyGate();
  const { startQuiz } = useQuiz();
  const { toast } = useToast();
  const [heading, setHeading] = useState("all");
  const [subheading, setSubheading] = useState("all");
  const [search, setSearch] = useState("");
  const [savedOnly, setSavedOnly] = useState(false);
  const [learnedFilter, setLearnedFilter] = useState<"all" | "learned" | "not">("all");
  const [openId, setOpenId] = useState<number | null>(null);
  const [favorites, setFavorites] = useState<number[]>(() => getFavoriteSignIds());
  const [progressTick, setProgressTick] = useState(0);

  const { data: signs = [], isLoading } = useQuery<StudySign[]>({
    queryKey: ["/api/signs"],
    enabled: allowed,
  });

  useEffect(() => {
    if (allowed) {
      ensureLocalOwner();
      initSignSync().then(() => setProgressTick((t) => t + 1));
    }
  }, [allowed]);

  const learningMap = useMemo(() => getAllSignLearning(), [progressTick]);

  const { data: linkedQuestions = [] } = useQuery<Question[]>({
    queryKey: [`/api/signs/${openId}/questions`],
    enabled: allowed && openId !== null,
  });

  const openSign = openId !== null ? signs.find((s) => s.id === openId) || null : null;

  const headings = useMemo(() => Array.from(new Set(signs.map((s) => s.heading))).sort(), [signs]);
  // Subheading chips only make sense once a specific heading is chosen;
  // under "All" the subheadings of every heading would just clutter the bar.
  const subheadings = useMemo(
    () =>
      heading === "all"
        ? []
        : Array.from(new Set(signs.filter((s) => s.heading === heading).map((s) => s.subheading))).sort(),
    [signs, heading]
  );

  // Saved/learned chip counts respect every filter except the learned one itself.
  const progressCounts = useMemo(() => {
    const q = search.trim().toLowerCase();
    let learned = 0;
    let notLearned = 0;
    for (const s of signs) {
      if (heading !== "all" && s.heading !== heading) continue;
      if (subheading !== "all" && s.subheading !== subheading) continue;
      if (savedOnly && !favorites.includes(s.id)) continue;
      if (q && !(s.name.toLowerCase().includes(q) || (s.codes || []).some((c) => c.toLowerCase().includes(q)))) continue;
      if (isKnown(learningMap[s.id]?.status)) learned++;
      else notLearned++;
    }
    return { learned, notLearned };
  }, [signs, heading, subheading, search, savedOnly, favorites, learningMap]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return signs.filter((s) => {
      if (heading !== "all" && s.heading !== heading) return false;
      if (subheading !== "all" && s.subheading !== subheading) return false;
      if (savedOnly && !favorites.includes(s.id)) return false;
      if (learnedFilter === "learned" && !isKnown(learningMap[s.id]?.status)) return false;
      if (learnedFilter === "not" && isKnown(learningMap[s.id]?.status)) return false;
      if (q && !(s.name.toLowerCase().includes(q) || (s.codes || []).some((c) => c.toLowerCase().includes(q)))) return false;
      return true;
    });
  }, [signs, heading, subheading, search, savedOnly, favorites, learnedFilter, learningMap]);

  const grouped = useMemo(() => {
    const map = new Map<string, Map<string, StudySign[]>>();
    for (const s of filtered) {
      const heading = s.heading || "Other";
      const sub = s.subheading || "(general)";
      if (!map.has(heading)) map.set(heading, new Map());
      const inner = map.get(heading)!;
      if (!inner.has(sub)) inner.set(sub, []);
      inner.get(sub)!.push(s);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([heading, inner]) => [
        heading,
        Array.from(inner.entries()).sort(([a], [b]) => a.localeCompare(b)),
      ] as [string, [string, StudySign[]][]]);
  }, [filtered]);

  const toggleFav = (id: number) => {
    toggleFavoriteSign(id);
    setFavorites(getFavoriteSignIds());
  };

  const toggleKnown = (id: number) => {
    setSignKnown(id, !isKnown(learningMap[id]?.status));
    setProgressTick((t) => t + 1);
  };

  const resetSection = (ids: number[], label: string) => {
    if (!resetSectionConfirm(ids, label)) return;
    resetSignProgress(ids);
    setProgressTick((t) => t + 1);
  };

  const clearSaved = (ids: number[]) => {
    removeFavoriteSigns(ids);
    setFavorites(getFavoriteSignIds());
  };

  const practiceInQuiz = () => {
    if (linkedQuestions.length === 0) return;
    startQuiz(
      {
        name: localStorage.getItem("k53_name") || "Study",
        surname: localStorage.getItem("k53_surname") || "Student",
        licenseCode: localStorage.getItem("k53_license_code") || "02",
        category: 2,
        testType: "category",
        source: "all",
        onlyOfficial: false,
        activeSourceIds: [],
      },
      linkedQuestions
    );
    toast({ title: "Quiz started", description: `${linkedQuestions.length} linked question(s) for this sign.` });
    setLocation("/quiz");
  };

  useEffect(() => {
    setSubheading("all");
  }, [heading]);

  if (!allowed) return null;

  return (
    <Layout>
      <div className="py-4 space-y-4">
        <div className="flex items-center justify-between px-1">
          <button onClick={() => setLocation("/study")} className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Study
          </button>
          <Button size="sm" onClick={() => setLocation("/study/signs/flashcards")} className="brand-gradient border-none font-bold rounded-xl">
            <Layers className="h-3.5 w-3.5 mr-1" /> Flashcards
          </Button>
        </div>

        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur py-2 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search name or code…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-11 bg-background/60 rounded-xl"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setSavedOnly(!savedOnly)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border flex items-center gap-1",
                savedOnly ? "bg-red-500/10 border-red-300 text-red-600" : "border-border text-muted-foreground"
              )}
            >
              <Heart className={cn("h-3 w-3", savedOnly && "fill-red-500")} />{" "}Saved{favorites.length > 0 ? ` (${favorites.length})` : ""}
            </button>
            {["all", ...headings].map((h) => (
              <button
                key={h}
                onClick={() => setHeading(h)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border",
                  heading === h ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"
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
          {subheadings.length > 1 && (
            <ChipCollapsible key={heading} recheckKey={`${heading}|${subheadings.length}`}>
              {["all", ...subheadings].map((s) => (
                <button
                  key={s}
                  onClick={() => setSubheading(s)}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap",
                    subheading === s ? "bg-accent text-foreground" : "text-muted-foreground"
                  )}
                >
                  {s === "all" ? "All" : s}
                </button>
              ))}
            </ChipCollapsible>
          )}
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-10">Loading signs…</p>
        ) : grouped.length === 0 ? (
          <div className="text-center py-10 space-y-2">
            <p className="text-sm text-muted-foreground">No signs match.</p>
            {(savedOnly || learnedFilter !== "all") && (
              <div className="flex justify-center gap-2">
                {savedOnly && (
                  <Button variant="outline" size="sm" onClick={() => setSavedOnly(false)}>
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
          grouped.map(([h, subs]) => {
            const sectionIds = subs.flatMap(([, list]) => list.map((s: StudySign) => s.id));
            const stats = countKnown(subs.flatMap(([, list]) => list as StudySign[]), learningMap);
            const savedCount = sectionIds.filter((id: number) => favorites.includes(id)).length;
            const allKnown = stats.total > 0 && stats.known === stats.total;
            const sectionHasFavs = sectionIds.some((id: number) => favorites.includes(id));
            const sectionHasProgress = sectionIds.some((id: number) => learningMap[id]);
            return (
            <div key={h} className="space-y-2">
              <p className="text-[11px] font-black uppercase tracking-widest text-primary px-1 flex items-center gap-1.5">
                {allKnown && <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
                {h}
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
                    onClick={() => resetSection(sectionIds, h)}
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
              {subs.map(([sub, list]) => (
                <SubheadingSignGroup
                  key={sub}
                  subheading={sub}
                  list={list}
                  favorites={favorites}
                  learningMap={learningMap}
                  forceOpen={search.trim().length > 0}
                  onOpen={(id: number) => setOpenId(id)}
                  onToggleFav={toggleFav}
                  onToggleKnown={toggleKnown}
                  onResetSection={resetSection}
                  onClearSaved={clearSaved}
                />
              ))}
            </div>
            );
          })
        )}

        <Sheet open={openId !== null} onOpenChange={(o) => !o && setOpenId(null)}>
          <SheetContent side="bottom" className="max-h-[88vh] overflow-y-auto rounded-t-3xl">
            {openSign && (
              <div className="space-y-4 pb-6">
                <SheetHeader>
                  <SheetTitle className="text-left">{openSign.name}</SheetTitle>
                </SheetHeader>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary">{openSign.heading}</Badge>
                  <Badge variant="outline">{openSign.subheading}</Badge>
                  {(openSign.codes || []).map((c) => (
                    <Badge key={c} variant="outline" className="font-mono">{c}</Badge>
                  ))}
                  {openSign.is_verified_exam_question && (
                    <Badge className="bg-green-600"><BadgeCheck className="h-3 w-3 mr-1" /> Exam question</Badge>
                  )}
                </div>
                {(openSign.images || []).length > 0 ? (
                  <div className="space-y-2">
                    {openSign.images!.map((img) => (
                      <div key={img.code} className="rounded-2xl overflow-hidden border border-border bg-white">
                        <img src={img.image_url} alt={`${openSign.name} (${img.code})`} className="w-full max-h-64 object-contain" />
                        <p className="text-[11px] font-mono text-muted-foreground text-center py-1">{img.code}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                    No image yet for this sign.
                  </div>
                )}
                {[
                  { label: "Where", text: openSign.where_text },
                  { label: "Purpose", text: openSign.purpose_text },
                  { label: "Action", text: openSign.action_text },
                ].filter((x) => x.text).map((x) => (
                  <div key={x.label}>
                    <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">{x.label}</p>
                    <FormattedText text={x.text} className="text-sm mt-0.5" />
                  </div>
                ))}
                <div className="flex gap-2">
                  <Button
                    variant={favorites.includes(openSign.id) ? "default" : "outline"}
                    onClick={() => toggleFav(openSign.id)}
                    className="flex-1 h-11 rounded-xl font-bold"
                  >
                    <Heart className={cn("h-4 w-4 mr-1", favorites.includes(openSign.id) && "fill-current")} />
                    {favorites.includes(openSign.id) ? "Saved" : "Save"}
                  </Button>
                  <Button
                    variant={isKnown(learningMap[openSign.id]?.status) ? "default" : "outline"}
                    onClick={() => toggleKnown(openSign.id)}
                    className="flex-1 h-11 rounded-xl font-bold"
                  >
                    <CheckCircle2 className={cn("h-4 w-4 mr-1", isKnown(learningMap[openSign.id]?.status) && "fill-current")} />
                    {isKnown(learningMap[openSign.id]?.status) ? "Known" : "I know this"}
                  </Button>
                  {linkedQuestions.length > 0 && (
                    <Button onClick={practiceInQuiz} className="flex-1 h-11 rounded-xl font-bold brand-gradient border-none">
                      Practice in quiz ({linkedQuestions.length})
                    </Button>
                  )}
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </Layout>
  );
}
