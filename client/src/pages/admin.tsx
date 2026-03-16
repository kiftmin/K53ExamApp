import React, { useState, useEffect, ChangeEvent } from "react";
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
import { Link } from "wouter";
import { 
    ArrowLeft, Upload, Plus, Pencil, Trash2, 
    ArrowUpDown, ArrowUp, ArrowDown, Clock, 
    Copy, Search, Database, LayoutGrid, ListChecks,
    Filter, X, CheckSquare, Layers, Trash,
    ShieldCheck, ShieldAlert, AlertTriangle, MoreHorizontal,
    ChevronDown, ChevronUp, CheckCircle2
} from "lucide-react";
import { 
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter 
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import QuestionModal from "@/components/question-modal";
import SourceMaintenance from "@/components/source-maintenance";

export default function Admin() {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    
    // Filters & Search
    const [search, setSearch] = useState("");
    const [categoryFilter, setCategoryFilter] = useState<string>("all");
    const [licenseFilter, setLicenseFilter] = useState<string>("all");
    const [sourceFilter, setSourceFilter] = useState<string>("all");
    const [officialFilter, setOfficialFilter] = useState<string>("all");
    const [showDuplicates, setShowDuplicates] = useState(false);
    
    // UI State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
    const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
    const [sortConfig, setSortConfig] = useState<{ key: keyof Question; direction: 'asc' | 'desc' } | null>(null);
    const [expandedId, setExpandedId] = useState<number | null>(null);
    
    // Multi-select state
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [bulkSourceId, setBulkSourceId] = useState<string>("none");
    const [bulkCategoryId, setBulkCategoryId] = useState<string>("1");
    const [isBulkDeleteAlertOpen, setIsBulkDeleteAlertOpen] = useState(false);

    // Import state
    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
    const [pendingImportData, setPendingImportData] = useState<any[]>([]);
    const [importSourceId, setImportSourceId] = useState<string>("none");

    // Access code state
    const [todayCode, setTodayCode] = useState<string>("");
    const [todayDate, setTodayDate] = useState<string>("");
    const [countdown, setCountdown] = useState<string>("");
    const [lookupDate, setLookupDate] = useState<string>("");
    const [lookupCode, setLookupCode] = useState<string>("");
    const [codeCopied, setCodeCopied] = useState(false);

    // Fetch today's access code
    useEffect(() => {
        const fetchCode = async () => {
            try {
                const res = await fetch('/api/access-code/today');
                const data = await res.json();
                setTodayCode(data.code);
                setTodayDate(data.date);
            } catch (err) {
                console.error('Failed to fetch access code:', err);
            }
        };
        fetchCode();
    }, []);

    // Live countdown timer
    useEffect(() => {
        const updateCountdown = () => {
            const now = new Date();
            const sast = new Date(now.getTime() + 2 * 60 * 60 * 1000);
            const endOfDay = new Date(sast);
            endOfDay.setHours(23, 59, 59, 999);
            const diff = endOfDay.getTime() - sast.getTime();
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            setCountdown(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
        };
        updateCountdown();
        const interval = setInterval(updateCountdown, 1000);
        return () => clearInterval(interval);
    }, []);

    const { data: questions, isLoading } = useQuery<Question[]>({
        queryKey: ["/api/questions"],
    });

    const { data: sources } = useQuery<Source[]>({
        queryKey: ["/api/sources"],
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            await apiRequest("DELETE", `/api/questions/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/questions"] });
            toast({ title: "Question deleted successfully" });
        },
        onError: () => {
            toast({ title: "Failed to delete question", variant: "destructive" });
        }
    });

    const bulkSourceMutation = useMutation({
        mutationFn: async ({ ids, sourceId }: { ids: number[], sourceId: number | null }) => {
            await apiRequest("POST", "/api/questions/bulk-source", { ids, sourceId });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/questions"] });
            toast({ title: `Bulk assigned source to ${selectedIds.size} questions` });
            setSelectedIds(new Set());
        },
        onError: (error: Error) => {
            toast({ title: "Bulk assignment failed", description: error.message, variant: "destructive" });
        }
    });

    const handleBulkSourceAssign = () => {
        if (selectedIds.size === 0) return;
        const sourceId = bulkSourceId === "none" ? null : parseInt(bulkSourceId);
        bulkSourceMutation.mutate({ ids: Array.from(selectedIds), sourceId });
    };

    const bulkDeleteMutation = useMutation({
        mutationFn: async (ids: number[]) => {
            await apiRequest("DELETE", "/api/questions/bulk", { ids });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/questions"] });
            toast({ title: `Successfully deleted ${selectedIds.size} questions` });
            setSelectedIds(new Set());
            setIsBulkDeleteAlertOpen(false);
        },
        onError: (error: Error) => {
            toast({ title: "Bulk delete failed", description: error.message, variant: "destructive" });
        }
    });

    const bulkOfficialMutation = useMutation({
        mutationFn: async ({ ids, isOfficial }: { ids: number[], isOfficial: boolean }) => {
            await apiRequest("POST", "/api/questions/bulk-official", { ids, isOfficial });
        },
        onSuccess: (_, { isOfficial }) => {
            queryClient.invalidateQueries({ queryKey: ["/api/questions"] });
            toast({ title: `Marked ${selectedIds.size} questions as ${isOfficial ? 'Official' : 'Draft'}` });
            setSelectedIds(new Set());
        },
        onError: (error: Error) => {
            toast({ title: "Bulk update failed", description: error.message, variant: "destructive" });
        }
    });

    const bulkCategoryMutation = useMutation({
        mutationFn: async ({ ids, category }: { ids: number[], category: number }) => {
            await apiRequest("POST", "/api/questions/bulk-category", { ids, category });
        },
        onSuccess: (_, { category }) => {
            queryClient.invalidateQueries({ queryKey: ["/api/questions"] });
            toast({ title: `Assigned category ${category} to ${selectedIds.size} questions` });
            setSelectedIds(new Set());
        },
        onError: (error: Error) => {
            toast({ title: "Bulk category update failed", description: error.message, variant: "destructive" });
        }
    });

    const bulkDuplicateMutation = useMutation({
        mutationFn: async ({ ids, isDuplicate }: { ids: number[], isDuplicate: boolean }) => {
            await apiRequest("POST", "/api/questions/bulk-duplicate", { ids, isDuplicate });
        },
        onSuccess: (_, { isDuplicate }) => {
            queryClient.invalidateQueries({ queryKey: ["/api/questions"] });
            toast({ title: `${isDuplicate ? 'Marked' : 'Unmarked'} ${selectedIds.size} questions as duplicates` });
            setSelectedIds(new Set());
        },
        onError: (error: Error) => {
            toast({ title: "Bulk duplicate update failed", description: error.message, variant: "destructive" });
        }
    });

    const handleBulkDelete = () => {
        if (selectedIds.size === 0) return;
        bulkDeleteMutation.mutate(Array.from(selectedIds));
    };

    const handleBulkOfficialToggle = (isOfficial: boolean) => {
        if (selectedIds.size === 0) return;
        bulkOfficialMutation.mutate({ ids: Array.from(selectedIds), isOfficial });
    };

    const handleBulkCategoryAssign = () => {
        if (selectedIds.size === 0) return;
        bulkCategoryMutation.mutate({ ids: Array.from(selectedIds), category: parseInt(bulkCategoryId) });
    };

    const handleBulkDuplicateToggle = (isDuplicate: boolean) => {
        if (selectedIds.size === 0) return;
        bulkDuplicateMutation.mutate({ ids: Array.from(selectedIds), isDuplicate });
    };

    const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const text = await file.text();
            const rawData = text.replace(/^\uFEFF/, "");
            const parsed = JSON.parse(rawData);
            
            if (Array.isArray(parsed)) {
                setPendingImportData(parsed);
                setIsImportDialogOpen(true);
            } else {
                toast({ title: "Invalid format", description: "JSON must be an array of questions", variant: "destructive" });
            }
        } catch (error) {
            console.error(error);
            toast({ title: "Parse failed", description: "Could not read the JSON file.", variant: "destructive" });
        }
        event.target.value = '';
    };

    const confirmImportMutation = useMutation({
        mutationFn: async (data: any[]) => {
            await apiRequest("POST", "/api/questions/bulk", data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/questions"] });
            toast({ title: "Successfully imported questions!" });
            setIsImportDialogOpen(false);
            setPendingImportData([]);
        },
        onError: (error: Error) => {
            toast({ title: "Import failed", description: error.message, variant: "destructive" });
        }
    });

    const handleConfirmImport = () => {
        const sourceId = importSourceId === "none" ? null : parseInt(importSourceId);
        const dataWithSource = pendingImportData.map((q: any) => ({
            ...q,
            source_id: sourceId
        }));
        confirmImportMutation.mutate(dataWithSource);
    };

    // Fuzzy string similarity function
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
        b1.forEach(bigram => {
            if (b2.has(bigram)) intersection++;
        });
        return (2 * intersection) / (b1.size + b2.size);
    };

    const duplicateGroups: Map<number, number> = new Map();
    const groupColors: string[] = [
        "bg-red-200/50", "bg-orange-200/50", "bg-yellow-200/50", 
        "bg-green-200/50", "bg-emerald-200/50", "bg-blue-200/50", 
        "bg-indigo-200/50", "bg-purple-200/50", "bg-pink-200/50", "bg-rose-200/50"
    ];

    if (questions) {
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
                const overallSim = (qSim * 0.6) + (avgAnswerSim * 0.4);
                if (overallSim > 0.85) {
                    currentCluster.push(q2);
                    processed.add(q2.id);
                }
            }
            if (currentCluster.length > 1) {
                const groupId = nextGroupId++;
                currentCluster.forEach(q => duplicateGroups.set(q.id, groupId));
            }
        }
    }

    const filteredQuestions = questions?.filter(q => {
        const matchesSearch = q.question_text.toLowerCase().includes(search.toLowerCase());
        const matchesCategory = categoryFilter === "all" || q.category.toString() === categoryFilter;
        const matchesLicense = licenseFilter === "all" || q.license_code === licenseFilter;
        const matchesSource = sourceFilter === "all" || q.source_id?.toString() === sourceFilter;
        const matchesOfficial = officialFilter === "all" || (officialFilter === "official" ? q.is_official : !q.is_official);
        const matchesDuplicates = showDuplicates ? duplicateGroups.has(q.id) : true;
        return matchesSearch && matchesCategory && matchesLicense && matchesSource && matchesOfficial && matchesDuplicates;
    }) || [];

    const sortedQuestions = [...filteredQuestions].sort((a, b) => {
        if (showDuplicates) {
            const groupA = duplicateGroups.get(a.id) ?? -1;
            const groupB = duplicateGroups.get(b.id) ?? -1;
            if (groupA !== groupB) return groupA - groupB;
        }
        if (!sortConfig) return 0;
        const { key, direction } = sortConfig;
        let valA: any = (a as any)[key];
        let valB: any = (b as any)[key];
        if (valA === valB) return 0;
        if (typeof valA === 'string' && typeof valB === 'string') {
            return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        if (valA < valB) return direction === 'asc' ? -1 : 1;
        if (valA > valB) return direction === 'asc' ? 1 : -1;
        return 0;
    });

    const handleSort = (key: keyof Question) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const SortIcon = ({ columnKey }: { columnKey: keyof Question }) => {
        if (sortConfig?.key !== columnKey) return <ArrowUpDown className="ml-1.5 h-3 w-3 text-neutral-400" />;
        return sortConfig.direction === 'asc' ? <ArrowUp className="ml-1.5 h-3 w-3 text-blue-500" /> : <ArrowDown className="ml-1.5 h-3 w-3 text-blue-500" />;
    };

    const toggleSelection = (id: number) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const toggleAllSelection = () => {
        if (selectedIds.size === sortedQuestions.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(sortedQuestions.map(q => q.id)));
        }
    };

    const handleEdit = (question: Question) => {
        setSelectedQuestion(question);
        setIsModalOpen(true);
    };

    const handleCreate = () => {
        setSelectedQuestion(null);
        setIsModalOpen(true);
    };

    const handleNavigate = (delta: number) => {
        if (!selectedQuestion || !sortedQuestions) return;
        const currentIndex = sortedQuestions.findIndex(q => q.id === selectedQuestion.id);
        const nextIndex = currentIndex + delta;
        if (nextIndex >= 0 && nextIndex < sortedQuestions.length) {
            setSelectedQuestion(sortedQuestions[nextIndex]);
        }
    };

    return (
        <div className="min-h-screen bg-neutral-50/50">
            <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-neutral-200 px-8 py-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/">
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-neutral-100">
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-xl font-black tracking-tight text-neutral-900 leading-none">Admin Terminal</h1>
                            <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-1">Database Control & Maintenance</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <Button onClick={() => setIsSourceModalOpen(true)} variant="outline" className="h-9 gap-2 text-[11px] font-bold border-neutral-200">
                            <Database className="h-3.5 w-3.5" />
                            Sources
                        </Button>
                        <div className="h-4 w-px bg-neutral-200 mx-1" />
                        <Button 
                            onClick={() => setIsImportDialogOpen(true)} 
                            variant="outline" 
                            className="h-9 gap-2 text-[11px] font-bold border-neutral-200"
                        >
                            <Upload className="h-3.5 w-3.5" />
                            Import
                        </Button>
                        <Button onClick={handleCreate} className="h-9 gap-2 text-[11px] font-bold bg-neutral-900 text-white hover:bg-black shadow-lg shadow-neutral-200 px-5">
                            <Plus className="h-3.5 w-3.5" />
                            Create Question
                        </Button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto p-8 space-y-8 pb-32">
                {/* Systems Overview Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Today's Access Code */}
                    <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                                    <Clock className="h-3.5 w-3.5" />
                                </div>
                                <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">Session Access</span>
                            </div>
                            <span className="text-[10px] font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{countdown}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex-1 text-2xl font-black font-mono tracking-[0.2em] text-neutral-900 bg-neutral-50 px-4 py-3 rounded-xl border border-neutral-100 text-center uppercase">
                                {todayCode || "------"}
                            </div>
                            <Button variant="outline" size="icon" onClick={() => {
                                navigator.clipboard.writeText(todayCode);
                                toast({ title: "Copied to clipboard" });
                            }} className="h-12 w-12 rounded-xl group">
                                <Copy className="h-4 w-4 text-neutral-400 group-hover:text-neutral-900 transition-colors" />
                            </Button>
                        </div>
                        <p className="text-[10px] text-neutral-400 font-medium">Valid for today: <span className="text-neutral-600">{todayDate}</span></p>
                    </div>

                    {/* Date Lookup */}
                    <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm space-y-4">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-neutral-100 text-neutral-600 rounded-lg">
                                <Search className="h-3.5 w-3.5" />
                            </div>
                            <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">Archive Search</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Input
                                type="date"
                                value={lookupDate}
                                onChange={(e) => setLookupDate(e.target.value)}
                                className="h-10 text-[11px] font-bold border-neutral-200 bg-neutral-50/50"
                            />
                            <Button onClick={async () => {
                                if (!lookupDate) return;
                                const res = await fetch(`/api/access-code/lookup?date=${lookupDate}`);
                                const data = await res.json();
                                setLookupCode(data.code);
                            }} disabled={!lookupDate} className="h-10 px-4 text-[11px] font-bold">
                                Look Up
                            </Button>
                        </div>
                        {lookupCode && (
                            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                                <div className="flex-1 text-sm font-black font-mono tracking-widest text-neutral-600 bg-neutral-100 px-3 py-1.5 rounded-lg border border-neutral-200 text-center">
                                    {lookupCode}
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => {
                                    navigator.clipboard.writeText(lookupCode);
                                    toast({ title: "Copied lookup code" });
                                }} className="h-8 w-8">
                                    <Copy className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Quick Stats */}
                    <div className="bg-neutral-900 rounded-2xl p-5 shadow-lg shadow-neutral-200 relative overflow-hidden">
                        <div className="flex items-center gap-2 mb-6">
                            <div className="p-1.5 bg-neutral-800 text-neutral-400 rounded-lg">
                                <LayoutGrid className="h-3.5 w-3.5" />
                            </div>
                            <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">Repository Stats</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <h3 className="text-2xl font-black text-white leading-none">{questions?.length || 0}</h3>
                                <p className="text-[10px] text-neutral-500 font-bold uppercase mt-1 tracking-tighter">Total Items</p>
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-blue-400 leading-none">{questions?.filter(q => q.is_official).length || 0}</h3>
                                <p className="text-[10px] text-neutral-500 font-bold uppercase mt-1 tracking-tighter">Official B.D.</p>
                            </div>
                        </div>
                        <div className="absolute top-0 right-0 p-4 opacity-5">
                            <Database className="h-16 w-16 text-white" />
                        </div>
                    </div>
                </div>

                {/* Filter & Table Section */}
                <div className="space-y-4">
                    <div className="flex flex-col md:flex-row gap-3 bg-white p-3 rounded-2xl border border-neutral-200 shadow-sm items-center">
                        <div className="relative flex-1 w-full group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400 group-focus-within:text-blue-500 transition-colors" />
                            <Input
                                placeholder="Scan text corpus..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9 h-10 text-[11px] font-bold border-neutral-200 bg-neutral-50/30 w-full focus-visible:ring-blue-500"
                            />
                        </div>
                        
                        <div className="flex flex-wrap gap-2 w-full md:w-auto">
                            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                <SelectTrigger className="h-10 min-w-[130px] text-[10px] font-bold uppercase border-neutral-200">
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
                                <SelectTrigger className="h-10 min-w-[130px] text-[10px] font-bold uppercase border-neutral-200">
                                    <SelectValue placeholder="License" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Codes</SelectItem>
                                    {["00", "01", "02", "03"].map(v => <SelectItem key={v} value={v}>Code {v}</SelectItem>)}
                                </SelectContent>
                            </Select>

                            <Select value={sourceFilter} onValueChange={setSourceFilter}>
                                <SelectTrigger className="h-10 min-w-[130px] text-[10px] font-bold uppercase border-neutral-200">
                                    <SelectValue placeholder="Source" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Sources</SelectItem>
                                    {sources?.map(src => (
                                        <SelectItem key={src.id} value={src.id.toString()}>{src.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <div className="flex items-center bg-neutral-100 rounded-lg px-3 h-10 gap-3 border border-neutral-200">
                                <span className="text-[10px] font-black text-neutral-400 uppercase tracking-tighter">Dupes</span>
                                <Switch checked={showDuplicates} onCheckedChange={setShowDuplicates} className="scale-75" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                        <Table>
                            <TableHeader className="bg-neutral-50/80 border-b border-neutral-200">
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="w-12 px-4">
                                        <Checkbox 
                                            checked={selectedIds.size === sortedQuestions.length && sortedQuestions.length > 0} 
                                            onCheckedChange={toggleAllSelection}
                                            className="h-4 w-4 border-neutral-300 rounded"
                                        />
                                    </TableHead>
                                    <TableHead className="w-24 cursor-pointer group" onClick={() => handleSort('is_official')}>
                                        <div className="flex items-center text-[10px] font-black text-neutral-400 uppercase tracking-wider">
                                            Status <SortIcon columnKey="is_official" />
                                        </div>
                                    </TableHead>
                                    <TableHead className="w-20 cursor-pointer" onClick={() => handleSort('question_number')}>
                                        <div className="flex items-center text-[10px] font-black text-neutral-400 uppercase tracking-wider">
                                            Q.No <SortIcon columnKey="question_number" />
                                        </div>
                                    </TableHead>
                                    <TableHead className="cursor-pointer" onClick={() => handleSort('question_text')}>
                                        <div className="flex items-center text-[10px] font-black text-neutral-400 uppercase tracking-wider">
                                            Payload <SortIcon columnKey="question_text" />
                                        </div>
                                    </TableHead>
                                    <TableHead className="w-24 cursor-pointer" onClick={() => handleSort('category')}>
                                        <div className="flex items-center text-[10px] font-black text-neutral-400 uppercase tracking-wider">
                                            Cat <SortIcon columnKey="category" />
                                        </div>
                                    </TableHead>
                                    <TableHead className="w-24 cursor-pointer" onClick={() => handleSort('license_code')}>
                                        <div className="flex items-center text-[10px] font-black text-neutral-400 uppercase tracking-wider">
                                            Code <SortIcon columnKey="license_code" />
                                        </div>
                                    </TableHead>
                                    <TableHead className="w-28 cursor-pointer" onClick={() => handleSort('source_id')}>
                                        <div className="flex items-center text-[10px] font-black text-neutral-400 uppercase tracking-wider">
                                            Source <SortIcon columnKey="source_id" />
                                        </div>
                                    </TableHead>
                                    <TableHead className="text-right px-6 text-[10px] font-black text-neutral-400 uppercase tracking-wider">Mod</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={8} className="py-20 text-center text-neutral-400 italic font-medium">Synchronizing corpus...</TableCell></TableRow>
                                ) : sortedQuestions.length === 0 ? (
                                    <TableRow><TableCell colSpan={8} className="py-20 text-center text-neutral-400 italic font-medium">No results found for current filters</TableCell></TableRow>
                                ) : (
                                    sortedQuestions.map((question) => {
                                        const groupId = duplicateGroups.get(question.id);
                                        const isSelected = selectedIds.has(question.id);
                                        const isExpanded = expandedId === question.id;
                                        const rowColor = (showDuplicates && groupId !== undefined) ? groupColors[groupId % groupColors.length] : "";
                                        
                                        return (
                                            <React.Fragment key={question.id}>
                                                <TableRow 
                                                    className={`transition-all group cursor-pointer border-b border-neutral-100 ${rowColor || 'hover:bg-neutral-50/50'} ${
                                                        isSelected 
                                                        ? 'border-l-4 border-l-blue-600 bg-blue-50/20' 
                                                        : 'border-l-4 border-l-transparent'
                                                    }`}
                                                    onClick={() => setExpandedId(isExpanded ? null : question.id)}
                                                >
                                                    <TableCell className="px-4" onClick={(e) => e.stopPropagation()}>
                                                        <Checkbox 
                                                            checked={isSelected}
                                                            onCheckedChange={() => toggleSelection(question.id)}
                                                            className="h-4 w-4 border-neutral-300 rounded"
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        {question.is_official ? (
                                                            <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[9px] font-black uppercase tracking-tighter border border-blue-100">
                                                                Official
                                                            </div>
                                                        ) : (
                                                            <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-neutral-100 text-neutral-500 text-[9px] font-black uppercase tracking-tighter">
                                                                Draft
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="font-mono text-xs font-black text-neutral-400">
                                                        {question.question_number.toString().padStart(3, '0')}
                                                    </TableCell>
                                                <TableCell className="max-w-md">
                                                    <div className="flex items-start gap-2">
                                                        <div className="pt-0.5">
                                                            {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-blue-500" /> : <ChevronDown className="h-3.5 w-3.5 text-neutral-400 group-hover:text-blue-500 transition-colors" />}
                                                        </div>
                                                        <div className="flex flex-col gap-1 min-w-0">
                                                            <span className={`text-[11px] font-bold truncate ${isExpanded ? 'text-blue-600' : 'text-neutral-700 group-hover:text-neutral-900'}`}>{question.question_text}</span>
                                                            {showDuplicates && groupId !== undefined && (
                                                                <span className="text-[8px] font-black bg-rose-50 text-rose-600 px-1.5 py-0 rounded border border-rose-100 uppercase self-start">Cluster Grp {groupId + 1}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="text-[10px] font-black text-neutral-400 px-3 py-1 rounded-full bg-neutral-100 flex items-center justify-center border border-neutral-200 whitespace-nowrap">
                                                        {CATEGORY_NAMES[question.category] || question.category}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-[10px] font-bold text-neutral-500 bg-white border border-neutral-200 px-2 py-0.5 rounded-md shadow-xs">
                                                        {question.license_code}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="max-w-[120px]">
                                                    <span className="text-[10px] font-bold text-neutral-500 truncate block">
                                                        {sources?.find(s => s.id === question.source_id)?.name || "Unassigned"}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-right px-4" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button variant="ghost" size="icon" onClick={() => handleEdit(question)} className="h-8 w-8 rounded-lg hover:bg-white hover:shadow-sm">
                                                            <Pencil className="h-3.5 w-3.5 text-blue-500" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" onClick={() => {
                                                            if (confirm('Irreversible deletion - proceed?')) {
                                                                deleteMutation.mutate(question.id);
                                                            }
                                                        }} className="h-8 w-8 rounded-lg hover:bg-white hover:shadow-sm">
                                                            <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                            
                                            {isExpanded && (
                                                <TableRow className="bg-neutral-50 hover:bg-neutral-50">
                                                    <TableCell colSpan={8} className="p-0 border-t-0">
                                                        <div className="p-8 bg-white border-x-2 border-b-2 border-blue-100/50 rounded-b-2xl mx-12 mb-4 shadow-xl shadow-blue-900/5 animate-in slide-in-from-top-4 duration-300">
                                                            <div className="flex flex-col md:flex-row gap-8">
                                                                {question.contains_image && question.image_link && (
                                                                    <div className="flex-shrink-0 w-full md:w-64 h-48 bg-neutral-50 rounded-2xl border border-neutral-100 flex items-center justify-center overflow-hidden">
                                                                        <img 
                                                                            src={question.image_link} 
                                                                            alt="Question" 
                                                                            className="max-w-full max-h-full object-contain"
                                                                        />
                                                                    </div>
                                                                )}
                                                                
                                                                <div className="flex-1 space-y-6">
                                                                    <div>
                                                                        <h4 className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-3">Question Payload</h4>
                                                                        <p className="text-sm font-bold text-neutral-800 leading-relaxed">{question.question_text}</p>
                                                                    </div>

                                                                    <div className="space-y-3">
                                                                        <h4 className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-3">Response Options</h4>
                                                                        <div className="grid grid-cols-1 gap-2">
                                                                            {question.options.map((opt) => (
                                                                                <div 
                                                                                    key={opt.answer_number}
                                                                                    className={`flex items-start gap-3 p-3 rounded-xl border-2 transition-all ${
                                                                                        opt.correct_answer 
                                                                                        ? 'bg-emerald-50 border-emerald-500/30 text-emerald-900 shadow-sm shadow-emerald-100' 
                                                                                        : 'bg-neutral-50 border-neutral-100 text-neutral-600'
                                                                                    }`}
                                                                                >
                                                                                    <div className={`h-6 w-6 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 ${
                                                                                        opt.correct_answer ? 'bg-emerald-500 text-white' : 'bg-neutral-200 text-neutral-500'
                                                                                    }`}>
                                                                                        {opt.answer_number}
                                                                                    </div>
                                                                                    <span className="text-xs font-bold pt-0.5 leading-snug">{opt.answer_text}</span>
                                                                                    {opt.correct_answer && (
                                                                                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 ml-auto self-center" />
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
                                        )
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </main>

            {/* Bulk Action Bar */}
            {selectedIds.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-8 duration-300">
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-2.5 shadow-2xl flex items-center gap-4 min-w-[400px]">
                        <div className="flex items-center gap-3 pl-3">
                            <div className="h-8 w-8 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-xs">
                                {selectedIds.size}
                            </div>
                            <div className="flex flex-col">
                                <span className="text-white text-[10px] font-black uppercase tracking-wider leading-none">Items Selected</span>
                                <button onClick={() => setSelectedIds(new Set())} className="text-neutral-500 hover:text-white text-[9px] font-bold text-left mt-0.5 uppercase tracking-tighter">Clear All</button>
                            </div>
                        </div>
                        
                        <div className="h-8 w-px bg-neutral-800 mx-2" />
                        
                        <div className="flex-1 flex gap-2">
                            <Select value={bulkSourceId} onValueChange={setBulkSourceId}>
                                <SelectTrigger className="h-10 bg-neutral-800 border-neutral-700 text-white text-[10px] font-bold min-w-[140px] focus:ring-blue-500 rounded-xl">
                                    <SelectValue placeholder="Target Source" />
                                </SelectTrigger>
                                <SelectContent className="bg-neutral-900 border-neutral-800 text-white">
                                    <SelectItem value="none">Set to None</SelectItem>
                                    {sources?.map(src => (
                                        <SelectItem key={src.id} value={src.id.toString()}>{src.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button 
                                onClick={handleBulkSourceAssign}
                                disabled={bulkSourceMutation.isPending}
                                className="h-10 px-4 bg-blue-600 text-white hover:bg-blue-700 rounded-xl text-[10px] font-black uppercase transition-all shadow-lg shadow-blue-900/40"
                            >
                                {bulkSourceMutation.isPending ? "Assigning..." : "Source"}
                            </Button>
                        </div>

                        <div className="h-4 w-px bg-neutral-800 mx-1" />

                        <div className="flex items-center gap-2">
                            <Select value={bulkCategoryId} onValueChange={setBulkCategoryId}>
                                <SelectTrigger className="h-10 bg-neutral-800 border-neutral-700 text-white text-[10px] font-bold min-w-[90px] focus:ring-blue-500 rounded-xl">
                                    <SelectValue placeholder="Cat" />
                                </SelectTrigger>
                                <SelectContent className="bg-neutral-900 border-neutral-800 text-white">
                                    {Object.entries(CATEGORY_NAMES).map(([val, name]) => (
                                        <SelectItem key={val} value={val}>{name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button 
                                onClick={handleBulkCategoryAssign}
                                disabled={bulkCategoryMutation.isPending}
                                className="h-10 px-4 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl text-[10px] font-black uppercase transition-all shadow-lg shadow-emerald-900/40"
                            >
                                {bulkCategoryMutation.isPending ? "Assigning..." : "Assign Category"}
                            </Button>
                        </div>

                        <div className="h-4 w-px bg-neutral-800 mx-1" />

                        <div className="flex items-center gap-1.5 px-1">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-10 w-10 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-xl transition-colors">
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-neutral-900 border-neutral-800 text-white min-w-[200px]">
                                    <DropdownMenuLabel className="text-[9px] font-black uppercase text-neutral-500 px-3 py-2">Advanced Actions</DropdownMenuLabel>
                                    <DropdownMenuSeparator className="bg-neutral-800" />
                                    
                                    <DropdownMenuSub>
                                        <DropdownMenuSubTrigger className="flex items-center gap-2 p-3 text-[10px] font-black uppercase focus:bg-neutral-800 transition-colors">
                                            <ShieldCheck className="h-4 w-4" />
                                            <span>Question Status</span>
                                        </DropdownMenuSubTrigger>
                                        <DropdownMenuSubContent className="bg-neutral-900 border-neutral-800 text-white">
                                            <DropdownMenuItem 
                                                onClick={() => handleBulkOfficialToggle(true)}
                                                className="flex items-center gap-2 p-3 focus:bg-neutral-800 focus:text-blue-400 transition-colors cursor-pointer"
                                            >
                                                <ShieldCheck className="h-4 w-4" />
                                                <span className="text-[10px] font-black uppercase">Mark as Official</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem 
                                                onClick={() => handleBulkOfficialToggle(false)}
                                                className="flex items-center gap-2 p-3 focus:bg-neutral-800 focus:text-neutral-400 transition-colors cursor-pointer"
                                            >
                                                <ShieldAlert className="h-4 w-4" />
                                                <span className="text-[10px] font-black uppercase">Revert to Draft</span>
                                            </DropdownMenuItem>
                                        </DropdownMenuSubContent>
                                    </DropdownMenuSub>

                                    <DropdownMenuSub>
                                        <DropdownMenuSubTrigger className="flex items-center gap-2 p-3 text-[10px] font-black uppercase focus:bg-neutral-800 transition-colors">
                                            <Layers className="h-4 w-4" />
                                            <span>Duplicates</span>
                                        </DropdownMenuSubTrigger>
                                        <DropdownMenuSubContent className="bg-neutral-900 border-neutral-800 text-white">
                                            <DropdownMenuItem 
                                                onClick={() => handleBulkDuplicateToggle(true)}
                                                className="flex items-center gap-2 p-3 focus:bg-neutral-800 focus:text-orange-400 transition-colors cursor-pointer"
                                            >
                                                <Layers className="h-4 w-4" />
                                                <span className="text-[10px] font-black uppercase">Mark as Duplicates</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem 
                                                onClick={() => handleBulkDuplicateToggle(false)}
                                                className="flex items-center gap-2 p-3 focus:bg-neutral-800 focus:text-neutral-400 transition-colors cursor-pointer"
                                            >
                                                <CheckSquare className="h-4 w-4" />
                                                <span className="text-[10px] font-black uppercase">Unmark Duplicates</span>
                                            </DropdownMenuItem>
                                        </DropdownMenuSubContent>
                                    </DropdownMenuSub>

                                    <DropdownMenuSeparator className="bg-neutral-800" />
                                    <DropdownMenuItem 
                                        onClick={() => setIsBulkDeleteAlertOpen(true)}
                                        className="flex items-center gap-2 p-3 text-rose-500 focus:bg-rose-500/10 focus:text-rose-400 transition-colors cursor-pointer"
                                    >
                                        <Trash className="h-4 w-4" />
                                        <span className="text-[10px] font-black uppercase">Delete Selected</span>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => setSelectedIds(new Set())} 
                                className="h-10 w-10 text-neutral-500 hover:text-white hover:bg-neutral-800 rounded-xl transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <AlertDialog open={isBulkDeleteAlertOpen} onOpenChange={setIsBulkDeleteAlertOpen}>
                <AlertDialogContent className="bg-white border-none shadow-2xl rounded-2xl p-0 overflow-hidden">
                    <AlertDialogHeader className="p-8 pb-4 text-center sm:text-left">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
                                <AlertTriangle className="h-6 w-6" />
                            </div>
                            <div>
                                <AlertDialogTitle className="text-xl font-black text-neutral-900 tracking-tight leading-none">Confirm Destruction</AlertDialogTitle>
                                <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-1">Irreversible Bulk Operation</p>
                            </div>
                        </div>
                        <AlertDialogDescription className="text-sm font-medium text-neutral-500">
                            You are about to permanently delete <span className="font-black text-rose-600">{selectedIds.size}</span> question records. This action cannot be undone and will remove all associated data including options and metadata.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="p-6 bg-neutral-50 border-t border-neutral-100 flex sm:flex-row flex-col gap-3">
                        <AlertDialogCancel className="w-full sm:flex-1 h-12 rounded-xl text-[10px] font-black uppercase tracking-wider border-neutral-200 hover:bg-neutral-100 transition-all font-sans">
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={handleBulkDelete}
                            disabled={bulkDeleteMutation.isPending}
                            className="w-full sm:flex-1 h-12 rounded-xl bg-rose-600 text-white hover:bg-rose-700 text-[10px] font-black uppercase tracking-wider transition-all shadow-lg shadow-rose-100 border-none"
                        >
                            {bulkDeleteMutation.isPending ? "Purging..." : "Confirm Purge"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <QuestionModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                question={selectedQuestion}
                currentIndex={selectedQuestion ? sortedQuestions.findIndex(q => q.id === selectedQuestion.id) : -1}
                totalQuestions={sortedQuestions.length}
                onNavigate={handleNavigate}
            />
            
            <SourceMaintenance 
                isOpen={isSourceModalOpen} 
                onClose={() => setIsSourceModalOpen(false)} 
            />

            {/* Bulk Import Source Selection Dialog */}
            <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
                <DialogContent className="max-w-md bg-white border-none shadow-2xl rounded-2xl p-0 overflow-hidden">
                    <DialogHeader className="p-6 bg-neutral-900 text-white">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-600 rounded-lg">
                                <Upload className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <DialogTitle className="text-lg font-black tracking-tight">Finalize Import</DialogTitle>
                                <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-0.5">Record Verification Step</p>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="p-6 space-y-6">
                        {/* Record Buffer Info */}
                        {pendingImportData.length > 0 ? (
                            <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">Validated Questions</span>
                                    <span className="text-2xl font-black text-emerald-900 tracking-tight">{pendingImportData.length}</span>
                                </div>
                                <Button 
                                    variant="ghost" 
                                    onClick={() => setPendingImportData([])}
                                    className="h-8 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100 uppercase"
                                >
                                    Change File
                                </Button>
                            </div>
                        ) : (
                            <div className="relative group">
                                <input
                                    type="file"
                                    id="dialog-json-upload"
                                    accept=".json"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                />
                                <label 
                                    htmlFor="dialog-json-upload"
                                    className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-neutral-200 rounded-2xl cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all group-active:scale-[0.98]"
                                >
                                    <div className="p-3 bg-neutral-50 text-neutral-400 rounded-full group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors mb-4">
                                        <Upload className="h-6 w-6" />
                                    </div>
                                    <span className="text-sm font-black text-neutral-900">Upload JSON Dataset</span>
                                    <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-1">UTF-8 Transcoded only</span>
                                </label>
                            </div>
                        )}

                        <div className="space-y-4 pt-2">
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <Layers className="h-4 w-4 text-neutral-400" />
                                    <span className="text-[11px] font-black text-neutral-900 uppercase tracking-wider">Set Target Source</span>
                                </div>
                                <Select value={importSourceId} onValueChange={setImportSourceId}>
                                    <SelectTrigger className="h-12 bg-white border-neutral-200 text-sm font-bold rounded-xl focus:ring-blue-500 shadow-sm transition-all">
                                        <SelectValue placeholder="Select target source" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white border-neutral-200">
                                        <SelectItem value="none" className="font-bold text-neutral-400">None (Leave Unassigned)</SelectItem>
                                        {sources?.map(src => (
                                            <SelectItem key={src.id} value={src.id.toString()} className="font-bold">
                                                {src.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {pendingImportData.length > 0 && (
                                    <p className="text-[10px] text-neutral-400 font-medium pl-1 italic">
                                        This will apply to all {pendingImportData.length} records in current buffer.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="p-4 bg-neutral-50 border-t border-neutral-100 flex gap-3">
                        <Button 
                            variant="ghost" 
                            onClick={() => {
                                setIsImportDialogOpen(false);
                                setPendingImportData([]);
                            }}
                            className="flex-1 h-11 text-[11px] font-black uppercase text-neutral-500 hover:bg-neutral-200 transition-all rounded-xl"
                        >
                            Cancel
                        </Button>
                        <Button 
                            onClick={handleConfirmImport}
                            disabled={confirmImportMutation.isPending || pendingImportData.length === 0}
                            className="flex-1 h-11 bg-neutral-900 text-white hover:bg-black text-[11px] font-black uppercase tracking-wider transition-all rounded-xl shadow-lg shadow-neutral-200 disabled:opacity-50 disabled:grayscale"
                        >
                            {confirmImportMutation.isPending ? "Importing..." : "Run Import Process"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
