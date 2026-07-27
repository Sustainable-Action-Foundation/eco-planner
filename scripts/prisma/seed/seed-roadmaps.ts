/* eslint-disable no-template-curly-in-string */
// Seeds meta roadmaps, their versions, and a set of unattached "template" scaling
// recipes. The national "Rikets färdplan" meta roadmap and its public version 2 are
// relied upon by the e2e test suite.

import { prisma } from "@/lib/prisma";
import { RoadmapType } from "@/lib/prisma/generated";
import type { MetaRoadmap, Roadmap } from "@/lib/prisma/generated";
import { Recipe, RecipeDataTypes, VectorIndexPickerOptions } from "@/functions/recipe";
import type { SeededUsers } from "./helpers.ts";
import { getRandomCreatedAtAndUpdatedAt, makeRandomComments, makeRandomLinks } from "./helpers.ts";
import { parseUnit } from "@/functions/unit";
import { UnitFlags } from "@/types/enums";

export type SeededRoadmaps = {
  metaRoadmaps: { national: MetaRoadmap; uppsala: MetaRoadmap };
  roadmaps: { nationalV1: Roadmap; nationalV2: Roadmap; uppsalaV1: Roadmap; uppsalaV2: Roadmap };
};

export async function seedRoadmaps(users: SeededUsers): Promise<SeededRoadmaps> {
  await createTemplateRecipes();

  const { admin, anita, anton } = users;
  const allEditors = { connect: [{ id: admin.id }, { id: anita.id }, { id: anton.id }] };

  /*
   * National meta roadmap - "Rikets färdplan"
   */
  const national = await prisma.metaRoadmap.create({
    data: {
      name: "Rikets färdplan",
      description:
        "Denna färdplan har lagts för att ge stöd till andra aktörer att ärva ifrån.\n\nResurser:\nhttps://sustainable-action.org/",
      actor: "Sverige",
      type: RoadmapType.NATIONAL,
      authorId: anita.id,
      isPublic: true,
      editors: { connect: [{ id: admin.id }] },
      ...getRandomCreatedAtAndUpdatedAt(),
      comments: { createMany: { data: makeRandomComments(users, 40) } },
      links: { create: makeRandomLinks(3) },
    },
  });

  const nationalV1 = await prisma.roadmap.create({
    data: {
      version: 1,
      authorId: anita.id,
      metaRoadmapId: national.id,
      description: "Det här är den första versionen av den nationella färdplanen.",
      isPublic: true,
      editors: allEditors,
      ...getRandomCreatedAtAndUpdatedAt(),
      comments: { createMany: { data: makeRandomComments(users, 30) } },
      links: { create: makeRandomLinks(2) },
    },
  });

  const nationalV2 = await prisma.roadmap.create({
    data: {
      version: 2,
      authorId: anita.id,
      metaRoadmapId: national.id,
      description: "Det här är den andra versionen av den nationella färdplanen.",
      isPublic: true,
      editors: allEditors,
      ...getRandomCreatedAtAndUpdatedAt(),
      comments: { createMany: { data: makeRandomComments(users, 30) } },
      links: { create: makeRandomLinks(2) },
    },
  });

  /*
   * Regional meta roadmap - "Uppsala län", a child of the national meta roadmap
   */
  const uppsala = await prisma.metaRoadmap.create({
    data: {
      name: "Uppsala län",
      description:
        "Denna färdplan har lagts för att främst ge stöd till kommunerna inom länet.\n\nLänkar:\nhttps://www.lansstyrelsen.se/uppsala.html",
      actor: "Uppsala län",
      type: RoadmapType.REGIONAL,
      authorId: admin.id,
      isPublic: true,
      parentRoadmapId: national.id,
      // Shared for viewing with the regular users' group.
      viewGroups: { connect: [{ id: users.group.id }] },
      ...getRandomCreatedAtAndUpdatedAt(),
      comments: { createMany: { data: makeRandomComments(users, 20) } },
      links: { create: makeRandomLinks(1) },
    },
  });

  const uppsalaV1 = await prisma.roadmap.create({
    data: {
      version: 1,
      authorId: admin.id,
      metaRoadmapId: uppsala.id,
      // Related to the national roadmap it inherits from.
      targetVersion: 1,
      isPublic: true,
      editors: allEditors,
      ...getRandomCreatedAtAndUpdatedAt(),
      comments: { createMany: { data: makeRandomComments(users, 10) } },
      links: { create: makeRandomLinks(1) },
    },
  });

  const uppsalaV2 = await prisma.roadmap.create({
    data: {
      version: 2,
      authorId: admin.id,
      metaRoadmapId: uppsala.id,
      targetVersion: 2,
      // A private version, shared with the regular users through their group.
      isPublic: false,
      editors: { connect: [{ id: admin.id }] },
      viewGroups: { connect: [{ id: users.group.id }] },
      ...getRandomCreatedAtAndUpdatedAt(),
      comments: { createMany: { data: makeRandomComments(users, 10) } },
    },
  });

  return {
    metaRoadmaps: { national, uppsala },
    roadmaps: { nationalV1, nationalV2, uppsalaV1, uppsalaV2 },
  };
}

/**
 * Creates the standard scaling recipes ("by area", "by population", "by constant")
 * as unattached templates. They contain `External` (SCB) variables, so seeding them
 * exercises the external-dataset shape of stored recipes without needing network access.
 */
async function createTemplateRecipes(): Promise<void> {
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
    [byArea, byPopulation, byScalar].map(recipe => prisma.recipe.create({ data: { recipe: recipe.serialize() } })),
  );
}
