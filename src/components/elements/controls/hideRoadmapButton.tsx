'use client';

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { IconEye, IconEyeOff, IconX } from "@tabler/icons-react";
import { closeModal, openModal } from "@/components/modals/modalFunctions";
import modalStyles from "@/components/modals/modals.module.css";
import { useToast } from "@/components/generic/toast/toastContext.use";
import formSubmitter from "@/functions/formSubmitter";
import type { RoadmapUpdateInput } from "@/types";

/**
 * "Hide roadmap" / "Show roadmap" with a confirmation dialog. Hiding leaves the
 * roadmap out of listings and pickers; links, access and recipes reading its
 * goals keep working. Manager-only, like sharing (the API enforces it).
 */
export default function HideRoadmapButton({
  roadmapId,
  roadmapName,
  hidden,
  className,
  style,
  iconSize = 24,
}: {
  roadmapId: string,
  roadmapName: string,
  hidden: boolean,
  className?: string,
  style?: React.CSSProperties,
  iconSize?: number,
}) {
  const { t } = useTranslation(["components", "common"]);
  const router = useRouter();
  const { addToast } = useToast();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  function submit() {
    setIsLoading(true);
    formSubmitter('/api/roadmap', JSON.stringify({
      id: roadmapId,
      hidden: !hidden,
      // One flag, no edited content to go stale, so the click itself is the reference point
      timestamp: Date.now(),
      name: undefined,
      description: undefined,
      type: undefined,
      actor: undefined,
      geoAreaCode: undefined,
      access: undefined,
      parentRoadmapId: undefined,
    } satisfies RoadmapUpdateInput), 'PUT', t, setIsLoading, undefined, () => {
      setIsLoading(false);
      closeModal(dialogRef);
      addToast(hidden ? t("components:hide_roadmap.shown_toast", { name: roadmapName }) : t("components:hide_roadmap.hidden_toast", { name: roadmapName }), "success");
      router.refresh();
    }, undefined, addToast);
  }

  const Icon = hidden ? IconEye : IconEyeOff;

  return (
    <>
      <button
        type="button"
        className={className}
        style={style}
        data-testid={hidden ? "show-roadmap" : "hide-roadmap"}
        onClick={() => openModal(dialogRef)}
      >
        <span>{hidden ? t("components:hide_roadmap.show") : t("components:hide_roadmap.hide")}</span>
        <Icon aria-hidden="true" width={iconSize} height={iconSize} style={{ minWidth: `${iconSize}px` }} />
      </button>

      <dialog
        closedby="any"
        ref={dialogRef}
        aria-modal={true}
        className={`rounded padding-inline-0 padding-block-0 ${modalStyles['dialog']}`}
        style={{ width: 'min(60ch, 100%)', fontSize: 'initial' }}
      >
        <div className={modalStyles['dialog-content']}>
          <div className={modalStyles['dialog-header']}>
            <button type="button" className="grid round padding-50 transparent" disabled={isLoading} onClick={() => closeModal(dialogRef)} autoFocus={true} aria-label={t("common:tsx.close")}>
              <IconX aria-hidden="true" width={28} height={28} strokeWidth={3} style={{ minWidth: '28px' }} />
            </button>
            <h2 className="margin-0">{hidden ? t("components:hide_roadmap.show_title") : t("components:hide_roadmap.hide_title")}</h2>
          </div>
          <div className="padding-100 flex flex-direction-column gap-100">
            <p className="margin-0">
              {hidden ? t("components:hide_roadmap.show_confirm", { name: roadmapName }) : t("components:hide_roadmap.hide_confirm", { name: roadmapName })}
            </p>
            <div className="flex gap-25">
              <button type="button" className="font-weight-500 flex-grow-100" disabled={isLoading} onClick={() => closeModal(dialogRef)}>{t("common:tsx.cancel")}</button>
              <button type="button" className="color-purewhite seagreen font-weight-500" data-testid="hide-roadmap-confirm" disabled={isLoading} onClick={submit}>
                {hidden ? t("components:hide_roadmap.show") : t("components:hide_roadmap.hide")}
              </button>
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
}
