import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { StudySign, StudyRule, StudyControl } from "@shared/schema";
import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { countKnown } from "@/lib/learning-status";
import { getAllSignLearning, initSignSync } from "@/lib/sign-storage";
import { getAllRuleLearning, initRuleSync, getRulesLicenceCode } from "@/lib/rule-storage";
import { getAllControlLearning, initControlSync, getControlsLicenceCode } from "@/lib/control-storage";
import { visibleSigns } from "@/lib/sign-codes";
import { ensureLocalOwner } from "@/lib/progress-owner";
import { BookOpen, Car, Signpost, TrafficCone, ArrowLeft } from "lucide-react";

export function useStudyGate(): boolean {
  const [location, setLocation] = useLocation();
  const allowed = typeof sessionStorage !== "undefined" && !!sessionStorage.getItem("k53_access_code");
  useEffect(() => {
    if (!allowed) {
      setLocation(`/?unlock=${encodeURIComponent(location)}`);
    }
  }, [allowed, location, setLocation]);
  return allowed;
}

export default function Study() {
  const [, setLocation] = useLocation();
  const allowed = useStudyGate();

  const rulesCode = getRulesLicenceCode();
  const controlsCode = getControlsLicenceCode();
  const controlsVehicleType =
    controlsCode === 1 ? "motorcycle" : controlsCode === 2 ? "lmv" : controlsCode === 3 ? "hmv" : null;

  const { data: signs = [] } = useQuery<StudySign[]>({
    queryKey: ["/api/signs"],
    enabled: allowed,
  });
  const { data: rules = [] } = useQuery<StudyRule[]>({
    queryKey: [`/api/rules?code=${rulesCode}`],
    queryFn: async () => {
      const r = await fetch(`/api/rules?code=${rulesCode}`);
      if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
      return r.json();
    },
    enabled: allowed && rulesCode !== null,
  });
  const { data: controls = [] } = useQuery<StudyControl[]>({
    queryKey: [`/api/controls?vehicle_type=${controlsVehicleType}`],
    queryFn: async () => {
      const r = await fetch(`/api/controls?vehicle_type=${controlsVehicleType}`);
      if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
      return r.json();
    },
    enabled: allowed && controlsVehicleType !== null,
  });

  const [syncTick, setSyncTick] = useState(0);
  useEffect(() => {
    if (allowed) {
      ensureLocalOwner();
      Promise.all([initSignSync(), initRuleSync(), initControlSync()])
        .catch(() => undefined)
        .then(() => setSyncTick((t) => t + 1));
    }
  }, [allowed]);

  const visibleSignList = useMemo(() => visibleSigns(signs), [signs]);
  const signStats = useMemo(
    () => countKnown(visibleSignList as { id: number }[], getAllSignLearning()),
    [visibleSignList, syncTick]
  );
  const ruleStats = useMemo(
    () => countKnown(rules as { id: number }[], getAllRuleLearning()),
    [rules, syncTick]
  );
  const controlStats = useMemo(
    () => countKnown(controls as { id: number }[], getAllControlLearning()),
    [controls, syncTick]
  );

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
          <StudyModuleCard
            icon={<Signpost className="h-6 w-6" />}
            title="Road Signs"
            subtitle={visibleSignList.length > 0 ? `${visibleSignList.length} signs · browse & flashcards` : "Browse & flashcards"}
            path="/study/signs"
            stats={signStats}
          />

          <StudyModuleCard
            icon={<TrafficCone className="h-6 w-6" />}
            title="Rules of the Road"
            subtitle={rules.length > 0 ? `${rules.length} rules · browse & flashcards` : "Browse rules by code & flashcards"}
            path="/study/rules"
            stats={rulesCode !== null ? ruleStats : { known: 0, total: 0 }}
          />

          <StudyModuleCard
            icon={<Car className="h-6 w-6" />}
            title="Vehicle Controls"
            subtitle={controls.length > 0 ? `${controls.length} components · browse & flashcards` : "Browse components & flashcards"}
            path="/study/controls"
            stats={controlsVehicleType !== null ? controlStats : { known: 0, total: 0 }}
          />
        </div>
      </div>
    </Layout>
  );
}

function StudyModuleCard({
  icon, title, subtitle, path, stats,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  path: string;
  stats: { known: number; total: number };
}) {
  const [, setLocation] = useLocation();
  return (
    <Card
      className="glass-card border-none shadow-xl rounded-3xl cursor-pointer transition-transform hover:-translate-y-0.5"
      onClick={() => setLocation(path)}
    >
      <CardContent className="p-5 flex items-center gap-4">
        <div
          className="h-12 w-12 rounded-2xl flex items-center justify-center text-white shrink-0"
          style={{ background: "linear-gradient(135deg, #E53E1A, #F5A623)" }}
        >
          {icon}
        </div>
        <div className="flex-1">
          <p className="font-display font-bold">{title}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
          {stats.total > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[11px] font-bold text-muted-foreground whitespace-nowrap">
                {stats.known} of {stats.total} learned
              </span>
              <Progress value={(stats.known / stats.total) * 100} className="h-1 flex-1" />
            </div>
          )}
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest text-green-600 bg-green-500/10 px-2 py-1 rounded-full">
          Active
        </span>
      </CardContent>
    </Card>
  );
}
