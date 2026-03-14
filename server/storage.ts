import { db, questions, sources } from './db.js';
import { Question, InsertQuestion, Source, InsertSource } from '../shared/schema.js';
import { eq, inArray } from 'drizzle-orm';

export interface IStorage {
  getQuestions(): Promise<Question[]>;
  createQuestion(question: InsertQuestion): Promise<Question>;
  updateQuestion(id: number, question: Partial<InsertQuestion>): Promise<Question | undefined>;
  deleteQuestion(id: number): Promise<boolean>;
  bulkUploadQuestions(newQuestions: InsertQuestion[]): Promise<void>;
  bulkUpdateSource(ids: number[], sourceId: number | null): Promise<void>;

  getSources(): Promise<Source[]>;
  createSource(source: InsertSource): Promise<Source>;
  updateSource(id: number, source: Partial<InsertSource>): Promise<Source | undefined>;
  deleteSource(id: number): Promise<boolean>;
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

  async getSources(): Promise<Source[]> {
    const data = await db.select().from(sources);
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

  async deleteSource(id: number): Promise<boolean> {
    const [deletedSource] = await db
      .delete(sources)
      .where(eq(sources.id, id))
      .returning();
    return !!deletedSource;
  }
}

export const storage = new NeonDatabaseStorage();