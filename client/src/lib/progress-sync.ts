// Progress sync — server-synced mastery state keyed by mobile number.
// Only active for Weekly (W), Monthly (M), Master (X) codes with a linked
// mobile number. Daily codes and no-code sessions keep pure localStorage.

const API_BASE = "";

export interface LearnerRecord {
  status: "new" | "learning" | "review" | "mastered";
  correct: number;
  incorrect: number;
  lastRating: string;
  lastSeenAt: string;
}

export function syncEnabled(): boolean {
  const code = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("k53_access_code") : null;
  const mobile = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("k53_mobile_number") : null;
  return !!code && !!mobile && ["W", "M", "X"].includes(code.charAt(0).toUpperCase());
}

export function currentMobile(): string | null {
  return typeof sessionStorage !== "undefined" ? sessionStorage.getItem("k53_mobile_number") : null;
}

export function currentCode(): string | null {
  return typeof sessionStorage !== "undefined" ? sessionStorage.getItem("k53_access_code") : null;
}

type ServerProgressRow = {
  mobile_number: string;
  item_type: string;
  item_id: number;
  status: string;
  correct: number;
  incorrect: number;
  last_rating: string | null;
  last_seen_at: string | null;
  updated_at: string;
};

/** Fetch all progress rows for this mobile + item type. Returns null on failure. */
export async function fetchProgress(itemType: "sign" | "rule" | "control"): Promise<Record<number, LearnerRecord> | null> {
  const code = currentCode();
  const mobile = currentMobile();
  if (!code || !mobile) return null;

  try {
    const res = await fetch(`${API_BASE}/api/learner-progress?code=${encodeURIComponent(code)}&mobileNumber=${encodeURIComponent(mobile)}&item_type=${encodeURIComponent(itemType)}`, {
      credentials: "include",
    });
    if (!res.ok) return null;
    const data = await res.json();
    const rows: ServerProgressRow[] = data.progress || [];
    const map: Record<number, LearnerRecord> = {};
    for (const row of rows) {
      map[row.item_id] = {
        status: row.status as LearnerRecord["status"],
        correct: row.correct ?? 0,
        incorrect: row.incorrect ?? 0,
        lastRating: row.last_rating ?? "good",
        lastSeenAt: row.last_seen_at ?? new Date().toISOString(),
      };
    }
    return map;
  } catch {
    return null;
  }
}

/** Upsert a single record. Non-blocking; failures are logged only. */
export async function pushProgress(
  itemType: "sign" | "rule" | "control",
  itemId: number,
  record: LearnerRecord
): Promise<void> {
  const code = currentCode();
  const mobile = currentMobile();
  if (!code || !mobile) return;

  try {
    await fetch(`${API_BASE}/api/learner-progress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        code,
        mobileNumber: mobile,
        item_type: itemType,
        item_id: itemId,
        status: record.status,
        correct: record.correct,
        incorrect: record.incorrect,
        last_rating: record.lastRating,
        last_seen_at: record.lastSeenAt,
      }),
    });
  } catch {
    // Silent — local state is still correct; next rating retries.
  }
}

/**
 * Server-authoritative hydration for W/M/X learners.
 * - Server has rows: replace local progress with the server rows.
 * - Server has no rows: keep local progress and upload it once.
 * - Request failed: keep local progress and retry on the next mount.
 * Returns null when sync is disabled.
 */
export async function hydrateProgress(
  itemType: "sign" | "rule" | "control",
  localMap: Record<number, LearnerRecord>
): Promise<Record<number, LearnerRecord> | null> {
  if (!syncEnabled()) return null;

  // Never write back data if the learner logged out or switched accounts mid-sync.
  const identity = `${currentCode() || ""}|${currentMobile() || ""}`;
  const stillCurrent = () => `${currentCode() || ""}|${currentMobile() || ""}` === identity;

  const serverMap = await fetchProgress(itemType);
  if (serverMap === null) return stillCurrent() ? localMap : null;
  if (Object.keys(serverMap).length > 0) return stillCurrent() ? serverMap : null;

  const entries = Object.entries(localMap);
  if (entries.length === 0) return stillCurrent() ? {} : null;

  for (const [id, record] of entries) {
    await pushProgress(itemType, Number(id), record);
  }
  return stillCurrent() ? localMap : null;
}
