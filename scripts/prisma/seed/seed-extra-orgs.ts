// Light content for the extra orgs created in seed-users, so their landing
// pages and the roadmap form have something to show: each org gets one roadmap
// with a published iteration, a couple of goals with manual series, and a few
// actions with typed fields (including a repeated SHORT header to exercise the
// structural list collapse). The first extra org's roadmap is public so the
// public view gets some cross-org variety; the rest stay org-readable only.

import { prisma } from "@/lib/prisma";
import { RoadmapType } from "@/lib/prisma/generated";
import { ActionFieldHeaders, defaultActionFieldType } from "@/functions/fields";
import type { SeededUsers } from "./helpers.ts";
import {
  RandomTextSE,
  createManualSeries,
  getRandomCoherentDateValues,
  getRandomCreatedAtAndUpdatedAt,
  getRandomDateInThePast,
  getRandomUnit,
  randomIndicatorParameter,
  randomInt,
  randomOf,
} from "./helpers.ts";

export async function seedExtraOrgs(users: SeededUsers): Promise<void> {
  const { extraOrgs } = users;

  for (const [index, { org, members }] of extraOrgs.entries()) {
    const roadmap = await prisma.roadmaps.create({
      data: {
        name: RandomTextSE.sentence(randomInt(2, 3), 1).replace(/\.$/, ""),
        description: RandomTextSE.paragraph(1),
        actor: org.name,
        type: RoadmapType.ORGANIZATIONAL,
        author: { connect: { id: randomOf(members).id } },
        access_control: {
          create: { org: { connect: { id: org.id } }, is_public: index === 0, org_readable: true },
        },
        ...getRandomCreatedAtAndUpdatedAt(),
      },
    });

    const iteration = await prisma.roadmapIterations.create({
      data: {
        version: 1,
        author: { connect: { id: randomOf(members).id } },
        roadmap: { connect: { id: roadmap.id } },
        description: RandomTextSE.sentence(randomInt(4, 8)),
        published_at: getRandomDateInThePast(),
        ...getRandomCreatedAtAndUpdatedAt(),
      },
    });

    for (let i = 0; i < 2; i++) {
      const series = await createManualSeries(randomOf(members).id, org.id, getRandomCoherentDateValues(), getRandomUnit());
      await prisma.goals.create({
        data: {
          name: RandomTextSE.sentence(3, 1),
          description: RandomTextSE.paragraph(1),
          indicator_parameter: randomIndicatorParameter(),
          author: { connect: { id: randomOf(members).id } },
          roadmap_iteration: { connect: { id: iteration.id } },
          data_series: { connect: { id: series.id } },
          ...getRandomCreatedAtAndUpdatedAt(),
        },
      });
    }

    for (let i = 0; i < 2; i++) {
      const startYear = randomInt(2020, 2030);
      // Two RELEVANT_ACTORS rows on purpose: they collapse into a list in the UI
      const fields: { header: string, value: string }[] = [
        { header: ActionFieldHeaders.Description, value: RandomTextSE.paragraph(1) },
        { header: ActionFieldHeaders.RelevantActors, value: RandomTextSE.words(randomInt(1, 2)) },
        { header: ActionFieldHeaders.RelevantActors, value: RandomTextSE.words(randomInt(1, 2)) },
      ];
      await prisma.actions.create({
        data: {
          name: RandomTextSE.sentence(3, 1).replace(/\.$/, ""),
          indicator_parameter: randomIndicatorParameter(),
          start_year: startYear,
          end_year: startYear + randomInt(1, 20),
          org: { connect: { id: org.id } },
          roadmap_iteration: { connect: { id: iteration.id } },
          author: { connect: { id: randomOf(members).id } },
          fields: { createMany: { data: fields.map((field, index) => ({ ...field, type: defaultActionFieldType(field.header), order: index })) } },
          ...getRandomCreatedAtAndUpdatedAt(),
        },
      });
    }
  }
}
