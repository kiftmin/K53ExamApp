// Per-question answer history for this device. Mirrors the study-module
// storage: plain JSON in localStorage, synced for W/M/X codes.

import {
  syncEnabled,
  pushProgress,
  hydrateProgress,
  recordOwnerIfMissing,
  type LearnerRecord,
} from "./progress-sync";
import { toCount } from "./learning-status";

const QUESTION_RESULTS_KEY = "k53_question_results";

export interface QuestionResult {
  correct: number;
  incorrect: number;
  lastCorrect: boolean;
  lastAnsweredAt: string;
}

function readResults(): Record<number, QuestionResult> {
  try {
    const raw = localStorage.getItem(QUESTION_RESULTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<number, QuestionResult> = {};
    for (const [key, value] of Object.entries(parsed)) {
      const row = value as Partial<QuestionResult>;
      out[Number(key)] = {
        correct: toCount(row.correct),
        incorrect: toCount(row.incorrect),
        lastCorrect: row.lastCorrect === true,
        lastAnsweredAt:
          typeof row.lastAnsweredAt === "string" && !Number.isNaN(new Date(row.lastAnsweredAt).getTime())
            ? row.lastAnsweredAt
            : new Date(0).toISOString(),
      };
    }
    return out;
  } catch {
    return {};
  }
}

function writeResults(map: Record<number, QuestionResult>): void {
  try {
    localStorage.setItem(QUESTION_RESULTS_KEY, JSON.stringify(map));
  } catch {
    // storage full / private mode — the quiz still works, just not persisted
  }
}

function toLearnerRecord(result: QuestionResult): LearnerRecord {
  return {
    status: result.lastCorrect ? "mastered" : "learning",
    correct: result.correct,
    incorrect: result.incorrect,
    lastRating: result.lastCorrect ? "good" : "again",
    lastSeenAt: result.lastAnsweredAt,
  };
}

function fromLearnerRecord(record: LearnerRecord): QuestionResult {
  return {
    correct: toCount(record.correct),
    incorrect: toCount(record.incorrect),
    lastCorrect: record.lastRating === "good" || record.lastRating === "easy",
    lastAnsweredAt: record.lastSeenAt,
  };
}

export function getQuestionResult(questionId: number): QuestionResult | undefined {
  return readResults()[questionId];
}

export function getAllQuestionResults(): Record<number, QuestionResult> {
  return readResults();
}

/**
 * Record one completed quiz run. Unanswered questions are not passed in.
 * Correct answers never promote a card; this store only tracks question
 * history (Step 4 handles card demotion separately).
 */
export function recordQuestionResults(
  updates: { questionId: number; correct: boolean }[],
  answeredAt = new Date().toISOString()
): void {
  if (updates.length === 0) return;
  recordOwnerIfMissing();

  const map = readResults();
  const changed: { questionId: number; result: QuestionResult }[] = [];

  for (const update of updates) {
    const prev = map[update.questionId];
    const result: QuestionResult = {
      correct: toCount(prev?.correct) + (update.correct ? 1 : 0),
      incorrect: toCount(prev?.incorrect) + (update.correct ? 0 : 1),
      lastCorrect: update.correct,
      lastAnsweredAt: answeredAt,
    };
    map[update.questionId] = result;
    changed.push({ questionId: update.questionId, result });
  }

  writeResults(map);

  if (syncEnabled()) {
    for (const entry of changed) {
      pushProgress("question", entry.questionId, toLearnerRecord(entry.result));
    }
  }
}

export async function initQuestionSync(): Promise<void> {
  if (typeof localStorage === "undefined") return;
  const local = readResults();
  const localRecords: Record<number, LearnerRecord> = {};
  for (const [id, result] of Object.entries(local)) {
    localRecords[Number(id)] = toLearnerRecord(result);
  }

  const hydrated = await hydrateProgress("question", localRecords);
  if (hydrated === null) return;

  const next: Record<number, QuestionResult> = {};
  for (const [id, record] of Object.entries(hydrated)) {
    next[Number(id)] = fromLearnerRecord(record);
  }
  writeResults(next);
}

export function clearQuestionResultsLocalData(): void {
  try {
    localStorage.removeItem(QUESTION_RESULTS_KEY);
  } catch {
    // ignore
  }
}
