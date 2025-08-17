"use client";

import { Roadmap } from "@prisma/client";
/**
 * This file exists because this component needs to be client side, it previously lived in [roadmapId]/edit/page.tsx
  */

import Link from "next/link";
import { Trans } from "react-i18next";

export function ScopeReminder(roadmap: { roadmap: Roadmap }) {
  return (
    <p className="margin-block-300">
      <Trans
        i18nKey={"pages:roadmap_edit.are_you_in_the_right_place"}
        components={{ Link: <Link href={`/metaRoadmap/${roadmap.roadmap.metaRoadmapId}/edit`} /> }}
      />
    </p>
  );
}