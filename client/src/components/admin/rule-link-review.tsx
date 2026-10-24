import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Question, RuleQuestionLink, StudyRule } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  FileJson,
  Link2,
  Loader2,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";

type Confidence = "high" | "medium" | "low";

type PendingLink = {
  questionId: number;
  ruleId: number;
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
  unknownQuestions: number[];
  notRuleQuestions: number[];
  unknownRules: number[];
  incompatible: number;
  errors: string[];
};

const STORAGE_KEY = "k53-rule-link-suggestions-v1";
const GROUPS_PER_PAGE = 25;
const CODE_LABELS: Record<number, string> = { 0: "All", 1: "Moto", 2: "Light", 3: "Heavy" };

const keyOf = (questionId: number, ruleId: number) => `${questionId}:${ruleId}`;

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
  if (!rows) throw new Error("JSON must be an array of { question_id, rule_ids, confidence, reason }.");
  return rows;
}

function normalizeRow(row: unknown) {
  if (!row || typeof row !== "object" || Array.isArray(row)) return null;
  const record = row as Record<string, unknown>;
  const questionId = asInt(record.question_id ?? record.questionId);
  const rawIds = Array.isArray(record.rule_ids)
    ? record.rule_ids
    : record.rule_id !== undefined
      ? [record.rule_id]
      : [];
  const ruleIds = Array.from(
    new Set(rawIds.map(asInt).filter((value): value is number => value !== null))
  );
  const confidence: Confidence =
    record.confidence === "high" || record.confidence === "medium" || record.confidence === "low"
      ? record.confidence
      : "low";
  const reason = typeof record.reason === "string" ? record.reason.trim() : "";
  return { questionId, ruleIds, confidence, reason };
}

function questionCode(question: Question): number | null {
  const code = Number.parseInt(question.license_code, 10);
  return Number.isFinite(code) ? code : null;
}

function ruleSupportsQuestionCode(rule: StudyRule, question: Question): boolean {
  const code = questionCode(question);
  if (code === null || code === 0) return true;
  const codes = rule.applicable_codes || [];
  return codes.includes(0) || codes.includes(code);
}

function confidenceClass(confidence: Confidence): string {
  if (confidence === "high") return "bg-green-100 text-green-700 border-green-200";
  if (confidence === "medium") return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-red-100 text-red-700 border-red-200";
}

function formatIds(ids: number[], max = 24): string {
  const shown = ids.slice(0, max).join(", ");
  return ids.length > max ? `${shown}, +${ids.length - max} more` : shown;
}

