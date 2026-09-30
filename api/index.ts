import express, { type Request, type Response, type NextFunction } from "express";
import { registerRoutes } from "../server/routes.js";
import { createServer } from "http";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { db, questions, client } from "../server/db.js";
import { z } from "zod";
import { questionSchema } from "../shared/schema.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false }));

// Logging middleware for Vercel logs
app.use((req: any, res: any, next: any) => {
    const start = Date.now();
    res.on("finish", () => {
        const duration = Date.now() - start;
        const path = req.path || req.url;
        if (path.startsWith("/api")) {
            console.log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
        }
    });
    if (typeof next === 'function') next();
});

const httpServer = createServer(app);

// Initialize routes using top-level await (supported in Node.js 18+ ESM)
await registerRoutes(httpServer as any, app as any);

// TEMPORARY SEED ROUTE
app.get("/api/seed", async (req: any, res: any) => {
    try {
        console.log("Initialzing Neon table creation...");
        // Ensure the table exists since drizzle-kit push failed in CI
        await client`
          CREATE TABLE IF NOT EXISTS questions (
            id SERIAL PRIMARY KEY,
            question_number INTEGER NOT NULL,
            question_text TEXT NOT NULL,
            category INTEGER NOT NULL,
            license_code TEXT NOT NULL,
            contains_image BOOLEAN NOT NULL,
            image_link TEXT,
            options JSONB NOT NULL
          );
        `;
        console.log("Table 'questions' is confirmed ready over Neon HTTP.");

        const dataPath = path.join(__dirname, "../server/data/questiondata.json");
        const rawData = await fs.readFile(dataPath, "utf-8");
        const data = rawData.replace(/^\uFEFF/, ""); // Strip BOM
        const parsed = JSON.parse(data);

        const result = z.array(questionSchema).safeParse(parsed);
        if (!result.success) {
            return res.status(400).json({ error: "Validation failed", details: result.error.issues });
        }

        const validQuestions = result.data;
        console.log(`Uploading ${validQuestions.length} questions to Neon...`);
        await db.insert(questions).values(validQuestions);

        res.json({ success: true, message: `Successfully seeded ${validQuestions.length} questions to Neon database.` });
    } catch (error: any) {
        console.error("Seeding error:", error);
        res.status(500).json({ error: "Seeding failed", details: error.message });
    }
});

// TABLE-ONLY seed for the Road Signs study module.
// Safe to re-run: creates tables if missing, inserts no data.
app.get("/api/seed/signs", async (_req: any, res: any) => {
    try {
        await client`
          CREATE TABLE IF NOT EXISTS study_signs (
            id SERIAL PRIMARY KEY,
            heading TEXT NOT NULL,
            subheading TEXT NOT NULL,
            name TEXT NOT NULL,
            codes JSONB NOT NULL,
            images JSONB NOT NULL DEFAULT '[]',
            where_text TEXT,
            purpose_text TEXT,
            action_text TEXT,
            is_verified_exam_question BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
          );
        `;
        await client`
          CREATE TABLE IF NOT EXISTS sign_questions (
            id SERIAL PRIMARY KEY,
            sign_id INTEGER NOT NULL REFERENCES study_signs(id) ON DELETE CASCADE,
            question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE
          );
        `;
        res.json({ success: true, message: "Tables 'study_signs' and 'sign_questions' are ready." });
    } catch (error: any) {
        console.error("Sign seed error:", error);
        res.status(500).json({ error: "Sign table creation failed", details: error.message });
    }
});

// Global Error Handler
app.use((err: any, _req: any, res: any, _next: any) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("Vercel API Error:", err);
    res.status(status).json({ message });
});

export default app;
