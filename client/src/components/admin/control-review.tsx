import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { StudyControl, ControlDiagram, Question } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { BadgeCheck, Check, Pencil, MousePointerClick } from "lucide-react";
import ControlForm from "./control-form";
import ControlDiagramView from "@/components/control-diagram-view";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Image as ImageIcon } from "lucide-react";

function SampleQuestionDiagramButton({ questionId, diagrams }: { questionId: number; diagrams: ControlDiagram[] }) {
  const [open, setOpen] = useState(false);
  const { data: linked = [] } = useQuery<StudyControl[]>({
    queryKey: [`/api/questions/${questionId}/controls`],
    queryFn: async () => {
      const r = await fetch(`/api/questions/${questionId}/controls`);
      if (!r.ok) throw new Error(`${r.status}`);
      return r.json();
    },
  });
  if (linked.length === 0) return null;
  const diagram = diagrams.find((d) => d.id === linked[0].diagram_id);
  const placed = linked.filter((c) => c.position_x != null && c.position_y != null);
  const sameDiagram = linked.every((c) => c.diagram_id === linked[0].diagram_id);

  return (
    <>
      <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setOpen(true)}>
        <ImageIcon className="h-3.5 w-3.5 mr-1" /> View diagram
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Linked components</DialogTitle>
          </DialogHeader>
          {diagram && diagram.image_url && sameDiagram ? (
            <ControlDiagramView
              diagram={diagram}
              controls={linked}
              mode="preview"
              highlightControlIds={placed.map((c) => c.id)}
            />
          ) : (
            <p className="text-xs text-muted-foreground italic">No diagram image available for these components.</p>
          )}
          <ul className="space-y-1.5 text-sm">
            {linked.map((c) => (
              <li key={c.id}>
                <span className="font-bold">{c.component_number != null ? `${c.component_number}. ` : ""}{c.component_name}</span>
                {c.function_notes && <span className="text-muted-foreground"> — {c.function_notes}</span>}
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function ControlReviewPanel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
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

  const flagged = useMemo(() => {
    return { controlRows: unreviewedControls, questionRows: unreviewedSampleQs };
  }, [unreviewedControls, unreviewedSampleQs]);

  const approveControl = useMutation({
    mutationFn: async (id: number) => { await apiRequest("PATCH", `/api/controls/${id}`, { is_reviewed: true }); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/controls"] }); queryClient.invalidateQueries({ queryKey: ["/api/controls?unreviewed=true"] }); toast({ title: "Marked reviewed" }); },
  });
  const approveQuestion = useMutation({
    mutationFn: async (id: number) => { await apiRequest("PATCH", `/api/questions/${id}`, { is_reviewed: true }); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/questions"] }); toast({ title: "Marked reviewed" }); },
  });

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
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border border-red-300 text-red-800 bg-red-50">
            <MousePointerClick className="h-3.5 w-3.5" /> Generated distractors ({unreviewedSampleQs.length})
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          All distractor options in these sample questions were machine-generated and have not been checked against real K53 exam distractors.
        </p>
      </div>

      {/* Controls needing review */}
      {flagged.controlRows.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground px-1">Components ({flagged.controlRows.length})</p>
           {flagged.controlRows.map((c) => {
             const diag = diagrams.find((d) => d.id === c.diagram_id);
             return (
             <div key={c.id} className="rounded-2xl border border-border bg-card p-3 flex items-center justify-between gap-2">
               <div className="flex items-start gap-2 flex-1">
                 <span className="w-6 h-6 rounded-md bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">{c.component_number ?? "?"}</span>
                 <div>
                   <p className="text-sm font-semibold">{c.component_name}</p>
                   {c.function_notes && <p className="text-xs text-muted-foreground line-clamp-2">{c.function_notes}</p>}
                   {(c.position_x == null || c.position_y == null) && (
                     <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded ml-1">no position</span>
                   )}
                 </div>
               </div>
               {diag?.image_url && (
                 <div className="w-28 shrink-0">
                   <ControlDiagramView diagram={diag} controls={[c]} mode="preview" highlightControlId={c.id} />
                 </div>
               )}
               <div className="flex gap-1">
                 <Button size="sm" className="h-8 text-xs brand-gradient border-none" onClick={() => approveControl.mutate(c.id)}><Check className="h-3.5 w-3.5 mr-1" /> Approve</Button>
                 <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { setEditing(c); setFormOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
               </div>
             </div>
             );
           })}
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
              <div className="flex items-center gap-2 flex-wrap">
                <SampleQuestionDiagramButton questionId={q.id} diagrams={diagrams} />
                <Button size="sm" className="h-8 text-xs brand-gradient border-none" onClick={() => approveQuestion.mutate(q.id)}><Check className="h-3.5 w-3.5 mr-1" /> Approve</Button>
              </div>
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
