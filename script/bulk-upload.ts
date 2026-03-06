import { db, questions } from '../server/db.js';
import fs from 'fs/promises';
import { z } from 'zod';
import { questionSchema } from '../shared/schema.js';

export async function bulkUpload(filePath: string) {
    try {
        const rawData = await fs.readFile(filePath, "utf-8");
        const data = rawData.replace(/^\uFEFF/, ""); // Strip BOM
        const parsed = JSON.parse(data);

        console.log(`Validating ${parsed.length} questions from ${filePath}...`);
        const result = z.array(questionSchema).safeParse(parsed);

        if (!result.success) {
            console.error("Validation failed:");
            console.error(result.error.issues);
            process.exit(1);
        }

        const validQuestions = result.data;
        console.log(`Validation passed. Uploading ${validQuestions.length} questions to Neon...`);

        // Drizzle bulk insert
        await db.insert(questions).values(validQuestions);
        console.log("Upload complete!");
        process.exit(0);

    } catch (error) {
        console.error("Error during bulk upload:", error);
        process.exit(1);
    }
}

// If run directly from command line
if (process.argv[1]?.includes('bulk-upload')) {
    const fileArg = process.argv[2];
    if (!fileArg) {
        console.error("Please provide the path to the JSON file.");
        console.error("Usage: npx tsx script/bulk-upload.ts <path-to-file.json>");
        process.exit(1);
    }
    bulkUpload(fileArg);
}
