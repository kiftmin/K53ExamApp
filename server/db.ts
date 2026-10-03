import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { pgTable, serial, text, integer, boolean, jsonb, timestamp } from 'drizzle-orm/pg-core';
import * as dotenv from 'dotenv';

dotenv.config();

if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required');
}

export const client = neon(process.env.DATABASE_URL);
export const db = drizzle(client);

export const sources = pgTable('sources', {
    id: serial('id').primaryKey(),
    name: text('name').notNull().unique(),
    is_active: boolean('is_active').default(true).notNull()
});

export const accessCodes = pgTable('access_codes', {
    id: serial('id').primaryKey(),
    code: text('code').notNull().unique(),
    type: text('type').notNull(), // 'daily' | 'weekly' | 'monthly' | 'master'
    mobile_number: text('mobile_number'),
    has_admin_access: boolean('has_admin_access').default(false).notNull(),
    expires_at: timestamp('expires_at'),
    is_revoked: boolean('is_revoked').default(false).notNull(),
    created_at: timestamp('created_at').defaultNow().notNull(),
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
    body: text('body').notNull(), // atomic rule statement
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
    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull(),
});

export const controlQuestions = pgTable('control_questions', {
    id: serial('id').primaryKey(),
    control_id: integer('control_id').references(() => studyControls.id, { onDelete: 'cascade' }).notNull(),
    question_id: integer('question_id').references(() => questions.id, { onDelete: 'cascade' }).notNull(),
});

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
    is_official: boolean('is_official').default(false).notNull()
});
