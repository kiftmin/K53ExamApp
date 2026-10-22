import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { StudySign, StudyRule, StudyControl, ControlDiagram } from "@shared/schema";
import { weakestGroups, controlsForSummary } from "@/lib/mastery-summary";
import { initSignSync } from "@/lib/sign-storage";
import { initRuleSync } from "@/lib/rule-storage";
import { initControlSync } from "@/lib/control-storage";
import { ensureLocalOwner } from "@/lib/progress-owner";
import { useAccessCode } from "@/lib/use-access-code";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, ChevronRight, Target, Clock, ShieldCheck } from "lucide-react";

const LOGO_URL = "https://res.cloudinary.com/dkhgsi8l7/image/upload/v1773061809/logo_edited_vlgoqy.jpg";

const DASHBOARD = [
  {
    title: "Study",
    description: "Signs, Controls & Rules",
    path: "/study",
    icon: BookOpen,
    gradient: "linear-gradient(135deg, #E53E1A, #F5A623)",
  },
  {
    title: "Category Test",
    description: "Focus on one vehicle category",
    path: "/new-test?mode=category",
    icon: Target,
    gradient: "linear-gradient(135deg, #E53E1A, #F5A623)",
  },
  {
    title: "Exam Simulation",
    description: "Full 64-question timed test",
    path: "/new-test?mode=simulation",
    icon: Clock,
    gradient: "linear-gradient(135deg, #E53E1A, #F5A623)",
  },
];

