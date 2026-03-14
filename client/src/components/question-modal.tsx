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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight } from "lucide-react";

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
        onError: (error) => {
            toast({ title: "Failed to save question", description: error.message, variant: "destructive" });
        }
    });

    const onSubmit = (data: InsertQuestion) => {
        saveMutation.mutate(data);
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader className="flex flex-row items-center justify-between pr-8">
                    <DialogTitle>{question?.id ? "Edit Question" : "Add New Question"}</DialogTitle>
                    {question?.id && onNavigate && totalQuestions > 0 && (
                        <div className="flex items-center gap-2">
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => onNavigate(-1)}
                                disabled={currentIndex <= 0}
                                className="h-8 w-8 p-0"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="text-sm font-medium tabular-nums">
                                {currentIndex + 1} / {totalQuestions}
                            </span>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => onNavigate(1)}
                                disabled={currentIndex >= totalQuestions - 1}
                                className="h-8 w-8 p-0"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="question_number"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Question Number</FormLabel>
                                        <FormControl>
                                            <Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value))} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="category"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Category</FormLabel>
                                        <FormControl>
                                            <Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value))} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="license_code"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>License Code</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select code" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="00">Code 00</SelectItem>
                                                <SelectItem value="01">Code 01</SelectItem>
                                                <SelectItem value="02">Code 02</SelectItem>
                                                <SelectItem value="03">Code 03</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="question_text"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Question Text</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="source_id"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Question Source</FormLabel>
                                        <Select 
                                            onValueChange={(val) => field.onChange(val === "none" ? null : parseInt(val))} 
                                            value={field.value ? field.value.toString() : "none"}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select Source" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="none">No Source</SelectItem>
                                                {sources?.map(src => (
                                                    <SelectItem key={src.id} value={src.id.toString()}>
                                                        {src.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="flex flex-col gap-3 justify-end">
                                <FormField
                                    control={form.control}
                                    name="is_official"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3 shadow-sm bg-neutral-50/50">
                                            <FormControl>
                                                <Checkbox
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                />
                                            </FormControl>
                                            <div className="space-y-1 leading-none">
                                                <FormLabel className="cursor-pointer">Official Exam (Brain Dump)</FormLabel>
                                            </div>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="is_duplicate"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3 shadow-sm bg-red-50/30">
                                            <FormControl>
                                                <Checkbox
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                />
                                            </FormControl>
                                            <div className="space-y-1 leading-none">
                                                <FormLabel className="cursor-pointer text-red-700">Mark as Duplicate</FormLabel>
                                            </div>
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>

                        <FormField
                            control={form.control}
                            name="contains_image"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm">
                                    <FormControl>
                                        <Checkbox
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                    <div className="space-y-1 leading-none">
                                        <FormLabel>Contains Image</FormLabel>
                                    </div>
                                </FormItem>
                            )}
                        />

                        {form.watch("contains_image") && (
                            <FormField
                                control={form.control}
                                name="image_link"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Image Link / Filename</FormLabel>
                                        <FormControl>
                                            <Input {...field} value={field.value || ""} />
                                        </FormControl>
                                        {field.value && (
                                            <div className="mt-4 border rounded-md p-4 flex justify-center bg-neutral-50 overflow-hidden">
                                                <img
                                                    src={field.value.startsWith('http') ? field.value : `/assets/images/${field.value}`}
                                                    alt="Question preview"
                                                    className="max-h-48 object-contain"
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).src = "https://placehold.co/400x300?text=Image+Not+Found";
                                                    }}
                                                />
                                            </div>
                                        )}
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

                        <div className="space-y-4">
                            <h3 className="font-medium text-lg">Options</h3>
                            {fields.map((field, index) => (
                                <div key={field.id} className="grid grid-cols-[auto_1fr_auto] gap-4 items-end border p-4 rounded-md relative">
                                    <FormField
                                        control={form.control}
                                        name={`options.${index}.answer_number`}
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Letter</FormLabel>
                                                <FormControl>
                                                    <Input className="w-16" {...field} />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name={`options.${index}.answer_text`}
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Answer Text</FormLabel>
                                                <FormControl>
                                                    <Input {...field} />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name={`options.${index}.correct_answer`}
                                        render={({ field }) => (
                                            <FormItem className="flex flex-row items-end space-x-2 space-y-0 pb-3">
                                                <FormControl>
                                                    <Checkbox
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                    />
                                                </FormControl>
                                                <FormLabel className="font-normal cursor-pointer text-sm mb-0">Correct</FormLabel>
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-end gap-2 pt-4 border-t">
                            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                            <Button type="submit" disabled={saveMutation.isPending}>
                                {saveMutation.isPending ? "Saving..." : "Save Question"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
