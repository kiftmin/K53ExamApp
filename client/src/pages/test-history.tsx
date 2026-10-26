import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { CATEGORY_NAMES } from "@shared/schema";
import { getQuizRuns, initQuizHistorySync, type QuizHistoryRun } from "@/lib/quiz-history";
import { ensureLocalOwner } from "@/lib/progress-owner";
import { currentMobile, syncEnabled } from "@/lib/progress-sync";
import { ArrowLeft, ChevronRight, History, ListChecks, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

function testLabel(run: QuizHistoryRun): string {
  if (run.testType === "simulation") return "Exam Simulation";
  return CATEGORY_NAMES[run.category] || `Category ${run.category}`;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

function formatDuration(seconds: number): string {
  if (!seconds) return "";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function maskMobile(mobile: string | null): string {
  if (!mobile || mobile.length < 6) return "this mobile number";
  return `${mobile.slice(0, 3)} *** ${mobile.slice(-3)}`;
}

export default function TestHistory() {
  const [, setLocation] = useLocation();
  const [runs, setRuns] = useState<QuizHistoryRun[]>(() => {
    ensureLocalOwner();
    return getQuizRuns();
  });
  const [loading, setLoading] = useState(true);
  const [synced, setSynced] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await initQuizHistorySync();
        if (!cancelled && result) {
          setRuns(result.runs);
          setSynced(result.synced);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSync = async () => {
    setLoading(true);
    try {
      const result = await initQuizHistorySync();
      if (result) {
        setRuns(result.runs);
        setSynced(result.synced);
      }
    } finally {
      setLoading(false);
    }
  };

  const syncAvailable = syncEnabled();
  const syncStatus = !syncAvailable
    ? "Sign in with a mobile-linked code to sync across devices."
    : loading && runs.length > 0
      ? "Syncing..."
      : synced === false
        ? "Could not sync. Saved on this device only."
        : synced
          ? `Synced to ${maskMobile(currentMobile())}.`
          : null;

  return (
    <Layout>
      <div className="w-full max-w-2xl mx-auto space-y-6 py-4 pb-24">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={() => setLocation("/")}
            aria-label="Back to Home"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-display font-bold">Past tests</h1>
            <p className="text-sm text-muted-foreground">Completed tests saved to this account</p>
          </div>
          {syncAvailable && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-8 px-2 text-xs"
              onClick={handleSync}
              disabled={loading}
            >
              <RefreshCw className={cn("w-3.5 h-3.5 mr-1", loading && "animate-spin")} />
              Sync
            </Button>
          )}
        </div>

        {syncStatus && (
          <p className={cn("text-xs px-1", synced ? "text-success" : "text-muted-foreground")}>
            {syncStatus}
          </p>
        )}

        {loading && runs.length === 0 ? (
          <div className="rounded-2xl border border-border p-10 text-center">
            <p className="text-sm text-muted-foreground">Loading past tests...</p>
          </div>
        ) : runs.length === 0 ? (
          <div className="rounded-2xl border border-border p-10 text-center space-y-3">
            <History className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="font-bold">No completed tests yet</p>
            <p className="text-sm text-muted-foreground">
              Finish a Category Test or Exam Simulation and it will appear here.
            </p>
            <Button onClick={() => setLocation("/new-test?mode=category")}>
              <ListChecks className="w-4 h-4 mr-2" /> Start a test
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {runs.map((run) => {
              const duration = formatDuration(run.elapsedSeconds);
              return (
                <button
                  key={run.id}
                  type="button"
                  onClick={() => setLocation(`/history/${run.id}`)}
                  className="w-full text-left glass-card rounded-2xl p-4 space-y-2 hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-display font-bold">{testLabel(run)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(run.finishedAt)}
                        {duration ? ` · ${duration}` : ""}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider",
                        run.overallPass
                          ? "bg-success/15 text-success"
                          : "bg-destructive/15 text-destructive"
                      )}
                    >
                      {run.overallPass ? "Passed" : "Did not pass"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold">
                      {run.correct} / {run.total} · {run.percentage}%
                    </p>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {runs.length > 0 && (
          <Button variant="outline" className="w-full h-11 rounded-xl font-bold" onClick={() => setLocation("/")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Home
          </Button>
        )}
      </div>
    </Layout>
  );
}
