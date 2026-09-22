import React, { useState, useRef, useEffect, useMemo, useCallback, memo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Question, Source, CATEGORY_NAMES } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Plus, Pencil, Trash2, Trash, ArrowUpDown, ArrowUp, ArrowDown,
  Copy, Search, ShieldCheck, AlertTriangle, MoreHorizontal,
  ChevronDown, ChevronUp, CheckCircle2, Layers, X,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub,
  DropdownMenuSubContent, DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import QuestionModal from "@/components/question-modal";

const calculateSimilarity = (s1: string, s2: string) => {
  const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
  const n1 = normalize(s1);
  const n2 = normalize(s2);
  if (n1 === n2) return 1.0;
  if (n1.length < 2 || n2.length < 2) return 0.0;
  const getBigrams = (str: string) => {
    const bigrams = new Set<string>();
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.add(str.substring(i, i + 2));
    }
    return bigrams;
  };
  const b1 = getBigrams(n1);
  const b2 = getBigrams(n2);
  let intersection = 0;
  b1.forEach((bigram) => {
    if (b2.has(bigram)) intersection++;
  });
  return (2 * intersection) / (b1.size + b2.size);
};

interface QuestionRowProps {
  question: Question;
  rowIndex: number;
  sourceName: string;
  isSelected: boolean;
  isExpanded: boolean;
  showDuplicates: boolean;
  groupId: number | undefined;
  rowColor: string;
  onClick: (e: React.MouseEvent, isExpanded: boolean, index: number, id: number) => void;
  onToggleSelect: (index: number, id: number) => void;
  onCaptureMods: (e: React.MouseEvent) => void;
  onEdit: (q: Question) => void;
  onDuplicate: (q: Question) => void;
  onDelete: (id: number) => void;
}

