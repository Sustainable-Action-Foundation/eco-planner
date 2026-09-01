import { AccessLevel, IterationStatus, RoadmapType, Sharing } from "@/lib/prisma/generated";
import type { RoadmapIterations, Roadmaps } from "@/lib/prisma/generated";
/* eslint-disable no-template-curly-in-string */
// Seeds roadmaps (with their org-owned access controls and grants), their
// iterations, and a set of unattached "template" scaling recipes. The national
// "Rikets färdplan" roadmap and its published version 2 are relied upon by the
// e2e test suite.
//
// Access setup exercised here:
//   - national: public, RW grant to the regular users' group (they can edit)
//   - uppsala:  org-readable only (not public), RO grant to the group;
//               v2 is a DRAFT (status DRAFT), visible only to editors/managers

import { prisma } from "@/lib/prisma";
import { Recipe } from "@/functions/recipe";
import { RecipeDataTypes, VectorIndexPickerOptions } from "@/functions/recipe/types/enums";
import type { SeededUsers } from "./helpers.ts";
import { getRandomCreatedAtAndUpdatedAt, getRandomDateInThePast, makeRandomComments } from "./helpers.ts";
import { parseUnit } from "@/functions/unit";
import { UnitFlags } from "@/types/enums";

export type SeededRoadmaps = {
  roadmaps: { national: Roadmaps; uppsala: Roadmaps };
  iterations: { nationalV1: RoadmapIterations; nationalV2: RoadmapIterations; uppsalaV1: RoadmapIterations; uppsalaV2: RoadmapIterations };
};

export async function seedRoadmaps(users: SeededUsers): Promise<SeededRoadmaps> {
  await createTemplateRecipes(users.org.id);

  const { admin, anita, org, group } = users;

  /*
   * National roadmap - "Rikets färdplan": public, editable by the group via an RW grant
   */
  const national = await prisma.roadmaps.create({
    data: {
      name: "Rikets färdplan",
      description:
        "Denna färdplan har lagts för att ge stöd till andra aktörer att ärva ifrån.\n\nResurser:\nhttps://sustainable-action.ngo/",
      actor: "Sverige",
      geo_area: { connect: { code: "00" } },
      type: RoadmapType.NATIONAL,
      author: { connect: { id: anita.id } },
      access_control: {
        create: { org: { connect: { id: org.id } }, sharing: Sharing.PUBLIC },
      },
      ...getRandomCreatedAtAndUpdatedAt(),
      comments: { createMany: { data: makeRandomComments(users, 40) } },
    },
  });

  const nationalV1 = await prisma.roadmapIterations.create({
    data: {
      version: 1,
      author: { connect: { id: anita.id } },
      roadmap: { connect: { id: national.id } },
      description: "Det här är den första versionen av den nationella färdplanen.",
      status: IterationStatus.PUBLISHED,
      published_at: getRandomDateInThePast(),
      ...getRandomCreatedAtAndUpdatedAt(),
      comments: { createMany: { data: makeRandomComments(users, 30) } },
    },
  });

  const nationalV2 = await prisma.roadmapIterations.create({
    data: {
      version: 2,
      author: { connect: { id: anita.id } },
      roadmap: { connect: { id: national.id } },
      description: "Det här är den andra versionen av den nationella färdplanen.",
      status: IterationStatus.PUBLISHED,
      published_at: getRandomDateInThePast(),
      ...getRandomCreatedAtAndUpdatedAt(),
      comments: { createMany: { data: makeRandomComments(users, 30) } },
    },
  });

  /*
   * Regional roadmap - "Uppsala län", a child of the national roadmap.
   * Not public: org members can read it (ORG sharing), the group holds an RO grant,
   * and its second iteration is a draft only editors/managers can see.
   */
  const uppsala = await prisma.roadmaps.create({
    data: {
      name: "Uppsala län",
      description:
        "Denna färdplan har lagts för att främst ge stöd till kommunerna inom länet.\n\nLänkar:\nhttps://www.lansstyrelsen.se/uppsala.html",
      actor: "Uppsala län",
      geo_area: { connect: { code: "03" } },
      type: RoadmapType.REGIONAL,
      author: { connect: { id: admin.id } },
      parent_roadmap: { connect: { id: national.id } },
      access_control: {
        create: { org: { connect: { id: org.id } }, sharing: Sharing.ORG },
      },
      ...getRandomCreatedAtAndUpdatedAt(),
      comments: { createMany: { data: makeRandomComments(users, 20) } },
    },
    include: { access_control: { select: { id: true } } },
  });

  // Grants (top-level createMany: the composite FKs pair each grant's group and
  // access control through the shared org_id column)
  const nationalWithAc = await prisma.roadmaps.findUniqueOrThrow({
    where: { id: national.id },
    select: { access_control_id: true },
  });
  await prisma.accessGrants.createMany({
    data: [
      { access_control_id: nationalWithAc.access_control_id, group_id: group.id, org_id: org.id, access_level: AccessLevel.RW },
      { access_control_id: uppsala.access_control_id, group_id: group.id, org_id: org.id, access_level: AccessLevel.RO },
    ],
  });

  const uppsalaV1 = await prisma.roadmapIterations.create({
    data: {
      version: 1,
      author: { connect: { id: admin.id } },
      roadmap: { connect: { id: uppsala.id } },
      // Related to the national roadmap it inherits from.
      target_version: 1,
      status: IterationStatus.PUBLISHED,
      published_at: getRandomDateInThePast(),
      ...getRandomCreatedAtAndUpdatedAt(),
      comments: { createMany: { data: makeRandomComments(users, 10) } },
    },
  });

  const uppsalaV2 = await prisma.roadmapIterations.create({
    data: {
      version: 2,
      author: { connect: { id: admin.id } },
      roadmap: { connect: { id: uppsala.id } },
      target_version: 2,
      // A draft: only users with edit access (managers, RW grants) can see it.
      status: IterationStatus.DRAFT,
      ...getRandomCreatedAtAndUpdatedAt(),
      comments: { createMany: { data: makeRandomComments(users, 10) } },
    },
  });

  return {
    roadmaps: { national, uppsala },
    iterations: { nationalV1, nationalV2, uppsalaV1, uppsalaV2 },
  };
}

