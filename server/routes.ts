import { storage } from "./storage.js";
import { api } from "../shared/routes.js";
import { questionSchema, sourceSchema, MOBILE_NUMBER_REGEX } from "../shared/schema.js";
import {
  generateAccessCode,
  generateDailyCode,
  generateOnDemandCode,
  getExpiryForType,
  getTimeUntilNextCode,
  getTodaySAST,
  getTypeFromCode,
  requiresMobile,
  validateDailyCode,
  isValidMobile,
  type AccessCodeType,
} from "./access-code.js";
import { getAdminEmail, isSmtpConfigured, sendAdminEmail } from "./mailer.js";
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

  app.post('/api/questions/bulk-category', async (req: any, res: any) => {
    try {
      const { ids, category } = z.object({
        ids: z.array(z.number()),
        category: z.number()
      }).parse(req.body);

      await storage.bulkUpdateCategory(ids, category);
      res.json({ message: `Successfully updated ${ids.length} questions.` });
    } catch (err) {
      console.error("Error in bulk category update:", err);
      res.status(400).json({ message: "Invalid bulk category update payload", error: err });
    }
  });

  app.post('/api/questions/bulk-duplicate', async (req: any, res: any) => {
    try {
      const { ids, isDuplicate } = z.object({
        ids: z.array(z.number()),
        isDuplicate: z.boolean()
      }).parse(req.body);

      await storage.bulkUpdateDuplicate(ids, isDuplicate);
      res.json({ message: `Successfully updated ${ids.length} questions.` });
    } catch (err) {
      console.error("Error in bulk duplicate update:", err);
      res.status(400).json({ message: "Invalid bulk duplicate update payload", error: err });
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

  app.get('/api/sources/active', async (req: any, res: any) => {
    try {
      const sources = await storage.getActiveSources();
      res.json(sources);
    } catch (err) {
      console.error("Error reading active sources:", err);
      res.status(500).json({ message: "Failed to load active sources" });
    }
  });

  app.get('/api/sources/active-ids', async (req: any, res: any) => {
    try {
      const sources = await storage.getActiveSources();
      res.json(sources.map(s => s.id));
    } catch (err) {
      console.error("Error reading active source IDs:", err);
      res.status(500).json({ message: "Failed to load active source IDs" });
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

  app.patch('/api/sources/:id/active', async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const { isActive } = z.object({
        isActive: z.boolean()
      }).parse(req.body);

      const updated = await storage.toggleSourceActive(id, isActive);
      if (!updated) {
        return res.status(404).json({ message: "Source not found" });
      }
      res.json(updated);
    } catch (err) {
      console.error("Error toggling source active status:", err);
      res.status(400).json({ message: "Invalid request", error: err });
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

  // === Access Code Endpoints (D/W/M/X) ===

  app.get('/api/access-code/today', async (_req: any, res: any) => {
    try {
      const todayDate = getTodaySAST();
      const code = generateDailyCode(todayDate);
      const timeLeft = getTimeUntilNextCode();
      res.json({ code, date: todayDate, expiresIn: timeLeft, type: 'daily' });
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
      const code = generateDailyCode(date);
      res.json({ code, date, type: 'daily' });
    } catch (err) {
      console.error("Error looking up access code:", err);
      res.status(500).json({ message: "Failed to look up access code" });
    }
  });

  // Unified login validation:
  // - Daily (D...): no mobile required. Accepts today's deterministic code
  //   OR an unexpired on-demand daily code from DB.
  // - Weekly/Monthly/Master (W/M/X...): requires 10-digit mobile linked at creation.
  app.post('/api/access-code/validate', async (req: any, res: any) => {
    try {
      const { code, mobileNumber } = z.object({
        code: z.string().min(1),
        mobileNumber: z.string().optional().nullable(),
      }).parse(req.body);

      const normalized = code.trim().toUpperCase();
      const type = getTypeFromCode(normalized);

      if (!type) {
        return res.json({ valid: false, message: "Unknown code type. Codes start with D, W, M or X." });
      }

      if (type === 'daily') {
        // 1) Deterministic daily code for today
        if (validateDailyCode(normalized)) {
          return res.json({ valid: true, type });
        }
        // 2) On-demand daily codes stored in DB
        const stored = await storage.getAccessCodeByCode(normalized);
        if (stored && stored.type === 'daily' && !stored.is_revoked) {
          if (stored.expires_at && new Date(stored.expires_at).getTime() < Date.now()) {
            return res.json({ valid: false, type, message: "Daily code expired." });
          }
          return res.json({ valid: true, type });
        }
        return res.json({ valid: false, type, message: "Invalid daily code." });
      }

      // W / M / X require linked mobile number
      const mobile = (mobileNumber || '').trim();
      if (!isValidMobile(mobile)) {
        return res.json({ valid: false, type, requiresMobile: true, message: "A 10-digit mobile number is required for this code." });
      }
      const stored = await storage.getAccessCodeByCode(normalized);
      if (!stored || stored.type !== type || stored.is_revoked) {
        return res.json({ valid: false, type, requiresMobile: true, message: "Invalid code." });
      }
      if ((stored.mobile_number || '').trim() !== mobile) {
        return res.json({ valid: false, type, requiresMobile: true, message: "Mobile number does not match this code." });
      }
      if (stored.expires_at && new Date(stored.expires_at).getTime() < Date.now()) {
        return res.json({ valid: false, type, requiresMobile: true, message: "Code expired." });
      }
      return res.json({ valid: true, type, requiresMobile: true });
    } catch (err) {
      console.error("Error validating access code:", err);
      res.status(500).json({ valid: false, message: "Failed to validate access code" });
    }
  });

  // --- On-demand code management (used by Session Access panel) ---

  app.get('/api/access-codes', async (_req: any, res: any) => {
    try {
      const codes = await storage.getAccessCodes();
      res.json(codes);
    } catch (err) {
      console.error("Error listing access codes:", err);
      res.status(500).json({ message: "Failed to list access codes" });
    }
  });

  app.post('/api/access-codes/generate', async (req: any, res: any) => {
    try {
      const { type, mobileNumber, hasAdminAccess } = z.object({
        type: z.enum(['daily', 'weekly', 'monthly', 'master']),
        mobileNumber: z.string().optional().nullable(),
        hasAdminAccess: z.boolean().optional().default(false),
      }).parse(req.body);

      const codeType = type as AccessCodeType;

      // Weekly/Monthly/Master MUST be linked to a 10-digit mobile
      if (requiresMobile(codeType)) {
        const mobile = (mobileNumber || '').trim();
        if (!MOBILE_NUMBER_REGEX.test(mobile)) {
          return res.status(400).json({ message: "A 10-digit mobile number is required for weekly, monthly and master codes." });
        }
      }

      // hasAdminAccess only applies to master keys
      const adminFlag = codeType === 'master' ? !!hasAdminAccess : false;

      // Generate a unique code (retry on collision)
      let code = '';
      for (let i = 0; i < 5; i++) {
        const candidate = generateOnDemandCode(codeType);
        const exists =
          codeType === 'daily' && validateDailyCode(candidate)
            ? true
            : !!(await storage.getAccessCodeByCode(candidate));
        if (!exists) {
          code = candidate;
          break;
        }
      }
      if (!code) {
        return res.status(500).json({ message: "Failed to generate a unique code, please try again." });
      }

      const created = await storage.createAccessCode({
        code,
        type: codeType,
        mobile_number: requiresMobile(codeType) ? (mobileNumber as string).trim() : null,
        has_admin_access: adminFlag,
        expires_at: getExpiryForType(codeType),
        is_revoked: false,
      });

      res.status(201).json(created);
    } catch (err) {
      console.error("Error generating access code:", err);
      res.status(400).json({ message: "Invalid generate payload", error: err });
    }
  });

  app.post('/api/access-codes/:id/revoke', async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });
      const updated = await storage.revokeAccessCode(id);
      if (!updated) return res.status(404).json({ message: "Code not found" });
      res.json(updated);
    } catch (err) {
      console.error("Error revoking access code:", err);
      res.status(500).json({ message: "Failed to revoke access code" });
    }
  });

  app.delete('/api/access-codes/:id', async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });
      const ok = await storage.deleteAccessCode(id);
      if (!ok) return res.status(404).json({ message: "Code not found" });
      res.status(204).send();
    } catch (err) {
      console.error("Error deleting access code:", err);
      res.status(500).json({ message: "Failed to delete access code" });
    }
  });

  // --- Admin console gate: only master keys flagged with admin access ---

  app.post('/api/access-codes/validate-admin', async (req: any, res: any) => {
    try {
      const { code, mobileNumber } = z.object({
        code: z.string().min(1),
        mobileNumber: z.string().min(1),
      }).parse(req.body);

      const normalized = code.trim().toUpperCase();
      const mobile = mobileNumber.trim();

      if (!normalized.startsWith('X')) {
        return res.json({ valid: false, message: "Admin access requires a master (X) key." });
      }
      if (!isValidMobile(mobile)) {
        return res.json({ valid: false, message: "A 10-digit mobile number is required." });
      }

      const stored = await storage.getAccessCodeByCode(normalized);
      if (!stored || stored.type !== 'master' || stored.is_revoked) {
        const mobileExists = stored && (stored.mobile_number || '').trim() === mobile;
        return res.json({
          valid: false,
          message: "Invalid master key.",
          // Hint for the "email admin" flow when mobile is right but key is wrong
          mobileMatch: !!mobileExists,
        });
      }
      if ((stored.mobile_number || '').trim() !== mobile) {
        return res.json({ valid: false, message: "Mobile number does not match this master key." });
      }
      if (!stored.has_admin_access) {
        return res.json({ valid: false, message: "This master key does not have admin access." });
      }
      return res.json({ valid: true, isAdmin: true });
    } catch (err) {
      console.error("Error validating admin access:", err);
      res.status(500).json({ valid: false, message: "Failed to validate admin access" });
    }
  });

  app.get('/api/admin/contact', async (_req: any, res: any) => {
    res.json({ email: getAdminEmail(), smtpConfigured: isSmtpConfigured() });
  });

  // User requests a new master key from the admin via backend email
  app.post('/api/admin/request-key', async (req: any, res: any) => {
    try {
      const { mobileNumber, message } = z.object({
        mobileNumber: z.string().regex(MOBILE_NUMBER_REGEX, "Mobile number must be 10 digits"),
        message: z.string().max(1000).optional().default(''),
      }).parse(req.body);

      const adminEmail = getAdminEmail();
      if (!adminEmail) {
        return res.status(500).json({ message: "ADMIN_EMAIL is not configured on the server." });
      }

      const subject = `Master key request — ${mobileNumber}`;
      const text = [
        `A user requested a new master key.`,
        ``,
        `Mobile: ${mobileNumber}`,
        `Time: ${new Date().toISOString()}`,
        message ? `` : ``,
        message ? `Message from user:` : ``,
        message ? message : ``,
      ].join('\n');

      await sendAdminEmail(subject, text);
      res.json({ sent: true, to: adminEmail });
    } catch (err: any) {
      console.error("Error sending admin request email:", err);
      const status = err?.message?.includes('SMTP') || err?.message?.includes('ADMIN_EMAIL') ? 500 : 400;
      res.status(status).json({ message: err?.message || "Failed to send request", error: err });
    }
  });


  return _httpServer;
}