// Memo'd: a selection tick re-renders only rows whose selected/
// expanded state actually changed, not the whole table.
const QuestionRow = memo(function QuestionRow({
  question, rowIndex, sourceName, isSelected, isExpanded,
  showDuplicates, groupId, rowColor,
  onClick, onToggleSelect, onCaptureMods, onEdit, onDuplicate, onDelete,
}: QuestionRowProps) {
  return (
    <React.Fragment>
      <TableRow
        className={`transition-all group cursor-pointer border-b ${rowColor || 'hover:bg-muted/40'} ${isSelected ? 'border-l-4 border-l-primary bg-primary/5' : 'border-l-4 border-l-transparent'}`}
        onClick={(e) => onClick(e, isExpanded, rowIndex, question.id)}
      >
        <TableCell
          className="px-4"
          onClick={(e) => e.stopPropagation()}
          onClickCapture={onCaptureMods}
        >
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleSelect(rowIndex, question.id)}
            className="h-4 w-4 rounded"
          />
        </TableCell>
        <TableCell>
          {question.is_official ? (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[9px] font-black uppercase tracking-tighter border border-primary/20">
              Official
            </div>
          ) : (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[9px] font-black uppercase tracking-tighter">
              Draft
            </div>
          )}
        </TableCell>
        <TableCell className="font-mono text-xs font-black text-muted-foreground">
          {question.question_number.toString().padStart(3, '0')}
        </TableCell>
        <TableCell className="max-w-md">
          <div className="flex items-start gap-2">
            <div className="pt-0.5">
              {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-primary" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />}
            </div>
            <div className="flex flex-col gap-1 min-w-0">
              <span className={`text-[13px] font-semibold truncate ${isExpanded ? 'text-primary' : ''}`}>{question.question_text}</span>
              {showDuplicates && groupId !== undefined && (
                <span className="text-[9px] font-black bg-destructive/10 text-destructive px-1.5 py-0 rounded border border-destructive/20 uppercase self-start">Cluster Grp {groupId + 1}</span>
              )}
            </div>
          </div>
        </TableCell>
        <TableCell>
          <div className="text-[10px] font-black text-muted-foreground px-3 py-1 rounded-full bg-muted flex items-center justify-center whitespace-nowrap">
            {CATEGORY_NAMES[question.category] || question.category}
          </div>
        </TableCell>
        <TableCell>
          <span className="text-[10px] font-bold text-muted-foreground bg-background border px-2 py-0.5 rounded-md">
            {question.license_code}
          </span>
        </TableCell>
        <TableCell className="max-w-[120px]">
          <span className="text-[11px] font-semibold text-muted-foreground truncate block">
            {sourceName}
          </span>
        </TableCell>
        <TableCell className="text-right px-4" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Row actions" className="h-8 w-8 rounded-lg">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(question)} className="cursor-pointer text-xs font-semibold">
                <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDuplicate(question)} className="cursor-pointer text-xs font-semibold">
                <Copy className="h-3.5 w-3.5 mr-2" /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(question.id)}
                className="cursor-pointer text-xs font-semibold text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>

      {isExpanded && (
        <TableRow className="bg-accent/40 hover:bg-accent/40">
          <TableCell colSpan={8} className="p-0 border-t-0">
            <div className="p-5 md:p-7 bg-card border-x-2 border-b-2 border-primary/20 rounded-b-2xl mx-4 md:mx-10 mb-4 shadow-lg animate-in slide-in-from-top-2 duration-200">
              <div className="flex flex-col md:flex-row gap-6">
                {question.contains_image && question.image_link && (
                  <div className="flex-shrink-0 w-full md:w-64 h-48 bg-muted rounded-2xl border flex items-center justify-center overflow-hidden">
                    <img
                      src={question.image_link}
                      alt="Question"
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                )}
                <div className="flex-1 space-y-5">
                  <div>
                    <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Question</h4>
                    <p className="text-sm font-semibold leading-relaxed">{question.question_text}</p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Options</h4>
                    <div className="grid grid-cols-1 gap-2">
                      {question.options.map((opt) => (
                        <div
                          key={opt.answer_number}
                          className={`flex items-start gap-3 p-3 rounded-xl border-2 transition-all ${
                            opt.correct_answer
                              ? 'bg-primary/5 border-primary/30'
                              : 'bg-muted/50 border-transparent'
                          }`}
                        >
                          <div className={`h-6 w-6 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 ${
                            opt.correct_answer ? 'brand-gradient text-white' : 'bg-muted text-muted-foreground'
                          }`}>
                            {opt.answer_number}
                          </div>
                          <span className="text-xs font-semibold pt-0.5 leading-snug">{opt.answer_text}</span>
                          {opt.correct_answer && (
                            <CheckCircle2 className="h-3.5 w-3.5 text-primary ml-auto self-center" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </React.Fragment>
  );
});

export default function QuestionBankSection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [licenseFilter, setLicenseFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [officialFilter, setOfficialFilter] = useState<string>("all");
  const [showDuplicates, setShowDuplicates] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Question; direction: 'asc' | 'desc' } | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  // Anchor row index for Shift-click range selection.
  const shiftAnchor = useRef<number | null>(null);
  // Radix Checkbox doesn't forward the click event, so modifier keys
  // held during a checkbox click are captured on the way down (capture
  // phase on the cell) and consumed by the toggle handler.
  const pendingMods = useRef({ shift: false, mod: false });
  // Mirror so selection callbacks stay referentially stable
  // (keeps memo'd rows from re-rendering when parents re-render).
  const sortedRef = useRef<Question[]>([]);
  const [bulkSourceId, setBulkSourceId] = useState<string>("none");
  const [bulkCategoryId, setBulkCategoryId] = useState<string>("1");
  const [isBulkDeleteAlertOpen, setIsBulkDeleteAlertOpen] = useState(false);

  const { data: questions, isLoading } = useQuery<Question[]>({
    queryKey: ["/api/questions"],
  });
  const { data: sources } = useQuery<Source[]>({
    queryKey: ["/api/sources"],
  });

  const invalidateQuestions = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/questions"] });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/questions/${id}`);
    },
    onSuccess: () => {
      invalidateQuestions();
      toast({ title: "Question deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete question", variant: "destructive" });
    },
  });

  const bulkSourceMutation = useMutation({
    mutationFn: async ({ ids, sourceId }: { ids: number[]; sourceId: number | null }) => {
      await apiRequest("POST", "/api/questions/bulk-source", { ids, sourceId });
    },
    onSuccess: () => {
      invalidateQuestions();
      toast({ title: `Bulk assigned source to ${selectedIds.size} questions` });
      setSelectedIds(new Set());
    },
    onError: (error: Error) => {
      toast({ title: "Bulk assignment failed", description: error.message, variant: "destructive" });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      await apiRequest("DELETE", "/api/questions/bulk", { ids });
    },
    onSuccess: () => {
      invalidateQuestions();
      toast({ title: `Successfully deleted ${selectedIds.size} questions` });
      setSelectedIds(new Set());
      setIsBulkDeleteAlertOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Bulk delete failed", description: error.message, variant: "destructive" });
    },
  });

  const bulkOfficialMutation = useMutation({
    mutationFn: async ({ ids, isOfficial }: { ids: number[]; isOfficial: boolean }) => {
      await apiRequest("POST", "/api/questions/bulk-official", { ids, isOfficial });
    },
    onSuccess: (_, { isOfficial }) => {
      invalidateQuestions();
      toast({ title: `Marked ${selectedIds.size} questions as ${isOfficial ? 'Official' : 'Draft'}` });
      setSelectedIds(new Set());
    },
    onError: (error: Error) => {
      toast({ title: "Bulk update failed", description: error.message, variant: "destructive" });
    },
  });

  const bulkCategoryMutation = useMutation({
    mutationFn: async ({ ids, category }: { ids: number[]; category: number }) => {
      await apiRequest("POST", "/api/questions/bulk-category", { ids, category });
    },
    onSuccess: (_, { category }) => {
      invalidateQuestions();
      toast({ title: `Assigned category ${category} to ${selectedIds.size} questions` });
      setSelectedIds(new Set());
    },
    onError: (error: Error) => {
      toast({ title: "Bulk category update failed", description: error.message, variant: "destructive" });
    },
  });

  const bulkDuplicateMutation = useMutation({
    mutationFn: async ({ ids, isDuplicate }: { ids: number[]; isDuplicate: boolean }) => {
      await apiRequest("POST", "/api/questions/bulk-duplicate", { ids, isDuplicate });
    },
    onSuccess: (_, { isDuplicate }) => {
      invalidateQuestions();
      toast({ title: `${isDuplicate ? 'Marked' : 'Unmarked'} ${selectedIds.size} questions as duplicates` });
      setSelectedIds(new Set());
    },
    onError: (error: Error) => {
      toast({ title: "Bulk duplicate update failed", description: error.message, variant: "destructive" });
    },
  });

  const groupColors: string[] = useMemo(() => ([
    "bg-red-200/50", "bg-orange-200/50", "bg-yellow-200/50",
    "bg-green-200/50", "bg-emerald-200/50", "bg-blue-200/50",
    "bg-indigo-200/50", "bg-purple-200/50", "bg-pink-200/50", "bg-rose-200/50",
  ]), []);

  // O(n²) fuzzy clustering — memoized so keystrokes, sorts and
  // drag-select ticks don't recompute all pairs (the main cause of
  // slow selection: previously this ran on EVERY render).
  const duplicateGroups: Map<number, number> = useMemo(() => {
    const groups: Map<number, number> = new Map();
    if (!questions) return groups;
    let nextGroupId = 0;
    const processed = new Set<number>();
    for (let i = 0; i < questions.length; i++) {
      const q1 = questions[i];
      if (processed.has(q1.id)) continue;
      const currentCluster = [q1];
      processed.add(q1.id);
      for (let j = i + 1; j < questions.length; j++) {
        const q2 = questions[j];
        if (processed.has(q2.id)) continue;
        if (q1.category !== q2.category || q1.license_code !== q2.license_code) continue;
        const qSim = calculateSimilarity(q1.question_text, q2.question_text);
        let totalAnswerSim = 0;
        const opts1 = [...q1.options].sort((a, b) => a.answer_number.localeCompare(b.answer_number));
        const opts2 = [...q2.options].sort((a, b) => a.answer_number.localeCompare(b.answer_number));
        for (let k = 0; k < Math.min(opts1.length, opts2.length); k++) {
          totalAnswerSim += calculateSimilarity(opts1[k].answer_text, opts2[k].answer_text);
        }
        const avgAnswerSim = opts1.length > 0 ? totalAnswerSim / opts1.length : 1;
        const overallSim = qSim * 0.6 + avgAnswerSim * 0.4;
        if (overallSim > 0.85) {
          currentCluster.push(q2);
          processed.add(q2.id);
        }
      }
      if (currentCluster.length > 1) {
        const groupId = nextGroupId++;
        currentCluster.forEach((q) => groups.set(q.id, groupId));
      }
    }
    return groups;
  }, [questions]);

  const filteredQuestions = useMemo(() => (
    questions?.filter((q) => {
      const matchesSearch = q.question_text.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = categoryFilter === "all" || q.category.toString() === categoryFilter;
      const matchesLicense = licenseFilter === "all" || q.license_code === licenseFilter;
      const matchesSource =
        sourceFilter === "all" ? true
        : sourceFilter === "unassigned" ? q.source_id == null
        : q.source_id?.toString() === sourceFilter;
      const matchesOfficial =
        officialFilter === "all" || (officialFilter === "official" ? q.is_official : !q.is_official);
      const matchesDuplicates = showDuplicates ? duplicateGroups.has(q.id) : true;
      return matchesSearch && matchesCategory && matchesLicense && matchesSource && matchesOfficial && matchesDuplicates;
    }) || []
  ), [questions, search, categoryFilter, licenseFilter, sourceFilter, officialFilter, showDuplicates, duplicateGroups]);

  const sortedQuestions = useMemo(() => [...filteredQuestions].sort((a, b) => {
    if (showDuplicates) {
      const groupA = duplicateGroups.get(a.id) ?? -1;
      const groupB = duplicateGroups.get(b.id) ?? -1;
      if (groupA !== groupB) return groupA - groupB;
    }
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;
    const valA: unknown = a[key];
    const valB: unknown = b[key];
    if (valA === valB) return 0;
    if (typeof valA === 'string' && typeof valB === 'string') {
      return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    if ((valA as number) < (valB as number)) return direction === 'asc' ? -1 : 1;
    if ((valA as number) > (valB as number)) return direction === 'asc' ? 1 : -1;
    return 0;
  }), [filteredQuestions, sortConfig, showDuplicates, duplicateGroups]);

  const handleSort = (key: keyof Question) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const SortIcon = ({ columnKey }: { columnKey: keyof Question }) => {
    if (sortConfig?.key !== columnKey) return <ArrowUpDown className="ml-1.5 h-3 w-3 text-muted-foreground" />;
    return sortConfig.direction === 'asc'
      ? <ArrowUp className="ml-1.5 h-3 w-3 text-primary" />
      : <ArrowDown className="ml-1.5 h-3 w-3 text-primary" />;
  };

  // Unified select: range=true adds anchor..index, otherwise flips
  // one row. The anchor is (re)set on every non-range select.
  const selectAt = useCallback((index: number, id: number, useRange: boolean) => {
    const list = sortedRef.current;
    if (useRange) {
      const anchor = shiftAnchor.current;
      if (anchor !== null) {
        const lo = Math.min(anchor, index);
        const hi = Math.max(anchor, index);
        setSelectedIds((prev) => {
          const next = new Set(prev);
          for (let i = lo; i <= hi; i++) {
            const rid = list[i]?.id;
            if (rid !== undefined) next.add(rid);
          }
          return next;
        });
        return;
      }
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    shiftAnchor.current = index;
  }, []);

  const toggleAllSelection = useCallback(() => {
    const list = sortedRef.current;
    setSelectedIds((prev) => (prev.size === list.length ? new Set() : new Set(list.map((q) => q.id))));
    shiftAnchor.current = null;
  }, []);

  // Row click: plain = expand, Ctrl/Cmd/Alt-click = toggle select,
  // Shift-click = select range from anchor.
  const onRowClick = useCallback((e: React.MouseEvent, isExpanded: boolean, index: number, id: number) => {
    if (e.shiftKey) {
      selectAt(index, id, true);
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) {
      selectAt(index, id, false);
      return;
    }
    setExpandedId(isExpanded ? null : id);
  }, [selectAt]);

  // Checkbox toggle honoring modifiers captured on the cell.
  const onToggleSelect = useCallback((index: number, id: number) => {
    const mods = pendingMods.current;
    pendingMods.current = { shift: false, mod: false };
    selectAt(index, id, mods.shift);
  }, [selectAt]);

  // Runs in the row's capture phase; the memo'd row can't see the
  // parent's ref, so it comes through as a stable prop instead.
  const onCaptureMods = useCallback((e: React.MouseEvent) => {
    pendingMods.current = { shift: e.shiftKey, mod: e.ctrlKey || e.metaKey || e.altKey };
  }, []);

  // A filter/sort change reorders rows, so the old anchor is meaningless.
  useEffect(() => {
    shiftAnchor.current = null;
  }, [search, categoryFilter, licenseFilter, sourceFilter, officialFilter, showDuplicates, sortConfig]);

  sortedRef.current = sortedQuestions;

  const handleEdit = useCallback((question: Question) => {
    setSelectedQuestion(question);
    setIsModalOpen(true);
  }, []);

  const handleCreate = useCallback(() => {
    setSelectedQuestion(null);
    setIsModalOpen(true);
  }, []);

  const handleDuplicate = useCallback((question: Question) => {
    const { id: _id, ...copy } = question;
    void _id;
    setSelectedQuestion({ ...copy, question_number: question.question_number } as Question);
    setIsModalOpen(true);
  }, []);

  const handleDelete = useCallback((id: number) => {
    if (confirm('Delete this question? This cannot be undone.')) {
      deleteMutation.mutate(id);
    }
  }, [deleteMutation]);

  const handleNavigate = useCallback((delta: number) => {
    const list = sortedRef.current;
    setSelectedQuestion((prev) => {
      if (!prev) return prev;
      const currentIndex = list.findIndex((q) => q.id === prev.id);
      const nextIndex = currentIndex + delta;
      if (nextIndex >= 0 && nextIndex < list.length) return list[nextIndex];
      return prev;
    });
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-bold tracking-tight">Question Bank</h2>
          <p className="text-sm text-muted-foreground">
            Manage the question corpus
            {questions ? ` · ${filteredQuestions.length} of ${questions.length} shown` : ""}
          </p>
        </div>
        <Button onClick={handleCreate} className="brand-gradient border-none h-10 gap-2 text-sm font-bold shadow-lg shrink-0">
          <Plus className="h-4 w-4" />
          Create Question
        </Button>
      </div>

      {/* Filter bar */}
      <div className="glass-card rounded-2xl p-3">
        <div className="flex flex-col md:flex-row gap-3 items-center">
          <div className="relative flex-1 w-full group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input
              placeholder="Search questions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10 text-sm bg-background/60"
            />
          </div>
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-10 min-w-[130px] text-xs font-bold uppercase">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cats</SelectItem>
                {Object.entries(CATEGORY_NAMES).map(([val, name]) => (
                  <SelectItem key={val} value={val}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={licenseFilter} onValueChange={setLicenseFilter}>
              <SelectTrigger className="h-10 min-w-[130px] text-xs font-bold uppercase">
                <SelectValue placeholder="License" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Codes</SelectItem>
                {["00", "01", "02", "03"].map((v) => (
                  <SelectItem key={v} value={v}>Code {v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="h-10 min-w-[130px] text-xs font-bold uppercase">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {sources?.map((src) => (
                  <SelectItem key={src.id} value={src.id.toString()}>{src.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={officialFilter} onValueChange={setOfficialFilter}>
              <SelectTrigger className="h-10 min-w-[130px] text-xs font-bold uppercase">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="official">Official</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center bg-muted rounded-lg px-3 h-10 gap-3 border">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter">Dupes</span>
              <Switch checked={showDuplicates} onCheckedChange={setShowDuplicates} className="scale-75" />
            </div>
          </div>
        </div>
      </div>

      {/* Contextual bulk-action bar — only when rows selected */}
      {selectedIds.size > 0 && (
        <div className="glass-card rounded-2xl p-3 flex flex-wrap items-center gap-3 animate-in slide-in-from-top-2 border-primary/30">
          <div className="flex items-center gap-2">
            <div className="brand-gradient h-8 w-8 rounded-xl flex items-center justify-center text-white font-black text-xs">
              {selectedIds.size}
            </div>
            <span className="text-xs font-bold uppercase tracking-wider">Selected</span>
            <button onClick={() => setSelectedIds(new Set())} className="text-muted-foreground hover:text-foreground text-[11px] font-bold uppercase">
              Clear
            </button>
          </div>
          <div className="h-8 w-px bg-border hidden sm:block" />
          <Select value={bulkSourceId} onValueChange={setBulkSourceId}>
            <SelectTrigger className="h-10 min-w-[140px] text-xs font-bold">
              <SelectValue placeholder="Target Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Set to None</SelectItem>
              {sources?.map((src) => (
                <SelectItem key={src.id} value={src.id.toString()}>{src.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() => {
              if (selectedIds.size === 0) return;
              const sourceId = bulkSourceId === "none" ? null : parseInt(bulkSourceId);
              bulkSourceMutation.mutate({ ids: Array.from(selectedIds), sourceId });
            }}
            disabled={bulkSourceMutation.isPending}
            className="h-10 text-xs font-bold"
          >
            {bulkSourceMutation.isPending ? "Assigning..." : "Assign source"}
          </Button>
          <Select value={bulkCategoryId} onValueChange={setBulkCategoryId}>
            <SelectTrigger className="h-10 min-w-[110px] text-xs font-bold">
              <SelectValue placeholder="Cat" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CATEGORY_NAMES).map(([val, name]) => (
                <SelectItem key={val} value={val}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => {
              if (selectedIds.size === 0) return;
              bulkCategoryMutation.mutate({ ids: Array.from(selectedIds), category: parseInt(bulkCategoryId) });
            }}
            disabled={bulkCategoryMutation.isPending}
            className="h-10 text-xs font-bold"
          >
            Assign category
          </Button>
          <div className="flex items-center gap-1 ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[200px]">
                <DropdownMenuLabel className="text-[10px] font-black uppercase text-muted-foreground">
                  Advanced Actions
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="text-xs font-bold uppercase">
                    <ShieldCheck className="h-4 w-4 mr-2" />
                    <span>Question Status</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem
                      onClick={() => bulkOfficialMutation.mutate({ ids: Array.from(selectedIds), isOfficial: true })}
                      className="text-xs font-bold uppercase cursor-pointer"
                    >
                      Mark as Official
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => bulkOfficialMutation.mutate({ ids: Array.from(selectedIds), isOfficial: false })}
                      className="text-xs font-bold uppercase cursor-pointer"
                    >
                      Revert to Draft
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="text-xs font-bold uppercase">
                    <Layers className="h-4 w-4 mr-2" />
                    <span>Duplicates</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem
                      onClick={() => bulkDuplicateMutation.mutate({ ids: Array.from(selectedIds), isDuplicate: true })}
                      className="text-xs font-bold uppercase cursor-pointer"
                    >
                      Mark as Duplicates
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => bulkDuplicateMutation.mutate({ ids: Array.from(selectedIds), isDuplicate: false })}
                      className="text-xs font-bold uppercase cursor-pointer"
                    >
                      Unmark Duplicates
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setIsBulkDeleteAlertOpen(true)}
                  className="text-destructive text-xs font-bold uppercase cursor-pointer"
                >
                  <Trash className="h-4 w-4 mr-2" />
                  Delete Selected
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="icon" onClick={() => setSelectedIds(new Set())} className="h-10 w-10 rounded-xl">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Table — click to expand, Ctrl/Cmd/Alt-click to toggle select, Shift-click for a range */}
      <p className="text-[11px] text-muted-foreground -mb-2">
        Tip: click a row to expand · Ctrl/Cmd-click a row or checkbox to select · Shift-click for a range.
      </p>
      <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/60 border-b">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12 px-4">
                <Checkbox
                  checked={selectedIds.size === sortedQuestions.length && sortedQuestions.length > 0}
                  onCheckedChange={toggleAllSelection}
                  className="h-4 w-4 rounded"
                />
              </TableHead>
              <TableHead className="w-24 cursor-pointer" onClick={() => handleSort('is_official')}>
                <div className="flex items-center text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                  Status <SortIcon columnKey="is_official" />
                </div>
              </TableHead>
              <TableHead className="w-20 cursor-pointer" onClick={() => handleSort('question_number')}>
                <div className="flex items-center text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                  Q.No <SortIcon columnKey="question_number" />
                </div>
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort('question_text')}>
                <div className="flex items-center text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                  Question <SortIcon columnKey="question_text" />
                </div>
              </TableHead>
              <TableHead className="w-24 cursor-pointer" onClick={() => handleSort('category')}>
                <div className="flex items-center text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                  Cat <SortIcon columnKey="category" />
                </div>
              </TableHead>
              <TableHead className="w-24 cursor-pointer" onClick={() => handleSort('license_code')}>
                <div className="flex items-center text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                  Code <SortIcon columnKey="license_code" />
                </div>
              </TableHead>
              <TableHead className="w-28 cursor-pointer" onClick={() => handleSort('source_id')}>
                <div className="flex items-center text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                  Source <SortIcon columnKey="source_id" />
                </div>
              </TableHead>
              <TableHead className="text-right px-6 w-14" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="py-20 text-center text-muted-foreground italic font-medium">Loading questions...</TableCell></TableRow>
            ) : sortedQuestions.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="py-20 text-center text-muted-foreground italic font-medium">No results found for current filters</TableCell></TableRow>
            ) : (
              sortedQuestions.map((question, rowIndex) => {
                const groupId = duplicateGroups.get(question.id);
                return (
                  <QuestionRow
                    key={question.id}
                    question={question}
                    rowIndex={rowIndex}
                    sourceName={sources?.find((s) => s.id === question.source_id)?.name || "Unassigned"}
                    isSelected={selectedIds.has(question.id)}
                    isExpanded={expandedId === question.id}
                    showDuplicates={showDuplicates}
                    groupId={groupId}
                    rowColor={showDuplicates && groupId !== undefined ? groupColors[groupId % groupColors.length] : ""}
                    onClick={onRowClick}
                    onToggleSelect={onToggleSelect}
                    onCaptureMods={onCaptureMods}
                    onEdit={handleEdit}
                    onDuplicate={handleDuplicate}
                    onDelete={handleDelete}
                  />
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={isBulkDeleteAlertOpen} onOpenChange={setIsBulkDeleteAlertOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-destructive/10 text-destructive rounded-2xl">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <AlertDialogTitle className="text-xl font-display font-bold tracking-tight">Confirm deletion</AlertDialogTitle>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1">Irreversible bulk operation</p>
              </div>
            </div>
            <AlertDialogDescription>
              Permanently delete <span className="font-black text-destructive">{selectedIds.size}</span> questions? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedIds.size === 0) return;
                bulkDeleteMutation.mutate(Array.from(selectedIds));
              }}
              disabled={bulkDeleteMutation.isPending}
              className="rounded-xl bg-destructive hover:bg-destructive/90"
            >
              {bulkDeleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <QuestionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        question={selectedQuestion}
        currentIndex={selectedQuestion ? sortedQuestions.findIndex((q) => q.id === selectedQuestion.id) : -1}
        totalQuestions={sortedQuestions.length}
        onNavigate={handleNavigate}
      />
    </div>
  );
}
