'use client';

import type getOneMetaRoadmap from "@/fetchers/getOneMetaRoadmap";
import { useContext, useRef } from "react";
import ConfirmDelete from "../modals/confirmDelete";
import { openModal } from "../modals/modalFunctions";
import { createDict } from "./buttons.dict.ts";
import { LocaleContext } from "@/app/context/localeContext.tsx";

export default function MetaRoadmapDeleter({ metaRoadmap }: { metaRoadmap: NonNullable<Awaited<ReturnType<typeof getOneMetaRoadmap>>> }) {
  const locale = useContext(LocaleContext);
  const dict = createDict(locale).metaRoadmapDeleter;

  const deletionRef = useRef<HTMLDialogElement | null>(null);
  return (
    <>
      <button type="button" className="red color-purewhite" onClick={() => openModal(deletionRef)}>{dict.removeMetadata}</button>
      <ConfirmDelete modalRef={deletionRef} targetUrl={`/api/metaRoadmap`} targetName={metaRoadmap.name} targetId={metaRoadmap.id} />
    </>
  )
}