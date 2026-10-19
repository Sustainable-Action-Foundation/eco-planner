import fs from "node:fs";
import path from "node:path";
import { expect, test } from "playwright/test";

import accessChecker, { hasEditAccess, hasViewAccess } from "../../src/lib/accessChecker";
import {
  allGroupIds,
  editableActionsWHERE,
  editableDataSeriesWHERE,
  listedGoalsWHERE,
  managedOrgIds,
  memberOrgIds,
  publishedIterationsOfTypeWHERE,
  readableAccessControlWHERE,
  visibleActionsWHERE,
  visibleDataSeriesWHERE,
  visibleRoadmapIterationsWHERE,
  writableAccessControlWHERE,
} from "../../src/lib/accessFilters";
import { isGoalListed } from "../../src/lib/listing";
import { AccessLevel as GrantLevel, GoalListing, IterationStatus, RoadmapType, Sharing } from "../../src/lib/prisma/generated";
import type { AccessControlInfo } from "../../src/types";
import { accessControls, contexts, IDLE_GROUP, ORG, OTHER_ORG, RO_GROUP, RW_GROUP, type AccessControlName, type ContextName } from "../lib/access-contexts";

/*
 * accessFilters.ts builds Prisma WHERE clauses that must agree with
 * accessChecker; nothing in the code enforces that. This runs the WHERE
 * objects through a tiny interpreter of the Prisma subset they use (equality,
 * `in`, `not`, `some`, nested relations, OR) over the same fixtures the
 * checker test uses, and demands identical verdicts.
 */

type Where = Record<string, unknown>;

/** Interprets the Prisma WHERE subset used by accessFilters against a plain record */
function matches(where: unknown, record: unknown): boolean {
  if (where === null || typeof where !== "object") return record === where;
  const clause = where as Where;
  return Object.entries(clause).every(([key, condition]) => {
    if (key === "OR") return (condition as unknown[]).some(sub => matches(sub, record));
    if (key === "AND") return (condition as unknown[]).every(sub => matches(sub, record));
    if (key === "NOT") return !matches(condition, record);
    const value = (record as Where | null | undefined)?.[key];
    if (condition === null || typeof condition !== "object") return value === condition;
    const operator = condition as Where;
    if ("in" in operator) return (operator.in as unknown[]).includes(value);
    if ("not" in operator) return value !== operator.not;
    if ("some" in operator) return Array.isArray(value) && value.some(item => matches(operator.some, item));
    // Nested relation: a null relation never matches a relation filter
    if (value === null || value === undefined) return false;
    return matches(condition, value);
  });
}

const contextNames = Object.keys(contexts) as ContextName[];
const accessControlNames = Object.keys(accessControls) as AccessControlName[];

/** Iteration records over every access control × status */
const iterations = accessControlNames.flatMap(acName =>
  Object.values(IterationStatus).map(status => ({
    name: `${acName}/${status}`,
    status,
    access_control: accessControls[acName],
    roadmap: { access_control: accessControls[acName] },
  })),
);

test.describe("the interpreter understands the Prisma subset", () => {
  test("equality, in, not, some, nesting, OR and the empty clause", () => {
    expect(matches({}, { anything: 1 })).toBe(true);
    expect(matches({ a: 1 }, { a: 1 })).toBe(true);
    expect(matches({ a: 1 }, { a: 2 })).toBe(false);
    expect(matches({ a: { in: [1, 2] } }, { a: 2 })).toBe(true);
    expect(matches({ a: { in: [] } }, { a: 2 })).toBe(false);
    expect(matches({ a: { not: 1 } }, { a: 2 })).toBe(true);
    expect(matches({ list: { some: { x: 1 } } }, { list: [{ x: 0 }, { x: 1 }] })).toBe(true);
    expect(matches({ list: { some: { x: 1 } } }, { list: [] })).toBe(false);
    expect(matches({ rel: { a: 1 } }, { rel: { a: 1 } })).toBe(true);
    expect(matches({ rel: { a: 1 } }, { rel: null })).toBe(false);
    expect(matches({ rel: null }, { rel: null })).toBe(true);
    expect(matches({ rel: null }, { rel: { a: 1 } })).toBe(false);
    expect(matches({ OR: [{ a: 1 }, { b: 2 }] }, { a: 0, b: 2 })).toBe(true);
    expect(matches({ OR: [] }, { a: 0 })).toBe(false);
  });
});

