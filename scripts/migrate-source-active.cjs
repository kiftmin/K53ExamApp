/**
 * Migration script to add is_active column to sources table
 * Run with: node scripts/migrate-source-active.cjs
 */

const { neon } = require('@neondatabase/serverless');
const { drizzle } = require('drizzle-orm/neon-http');
const dotenv = require('dotenv');

dotenv.config();

if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

async function migrate() {
    console.log('Starting migration: adding is_active column to sources table...');

    try {
        // Check if column already exists
        const checkResult = await sql`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'sources' AND column_name = 'is_active'
        `;

        if (checkResult.length > 0) {
            console.log('Column is_active already exists. Skipping...');
        } else {
            // Add the column
            await sql`
                ALTER TABLE sources ADD COLUMN is_active BOOLEAN DEFAULT true NOT NULL
            `;
            console.log('Column is_active added successfully!');
        }

        // Set any NULL values to true (in case they exist)
        await sql`
            UPDATE sources SET is_active = true WHERE is_active IS NULL
        `;
        console.log('Migration completed successfully!');

    } catch (error) {
        console.error('Migration failed:', error.message);
        process.exit(1);
    }

    process.exit(0);
}

migrate();
