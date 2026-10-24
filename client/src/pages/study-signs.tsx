import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { Question, StudySign } from "@shared/schema";
import { Layout } from "@/components/layout";
import { FormattedText } from "@/components/formatted-text";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useQuiz } from "@/lib/quiz-context";
import { SignFaceImages, SignCodeChips, isGenericWhere } from "@/components/sign-images";
import { SHOW_TEMPORARY_SIGNS, isTemporaryOnlyRecord, orderImages, splitCodes, temporaryLabel } from "@/lib/sign-codes";
import { getFavoriteSignIds, toggleFavoriteSign, setSignKnown, resetSignProgress, removeFavoriteSigns, getAllSignLearning, initSignSync } from "@/lib/sign-storage";
import { initQuestionSync } from "@/lib/question-results";
import { isKnown, countKnown } from "@/lib/learning-status";
import { ensureLocalOwner } from "@/lib/progress-owner";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, BadgeCheck, ChevronDown, CheckCircle2, Heart, ImageOff, Layers, HeartOff, RotateCcw, AlertTriangle, Ban, Info as InfoIcon, Route, Milestone, SquareStack, Lightbulb, Signpost, SearchX, type LucideIcon } from "lucide-react";
import {
  STUDY_KNOWN_ROW_CLASS,
  STUDY_KNOWN_TEXT_CLASS,
  STUDY_ROW_BORDER_CLASS,
  StudyCategoryTabs,
  StudyGroupCard,
  StudyKnownBadge,
  StudyRowAction,
  StudySearchField,
  StudyStatusBar,
  StudySubCategoryTabs,
  StudySubRow,
} from "@/components/study-browse";
import { sentenceCase, titleCase } from "@/lib/text-case";
import { cn } from "@/lib/utils";
import { useStudyGate } from "./study";

function resetSectionConfirm(ids: number[], label: string): boolean {
  return typeof window === "undefined" || window.confirm(`Reset this section (${label})? This clears your progress for these ${ids.length} cards.`);
}

/** Icon anchor so a category is recognisable before it is read. */
function signIconFor(label: string): LucideIcon {
  const text = label.toLowerCase();
  if (text.includes("warning") || text.includes("caution")) return AlertTriangle;
  if (text.includes("prohibition") || text.includes("restriction") || text.includes("no ")) return Ban;
  if (text.includes("information") || text.includes("info")) return InfoIcon;
  if (text.includes("direction") || text.includes("route") || text.includes("arrow")) return Route;
  if (text.includes("marker")) return Milestone;
  if (text.includes("regulatory") || text.includes("command")) return Signpost;
  if (text.includes("diagram")) return SquareStack;
  if (text.includes("signal") || text.includes("light")) return Lightbulb;
  return Layers;
}

