import { useEffect, useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { CATEGORY_NAMES, type Question } from "@shared/schema";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getQuizRun, initQuizHistorySync, type QuizHistoryRun } from "@/lib/quiz-history";
import { ensureLocalOwner } from "@/lib/progress-owner";
import { AlertTriangle, ArrowLeft, CheckCircle2, XCircle } from "lucide-react";

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

export default function TestHistoryDetail() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/history/:id");
  const runId = params?.id ?? "";
  const [loadedRun, setLoadedRun] = useState<QuizHistoryRun | undefined>(() => {
    ensureLocalOwner();
    return runId ? getQuizRun(runId) : undefined;
  });
  const [checkingHistory, setCheckingHistory] = useState(() => !!runId && !loadedRun);
  const [failedImages, setFailedImages] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    if (!runId) {
      setLoadedRun(undefined);
      setCheckingHistory(false);
      return;
    }

    ensureLocalOwner();
    const local = getQuizRun(runId);
    if (local) {
      setLoadedRun(local);
      setCheckingHistory(false);
      return;
    }

    let cancelled = false;
    setCheckingHistory(true);
    initQuizHistorySync()
      .then(() => {
        if (cancelled) return;
        setLoadedRun(getQuizRun(runId));
        setCheckingHistory(false);
      })
      .catch(() => {
        if (!cancelled) setCheckingHistory(false);
      });
    return () => {
      cancelled = true;
    };
  }, [runId]);

  const run = loadedRun?.id === runId ? loadedRun : undefined;

  const { data: questions = [], isLoading } = useQuery<Question[]>({
    queryKey: ["/api/questions"],
  });

  const byId = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);

  const backToHistory = () => setLocation("/history");

  if (!run && checkingHistory) {
    return (
      <Layout>
        <div className="w-full max-w-2xl mx-auto py-4 pb-24">
          <div className="rounded-2xl border border-border p-10 text-center">
            <p className="text-sm text-muted-foreground">Loading test...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!run) {
    return (
      <Layout>
        <div className="w-full max-w-2xl mx-auto py-4 pb-24 space-y-4">
          <div className="rounded-2xl border border-border p-10 text-center space-y-3">
            <p className="font-bold">Test not found</p>
            <p className="text-sm text-muted-foreground">
              This test is not available for the current account.
            </p>
            <Button onClick={backToHistory}>Back to past tests</Button>
          </div>
        </div>
      </Layout>
    );
  }

  const duration = formatDuration(run.elapsedSeconds);

  return (
    <Layout>
      <div className="w-full max-w-2xl mx-auto space-y-6 py-4 pb-24">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="rounded-full" onClick={backToHistory} aria-label="Back to past tests">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-display font-bold">Test result</h1>
            <p className="text-sm text-muted-foreground">
              {formatDate(run.finishedAt)}
              {duration ? ` Â· ${duration}` : ""}
            </p>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-display font-bold text-lg">
                {run.name} {run.surname}
              </p>
              <p className="text-sm text-muted-foreground">
                License Code {run.licenseCode} â€¢ {testLabel(run)}
              </p>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider",
                run.overallPass ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
              )}
            >
              {run.overallPass ? "Passed" : "Did not pass"}
            </span>
          </div>

          <div className="flex items-end justify-between border-t pt-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Overall performance
              </p>
              <p className="text-3xl font-black">{run.percentage}%</p>
            </div>
            <p className="text-sm font-bold text-muted-foreground">
              {run.correct} / {run.total}
            </p>
          </div>

          <div className="space-y-2">
            {run.categories.map((cat) => (
              <div
                key={cat.categoryId}
                className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 px-3 py-2"
              >
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {CATEGORY_NAMES[cat.categoryId] || `Category ${cat.categoryId}`}
                  </p>
                  <p className="text-sm font-semibold">
                    {cat.correct} / {cat.total}
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider",
                    cat.pass ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
                  )}
                >
                  {cat.pass ? "Pass" : "Fail"}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="font-display font-bold px-1">Questions</h2>
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Loading questionsâ€¦</p>
          ) : (
            run.items.map((item, index) => {
              const question = byId.get(item.id);
              const userAnswerNumber = run.answers[item.number];
              const correctOption = question?.options.find((option) => option.correct_answer);
              const userOption = question?.options.find((option) => option.answer_number === userAnswerNumber);
              const isAnswered = userAnswerNumber !== undefined;
              const isCorrect = !!correctOption && userAnswerNumber === correctOption.answer_number;

              return (
                <div key={`${item.id}-${index}`} className="rounded-2xl border border-border bg-card p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">
                      {isCorrect ? (
                        <CheckCircle2 className="w-5 h-5 text-success" />
                      ) : (
                        <XCircle className={cn("w-5 h-5", isAnswered ? "text-destructive" : "text-muted-foreground")} />
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Question {index + 1}
                        {question ? ` Â· ${CATEGORY_NAMES[question.category] || `Category ${question.category}`}` : ""}
                      </p>
                      <p className="text-sm font-medium leading-relaxed">
                        {question ? question.question_text : "This question is no longer available."}
                      </p>
                    </div>
                  </div>

                  {question && question.contains_image && question.image_link && !failedImages.has(question.id) && (
                    <img
                      src={question.image_link}
                      alt="Question visual"
                      className="max-h-40 rounded-lg border bg-white object-contain"
                      onError={() => setFailedImages((prev) => new Set(prev).add(question.id))}
                    />
                  )}

                  <div className="space-y-1.5 pl-8">
                    {isAnswered ? (
                      <p className={cn("text-sm", isCorrect ? "text-success" : "text-destructive")}>
                        <span className="font-bold">Your answer:</span>{" "}
                        {userOption?.answer_text ?? userAnswerNumber}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground inline-flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4" /> Not answered
                      </p>
                    )}
                    {!isCorrect && correctOption && (
                      <p className="text-sm text-success">
                        <span className="font-bold">Correct answer:</span> {correctOption.answer_text}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <Button variant="outline" className="w-full h-11 rounded-xl font-bold" onClick={backToHistory}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to past tests
        </Button>
      </div>
    </Layout>
  );
}