test.describe("membership helpers", () => {
  test("managed, member and group ids per context", () => {
    expect(managedOrgIds(contexts.manager)).toEqual([ORG]);
    expect(managedOrgIds(contexts.member)).toEqual([]);
    expect(managedOrgIds(contexts.foreignManager)).toEqual([OTHER_ORG]);
    expect(memberOrgIds(contexts.member)).toEqual([ORG]);
    expect(memberOrgIds(contexts.manager)).toEqual([ORG]);
    expect(memberOrgIds(contexts.guest)).toEqual([]);
    expect(memberOrgIds(contexts.guestRO)).toEqual([]);
    expect(allGroupIds(contexts.memberRW).sort()).toEqual([RO_GROUP, RW_GROUP].sort());
    expect(allGroupIds(contexts.memberIdleGroup)).toEqual([IDLE_GROUP]);
    expect(allGroupIds(contexts.orgless)).toEqual([]);
  });

  test("groups are collected across all memberships", () => {
    const multi = { ...contexts.member, memberships: [...contexts.member.memberships, { orgId: OTHER_ORG, role: "MEMBER" as const, groupIds: ["g-other"] }, { orgId: ORG, role: "GUEST" as const, groupIds: ["g-guest"] }] };
    expect(allGroupIds(multi)).toEqual(["g-other", "g-guest"]);
    expect(memberOrgIds(multi)).toEqual([ORG, OTHER_ORG]);
  });
});

test.describe("readable / writable access controls agree with accessChecker", () => {
  for (const contextName of contextNames) {
    test(`${contextName}`, () => {
      const readable = readableAccessControlWHERE(contexts[contextName]);
      const writable = writableAccessControlWHERE(contexts[contextName]);
      for (const acName of accessControlNames) {
        const level = accessChecker({ access_control: accessControls[acName] }, contexts[contextName]);
        expect(matches(readable, accessControls[acName]), `${contextName} reads ${acName}`).toBe(hasViewAccess(level));
        expect(matches(writable, accessControls[acName]), `${contextName} writes ${acName}`).toBe(hasEditAccess(level));
      }
    });
  }

  test("anonymous visitors get the literal public-only / nothing clauses", () => {
    expect(readableAccessControlWHERE(null)).toEqual({ sharing: Sharing.PUBLIC });
    expect(writableAccessControlWHERE(null)).toEqual({ org_id: { in: [] } });
  });

  test("super admins get the empty clause (everything)", () => {
    expect(readableAccessControlWHERE(contexts.superAdmin)).toEqual({});
    expect(writableAccessControlWHERE(contexts.superAdmin)).toEqual({});
    expect(editableActionsWHERE(contexts.superAdmin)).toEqual({});
  });

  test("the member clauses carry exactly the ladder's rungs", () => {
    expect(readableAccessControlWHERE(contexts.memberRW)).toEqual({
      OR: [
        { sharing: Sharing.PUBLIC },
        { org_id: { in: [] } },
        { sharing: Sharing.ORG, org_id: { in: [ORG] } },
        { grants: { some: { group_id: { in: [RW_GROUP, RO_GROUP] } } } },
      ],
    });
    expect(writableAccessControlWHERE(contexts.memberRW)).toEqual({
      OR: [
        { org_id: { in: [] } },
        { grants: { some: { group_id: { in: [RW_GROUP, RO_GROUP] }, access_level: GrantLevel.RW } } },
      ],
    });
    expect(writableAccessControlWHERE(contexts.manager)).toEqual({
      OR: [
        { org_id: { in: [ORG] } },
        { grants: { some: { group_id: { in: [] }, access_level: GrantLevel.RW } } },
      ],
    });
  });

  test("a grant on a group in another org is matched by id, like the checker does", () => {
    const foreignGrant: AccessControlInfo = { ...accessControls.groupsNoGrants, org_id: OTHER_ORG, grants: [{ group_id: RW_GROUP, access_level: GrantLevel.RW }] };
    const level = accessChecker({ access_control: foreignGrant }, contexts.memberRW);
    expect(matches(writableAccessControlWHERE(contexts.memberRW), foreignGrant)).toBe(hasEditAccess(level));
  });
});

