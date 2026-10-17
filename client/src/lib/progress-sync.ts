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

/** Fetch all progress rows for this mobile + item type. Server wins. */
export async function fetchProgress(itemType: "sign" | "rule" | "control"): Promise<Record<number, LearnerRecord>> {
  const code = currentCode();
  const mobile = currentMobile();
  if (!code || !mobile) return {};

  try {
    const res = await fetch(`${API_BASE}/api/learner-progress?code=${encodeURIComponent(code)}&mobileNumber=${encodeURIComponent(mobile)}&item_type=${encodeURIComponent(itemType)}`, {
      credentials: "include",
    });
    if (!res.ok) return {};
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
    return {};
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

/** Merge server records into a local learning map, server wins for conflicts. */
export function mergeServerIntoLocal(
  localMap: Record<number, LearnerRecord>,
  serverMap: Record<number, LearnerRecord>
): Record<number, LearnerRecord> {
  const merged = { ...localMap };
  for (const [id, serverRec] of Object.entries(serverMap)) {
    const numId = Number(id);
    const local = merged[numId];
    if (!local) {
      merged[numId] = serverRec;
    } else {
      // Server wins: use whichever has the later last_seen_at
      const serverTime = new Date(serverRec.lastSeenAt).getTime();
      const localTime = new Date(local.lastSeenAt).getTime();
      if (serverTime >= localTime) {
        merged[numId] = serverRec;
      }
    }
  }
  return merged;
}
