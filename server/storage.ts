import { db, questions, sources, accessCodes, studySigns, signQuestions } from './db.js';
import { Question, InsertQuestion, Source, InsertSource, AccessCode, InsertAccessCode, StudySign, InsertStudySign, SignQuestionLink } from '../shared/schema.js';
import { eq, inArray, desc, and } from 'drizzle-orm';

export interface IStorage {
  getQuestions(): Promise<Question[]>;
  createQuestion(question: InsertQuestion): Promise<Question>;
  updateQuestion(id: number, question: Partial<InsertQuestion>): Promise<Question | undefined>;
  deleteQuestion(id: number): Promise<boolean>;
  bulkUploadQuestions(newQuestions: InsertQuestion[]): Promise<void>;
  bulkUpdateSource(ids: number[], sourceId: number | null): Promise<void>;
  bulkDeleteQuestions(ids: number[]): Promise<void>;
  bulkUpdateOfficial(ids: number[], isOfficial: boolean): Promise<void>;
  bulkUpdateCategory(ids: number[], category: number): Promise<void>;
  bulkUpdateDuplicate(ids: number[], isDuplicate: boolean): Promise<void>;


  getSources(): Promise<Source[]>;
  getActiveSources(): Promise<Source[]>;
  createSource(source: InsertSource): Promise<Source>;
  updateSource(id: number, source: Partial<InsertSource>): Promise<Source | undefined>;
  toggleSourceActive(id: number, isActive: boolean): Promise<Source | undefined>;
  deleteSource(id: number): Promise<boolean>;

  getAccessCodes(): Promise<AccessCode[]>;
  getAccessCodeByCode(code: string): Promise<AccessCode | undefined>;
  createAccessCode(data: InsertAccessCode): Promise<AccessCode>;
  revokeAccessCode(id: number): Promise<AccessCode | undefined>;
  deleteAccessCode(id: number): Promise<boolean>;

  getSigns(filters?: { heading?: string; subheading?: string; search?: string; verified?: boolean; missingImage?: boolean }): Promise<StudySign[]>;
  getSignById(id: number): Promise<(StudySign & { question_ids: number[] }) | undefined>;
  createSign(data: InsertStudySign): Promise<StudySign>;
  updateSign(id: number, data: Partial<InsertStudySign>): Promise<StudySign | undefined>;
  deleteSign(id: number): Promise<boolean>;
  bulkInsertSigns(rows: InsertStudySign[]): Promise<{ inserted: number; skipped: number }>;
  getQuestionsForSign(signId: number): Promise<Question[]>;
  linkSignQuestion(signId: number, questionId: number): Promise<SignQuestionLink>;
  unlinkSignQuestion(signId: number, questionId: number): Promise<boolean>;
}

export class NeonDatabaseStorage implements IStorage {
  async getQuestions(): Promise<Question[]> {
    const data = await db.select().from(questions);
    // Cast to Question[] since the JSONB 'options' column matches the schema array structure 
    return data as unknown as Question[];
  }

  async createQuestion(question: InsertQuestion): Promise<Question> {
    console.log('Creating question with data:', JSON.stringify(question, null, 2));
    const [newQuestion] = await db.insert(questions).values(question).returning();
    console.log('Created question result:', JSON.stringify(newQuestion, null, 2));
    return newQuestion as unknown as Question;
  }

  async updateQuestion(id: number, question: Partial<InsertQuestion>): Promise<Question | undefined> {
    console.log(`Updating question ${id} with data:`, JSON.stringify(question, null, 2));
    const [updatedQuestion] = await db
      .update(questions)
      .set(question)
      .where(eq(questions.id, id))
      .returning();
    console.log('Updated question result:', JSON.stringify(updatedQuestion, null, 2));
    return updatedQuestion as unknown as Question | undefined;
  }

  async deleteQuestion(id: number): Promise<boolean> {
    const [deletedQuestion] = await db
      .delete(questions)
      .where(eq(questions.id, id))
      .returning();
    return !!deletedQuestion;
  }

  async bulkUploadQuestions(newQuestions: InsertQuestion[]): Promise<void> {
    if (newQuestions.length > 0) {
      await db.insert(questions).values(newQuestions);
    }
  }

