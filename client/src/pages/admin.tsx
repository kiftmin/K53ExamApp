import { useState } from "react";
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
import { ArrowLeft, Upload, Plus, Pencil, Trash2 } from "lucide-react";
import QuestionModal from "@/components/question-modal";

export default function Admin() {
    const { toast } = useToast();
    const [search, setSearch] = useState("");
    const [categoryFilter, setCategoryFilter] = useState<string>("all");
    const [licenseFilter, setLicenseFilter] = useState<string>("all");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);

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
                            <SelectItem value="A">Code A</SelectItem>
                            <SelectItem value="B">Code B</SelectItem>
                            <SelectItem value="C">Code C</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[80px]">ID</TableHead>
                                <TableHead>Question Text</TableHead>
                                <TableHead className="w-[100px]">Category</TableHead>
                                <TableHead className="w-[100px]">License</TableHead>
                                <TableHead className="w-[100px]">Image</TableHead>
                                <TableHead className="text-right w-[120px]">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-neutral-500">Loading questions...</TableCell>
                                </TableRow>
                            ) : filteredQuestions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-neutral-500">No questions found matching your filters.</TableCell>
                                </TableRow>
                            ) : (
                                filteredQuestions.map((question) => (
                                    <TableRow key={question.id}>
                                        <TableCell className="font-medium">{question.id}</TableCell>
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
