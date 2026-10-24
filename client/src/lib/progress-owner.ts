import { clearSignLocalData } from "./sign-storage";
import { clearRuleLocalData } from "./rule-storage";
import { clearControlLocalData } from "./control-storage";
import { clearQuestionResultsLocalData } from "./question-results";
import { clearQuizHistoryLocalData } from "./quiz-history";
import { PROGRESS_OWNER_KEY, progressIdentity } from "./progress-sync";

export function ensureLocalOwner(): void {
  if (typeof localStorage === "undefined") return;
  try {
    const identity = progressIdentity();
    if (!identity) return;

    const owner = localStorage.getItem(PROGRESS_OWNER_KEY);
    if (owner === identity) return;

    if (owner !== null) {
      clearSignLocalData();
      clearRuleLocalData();
      clearControlLocalData();
      clearQuestionResultsLocalData();
      clearQuizHistoryLocalData();
    }
    localStorage.setItem(PROGRESS_OWNER_KEY, identity);
  } catch {
    // ignore
  }
}

export function clearProgressOwner(): void {
  try {
    localStorage.removeItem(PROGRESS_OWNER_KEY);
  } catch {
    // ignore
  }
}
