import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { StudyControl, InsertStudyControl, ControlDiagram } from "@shared/schema";
import { studyControlSchema } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import QuestionLinkPicker from "./question-link-picker";

const emptyDefaults: InsertStudyControl = {
  diagram_id: 0,
  component_number: null,
  component_name: "",
  function_notes: "",
  applicable_codes: [],
  is_verified_exam_question: false,
  is_reviewed: false,
};

export default function ControlForm({
  open,
  onClose,
  control,
}: {
  open: boolean;
  onClose: () => void;
  control: StudyControl | null;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [pendingQuestionIds, setPendingQuestionIds] = useState<number[]>([]);
  const [questionSearch, setQuestionSearch] = useState("");

  const { data: diagrams = [] } = useQuery<ControlDiagram[]>({ queryKey: ["/api/control-diagrams"] });

  const form = useForm<InsertStudyControl>({
    resolver: zodResolver(studyControlSchema.omit({ id: true })),
    defaultValues: emptyDefaults,
  });

  useEffect(() => {
    if (open) {
      const { id, ...rest } = (control || emptyDefaults) as any;
      form.reset({
        ...emptyDefaults,
        ...rest,
        diagram_id: rest.diagram_id ?? 0,
        component_number: rest.component_number ?? null,
      });
      setPendingQuestionIds([]);
      setQuestionSearch("");
    }
  }, [open, control, form]);

  const saveMutation = useMutation({
    mutationFn: async (data: InsertStudyControl) => {
      let id = control?.id;
      if (id) {
        await apiRequest("PATCH", `/api/controls/${id}`, data);
      } else {
        const res = await apiRequest("POST", "/api/controls", data);
        const created = (await res.json()) as StudyControl;
        id = created.id;
      }
      for (const qid of pendingQuestionIds) {
        await apiRequest("POST", `/api/controls/${id}/questions`, { question_id: qid });
      }
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/controls"] });
      toast({ title: control?.id ? "Control updated" : "Control created" });
      onClose();
    },
    onError: (e: Error) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const diagramId = form.watch("diagram_id");

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{control ? "Edit control" : "New control"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => saveMutation.mutate(d))} className="space-y-4">
            <FormField
              control={form.control}
              name="diagram_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Diagram</FormLabel>
                  <Select value={String(field.value || 0)} onValueChange={(v) => field.onChange(parseInt(v, 10))}>
                    <FormControl>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Select diagram" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="0">Select…</SelectItem>
                      {diagrams.map((d) => (
                        <SelectItem key={d.id} value={String(d.id)}>
                          {d.label} {d.is_inferred ? "(inferred)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="component_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Component number (blank = recognition-only)</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        value={field.value === null || field.value === undefined ? "" : String(field.value)}
                        onChange={(e) => field.onChange(e.target.value === "" ? null : parseInt(e.target.value, 10))}
                        className="h-11"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="component_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Component name</FormLabel>
                    <FormControl>
                      <Input {...field} className="h-11" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="function_notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Function notes</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex flex-wrap gap-6">
              <FormField
                control={form.control}
                name="is_verified_exam_question"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="!mt-0">Verified exam question</FormLabel>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="is_reviewed"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="!mt-0">Human-reviewed</FormLabel>
                  </FormItem>
                )}
              />
            </div>
            <QuestionLinkPicker
              basePath="/api/controls"
              parentId={control?.id}
              pendingIds={pendingQuestionIds}
              onPendingChange={setPendingQuestionIds}
              questionSearch={questionSearch}
              onQuestionSearchChange={setQuestionSearch}
            />
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={onClose} className="flex-1 h-11">
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending || !diagramId} className="flex-1 h-11 brand-gradient border-none font-bold">
                {saveMutation.isPending ? "Saving…" : control?.id ? "Save changes" : "Create control"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
