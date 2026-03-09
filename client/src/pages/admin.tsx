import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Question } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { ArrowLeft, Upload, Plus, Pencil, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Clock, Copy, Search } from "lucide-react";
import QuestionModal from "@/components/question-modal";
export default function Admin() {
    const { toast } = useToast();
    const [search, setSearch] = useState("");
    const [categoryFilter, setCategoryFilter] = useState<string>("all");
    const [licenseFilter, setLicenseFilter] = useState<string>("all");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
    const [sortConfig, setSortConfig] = useState<{ key: keyof Question; direction: 'asc' | 'desc' } | null>(null);

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

    const filteredQuestions = questions?.filter(q => {
        const matchesSearch = q.question_text.toLowerCase().includes(search.toLowerCase());
        const matchesCategory = categoryFilter === "all" || q.category.toString() === categoryFilter;
        const matchesLicense = licenseFilter === "all" || q.license_code === licenseFilter;
        return matchesSearch && matchesCategory && matchesLicense;
    }) || [];

    const sortedQuestions = [...filteredQuestions].sort((a, b) => {
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
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
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
                                <TableHead className="w-[120px] cursor-pointer hover:bg-neutral-100" onClick={() => handleSort('contains_image')}>
                                    Image <SortIcon columnKey="contains_image" />
                                </TableHead>
                                <TableHead className="text-right w-[120px]">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-neutral-500">Loading questions...</TableCell>
                                </TableRow>
                            ) : sortedQuestions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-neutral-500">No questions found matching your filters.</TableCell>
                                </TableRow>
                            ) : (
                                sortedQuestions.map((question) => (
                                    <TableRow key={question.id}>
                                        <TableCell className="font-medium">{question.question_number}</TableCell>
                                        <TableCell className="max-w-md truncate">{question.question_text}</TableCell>
                                        <TableCell>{question.category}</TableCell>
                                        <TableCell>{question.license_code}</TableCell>
                                        <TableCell>{question.contains_image ? "Yes" : "No"}</TableCell>
                                        <TableCell className="text-right whitespace-nowrap">
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
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <QuestionModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                question={selectedQuestion}
            />
        </div>
    );
}
