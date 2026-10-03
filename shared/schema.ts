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
  is_official: z.boolean().default(false),
  is_reviewed: z.boolean().default(false)
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

// === Road Signs study module ===

export const signImageSchema = z.object({
  code: z.string(),
  image_url: z.string(),
});

export const studySignSchema = z.object({
  id: z.number().optional(),
  heading: z.string(),
  subheading: z.string(),
  name: z.string(),
  codes: z.array(z.string()).min(1),
  images: z.array(signImageSchema).default([]),
  where_text: z.string().nullable().optional(),
  purpose_text: z.string().nullable().optional(),
  action_text: z.string().nullable().optional(),
  is_verified_exam_question: z.boolean().default(false),
});

export type StudySign = z.infer<typeof studySignSchema> & { id: number };
export type InsertStudySign = Omit<z.infer<typeof studySignSchema>, "id">;

// Raw import format — matches Allsigns.json verbatim (pre image-matching)
export const rawSignImportSchema = z.object({
  Heading: z.string(),
  Subheading: z.string(),
  Name: z.string(),
  Codes: z.array(z.string()),
  Where: z.string().optional(),
  Purpose: z.string().optional(),
  Action: z.string().optional(),
});

export type RawSignImport = z.infer<typeof rawSignImportSchema>;

export type SignQuestionLink = { id: number; sign_id: number; question_id: number };

// === Rules of the Road study module ===

export const RULE_APPLICABLE_CODES = [0, 1, 2, 3] as const;

// 0 = code-agnostic, 1 = motorcycle, 2 = light, 3 = heavy
export const studyRuleSchema = z.object({
  id: z.number().optional(),
  section_ref: z.string().min(1),
  heading: z.string().min(1),
  subheading: z.string().min(1),
  title: z.string().nullable().optional(),
  body: z.string().min(1),
  applicable_codes: z.array(z.number().int().min(0).max(3)).min(1),
  is_verified_exam_question: z.boolean().default(false),
  is_reviewed: z.boolean().default(false),
});

export type StudyRule = z.infer<typeof studyRuleSchema> & { id: number };
export type InsertStudyRule = Omit<z.infer<typeof studyRuleSchema>, "id">;

// Raw import format — matches rules-of-the-road-cards.json verbatim
export const rawRuleImportSchema = z.object({
  section_ref: z.string(),
  heading: z.string(),
  subheading: z.string(),
  title: z.string().optional(),
  body: z.string(),
  applicable_codes: z.array(z.number().int().min(0).max(3)),
});

export type RawRuleImport = z.infer<typeof rawRuleImportSchema>;

export type RuleQuestionLink = { id: number; rule_id: number; question_id: number };

// === Vehicle Controls study module ===

export const controlDiagramSchema = z.object({
  id: z.number().optional(),
  vehicle_type: z.enum(["motorcycle", "lmv", "hmv"]),
  gearbox: z.enum(["manual", "automatic"]).nullable().optional(),
  label: z.string(),
  image_url: z.string().nullable().optional(),
  is_inferred: z.boolean().default(false),
});
export type ControlDiagram = z.infer<typeof controlDiagramSchema> & { id: number };
export type InsertControlDiagram = Omit<z.infer<typeof controlDiagramSchema>, "id">;

export const studyControlSchema = z.object({
  id: z.number().optional(),
  diagram_id: z.number(),
  component_number: z.number().int().nullable().optional(),
  component_name: z.string(),
  function_notes: z.string().nullable().optional(),
  applicable_codes: z.array(z.number().int().min(1).max(3)).optional(),
  is_verified_exam_question: z.boolean().default(false),
  is_reviewed: z.boolean().default(false),
});
export type StudyControl = z.infer<typeof studyControlSchema> & { id: number };
export type InsertStudyControl = Omit<z.infer<typeof studyControlSchema>, "id">;

export type ControlQuestionLink = { id: number; control_id: number; question_id: number };

// Raw import shapes (vehicle-controls-import.json)
export const rawControlDiagramSchema = z.object({
  key: z.string(),
  vehicle_type: z.enum(["motorcycle", "lmv", "hmv"]),
  gearbox: z.enum(["manual", "automatic"]).nullable().optional(),
  label: z.string(),
  image_url: z.string().optional(),
  is_inferred: z.boolean().optional().default(false),
});

export const rawStudyControlSchema = z.object({
  diagram_key: z.string(),
  component_number: z.number().int().nullable().optional(),
  component_name: z.string(),
  function_notes: z.string().nullable().optional(),
});

export const rawSampleQuestionSchema = z.object({
  diagram_key: z.string(),
  question_text: z.string(),
  options: z.array(z.string()).min(2),
  correct_index: z.number().int().min(0),
  linked_component_numbers: z.array(z.number().int()).optional().default([]),
});

export const rawControlBundleSchema = z.object({
  control_diagrams: z.array(rawControlDiagramSchema),
  study_controls: z.array(rawStudyControlSchema),
  sample_questions: z.array(rawSampleQuestionSchema).optional().default([]),
  notes: z.array(z.string()).optional(),
});

export type RawControlBundle = z.infer<typeof rawControlBundleSchema>;
