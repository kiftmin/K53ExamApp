import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { StudySign, StudyRule, StudyControl, ControlDiagram } from "@shared/schema";
import { nextPracticeGroups, controlsForSummary, PRACTISE_NEW_CAP, type GroupStats } from "@/lib/mastery-summary";
import { getRulesLicenceCode } from "@/lib/rule-storage";
import { getControlsLicenceCode } from "@/lib/control-storage";
import { initSignSync } from "@/lib/sign-storage";
import { initRuleSync } from "@/lib/rule-storage";
import { initControlSync } from "@/lib/control-storage";
import { initQuestionSync } from "@/lib/question-results";
import { ensureLocalOwner } from "@/lib/progress-owner";
import { useAccessCode } from "@/lib/use-access-code";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, ChevronRight, Target, Clock, ShieldCheck, RotateCcw } from "lucide-react";

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

  // Rules and Controls follow the same licence the study gates persist.
  const rulesCode = typeof window !== "undefined" ? getRulesLicenceCode() : null;
  const { data: rules = [] } = useQuery<StudyRule[]>({
    queryKey: [`/api/rules?code=${rulesCode}`],
    queryFn: async () => {
      const r = await fetch(`/api/rules?code=${rulesCode}`);
      if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
      return r.json();
    },
    enabled: rulesCode !== null,
  });

  const controlsCode = typeof window !== "undefined" ? getControlsLicenceCode() : null;
  const controlsVehicleType =
    controlsCode === 1 ? "motorcycle" : controlsCode === 2 ? "lmv" : controlsCode === 3 ? "hmv" : null;
  const { data: controls = [] } = useQuery<StudyControl[]>({
    queryKey: [`/api/controls?vehicle_type=${controlsVehicleType}`],
    queryFn: async () => {
      const r = await fetch(`/api/controls?vehicle_type=${controlsVehicleType}`);
      if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
      return r.json();
    },
    enabled: controlsVehicleType !== null,
  });
  const { data: diagrams = [] } = useQuery<ControlDiagram[]>({
    queryKey: ["/api/control-diagrams"],
  });

  const [syncTick, setSyncTick] = useState(0);

  const practiceGroups: GroupStats[] = useMemo(
    () => nextPracticeGroups(signs, rules, controlsForSummary(controls, diagrams)),
    [signs, rules, controls, diagrams, syncTick]
  );

  useEffect(() => {
    if (!validated) return;
    let cancelled = false;
    ensureLocalOwner();
    (async () => {
      try {
        await Promise.all([initSignSync(), initRuleSync(), initControlSync(), initQuestionSync()]);
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

        {/* Practise next — best group per module, so no module gets crowded out */}
        {practiceGroups.length > 0 && (
          <Card
            className="w-full max-w-md glass-card border-none shadow-xl rounded-3xl mb-10 animate-in fade-in slide-in-from-bottom-4 duration-500"
          >
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <RotateCcw className="h-4 w-4 text-primary" />
                <h2 className="font-display font-bold">Practise next</h2>
              </div>
              <div className="space-y-2">
                {practiceGroups.map((group) => (
                  <div
                    key={`${group.module}|${group.heading}|${group.subheading}`}
                    className="flex items-center gap-3 rounded-xl bg-muted/50 px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold truncate">
                        {group.subheading === "(general)"
                          ? group.heading
                          : group.subheading}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {group.toPractise} to practise · {Math.min(group.notTried, PRACTISE_NEW_CAP)} not tried yet
                      </p>
                    </div>
                    <Button
                      onClick={() => setLocation(practiceLocationFor(group))}
                      className="h-9 px-4 rounded-xl font-bold text-white border-none shrink-0"
                      style={{ background: "linear-gradient(135deg, #E53E1A, #F5A623)" }}
                    >
                      Practise
                    </Button>
                  </div>
                ))}
              </div>
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

function practiceLocationFor(group: GroupStats): string {
  const base =
    group.module === "signs"
      ? "/study/signs/flashcards"
      : group.module === "rules"
        ? "/study/rules/flashcards"
        : "/study/controls/flashcards";
  const params = new URLSearchParams({ revision: "1", heading: group.heading });
  if (group.subheading && group.subheading !== "(general)") {
    params.set("subheading", group.subheading);
  }
  return `${base}?${params.toString()}`;
}
