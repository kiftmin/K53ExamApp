import { z } from 'zod';
import { questionSchema } from './schema.js';

export const errorSchemas = {
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  questions: {
    list: {
      method: 'GET' as const,
      path: '/api/questions' as const,
      responses: {
        200: z.array(questionSchema),
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

export type QuestionListResponse = z.infer<typeof api.questions.list.responses[200]>;
