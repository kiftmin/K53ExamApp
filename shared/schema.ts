import { z } from "zod";

export const optionSchema = z.object({
  answer_number: z.string().max(20),
  answer_text: z.string().max(2000),
  correct_answer: z.boolean()
});

export const sourceSchema = z.object({
  id: z.number().optional(),
  name: z.string().max(200),
  is_active: z.boolean().default(true)
});

export const questionSchema = z.object({
  id: z.number().optional(),
  question_number: z.number().int().min(0).max(100000),
  question_text: z.string().max(5000),
  category: z.number().int().min(1).max(10),
  license_code: z.string().max(20),
  contains_image: z.boolean(),
  image_link: z.string().max(2048).nullable(),
  options: z.array(optionSchema).max(20),
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

// Question license codes. 00 is the general pool; 01–03 are vehicle-specific.
export const LICENSE_CODES = ["00", "01", "02", "03"] as const;
export const LEARNER_LICENSE_CODES = ["01", "02", "03"] as const;

const LEGACY_LICENSE_CODES: Record<string, string> = { "1": "01", "2": "02", "3": "03" };

// Older builds stored 1/2/3 (e.g. in localStorage); normalize on read.
export function normalizeLicenseCode(value: string | null | undefined, fallback = "02"): string {
  const trimmed = (value ?? "").trim();
  const mapped = LEGACY_LICENSE_CODES[trimmed] ?? trimmed;
  return (LICENSE_CODES as readonly string[]).includes(mapped) ? mapped : fallback;
}

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
  code: z.string().max(20),
  type: z.enum(ACCESS_CODE_TYPES),
  mobile_number: z.string().max(20).nullable().optional(),
  name: z.string().max(200).nullable().optional(),
  surname: z.string().max(200).nullable().optional(),
  has_admin_access: z.boolean().default(false),
  expires_at: z.coerce.date().nullable().optional(),
  is_revoked: z.boolean().default(false),
  created_at: z.coerce.date().optional(),
});

export type AccessCode = z.infer<typeof accessCodeSchema> & { id: number };
export type InsertAccessCode = Omit<z.infer<typeof accessCodeSchema>, "id" | "created_at">;

export const suspendedMobileSchema = z.object({
  mobile_number: z.string().max(20),
  reason: z.string().max(500).nullable().optional(),
  suspended_by: z.string().max(20).nullable().optional(),
  suspended_at: z.coerce.date().optional(),
});

export type SuspendedMobile = z.infer<typeof suspendedMobileSchema> & { suspended_at: Date };
export type InsertSuspendedMobile = Pick<SuspendedMobile, "mobile_number" | "reason" | "suspended_by">;

export const learnerProfileSchema = z.object({
  mobile_number: z.string().max(20),
  name: z.string().max(200).nullable().optional(),
  surname: z.string().max(200).nullable().optional(),
  updated_by: z.string().max(20).nullable().optional(),
  updated_at: z.coerce.date().optional(),
});

export type LearnerProfile = z.infer<typeof learnerProfileSchema> & { updated_at: Date };
export type InsertLearnerProfile = Pick<LearnerProfile, "mobile_number" | "name" | "surname" | "updated_by">;

export type AdminUserStatus = "active" | "expired" | "revoked" | "suspended" | "no_access";

export interface AdminUserSummary {
  mobile_number: string;
  name: string | null;
  surname: string | null;
  access_type: AccessCodeType | null;
  access_code: string | null;
  expires_at: string | null;
  has_admin_access: boolean;
  status: AdminUserStatus;
  suspended: boolean;
  suspended_at: string | null;
  suspension_reason: string | null;
  code_count: number;
  active_code_count: number;
  progress_count: number;
  test_count: number;
  last_activity_at: string | null;
}

export const MOBILE_NUMBER_REGEX = /^\d{10}$/;

// === Road Signs study module ===

export const signImageSchema = z.object({
  code: z.string().max(40),
  image_url: z.string().max(2048),
});

export const studySignSchema = z.object({
  id: z.number().optional(),
  heading: z.string().max(300),
  subheading: z.string().max(300),
  name: z.string().max(300),
  codes: z.array(z.string().max(40)).min(1).max(20),
  images: z.array(signImageSchema).max(20).default([]),
  where_text: z.string().max(5000).nullable().optional(),
  purpose_text: z.string().max(5000).nullable().optional(),
  action_text: z.string().max(5000).nullable().optional(),
  short_meaning: z.string().max(2000).nullable().optional(),
  short_action: z.string().max(2000).nullable().optional(),
  short_reviewed: z.boolean().default(false),
  needs_split: z.boolean().default(false),
  is_verified_exam_question: z.boolean().default(false),
});

