'use client';

import type { getOneRoadmap } from "@/fetchers";
import { useRef } from "react";
import ConfirmDelete from "../modals/confirmDelete";
import { openModal } from "../modals/modalFunctions";
import { useTranslation } from "react-i18next";

export default function RoadmapDeleter({ roadmap }: { roadmap: NonNullable<Awaited<ReturnType<typeof getOneRoadmap>>> }) {
  const { t } = useTranslation("components");
  const deletionRef = useRef<HTMLDialogElement | null>(null);
  return (
    <>
      <button type="button" className="red color-purewhite" onClick={() => openModal(deletionRef)}>{t("components:roadmap_series_one_deleter.remove_metadata")}</button>
      <ConfirmDelete modalRef={deletionRef} targetUrl={`/api/roadmap`} targetName={roadmap.name} targetId={roadmap.id} />
    </>
  );
}