  async bulkUpdateSource(ids: number[], sourceId: number | null): Promise<void> {
    if (ids.length === 0) return;
    await db
      .update(questions)
      .set({ source_id: sourceId })
      .where(inArray(questions.id, ids));
  }

  async bulkDeleteQuestions(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    await db
      .delete(questions)
      .where(inArray(questions.id, ids));
  }

  async bulkUpdateOfficial(ids: number[], isOfficial: boolean): Promise<void> {
    if (ids.length === 0) return;
    await db
      .update(questions)
      .set({ is_official: isOfficial })
      .where(inArray(questions.id, ids));
  }

  async bulkUpdateCategory(ids: number[], category: number): Promise<void> {
    if (ids.length === 0) return;
    await db
      .update(questions)
      .set({ category })
      .where(inArray(questions.id, ids));
  }

  async bulkUpdateDuplicate(ids: number[], isDuplicate: boolean): Promise<void> {
    if (ids.length === 0) return;
    await db
      .update(questions)
      .set({ is_duplicate: isDuplicate })
      .where(inArray(questions.id, ids));
  }

  async getSources(): Promise<Source[]> {
    const data = await db.select().from(sources);
    return data as Source[];
  }

  async getActiveSources(): Promise<Source[]> {
    const data = await db.select().from(sources).where(eq(sources.is_active, true));
    return data as Source[];
  }

  async createSource(source: InsertSource): Promise<Source> {
    const [newSource] = await db.insert(sources).values(source).returning();
    return newSource as Source;
  }

  async updateSource(id: number, source: Partial<InsertSource>): Promise<Source | undefined> {
    const [updatedSource] = await db
      .update(sources)
      .set(source)
      .where(eq(sources.id, id))
      .returning();
    return updatedSource as Source | undefined;
  }

  async toggleSourceActive(id: number, isActive: boolean): Promise<Source | undefined> {
    const [updatedSource] = await db
      .update(sources)
      .set({ is_active: isActive })
      .where(eq(sources.id, id))
      .returning();
    return updatedSource as Source | undefined;
  }

  async deleteSource(id: number): Promise<boolean> {
    const [deletedSource] = await db
      .delete(sources)
      .where(eq(sources.id, id))
      .returning();
    return !!deletedSource;
  }

  async getAccessCodes(): Promise<AccessCode[]> {
    const data = await db.select().from(accessCodes).orderBy(desc(accessCodes.created_at));
    return data as unknown as AccessCode[];
  }

  async getAccessCodeByCode(code: string): Promise<AccessCode | undefined> {
    const normalized = code.trim().toUpperCase();
    const rows = await db.select().from(accessCodes).where(eq(accessCodes.code, normalized));
    return (rows[0] as unknown as AccessCode) || undefined;
  }

  async createAccessCode(data: InsertAccessCode): Promise<AccessCode> {
    const [row] = await db.insert(accessCodes).values({
      code: data.code.trim().toUpperCase(),
      type: data.type,
      mobile_number: data.mobile_number?.trim() ?? null,
      has_admin_access: data.has_admin_access ?? false,
      expires_at: data.expires_at ?? null,
      is_revoked: false,
    }).returning();
    return row as unknown as AccessCode;
  }

  async revokeAccessCode(id: number): Promise<AccessCode | undefined> {
    const [row] = await db
      .update(accessCodes)
      .set({ is_revoked: true })
      .where(eq(accessCodes.id, id))
      .returning();
    return row as unknown as AccessCode | undefined;
  }

  async deleteAccessCode(id: number): Promise<boolean> {
    const [row] = await db.delete(accessCodes).where(eq(accessCodes.id, id)).returning();
    return !!row;
  }

  // === Road Signs study module ===

  async getSigns(filters?: { heading?: string; subheading?: string; search?: string; verified?: boolean; missingImage?: boolean }): Promise<StudySign[]> {
    const rows = await db.select().from(studySigns);
    let signs = rows as unknown as StudySign[];
    const f = filters || {};
    if (f.heading) signs = signs.filter((s) => s.heading === f.heading);
    if (f.subheading) signs = signs.filter((s) => s.subheading === f.subheading);
    if (typeof f.verified === 'boolean') signs = signs.filter((s) => !!s.is_verified_exam_question === f.verified);
    if (f.missingImage) {
      signs = signs.filter((s) => {
        const covered = new Set((s.images || []).map((i) => i.code));
        return (s.codes || []).some((c) => !covered.has(c));
      });
    }
    if (f.search) {
      const q = f.search.trim().toLowerCase();
      if (q) {
        signs = signs.filter((s) =>
          s.name.toLowerCase().includes(q) ||
          (s.codes || []).some((c) => c.toLowerCase().includes(q))
        );
      }
    }
    return signs.sort((a, b) => a.heading.localeCompare(b.heading) || a.subheading.localeCompare(b.subheading) || a.name.localeCompare(b.name));
  }