export type StudySign = z.infer<typeof studySignSchema> & { id: number };
export type InsertStudySign = Omit<z.infer<typeof studySignSchema>, "id">;

// Drafted short text import (one entry per existing sign id)
export const signShortTextImportSchema = z.object({
  id: z.number().int().positive(),
  short_meaning: z.string().max(2000).nullable(),
  short_action: z.string().max(2000).nullable(),
  needs_split: z.boolean(),
});
export type SignShortTextImport = z.infer<typeof signShortTextImportSchema>;

// Raw import format — matches Allsigns.json verbatim (pre image-matching)
export const rawSignImportSchema = z.object({
  Heading: z.string().max(300),
  Subheading: z.string().max(300),
  Name: z.string().max(300),
  Codes: z.array(z.string().max(40)).max(20),
  Where: z.string().max(5000).optional(),
  Purpose: z.string().max(5000).optional(),
  Action: z.string().max(5000).optional(),
});

export type RawSignImport = z.infer<typeof rawSignImportSchema>;

export type SignQuestionLink = { id: number; sign_id: number; question_id: number };

// === Rules of the Road study module ===

export const RULE_APPLICABLE_CODES = [0, 1, 2, 3] as const;

// 0 = code-agnostic, 1 = motorcycle, 2 = light, 3 = heavy
export const studyRuleSchema = z.object({
  id: z.number().optional(),
  section_ref: z.string().min(1).max(100),
  heading: z.string().min(1).max(300),
  subheading: z.string().min(1).max(300),
  title: z.string().max(500).nullable().optional(),
  question: z.string().max(2000).nullable().optional(),
  body: z.string().min(1).max(20000),
  applicable_codes: z.array(z.number().int().min(0).max(3)).min(1).max(4),
  is_verified_exam_question: z.boolean().default(false),
  is_reviewed: z.boolean().default(false),
});

export type StudyRule = z.infer<typeof studyRuleSchema> & { id: number };
export type InsertStudyRule = Omit<z.infer<typeof studyRuleSchema>, "id">;

// Raw import format — matches rules-of-the-road-cards.json verbatim
export const rawRuleImportSchema = z.object({
  section_ref: z.string().max(100),
  heading: z.string().max(300),
  subheading: z.string().max(300),
  title: z.string().max(500).optional(),
  body: z.string().max(20000),
  applicable_codes: z.array(z.number().int().min(0).max(3)).max(4),
});

export type RawRuleImport = z.infer<typeof rawRuleImportSchema>;

export type RuleQuestionLink = { id: number; rule_id: number; question_id: number };

// === Vehicle Controls study module ===

export const controlDiagramSchema = z.object({
  id: z.number().optional(),
  vehicle_type: z.enum(["motorcycle", "lmv", "hmv"]),
  gearbox: z.enum(["manual", "automatic"]).nullable().optional(),
  label: z.string().max(300),
  image_url: z.string().max(2048).nullable().optional(),
  is_inferred: z.boolean().default(false),
});
export type ControlDiagram = z.infer<typeof controlDiagramSchema> & { id: number };
export type InsertControlDiagram = Omit<z.infer<typeof controlDiagramSchema>, "id">;

export const studyControlSchema = z.object({
  id: z.number().optional(),
  diagram_id: z.number(),
  component_number: z.number().int().nullable().optional(),
  component_name: z.string().max(300),
  function_notes: z.string().max(5000).nullable().optional(),
  applicable_codes: z.array(z.number().int().min(1).max(3)).max(3).optional(),
  is_verified_exam_question: z.boolean().default(false),
  is_reviewed: z.boolean().default(false),
  position_x: z.number().min(0).max(100).nullable().optional(),
  position_y: z.number().min(0).max(100).nullable().optional(),
});
export type StudyControl = z.infer<typeof studyControlSchema> & { id: number };
export type InsertStudyControl = Omit<z.infer<typeof studyControlSchema>, "id">;

export type ControlQuestionLink = { id: number; control_id: number; question_id: number };

