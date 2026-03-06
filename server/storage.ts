import { db, questions } from './db.js';
import { Question } from '../shared/schema.js';

export interface IStorage {
  getQuestions(): Promise<Question[]>;
}

export class NeonDatabaseStorage implements IStorage {
  async getQuestions(): Promise<Question[]> {
    const data = await db.select().from(questions);
    // Cast to Question[] since the JSONB 'options' column matches the schema array structure 
    return data as unknown as Question[];
  }
}

export const storage = new NeonDatabaseStorage();