export default function Home() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const {
    code,
    mobile,
    validated,
    requiresMobile,
    error,
    loading,
    setCode,
    setMobile,
    verify,
  } = useAccessCode();

  const { data: signs = [] } = useQuery<StudySign[]>({
    queryKey: ["/api/signs"],
  });
  const { data: rules = [] } = useQuery<StudyRule[]>({
    queryKey: ["/api/rules"],
  });
  const { data: controls = [] } = useQuery<StudyControl[]>({
    queryKey: ["/api/controls"],
  });
  const { data: diagrams = [] } = useQuery<ControlDiagram[]>({
    queryKey: ["/api/control-diagrams"],
  });

  const [syncTick, setSyncTick] = useState(0);

  const weak = useMemo(
    () => weakestGroups(signs, rules, controlsForSummary(controls, diagrams), 3),
    [signs, rules, controls, diagrams, syncTick]
  );

  const revisionPath = weak.length > 0 ? gModulePath(weak[0]!) : "/study";

  useEffect(() => {
    if (!validated) return;
    let cancelled = false;
    ensureLocalOwner();
    (async () => {
      try {
        await Promise.all([initSignSync(), initRuleSync(), initControlSync()]);
      } catch {
        // Keep local data if hydration fails.
      }
      if (!cancelled) setSyncTick((t) => t + 1);
    })();
    return () => { cancelled = true; };
  }, [validated]);

  const unlockTarget = new URLSearchParams(search).get("unlock");
  const showVerifyCard = !!unlockTarget && !validated;

  useEffect(() => {
    if (validated && unlockTarget) {
      const target = unlockTarget.startsWith("/study") ? unlockTarget : "/";
      setLocation(target);
    }
  }, [validated, unlockTarget, setLocation]);

  return (
    <Layout>
      <div className="min-h-[calc(100vh-80px)] flex flex-col items-center justify-center py-8 px-4">
        {/* Compact header / greeting */}
        <div className="flex flex-col items-center text-center space-y-3 mb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="mb-2">
            <img
              src={LOGO_URL}
              alt="Jean's Driving School"
              className="h-16 md:h-20 w-auto object-contain border-0"
            />
          </div>

          <h1 className="text-2xl md:text-3xl font-display font-extrabold text-foreground tracking-tight leading-tight max-w-sm md:max-w-md">
            Pass your K53 test{" "}
            <span
              className="text-transparent bg-clip-text"
              style={{ backgroundImage: "linear-gradient(90deg, #E53E1A, #F5A623)" }}
            >
              with confidence
            </span>
          </h1>

          <p className="text-sm text-muted-foreground max-w-xs md:max-w-sm">
            Professional practice tests tailored to your license code and vehicle category.
          </p>
        </div>

        {/* Access-code verification card shown when a study route was gated */}
        {showVerifyCard && (
          <Card
            className="w-full max-w-md glass-card border-none shadow-xl rounded-3xl mb-10 animate-in fade-in slide-in-from-bottom-4 duration-500"
          >
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <h2 className="font-display font-bold">Verify your access code</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Verify your access code to unlock Study.
              </p>
              <div className="space-y-1.5">
                <Label
                  htmlFor="home-accessCode"
                  className="flex items-center gap-2 text-sm font-semibold"
                >
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Access Code
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="home-accessCode"
                    placeholder="D / W / M / X + 6 chars"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    maxLength={7}
                    className={`h-11 bg-background/60 focus:bg-background transition-colors font-mono text-base tracking-[0.25em] ${validated
                      ? "border-green-500 bg-green-50/50"
                      : error
                        ? "border-red-500"
                        : ""
                      }`}
                    disabled={validated}
                  />
                  {!validated ? (
                    <Button
                      type="button"
                      onClick={verify}
                      disabled={loading || code.length !== 7}
                      className="h-11 px-5 text-sm font-bold"
                      style={{
                        background: "linear-gradient(135deg, #E53E1A, #F5A623)",
                        border: "none",
                      }}
                    >
                      {loading ? "Verifying..." : "Verify"}
                    </Button>
                  ) : (
                    <div className="h-11 flex items-center px-3 text-green-600 font-semibold text-sm gap-1 whitespace-nowrap">
                      <ShieldCheck className="h-4 w-4" />
                      Verified
                    </div>
                  )}
                </div>
                {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
                {(requiresMobile || mobile) && (
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="home-mobileNumber"
                      className="text-sm font-semibold"
                    >
                      Mobile Number (linked to code)
                    </Label>
                    <Input
                      id="home-mobileNumber"
                      placeholder="10-digit mobile number"
                      inputMode="numeric"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      maxLength={10}
                      className="h-11 bg-background/60 font-mono tracking-[0.2em]"
                      disabled={validated}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Required for Weekly (W), Monthly (M) and Master (X) codes. Daily (D) codes don't need it.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Continue Learning — promoted from Study, shows only when there is history */}
        {weak.length > 0 && (
          <Card
            className="w-full max-w-md glass-card border-none shadow-xl rounded-3xl mb-10 animate-in fade-in slide-in-from-bottom-4 duration-500"
          >
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                <h2 className="font-display font-bold">Continue Learning</h2>
              </div>
              <p className="text-xs text-muted-foreground">Your weakest areas by recall rating:</p>
              <div className="space-y-2">
                {weak.map((g) => (
                  <div key={`${g.heading}-${g.subheading}-${g.module}`} className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2">
                    <div>
                      <p className="text-xs font-bold">{g.subheading === "(general)" ? g.heading : g.subheading}</p>
                      {g.subheading !== "(general)" && (
                        <p className="text-[10px] text-muted-foreground">{g.heading}</p>
                      )}
                    </div>
                    <span className="text-xs font-bold text-amber-700">{g.weak} shaky · {g.pct}% mastered</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setLocation(revisionPath)}
                className="w-full h-11 rounded-xl font-bold text-white transition-all hover:-translate-y-0.5"
                style={{ background: "linear-gradient(135deg, #E53E1A, #F5A623)" }}
              >
                Start Revision
              </button>
            </CardContent>
          </Card>
        )}

        {/* Dashboard — primary actions */}
        <div className="w-full max-w-md space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: "100ms" }}>
          {DASHBOARD.map((tile) => {
            const Icon = tile.icon;
            return (
              <button
                key={tile.title}
                onClick={() => setLocation(tile.path)}
                className="flex items-center gap-4 p-4 rounded-2xl glass-card border border-white/40 shadow-xl text-left transition-all hover:-translate-y-0.5 hover:shadow-2xl cursor-pointer"
              >
                <div
                  className="h-12 w-12 rounded-2xl flex items-center justify-center text-white shrink-0"
                  style={{ background: tile.gradient }}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <p className="font-display font-bold text-foreground">{tile.title}</p>
                  <p className="text-xs text-muted-foreground">{tile.description}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
              </button>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}

function gModulePath(group: { module: string }): string {
  switch (group.module) {
    case "signs":
      return "/study/signs/flashcards?revision=1";
    case "rules":
      return "/study/rules/flashcards?revision=1";
    case "controls":
      return "/study/controls/flashcards?revision=1";
    default:
      return "/study";
  }
}
