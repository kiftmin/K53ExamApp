import { useDeferredValue, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Question, StudyControl, StudyRule, StudySign } from "@shared/schema";
import { CATEGORY_NAMES } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Link2, Loader2, Search } from "lucide-react";
import QuestionModal from "@/components/question-modal";
import SignForm from "./sign-form";
import RuleForm from "./rule-form";
import ControlForm from "./control-form";

type ModuleKey = "signs" | "rules" | "controls";
type CardKind = "sign" | "rule" | "control";

interface CoverageModule {
  questions: { total: number; linked: number };
  cards: { total: number; linked: number };
}

type Coverage = Record<ModuleKey, CoverageModule>;

interface UnlinkedItem {
  id: number;
  label: string;
  heading?: string | null;
  category?: number;
  question_number?: number;
}

interface UnlinkedPage {
  items: UnlinkedItem[];
  total: number;
}

const MODULES: { key: ModuleKey; label: string; category: number }[] = [
  { key: "signs", label: "Signs", category: 2 },
  { key: "rules", label: "Rules", category: 1 },
  { key: "controls", label: "Controls", category: 3 },
];

const CARD_KINDS: { value: CardKind; label: string }[] = [
  { value: "sign", label: "Signs" },
  { value: "rule", label: "Rules" },
  { value: "control", label: "Controls" },
];

function CoverageRow({ label, linked, total }: { label: string; linked: number; total: number }) {
  const pct = total > 0 ? Math.round((linked / total) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold text-muted-foreground">{label}</span>
        <span className="text-sm font-bold tabular-nums">
          {linked}
          <span className="text-muted-foreground font-medium"> / {total}</span>
          <span className="ml-2 text-xs font-semibold text-muted-foreground">{pct}%</span>
        </span>
      </div>
      <Progress value={pct} className="h-2" />
    </div>
  );
}

