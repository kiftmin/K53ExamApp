// Favorites + seen-ids + licence/gearbox session for the Controls study module.
// Mirrors rule-storage.ts — plain JSON in localStorage.

const FAV_CONTROLS_KEY = "k53_favorite_controls";
const LEARNING_CONTROLS_KEY = "k53_control_learning";
const CONTROLS_CODE_KEY = "k53_controls_licence_code";
const CONTROLS_GEARBOX_KEY = "k53_controls_gearbox";

export type LearningStatus = "new" | "learning" | "review" | "mastered";
export type RecallRating = "again" | "hard" | "good" | "easy";
export type LearningRecord = {
  status: LearningStatus;
  correct: number;
  incorrect: number;
  lastRating: RecallRating;
  lastSeenAt: string;
};

function readIds(key: string): number[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "number") : [];
  } catch {
    return [];
  }
}
function writeIds(key: string, ids: number[]): void {
  try { localStorage.setItem(key, JSON.stringify(ids)); } catch { /* ignore */ }
}
export function getFavoriteControlIds(): number[] { return readIds(FAV_CONTROLS_KEY); }
export function toggleFavoriteControl(id: number): boolean {
  const ids = readIds(FAV_CONTROLS_KEY);
  const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
  writeIds(FAV_CONTROLS_KEY, next);
  return next.includes(id);
}

function readLearningMap(key: string): Record<number, LearningRecord> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
}
function writeLearningMap(key: string, map: Record<number, LearningRecord>): void {
  try { localStorage.setItem(key, JSON.stringify(map)); } catch { /* ignore */ }
}
function nextStatus(record: LearningRecord | undefined, rating: RecallRating): LearningStatus {
  const current = record?.status ?? "new";
  if (current === "new") return "learning";
  switch (rating) {
    case "again": return "learning";
    case "hard": return "learning";
    case "good": return current === "mastered" ? "mastered" : "review";
    case "easy": return current === "review" || current === "mastered" ? "mastered" : "review";
  }
}
export function rateControl(id: number, rating: RecallRating): LearningRecord {
  const map = readLearningMap(LEARNING_CONTROLS_KEY);
  const prev = map[id];
  const record: LearningRecord = {
    status: nextStatus(prev, rating),
    correct: (prev?.correct ?? 0) + (rating === "good" || rating === "easy" ? 1 : 0),
    incorrect: (prev?.incorrect ?? 0) + (rating === "again" || rating === "hard" ? 1 : 0),
    lastRating: rating,
    lastSeenAt: new Date().toISOString(),
  };
  map[id] = record;
  writeLearningMap(LEARNING_CONTROLS_KEY, map);
  return record;
}
export function getAllControlLearning(): Record<number, LearningRecord> { return readLearningMap(LEARNING_CONTROLS_KEY); }
export function getSeenControlIds(): number[] {
  const map = readLearningMap(LEARNING_CONTROLS_KEY);
  return Object.keys(map).map(Number).filter((id) => map[id]?.status && map[id].status !== "new");
}
export function markControlSeen(id: number): void {
  const map = readLearningMap(LEARNING_CONTROLS_KEY);
  if (!map[id]) {
    map[id] = { status: "learning", correct: 0, incorrect: 0, lastRating: "good", lastSeenAt: new Date().toISOString() };
    writeLearningMap(LEARNING_CONTROLS_KEY, map);
  } else if (map[id].status === "new") {
    map[id] = { ...map[id], status: "learning", lastSeenAt: new Date().toISOString() };
    writeLearningMap(LEARNING_CONTROLS_KEY, map);
  }
}

export type ControlLicenceCode = 1 | 2 | 3;
export function getControlsLicenceCode(): ControlLicenceCode | null {
  try {
    const raw = localStorage.getItem(CONTROLS_CODE_KEY);
    if (raw === "1" || raw === "2" || raw === "3") return parseInt(raw, 10) as ControlLicenceCode;
    return null;
  } catch { return null; }
}
export function setControlsLicenceCode(code: ControlLicenceCode): void {
  try { localStorage.setItem(CONTROLS_CODE_KEY, String(code)); } catch { /* ignore */ }
}
export function clearControlsLicenceCode(): void {
  try { localStorage.removeItem(CONTROLS_CODE_KEY); } catch { /* ignore */ }
}

export type ControlGearbox = "manual" | "automatic";
export function getControlsGearbox(): ControlGearbox | null {
  try {
    const raw = localStorage.getItem(CONTROLS_GEARBOX_KEY);
    if (raw === "manual" || raw === "automatic") return raw;
    return null;
  } catch { return null; }
}
export function setControlsGearbox(g: ControlGearbox): void {
  try { localStorage.setItem(CONTROLS_GEARBOX_KEY, g); } catch { /* ignore */ }
}
export function clearControlsGearbox(): void {
  try { localStorage.removeItem(CONTROLS_GEARBOX_KEY); } catch { /* ignore */ }
}

// Resolve the current session to diagram filters
export function sessionToQuery(): { vehicle_type: string; gearbox?: string } | null {
  const code = getControlsLicenceCode();
  if (code === 1) return { vehicle_type: "motorcycle" };
  const g = getControlsGearbox();
  if (code === 2 && g) return { vehicle_type: "lmv", gearbox: g };
  if (code === 3 && g) return { vehicle_type: "hmv", gearbox: g };
  return null;
}

export function isVehicleTypeForCode(code: number | null, vehicleType: string, gearbox: string | null | undefined): boolean {
  if (code === 1) return vehicleType === "motorcycle";
  if (code === 2) return vehicleType === "lmv";
  if (code === 3) return vehicleType === "hmv";
  return false;
}
