import { type Express, type Request, type Response } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";

export async function registerRoutes(
  _httpServer: Server,
  app: Express
): Promise<Server> {

  app.get(api.questions.list.path, async (req: Request, res: Response) => {
    try {
      const questions = await storage.getQuestions();
      res.json(questions);
    } catch (err) {
      console.error("Error reading questions:", err);
      res.status(500).json({ message: "Failed to load questions" });
    }
  });

  return _httpServer;
}