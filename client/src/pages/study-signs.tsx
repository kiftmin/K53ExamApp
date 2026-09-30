import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { Question, StudySign } from "@shared/schema";
import { Layout } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useQuiz } from "@/lib/quiz-context";
import { getFavoriteSignIds, toggleFavoriteSign } from "@/lib/sign-storage";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, BadgeCheck, Heart, ImageOff, Layers, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStudyGate } from "./study";

export default function StudySignsBrowse() {
  const [, setLocation] = useLocation();
  const allowed = useStudyGate();
  const { startQuiz } = useQuiz();
  const { toast } = useToast();
  const [heading, setHeading] = useState("all");
  const [subheading, setSubheading] = useState("all");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [favorites, setFavorites] = useState<number[]>(() => getFavoriteSignIds());

  const { data: signs = [], isLoading } = useQuery<StudySign[]>({
    queryKey: ["/api/signs"],
    enabled: allowed,
  });

  const { data: linkedQuestions = [] } = useQuery<Question[]>({
    queryKey: [`/api/signs/${openId}/questions`],
    enabled: allowed && openId !== null,
  });

  const openSign = openId !== null ? signs.find((s) => s.id === openId) || null : null;

  const headings = useMemo(() => Array.from(new Set(signs.map((s) => s.heading))).sort(), [signs]);
  const subheadings = useMemo(
    () => Array.from(new Set(signs.filter((s) => heading === "all" || s.heading === heading).map((s) => s.subheading))).sort(),
    [signs, heading]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return signs.filter((s) => {
      if (heading !== "all" && s.heading !== heading) return false;
      if (subheading !== "all" && s.subheading !== subheading) return false;
      if (q && !(s.name.toLowerCase().includes(q) || (s.codes || []).some((c) => c.toLowerCase().includes(q)))) return false;
      return true;
    });
  }, [signs, heading, subheading, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, StudySign[]>();
    for (const s of filtered) {
      const list = map.get(s.subheading) || [];
      list.push(s);
      map.set(s.subheading, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const toggleFav = (id: number) => {
    toggleFavoriteSign(id);
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
          <div className="flex gap-1.5 overflow-x-auto pb-1">
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
          {subheadings.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto pb-1">
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
            </div>
          )}
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-10">Loading signs…</p>
        ) : grouped.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">No signs match.</p>
        ) : (
          grouped.map(([sub, list]) => (
            <div key={sub} className="space-y-2">
              <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground px-1">{sub}</p>
              <div className="space-y-2">
                {list.map((s) => {
                  const thumb = s.images?.[0]?.image_url;
                  const fav = favorites.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      onClick={() => setOpenId(s.id)}
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
                        <p className="text-sm font-bold leading-snug flex items-center gap-1">
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
                    </button>
                  );
                })}
              </div>
            </div>
          ))
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
                    <p className="text-sm mt-0.5">{x.text}</p>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Button
                    variant={favorites.includes(openSign.id) ? "default" : "outline"}
                    onClick={() => toggleFav(openSign.id)}
                    className="flex-1 h-11 rounded-xl font-bold"
                  >
                    <Heart className={cn("h-4 w-4 mr-1", favorites.includes(openSign.id) && "fill-current")} />
                    {favorites.includes(openSign.id) ? "Favorited" : "Favorite"}
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
