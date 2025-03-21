'use client';

import type getOneMetaRoadmap from "@/fetchers/getOneMetaRoadmap";
import { useRef } from "react";
import ConfirmDelete from "../modals/confirmDelete";
import { openModal } from "../modals/modalFunctions";
import { useTranslation } from "react-i18next";

export default function MetaRoadmapDeleter({ metaRoadmap }: { metaRoadmap: NonNullable<Awaited<ReturnType<typeof getOneMetaRoadmap>>> }) {
  const { t } = useTranslation();
  const deletionRef = useRef<HTMLDialogElement | null>(null);
  return (
    <>
      <button type="button" className="red color-purewhite" onClick={() => openModal(deletionRef)}>{t("components:meta_roadmap_one_deleter.remove_metadata")}</button>
      <ConfirmDelete modalRef={deletionRef} targetUrl={`/api/metaRoadmap`} targetName={metaRoadmap.name} targetId={metaRoadmap.id} />
    </>
  )
}