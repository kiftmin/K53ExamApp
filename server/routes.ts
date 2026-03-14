import { storage } from "./storage.js";
import { api } from "../shared/routes.js";
import { questionSchema, sourceSchema } from "../shared/schema.js";
import { generateAccessCode, validateAccessCode, getTodaySAST, getTimeUntilNextCode } from "./access-code.js";
import { z } from "zod";

export async function registerRoutes(
  _httpServer: any,
  app: any
): Promise<any> {

  app.get(api.questions.list.path, async (req: any, res: any) => {
    try {
      const questions = await storage.getQuestions();
      res.json(questions);
    } catch (err) {
      console.error("Error reading questions:", err);
      res.status(500).json({ message: "Failed to load questions" });
    }
  });

  // === Bulk Question Endpoints ===

  app.post('/api/questions/bulk', async (req: any, res: any) => {
    try {
      const parsed = z.array(questionSchema).parse(req.body);
      await storage.bulkUploadQuestions(parsed);
      res.status(201).json({ message: `Successfully uploaded ${parsed.length} questions.` });
    } catch (err) {
      console.error("Error in bulk upload:", err);
      res.status(400).json({ message: "Invalid format for bulk upload payload", error: err });
    }
  });

  app.post('/api/questions/bulk-source', async (req: any, res: any) => {
    try {
      const { ids, sourceId } = z.object({
        ids: z.array(z.number()),
        sourceId: z.number().nullable()
      }).parse(req.body);

      await storage.bulkUpdateSource(ids, sourceId);
      res.json({ message: `Successfully updated ${ids.length} questions.` });
    } catch (err) {
      console.error("Error in bulk source update:", err);
      res.status(400).json({ message: "Invalid bulk source update payload", error: err });
    }
  });

  app.delete('/api/questions/bulk', async (req: any, res: any) => {
    try {
      const { ids } = z.object({
        ids: z.array(z.number())
      }).parse(req.body);

      await storage.bulkDeleteQuestions(ids);
      res.status(204).send();
    } catch (err) {
      console.error("Error in bulk delete:", err);
      res.status(400).json({ message: "Invalid bulk delete payload", error: err });
    }
  });

  app.post('/api/questions/bulk-official', async (req: any, res: any) => {
    try {
      const { ids, isOfficial } = z.object({
        ids: z.array(z.number()),
        isOfficial: z.boolean()
      }).parse(req.body);

      await storage.bulkUpdateOfficial(ids, isOfficial);
      res.json({ message: `Successfully updated ${ids.length} questions.` });
    } catch (err) {
      console.error("Error in bulk official update:", err);
      res.status(400).json({ message: "Invalid bulk official update payload", error: err });
    }
  });

  // === Individual Question Endpoints ===

  app.post('/api/questions', async (req: any, res: any) => {
    try {
      const parsed = questionSchema.parse(req.body);
      const created = await storage.createQuestion(parsed);
      res.status(201).json(created);
    } catch (err) {
      console.error("Error creating question:", err);
      res.status(400).json({ message: "Invalid question data", error: err });
    }
  });

  app.put('/api/questions/:id', async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const parsed = questionSchema.parse(req.body);
      const updated = await storage.updateQuestion(id, parsed);
      if (!updated) {
        return res.status(404).json({ message: "Question not found" });
      }
      res.json(updated);
    } catch (err) {
      console.error("Error updating question:", err);
      res.status(400).json({ message: "Invalid question data", error: err });
    }
  });

  app.delete('/api/questions/:id', async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteQuestion(id);
      if (!success) {
        return res.status(404).json({ message: "Question not found" });
      }
      res.status(204).send();
    } catch (err) {
      console.error("Error deleting question:", err);
      res.status(500).json({ message: "Failed to delete question", error: err });
    }
  });


  // === Sources Endpoints ===
  
  app.get('/api/sources', async (req: any, res: any) => {
    try {
      const sources = await storage.getSources();
      res.json(sources);
    } catch (err) {
      console.error("Error reading sources:", err);
      res.status(500).json({ message: "Failed to load sources" });
    }
  });

  app.post('/api/sources', async (req: any, res: any) => {
    try {
      const parsed = sourceSchema.parse(req.body);
      const created = await storage.createSource(parsed);
      res.status(201).json(created);
    } catch (err) {
      console.error("Error creating source:", err);
      res.status(400).json({ message: "Invalid source data", error: err });
    }
  });

  app.put('/api/sources/:id', async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const parsed = sourceSchema.parse(req.body);
      const updated = await storage.updateSource(id, parsed);
      if (!updated) {
        return res.status(404).json({ message: "Source not found" });
      }
      res.json(updated);
    } catch (err) {
      console.error("Error updating source:", err);
      res.status(400).json({ message: "Invalid source data", error: err });
    }
  });

  app.delete('/api/sources/:id', async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteSource(id);
      if (!success) {
        return res.status(404).json({ message: "Source not found" });
      }
      res.status(204).send();
    } catch (err) {
      console.error("Error deleting source:", err);
      res.status(500).json({ message: "Failed to delete source", error: err });
    }
  });

  // === Access Code Endpoints ===

  app.get('/api/access-code/today', async (_req: any, res: any) => {
    try {
      const todayDate = getTodaySAST();
      const code = generateAccessCode(todayDate);
      const timeLeft = getTimeUntilNextCode();
      res.json({ code, date: todayDate, expiresIn: timeLeft });
    } catch (err) {
      console.error("Error generating access code:", err);
      res.status(500).json({ message: "Failed to generate access code" });
    }
  });

  app.get('/api/access-code/lookup', async (req: any, res: any) => {
    try {
      const date = req.query.date as string;
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD." });
      }
      const code = generateAccessCode(date);
      res.json({ code, date });
    } catch (err) {
      console.error("Error looking up access code:", err);
      res.status(500).json({ message: "Failed to look up access code" });
    }
  });

  app.post('/api/access-code/validate', async (req: any, res: any) => {
    try {
      const { code } = req.body;
      if (!code || typeof code !== 'string') {
        return res.status(400).json({ valid: false, message: "Code is required." });
      }
      const valid = validateAccessCode(code.trim());
      res.json({ valid });
    } catch (err) {
      console.error("Error validating access code:", err);
      res.status(500).json({ valid: false, message: "Failed to validate access code" });
    }
  });


  return _httpServer;
}