export default function RuleLinkReview() {
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

  const { data: rules = [], isLoading: rulesLoading } = useQuery<StudyRule[]>({
    queryKey: ["/api/rules"],
  });
  const { data: questions = [], isLoading: questionsLoading } = useQuery<Question[]>({
    queryKey: ["/api/questions"],
  });
  const { data: dbLinks = [], isLoading: linksLoading } = useQuery<RuleQuestionLink[]>({
    queryKey: ["/api/rules/links"],
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
      // Storage may be full or disabled; review still works for this session.
    }
  }, [pending, rejected, linked, loaded]);

  const ruleMap = useMemo(() => new Map(rules.map((rule) => [rule.id, rule])), [rules]);
  const questionMap = useMemo(
    () => new Map(questions.map((question) => [question.id, question])),
    [questions]
  );
  const ruleQuestionIds = useMemo(
    () => new Set(questions.filter((question) => question.category === 1).map((question) => question.id)),
    [questions]
  );
  const dbLinkedKeys = useMemo(
    () => new Set(dbLinks.map((link) => keyOf(link.question_id, link.rule_id))),
    [dbLinks]
  );
  const linkedKeys = useMemo(() => {
    const merged = new Set(dbLinkedKeys);
    linked.forEach((key) => merged.add(key));
    return merged;
  }, [dbLinkedKeys, linked]);

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
        items: items.sort((a, b) => a.ruleId - b.ruleId),
      }))
      .sort((a, b) => a.question.question_number - b.question.question_number);
  }, [pending, questionMap]);

  const isProblem = (group: { question: Question; items: PendingLink[] }): boolean =>
    group.items.some((item) => {
      if (item.confidence === "low" || !item.reason) return true;
      const rule = ruleMap.get(item.ruleId);
      if (!rule) return true;
      return !ruleSupportsQuestionCode(rule, group.question);
    });

  const filteredGroups = useMemo(
    () => (problemsOnly ? groups.filter(isProblem) : groups),
    [groups, problemsOnly, ruleMap]
  );
  const visibleGroups = filteredGroups.slice(0, shownGroups);

  useEffect(() => {
    setShownGroups(GROUPS_PER_PAGE);
  }, [problemsOnly]);

  const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (files.length === 0) return;

    if (rulesLoading || questionsLoading || linksLoading) {
      toast({
        title: "Still loading rule data",
        description: "Wait for the rules, questions, and current links to finish loading, then try again.",
        variant: "destructive",
      });
      return;
    }

    setBusy(true);
    setReport(null);

    const next = [...pending];
    const keys = new Set(next.map((item) => keyOf(item.questionId, item.ruleId)));
    linkedKeys.forEach((key) => keys.add(key));
    for (const item of rejected) keys.add(keyOf(item.questionId, item.ruleId));

    const unknownQuestions = new Set<number>();
    const notRuleQuestions = new Set<number>();
    const unknownRules = new Set<number>();
    const errors: string[] = [];
    let added = 0;
    let duplicates = 0;
    let empty = 0;
    let badRows = 0;
    let incompatible = 0;

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
        const { questionId, ruleIds, confidence, reason } = normalized;
        if (ruleIds.length === 0) {
          empty += 1;
          continue;
        }
        const question = questionMap.get(questionId);
        if (!question) {
          unknownQuestions.add(questionId);
          continue;
        }
        if (!ruleQuestionIds.has(questionId)) {
          notRuleQuestions.add(questionId);
          continue;
        }
        for (const ruleId of ruleIds) {
          const rule = ruleMap.get(ruleId);
          if (!rule) {
            unknownRules.add(ruleId);
            continue;
          }
          if (!ruleSupportsQuestionCode(rule, question)) {
            incompatible += 1;
            continue;
          }
          const key = keyOf(questionId, ruleId);
          if (keys.has(key)) {
            duplicates += 1;
            continue;
          }
          keys.add(key);
          next.push({ questionId, ruleId, confidence, reason, source: file.name });
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
      unknownQuestions: Array.from(unknownQuestions).sort((a, b) => a - b),
      notRuleQuestions: Array.from(notRuleQuestions).sort((a, b) => a - b),
      unknownRules: Array.from(unknownRules).sort((a, b) => a - b),
      incompatible,
      errors,
    };
    setReport(nextReport);
    setBusy(false);

    const parts = [`${added} suggestion${added === 1 ? "" : "s"} added`];
    if (duplicates) parts.push(`${duplicates} already reviewed or linked`);
    if (empty) parts.push(`${empty} with no match`);
    if (incompatible) parts.push(`${incompatible} code-incompatible links`);
    if (badRows) parts.push(`${badRows} malformed rows`);
    if (unknownQuestions.size) parts.push(`${unknownQuestions.size} unknown question ids`);
    if (notRuleQuestions.size) parts.push(`${notRuleQuestions.size} non-rule questions`);
    if (unknownRules.size) parts.push(`${unknownRules.size} unknown rule ids`);
    if (errors.length) parts.push(`${errors.length} file error${errors.length === 1 ? "" : "s"}`);

    toast({
      title: added > 0 ? "Rule suggestions loaded" : "No suggestions added",
      description: parts.join(" | "),
      variant: added > 0 ? undefined : "destructive",
    });
  };

  const approve = async (item: PendingLink) => {
    const question = questionMap.get(item.questionId);
    const rule = ruleMap.get(item.ruleId);
    if (!question || !rule) return;
    const key = keyOf(item.questionId, item.ruleId);
    setLinkingKey(key);
    try {
      await apiRequest("POST", `/api/rules/${item.ruleId}/questions`, {
        question_id: item.questionId,
      });
      setPending((current) => current.filter((entry) => keyOf(entry.questionId, entry.ruleId) !== key));
      setLinked((current) => new Set(current).add(key));
      queryClient.invalidateQueries({ queryKey: ["/api/rules/links"] });
      queryClient.invalidateQueries({ queryKey: [`/api/rules/${item.ruleId}/questions`] });
      queryClient.invalidateQueries({ queryKey: [`/api/questions/${item.questionId}/rules`] });
      toast({
        title: "Question linked to rule",
        description: `Q${question.question_number} -> ${rule.section_ref}`,
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
    const key = keyOf(item.questionId, item.ruleId);
    setPending((current) => current.filter((entry) => keyOf(entry.questionId, entry.ruleId) !== key));
    setRejected((current) =>
      current.some((entry) => keyOf(entry.questionId, entry.ruleId) === key) ? current : [...current, item]
    );
  };

  const discardAll = () => {
    if (pending.length === 0) return;
    setRejected((current) => {
      const keys = new Set(current.map((entry) => keyOf(entry.questionId, entry.ruleId)));
      return [...current, ...pending.filter((entry) => !keys.has(keyOf(entry.questionId, entry.ruleId)))];
    });
    setPending([]);
    toast({ title: "Pending suggestions set aside", description: "Use Restore rejected to bring them back." });
  };

  const restoreRejected = () => {
    if (rejected.length === 0) return;
    const blocked = new Set<string>(linkedKeys);
    for (const entry of pending) blocked.add(keyOf(entry.questionId, entry.ruleId));
    const restorable = rejected.filter((entry) => !blocked.has(keyOf(entry.questionId, entry.ruleId)));
    setPending((current) => [...current, ...restorable]);
    setRejected([]);
    toast({ title: `${restorable.length} suggestion${restorable.length === 1 ? "" : "s"} restored` });
  };

  const forgetRejected = () => {
    if (rejected.length === 0) return;
    setRejected([]);
    toast({
      title: "Rejected history cleared",
      description: "Suggestions with these question/rule pairs can be imported again.",
    });
  };

  const loading = rulesLoading || questionsLoading || linksLoading;
  const awaitingReview = groups.length;
  const problemCount = groups.filter(isProblem).length;

  return (
    <div className="space-y-4">
      <div className="glass-card rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <FileJson className="h-4 w-4 text-primary" />
          <h3 className="font-bold text-sm">Rule card - question links</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Upload <span className="font-semibold">suggestions-verified.json</span> for the strict second-pass results.
          The raw <span className="font-semibold">suggestions-all.json</span> also works, but it still contains links
          rejected by verification. Every link is checked against the live rule and rule-question data. Nothing is
          linked until you press <span className="font-semibold">Link</span>.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            id="rule-link-review-json"
            type="file"
            accept=".json,application/json"
            multiple
            className="hidden"
            onChange={handleFiles}
            disabled={busy || loading}
          />
          <Button asChild variant="outline" className="rounded-xl" disabled={busy || loading}>
            <label htmlFor="rule-link-review-json" className="cursor-pointer">
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Reading...
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
          <span>{linkedKeys.size} rule-question links in the database</span>
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
            {report.notRuleQuestions.length > 0 && (
              <p className="text-destructive">
                Not rule questions ({report.notRuleQuestions.length}): {formatIds(report.notRuleQuestions)}
              </p>
            )}
            {report.unknownRules.length > 0 && (
              <p className="text-destructive">
                Unknown rule ids ({report.unknownRules.length}): {formatIds(report.unknownRules)}
              </p>
            )}
            {report.incompatible > 0 && (
              <p className="text-destructive">
                {report.incompatible} suggestion{report.incompatible === 1 ? "" : "s"} skipped because the rule does not
                apply to that licence code.
              </p>
            )}
            {report.empty > 0 && (
              <p className="text-muted-foreground">{report.empty} suggestion rows had an empty rule_ids array.</p>
            )}
            {report.duplicates > 0 && (
              <p className="text-muted-foreground">{report.duplicates} suggestions were already pending or linked.</p>
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
          Loading rules and questions...
        </div>
      ) : groups.length === 0 ? (
        <div className="glass-card rounded-2xl p-10 text-center space-y-2">
          <CheckCircle2 className="h-6 w-6 mx-auto text-green-600" />
          <p className="font-bold">Nothing waiting for review</p>
          <p className="text-sm text-muted-foreground">
            {rejected.length > 0
              ? "Everything has been reviewed. Restore rejected suggestions to look at them again."
              : "Upload the verified suggestion JSON file to start reviewing rule links."}
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Switch id="rule-links-problems" checked={problemsOnly} onCheckedChange={setProblemsOnly} />
              <Label htmlFor="rule-links-problems" className="text-xs font-semibold">
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
                const correctAnswer =
                  question.options.find((option) => option.correct_answer)?.answer_text || "-";
                const code = questionCode(question);
                return (
                  <Card key={question.id} className="overflow-hidden">
                    <CardContent className="p-4 space-y-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="secondary" className="font-mono">
                            Q{question.question_number}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground">id {question.id}</span>
                          <Badge variant="outline" className="font-mono">
                            Code {question.license_code}
                          </Badge>
                          {question.is_duplicate && <Badge variant="outline">Duplicate</Badge>}
                        </div>
                        <p className="text-sm font-semibold leading-snug">{question.question_text}</p>
                        <p className="text-xs text-muted-foreground">
                          <span className="font-bold text-green-700">Answer:</span> {correctAnswer}
                        </p>
                      </div>

                      <div className="space-y-2">
                        {items.map((item) => {
                          const rule = ruleMap.get(item.ruleId);
                          const itemKey = keyOf(item.questionId, item.ruleId);
                          const codeCompatible = !rule || !code || code === 0 || (rule.applicable_codes || []).some(
                            (ruleCode) => ruleCode === 0 || ruleCode === code
                          );
                          return (
                            <div
                              key={itemKey}
                              className={cn(
                                "rounded-xl border bg-background/60 p-3 flex flex-col sm:flex-row gap-3 sm:items-start",
                                !codeCompatible && "border-destructive/40"
                              )}
                            >
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-sm font-bold">
                                    {rule ? `${rule.section_ref} - ${rule.subheading}` : `Rule ${item.ruleId} not found`}
                                  </span>
                                  {rule && (
                                    <Badge variant="outline" className="text-[10px]">
                                      {rule.heading}
                                    </Badge>
                                  )}
                                  {rule && (rule.applicable_codes || []).map((ruleCode) => (
                                    <Badge key={ruleCode} variant="outline" className="text-[10px] font-mono">
                                      {CODE_LABELS[ruleCode] ?? ruleCode}
                                    </Badge>
                                  ))}
                                  <Badge variant="outline" className={cn("text-[10px]", confidenceClass(item.confidence))}>
                                    {item.confidence}
                                  </Badge>
                                  {codeCompatible ? (
                                    <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]">
                                      <Check className="h-3 w-3 mr-1" /> Code match
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">
                                      <AlertTriangle className="h-3 w-3 mr-1" /> Wrong code
                                    </Badge>
                                  )}
                                </div>
                                {rule?.title && (
                                  <p className="text-xs font-semibold text-foreground/80">{rule.title}</p>
                                )}
                                <p className="text-xs text-muted-foreground line-clamp-4">{rule?.body || "Rule not found."}</p>
                                {item.reason && <p className="text-xs text-muted-foreground">{item.reason}</p>}
                                <p className="text-[10px] text-muted-foreground/70">from {item.source}</p>
                              </div>
                              <div className="flex sm:flex-col gap-1 shrink-0">
                                <Button
                                  size="sm"
                                  className="h-8 rounded-lg"
                                  onClick={() => approve(item)}
                                  disabled={!rule || !codeCompatible || linkingKey === itemKey}
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
