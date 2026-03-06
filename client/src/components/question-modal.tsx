import { useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Question, InsertQuestion, questionSchema } from "@shared/schema";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface QuestionModalProps {
    isOpen: boolean;
    onClose: () => void;
    question?: Question | null;
}

const defaultValues: InsertQuestion = {
    question_number: 1,
    question_text: "",
    category: 1,
    license_code: "B",
    contains_image: false,
    image_link: "",
    options: [
        { answer_number: "A", answer_text: "", correct_answer: false },
        { answer_number: "B", answer_text: "", correct_answer: false },
        { answer_number: "C", answer_text: "", correct_answer: false },
    ],
};

export default function QuestionModal({ isOpen, onClose, question }: QuestionModalProps) {
    const { toast } = useToast();
    const form = useForm<InsertQuestion>({
        resolver: zodResolver(questionSchema.omit({ id: true })),
        defaultValues: question || defaultValues,
    });

    const { fields } = useFieldArray({
        control: form.control,
        name: "options",
    });

    // Reset form when question prop changes (opening modal for edit or add)
    useEffect(() => {
        if (isOpen) {
            form.reset(question || defaultValues);
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
            onClose();
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
                <DialogHeader>
                    <DialogTitle>{question?.id ? "Edit Question" : "Add New Question"}</DialogTitle>
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
                                            <Input type="number" {...field} onChange={(e: React.ChangeEvent<HTMLInputElement>) => field.onChange(parseInt(e.target.value))} />
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
                                            <Input type="number" {...field} onChange={(e: React.ChangeEvent<HTMLInputElement>) => field.onChange(parseInt(e.target.value))} />
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
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
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
