import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Question, StudySign } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { orderImages } from "@/lib/sign-codes";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  FileJson,
  ImageOff,
  Link2,
  Loader2,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";

type Confidence = "high" | "medium" | "low";

type PendingLink = {
  questionId: number;
  signId: number;
  confidence: Confidence;
  reason: string;
  source: string;
};

type StoredState = {
  pending: PendingLink[];
  rejected: PendingLink[];
  linked: string[];
};

type ImportReport = {
  files: number;
  added: number;
  duplicates: number;
  empty: number;
  badRows: number;
  mismatched: number;
  unknownQuestions: number[];
  notSignQuestions: number[];
  unknownSigns: number[];
  errors: string[];
};

const STORAGE_KEY = "k53-sign-link-suggestions-v1";
const GROUPS_PER_PAGE = 25;

const keyOf = (questionId: number, signId: number) => `${questionId}:${signId}`;

function asInt(value: unknown): number | null {
  if (typeof value === "number") return Number.isInteger(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isInteger(n) ? n : null;
  }
  return null;
}

function extractRows(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["suggestions", "links", "data", "results"]) {
      if (Array.isArray(record[key])) return record[key] as unknown[];
    }
  }
  return null;
}

function parseFile(text: string): unknown[] {
  const raw = text.replace(/^\uFEFF/, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const start = raw.indexOf("[");
    const end = raw.lastIndexOf("]");
    if (start === -1 || end <= start) throw new Error("No JSON array found in the file.");
    parsed = JSON.parse(raw.slice(start, end + 1));
  }
  const rows = extractRows(parsed);
  if (!rows) throw new Error("JSON must be an array of { question_id, sign_ids, confidence, reason }.");
  return rows;
}

function normalizeRow(row: unknown) {
  if (!row || typeof row !== "object" || Array.isArray(row)) return null;
  const record = row as Record<string, unknown>;
  const questionId = asInt(record.question_id);
  const rawIds = Array.isArray(record.sign_ids) ? record.sign_ids : [];
  const signIds = Array.from(
    new Set(rawIds.map(asInt).filter((value): value is number => value !== null))
  );
  const confidence: Confidence =
    record.confidence === "high" || record.confidence === "medium" || record.confidence === "low"
      ? record.confidence
      : "low";
  const reason = typeof record.reason === "string" ? record.reason.trim() : "";
  return { questionId, signIds, confidence, reason };
}

function codeFromImageLink(link: string | null | undefined): string | null {
  if (!link) return null;
  const match = link.match(/SADC_road_sign_([A-Za-z0-9.\-]+)\./i);
  return match ? match[1] : null;
}

function signHasCode(sign: StudySign, code: string): boolean {
  return (sign.codes || []).includes(code) || (sign.images || []).some((image) => image.code === code);
}

function normalizeCode(code: string): string {
  return code.replace(/[()\s]/g, "").toUpperCase();
}

function codeFamilyMatch(a: string, b: string): boolean {
  const left = normalizeCode(a);
  const right = normalizeCode(b);
  if (left === right) return true;
  return (
    left.startsWith(right + ".") ||
    right.startsWith(left + ".") ||
    left.startsWith(right + "-") ||
    right.startsWith(left + "-")
  );
}

function codesInReason(reason: string): string[] {
  if (!reason) return [];
  const cleaned = reason.replace(/\b(?:Cloudinary\s+)?filename\s+\S+/gi, " ");
  const matches = cleaned.match(/\b[A-Z]{1,3}\d{1,3}(?:[.\-]\d+)?\b/g) || [];
  return Array.from(new Set(matches));
}

function formatIds(ids: number[], max = 24): string {
  const shown = ids.slice(0, max).join(", ");
  return ids.length > max ? `${shown}, +${ids.length - max} more` : shown;
}

