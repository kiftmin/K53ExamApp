// Aggregates client-side learning records into per-group stats.
// A group tracks three numbers: known (mastered or legacy review),
// to practise (status learning) and total (everything, incl. new).
// New items are never counted as "to practise".

import type { ControlDiagram, StudyControl } from "@shared/schema";
import { getAllSignLearning } from "./sign-storage";
import { getAllRuleLearning } from "./rule-storage";
import { getAllControlLearning } from "./control-storage";
import { isKnown } from "./learning-status";

export interface GroupStats {
  heading: string;
  subheading: string;
  module: "signs" | "rules" | "controls";
  known: number;
  toPractise: number; // status learning
  total: number; // every item in the group
}

function groupStats<T extends { id: number; heading: string; subheading?: string | null }>(
  items: T[],
  learning: Record<number, { status: string }>,
  module: "signs" | "rules" | "controls"
): GroupStats[] {
  const groups = new Map<string, GroupStats>();
  for (const item of items) {
    const key = `${item.heading}|||${item.subheading || ""}`;
    let g = groups.get(key);
    if (!g) {
      g = { heading: item.heading, subheading: item.subheading || "(general)", module, known: 0, toPractise: 0, total: 0 };
      groups.set(key, g);
    }
    const status = learning[item.id]?.status ?? "new";
    g.total++;
    if (isKnown(status as any)) g.known++;
    else if (status === "learning") g.toPractise++;
  }
  return Array.from(groups.values());
}

export function groupsForSigns<T extends { id: number; heading: string; subheading?: string | null }>(items: T[]): GroupStats[] {
  return groupStats(items, getAllSignLearning(), "signs");
}

export function groupsForRules<T extends { id: number; heading: string; subheading?: string | null }>(items: T[]): GroupStats[] {
  return groupStats(items, getAllRuleLearning(), "rules");
}

export function groupsForControls(items: { id: number; heading: string; subheading?: string | null }[]): GroupStats[] {
  return groupStats(items, getAllControlLearning(), "controls");
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

/**
 * The one "Practise next" group: among groups with at least one
 * to-practise card, pick the one with the highest
 * toPractise / max(toPractise + known, 3). The floor of 3 stops one
 * missed card from outranking a group the learner is genuinely
 * struggling with; ties break on the larger to-practise count.
 */
export function nextPracticeGroup(signs: any[], rules: any[], controls: any[]): GroupStats | null {
  const candidates = [
    ...groupsForSigns(signs),
    ...groupsForRules(rules),
    ...groupsForControls(controls),
  ].filter((g) => g.toPractise > 0);
  if (candidates.length === 0) return null;
  const score = (g: GroupStats) => g.toPractise / Math.max(g.toPractise + g.known, 3);
  candidates.sort((a, b) => score(b) - score(a) || b.toPractise - a.toPractise);
  return candidates[0] ?? null;
}
