import type { Question } from "@shared/schema";
import { recordQuestionResults } from "./question-results";
import { apiRequest } from "./queryClient";
import { getAllSignLearning, rateSign } from "./sign-storage";
import { getAllRuleLearning, rateRule } from "./rule-storage";
import { getAllControlLearning, rateControl } from "./control-storage";
import { isKnown, type LearningRecord } from "./learning-status";

interface CardLinks {
  signs: number[];
  rules: number[];
  controls: number[];
}

/**
 * Wrong answers push the linked cards back to "Not yet": a new or known card
 * becomes learning; a card already learning is left untouched.
 */
function shouldDemote(record: LearningRecord | undefined): boolean {
  if (!record || record.status === "new") return true;
  return isKnown(record.status);
}

async function demoteCardsBehindWrongAnswers(wrongIds: number[]): Promise<void> {
  if (wrongIds.length === 0) return;

  let links: Record<number, CardLinks>;
  try {
    const res = await apiRequest("POST", "/api/questions/links", { ids: wrongIds });
    links = await res.json();
  } catch {
    // Offline or links endpoint unavailable — the results screen must still work.
    return;
  }
  if (!links || typeof links !== "object") return;

  const signLearning = getAllSignLearning();
  const ruleLearning = getAllRuleLearning();
  const controlLearning = getAllControlLearning();
  const handled = new Set<string>();

  for (const questionId of wrongIds) {
    const entry = links[questionId];
    if (!entry) continue;

    for (const cardId of entry.signs ?? []) {
      const key = `sign:${cardId}`;
      if (handled.has(key)) continue;
      handled.add(key);
      if (shouldDemote(signLearning[cardId])) rateSign(cardId, "again");
    }
    for (const cardId of entry.rules ?? []) {
      const key = `rule:${cardId}`;
      if (handled.has(key)) continue;
      handled.add(key);
      if (shouldDemote(ruleLearning[cardId])) rateRule(cardId, "again");
    }
    for (const cardId of entry.controls ?? []) {
      const key = `control:${cardId}`;
      if (handled.has(key)) continue;
      handled.add(key);
      if (shouldDemote(controlLearning[cardId])) rateControl(cardId, "again");
    }
  }
}

/**
 * Called once per completed quiz run. Records question-level correctness
 * and demotes the cards behind wrong answers.
 */
export async function recordQuizOutcome(
  questions: Question[],
  answers: Record<number, string>
): Promise<void> {
  const updates: { questionId: number; correct: boolean }[] = [];

  for (const question of questions) {
    const answer = answers[question.question_number];
    if (answer === undefined) continue;
    const correctOption = question.options.find((option) => option.correct_answer);
    updates.push({
      questionId: question.id,
      correct: !!correctOption && answer === correctOption.answer_number,
    });
  }

  recordQuestionResults(updates);

  const wrongIds = updates.filter((u) => !u.correct).map((u) => u.questionId);
  await demoteCardsBehindWrongAnswers(wrongIds);
}
