import { storage } from "./storage";
import { api } from "@shared/routes";

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

  return _httpServer;
}