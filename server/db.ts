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