function SubheadingSignGroup({
  subheading, list, favorites, learningMap, forceOpen, onOpen, onToggleFav, onToggleKnown, onResetSection, onClearSaved,
}: any) {
  const [open, setOpen] = useState(false);
  const isOpen = forceOpen || open;
  const hasFavs = list.some((s: StudySign) => favorites.includes(s.id));
  const hasProgress = list.some((s: StudySign) => learningMap[s.id]);
  return (
    <StudySubRow
      icon={signIconFor(subheading)}
      title={sentenceCase(subheading)}
      countLabel={`${list.length} ${list.length === 1 ? "sign" : "signs"}`}
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
              onClick={() => onClearSaved(list.map((s: StudySign) => s.id))}
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
              onClick={() => onResetSection(list.map((s: StudySign) => s.id), subheading)}
            >
              <RotateCcw className="h-4 w-4" />
            </StudyRowAction>
          )}
        </>
      }
    >
      {list.map((s: StudySign) => {
        const thumb = orderImages(s.images || [])[0]?.image_url;
        const fav = favorites.includes(s.id);
        const known = isKnown(learningMap[s.id]?.status);
        const { permanent: rowPerm, temporary: rowTemp } = splitCodes(s.codes || []);
        const rowTempShown = SHOW_TEMPORARY_SIGNS ? rowTemp : [];
        return (
          <button
            key={s.id}
            onClick={() => onOpen(s.id)}
            className={cn("w-full flex items-center gap-3 p-2.5 rounded-xl bg-muted/40 text-left", STUDY_ROW_BORDER_CLASS, known && STUDY_KNOWN_ROW_CLASS)}
          >
            <div className="h-12 w-12 rounded-lg bg-white border border-border flex items-center justify-center overflow-hidden shrink-0">
              {thumb ? (
                <img src={thumb} alt={s.name} className="h-full w-full object-contain" loading="lazy" />
              ) : (
                <ImageOff className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn("text-sm font-semibold leading-snug flex items-center gap-1", known && STUDY_KNOWN_TEXT_CLASS)}>
                <span className="truncate">{s.name}</span>
                {s.is_verified_exam_question && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-green-600" />}
                {fav && <Heart className="h-3.5 w-3.5 shrink-0 text-red-500 fill-red-500" />}
              </p>
              <div className="mt-1">
                <div className="flex flex-wrap gap-1">
                  {rowPerm.map((c) => (
                    <Badge key={c} variant="outline" className="text-[10px] font-mono">{c}</Badge>
                  ))}
                </div>
                {rowTempShown.length > 0 && (
                  <p className="text-[10px] font-semibold text-muted-foreground mt-0.5">{temporaryLabel(rowTempShown)}</p>
                )}
              </div>
            </div>
            <span onClick={(e) => { e.stopPropagation(); onToggleFav(s.id); }} aria-label="Save" className="p-1">
              <Heart className={cn("h-4 w-4", fav ? "fill-red-500 text-red-500" : "text-muted-foreground")} />
            </span>
            <span onClick={(e) => { e.stopPropagation(); onToggleKnown(s.id); }} aria-label="I know this" className="p-1 shrink-0">
              <StudyKnownBadge known={known} />
            </span>
          </button>
        );
      })}
    </StudySubRow>
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
      Promise.all([initSignSync(), initQuestionSync()]).then(() => setProgressTick((t) => t + 1));
    }
  }, [allowed]);

  const learningMap = useMemo(() => getAllSignLearning(), [progressTick]);

  const { data: linkedQuestions = [] } = useQuery<Question[]>({
    queryKey: [`/api/signs/${openId}/questions`],
    enabled: allowed && openId !== null,
  });

  const openSign = openId !== null ? signs.find((s) => s.id === openId) || null : null;
  const [detailFullOpen, setDetailFullOpen] = useState(false);

  // Collapsed by default on every opened sign.
  useEffect(() => {
    setDetailFullOpen(false);
  }, [openId]);

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
      if (!SHOW_TEMPORARY_SIGNS && isTemporaryOnlyRecord(s.codes)) continue;
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
      if (!SHOW_TEMPORARY_SIGNS && isTemporaryOnlyRecord(s.codes)) return false;
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

        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur py-2 space-y-2.5">
          <StudySearchField value={search} onChange={setSearch} placeholder="Search name or code…" />
          <StudyCategoryTabs
            tabs={[{ id: "all", label: "All" }, ...headings.map((h) => ({ id: h, label: titleCase(h) }))]}
            value={heading}
            onChange={setHeading}
          />
          <StudyStatusBar
            learned={progressCounts.learned}
            notLearned={progressCounts.notLearned}
            saved={favorites.length}
            learnedFilter={learnedFilter}
            onLearnedFilter={setLearnedFilter}
            savedOnly={savedOnly}
            onSavedOnly={setSavedOnly}
          />
          {subheadings.length > 1 && (
            <StudySubCategoryTabs
              tabs={[{ id: "all", label: "All" }, ...subheadings.map((s) => ({ id: s, label: sentenceCase(s) }))]}
              value={subheading}
              onChange={setSubheading}
            />
          )}
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-10">Loading signs…</p>
        ) : grouped.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-3">
            <SearchX className="h-7 w-7 mx-auto text-muted-foreground" />
            <p className="font-semibold">No signs match</p>
            <p className="text-sm text-muted-foreground">Try another search or switch off a filter.</p>
            {(savedOnly || learnedFilter !== "all") && (
              <div className="flex flex-wrap justify-center gap-2 pt-1">
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
            const sectionHasFavs = sectionIds.some((id: number) => favorites.includes(id));
            const sectionHasProgress = sectionIds.some((id: number) => learningMap[id]);
            return (
            <StudyGroupCard
              key={h}
              icon={signIconFor(h)}
              title={titleCase(h)}
              known={stats.known}
              total={stats.total}
              savedCount={savedCount}
              onClearSaved={sectionHasFavs ? () => clearSaved(sectionIds) : undefined}
              onReset={sectionHasProgress ? () => resetSection(sectionIds, h) : undefined}
            >
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
            </StudyGroupCard>
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
                  {openSign.is_verified_exam_question && (
                    <Badge className="bg-green-600"><BadgeCheck className="h-3 w-3 mr-1" /> Exam question</Badge>
                  )}
                </div>
                <SignCodeChips codes={openSign.codes} />
                {(openSign.images || []).length > 0 ? (
                  <SignFaceImages images={openSign.images} />
                ) : (
                  <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                    No image yet for this sign.
                  </div>
                )}
                {openSign.short_reviewed && openSign.short_meaning ? (
                  <>
                    <p className="text-sm">{openSign.short_meaning}</p>
                    {openSign.short_action && (
                      <div className="rounded-xl bg-primary/10 border border-primary/30 p-3">
                        <p className="text-[11px] font-black uppercase tracking-widest text-primary">What you must do</p>
                        <FormattedText text={openSign.short_action} className="text-sm mt-1" />
                      </div>
                    )}
                    {!isGenericWhere(openSign.where_text) && (
                      <p className="text-[11px] text-muted-foreground font-semibold">{openSign.where_text}</p>
                    )}
                    {(openSign.where_text || openSign.purpose_text || openSign.action_text) && (
                      <div className="rounded-xl border border-border bg-background/60">
                        <button
                          type="button"
                          onClick={() => setDetailFullOpen((f) => !f)}
                          className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-muted-foreground"
                        >
                          Full manual text
                          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", detailFullOpen && "rotate-180")} />
                        </button>
                        {detailFullOpen && (
                          <div className="px-3 pb-3 space-y-2">
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
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  [
                    { label: "Where", text: openSign.where_text },
                    { label: "Purpose", text: openSign.purpose_text },
                    { label: "Action", text: openSign.action_text },
                  ].filter((x) => x.text).map((x) => (
                    <div key={x.label}>
                      <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">{x.label}</p>
                      <FormattedText text={x.text} className="text-sm mt-0.5" />
                    </div>
                  ))
                )}
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
