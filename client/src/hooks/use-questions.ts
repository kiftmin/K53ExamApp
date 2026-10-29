import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { z } from "zod";

function parseWithLogging<T extends z.ZodTypeAny>(schema: T, data: unknown, label: string): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error(`[Zod] ${label} validation failed:`, result.error.format());
    throw result.error;
  }
  return result.data;
}

export function useQuestions() {
  return useQuery({
    queryKey: [api.questions.list.path],
    queryFn: async () => {
      const res = await fetch(api.questions.list.path, { credentials: "include" });
      if (!res.ok) {
        throw new Error("Failed to fetch questions");
      }
      const data = await res.json();
      return parseWithLogging(api.questions.list.responses[200], data, "questions.list");
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}