test.describe("visible iterations agree with accessChecker on drafts", () => {
  for (const contextName of contextNames) {
    test(`${contextName}`, () => {
      const visible = visibleRoadmapIterationsWHERE(contexts[contextName]);
      for (const iteration of iterations) {
        const level = accessChecker(iteration, contexts[contextName]);
        expect(matches(visible, iteration), `${contextName} sees ${iteration.name}`).toBe(hasViewAccess(level));
      }
    });
  }
});

test.describe("published iterations of a roadmap type keep the access filter", () => {
  // Regression: spreading visibleRoadmapIterationsWHERE next to `roadmap: { type }` replaced its
  // `roadmap.access_control`, so goals on non-public national roadmaps matched for everyone.
  for (const contextName of contextNames) {
    test(`${contextName}`, () => {
      const where = publishedIterationsOfTypeWHERE(contexts[contextName], RoadmapType.NATIONAL);
      for (const iteration of iterations) {
        const level = accessChecker(iteration, contexts[contextName]);
        for (const type of [RoadmapType.NATIONAL, RoadmapType.MUNICIPAL]) {
          const typed = { ...iteration, roadmap: { ...iteration.roadmap, type } };
          const expected = hasViewAccess(level) && iteration.status === IterationStatus.PUBLISHED && type === RoadmapType.NATIONAL;
          expect(matches(where, typed), `${contextName} matches ${type} ${iteration.name}`).toBe(expected);
        }
      }
    });
  }

  test("access and type are ANDed rather than merged into one roadmap clause", () => {
    for (const ctx of [contexts.anonymous, contexts.orgless]) {
      const where = publishedIterationsOfTypeWHERE(ctx, RoadmapType.NATIONAL);
      expect(Object.keys(where)).toEqual(["AND"]);
      expect(where.AND).toEqual([
        visibleRoadmapIterationsWHERE(ctx),
        { status: IterationStatus.PUBLISHED, roadmap: { type: RoadmapType.NATIONAL } },
      ]);
      expect(visibleRoadmapIterationsWHERE(ctx).roadmap?.access_control).toEqual(readableAccessControlWHERE(ctx));
    }
  });

  test("national goal matches build their iteration filter with the helper", () => {
    // The helper is only a fix if the call site uses it: a spread next to a `roadmap:` key is the
    // shape that overwrote the access filter. The fetcher is server-only, so this checks its source.
    const source = fs.readFileSync(path.join(process.cwd(), "src/fetchers/getNationalGoalMatches.ts"), "utf-8");
    expect(source).toContain("publishedIterationsOfTypeWHERE(accessContext, RoadmapType.NATIONAL)");
    expect(source).not.toMatch(/\.\.\.visibleRoadmapIterationsWHERE\(/);
  });
});

test.describe("listed goals agree with isGoalListed", () => {
  for (const contextName of contextNames) {
    test(`${contextName}`, () => {
      const listed = listedGoalsWHERE(contexts[contextName]);
      for (const iteration of iterations) {
        const level = accessChecker(iteration, contexts[contextName]);
        for (const listing of Object.values(GoalListing)) {
          const goal = { listing, roadmap_iteration: iteration };
          // The WHERE is applied on top of visibility, so only compare where the goal is readable at all
          if (!hasViewAccess(level)) continue;
          expect(matches(listed, goal), `${contextName} lists ${listing} goal in ${iteration.name}`).toBe(isGoalListed(goal, level));
        }
      }
    });
  }

  test("unlisted goals under an unreadable roadmap never match", () => {
    const listed = listedGoalsWHERE(contexts.orgless);
    const hidden = { listing: GoalListing.UNLISTED, roadmap_iteration: iterations.find(it => it.name === "orgNoGrants/PUBLISHED") };
    expect(matches(listed, hidden)).toBe(false);
  });
});

test.describe("actions", () => {
  for (const contextName of contextNames) {
    test(`${contextName}: visibility and editability of actions under iterations`, () => {
      const visible = visibleActionsWHERE(contexts[contextName]);
      const editable = editableActionsWHERE(contexts[contextName]);
      for (const iteration of iterations) {
        const level = accessChecker(iteration, contexts[contextName]);
        const action = { org_id: ORG, roadmap_iteration: iteration };
        expect(matches(visible, action), `${contextName} sees action in ${iteration.name}`).toBe(hasViewAccess(level));
        expect(matches(editable, action), `${contextName} edits action in ${iteration.name}`).toBe(hasEditAccess(level));
      }
    });
  }

  test("roadmapless actions are visible to everyone and editable by the owning org's managers", () => {
    const roadmapless = { org_id: ORG, roadmap_iteration: null };
    for (const contextName of contextNames) {
      expect(matches(visibleActionsWHERE(contexts[contextName]), roadmapless), `${contextName} sees`).toBe(true);
    }
    expect(matches(editableActionsWHERE(contexts.manager), roadmapless)).toBe(true);
    expect(matches(editableActionsWHERE(contexts.superAdmin), roadmapless)).toBe(true);
    expect(matches(editableActionsWHERE(contexts.foreignManager), roadmapless)).toBe(false);
    expect(matches(editableActionsWHERE(contexts.memberRW), roadmapless)).toBe(false);
    expect(matches(editableActionsWHERE(contexts.member), roadmapless)).toBe(false);
    expect(matches(editableActionsWHERE(null), roadmapless)).toBe(false);
    expect(editableActionsWHERE(null)).toEqual({ org_id: { in: [] } });
  });
});

test.describe("data series derive their access from the dependent slot", () => {
  for (const contextName of contextNames) {
    test(`${contextName}`, () => {
      const visible = visibleDataSeriesWHERE(contexts[contextName]);
      const editable = editableDataSeriesWHERE(contexts[contextName]);
      for (const iteration of iterations) {
        const level = accessChecker(iteration, contexts[contextName]);
        const goal = { roadmap_iteration: iteration };
        for (const slot of ["dependent_goal", "dependent_baseline", "dependent_historical"] as const) {
          const series = { dependent_goal: null, dependent_baseline: null, dependent_historical: null, dependent_effect: null, [slot]: goal };
          expect(matches(visible, series), `${contextName} sees ${slot} in ${iteration.name}`).toBe(hasViewAccess(level));
          expect(matches(editable, series), `${contextName} edits ${slot} in ${iteration.name}`).toBe(hasEditAccess(level));
        }
        // An effect under the same iteration for both action and goal
        const effectSeries = {
          dependent_goal: null, dependent_baseline: null, dependent_historical: null,
          dependent_effect: { action: { org_id: ORG, roadmap_iteration: iteration }, goal },
        };
        expect(matches(visible, effectSeries), `${contextName} sees effect in ${iteration.name}`).toBe(hasViewAccess(level));
        expect(matches(editable, effectSeries), `${contextName} edits effect in ${iteration.name}`).toBe(hasEditAccess(level));
      }
    });
  }

  test("an orphan series (no dependent slot) matches nothing", () => {
    const orphan = { dependent_goal: null, dependent_baseline: null, dependent_historical: null, dependent_effect: null };
    expect(matches(visibleDataSeriesWHERE(contexts.superAdmin), orphan)).toBe(false);
    expect(matches(editableDataSeriesWHERE(contexts.superAdmin), orphan)).toBe(false);
  });

  test("an effect needs access to both its action's and its goal's iteration", () => {
    const readableIteration = iterations.find(it => it.name === "orgNoGrants/PUBLISHED");
    const hiddenIteration = iterations.find(it => it.name === "groupsNoGrants/PUBLISHED");
    const mixed = {
      dependent_goal: null, dependent_baseline: null, dependent_historical: null,
      dependent_effect: { action: { org_id: ORG, roadmap_iteration: hiddenIteration }, goal: { roadmap_iteration: readableIteration } },
    };
    expect(matches(visibleDataSeriesWHERE(contexts.member), mixed)).toBe(false);
    expect(matches(visibleDataSeriesWHERE(contexts.manager), mixed)).toBe(true);
  });
});