/**
 * Creates the standard scaling recipes ("by area", "by population", "by constant")
 * as unattached templates. They contain `External` (SCB) variables, so seeding them
 * exercises the external-dataset shape of stored recipes without needing network access.
 */
async function createTemplateRecipes(orgId: string): Promise<void> {
  const byArea = new Recipe({
    name: "Skala utifrån yta",
    equation: "${Riket} * ${ArvingsArea} / ${RiketsArea}",
    meta: { isSuggestedRecipe: true },
    variables: [
      { id: "riket", name: "Riket", type: RecipeDataTypes.DataSeries, dataSeriesId: null, pick: VectorIndexPickerOptions.Default, value: null, unit: parseUnit("km^2") },
      {
        id: "rikets-area", name: "Rikets area", type: RecipeDataTypes.External, pick: VectorIndexPickerOptions.Default, unit: UnitFlags.Missing,
        dataset: "SCB", tableId: "TAB6420",
        selection: [
          { variableCode: "Region", valueCodes: ["00"] },
          { variableCode: "ArealTyp", valueCodes: ["01"] },
          { variableCode: "ContentsCode", valueCodes: ["000007DY"] },
        ],
      },
      {
        id: "arvings-area", name: "Arvings area", type: RecipeDataTypes.External, pick: VectorIndexPickerOptions.Default, unit: UnitFlags.Missing,
        dataset: "SCB", tableId: "TAB6420",
        selection: [
          { variableCode: "ArealTyp", valueCodes: ["01"] },
          { variableCode: "ContentsCode", valueCodes: ["000007DY"] },
        ],
      },
    ],
  });

  const byPopulation = new Recipe({
    name: "Skala utifrån befolkning",
    equation: "${Riket} * ${ArvingsPopulation} / ${RiketsPopulation}",
    meta: { isSuggestedRecipe: true },
    variables: [
      { id: "riket", name: "Riket", type: RecipeDataTypes.DataSeries, dataSeriesId: null, pick: VectorIndexPickerOptions.Default, value: null, unit: parseUnit("capita") },
      {
        id: "rikets-befolkning", name: "Rikets befolkning", type: RecipeDataTypes.External, pick: VectorIndexPickerOptions.Default, unit: UnitFlags.Missing,
        dataset: "SCB", tableId: "BE0101N1",
        selection: [
          { variableCode: "Region", valueCodes: ["00"] },
          { variableCode: "ContentsCode", valueCodes: ["000007E1"] },
        ],
      },
      {
        id: "arvings-befolkning", name: "Arvings befolkning", type: RecipeDataTypes.External, pick: VectorIndexPickerOptions.Default, unit: UnitFlags.Missing,
        dataset: "SCB", tableId: "BE0101N1",
        selection: [{ variableCode: "ContentsCode", valueCodes: ["000007E1"] }],
      },
    ],
  });

  const byScalar = new Recipe({
    name: "Skala utifrån fast värde",
    equation: "${Riket} / ${skalär}",
    meta: { isSuggestedRecipe: true },
    variables: [
      { id: "riket", name: "Riket", type: RecipeDataTypes.DataSeries, dataSeriesId: null, pick: VectorIndexPickerOptions.Default, value: null, unit: UnitFlags.Missing },
      { id: "skalär", name: "skalär", type: RecipeDataTypes.Scalar, value: 1 + Math.random(), unit: UnitFlags.Unitless },
    ],
  });

  await prisma.$transaction(
    [byArea, byPopulation, byScalar].map(recipe =>
      prisma.recipes.create({ data: { recipe: recipe.serialize(), org: { connect: { id: orgId } } } })),
  );
}