// Raw import shapes (vehicle-controls-import.json)
export const rawControlDiagramSchema = z.object({
  key: z.string().max(100),
  vehicle_type: z.enum(["motorcycle", "lmv", "hmv"]),
  gearbox: z.enum(["manual", "automatic"]).nullable().optional(),
  label: z.string().max(300),
  image_url: z.string().max(2048).optional(),
  is_inferred: z.boolean().optional().default(false),
});

export const rawStudyControlSchema = z.object({
  diagram_key: z.string().max(100),
  component_number: z.number().int().nullable().optional(),
  component_name: z.string().max(300),
  function_notes: z.string().max(5000).nullable().optional(),
});

export const rawSampleQuestionSchema = z.object({
  diagram_key: z.string().max(100),
  question_text: z.string().max(2000),
  options: z.array(z.string().max(1000)).min(2).max(10),
  correct_index: z.number().int().min(0),
  linked_component_numbers: z.array(z.number().int()).max(50).optional().default([]),
});

export const rawControlBundleSchema = z.object({
  control_diagrams: z.array(rawControlDiagramSchema).max(500),
  study_controls: z.array(rawStudyControlSchema).max(2000),
  sample_questions: z.array(rawSampleQuestionSchema).max(500).optional().default([]),
  notes: z.array(z.string().max(2000)).max(500).optional(),
});

export type RawControlBundle = z.infer<typeof rawControlBundleSchema>;

// === Learner progress (server-synced mastery state, keyed by mobile number) ===

export const learnerProgressSchema = z.object({
  id: z.number().optional(),
  mobile_number: z.string().max(20),
  item_type: z.enum(['sign', 'rule', 'control', 'question']),
  item_id: z.number().int(),
  status: z.enum(['new', 'learning', 'review', 'mastered']),
  correct: z.number().default(0),
  incorrect: z.number().default(0),
  last_rating: z.string().nullable().optional(),
  last_seen_at: z.coerce.date().nullable().optional(),
  updated_at: z.coerce.date().optional(),
});

export type LearnerProgressRow = z.infer<typeof learnerProgressSchema> & { id: number };
export type InsertLearnerProgress = Omit<z.infer<typeof learnerProgressSchema>, "id">;

export const learnerProgressUpsertSchema = z.object({
  code: z.string().min(1).max(20),
  mobileNumber: z.string().min(1).max(20),
  item_type: z.enum(['sign', 'rule', 'control', 'question']),
  item_id: z.number().int().positive(),
  status: z.enum(['new', 'learning', 'review', 'mastered']),
  correct: z.number().int().min(0).max(1000000).default(0),
  incorrect: z.number().int().min(0).max(1000000).default(0),
  last_rating: z.string().max(20).nullable().optional(),
  last_seen_at: z.coerce.date().nullable().optional(),
});

// === Completed test history (server-synced, keyed by mobile number) ===

export const testHistoryRunSchema = z.object({
  id: z.string().min(1).max(128),
  finishedAt: z.string().refine((value) => !Number.isNaN(new Date(value).getTime()), {
    message: "Invalid finishedAt timestamp",
  }),
  name: z.string().max(200),
  surname: z.string().max(200),
  licenseCode: z.string().max(20),
  category: z.number().int(),
  testType: z.enum(["category", "simulation"]),
  items: z.array(
    z.object({
      id: z.number().int(),
      number: z.number().int(),
    })
  ).max(300),
  answers: z.record(z.string().max(64), z.string().max(64)).refine(
    (answers) => Object.keys(answers).length <= 300,
    { message: "Too many answers" },
  ),
  correct: z.number().int().min(0),
  total: z.number().int().min(1).max(300),
  percentage: z.number().int().min(0).max(100),
  categories: z.array(
    z.object({
      categoryId: z.number().int(),
      correct: z.number().int(),
      total: z.number().int(),
      pass: z.boolean(),
    })
  ).max(10),
  overallPass: z.boolean(),
  elapsedSeconds: z.number().int().min(0),
});

export type TestHistoryRunPayload = z.infer<typeof testHistoryRunSchema>;

export const testHistorySyncSchema = z.object({
  code: z.string().min(1),
  mobileNumber: z.string().min(1),
  run: testHistoryRunSchema,
});

export type InsertTestHistoryRun = {
  mobile_number: string;
  run_id: string;
  finished_at: Date;
  payload: TestHistoryRunPayload;
};
