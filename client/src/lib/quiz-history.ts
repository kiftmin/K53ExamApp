// Completed-test history, synced across devices for mobile-linked codes.
// One small record per run is enough to rebuild the report card.

import type { Question } from "@shared/schema";
import { currentCode, currentMobile, recordOwnerIfMissing, syncEnabled } from "./progress-sync";

const QUIZ_HISTORY_KEY = "k53_quiz_history";
export const QUIZ_HISTORY_LIMIT = 20;

const PASS_THRESHOLDS: Record<number, number> = { 1: 22, 2: 23, 3: 6 };

export interface QuizHistoryUser {
  name: string;
  surname: string;
  licenseCode: string;
  category: number;
  testType: "category" | "simulation";
}

export interface QuizHistoryCategory {
  categoryId: number;
  correct: number;
  total: number;
  pass: boolean;
}

export interface QuizHistoryItem {
  id: number;
  number: number;
}

export interface QuizHistoryRun {
  id: string;
  finishedAt: string;
  name: string;
  surname: string;
  licenseCode: string;
  category: number;
  testType: "category" | "simulation";
  items: QuizHistoryItem[];
  answers: Record<number, string>;
  correct: number;
  total: number;
  percentage: number;
  categories: QuizHistoryCategory[];
  overallPass: boolean;
  elapsedSeconds: number;
}

function readRuns(): QuizHistoryRun[] {
  try {
    const raw = localStorage.getItem(QUIZ_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeRun).filter((run): run is QuizHistoryRun => !!run);
  } catch {
    return [];
  }
}

function normalizeRun(raw: unknown): QuizHistoryRun | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Partial<QuizHistoryRun>;
  if (typeof row.id !== "string" || !row.id) return null;
  if (!Array.isArray(row.items) || !Array.isArray(row.categories)) return null;
  if (!row.answers || typeof row.answers !== "object" || Array.isArray(row.answers)) return null;

  const total = Number(row.total);
  if (!Number.isFinite(total) || total <= 0) return null;

  const correct = Number(row.correct);
  const finishedAt =
    typeof row.finishedAt === "string" && !Number.isNaN(new Date(row.finishedAt).getTime())
      ? row.finishedAt
      : new Date(0).toISOString();

  return {
    id: row.id,
    finishedAt,
    name: typeof row.name === "string" ? row.name : "",
    surname: typeof row.surname === "string" ? row.surname : "",
    licenseCode: typeof row.licenseCode === "string" ? row.licenseCode : "",
    category: Number(row.category) || 0,
    testType: row.testType === "simulation" ? "simulation" : "category",
    items: row.items
      .filter((item): item is QuizHistoryItem => !!item && Number.isFinite(Number(item.id)) && Number.isFinite(Number(item.number)))
      .map((item) => ({ id: Number(item.id), number: Number(item.number) })),
    answers: Object.fromEntries(
      Object.entries(row.answers).map(([key, value]) => [Number(key), String(value)])
    ),
    correct: Number.isFinite(correct) ? correct : 0,
    total,
    percentage: Math.round(((Number.isFinite(correct) ? correct : 0) / total) * 100),
    categories: row.categories
      .filter((cat) => !!cat && Number.isFinite(Number(cat.categoryId)))
      .map((cat) => ({
        categoryId: Number(cat.categoryId),
        correct: Number(cat.correct) || 0,
        total: Number(cat.total) || 0,
        pass: cat.pass === true,
      })),
    overallPass: row.overallPass === true,
    elapsedSeconds: Number(row.elapsedSeconds) || 0,
  };
}

function writeRuns(runs: QuizHistoryRun[]): void {
  try {
    localStorage.setItem(QUIZ_HISTORY_KEY, JSON.stringify(runs));
  } catch {
    // storage full / private mode — the test still works, just not saved
  }
}

export function getQuizRuns(): QuizHistoryRun[] {
  if (typeof localStorage === "undefined") return [];
  return readRuns();
}

export function getQuizRun(id: string): QuizHistoryRun | undefined {
  return readRuns().find((run) => run.id === id);
}

function sortRuns(runs: QuizHistoryRun[]): QuizHistoryRun[] {
  return [...runs].sort(
    (a, b) => new Date(b.finishedAt).getTime() - new Date(a.finishedAt).getTime()
  );
}

function mergeRuns(serverRuns: QuizHistoryRun[], localRuns: QuizHistoryRun[]): QuizHistoryRun[] {
  const byId = new Map<string, QuizHistoryRun>();
  for (const run of [...serverRuns, ...localRuns]) byId.set(run.id, run);
  return sortRuns(Array.from(byId.values())).slice(0, QUIZ_HISTORY_LIMIT);
}

