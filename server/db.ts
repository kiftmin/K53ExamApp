import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { pgTable, serial, text, integer, boolean, jsonb } from 'drizzle-orm/pg-core';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required');
}

const sql = neon(process.env.DATABASE_URL);
export const db = drizzle(sql);

// Define Drizzle Postgres Schema matching the Zod schema
export const questions = pgTable('questions', {
    id: serial('id').primaryKey(),
    question_number: integer('question_number').notNull(),
    question_text: text('question_text').notNull(),
    category: integer('category').notNull(),
    license_code: text('license_code').notNull(),
    contains_image: boolean('contains_image').notNull(),
    image_link: text('image_link'),
    options: jsonb('options').notNull() // Stores array of option objects
});
