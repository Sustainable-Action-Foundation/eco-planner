// Actions for the places' roadmaps, so their landing pages and versions show
// more than the copied goals: a handful of typical municipal climate measures,
// each affecting the copied goal its indicator parameter names (when the copy
// exists), with typed fields (including a repeated SHORT header to exercise
// the structural list collapse). The place without a copy gets its actions in
// the org's action database instead, since its draft has no goals yet.

import { prisma } from "@/lib/prisma";
import { ActionFieldType, ActionImpactType } from "@/lib/prisma/generated";
import { ActionFieldHeaders, defaultActionFieldType } from "@/functions/fields";
import { Recipe } from "@/functions/recipe";
import { dateValuesToDBDateRecord } from "@/functions/recipe/vectorAndMaskUtils";
import { parseUnit } from "@/functions/unit";
import type { DateValues } from "@/types";
import type { SeededUsers } from "./helpers.ts";
import { RandomTextSE, chance, getRandomCreatedAtAndUpdatedAt, randomInt, randomOf } from "./helpers.ts";
import type { SeededLeap } from "./seed-leap.ts";

type Measure = {
  name: string;
  /** The LEAP row the measure moves; the action's indicator parameter, and the copied goal it gets an effect on */
  indicatorParameter: string;
  actors: string[];
  years: [number, number];
  impact: ActionImpactType;
  /** A yearly effect of about this size in the goal's unit (grows linearly to it) */
  size: number;
};

const K = "Key\\";
const measures: Measure[] = [
  { name: "Utbyggnad av publik laddinfrastruktur", indicatorParameter: `${K}Landtransporter\\Personbilar\\Elbilar\\Antal bilar`, actors: ["Kommunen", "Elnätsbolaget"], years: [2026, 2032], impact: ActionImpactType.DELTA, size: 400 },
  { name: "Fossilfri fordonsflotta i kommunens verksamheter", indicatorParameter: `${K}Landtransporter\\Lätta lastbilar\\ellastbilar`, actors: ["Kommunen"], years: [2026, 2030], impact: ActionImpactType.DELTA, size: 60 },
  { name: "Solceller på kommunala tak", indicatorParameter: `${K}Energiomvandlingsanläggningar\\Årlig elproduktion\\Solkraft tak`, actors: ["Fastighetsbolaget", "Kommunen"], years: [2026, 2035], impact: ActionImpactType.PERCENT, size: 8 },
  { name: "Energieffektivisering av flerbostadshus", indicatorParameter: `${K}Bostäder och lokaler\\Flerbostadshus\\Värmebehov per kvadratmeter uppvärmd yta`, actors: ["Bostadsbolaget"], years: [2027, 2040], impact: ActionImpactType.PERCENT, size: -6 },
  { name: "Konvertering av kvarvarande oljepannor", indicatorParameter: `${K}Bostäder och lokaler\\Småhus\\Olja procentandel värmebehov`, actors: ["Energi- och klimatrådgivningen"], years: [2026, 2030], impact: ActionImpactType.ABSOLUTE, size: 0 },
  { name: "Cykelvägar och stärkt kollektivtrafik", indicatorParameter: `${K}Landtransporter\\Personbilar\\Fordonskm`, actors: ["Kommunen", "Regionen"], years: [2026, 2035], impact: ActionImpactType.PERCENT, size: -5 },
  { name: "Klimatkrav i upphandling av byggentreprenader", indicatorParameter: `${K}Service\\Arbetsmaskiner\\Byggverksamhet\\Slutanvändning arbetsmaskiner`, actors: ["Upphandlingsenheten"], years: [2027, 2033], impact: ActionImpactType.PERCENT, size: -10 },
  { name: "Etablering av vindkraft", indicatorParameter: `${K}Energiomvandlingsanläggningar\\Årlig elproduktion\\Vindkraft landbaserad`, actors: ["Kommunen", "Vindkraftsbolaget"], years: [2028, 2036], impact: ActionImpactType.PERCENT, size: 15 },
];

export async function seedPlaceContent(users: SeededUsers, leap: SeededLeap): Promise<void> {
  for (const { place, org, members } of users.places) {
    const copy = leap.byOrg[org.id];
    const copiedGoals = await prisma.goals.findMany({
      where: { id: { in: copy?.goalIds ?? [] } },
      select: { id: true, indicator_parameter: true, data_series: { select: { unit: true, values: { select: { timestamp: true } } } } },
    });
    const goalsByIndicator = new Map(copiedGoals.map(goal => [goal.indicator_parameter, goal]));

    const picked = [...measures].sort(() => Math.random() - 0.5).slice(0, randomInt(3, 5));
    for (const measure of picked) {
      const author = randomOf(members);
      // Two same-headed SHORT rows on purpose: they collapse into a list in the UI
      const fields: { header: string, value: string, type?: ActionFieldType }[] = [
        { header: ActionFieldHeaders.Description, value: RandomTextSE.paragraph(randomInt(1, 2)) },
        ...measure.actors.map(actor => ({ header: "Relevanta aktörer", value: actor, type: ActionFieldType.SHORT })),
        ...(chance(0.5) ? [{ header: "Förväntat resultat", value: RandomTextSE.sentence(randomInt(4, 9)) }] : []),
      ];
      const action = await prisma.actions.create({
        data: {
          name: measure.name,
          indicator_parameter: measure.indicatorParameter,
          start_year: measure.years[0],
          end_year: measure.years[1],
          org: { connect: { id: org.id } },
          // The draft of the place without a copy has no goals to affect; its actions live in the org's action database
          ...(place.leapCopy && copy ? { roadmap_iteration: { connect: { id: copy.iteration.id } } } : {}),
          author: { connect: { id: author.id } },
          fields: { createMany: { data: fields.map((field, index) => ({ ...field, type: field.type ?? defaultActionFieldType(field.header), order: index })) } },
          ...getRandomCreatedAtAndUpdatedAt(),
        },
        select: { id: true },
      });

      const goal = goalsByIndicator.get(measure.indicatorParameter);
      if (!goal?.data_series) continue;
      const dateValues = effectSeries(measure, goal.data_series.values.map(record => record.timestamp));
      // Percentages are unitless; the other impact types are in the goal's unit
      const unit = measure.impact === ActionImpactType.PERCENT ? null : goal.data_series.unit;
      await prisma.effects.create({
        data: {
          action: { connect: { id: action.id } },
          goal: { connect: { id: goal.id } },
          impact_type: measure.impact,
          data_series: {
            create: {
              author: { connect: { id: author.id } },
              org: { connect: { id: org.id } },
              unit,
              values: { createMany: { data: dateValuesToDBDateRecord(dateValues) } },
              recipe_used: {
                create: {
                  recipe: Recipe.fromManualDateValues({ dateValues, unit: parseUnit(unit) }).serialize(),
                  org: { connect: { id: org.id } },
                },
              },
            },
          },
        },
      });
    }
  }
}

/** The effect ramping up over the measure's years and holding after, on the goal's own years */
function effectSeries(measure: Measure, timestamps: Date[]): DateValues {
  const [start, end] = measure.years;
  const dateValues: DateValues = {};
  for (const timestamp of timestamps) {
    const year = timestamp.getUTCFullYear();
    if (year < start) continue;
    const progress = Math.min(1, (year - start + 1) / (end - start + 1));
    const date = timestamp.toISOString();
    (dateValues as Record<string, number>)[date] = Math.round(measure.size * progress * 100) / 100;
  }
  return dateValues;
}
