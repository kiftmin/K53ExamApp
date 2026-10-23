// Aggregates client-side learning records into per-group stats.
// A group tracks four numbers: known (mastered or legacy review),
// to practise (status learning), not tried (no rating) and total.
// New items are never counted as "to practise".

import type { ControlDiagram, StudyControl } from "@shared/schema";
import { getAllSignLearning } from "./sign-storage";
import { getAllRuleLearning } from "./rule-storage";
import { getAllControlLearning } from "./control-storage";
import { isKnown } from "./learning-status";
import { visibleSigns } from "./sign-codes";

/** How many untried cards a practise deck adds after the missed cards. */
export const PRACTISE_NEW_CAP = 10;

export interface GroupStats {
  heading: string;
  subheading: string;
  module: "signs" | "rules" | "controls";
  known: number;
  toPractise: number; // status learning
  notTried: number; // no rating yet (status new)
  total: number; // every item in the group
}

type LearningMap = Record<number, { status?: string } | undefined>;

function groupStats<T extends { id: number; heading: string; subheading?: string | null }>(
  items: T[],
  learning: LearningMap,
  module: GroupStats["module"]
): GroupStats[] {
  const groups = new Map<string, GroupStats>();
  for (const item of items) {
    const key = `${item.heading}|||${item.subheading || ""}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        heading: item.heading,
        subheading: item.subheading || "(general)",
        module,
        known: 0,
        toPractise: 0,
        notTried: 0,
        total: 0,
      };
      groups.set(key, g);
    }
    const status = learning[item.id]?.status ?? "new";
    g.total++;
    if (isKnown(status as any)) g.known++;
    else if (status === "learning") g.toPractise++;
    else if (status === "new") g.notTried++;
  }
  return Array.from(groups.values());
}

export function groupsForSigns<T extends { id: number; heading: string; subheading?: string | null; codes: string[] }>(
  items: T[]
): GroupStats[] {
  return groupStats(visibleSigns(items), getAllSignLearning(), "signs");
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

function practiceScore(g: GroupStats): number {
  return g.toPractise / Math.max(g.toPractise + g.known, 3);
}

/**
 * The best "Practise next" group per module (at most one Signs, one Rules
 * and one Controls group), ordered by toPractise / max(toPractise + known, 3).
 * Picking one group per module stops a large module from crowding the others
 * out of the suggestion entirely.
 */
export function nextPracticeGroups(signs: any[], rules: any[], controls: any[]): GroupStats[] {
  const best = [groupsForSigns(signs), groupsForRules(rules), groupsForControls(controls)]
    .map((groups) => {
      const candidates = groups.filter((g) => g.toPractise > 0);
      candidates.sort((a, b) => practiceScore(b) - practiceScore(a) || b.toPractise - a.toPractise);
      return candidates[0];
    })
    .filter((g): g is GroupStats => !!g);
  return best.sort((a, b) => practiceScore(b) - practiceScore(a) || b.toPractise - a.toPractise);
}

/**
 * Build a practise deck for one group: every "Not yet" card first, then the
 * group's untried cards (capped at PRACTISE_NEW_CAP), in normal id order.
 * Returns an empty deck when the group has no "Not yet" cards, so untried
 * cards alone never trigger a suggestion. Known cards are never included.
 */
export function practiseDeckItems<T extends { id: number; heading: string; subheading?: string | null }>(
  items: T[],
  learning: LearningMap,
  group: { heading?: string | null; subheading?: string | null }
): T[] {
  const inGroup = items
    .filter((item) => {
      if (group.heading && group.heading !== "all" && item.heading !== group.heading) return false;
      if (
        group.subheading &&
        group.subheading !== "all" &&
        group.subheading !== "(general)" &&
        (item.subheading || "") !== group.subheading
      ) {
        return false;
      }
      return true;
    })
    .sort((a, b) => a.id - b.id);

  const missed = inGroup.filter((item) => learning[item.id]?.status === "learning");
  if (missed.length === 0) return [];
  const untried = inGroup
    .filter((item) => (learning[item.id]?.status ?? "new") === "new")
    .slice(0, PRACTISE_NEW_CAP);
  return [...missed, ...untried];
}
