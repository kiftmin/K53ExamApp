import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Question } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { FormLabel } from "@/components/ui/form";
import { Link2, Unlink } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

/**
 * Searchable many-to-many question-bank picker, generic over any
 * {parent}/questions join (signs or rules). Mirrors the block first
 * built into sign-form.tsx.
 *
 * - `basePath`: e.g. "/api/signs" or "/api/rules"
 * - `parentId`: linked-entity id; undefined for unsaved (new) records —
 *   selections are then queued in `pendingIds` and written on save.
 */
export default function QuestionLinkPicker({
  basePath,
  parentId,
  pendingIds,
  onPendingChange,
  questionSearch,
  onQuestionSearchChange,
}: {
  basePath: string;
  parentId?: number;
  pendingIds: number[];
  onPendingChange: (ids: number[]) => void;
  questionSearch: string;
  onQuestionSearchChange: (q: string) => void;
}) {
  const { toast } = useToast();

  const { data: allQuestions = [] } = useQuery<Question[]>({
    queryKey: ["/api/questions"],
  });

  const { data: linkedQuestions = [], refetch: refetchLinked } = useQuery<Question[]>({
    queryKey: [`${basePath}/${parentId}/questions`],
    enabled: !!parentId,
  });

  const questionMatches = useMemo(() => {
    const q = questionSearch.trim().toLowerCase();
    if (!q) return [];
    const linkedIds = new Set([...linkedQuestions.map((x) => x.id), ...pendingIds]);
    return allQuestions
      .filter((x) => !linkedIds.has(x.id))
      .filter((x) => x.question_text.toLowerCase().includes(q) || String(x.question_number).includes(q))
      .slice(0, 8);
  }, [questionSearch, allQuestions, linkedQuestions, pendingIds]);

  const pendingQuestions = useMemo(
    () => allQuestions.filter((x) => pendingIds.includes(x.id)),
    [allQuestions, pendingIds]
  );

  const linkNow = async (questionId: number) => {
    if (!parentId) {
      onPendingChange(pendingIds.includes(questionId) ? pendingIds : [...pendingIds, questionId]);
      return;
    }
    try {
      await apiRequest("POST", `${basePath}/${parentId}/questions`, { question_id: questionId });
      refetchLinked();
    } catch (e: any) {
      toast({ title: "Link failed", description: e.message, variant: "destructive" });
    }
  };

  const unlinkNow = async (questionId: number) => {
    if (!parentId) {
      onPendingChange(pendingIds.filter((x) => x !== questionId));
      return;
    }
    try {
      await apiRequest("DELETE", `${basePath}/${parentId}/questions/${questionId}`);
      refetchLinked();
    } catch (e: any) {
      toast({ title: "Unlink failed", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-2 border-t border-border pt-3">
      <FormLabel className="flex items-center gap-1.5">
        <Link2 className="h-3.5 w-3.5" /> Linked questions ({linkedQuestions.length + pendingQuestions.length})
      </FormLabel>
      <Input
        value={questionSearch}
        onChange={(e) => onQuestionSearchChange(e.target.value)}
        placeholder="Search question bank to link…"
        className="h-10"
      />
      {questionMatches.length > 0 && (
        <div className="border border-border rounded-xl divide-y max-h-40 overflow-y-auto">
          {questionMatches.map((q) => (
            <button
              key={q.id}
              type="button"
              onClick={() => linkNow(q.id)}
              className="w-full text-left px-3 py-2 text-xs hover:bg-accent"
            >
              <span className="font-mono font-bold mr-2">Q{q.question_number}</span>
              <span className="text-muted-foreground line-clamp-1">{q.question_text}</span>
            </button>
          ))}
        </div>
      )}
      {[...linkedQuestions, ...pendingQuestions.filter((p) => !linkedQuestions.some((l) => l.id === p.id))].map((q) => (
        <div key={q.id} className="flex items-center gap-2 text-xs bg-muted/60 rounded-lg px-3 py-2">
          <span className="font-mono font-bold">Q{q.question_number}</span>
          <span className="flex-1 line-clamp-1 text-muted-foreground">{q.question_text}</span>
          <button type="button" onClick={() => unlinkNow(q.id)} className="hover:text-destructive" aria-label="Unlink">
            <Unlink className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
