import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Question, Source } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { ArrowLeft, Upload, Plus, Pencil, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Clock, Copy, Search, Database } from "lucide-react";
import QuestionModal from "@/components/question-modal";
import SourceMaintenance from "@/components/source-maintenance";
export default function Admin() {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [search, setSearch] = useState("");
    const [categoryFilter, setCategoryFilter] = useState<string>("all");
    const [licenseFilter, setLicenseFilter] = useState<string>("all");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
    const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
    const [sortConfig, setSortConfig] = useState<{ key: keyof Question; direction: 'asc' | 'desc' } | null>(null);
    const [sourceFilter, setSourceFilter] = useState<string>("all");
    const [officialFilter, setOfficialFilter] = useState<string>("all");
    const [showDuplicates, setShowDuplicates] = useState(false);

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

    const handleCopyCode = async (code: string) => {
        await navigator.clipboard.writeText(code);
        setCodeCopied(true);
        toast({ title: "Code copied to clipboard!" });
        setTimeout(() => setCodeCopied(false), 2000);
    };

    const handleLookupCode = async () => {
        if (!lookupDate) return;
        try {
            const res = await fetch(`/api/access-code/lookup?date=${lookupDate}`);
            const data = await res.json();
            setLookupCode(data.code);
        } catch (err) {
            console.error('Failed to lookup code:', err);
            toast({ title: "Failed to look up code", variant: "destructive" });
        }
    };

    const { data: questions, isLoading } = useQuery<Question[]>({
        queryKey: ["/api/questions"],
    });

    const { data: sources, isLoading: isSourcesLoading } = useQuery<Source[]>({
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

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const text = await file.text();
            const rawData = text.replace(/^\uFEFF/, "");
            const parsed = JSON.parse(rawData);

            await apiRequest("POST", "/api/questions/bulk", parsed);

            queryClient.invalidateQueries({ queryKey: ["/api/questions"] });
            toast({ title: "Successfully imported questions!" });
        } catch (error) {
            console.error(error);
            toast({ title: "Import failed. Please check the JSON format.", variant: "destructive" });
        }

        // Reset file input
        event.target.value = '';
    };

    // Fuzzy string similarity function (Sorensen-Dice coefficient)
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

    // Advanced duplicate detection
    const duplicateGroups: Map<number, number> = new Map(); // questionId -> groupId
    const groupColors: string[] = [
        "bg-red-100/50", "bg-orange-100/50", "bg-yellow-100/50", 
        "bg-green-100/50", "bg-emerald-100/50", "bg-blue-100/50", 
        "bg-indigo-100/50", "bg-purple-100/50", "bg-pink-100/50", "bg-rose-100/50"
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

                // Only check within the same category AND same license code
                if (q1.category !== q2.category || q1.license_code !== q2.license_code) continue;

                // Compare Questions
                const qSim = calculateSimilarity(q1.question_text, q2.question_text);
                
                // Compare Answers (all 3 options)
                let totalAnswerSim = 0;
                const opts1 = [...q1.options].sort((a, b) => a.answer_number.localeCompare(b.answer_number));
                const opts2 = [...q2.options].sort((a, b) => a.answer_number.localeCompare(b.answer_number));
                
                for (let k = 0; k < Math.min(opts1.length, opts2.length); k++) {
                    totalAnswerSim += calculateSimilarity(opts1[k].answer_text, opts2[k].answer_text);
                }
                const avgAnswerSim = opts1.length > 0 ? totalAnswerSim / opts1.length : 1;

                // Weighted similarity (60% question, 40% answers)
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
            if (groupA !== groupB) {
                return groupA - groupB;
            }
        }

        if (!sortConfig) return 0;
        const { key, direction } = sortConfig;
        let valA: any = a[key];
        let valB: any = b[key];

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
        if (sortConfig?.key !== columnKey) return <ArrowUpDown className="ml-2 h-4 w-4 inline-block" />;
        return sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-4 w-4 inline-block" /> : <ArrowDown className="ml-2 h-4 w-4 inline-block" />;
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
        <div className="min-h-screen bg-neutral-50 p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/">
                            <Button variant="outline" size="icon">
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                        </Link>
                        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Question Management</h1>
                    </div>
                    <div className="flex gap-4">
                        <Button onClick={() => setIsSourceModalOpen(true)} variant="secondary" className="gap-2">
                            <Database className="h-4 w-4" />
                            Manage Sources
                        </Button>
                        <Button onClick={handleCreate} className="gap-2">
                            <Plus className="h-4 w-4" />
                            Add Question
                        </Button>
                        <div className="relative">
                            <input
                                type="file"
                                accept=".json"
                                onChange={handleFileUpload}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            <Button variant="outline" className="gap-2">
                                <Upload className="h-4 w-4" />
                                Bulk Import JSON
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Access Code Card */}
                <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Today's Code */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm font-medium text-neutral-500">
                                <Clock className="h-4 w-4" />
                                Today's Access Code ({todayDate})
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="text-4xl font-mono font-bold tracking-[0.3em] text-neutral-900 bg-neutral-100 px-6 py-3 rounded-lg">
                                    {todayCode || "------"}
                                </div>
                                <Button variant="outline" size="icon" onClick={() => handleCopyCode(todayCode)} title="Copy code">
                                    <Copy className="h-4 w-4" />
                                </Button>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-neutral-500">
                                <span>Expires in</span>
                                <span className="font-mono font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded">{countdown}</span>
                            </div>
                        </div>

                        {/* Date Lookup */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm font-medium text-neutral-500">
                                <Search className="h-4 w-4" />
                                Look Up Code by Date
                            </div>
                            <div className="flex items-center gap-2">
                                <Input
                                    type="date"
                                    value={lookupDate}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLookupDate(e.target.value)}
                                    className="flex-1"
                                />
                                <Button onClick={handleLookupCode} disabled={!lookupDate}>
                                    Get Code
                                </Button>
                            </div>
                            {lookupCode && (
                                <div className="flex items-center gap-3">
                                    <div className="text-2xl font-mono font-bold tracking-[0.3em] text-neutral-700 bg-neutral-100 px-4 py-2 rounded-lg">
                                        {lookupCode}
                                    </div>
                                    <Button variant="outline" size="icon" onClick={() => handleCopyCode(lookupCode)} title="Copy code">
                                        <Copy className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-lg shadow-sm border border-neutral-200">
                    <Input
                        placeholder="Search questions..."
                        value={search}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                        className="flex-1"
                    />
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Categories</SelectItem>
                            <SelectItem value="1">Category 1</SelectItem>
                            <SelectItem value="2">Category 2</SelectItem>
                            <SelectItem value="3">Category 3</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={licenseFilter} onValueChange={setLicenseFilter}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="License Code" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Licenses</SelectItem>
                            <SelectItem value="00">Code 00</SelectItem>
                            <SelectItem value="01">Code 01</SelectItem>
                            <SelectItem value="02">Code 02</SelectItem>
                            <SelectItem value="03">Code 03</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={sourceFilter} onValueChange={setSourceFilter}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Source" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Sources</SelectItem>
                            {sources?.map(src => (
                                <SelectItem key={src.id} value={src.id.toString()}>{src.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={officialFilter} onValueChange={setOfficialFilter}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Braindump" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Questions</SelectItem>
                            <SelectItem value="official">Braindump Only</SelectItem>
                            <SelectItem value="unofficial">Unofficial Only</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button 
                        variant={showDuplicates ? "destructive" : "outline"}
                        onClick={() => setShowDuplicates(!showDuplicates)}
                        className="whitespace-nowrap"
                    >
                        {showDuplicates ? "Showing Duplicates" : "Find Duplicates"}
                    </Button>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[120px] cursor-pointer hover:bg-neutral-100" onClick={() => handleSort('is_official')}>
                                    Braindump <SortIcon columnKey="is_official" />
                                </TableHead>
                                <TableHead className="w-[80px] cursor-pointer hover:bg-neutral-100" onClick={() => handleSort('question_number')}>
                                    Q. No. <SortIcon columnKey="question_number" />
                                </TableHead>
                                <TableHead className="cursor-pointer hover:bg-neutral-100" onClick={() => handleSort('question_text')}>
                                    Question Text <SortIcon columnKey="question_text" />
                                </TableHead>
                                <TableHead className="w-[140px] cursor-pointer hover:bg-neutral-100" onClick={() => handleSort('category')}>
                                    Category <SortIcon columnKey="category" />
                                </TableHead>
                                <TableHead className="w-[140px] cursor-pointer hover:bg-neutral-100" onClick={() => handleSort('license_code')}>
                                    License <SortIcon columnKey="license_code" />
                                </TableHead>
                                <TableHead className="w-[120px] cursor-pointer hover:bg-neutral-100" onClick={() => handleSort('source_id')}>
                                    Source <SortIcon columnKey="source_id" />
                                </TableHead>
                                <TableHead className="w-[100px] cursor-pointer hover:bg-neutral-100" onClick={() => handleSort('contains_image')}>
                                    Image <SortIcon columnKey="contains_image" />
                                </TableHead>
                                <TableHead className="text-right w-[120px]">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8 text-neutral-500">Loading questions...</TableCell>
                                </TableRow>
                            ) : sortedQuestions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8 text-neutral-500">No questions found matching your filters.</TableCell>
                                </TableRow>
                            ) : (
                                sortedQuestions.map((question) => {
                                    const groupId = duplicateGroups.get(question.id);
                                    const rowColor = groupId !== undefined ? groupColors[groupId % groupColors.length] : "";
                                    
                                    return (
                                        <TableRow key={question.id} className={`${rowColor} transition-colors`}>
                                            <TableCell>
                                                {question.is_official ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800" title="Official Exam Question">Braindump</span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-neutral-100 text-neutral-600">Unofficial</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                {question.question_number}
                                                {groupId !== undefined && <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800" title={`Group ${groupId}`}>Group {groupId + 1}</span>}
                                            </TableCell>
                                        <TableCell className="max-w-md truncate">{question.question_text}</TableCell>
                                        <TableCell>{question.category}</TableCell>
                                        <TableCell>{question.license_code}</TableCell>
                                        <TableCell>
                                            <span className="truncate max-w-[100px] block">
                                                {sources?.find(s => s.id === question.source_id)?.name || "-"}
                                            </span>
                                        </TableCell>
                                        <TableCell>{question.contains_image ? "Yes" : "No"}</TableCell>
                                        <TableCell className="text-right whitespace-nowrap">
                                            <div className="flex justify-end gap-1">
                                                <Button variant="ghost" size="icon" onClick={() => handleEdit(question)}>
                                                    <Pencil className="h-4 w-4 text-blue-500" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => {
                                                    if (confirm('Are you sure you want to delete this question?')) {
                                                        deleteMutation.mutate(question.id);
                                                    }
                                                }}>
                                                    <Trash2 className="h-4 w-4 text-red-500" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )})
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

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
        </div>
    );
}
