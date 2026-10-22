// Progress sync — server-synced mastery state keyed by mobile number.
// Only active for Weekly (W), Monthly (M), Master (X) codes with a linked
// mobile number. Daily codes and no-code sessions keep pure localStorage.

import { isLearningStatus, toCount } from "./learning-status";

const API_BASE = "";

export const PROGRESS_OWNER_KEY = "k53_progress_owner";

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

export function progressIdentity(): string | null {
  const code = currentCode();
  if (!code) return null;
  const prefix = code.charAt(0).toUpperCase();
  if (prefix === "W" || prefix === "M" || prefix === "X") {
    return currentMobile()?.trim() || null;
  }
  return prefix === "D" ? "daily" : null;
}

export function recordOwnerIfMissing(): void {
  if (!syncEnabled() || typeof localStorage === "undefined") return;
  try {
    if (localStorage.getItem(PROGRESS_OWNER_KEY)) return;
    const identity = progressIdentity();
    if (identity) localStorage.setItem(PROGRESS_OWNER_KEY, identity);
  } catch {
    // ignore
  }
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
        lastSeenAt: row.last_seen_at ?? new Date(0).toISOString(),
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

  // Local records can predate the current format (e.g. counts stored as
  // strings), which would make the server reject the whole payload. Always
  // send a clean record.
  const lastSeenAt =
    typeof record.lastSeenAt === "string" && !Number.isNaN(new Date(record.lastSeenAt).getTime())
      ? record.lastSeenAt
      : new Date().toISOString();

  try {
    const res = await fetch(`${API_BASE}/api/learner-progress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        code,
        mobileNumber: mobile,
        item_type: itemType,
        item_id: itemId,
        status: isLearningStatus(record.status) ? record.status : "learning",
        correct: toCount(record.correct),
        incorrect: toCount(record.incorrect),
        last_rating: record.lastRating || "good",
        last_seen_at: lastSeenAt,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.warn(`[progress-sync] save failed (${res.status}) for ${itemType} ${itemId}: ${detail}`);
    }
  } catch {
    // Silent — local state is still correct; next rating retries.
  }
}

/**
 * Merge two progress maps with last-write-wins semantics: for ids present in
 * both, the record with the newer lastSeenAt wins. Server rows (which carry
 * authoritative other-device edits) therefore never silently overwrite newer
 * local edits whose push happened to fail, and vice versa.
 */
function mergeProgress(
  serverMap: Record<number, LearnerRecord>,
  localMap: Record<number, LearnerRecord>
): Record<number, LearnerRecord> {
  const merged: Record<number, LearnerRecord> = { ...serverMap };
  for (const [id, local] of Object.entries(localMap)) {
    const server = merged[Number(id)];
    if (
      !server ||
      new Date(local.lastSeenAt).getTime() >= new Date(server.lastSeenAt).getTime()
    ) {
      merged[Number(id)] = local;
    }
  }
  return merged;
}

/**
 * Server hydration for W/M/X learners.
 * - Server has rows: merge with local, last write wins.
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
  if (Object.keys(serverMap).length > 0) {
    const merged = mergeProgress(serverMap, localMap);
    // Push any local records that won the merge back to the server so the
    // server converges with the device that has the newest data.
    for (const [id, record] of Object.entries(merged)) {
      if (
        !serverMap[Number(id)] ||
        new Date(record.lastSeenAt).getTime() > new Date(serverMap[Number(id)].lastSeenAt).getTime()
      ) {
        void pushProgress(itemType, Number(id), record);
      }
    }
    return stillCurrent() ? merged : null;
  }

  const entries = Object.entries(localMap);
  if (entries.length === 0) return stillCurrent() ? {} : null;

  for (const [id, record] of entries) {
    await pushProgress(itemType, Number(id), record);
  }
  return stillCurrent() ? localMap : null;
}
