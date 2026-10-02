import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { StudyRule, InsertStudyRule } from "@shared/schema";
import { studyRuleSchema } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import QuestionLinkPicker from "./question-link-picker";

interface RuleFormProps {
  open: boolean;
  onClose: () => void;
  rule: StudyRule | null; // null = create
}

const emptyDefaults: InsertStudyRule = {
  section_ref: "",
  heading: "",
  subheading: "",
  title: "",
  body: "",
  applicable_codes: [0],
  is_verified_exam_question: false,
  is_reviewed: false,
};

const CODE_OPTIONS = [
  { value: 0, label: "Code-agnostic (all)" },
  { value: 1, label: "Motorcycle" },
  { value: 2, label: "Light Motor" },
  { value: 3, label: "Heavy Motor" },
];

export default function RuleForm({ open, onClose, rule }: RuleFormProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [pendingQuestionIds, setPendingQuestionIds] = useState<number[]>([]);
  const [questionSearch, setQuestionSearch] = useState("");

  const form = useForm<InsertStudyRule>({
    resolver: zodResolver(studyRuleSchema.omit({ id: true })),
    defaultValues: emptyDefaults,
  });
  const selectedCodes = form.watch("applicable_codes") || [];

  useEffect(() => {
    if (open) {
      const { id, ...rest } = (rule || emptyDefaults) as any;
      form.reset({ ...emptyDefaults, ...rest, applicable_codes: rest.applicable_codes || [0] });
      setPendingQuestionIds([]);
      setQuestionSearch("");
    }
  }, [open, rule, form]);

  const toggleCode = (code: number, checked: boolean) => {
    const current = form.getValues("applicable_codes") || [];
    const next = checked ? Array.from(new Set([...current, code])) : current.filter((c) => c !== code);
    if (next.length === 0) return; // keep at least one
    form.setValue("applicable_codes", next, { shouldValidate: true });
  };

  const saveMutation = useMutation({
    mutationFn: async (data: InsertStudyRule) => {
      let id = rule?.id;
      if (id) {
        await apiRequest("PATCH", `/api/rules/${id}`, data);
      } else {
        const res = await apiRequest("POST", "/api/rules", data);
        const created = (await res.json()) as StudyRule;
        id = created.id;
      }
      for (const qid of pendingQuestionIds) {
        await apiRequest("POST", `/api/rules/${id}/questions`, { question_id: qid });
      }
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rules"] });
      toast({ title: rule?.id ? "Rule updated" : "Rule created" });
      onClose();
    },
    onError: (e: Error) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{rule ? "Edit rule" : "New rule"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => saveMutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <FormField
                control={form.control}
                name="section_ref"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Section ref</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g. 6.17.1" className="h-11 font-mono" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="heading"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Heading</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g. Road Traffic Rules" className="h-11" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="subheading"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subheading</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g. Seatbelts" className="h-11" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title (optional short label)</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} placeholder="e.g. Seatbelt compulsion" className="h-11" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="body"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rule statement</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={4} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-1.5">
              <FormLabel>Applicable codes</FormLabel>
              <div className="flex flex-wrap gap-2">
                {CODE_OPTIONS.map((opt) => {
                  const checked = selectedCodes.includes(opt.value);
                  return (
                    <label
                      key={opt.value}
                      className={`flex items-center gap-1.5 px-3 h-9 rounded-lg border text-xs font-semibold cursor-pointer select-none ${
                        checked ? "border-primary bg-primary/5" : "border-border"
                      }`}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => toggleCode(opt.value, v === true)}
                      />
                      {opt.label}
                    </label>
                  );
                })}
              </div>
            </div>

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
              basePath="/api/rules"
              parentId={rule?.id}
              pendingIds={pendingQuestionIds}
              onPendingChange={setPendingQuestionIds}
              questionSearch={questionSearch}
              onQuestionSearchChange={setQuestionSearch}
            />

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={onClose} className="flex-1 h-11">
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending} className="flex-1 h-11 brand-gradient border-none font-bold">
                {saveMutation.isPending ? "Saving…" : rule ? "Save changes" : "Create rule"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
