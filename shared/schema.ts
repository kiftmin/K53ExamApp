import { z } from "zod";

export const optionSchema = z.object({
  answer_number: z.string(),
  answer_text: z.string(),
  correct_answer: z.boolean()
});

export const questionSchema = z.object({
  id: z.number().optional(),
  question_number: z.number(),
  question_text: z.string(),
  category: z.number(),
  license_code: z.string(),
  contains_image: z.boolean(),
  image_link: z.string().nullable(),
  options: z.array(optionSchema)
});

export type Option = z.infer<typeof optionSchema>;
export type Question = z.infer<typeof questionSchema> & { id: number };
export type InsertQuestion = Omit<z.infer<typeof questionSchema>, "id">;