export default function LinkCoverageSection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [questionCategory, setQuestionCategory] = useState<string>("all");
  const [questionSearch, setQuestionSearch] = useState("");
  const [questionLimit, setQuestionLimit] = useState(50);
  const deferredQuestionSearch = useDeferredValue(questionSearch.trim());

  const [cardKind, setCardKind] = useState<CardKind>("sign");
  const [cardSearch, setCardSearch] = useState("");
  const [cardLimit, setCardLimit] = useState(50);
  const deferredCardSearch = useDeferredValue(cardSearch.trim());

  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [questionOpen, setQuestionOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<
    { kind: "sign"; item: StudySign } | { kind: "rule"; item: StudyRule } | { kind: "control"; item: StudyControl } | null
  >(null);

  const refreshCoverage = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-link-coverage"] });
    queryClient.invalidateQueries({ queryKey: ["admin-unlinked-questions"] });
    queryClient.invalidateQueries({ queryKey: ["admin-unlinked-cards"] });
  };

  const { data: coverage, isLoading: coverageLoading } = useQuery<Coverage>({
    queryKey: ["admin-link-coverage"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/link-coverage")).json(),
  });

  const { data: questions = [] } = useQuery<Question[]>({ queryKey: ["/api/questions"] });

  const unlinkedQuestionsUrl = useMemo(() => {
    const params = new URLSearchParams({ type: "question", offset: "0", limit: String(questionLimit) });
    if (questionCategory !== "all") params.set("category", questionCategory);
    if (deferredQuestionSearch) params.set("search", deferredQuestionSearch);
    return `/api/admin/link-coverage/unlinked?${params.toString()}`;
  }, [questionCategory, deferredQuestionSearch, questionLimit]);

  const { data: unlinkedQuestions, isLoading: questionsLoading } = useQuery<UnlinkedPage>({
    queryKey: ["admin-unlinked-questions", questionCategory, deferredQuestionSearch, questionLimit],
    queryFn: async () => (await apiRequest("GET", unlinkedQuestionsUrl)).json(),
  });

  const unlinkedCardsUrl = useMemo(() => {
    const params = new URLSearchParams({ type: cardKind, offset: "0", limit: String(cardLimit) });
    if (deferredCardSearch) params.set("search", deferredCardSearch);
    return `/api/admin/link-coverage/unlinked?${params.toString()}`;
  }, [cardKind, deferredCardSearch, cardLimit]);

  const { data: unlinkedCards, isLoading: cardsLoading } = useQuery<UnlinkedPage>({
    queryKey: ["admin-unlinked-cards", cardKind, deferredCardSearch, cardLimit],
    queryFn: async () => (await apiRequest("GET", unlinkedCardsUrl)).json(),
  });

  const openQuestion = (id: number) => {
    const question = questions.find((row) => row.id === id);
    if (!question) {
      toast({ title: "Question not loaded", description: "Reload the section and try again.", variant: "destructive" });
      return;
    }
    setEditingQuestion(question);
    setQuestionOpen(true);
  };

  const openCard = async (kind: CardKind, id: number) => {
    const path = kind === "sign" ? `/api/signs/${id}` : kind === "rule" ? `/api/rules/${id}` : `/api/controls/${id}`;
    try {
      const item = await (await apiRequest("GET", path)).json();
      setEditingCard({ kind, item } as any);
    } catch (error) {
      toast({
        title: "Could not open card",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    }
  };

  const closeCard = () => {
    setEditingCard(null);
    refreshCoverage();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Link2 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-display font-bold">Card links</h1>
          <p className="text-sm text-muted-foreground">
            How many questions have a matching study card, and which questions or cards still need a link.
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {MODULES.map((module) => {
          const row = coverage?.[module.key];
          return (
            <Card key={module.key} className="rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{module.label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {coverageLoading || !row ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Measuring…
                  </div>
                ) : (
                  <>
                    <CoverageRow label="Questions with a card" linked={row.questions.linked} total={row.questions.total} />
                    <CoverageRow label="Cards with a question" linked={row.cards.linked} total={row.cards.total} />
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader className="pb-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">Questions without a card</CardTitle>
              <Badge variant="secondary" className="tabular-nums">
                {unlinkedQuestions?.total ?? 0}
              </Badge>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Select
                value={questionCategory}
                onValueChange={(value) => {
                  setQuestionCategory(value);
                  setQuestionLimit(50);
                }}
              >
                <SelectTrigger className="h-9 sm:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All modules</SelectItem>
                  <SelectItem value="1">Rules</SelectItem>
                  <SelectItem value="2">Signs</SelectItem>
                  <SelectItem value="3">Controls</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={questionSearch}
                  onChange={(event) => {
                    setQuestionSearch(event.target.value);
                    setQuestionLimit(50);
                  }}
                  placeholder="Search questions…"
                  className="h-9 pl-8"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="max-h-[26rem] overflow-y-auto divide-y rounded-xl border">
              {questionsLoading ? (
                <div className="p-4 text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </div>
              ) : (unlinkedQuestions?.items.length ?? 0) === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No unlinked questions match this filter.</p>
              ) : (
                unlinkedQuestions!.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 px-3 py-2.5">
                    <span className="font-mono text-xs font-bold text-muted-foreground shrink-0">
                      Q{item.question_number ?? item.id}
                    </span>
                    <p className="flex-1 min-w-0 text-xs line-clamp-2">{item.label}</p>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {CATEGORY_NAMES[item.category as 1 | 2 | 3] ?? "Question"}
                    </Badge>
                    <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={() => openQuestion(item.id)}>
                      Open
                    </Button>
                  </div>
                ))
              )}
            </div>
            {(unlinkedQuestions?.items.length ?? 0) < (unlinkedQuestions?.total ?? 0) && (
              <Button variant="ghost" size="sm" className="mt-2 w-full text-xs" onClick={() => setQuestionLimit((n) => n + 50)}>
                Show more
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader className="pb-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">Cards without a question</CardTitle>
              <Badge variant="secondary" className="tabular-nums">
                {unlinkedCards?.total ?? 0}
              </Badge>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Select
                value={cardKind}
                onValueChange={(value) => {
                  setCardKind(value as CardKind);
                  setCardLimit(50);
                }}
              >
                <SelectTrigger className="h-9 sm:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CARD_KINDS.map((kind) => (
                    <SelectItem key={kind.value} value={kind.value}>
                      {kind.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={cardSearch}
                  onChange={(event) => {
                    setCardSearch(event.target.value);
                    setCardLimit(50);
                  }}
                  placeholder="Search cards…"
                  className="h-9 pl-8"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="max-h-[26rem] overflow-y-auto divide-y rounded-xl border">
              {cardsLoading ? (
                <div className="p-4 text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </div>
              ) : (unlinkedCards?.items.length ?? 0) === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No unlinked cards match this filter.</p>
              ) : (
                unlinkedCards!.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      {item.heading && (
                        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground truncate">
                          {item.heading}
                        </p>
                      )}
                      <p className="text-xs line-clamp-2">{item.label}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs shrink-0"
                      onClick={() => openCard(cardKind, item.id)}
                    >
                      Open
                    </Button>
                  </div>
                ))
              )}
            </div>
            {(unlinkedCards?.items.length ?? 0) < (unlinkedCards?.total ?? 0) && (
              <Button variant="ghost" size="sm" className="mt-2 w-full text-xs" onClick={() => setCardLimit((n) => n + 50)}>
                Show more
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <QuestionModal
        isOpen={questionOpen}
        onClose={() => {
          setQuestionOpen(false);
          setEditingQuestion(null);
          refreshCoverage();
        }}
        question={editingQuestion}
      />

      <SignForm
        open={editingCard?.kind === "sign"}
        sign={editingCard?.kind === "sign" ? editingCard.item : null}
        onClose={closeCard}
      />
      <RuleForm
        open={editingCard?.kind === "rule"}
        rule={editingCard?.kind === "rule" ? editingCard.item : null}
        onClose={closeCard}
      />
      <ControlForm
        open={editingCard?.kind === "control"}
        control={editingCard?.kind === "control" ? editingCard.item : null}
        onClose={closeCard}
      />
    </div>
  );
}