async function fetchServerRuns(): Promise<QuizHistoryRun[] | null> {
  const code = currentCode();
  const mobile = currentMobile();
  if (!code || !mobile) return null;

  try {
    const res = await fetch(
      `/api/test-history?code=${encodeURIComponent(code)}&mobileNumber=${encodeURIComponent(mobile)}`,
      { credentials: "include" }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data?.runs)) return null;
    return sortRuns(
      data.runs
        .map(normalizeRun)
        .filter((run: QuizHistoryRun | null): run is QuizHistoryRun => !!run)
    );
  } catch {
    return null;
  }
}

async function pushServerRun(run: QuizHistoryRun): Promise<boolean> {
  const code = currentCode();
  const mobile = currentMobile();
  if (!code || !mobile) return false;

  try {
    const res = await fetch("/api/test-history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ code, mobileNumber: mobile, run }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.warn(`[test-history] save failed (${res.status}): ${detail}`);
      return false;
    }
    return true;
  } catch {
    // Local history remains available; the next sync retries.
    return false;
  }
}

export interface QuizHistorySyncResult {
  runs: QuizHistoryRun[];
  synced: boolean;
}

export async function initQuizHistorySync(): Promise<QuizHistorySyncResult | null> {
  if (typeof localStorage === "undefined") return { runs: [], synced: false };
  recordOwnerIfMissing();

  const local = readRuns();
  if (!syncEnabled()) return { runs: local, synced: false };

  const identity = `${currentCode() || ""}|${currentMobile() || ""}`;
  const stillCurrent = () => `${currentCode() || ""}|${currentMobile() || ""}` === identity;

  const serverRuns = await fetchServerRuns();
  if (serverRuns === null) return stillCurrent() ? { runs: local, synced: false } : null;

  const merged = mergeRuns(serverRuns, local);
  writeRuns(merged);

  const serverIds = new Set(serverRuns.map((run) => run.id));
  const localOnly = local.filter((run) => !serverIds.has(run.id));
  const pushed = localOnly.length === 0 || (await Promise.all(localOnly.map(pushServerRun))).every(Boolean);

  return stillCurrent() ? { runs: merged, synced: pushed } : null;
}

/** Save one completed run. No-op when there is no test to record. */
export function recordQuizRun(
  user: QuizHistoryUser | null,
  questions: Question[],
  answers: Record<number, string>,
  options: { startedAt?: number | null; finishedAt?: string } = {}
): void {
  if (typeof localStorage === "undefined" || !user || questions.length === 0) return;
  recordOwnerIfMissing();

  const categories = new Map<number, QuizHistoryCategory>();
  let correct = 0;

  for (const question of questions) {
    const answer = answers[question.question_number];
    const correctOption = question.options.find((option) => option.correct_answer);
    const isCorrect = !!correctOption && answer === correctOption.answer_number;
    if (isCorrect) correct++;

    const entry = categories.get(question.category) ?? {
      categoryId: question.category,
      correct: 0,
      total: 0,
      pass: false,
    };
    entry.total++;
    if (isCorrect) entry.correct++;
    categories.set(question.category, entry);
  }

  const categoryList = Array.from(categories.values()).map((entry) => ({
    ...entry,
    pass: entry.correct >= (PASS_THRESHOLDS[entry.categoryId] ?? Infinity),
  }));

  const finished = options.finishedAt ? new Date(options.finishedAt) : new Date();
  const finishedAt = Number.isNaN(finished.getTime()) ? new Date().toISOString() : finished.toISOString();
  const elapsedSeconds =
    options.startedAt && options.startedAt > 0
      ? Math.max(0, Math.round((finished.getTime() - options.startedAt) / 1000))
      : 0;

  const run: QuizHistoryRun = {
    id:
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    finishedAt,
    name: user.name,
    surname: user.surname,
    licenseCode: user.licenseCode,
    category: user.category,
    testType: user.testType,
    items: questions.map((question) => ({ id: question.id, number: question.question_number })),
    answers,
    correct,
    total: questions.length,
    percentage: Math.round((correct / questions.length) * 100),
    categories: categoryList,
    overallPass:
      user.testType === "simulation"
        ? categoryList.length > 0 && categoryList.every((entry) => entry.pass)
        : categoryList[0]?.pass === true,
    elapsedSeconds,
  };

  writeRuns([run, ...readRuns()].slice(0, QUIZ_HISTORY_LIMIT));
  if (syncEnabled()) void pushServerRun(run);
}

export function clearQuizHistoryLocalData(): void {
  try {
    localStorage.removeItem(QUIZ_HISTORY_KEY);
  } catch {
    // ignore
  }
}
