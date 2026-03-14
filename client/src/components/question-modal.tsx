import * as React from "react";
import { useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Question, InsertQuestion, questionSchema, Source } from "@shared/schema";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

interface QuestionModalProps {
    isOpen: boolean;
    onClose: () => void;
    question?: Question | null;
    currentIndex?: number;
    totalQuestions?: number;
    onNavigate?: (delta: number) => void;
}

const defaultValues: InsertQuestion = {
    question_number: 1,
    question_text: "",
    category: 1,
    license_code: "02",
    contains_image: false,
    image_link: "",
    source_id: null,
    is_duplicate: false,
    is_official: false,
    options: [
        { answer_number: "A", answer_text: "", correct_answer: false },
        { answer_number: "B", answer_text: "", correct_answer: false },
        { answer_number: "C", answer_text: "", correct_answer: false },
    ],
};

export default function QuestionModal({ 
    isOpen, 
    onClose, 
    question,
    currentIndex = -1,
    totalQuestions = 0,
    onNavigate
}: QuestionModalProps) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const form = useForm<InsertQuestion>({
        resolver: zodResolver(questionSchema.omit({ id: true })),
        defaultValues: {
            ...defaultValues,
            ...(question || {})
        },
    });

    const { data: sources } = useQuery<Source[]>({
        queryKey: ["/api/sources"],
    });

    const { fields } = useFieldArray({
        control: form.control,
        name: "options",
    });

    // Reset form when question prop changes (opening modal for edit or add)
    useEffect(() => {
        if (isOpen) {
            const initialValues = {
                ...defaultValues,
                ...(question || {})
            };
            // Clean up the object to match InsertQuestion (remove id if present)
            const { id, ...cleanValues } = initialValues as any;
            form.reset(cleanValues);
        }
    }, [question, isOpen, form]);

    const saveMutation = useMutation({
        mutationFn: async (data: InsertQuestion) => {
            if (question?.id) {
                return apiRequest("PUT", `/api/questions/${question.id}`, data);
            } else {
                return apiRequest("POST", "/api/questions", data);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/questions"] });
            toast({ title: question?.id ? "Question updated" : "Question created" });
            
            // If we're editing (have an id) and have a next question, auto-advance
            if (question?.id && onNavigate && currentIndex < totalQuestions - 1) {
                onNavigate(1);
            } else {
                onClose();
            }
        },
        onError: (error: Error) => {
            toast({ title: "Failed to save question", description: error.message, variant: "destructive" });
        }
    });

    const onSubmit = (data: InsertQuestion) => {
        saveMutation.mutate(data);
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
            <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl rounded-xl">
                <DialogHeader className="px-6 py-4 bg-white border-b flex flex-row items-center justify-between sticky top-0 z-10">
                    <div className="space-y-1">
                        <DialogTitle className="text-xl font-bold text-neutral-900 leading-tight">
                            {question?.id ? "Edit Question" : "Add New Question"}
                        </DialogTitle>
                        <p className="text-xs text-neutral-500 font-medium">
                            {question?.id ? `ID: ${question.id}` : "Create a new exam item"}
                        </p>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        {question?.id && onNavigate && totalQuestions > 0 && (
                            <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-full border">
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => onNavigate(-1)}
                                    disabled={currentIndex <= 0}
                                    className="h-7 w-7 p-0 rounded-full hover:bg-white hover:shadow-sm"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <span className="text-[11px] font-bold px-2 tabular-nums text-neutral-600">
                                    {currentIndex + 1} / {totalQuestions}
                                </span>
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => onNavigate(1)}
                                    disabled={currentIndex >= totalQuestions - 1}
                                    className="h-7 w-7 p-0 rounded-full hover:bg-white hover:shadow-sm"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={onClose}
                            className="h-8 w-8 rounded-full hover:bg-neutral-100"
                        >
                            <span className="sr-only">Close</span>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto bg-neutral-50/50 p-6">
                    <Form {...form}>
                        <form id="question-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-3xl mx-auto">
                            {/* Section 1: Metadata Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <FormField
                                    control={form.control}
                                    name="question_number"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">Q. Number</FormLabel>
                                            <FormControl>
                                                <Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value))} className="h-9 bg-white shadow-xs border-neutral-200 focus-visible:ring-blue-500" />
                                            </FormControl>
                                            <FormMessage className="text-[10px]" />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="category"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">Category</FormLabel>
                                            <FormControl>
                                                <Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value))} className="h-9 bg-white shadow-xs border-neutral-200 focus-visible:ring-blue-500" />
                                            </FormControl>
                                            <FormMessage className="text-[10px]" />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="license_code"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">License Code</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="h-9 bg-white shadow-xs border-neutral-200 focus:ring-blue-500">
                                                        <SelectValue placeholder="Code" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {["00", "01", "02", "03"].map(val => <SelectItem key={val} value={val}>Code {val}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage className="text-[10px]" />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="source_id"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">Source</FormLabel>
                                            <Select 
                                                onValueChange={(val: string) => field.onChange(val === "none" ? null : parseInt(val))} 
                                                value={field.value ? field.value.toString() : "none"}
                                            >
                                                <FormControl>
                                                    <SelectTrigger className="h-9 bg-white shadow-xs border-neutral-200 focus:ring-blue-500">
                                                        <SelectValue placeholder="Source" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="none">None</SelectItem>
                                                    {sources?.map(src => (
                                                        <SelectItem key={src.id} value={src.id.toString()}>
                                                            {src.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage className="text-[10px]" />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            {/* Section 2: Question Content Card */}
                            <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm space-y-5">
                                <FormField
                                    control={form.control}
                                    name="question_text"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">Question Prompt</FormLabel>
                                            <FormControl>
                                                <Textarea 
                                                    {...field} 
                                                    className="w-full min-h-[100px] p-4 text-sm border-neutral-200 rounded-lg focus-visible:ring-blue-500 focus-visible:ring-offset-0 transition-all bg-neutral-50/30 font-medium leading-relaxed"
                                                    placeholder="Enter the question text here..."
                                                />
                                            </FormControl>
                                            <FormMessage className="text-[10px]" />
                                        </FormItem>
                                    )}
                                />

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-2">
                                    <div className="space-y-4">
                                        <h4 className="text-[10px] font-black text-neutral-400 uppercase tracking-widest pl-0.5">Configuration</h4>
                                        <div className="grid gap-2.5">
                                            <FormField
                                                control={form.control}
                                                name="is_official"
                                                render={({ field }) => (
                                                    <div className="flex items-center justify-between p-3 rounded-lg border bg-blue-50/20 border-blue-100 hover:bg-blue-50/40 transition-all group">
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-bold text-blue-900">Official Content</span>
                                                            <span className="text-[10px] text-blue-600/70 font-medium">Verified exam material</span>
                                                        </div>
                                                        <Switch checked={field.value} onCheckedChange={field.onChange} className="data-[state=checked]:bg-blue-600" />
                                                    </div>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="is_duplicate"
                                                render={({ field }) => (
                                                    <div className="flex items-center justify-between p-3 rounded-lg border bg-rose-50/20 border-rose-100 hover:bg-rose-50/40 transition-all">
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-bold text-rose-900">Potential Duplicate</span>
                                                            <span className="text-[10px] text-rose-600/70 font-medium">Flag for review</span>
                                                        </div>
                                                        <Switch checked={field.value} onCheckedChange={field.onChange} className="data-[state=checked]:bg-rose-600" />
                                                    </div>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="contains_image"
                                                render={({ field }) => (
                                                    <div className="flex items-center justify-between p-3 rounded-lg border bg-amber-50/20 border-amber-100 hover:bg-amber-50/40 transition-all">
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-bold text-amber-900">Visual Component</span>
                                                            <span className="text-[10px] text-amber-600/70 font-medium">Attach an image</span>
                                                        </div>
                                                        <Switch checked={field.value} onCheckedChange={field.onChange} className="data-[state=checked]:bg-amber-600" />
                                                    </div>
                                                )}
                                            />
                                        </div>
                                    </div>

                                    <div className="min-h-[140px]">
                                        {form.watch("contains_image") ? (
                                            <div className="bg-neutral-50 rounded-lg p-4 border border-dashed border-neutral-300 h-full flex flex-col justify-between space-y-3">
                                                <FormField
                                                    control={form.control}
                                                    name="image_link"
                                                    render={({ field }) => (
                                                        <FormItem className="space-y-1">
                                                            <FormLabel className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">Image Resource</FormLabel>
                                                            <FormControl>
                                                                <Input {...field} value={field.value || ""} className="h-8 text-xs bg-white border-neutral-200" placeholder="e.g. image_Q101.png" />
                                                            </FormControl>
                                                            <FormMessage className="text-[10px]" />
                                                        </FormItem>
                                                    )}
                                                />
                                                <div className="flex-1 min-h-[80px] relative rounded-md border bg-neutral-900 overflow-hidden flex items-center justify-center group/img">
                                                    {form.watch("image_link") ? (
                                                        <img
                                                            src={form.watch("image_link")?.startsWith('http') ? form.watch("image_link")! : `/assets/images/${form.watch("image_link")}`}
                                                            alt="Preview"
                                                            className="max-h-full max-w-full object-contain transition-transform group-hover/img:scale-105"
                                                            onError={(e: any) => {
                                                                e.target.src = "https://placehold.co/400x225?text=Image+Not+Found";
                                                            }}
                                                        />
                                                    ) : (
                                                        <span className="text-[10px] text-neutral-500 font-bold italic">Image Preview Area</span>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="bg-neutral-100/30 border border-dotted border-neutral-200 rounded-lg h-full flex items-center justify-center">
                                                <p className="text-[11px] text-neutral-400 font-medium italic">No image content attached</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Section 3: Answer Options */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-4">
                                    <h3 className="text-[10px] font-black text-neutral-400 uppercase tracking-widest whitespace-nowrap">Response Options</h3>
                                    <div className="h-px w-full bg-neutral-200/60" />
                                </div>
                                <div className="grid gap-3">
                                    {fields.map((field, index) => (
                                        <div key={field.id} className="flex gap-3 items-start group">
                                            <FormField
                                                control={form.control}
                                                name={`options.${index}.answer_number`}
                                                render={({ field }) => (
                                                    <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center bg-white border border-neutral-200 rounded-lg font-bold text-neutral-500 group-focus-within:border-blue-500 group-focus-within:text-blue-600 group-focus-within:shadow-xs transition-all">
                                                        <input 
                                                            {...field} 
                                                            className="w-full h-full text-center bg-transparent outline-none uppercase" 
                                                        />
                                                    </div>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name={`options.${index}.answer_text`}
                                                render={({ field }) => (
                                                    <div className="flex-1">
                                                        <input 
                                                            {...field} 
                                                            placeholder={`Option ${index + 1} description...`}
                                                            className="h-10 w-full px-4 text-sm bg-white border border-neutral-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none shadow-xs group-hover:border-neutral-300 transition-all font-medium"
                                                        />
                                                    </div>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name={`options.${index}.correct_answer`}
                                                render={({ field }) => (
                                                    <button 
                                                        type="button"
                                                        className={`h-10 px-3 flex items-center gap-2 rounded-lg border transition-all ${field.value ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-xs' : 'bg-white border-neutral-200 text-neutral-400 hover:border-neutral-300'}`}
                                                        onClick={() => field.onChange(!field.value)}
                                                    >
                                                        <span className={`text-[10px] font-black uppercase tracking-tighter ${field.value ? 'opacity-100' : 'opacity-30'}`}>Correct</span>
                                                        <Switch checked={field.value} onCheckedChange={field.onChange} className="scale-50 origin-center data-[state=checked]:bg-emerald-500" />
                                                    </button>
                                                )}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </form>
                    </Form>
                </div>

                <div className="px-6 py-4 bg-white border-t flex justify-between items-center sticky bottom-0 z-10">
                    <div className="flex items-center gap-3">
                        {question?.id ? (
                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-tighter border border-blue-100">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                Editing Mode
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-tighter border border-emerald-100">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                New Record
                            </div>
                        )}
                        <p className="text-[10px] text-neutral-400 font-medium hidden sm:block">Unsaved changes will be lost</p>
                    </div>
                    <div className="flex gap-2">
                        <Button type="button" variant="ghost" size="sm" onClick={onClose} className="h-9 px-4 text-neutral-500 font-bold hover:bg-neutral-100 rounded-lg">
                            Cancel
                        </Button>
                        <Button 
                            form="question-form"
                            type="submit" 
                            size="sm"
                            disabled={saveMutation.isPending}
                            className="h-9 px-6 bg-neutral-900 text-white hover:bg-black font-bold shadow-md shadow-neutral-200 rounded-lg active:scale-[0.98] transition-all"
                        >
                            {saveMutation.isPending ? "Saving..." : question?.id ? "Update Question" : "Create Question"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
