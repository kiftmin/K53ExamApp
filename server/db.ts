import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { pgTable, serial, text, integer, boolean, jsonb, timestamp, real, unique, index } from 'drizzle-orm/pg-core';
import * as dotenv from 'dotenv';

dotenv.config();

if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required');
}

export const client = neon(process.env.DATABASE_URL);
export const db = drizzle(client);

export const sources = pgTable('sources', {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    is_active: boolean('is_active').default(true).notNull()
}, (table) => ({
    nameUnique: unique('sources_name_key').on(table.name),
}));

export const accessCodes = pgTable('access_codes', {
    id: serial('id').primaryKey(),
    code: text('code').notNull(),
    type: text('type').notNull(), // 'daily' | 'weekly' | 'monthly' | 'master'
    mobile_number: text('mobile_number'),
    name: text('name'),
    surname: text('surname'),
    has_admin_access: boolean('has_admin_access').default(false).notNull(),
    expires_at: timestamp('expires_at'),
    is_revoked: boolean('is_revoked').default(false).notNull(),
    created_at: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    codeUnique: unique('access_codes_code_key').on(table.code),
}));

export const suspendedMobiles = pgTable('suspended_mobiles', {
    mobile_number: text('mobile_number').primaryKey(),
    reason: text('reason'),
    suspended_by: text('suspended_by'),
    suspended_at: timestamp('suspended_at').defaultNow().notNull(),
});

export const learnerProfiles = pgTable('learner_profiles', {
    mobile_number: text('mobile_number').primaryKey(),
    name: text('name'),
    surname: text('surname'),
    updated_by: text('updated_by'),
    updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Road Signs study module
export const studySigns = pgTable('study_signs', {
    id: serial('id').primaryKey(),
    heading: text('heading').notNull(),
    subheading: text('subheading').notNull(),
    name: text('name').notNull(),
    codes: jsonb('codes').notNull(), // string[]
    images: jsonb('images').notNull().default('[]'), // { code: string; image_url: string }[]
    where_text: text('where_text'),
    purpose_text: text('purpose_text'),
    action_text: text('action_text'),
    where_text_raw: text('where_text_raw'),
    purpose_text_raw: text('purpose_text_raw'),
    action_text_raw: text('action_text_raw'),
    short_meaning: text('short_meaning'),
    short_action: text('short_action'),
    short_reviewed: boolean('short_reviewed').notNull().default(false),
    needs_split: boolean('needs_split').notNull().default(false),
    is_verified_exam_question: boolean('is_verified_exam_question').default(false).notNull(),
    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull(),
});

export const signQuestions = pgTable('sign_questions', {
    id: serial('id').primaryKey(),
    sign_id: integer('sign_id').references(() => studySigns.id, { onDelete: 'cascade' }).notNull(),
    question_id: integer('question_id').references(() => questions.id, { onDelete: 'cascade' }).notNull(),
});

// Rules of the Road study module
export const studyRules = pgTable('study_rules', {
    id: serial('id').primaryKey(),
    section_ref: text('section_ref').notNull(), // "6.17.1"
    heading: text('heading').notNull(), // "Road Traffic Rules"
    subheading: text('subheading').notNull(), // "Seatbelts"
    title: text('title'),
    question: text('question'), // flashcard prompt generated from body
    body: text('body').notNull(), // atomic rule statement
    body_raw: text('body_raw'),
    applicable_codes: jsonb('applicable_codes').notNull(), // number[] e.g. [0], [1], [2,3]
    is_verified_exam_question: boolean('is_verified_exam_question').default(false).notNull(),
    is_reviewed: boolean('is_reviewed').default(false).notNull(), // LLM-assisted cards: reviewed by a human
    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull(),
});

export const ruleQuestions = pgTable('rule_questions', {
    id: serial('id').primaryKey(),
    rule_id: integer('rule_id').references(() => studyRules.id, { onDelete: 'cascade' }).notNull(),
    question_id: integer('question_id').references(() => questions.id, { onDelete: 'cascade' }).notNull(),
});

// Vehicle Controls study module
export const controlDiagrams = pgTable('control_diagrams', {
    id: serial('id').primaryKey(),
    vehicle_type: text('vehicle_type').notNull(), // 'motorcycle' | 'lmv' | 'hmv'
    gearbox: text('gearbox'), // 'manual' | 'automatic' | null (motorcycle)
    label: text('label').notNull(),
    image_url: text('image_url'),
    is_inferred: boolean('is_inferred').default(false).notNull(),
    created_at: timestamp('created_at').defaultNow().notNull(),
});

export const studyControls = pgTable('study_controls', {
    id: serial('id').primaryKey(),
    diagram_id: integer('diagram_id').references(() => controlDiagrams.id, { onDelete: 'cascade' }).notNull(),
    component_number: integer('component_number'),
    component_name: text('component_name').notNull(),
    function_notes: text('function_notes'),
    applicable_codes: jsonb('applicable_codes').notNull(), // number[] e.g. [1], [2,3], [3]
    is_verified_exam_question: boolean('is_verified_exam_question').default(false).notNull(),
    is_reviewed: boolean('is_reviewed').default(false).notNull(),
    position_x: real('position_x'),
    position_y: real('position_y'),
    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull(),
});

export const controlQuestions = pgTable('control_questions', {
    id: serial('id').primaryKey(),
    control_id: integer('control_id').references(() => studyControls.id, { onDelete: 'cascade' }).notNull(),
    question_id: integer('question_id').references(() => questions.id, { onDelete: 'cascade' }).notNull(),
});

// Learner progress (server-synced mastery state, keyed by mobile number)
export const learnerProgress = pgTable('learner_progress', {
    id: serial('id').primaryKey(),
    mobile_number: text('mobile_number').notNull(),
    item_type: text('item_type').notNull(),   // 'sign' | 'rule' | 'control'
    item_id: integer('item_id').notNull(),
    status: text('status').notNull(),          // 'new' | 'learning' | 'review' | 'mastered'
    correct: integer('correct').default(0).notNull(),
    incorrect: integer('incorrect').default(0).notNull(),
    last_rating: text('last_rating'),
    last_seen_at: timestamp('last_seen_at'),
    updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    uniqueItem: unique('learner_progress_unique_item').on(table.mobile_number, table.item_type, table.item_id),
}));

export const learnerTestRuns = pgTable('learner_test_runs', {
    id: serial('id').primaryKey(),
    mobile_number: text('mobile_number').notNull(),
    run_id: text('run_id').notNull(),
    finished_at: timestamp('finished_at').notNull(),
    payload: jsonb('payload').notNull(),
    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    uniqueRun: unique('learner_test_runs_unique_run').on(table.mobile_number, table.run_id),
    mobileFinishedIdx: index('learner_test_runs_mobile_finished_idx').on(table.mobile_number, table.finished_at.desc()),
}));

// Define Drizzle Postgres Schema matching the Zod schema
export const questions = pgTable('questions', {
    id: serial('id').primaryKey(),
    question_number: integer('question_number').notNull(),
    question_text: text('question_text').notNull(),
    category: integer('category').notNull(),
    license_code: text('license_code').notNull(),
    contains_image: boolean('contains_image').notNull(),
    image_link: text('image_link'),
    options: jsonb('options').notNull(), // Stores array of option objects
    source_id: integer('source_id').references(() => sources.id),
    is_duplicate: boolean('is_duplicate').default(false).notNull(),
    is_official: boolean('is_official').default(false).notNull(),
    source: text('source').notNull().default('System'),
    is_reviewed: boolean('is_reviewed').notNull().default(true),
});
