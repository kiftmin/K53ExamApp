import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Question, StudySign, InsertStudySign } from "@shared/schema";
import { studySignSchema } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { ImagePlus, Link2, Unlink, X, Trash2 } from "lucide-react";

interface PendingImage {
  code: string;
  filename: string;
  dataUrl?: string; // fresh upload (queued until save for new signs)
  stagedFilename?: string; // staged import, paired at save for new signs
}

interface StagedList {
  staged: { filename: string; slug: string; url: string; size: number }[];
}

// Filename without extension — becomes the sign code for added images
function baseOf(filename: string): string {
  return filename.replace(/\.[^.]+$/, "");
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

interface SignFormProps {
  open: boolean;
  onClose: () => void;
  sign: StudySign | null; // null = create
}

const emptyDefaults: InsertStudySign = {
  heading: "",
  subheading: "",
  name: "",
  codes: [],
  images: [],
  where_text: "",
  purpose_text: "",
  action_text: "",
  is_verified_exam_question: false,
};

export default function SignForm({ open, onClose, sign }: SignFormProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [codeInput, setCodeInput] = useState("");
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  // Saved image mappings flagged for removal (persisted via PATCH on save)
  const [removedCodes, setRemovedCodes] = useState<string[]>([]);
  // Images attached during this session (immediate for existing signs)
  const [addedImages, setAddedImages] = useState<{ code: string; image_url: string }[]>([]);
  // "Add image" block: multi-select staged picks (click / Ctrl-click / Shift-range)
  // plus multi-file uploads. Each file brings its own filename-derived code.
  const [addUploads, setAddUploads] = useState<{ filename: string; dataUrl: string }[]>([]);
  const [stagedSel, setStagedSel] = useState<string[]>([]);
  const stagedAnchor = useRef<number | null>(null);
  // Editable code override — only when exactly one image is selected
  const [addCodeInput, setAddCodeInput] = useState("");
  const [addSearch, setAddSearch] = useState("");
  const [pendingQuestionIds, setPendingQuestionIds] = useState<number[]>([]);
  const [questionSearch, setQuestionSearch] = useState("");

  const form = useForm<InsertStudySign>({
    resolver: zodResolver(studySignSchema.omit({ id: true })),
    defaultValues: emptyDefaults,
  });
  const codes = form.watch("codes") || [];

  useEffect(() => {
    if (open) {
      const { id, ...rest } = (sign || emptyDefaults) as any;
      form.reset({
        ...emptyDefaults,
        ...rest,
        images: rest.images || [],
        codes: rest.codes || [],
      });
      setCodeInput("");
      setPendingImages([]);
      setRemovedCodes([]);
      setAddedImages([]);
      setAddUploads([]);
      setStagedSel([]);
      stagedAnchor.current = null;
      setAddCodeInput("");
      setAddSearch("");
      setPendingQuestionIds([]);
      setQuestionSearch("");
    }
  }, [open, sign, form]);

  const { data: allQuestions = [] } = useQuery<Question[]>({
    queryKey: ["/api/questions"],
    enabled: open,
  });

  const { data: linkedQuestions = [], refetch: refetchLinked } = useQuery<Question[]>({
    queryKey: [`/api/signs/${sign?.id}/questions`],
    enabled: open && !!sign?.id,
  });

  // Unmatched imports available for the "add image" picker
  const { data: stagedData } = useQuery<StagedList>({
    queryKey: ["/api/signs/unmatched-images"],
    enabled: open,
  });
  const stagedOptions = useMemo(() => {
    const q = addSearch.trim().toLowerCase();
    const all = stagedData?.staged || [];
    return (q ? all.filter((s) => s.filename.toLowerCase().includes(q)) : all).slice(0, 60);
  }, [stagedData, addSearch]);

  const questionMatches = useMemo(() => {
    const q = questionSearch.trim().toLowerCase();
    if (!q) return [];
    const linkedIds = new Set([...linkedQuestions.map((x) => x.id), ...pendingQuestionIds]);
    return allQuestions
      .filter((x) => !linkedIds.has(x.id))
      .filter((x) => x.question_text.toLowerCase().includes(q) || String(x.question_number).includes(q))
      .slice(0, 8);
  }, [questionSearch, allQuestions, linkedQuestions, pendingQuestionIds]);

  const pendingQuestions = useMemo(
    () => allQuestions.filter((x) => pendingQuestionIds.includes(x.id)),
    [allQuestions, pendingQuestionIds]
  );

  const addCode = () => {
    const c = codeInput.trim();
    if (!c) return;
    if (codes.includes(c)) {
      setCodeInput("");
      return;
    }
    form.setValue("codes", [...codes, c], { shouldValidate: true });
    setCodeInput("");
    // Re-adding a code revives its (still saved) image mapping
    setRemovedCodes((prev) => prev.filter((x) => x !== c));
  };

  const removeCode = (c: string) => {
    form.setValue("codes", codes.filter((x) => x !== c), { shouldValidate: true });
    setPendingImages((prev) => prev.filter((p) => p.code !== c));
    // A removed code must not keep a stale image mapping on save
    if ((sign?.images || []).some((i) => i.code === c)) {
      setRemovedCodes((prev) => (prev.includes(c) ? prev : [...prev, c]));
    }
  };

  // Detach the image from a code immediately (file stays on disk).
  // The code keeps its empty slot, so the sign resurfaces in the
  // reconcile needs list even if the dialog is closed without saving.
  // (The save-time strip below stays as a safety net for code removals.)
  const removeImage = async (code: string) => {
    setPendingImages((prev) => prev.filter((p) => p.code !== code));
    setAddedImages((prev) => prev.filter((i) => i.code !== code));
    if (!sign?.id || !(sign.images || []).some((i) => i.code === code)) return;
    if (removedCodes.includes(code)) return;
    try {
      await apiRequest("DELETE", `/api/signs/${sign.id}/images/${encodeURIComponent(code)}`);
      setRemovedCodes((prev) => [...prev, code]);
      toast({ title: `Image removed from ${code}` });
      queryClient.invalidateQueries({ queryKey: ["/api/signs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/signs/unmatched-images"] });
    } catch (e: any) {
      toast({ title: "Remove failed", description: e.message, variant: "destructive" });
    }
  };

  const handleImageFile = async (code: string, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const dataUrl = await readAsDataUrl(file);
      setPendingImages((prev) => [...prev.filter((p) => p.code !== code), { code, filename: file.name, dataUrl }]);
    } catch {
      toast({ title: "Could not read file", variant: "destructive" });
    }
  };

  const imageFor = (code: string): string | undefined => {
    const pending = pendingImages.find((p) => p.code === code);
    if (pending?.dataUrl) return pending.dataUrl;
    const added = addedImages.find((i) => i.code === code);
    if (added && !removedCodes.includes(code)) return added.image_url;
    if (removedCodes.includes(code)) return undefined;
    return (sign?.images || []).find((i) => i.code === code)?.image_url;
  };

  const pickAddUploads = async (e: ChangeEvent<HTMLInputElement>) => {
    const files: File[] = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    try {
      const fresh = await Promise.all(
        files.map(async (f) => ({ filename: f.name, dataUrl: await readAsDataUrl(f) }))
      );
      setAddUploads((prev) => {
        const names = new Set(fresh.map((f) => f.filename));
        return [...prev.filter((p) => !names.has(p.filename)), ...fresh];
      });
    } catch {
      toast({ title: "Could not read files", variant: "destructive" });
    }
  };

  const removeAddUpload = (filename: string) => {
    setAddUploads((prev) => prev.filter((u) => u.filename !== filename));
  };

  // Staged-grid selection: plain click = single, Ctrl/Cmd-click = toggle,
  // Shift-click = range from anchor (same model as the question bank table)
  const clickStaged = (modifiers: { shift: boolean; multi: boolean }, index: number, filename: string) => {
    if (modifiers.shift && stagedAnchor.current !== null) {
      const [a, b] = [stagedAnchor.current, index].sort((x, y) => x - y);
      const range = stagedOptions.slice(a, b + 1).map((s) => s.filename);
      setStagedSel((prev) => Array.from(new Set([...prev, ...range])));
    } else if (modifiers.multi) {
      stagedAnchor.current = index;
      setStagedSel((prev) => (prev.includes(filename) ? prev.filter((f) => f !== filename) : [...prev, filename]));
    } else {
      stagedAnchor.current = index;
      setStagedSel((prev) => (prev.length === 1 && prev[0] === filename ? [] : [filename]));
    }
  };

  const addTotal = addUploads.length + stagedSel.length;
  const singleAddFile = addTotal === 1 ? addUploads[0]?.filename ?? stagedSel[0] ?? null : null;

  // Keep the editable code in sync while exactly one image is selected
  const lastSingleKey = useRef<string | null>(null);
  useEffect(() => {
    if (singleAddFile && singleAddFile !== lastSingleKey.current) {
      lastSingleKey.current = singleAddFile;
      setAddCodeInput(baseOf(singleAddFile));
    }
    if (!singleAddFile) lastSingleKey.current = null;
  }, [singleAddFile]);

  // Attach all selected images, each under its own filename-derived code
  // (or the edited code when exactly one is selected).
  // Existing signs: immediate, like unlink/remove. New signs: queued for save.
  const attachNewImages = async () => {
    const items = [
      ...addUploads.map((u) => ({ filename: u.filename, dataUrl: u.dataUrl as string | undefined, stagedFilename: undefined as string | undefined })),
      ...stagedSel.map((f) => ({ filename: f, dataUrl: undefined as string | undefined, stagedFilename: f })),
    ];
    if (items.length === 0) return;
    const overrideCode = items.length === 1 ? addCodeInput.trim() : "";
    const seen = new Set(codes);
    const doneCodes: string[] = [];
    let failed = 0;
    for (const item of items) {
      const code = overrideCode || baseOf(item.filename);
      if (!code || seen.has(code)) continue;
      seen.add(code);
      if (!sign?.id) {
        setPendingImages((prev) => [
          ...prev,
          item.stagedFilename
            ? { code, filename: item.filename, stagedFilename: item.stagedFilename }
            : { code, filename: item.filename, dataUrl: item.dataUrl! },
        ]);
        doneCodes.push(code);
        continue;
      }
      try {
        const res = await apiRequest(
          "POST",
          `/api/signs/${sign.id}/images`,
          item.stagedFilename
            ? { code, stagedFilename: item.stagedFilename, addCodeAsNew: true }
            : { code, filename: item.filename, dataUrl: item.dataUrl, addCodeAsNew: true }
        );
        const updated = (await res.json()) as StudySign;
        const mapping = (updated.images || []).find((i) => i.code === code);
        if (mapping) setAddedImages((prev) => [...prev.filter((i) => i.code !== code), mapping]);
        doneCodes.push(code);
      } catch {
        failed++;
      }
    }
    const skipped = items.length - doneCodes.length - failed;
    if (doneCodes.length > 0) {
      form.setValue("codes", [...codes, ...doneCodes], { shouldValidate: true });
      queryClient.invalidateQueries({ queryKey: ["/api/signs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/signs/unmatched-images"] });
    }
    setAddUploads([]);
    setStagedSel([]);
    stagedAnchor.current = null;
    setAddCodeInput("");
    toast({
      title: sign?.id
        ? `Attached ${doneCodes.length} image${doneCodes.length === 1 ? "" : "s"}`
        : `Queued ${doneCodes.length} image${doneCodes.length === 1 ? "" : "s"} for save`,
      description: [
        failed > 0 ? `${failed} failed` : "",
        skipped > 0 ? `${skipped} already on record` : "",
      ].filter(Boolean).join(" · ") || undefined,
    });
  };

  const linkNow = async (questionId: number) => {
    if (!sign?.id) {
      setPendingQuestionIds((prev) => (prev.includes(questionId) ? prev : [...prev, questionId]));
      return;
    }
    try {
      await apiRequest("POST", `/api/signs/${sign.id}/questions`, { question_id: questionId });
      refetchLinked();
      queryClient.invalidateQueries({ queryKey: [`/api/signs/${sign.id}/questions`] });
    } catch (e: any) {
      toast({ title: "Link failed", description: e.message, variant: "destructive" });
    }
  };

  const unlinkNow = async (questionId: number) => {
    if (!sign?.id) {
      setPendingQuestionIds((prev) => prev.filter((x) => x !== questionId));
      return;
    }
    try {
      await apiRequest("DELETE", `/api/signs/${sign.id}/questions/${questionId}`);
      refetchLinked();
      queryClient.invalidateQueries({ queryKey: [`/api/signs/${sign.id}/questions`] });
    } catch (e: any) {
      toast({ title: "Unlink failed", description: e.message, variant: "destructive" });
    }
  };

  const saveMutation = useMutation({
    mutationFn: async (data: InsertStudySign) => {
      let id = sign?.id;
      // Strip image mappings the user removed; keep ones attached this session
      // (PATCH would otherwise wipe just-attached mappings with stale form data)
      const kept = (data.images || []).filter((i) => !removedCodes.includes(i.code));
      const sessionAdded = addedImages.filter(
        (i) => !removedCodes.includes(i.code) && !kept.some((k) => k.code === i.code)
      );
      const images = [...kept, ...sessionAdded];
      if (id) {
        await apiRequest("PATCH", `/api/signs/${id}`, { ...data, images });
      } else {
        const res = await apiRequest("POST", "/api/signs", data);
        const created = (await res.json()) as StudySign;
        id = created.id;
      }
      for (const p of pendingImages) {
        await apiRequest(
          "POST",
          `/api/signs/${id}/images`,
          p.stagedFilename
            ? { code: p.code, stagedFilename: p.stagedFilename }
            : { code: p.code, filename: p.filename, dataUrl: p.dataUrl }
        );
      }
      for (const qid of pendingQuestionIds) {
        await apiRequest("POST", `/api/signs/${id}/questions`, { question_id: qid });
      }
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/signs"] });
      // Image add/remove changes code coverage → refresh the reconcile lists too
      queryClient.invalidateQueries({ queryKey: ["/api/signs/unmatched-images"] });
      toast({ title: sign?.id ? "Sign updated" : "Sign created" });
      onClose();
    },
    onError: (e: Error) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{sign ? "Edit sign" : "New sign"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => saveMutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="heading"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Heading</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g. Regulatory signs" className="h-11" />
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
                      <Input {...field} placeholder="e.g. Control signs" className="h-11" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g. Stop sign" className="h-11" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <FormLabel>Codes</FormLabel>
              <div className="flex gap-2">
                <Input
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCode();
                    }
                  }}
                  placeholder="e.g. R1 — press Enter to add"
                  className="h-11 font-mono"
                />
                <Button type="button" variant="outline" onClick={addCode} className="h-11">
                  Add
                </Button>
              </div>
              {form.formState.errors.codes && (
                <p className="text-xs text-destructive">At least one code is required.</p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {codes.map((c) => (
                  <Badge key={c} variant="secondary" className="font-mono pr-1 py-1">
                    {c}
                    <button type="button" onClick={() => removeCode(c)} className="ml-1 hover:text-destructive" aria-label={`Remove ${c}`}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            {codes.length > 0 && (
              <div className="space-y-2">
                <FormLabel>Images (one per code)</FormLabel>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {codes.map((c) => {
                    const src = imageFor(c);
                    return (
                      <div key={c} className="border border-border rounded-xl overflow-hidden">
                        <div className="aspect-[4/3] bg-muted flex items-center justify-center overflow-hidden relative">
                          {src ? (
                            <>
                              <img src={src} alt={c} className="h-full w-full object-contain bg-white" />
                              <button
                                type="button"
                                title={`Remove image from ${c} (file kept on disk)`}
                                onClick={() => removeImage(c)}
                                className="absolute top-1 right-1 p-1.5 rounded-lg bg-background/90 border border-border text-muted-foreground hover:text-destructive shadow-sm"
                                aria-label={`Remove image from ${c}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          ) : (
                            <span className="text-[11px] text-muted-foreground font-mono">{c}</span>
                          )}
                        </div>
                        <label className="flex items-center justify-center gap-1 text-[11px] font-bold py-2 cursor-pointer hover:bg-accent">
                          <ImagePlus className="h-3.5 w-3.5" />
                          {src ? "Replace" : "Upload"}
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageFile(c, e)} />
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <FormLabel>
                Add images <span className="font-normal text-muted-foreground">— each filename becomes a new sign code{addTotal > 0 ? ` · ${addTotal} selected` : ""}</span>
              </FormLabel>
              <div className="flex gap-2">
                <label className="flex-1 flex items-center justify-center gap-1 text-xs font-bold h-10 px-3 rounded-xl border border-border cursor-pointer hover:bg-accent">
                  <ImagePlus className="h-4 w-4" />
                  Upload files
                  <input type="file" accept="image/*" multiple className="hidden" onChange={pickAddUploads} />
                </label>
                {singleAddFile ? (
                  <Input
                    value={addCodeInput}
                    onChange={(e) => setAddCodeInput(e.target.value)}
                    placeholder="Code from filename…"
                    className="flex-1 h-10 font-mono text-sm"
                  />
                ) : (
                  <div className="flex-1 flex items-center px-3 h-10 rounded-xl bg-muted/60 text-[11px] text-muted-foreground font-semibold">
                    {addTotal > 1 ? "Each file keeps its own filename as code" : "Code comes from the filename"}
                  </div>
                )}
                <Button
                  type="button"
                  onClick={attachNewImages}
                  disabled={addTotal === 0 || (singleAddFile !== null && !addCodeInput.trim())}
                  className="h-10 rounded-xl font-bold disabled:opacity-50"
                >
                  Attach{addTotal > 0 ? ` (${addTotal})` : ""}
                </Button>
              </div>
              {addUploads.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {addUploads.map((u) => (
                    <span key={u.filename} className="inline-flex items-center gap-1 text-[11px] font-mono bg-muted rounded-md pl-2 pr-1 py-1">
                      {u.filename}
                      <button type="button" onClick={() => removeAddUpload(u.filename)} className="hover:text-destructive" aria-label={`Remove ${u.filename}`}>
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
                  {(stagedData?.staged?.length || 0) > 0 && (
                    <div className="space-y-2 pt-1">
                      <Input
                        value={addSearch}
                        onChange={(e) => setAddSearch(e.target.value)}
                        placeholder="Search unmatched imports…"
                        className="h-9 text-xs font-mono"
                      />
                      <div className="grid grid-cols-4 md:grid-cols-6 gap-1.5 max-h-40 overflow-y-auto">
                        {stagedOptions.map((s, idx) => {
                          const active = stagedSel.includes(s.filename);
                          return (
                            <button
                              key={s.filename}
                              type="button"
                              title={`${s.filename} — click, Ctrl-click to toggle, Shift-click for range`}
                              onClick={(e) => clickStaged({ shift: e.shiftKey, multi: e.ctrlKey || e.metaKey }, idx, s.filename)}
                              className={cn(
                                "aspect-square rounded-lg overflow-hidden border-2 bg-white",
                                active ? "border-primary ring-2 ring-primary/30" : "border-border"
                              )}
                            >
                              <img src={s.url} alt={s.filename} className="h-full w-full object-contain" loading="lazy" />
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {(stagedData?.staged?.length || 0) > 60
                          ? `Showing first 60 of ${stagedData?.staged?.length} — search to narrow.`
                          : "Click to select · Ctrl-click to toggle · Shift-click for a range."}
                      </p>
                    </div>
                  )}
            </div>

            <div className="grid grid-cols-1 gap-3">
              {(["where_text", "purpose_text", "action_text"] as const).map((key) => (
                <FormField
                  key={key}
                  control={form.control}
                  name={key}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="capitalize">{key.replace("_text", "")}</FormLabel>
                      <FormControl>
                        <Textarea {...field} value={field.value || ""} rows={2} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </div>

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

            <div className="space-y-2 border-t border-border pt-3">
              <FormLabel className="flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5" /> Linked questions ({linkedQuestions.length + pendingQuestions.length})
              </FormLabel>
              <Input
                value={questionSearch}
                onChange={(e) => setQuestionSearch(e.target.value)}
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

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={onClose} className="flex-1 h-11">
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending} className="flex-1 h-11 brand-gradient border-none font-bold">
                {saveMutation.isPending ? "Saving…" : sign ? "Save changes" : "Create sign"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
