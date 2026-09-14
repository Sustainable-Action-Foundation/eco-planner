import { expect, test } from "playwright/test";

import { actionContentDiffers } from "../../src/functions/fields";
import { originPlanToSql, planActionOrigins, responsibleName, type CopyAction, type MunicipalityConfig } from "../../scripts/lib/actionOrigins";

/**
 * The action-origin backfill recreates one original per catalogue row from its per-org copies
 * and links the copies to it. These pin the clustering rules on a tiny catalogue.
 */

const uppsala: MunicipalityConfig = { geoAreaCode: "0380", orgName: "Uppsala", numberHeader: "NR", responsibleHeader: "Ansvariga" };

function copy(overrides: Partial<CopyAction> & { id: string; orgName: string; number?: string }): CopyAction {
  const { orgName, number, ...rest } = overrides;
  return {
    name: "Bygga cykelbanor",
    indicator_parameter: "Transport",
    start_year: 2025,
    end_year: null,
    created_at: new Date("2026-09-03"),
    author_id: "author",
    org: { id: `org-${orgName}`, name: orgName, geo_area_code: "0380" },
    fields: number === undefined ? [] : [{ header: "NR", value: number, type: "SHORT", order: 0 }],
    ...rest,
  };
}

let counter = 0;
const uuid = () => `uuid-${++counter}`;

test.describe("action origin backfill", () => {
  test.beforeEach(() => { counter = 0; });

  test("clusters copies by catalogue number and writes the responsibles back onto the original", () => {
    const copies = [
      copy({ id: "a", orgName: "Uppsala KS", number: "1.01" }),
      copy({ id: "b", orgName: "Uppsala GSN", number: "1.01", created_at: new Date("2026-09-04") }),
      copy({ id: "c", orgName: "Uppsala KS", number: "1.02", name: "Annat" }),
    ];
    const plan = planActionOrigins(copies, [], [uppsala], { uuid });

    expect(plan.orgsToCreate).toEqual([{ id: "uuid-1", name: "Uppsala", geo_area_code: "0380" }]);
    expect(plan.originals).toHaveLength(2);
    expect(plan.unmatched).toEqual([]);

    const [first, second] = plan.originals;
    expect(first.orgId).toBe("uuid-1");
    // The oldest copy stands in for the source row
    expect(first.representativeId).toBe("a");
    expect(first.members.map(member => member.id)).toEqual(["a", "b"]);
    expect(first.fields).toEqual([
      { header: "NR", value: "1.01", type: "SHORT", order: 0 },
      { header: "Ansvariga", value: "GSN", type: "SHORT", order: 1 },
      { header: "Ansvariga", value: "KS", type: "SHORT", order: 2 },
    ]);
    expect(second.name).toBe("Annat");
    expect(second.members.map(member => member.id)).toEqual(["c"]);
  });

  test("reuses an existing umbrella org, skips its own actions, and reports copies without a number", () => {
    const copies = [
      copy({ id: "own", orgName: "Uppsala", number: "1.01", org: { id: "umbrella", name: "Uppsala", geo_area_code: "0380" } }),
      copy({ id: "a", orgName: "Uppsala KS", number: "1.01" }),
      copy({ id: "lost", orgName: "Uppsala KS" }),
      copy({ id: "elsewhere", orgName: "Boden", number: "1.01", org: { id: "boden", name: "Boden", geo_area_code: "2582" } }),
    ];
    const plan = planActionOrigins(copies, [{ id: "umbrella", name: "Uppsala", geo_area_code: "0380" }], [uppsala], { uuid });

    expect(plan.orgsToCreate).toEqual([]);
    expect(plan.originals).toHaveLength(1);
    expect(plan.originals[0].orgId).toBe("umbrella");
    expect(plan.originals[0].members.map(member => member.id)).toEqual(["a"]);
    expect(plan.unmatched.map(copy => copy.id)).toEqual(["lost"]);
  });

  test("flags copies that drifted from the representative and can skip singletons", () => {
    const copies = [
      copy({ id: "a", orgName: "Uppsala KS", number: "1.01" }),
      copy({ id: "b", orgName: "Uppsala GSN", number: "1.01", name: "Bygga fler cykelbanor", created_at: new Date("2026-09-04") }),
      copy({ id: "c", orgName: "Uppsala KS", number: "1.02" }),
    ];
    const plan = planActionOrigins(copies, [], [uppsala], { uuid, clustersOnly: true });

    expect(plan.originals).toHaveLength(1);
    expect(plan.originals[0].members.find(member => member.id === "b")).toMatchObject({ nameDiffers: true, contentDiffers: true });
    expect(plan.originals[0].members.find(member => member.id === "a")).toMatchObject({ nameDiffers: false, contentDiffers: false });
  });

  test("emits one transaction that only links copies still without an origin", () => {
    const plan = planActionOrigins([copy({ id: "a", orgName: "Uppsala KS", number: "1.01", name: "It's 'quoted'" })], [], [uppsala], { uuid });
    const sql = originPlanToSql(plan);

    expect(sql.startsWith("START TRANSACTION;\n")).toBe(true);
    expect(sql.endsWith("COMMIT;\n")).toBe(true);
    expect(sql).toContain("INSERT INTO `Orgs` (`id`, `name`, `domain`, `geo_area_code`) VALUES ('uuid-1', 'Uppsala', NULL, '0380');");
    expect(sql).toContain("'It''s ''quoted'''");
    expect(sql).toContain("UPDATE `Actions` SET `origin_action_id` = 'uuid-2' WHERE `id` IN ('a') AND `origin_action_id` IS NULL;");
  });

  test("strips the municipality prefix from per-responsible org names", () => {
    expect(responsibleName("Uppsala KS", uppsala)).toBe("KS");
    expect(responsibleName("Region Uppsala", uppsala)).toBe("Region Uppsala");
  });
});

test.describe("actionContentDiffers", () => {
  const base = { name: "A", start_year: 2025, end_year: null, fields: [{ header: "NR", value: "1" }] };

  test("is false for equal content and true for any changed part", () => {
    expect(actionContentDiffers(base, { ...base, fields: [{ header: "NR", value: "1" }] })).toBe(false);
    expect(actionContentDiffers(base, { ...base, name: "B" })).toBe(true);
    expect(actionContentDiffers(base, { ...base, end_year: 2030 })).toBe(true);
    expect(actionContentDiffers(base, { ...base, fields: [{ header: "NR", value: "2" }] })).toBe(true);
    expect(actionContentDiffers(base, { ...base, fields: [] })).toBe(true);
  });
});
