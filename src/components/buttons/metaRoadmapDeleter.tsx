'use client';

import type getOneMetaRoadmap from "@/fetchers/getOneMetaRoadmap";
import { useRef } from "react";
import ConfirmDelete from "../modals/confirmDelete";
import { openModal } from "../modals/modalFunctions";
import dict from "./metaRoadmapDeleter.dict.json" assert { type: "json" };
import { useClientLocale, validateDict } from "@/functions/clientLocale";

export default function MetaRoadmapDeleter({ metaRoadmap }: { metaRoadmap: NonNullable<Awaited<ReturnType<typeof getOneMetaRoadmap>>> }) {
  validateDict(dict);
  const locale = useClientLocale();

  const deletionRef = useRef<HTMLDialogElement | null>(null);
  return (
    <>
      <button type="button" className="red color-purewhite" onClick={() => openModal(deletionRef)}>{dict.removeMetadata[locale]}</button>
      <ConfirmDelete modalRef={deletionRef} targetUrl={`/api/metaRoadmap`} targetName={metaRoadmap.name} targetId={metaRoadmap.id} />
    </>
  )
}