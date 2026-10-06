import { useMemo, useState } from "react";
import type { StudyControl, ControlDiagram } from "@shared/schema";
import { Button } from "@/components/ui/button";
import ControlDiagramView from "@/components/control-diagram-view";
import { cn } from "@/lib/utils";

type Mode = "whatis" | "tap";

interface PracticeProps {
  controls: StudyControl[];
  diagrams: ControlDiagram[];
}

interface QuizState {
  target: StudyControl;
  variant: "name" | "function";
  options: string[];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function ControlsPractice({ controls, diagrams }: PracticeProps) {
  const [mode, setMode] = useState<Mode>("whatis");
  const [diagramId, setDiagramId] = useState<number | null>(null);
  const [quiz, setQuiz] = useState<QuizState | null>(null);
  const [answered, setAnswered] = useState<null | { correct: boolean }>(null);
  const [pickedOption, setPickedOption] = useState<string | null>(null);
  const [pickedId, setPickedId] = useState<number | null>(null);
  const [score, setScore] = useState({ good: 0, total: 0 });

  const diagram = useMemo(() => {
    const ds = diagrams.filter((d) => controls.some((c) => c.diagram_id === d.id && c.position_x != null));
    return ds.find((d) => d.id === diagramId) ?? ds[0];
  }, [diagrams, controls, diagramId]);

  const placed = useMemo(
    () => controls.filter((c) => c.diagram_id === diagram?.id && c.position_x != null && c.position_y != null),
    [controls, diagram]
  );

  const next = () => {
    if (placed.length < 2) return;
    const target = placed[Math.floor(Math.random() * placed.length)];
    const variant = Math.random() < 0.5 ? "name" : "function";
    const pool = placed.filter((c) => c.id !== target.id);
    const distractors = shuffle(pool).slice(0, Math.min(3, pool.length));
    const correct = variant === "name" ? target.component_name : (target.function_notes || target.component_name);
    const options = shuffle([correct, ...distractors.map((d) => (variant === "name" ? d.component_name : (d.function_notes || d.component_name)))]);
    setQuiz({ target, variant, options });
    setAnswered(null);
    setPickedId(null);
    setPickedOption(null);
  };

  const diagramUsable = diagram && placed.length >= 2;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 rounded-xl border border-border p-1 bg-muted/40">
        {([{ k: "whatis", label: "What is this?" }, { k: "tap", label: "Tap the control" }] as const).map(({ k, label }) => (
          <button
            key={k}
            onClick={() => { setMode(k); setQuiz(null); setAnswered(null); setPickedId(null); }}
            className={cn("h-9 rounded-lg text-xs font-bold", mode === k ? "bg-background shadow-sm text-foreground" : "text-muted-foreground")}
          >
            {label}
          </button>
        ))}
      </div>

      {diagrams.filter((d) => controls.some((c) => c.diagram_id === d.id && c.position_x != null)).length > 1 && (
        <select
          value={diagram?.id ?? ""}
          onChange={(e) => { setDiagramId(parseInt(e.target.value, 10)); setQuiz(null); }}
          className="h-10 rounded-xl border border-border bg-background/60 px-3 text-sm font-semibold"
        >
          {diagrams.filter((d) => controls.some((c) => c.diagram_id === d.id && c.position_x != null)).map((d) => (
            <option key={d.id} value={d.id}>{d.label}</option>
          ))}
        </select>
      )}

      {!diagramUsable ? (
        <div className="rounded-2xl border border-border p-8 text-center">
          <p className="font-bold">Diagram quiz not ready</p>
          <p className="text-sm text-muted-foreground">Markers haven't been placed on this diagram yet.</p>
        </div>
      ) : (
        <>
          {mode === "whatis" && !quiz && (
            <div className="text-center py-6">
              <Button onClick={next} className="brand-gradient border-none rounded-xl font-bold">Start practice</Button>
            </div>
          )}
          {mode === "whatis" && quiz && diagram && (
            <div className="space-y-3">
              <ControlDiagramView diagram={diagram} controls={placed} mode="preview" highlightControlId={quiz.target.id} />
              <p className="font-bold text-sm px-1">
                {quiz.variant === "name" ? `What is control ${quiz.target.component_number ?? "?"}?` : `What is control ${quiz.target.component_number ?? "?"} used for?`}
              </p>
              <div className="space-y-2">
                {quiz.options.map((opt, i) => {
                  const correct = quiz.variant === "name" ? quiz.target.component_name : (quiz.target.function_notes || quiz.target.component_name);
                  return (
                    <button
                      key={i}
                      disabled={!!answered}
                      onClick={() => {
                        const good = opt === correct;
                        setPickedOption(opt);
                        setAnswered({ correct: good });
                        setScore((s) => ({ good: s.good + (good ? 1 : 0), total: s.total + 1 }));
                      }}
                      className={cn(
                        "w-full text-left p-3 rounded-xl border-2 text-sm transition-colors",
                        !answered && "border-border hover:border-primary",
                        answered && opt === correct && "border-green-400 bg-green-50",
                        answered && opt === pickedOption && opt !== correct && "border-red-400 bg-red-50",
                      )}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {mode === "tap" && !quiz && (
            <div className="text-center py-6">
              <Button onClick={next} className="brand-gradient border-none rounded-xl font-bold">Start practice</Button>
            </div>
          )}
          {mode === "tap" && quiz && diagram && (
            <div className="space-y-3">
              <p className="font-bold text-sm px-1">Which control {quiz.variant === "name" ? `is “${quiz.target.component_name}”?` : `is used for: ${quiz.target.function_notes}`}</p>
              <ControlDiagramView
                diagram={diagram}
                controls={placed}
                mode="explore"
                onMarkerSelect={(c) => {
                  if (answered) return;
                  const good = c.id === quiz.target.id;
                  setPickedId(c.id);
                  setAnswered({ correct: good });
                  setScore((s) => ({ good: s.good + (good ? 1 : 0), total: s.total + 1 }));
                }}
              />
              {answered && (
                <div className="space-y-3">
                  <p className={cn("text-sm font-bold", answered.correct ? "text-green-700" : "text-red-600")}>
                    {answered.correct ? "Correct — that's " + quiz.target.component_name : `Not quite — that was control ${quiz.target.component_number ?? "?"} (${quiz.target.component_name})`}
                  </p>
                  <ControlDiagramView diagram={diagram} controls={placed} mode="preview" highlightControlId={quiz.target.id} />
                </div>
              )}
            </div>
          )}
          {answered && (
            <Button variant="outline" onClick={next} className="w-full h-11 rounded-xl font-bold">Next question</Button>
          )}
          <p className="text-xs text-muted-foreground text-center">Score: {score.good}/{score.total}</p>
        </>
      )}
    </div>
  );
}