  async getSignById(id: number): Promise<(StudySign & { question_ids: number[] }) | undefined> {
    const rows = await db.select().from(studySigns).where(eq(studySigns.id, id));
    if (!rows[0]) return undefined;
    const links = await db.select().from(signQuestions).where(eq(signQuestions.sign_id, id));
    return { ...(rows[0] as unknown as StudySign), question_ids: links.map((l) => l.question_id) };
  }

  async createSign(data: InsertStudySign): Promise<StudySign> {
    const [row] = await db.insert(studySigns).values({
      heading: data.heading,
      subheading: data.subheading,
      name: data.name,
      codes: data.codes,
      images: data.images ?? [],
      where_text: data.where_text ?? null,
      purpose_text: data.purpose_text ?? null,
      action_text: data.action_text ?? null,
      is_verified_exam_question: data.is_verified_exam_question ?? false,
    }).returning();
    return row as unknown as StudySign;
  }

  async updateSign(id: number, data: Partial<InsertStudySign>): Promise<StudySign | undefined> {
    const [row] = await db
      .update(studySigns)
      .set({ ...data, updated_at: new Date() })
      .where(eq(studySigns.id, id))
      .returning();
    return (row as unknown as StudySign) || undefined;
  }

  async deleteSign(id: number): Promise<boolean> {
    const [row] = await db.delete(studySigns).where(eq(studySigns.id, id)).returning();
    return !!row;
  }

  async bulkInsertSigns(rows: InsertStudySign[]): Promise<{ inserted: number; skipped: number }> {
    if (rows.length === 0) return { inserted: 0, skipped: 0 };
    const existing = await db.select().from(studySigns);
    const seen = new Set(existing.map((s) => `${s.heading}|||${s.name}`.toLowerCase()));
    const fresh = rows.filter((r) => {
      const key = `${r.heading}|||${r.name}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (fresh.length > 0) {
      await db.insert(studySigns).values(fresh.map((r) => ({
        heading: r.heading,
        subheading: r.subheading,
        name: r.name,
        codes: r.codes,
        images: r.images ?? [],
        where_text: r.where_text ?? null,
        purpose_text: r.purpose_text ?? null,
        action_text: r.action_text ?? null,
        is_verified_exam_question: r.is_verified_exam_question ?? false,
      })));
    }
    return { inserted: fresh.length, skipped: rows.length - fresh.length };
  }

  async getQuestionsForSign(signId: number): Promise<Question[]> {
    const links = await db.select().from(signQuestions).where(eq(signQuestions.sign_id, signId));
    if (links.length === 0) return [];
    const ids = links.map((l) => l.question_id);
    const data = await db.select().from(questions).where(inArray(questions.id, ids));
    return data as unknown as Question[];
  }

  async linkSignQuestion(signId: number, questionId: number): Promise<SignQuestionLink> {
    const signRows = await db.select().from(studySigns).where(eq(studySigns.id, signId));
    if (!signRows[0]) throw new Error("Sign not found");
    const qRows = await db.select().from(questions).where(eq(questions.id, questionId));
    if (!qRows[0]) throw new Error("Question not found");
    const dup = await db.select().from(signQuestions).where(and(eq(signQuestions.sign_id, signId), eq(signQuestions.question_id, questionId)));
    if (dup[0]) return dup[0] as SignQuestionLink;
    const [row] = await db.insert(signQuestions).values({ sign_id: signId, question_id: questionId }).returning();
    return row as SignQuestionLink;
  }

  async unlinkSignQuestion(signId: number, questionId: number): Promise<boolean> {
    const [row] = await db
      .delete(signQuestions)
      .where(and(eq(signQuestions.sign_id, signId), eq(signQuestions.question_id, questionId)))
      .returning();
    return !!row;
  }
}

export const storage = new NeonDatabaseStorage();