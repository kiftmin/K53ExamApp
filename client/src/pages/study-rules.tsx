import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { StudyRule } from "@shared/schema";
import { Layout } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, Layers, Search, ArrowLeft } from "lucide-react";
import { toggleFavoriteRule, getFavoriteRuleIds } from "@/lib/rule-storage";
import { useStudyGate } from "./study";
import RulesCodeGate from "@/components/rules-code-gate";
import { cn } from "@/lib/utils";

const CODE_BADGE: Record<number, string> = { 0: "All", 1: "Moto", 2: "Light", 3: "Heavy" };

export default function StudyRulesBrowse() {
  const [, setLocation] = useLocation();
  const allowed = useStudyGate();
  const [search, setSearch] = useState("");
  const [favOnly, setFavOnly] = useState(false);
  const [favsTick, setFavsTick] = useState(0);

  return (
    <Layout>
      <RulesCodeGate>
        {(code, reset) => <BrowseInner key={code} code={code} reset={reset} allowed={allowed} setLocation={setLocation} search={search} setSearch={setSearch} favOnly={favOnly} setFavOnly={setFavOnly} favsTick={favsTick} setFavsTick={setFavsTick} />}
      </RulesCodeGate>
    </Layout>
  );
}

function BrowseInner({
  code,
  reset,
  allowed,
  setLocation,
  search,
  setSearch,
  favOnly,
  setFavOnly,
  favsTick,
  setFavsTick,
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

  const favorites = useMemo(() => getFavoriteRuleIds(), [favsTick]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rules.filter((r) => {
      if (favOnly && !favorites.includes(r.id)) return false;
      if (q && !(r.body.toLowerCase().includes(q) || (r.title || "").toLowerCase().includes(q) || r.section_ref.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [rules, search, favOnly, favorites]);

  const grouped = useMemo(() => {
    const map = new Map<string, StudyRule[]>();
    for (const r of filtered) {
      const key = r.subheading || "(general)";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  return (
    <div className="py-4 space-y-4">
      <div className="flex items-center justify-between px-1">
        <button onClick={() => setLocation("/study")} className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Study
        </button>
        <div className="flex items-center gap-2">
          <button onClick={reset} className="text-xs font-semibold text-primary">Code {code} ▾</button>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setLocation(`/study/rules/flashcards`)}>
            <Layers className="h-3.5 w-3.5 mr-1" /> Flashcards
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search rules…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-11 bg-background/60 rounded-xl"
        />
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
      ) : grouped.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No rules match.</p>
      ) : (
        grouped.map(([subheading, list]) => (
          <div key={subheading} className="space-y-2">
            <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground px-1">{subheading}</p>
            {list.map((r) => {
              const fav = favorites.includes(r.id);
              return (
                <div key={r.id} className="rounded-2xl border border-border bg-card p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm leading-snug flex-1">{r.body}</p>
                    <button
                      onClick={() => { toggleFavoriteRule(r.id); setFavsTick((t: number) => t + 1); }}
                      aria-label="Toggle favorite"
                      className="shrink-0 p-1"
                    >
                      <Heart className={cn("h-4 w-4", fav ? "fill-red-500 text-red-500" : "text-muted-foreground")} />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1 items-center">
                    <span className="text-[10px] font-mono text-muted-foreground">{r.section_ref}</span>
                    {(r.applicable_codes || []).map((c: number) => (
                      <Badge key={c} variant="outline" className="text-[10px] font-mono py-0">
                        {CODE_BADGE[c] ?? c}
                      </Badge>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}
