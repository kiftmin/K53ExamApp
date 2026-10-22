// Aggregates client-side learning records into per-group mastery percentages.
// "mastery %" = mastered / (mastered + review + learning); new items are
// excluded from the denominator (not yet attempted, so not "weak").

import type { ControlDiagram, StudyControl } from "@shared/schema";
import { getAllSignLearning } from "./sign-storage";
import { getAllRuleLearning } from "./rule-storage";
import { getAllControlLearning } from "./control-storage";

export interface GroupMastery {
  heading: string;
  subheading: string;
  module: "signs" | "rules" | "controls";
  mastered: number;
  total: number; // mastered + review + learning
  pct: number; // 0-100
  weak: number; // learning + new (due for revision)
}

function summarize<T extends { id: number; heading: string; subheading?: string | null; section_ref?: string | null }>(
  items: T[],
  learning: Record<number, { status: string }>,
  module: "signs" | "rules" | "controls"
): GroupMastery[] {
  const groups = new Map<string, GroupMastery>();
  for (const item of items) {
    const key = `${item.heading}|||${item.subheading || ""}`;
    let g = groups.get(key);
    if (!g) {
      g = { heading: item.heading, subheading: item.subheading || "(general)", module, mastered: 0, total: 0, pct: 0, weak: 0 };
      groups.set(key, g);
    }
    const rec = learning[item.id];
    const status = rec?.status ?? "new";
    if (status === "mastered") { g.mastered++; g.total++; }
    else if (status === "review") { g.total++; g.weak++; }
    else if (status === "learning") { g.total++; g.weak++; }
    else { g.weak++; } // new
  }
  return Array.from(groups.values())
    .map((g) => ({ ...g, pct: g.total === 0 ? 0 : Math.round((g.mastered / g.total) * 100) }))
    .filter((g) => g.total > 0 || g.weak > 0);
}

export function summarizeSigns<T extends { id: number; heading: string; subheading?: string | null }>(items: T[]): GroupMastery[] {
  return summarize(items, getAllSignLearning(), "signs");
}

export function summarizeRules<T extends { id: number; heading: string; subheading?: string | null }>(items: T[]): GroupMastery[] {
  return summarize(items, getAllRuleLearning(), "rules");
}

export function summarizeControls(items: { id: number; heading: string; subheading?: string | null }[]): GroupMastery[] {
  return summarize(items, getAllControlLearning(), "controls");
}

export function controlsForSummary(
  controls: Pick<StudyControl, "id" | "diagram_id">[],
  diagrams: Pick<ControlDiagram, "id" | "label">[]
): { id: number; heading: string; subheading: null }[] {
  const labels = new Map(diagrams.map((d) => [d.id, d.label]));
  return controls.map((c) => ({
    id: c.id,
    heading: labels.get(c.diagram_id) || "Vehicle Controls",
    subheading: null,
  }));
}

export function controlPctByItem(
  controls: Pick<StudyControl, "id" | "diagram_id">[],
  diagrams: Pick<ControlDiagram, "id" | "label">[]
): Map<number, number> {
  const summary = controlsForSummary(controls, diagrams);
  const pctByHeading = new Map(summarizeControls(summary).map((g) => [g.heading, g.pct]));
  return new Map(summary.map((item) => [item.id, pctByHeading.get(item.heading) ?? 100]));
}

/** Lowest-mastery groups with weak items, signs + rules + controls combined, weakest first. */
export function weakestGroups(signs: any[], rules: any[], controls: any[], limit = 3): GroupMastery[] {
  return [...summarizeSigns(signs), ...summarizeRules(rules), ...summarizeControls(controls)]
    .filter((g) => g.total > 0 && g.weak > 0)
    .sort((a, b) => a.pct - b.pct || b.weak - a.weak)
    .slice(0, limit);
}
