import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { StudyControl, ControlDiagram, Question } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { BadgeCheck, Check, Pencil, AlertTriangle, Shuffle, MousePointerClick } from "lucide-react";
import ControlForm from "./control-form";

type Flag = "hmv_a_inferred" | "lmv_ambiguous" | "generated_distractors";

export default function ControlReviewPanel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [flag, setFlag] = useState<Flag | "all">("all");
  const [editing, setEditing] = useState<StudyControl | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const { data: unreviewedControls = [], isLoading: lc } = useQuery<StudyControl[]>({
    queryKey: ["/api/controls?unreviewed=true"],
    queryFn: async () => {
      const r = await fetch("/api/controls?unreviewed=true");
      if (!r.ok) throw new Error(`${r.status}`);
      return r.json();
    },
  });
  const { data: diagrams = [] } = useQuery<ControlDiagram[]>({ queryKey: ["/api/control-diagrams"] });
  const { data: allQuestions = [], isLoading: lq } = useQuery<Question[]>({
    queryKey: ["/api/questions"],
    queryFn: async () => {
      const r = await fetch("/api/questions");
      if (!r.ok) throw new Error(`${r.status}`);
      return r.json();
    },
  });

  const unreviewedSampleQs = useMemo(
    () => allQuestions.filter((q) => q.category === 3 && !q.is_reviewed),
    [allQuestions]
  );

  const inferredIds = useMemo(
    () => new Set(diagrams.filter((d) => d.is_inferred).map((d) => d.id)),
    [diagrams]
  );

  const flagged = useMemo(() => {
    const controlRows = flag === "hmv_a_inferred"
      ? unreviewedControls.filter((c) => inferredIds.has(c.diagram_id))
      : flag === "lmv_ambiguous" || flag === "generated_distractors"
        ? []
        : unreviewedControls;

    const questionRows = flag === "hmv_a_inferred"
      ? []
      : unreviewedSampleQs;

    return { controlRows, questionRows };
  }, [flag, unreviewedControls, unreviewedSampleQs, inferredIds]);

  const approveControl = useMutation({
    mutationFn: async (id: number) => { await apiRequest("PATCH", `/api/controls/${id}`, { is_reviewed: true }); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/controls"] }); queryClient.invalidateQueries({ queryKey: ["/api/controls?unreviewed=true"] }); toast({ title: "Marked reviewed" }); },
  });
  const approveQuestion = useMutation({
    mutationFn: async (id: number) => { await apiRequest("PATCH", `/api/questions/${id}`, { is_reviewed: true }); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/questions"] }); toast({ title: "Marked reviewed" }); },
  });

  const lmvCount = useMemo(() => unreviewedSampleQs.filter((q) => q.license_code === "2").length, [unreviewedSampleQs]);
  const hmvCount = useMemo(() => unreviewedControls.filter((c) => inferredIds.has(c.diagram_id)).length, [unreviewedControls, inferredIds]);

  if (lc || lq) return <p className="text-sm text-muted-foreground py-8 text-center">Loading review queue…</p>;

  const total = unreviewedControls.length + unreviewedSampleQs.length;
  if (total === 0) {
    return (
      <div className="glass-card rounded-2xl p-10 text-center space-y-2">
        <BadgeCheck className="h-8 w-8 text-green-600 mx-auto" />
        <p className="font-bold">All controls reviewed</p>
        <p className="text-sm text-muted-foreground">Import bundle items appear here for approval.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Prominent flag callouts */}
      <div className="glass-card rounded-2xl p-4 border-l-4 border-amber-400 space-y-2">
        <p className="text-[11px] font-black uppercase tracking-widest text-amber-700">Review flags from the import notes</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFlag(flag === "hmv_a_inferred" ? "all" : "hmv_a_inferred")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${flag === "hmv_a_inferred" ? "bg-amber-500 text-white border-amber-500" : "border-amber-300 text-amber-800 bg-amber-50"}`}
          >
            <AlertTriangle className="h-3.5 w-3.5" /> HMV-auto inferred ({hmvCount})
          </button>
          <button
            onClick={() => setFlag(flag === "lmv_ambiguous" ? "all" : "lmv_ambiguous")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${flag === "lmv_ambiguous" ? "bg-blue-500 text-white border-blue-500" : "border-blue-300 text-blue-800 bg-blue-50"}`}
          >
            <Shuffle className="h-3.5 w-3.5" /> LMV manual/auto ambiguity ({lmvCount})
          </button>
          <button
            onClick={() => setFlag(flag === "generated_distractors" ? "all" : "generated_distractors")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${flag === "generated_distractors" ? "bg-red-500 text-white border-red-500" : "border-red-300 text-red-800 bg-red-50"}`}
          >
            <MousePointerClick className="h-3.5 w-3.5" /> Generated distractors ({unreviewedSampleQs.length})
          </button>
          {flag !== "all" && (
            <button onClick={() => setFlag("all")} className="px-3 py-1.5 text-xs font-semibold text-muted-foreground">Show all</button>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          {flag === "hmv_a_inferred" && "Every HMV-automatic component was inferred from the LMV-automatic table — verify names/numbers against the manual before publishing."}
          {flag === "lmv_ambiguous" && "LMV sample questions were imported as manual unless explicitly marked; consider whether they should also apply to automatic."}
          {flag === "generated_distractors" && "All distractor options in these sample questions were machine-generated and have not been checked against real K53 exam distractors."}
          {flag === "all" && "Use the chips to isolate one flag category. Nothing auto-publishes."}
        </p>
      </div>

      {/* Controls needing review */}
      {flagged.controlRows.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground px-1">Components ({flagged.controlRows.length})</p>
          {flagged.controlRows.map((c) => (
            <div key={c.id} className="rounded-2xl border border-border bg-card p-3 flex items-center justify-between gap-2">
              <div className="flex items-start gap-2 flex-1">
                <span className="w-6 h-6 rounded-md bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">{c.component_number ?? "?"}</span>
                <div>
                  <p className="text-sm font-semibold">{c.component_name}</p>
                  {c.function_notes && <p className="text-xs text-muted-foreground line-clamp-2">{c.function_notes}</p>}
                  {inferredIds.has(c.diagram_id) && (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">INFERRED hmv_a</span>
                  )}
                </div>
              </div>
              <div className="flex gap-1">
                <Button size="sm" className="h-8 text-xs brand-gradient border-none" onClick={() => approveControl.mutate(c.id)}><Check className="h-3.5 w-3.5 mr-1" /> Approve</Button>
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { setEditing(c); setFormOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sample questions needing review */}
      {flagged.questionRows.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground px-1">Sample questions ({flagged.questionRows.length})</p>
          {flagged.questionRows.slice(0, 50).map((q) => (
            <div key={q.id} className="rounded-2xl border border-border bg-card p-3 space-y-1">
              <p className="text-sm leading-snug">{q.question_text}</p>
              <div className="flex flex-wrap gap-1">
                <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded">license {q.license_code}</span>
                {q.is_reviewed === false && (
                  <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">unreviewed</span>
                )}
              </div>
              <ul className="text-xs text-muted-foreground space-y-0.5 pt-1">
                {Array.isArray(q.options) && q.options.map((o: any) => (
                  <li key={o.answer_number} className={o.correct_answer ? "text-green-700 font-semibold" : ""}>
                    {o.answer_number}. {o.answer_text}
                  </li>
                ))}
              </ul>
              <Button size="sm" className="h-8 text-xs brand-gradient border-none mt-1" onClick={() => approveQuestion.mutate(q.id)}><Check className="h-3.5 w-3.5 mr-1" /> Approve</Button>
            </div>
          ))}
          {flagged.questionRows.length > 50 && (
            <p className="text-xs text-muted-foreground text-center pt-1">Showing first 50 — approve some and the list shortens.</p>
          )}
        </div>
      )}

      <ControlForm open={formOpen} onClose={() => { setFormOpen(false); setEditing(null); }} control={editing} />
    </div>
  );
}
