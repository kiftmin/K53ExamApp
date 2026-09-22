import { z } from "zod";

export const optionSchema = z.object({
  answer_number: z.string(),
  answer_text: z.string(),
  correct_answer: z.boolean()
});

export const sourceSchema = z.object({
  id: z.number().optional(),
  name: z.string(),
  is_active: z.boolean().default(true)
});

export const questionSchema = z.object({
  id: z.number().optional(),
  question_number: z.number(),
  question_text: z.string(),
  category: z.number(),
  license_code: z.string(),
  contains_image: z.boolean(),
  image_link: z.string().nullable(),
  options: z.array(optionSchema),
  source_id: z.number().nullable().optional(),
  is_duplicate: z.boolean().default(false),
  is_official: z.boolean().default(false)
});

export type Option = z.infer<typeof optionSchema>;
export type Source = z.infer<typeof sourceSchema> & { id: number };
export type InsertSource = Omit<z.infer<typeof sourceSchema>, "id">;

export type Question = z.infer<typeof questionSchema> & { id: number };
export type InsertQuestion = Omit<z.infer<typeof questionSchema>, "id">;

export const CATEGORY_NAMES: Record<number, string> = {
  1: "Rules",
  2: "Signs",
  3: "Controls"
};

export const ACCESS_CODE_TYPES = ["daily", "weekly", "monthly", "master"] as const;
export type AccessCodeType = (typeof ACCESS_CODE_TYPES)[number];

export const ACCESS_CODE_PREFIX: Record<AccessCodeType, string> = {
  daily: "D",
  weekly: "W",
  monthly: "M",
  master: "X",
};

export const accessCodeSchema = z.object({
  id: z.number().optional(),
  code: z.string(),
  type: z.enum(ACCESS_CODE_TYPES),
  mobile_number: z.string().nullable().optional(),
  has_admin_access: z.boolean().default(false),
  expires_at: z.coerce.date().nullable().optional(),
  is_revoked: z.boolean().default(false),
  created_at: z.coerce.date().optional(),
});

export type AccessCode = z.infer<typeof accessCodeSchema> & { id: number };
export type InsertAccessCode = Omit<z.infer<typeof accessCodeSchema>, "id" | "created_at">;

export const MOBILE_NUMBER_REGEX = /^\d{10}$/;
