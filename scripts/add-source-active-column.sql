-- Migration script to add is_active column to sources table
-- Run this script to add the is_active column to the sources table

ALTER TABLE sources ADD COLUMN is_active BOOLEAN DEFAULT true NOT NULL;

-- Set existing sources to active by default
UPDATE sources SET is_active = true WHERE is_active IS NULL;
