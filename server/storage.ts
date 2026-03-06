import { db, questions } from './db.js';
import { Question, InsertQuestion } from '../shared/schema.js';
import { eq } from 'drizzle-orm';

export interface IStorage {
  getQuestions(): Promise<Question[]>;
  createQuestion(question: InsertQuestion): Promise<Question>;
  updateQuestion(id: number, question: Partial<InsertQuestion>): Promise<Question | undefined>;
  deleteQuestion(id: number): Promise<boolean>;
  bulkUploadQuestions(newQuestions: InsertQuestion[]): Promise<void>;
}

export class NeonDatabaseStorage implements IStorage {
  async getQuestions(): Promise<Question[]> {
    const data = await db.select().from(questions);
    // Cast to Question[] since the JSONB 'options' column matches the schema array structure 
    return data as unknown as Question[];
  }

  async createQuestion(question: InsertQuestion): Promise<Question> {
    const [newQuestion] = await db.insert(questions).values(question).returning();
    return newQuestion as unknown as Question;
  }

  async updateQuestion(id: number, question: Partial<InsertQuestion>): Promise<Question | undefined> {
    const [updatedQuestion] = await db
      .update(questions)
      .set(question)
      .where(eq(questions.id, id))
      .returning();
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
}

export const storage = new NeonDatabaseStorage();