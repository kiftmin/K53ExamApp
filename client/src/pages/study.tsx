import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { StudySign, StudyRule } from "@shared/schema";
import { weakestGroups } from "@/lib/mastery-summary";
import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, Car, Signpost, TrafficCone, ArrowLeft } from "lucide-react";

export function useStudyGate(): boolean {
  const [, setLocation] = useLocation();
  const allowed = typeof sessionStorage !== "undefined" && !!sessionStorage.getItem("k53_access_code");
  useEffect(() => {
    if (!allowed) setLocation("/");
  }, [allowed, setLocation]);
  return allowed;
}

export default function Study() {
  const [, setLocation] = useLocation();
  const allowed = useStudyGate();
  const { data: signs = [] } = useQuery<StudySign[]>({
    queryKey: ["/api/signs"],
    enabled: allowed,
  });
  const { data: rules = [] } = useQuery<StudyRule[]>({
    queryKey: ["/api/rules"],
    enabled: allowed,
  });
  const weak = weakestGroups(signs, rules, 3);

  if (!allowed) return null;

  return (
    <Layout>
      <div className="py-6 px-1 space-y-5">
        <button
          onClick={() => setLocation("/")}
          className="flex items-center gap-1 text-xs font-semibold text-muted-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Home
        </button>

        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">
            <BookOpen className="h-3.5 w-3.5" /> Cold-study modules
          </div>
          <h1 className="text-2xl font-display font-extrabold tracking-tight">Study</h1>
          <p className="text-sm text-muted-foreground">Learn the material before you test yourself.</p>
        </div>

        <div className="space-y-3">
          <Card
            className="glass-card border-none shadow-xl rounded-3xl cursor-pointer transition-transform hover:-translate-y-0.5"
            onClick={() => setLocation("/study/signs")}
          >
            <CardContent className="p-5 flex items-center gap-4">
              <div
                className="h-12 w-12 rounded-2xl flex items-center justify-center text-white shrink-0"
                style={{ background: "linear-gradient(135deg, #E53E1A, #F5A623)" }}
              >
                <Signpost className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <p className="font-display font-bold">Road Signs</p>
                <p className="text-xs text-muted-foreground">
                  {signs.length > 0 ? `${signs.length} signs · browse & flashcards` : "Browse & flashcards"}
                </p>
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-green-600 bg-green-500/10 px-2 py-1 rounded-full">
                Active
              </span>
            </CardContent>
          </Card>

          <Card
            className="glass-card border-none shadow-xl rounded-3xl cursor-pointer transition-transform hover:-translate-y-0.5"
            onClick={() => setLocation("/study/rules")}
          >
            <CardContent className="p-5 flex items-center gap-4">
              <div
                className="h-12 w-12 rounded-2xl flex items-center justify-center text-white shrink-0"
                style={{ background: "linear-gradient(135deg, #E53E1A, #F5A623)" }}
              >
                <TrafficCone className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <p className="font-display font-bold">Rules of the Road</p>
                <p className="text-xs text-muted-foreground">Browse rules by code & flashcards</p>
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-green-600 bg-green-500/10 px-2 py-1 rounded-full">
                Active
              </span>
            </CardContent>
          </Card>

          <Card
            className="glass-card border-none shadow-xl rounded-3xl cursor-pointer transition-transform hover:-translate-y-0.5"
            onClick={() => setLocation("/study/controls")}
          >
            <CardContent className="p-5 flex items-center gap-4">
              <div
                className="h-12 w-12 rounded-2xl flex items-center justify-center text-white shrink-0"
                style={{ background: "linear-gradient(135deg, #E53E1A, #F5A623)" }}
              >
                <Car className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <p className="font-display font-bold">Vehicle Controls</p>
                <p className="text-xs text-muted-foreground">Browse components & recognition/recall flashcards</p>
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-green-600 bg-green-500/10 px-2 py-1 rounded-full">
                Active
              </span>
            </CardContent>
          </Card>
        </div>

         {/* Continue Learning — weakest groups from localStorage learning records */}
        {weak.length > 0 && (
          <div className="glass-card rounded-3xl border-none shadow-xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              <h2 className="font-display font-bold">Continue Learning</h2>
            </div>
            <p className="text-xs text-muted-foreground">Your weakest areas by recall rating:</p>
            <div className="space-y-2">
              {weak.map((g) => (
                <div key={`${g.heading}-${g.subheading}`} className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2">
                  <div>
                    <p className="text-xs font-bold">{g.subheading}</p>
                    <p className="text-[10px] text-muted-foreground">{g.heading}</p>
                  </div>
                  <span className="text-xs font-bold text-amber-700">{g.weak} shaky · {g.pct}% mastered</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => setLocation("/study/signs/flashcards?revision=1")}
              className="w-full h-11 rounded-xl font-bold text-white"
              style={{ background: "linear-gradient(135deg, #E53E1A, #F5A623)" }}
            >
              Start Revision
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
