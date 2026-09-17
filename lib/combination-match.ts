import type { TableCombination } from "@/lib/types";

export type AssignmentMatch =
  | { kind: "empty" }
  | { kind: "table"; table_id: string }
  | { kind: "combination"; combination_id: string; combination: TableCombination }
  | { kind: "none" };

/**
 * Turn a set of picked tables into the payload the API expects.
 *
 * Matching is **exact sorted-set equality**, never a subset. This is the
 * frontend mirror of a backend bug that recorded the wrong group: the server
 * used to resolve a combination by "any group sharing one of these tables",
 * which with overlapping groups (A+B and A+C) could name a different group than
 * the one being seated. A subset match here would reintroduce it from the
 * client side.
 *
 * Two or more tables that aren't a saved group return `"none"` — the caller
 * should block submission and say so, rather than silently sending one table.
 */
export function matchAssignment(
  selectedIds: string[],
  combinations: TableCombination[],
): AssignmentMatch {
  const ids = [...new Set(selectedIds)].filter(Boolean);

  if (ids.length === 0) return { kind: "empty" };
  if (ids.length === 1) return { kind: "table", table_id: ids[0] };

  const wanted = [...ids].sort().join("|");

  const match = combinations.find(
    (c) => [...c.table_ids].sort().join("|") === wanted,
  );

  return match
    ? { kind: "combination", combination_id: match.id, combination: match }
    : { kind: "none" };
}

/** Human label for a matched assignment, for confirm buttons and summaries. */
export function describeMatch(match: AssignmentMatch, tableNameFor: (id: string) => string): string {
  switch (match.kind) {
    case "table":
      return tableNameFor(match.table_id);
    case "combination":
      return `${match.combination.name} · seats ${match.combination.effective_max_capacity}`;
    case "none":
      return "Not a saved group";
    case "empty":
      return "Nothing selected";
  }
}

/**
 * Why a matched group can't seat this party, or null.
 *
 * Mirrors CombinationSelectionGuard check 5, which applies to STAFF as well as
 * guests — so exceeding the group's seats is a 422, not an operational choice,
 * and the UI should say so before the request. Seating a small party on a group
 * is deliberately NOT an error here: that check is guest-only, and staff
 * consolidating the floor is a real move.
 */
export function combinationCapacityError(
  match: AssignmentMatch,
  partySize: number,
): string | null {
  if (match.kind !== "combination") return null;

  const max = match.combination.effective_max_capacity;

  return partySize > max
    ? `${match.combination.name} seats up to ${max}, and this party is ${partySize}.`
    : null;
}