function confidenceClass(confidence: Confidence): string {
  if (confidence === "high") return "bg-green-100 text-green-700 border-green-200";
  if (confidence === "medium") return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-red-100 text-red-700 border-red-200";
}

export default function SignLinkReview() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [pending, setPending] = useState<PendingLink[]>([]);
  const [rejected, setRejected] = useState<PendingLink[]>([]);
  const [linked, setLinked] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [linkingKey, setLinkingKey] = useState<string | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [problemsOnly, setProblemsOnly] = useState(false);
  const [shownGroups, setShownGroups] = useState(GROUPS_PER_PAGE);

  const { data: signs = [], isLoading: signsLoading } = useQuery<StudySign[]>({
    queryKey: ["/api/signs"],
  });
  const { data: questions = [], isLoading: questionsLoading } = useQuery<Question[]>({
    queryKey: ["/api/questions"],
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const stored = JSON.parse(raw) as Partial<StoredState>;
        if (Array.isArray(stored.pending)) setPending(stored.pending);
        if (Array.isArray(stored.rejected)) setRejected(stored.rejected);
        if (Array.isArray(stored.linked)) setLinked(new Set(stored.linked));
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ pending, rejected, linked: Array.from(linked) })
      );
    } catch {
      // Storage may be full or disabled; the review still works for this session.
    }
  }, [pending, rejected, linked, loaded]);

  const signMap = useMemo(() => new Map(signs.map((sign) => [sign.id, sign])), [signs]);
  const questionMap = useMemo(
    () => new Map(questions.map((question) => [question.id, question])),
    [questions]
  );
  const signQuestionIds = useMemo(
    () => new Set(questions.filter((question) => question.category === 2).map((question) => question.id)),
    [questions]
  );

  const groups = useMemo(() => {
    const grouped = new Map<number, PendingLink[]>();
    for (const item of pending) {
      const question = questionMap.get(item.questionId);
      if (!question) continue;
      const list = grouped.get(item.questionId);
      if (list) list.push(item);
      else grouped.set(item.questionId, [item]);
    }
    return Array.from(grouped.entries())
      .map(([questionId, items]) => ({
        question: questionMap.get(questionId)!,
        items,
      }))
      .sort((a, b) => a.question.question_number - b.question.question_number);
  }, [pending, questionMap]);

  const groupCodeSet = (items: PendingLink[]): string[] => {
    const codes: string[] = [];
    for (const item of items) {
      const sign = signMap.get(item.signId);
      if (!sign) continue;
      codes.push(...(sign.codes || []));
      for (const image of sign.images || []) codes.push(image.code);
    }
    return codes;
  };

  const reasonMismatch = (item: PendingLink, codes: string[]): boolean => {
    const cited = codesInReason(item.reason);
    if (cited.length === 0) return false;
    return !cited.some((code) => codes.some((cardCode) => codeFamilyMatch(code, cardCode)));
  };

  const isProblem = (group: { question: Question; items: PendingLink[] }): boolean => {
    const codes = groupCodeSet(group.items);
    return group.items.some((item) => {
      if (item.confidence === "low") return true;
      const sign = signMap.get(item.signId);
      if (!sign) return true;
      const imageCode = codeFromImageLink(group.question.image_link);
      if (imageCode && !signHasCode(sign, imageCode)) return true;
      return reasonMismatch(item, codes);
    });
  };

  const filteredGroups = useMemo(
    () => (problemsOnly ? groups.filter(isProblem) : groups),
    [groups, problemsOnly, signMap]
  );
  const visibleGroups = filteredGroups.slice(0, shownGroups);

  useEffect(() => {
    setShownGroups(GROUPS_PER_PAGE);
  }, [problemsOnly]);

  const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (files.length === 0) return;

    if (signsLoading || questionsLoading) {
      toast({
        title: "Still loading sign data",
        description: "Wait for the sign cards and question bank to finish loading, then try again.",
        variant: "destructive",
      });
      return;
    }

    setBusy(true);
    setReport(null);

    const next = [...pending];
    const keys = new Set(next.map((item) => keyOf(item.questionId, item.signId)));
    linked.forEach((key) => keys.add(key));
    for (const item of rejected) keys.add(keyOf(item.questionId, item.signId));

    const unknownQuestions = new Set<number>();
    const notSignQuestions = new Set<number>();
    const unknownSigns = new Set<number>();
    const errors: string[] = [];
    let added = 0;
    let duplicates = 0;
    let empty = 0;
    let badRows = 0;
    let mismatched = 0;

    for (const file of files) {
      let rows: unknown[];
      try {
        rows = parseFile(await file.text());
      } catch (error) {
        errors.push(`${file.name}: ${error instanceof Error ? error.message : "Invalid JSON"}`);
        continue;
      }

      for (const row of rows) {
        const normalized = normalizeRow(row);
        if (!normalized || normalized.questionId === null) {
          badRows += 1;
          continue;
        }
        const { questionId, signIds, confidence, reason } = normalized;
        if (signIds.length === 0) {
          empty += 1;
          continue;
        }
        if (!signQuestionIds.has(questionId)) {
          if (questionMap.has(questionId)) notSignQuestions.add(questionId);
          else unknownQuestions.add(questionId);
          continue;
        }
        for (const signId of signIds) {
          if (!signMap.has(signId)) {
            unknownSigns.add(signId);
            continue;
          }
          const key = keyOf(questionId, signId);
          if (keys.has(key)) {
            duplicates += 1;
            continue;
          }
          const questionCode = codeFromImageLink(questionMap.get(questionId)?.image_link);
          const sign = signMap.get(signId);
          if (questionCode && sign && !signHasCode(sign, questionCode)) mismatched += 1;
          keys.add(key);
          next.push({ questionId, signId, confidence, reason, source: file.name });
          added += 1;
        }
      }
    }

    setPending(next);
    const nextReport: ImportReport = {
      files: files.length,
      added,
      duplicates,
      empty,
      badRows,
      mismatched,
      unknownQuestions: Array.from(unknownQuestions).sort((a, b) => a - b),
      notSignQuestions: Array.from(notSignQuestions).sort((a, b) => a - b),
      unknownSigns: Array.from(unknownSigns).sort((a, b) => a - b),
      errors,
    };
    setReport(nextReport);
    setBusy(false);

    const parts = [`${added} suggestion${added === 1 ? "" : "s"} added`];
    if (duplicates) parts.push(`${duplicates} already reviewed`);
    if (empty) parts.push(`${empty} with no match`);
    if (mismatched) parts.push(`${mismatched} image-code mismatches`);
    if (badRows) parts.push(`${badRows} malformed rows`);
    if (unknownQuestions.size) parts.push(`${unknownQuestions.size} unknown question ids`);
    if (notSignQuestions.size) parts.push(`${notSignQuestions.size} non-sign questions`);
    if (unknownSigns.size) parts.push(`${unknownSigns.size} unknown sign ids`);
    if (errors.length) parts.push(`${errors.length} file error${errors.length === 1 ? "" : "s"}`);

    toast({
      title: added > 0 ? "Suggestions loaded" : "No suggestions added",
      description: parts.join(" · "),
      variant: added > 0 ? undefined : "destructive",
    });
  };

  const approve = async (item: PendingLink) => {
    const question = questionMap.get(item.questionId);
    const sign = signMap.get(item.signId);
    if (!question || !sign) return;
    const key = keyOf(item.questionId, item.signId);
    setLinkingKey(key);
    try {
      await apiRequest("POST", `/api/signs/${item.signId}/questions`, {
        question_id: item.questionId,
      });
      setPending((current) => current.filter((entry) => keyOf(entry.questionId, entry.signId) !== key));
      setLinked((current) => new Set(current).add(key));
      queryClient.invalidateQueries({ queryKey: [`/api/signs/${item.signId}/questions`] });
      queryClient.invalidateQueries({ queryKey: [`/api/questions/${item.questionId}/signs`] });
      toast({
        title: "Question linked",
        description: `Q${question.question_number} → ${sign.name}`,
      });
    } catch (error) {
      toast({
        title: "Link failed",
        description: error instanceof Error ? error.message : "Could not link this question.",
        variant: "destructive",
      });
    } finally {
      setLinkingKey(null);
    }
  };

  const reject = (item: PendingLink) => {
    const key = keyOf(item.questionId, item.signId);
    setPending((current) => current.filter((entry) => keyOf(entry.questionId, entry.signId) !== key));
    setRejected((current) =>
      current.some((entry) => keyOf(entry.questionId, entry.signId) === key) ? current : [...current, item]
    );
  };

  const discardAll = () => {
    if (pending.length === 0) return;
    setRejected((current) => {
      const keys = new Set(current.map((entry) => keyOf(entry.questionId, entry.signId)));
      return [...current, ...pending.filter((entry) => !keys.has(keyOf(entry.questionId, entry.signId)))];
    });
    setPending([]);
    toast({ title: "Pending suggestions set aside", description: "Use Restore rejected to bring them back." });
  };

  const restoreRejected = () => {
    if (rejected.length === 0) return;
    const blocked = new Set<string>(linked);
    for (const entry of pending) blocked.add(keyOf(entry.questionId, entry.signId));
    const restorable = rejected.filter((entry) => !blocked.has(keyOf(entry.questionId, entry.signId)));
    setPending((current) => [...current, ...restorable]);
    setRejected([]);
    toast({ title: `${restorable.length} suggestion${restorable.length === 1 ? "" : "s"} restored` });
  };

  const forgetRejected = () => {
    if (rejected.length === 0) return;
    setRejected([]);
    toast({
      title: "Rejected history cleared",
      description: "Suggestions with these question/sign pairs can be imported again.",
    });
  };

  const loading = signsLoading || questionsLoading;
  const awaitingReview = groups.length;
  const problemCount = groups.filter(isProblem).length;

  return (
    <div className="space-y-4">
      <div className="glass-card rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <FileJson className="h-4 w-4 text-primary" />
          <h3 className="font-bold text-sm">Question ↔ sign-card links</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Upload Gemini's suggestion JSON files. Every suggestion is checked against the live sign question bank and
          sign cards before it appears here. Nothing is linked until you press <span className="font-semibold">Link</span>.
          Pending suggestions stay in this browser until you review them.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            id="sign-link-review-json"
            type="file"
            accept=".json,application/json"
            multiple
            className="hidden"
            onChange={handleFiles}
            disabled={busy || loading}
          />
          <Button asChild variant="outline" className="rounded-xl" disabled={busy || loading}>
            <label htmlFor="sign-link-review-json" className="cursor-pointer">
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Reading…
                </>
              ) : (
                <>
                  <FileJson className="h-4 w-4 mr-1" /> Choose JSON files
                </>
              )}
            </label>
          </Button>
          {rejected.length > 0 && (
            <>
              <Button variant="ghost" className="rounded-xl" onClick={restoreRejected}>
                <RotateCcw className="h-4 w-4 mr-1" /> Restore rejected ({rejected.length})
              </Button>
              <Button variant="ghost" className="rounded-xl text-muted-foreground" onClick={forgetRejected}>
                Forget rejected
              </Button>
            </>
          )}
          {pending.length > 0 && (
            <Button variant="ghost" className="rounded-xl text-muted-foreground" onClick={discardAll}>
              <Trash2 className="h-4 w-4 mr-1" /> Discard pending
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-4 text-xs font-semibold text-muted-foreground">
          <span>{pending.length} suggestion{pending.length === 1 ? "" : "s"} pending</span>
          <span>{awaitingReview} question{awaitingReview === 1 ? "" : "s"}</span>
          <span>{linked.size} linked from this browser</span>
          {problemCount > 0 && (
            <span className="text-amber-700">
              {problemCount} question{problemCount === 1 ? "" : "s"} need a closer look
            </span>
          )}
        </div>
        {report && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs space-y-1">
            <p className="font-bold text-amber-900">
              Last import: {report.added} added from {report.files} file{report.files === 1 ? "" : "s"}
            </p>
            {report.unknownQuestions.length > 0 && (
              <p className="text-destructive">
                Unknown question ids ({report.unknownQuestions.length}): {formatIds(report.unknownQuestions)}
              </p>
            )}
            {report.notSignQuestions.length > 0 && (
              <p className="text-destructive">
                Not sign questions ({report.notSignQuestions.length}): {formatIds(report.notSignQuestions)}
              </p>
            )}
            {report.unknownSigns.length > 0 && (
              <p className="text-destructive">
                Unknown sign ids ({report.unknownSigns.length}): {formatIds(report.unknownSigns)}
              </p>
            )}
            {report.empty > 0 && (
              <p className="text-muted-foreground">{report.empty} suggestion rows had an empty sign_ids array.</p>
            )}
            {report.mismatched > 0 && (
              <p className="text-destructive">
                {report.mismatched} suggestion{report.mismatched === 1 ? "" : "s"} point at a card whose code differs
                from the question image code. Review those first.
              </p>
            )}
            {report.duplicates > 0 && (
              <p className="text-muted-foreground">{report.duplicates} suggestions were already pending or reviewed.</p>
            )}
            {report.badRows > 0 && (
              <p className="text-muted-foreground">{report.badRows} rows were malformed and skipped.</p>
            )}
            {report.errors.map((error) => (
              <p key={error} className="text-destructive">{error}</p>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="glass-card rounded-2xl p-10 text-center text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 mx-auto mb-2 animate-spin" />
          Loading signs and questions…
        </div>
      ) : groups.length === 0 ? (
        <div className="glass-card rounded-2xl p-10 text-center space-y-2">
          <CheckCircle2 className="h-6 w-6 mx-auto text-green-600" />
          <p className="font-bold">Nothing waiting for review</p>
          <p className="text-sm text-muted-foreground">
            {rejected.length > 0
              ? "Everything has been reviewed. Restore rejected suggestions to look at them again."
              : "Upload the suggestion JSON files from Gemini to start reviewing links."}
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Switch id="links-problems" checked={problemsOnly} onCheckedChange={setProblemsOnly} />
              <Label htmlFor="links-problems" className="text-xs font-semibold">
                Only flagged suggestions ({problemCount})
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Showing {Math.min(shownGroups, filteredGroups.length)} of {filteredGroups.length} questions
            </p>
          </div>

          {filteredGroups.length === 0 ? (
            <div className="glass-card rounded-2xl p-8 text-center space-y-2">
              <CheckCircle2 className="h-5 w-5 mx-auto text-green-600" />
              <p className="font-bold text-sm">No problem suggestions</p>
              <p className="text-xs text-muted-foreground">Turn the filter off to review the rest.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleGroups.map(({ question, items }) => {
                const questionCode = codeFromImageLink(question.image_link);
                const groupCodes = groupCodeSet(items);
                const correctAnswer =
                  question.options.find((option) => option.correct_answer)?.answer_text || "—";
                return (
                  <Card key={question.id} className="overflow-hidden">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex gap-3">
                        <div className="h-20 w-28 shrink-0 rounded-lg border bg-white flex items-center justify-center overflow-hidden">
                          {question.image_link ? (
                            <img
                              src={question.image_link}
                              alt="Question sign"
                              className="h-full w-full object-contain"
                              loading="lazy"
                            />
                          ) : (
                            <ImageOff className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="secondary" className="font-mono">
                              Q{question.question_number}
                            </Badge>
                            <span className="text-[11px] text-muted-foreground">id {question.id}</span>
                            {question.is_duplicate && <Badge variant="outline">Duplicate</Badge>}
                            {questionCode && (
                              <Badge variant="outline" className="font-mono">{questionCode}</Badge>
                            )}
                          </div>
                          <p className="text-sm font-semibold leading-snug">{question.question_text}</p>
                          <p className="text-xs text-muted-foreground">
                            <span className="font-bold text-green-700">Answer:</span> {correctAnswer}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {items.map((item) => {
                          const sign = signMap.get(item.signId);
                          const signThumb = sign ? orderImages(sign.images || [])[0]?.image_url : undefined;
                          const itemKey = keyOf(item.questionId, item.signId);
                          const codeState = !questionCode
                            ? "none"
                            : sign && signHasCode(sign, questionCode)
                              ? "match"
                              : "mismatch";
                          const citedCodes = codesInReason(item.reason);
                          const citedMismatch = reasonMismatch(item, groupCodes);
                          return (
                            <div
                              key={itemKey}
                              className={cn(
                                "rounded-xl border bg-background/60 p-2.5 flex flex-col sm:flex-row gap-3 sm:items-start",
                                codeState === "mismatch"
                                  ? "border-destructive/40"
                                  : citedMismatch && "border-amber-300"
                              )}
                            >
                              <div className="h-16 w-20 shrink-0 rounded-md border bg-white flex items-center justify-center overflow-hidden">
                                {signThumb ? (
                                  <img
                                    src={signThumb}
                                    alt={sign?.name || "Sign"}
                                    className="h-full w-full object-contain"
                                    loading="lazy"
                                  />
                                ) : (
                                  <ImageOff className="h-4 w-4 text-muted-foreground" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-sm font-bold">{sign?.name || `Sign ${item.signId} not found`}</span>
                                  {sign && (
                                    <Badge variant="outline" className="font-mono text-[10px]">
                                      {(sign.codes || []).join(" / ")}
                                    </Badge>
                                  )}
                                  <Badge variant="outline" className={cn("text-[10px]", confidenceClass(item.confidence))}>
                                    {item.confidence}
                                  </Badge>
                                  {codeState === "match" && (
                                    <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]">
                                      <Check className="h-3 w-3 mr-1" /> Code {questionCode}
                                    </Badge>
                                  )}
                                  {codeState === "mismatch" && (
                                    <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">
                                      <AlertTriangle className="h-3 w-3 mr-1" /> Image is {questionCode}
                                    </Badge>
                                  )}
                                  {citedMismatch && (
                                    <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px]">
                                      <AlertTriangle className="h-3 w-3 mr-1" /> Reason cites {citedCodes.join(" / ")}
                                    </Badge>
                                  )}
                                </div>
                                {item.reason && (
                                  <p className="text-xs text-muted-foreground">{item.reason}</p>
                                )}
                                <p className="text-[10px] text-muted-foreground/70">from {item.source}</p>
                              </div>
                              <div className="flex sm:flex-col gap-1 shrink-0">
                                <Button
                                  size="sm"
                                  className="h-8 rounded-lg"
                                  onClick={() => approve(item)}
                                  disabled={!sign || linkingKey === itemKey}
                                >
                                  {linkingKey === itemKey ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Link2 className="h-3.5 w-3.5 mr-1" />
                                  )}
                                  Link
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 rounded-lg text-muted-foreground"
                                  onClick={() => reject(item)}
                                >
                                  <X className="h-3.5 w-3.5 mr-1" /> Reject
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {filteredGroups.length > shownGroups && (
                <div className="text-center">
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => setShownGroups((current) => current + GROUPS_PER_PAGE)}
                  >
                    Show {Math.min(GROUPS_PER_PAGE, filteredGroups.length - shownGroups)} more questions
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
