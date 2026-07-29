'use client';

import formSubmitter from "@/functions/formSubmitter";
import parseCsv, { csvToGoalList } from "@/functions/parseCsv";
import type { GoalCreateFull, Roadmap, RoadmapIteration, RoadmapIterationCreateInput, RoadmapIterationUpdateInput } from "@/types";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from '../forms.module.css';
import type { TFunction } from "i18next";
import { Trans, useTranslation } from "react-i18next";
import SelectSingleSearch from "../elements/combobox/selectSingleSearch";
import TextEditor from "../elements/textEditor/editor";
import { IconUpload } from "@tabler/icons-react";
import { useToast } from "@/components/generic/toast/toastContext.use";
import { useRouter } from "next/navigation";

function checkForBadDecoding(csv: string[][], t: TFunction, addToast: (text: string, type: 'success' | 'error' | 'warning') => void) {
  if (csv.some((row) => row.some((cell) => cell.includes("�")))) {
    addToast(t("forms:roadmap.bad_decoding"), "warning");
  }
}

// TODO: Still need to clean this up a bit
export default function RoadmapIterationForm({
  roadmapAlternatives,
  currentIteration,
  defaultRoadmapId,
}: {
  /** Roadmaps the user can create iterations under */
  roadmapAlternatives?: (Pick<Roadmap, "id" | "name" | "parent_roadmap_id"> & {
    iterations: { id: string, version: number }[],
  })[],
  currentIteration?: RoadmapIteration,
  defaultRoadmapId?: string,
}) {
  const { t } = useTranslation(["forms", "common"]);
  const descriptionRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const { addToast } = useToast();

  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [timestamp] = useState<number>(() => Date.now());
  const [roadmapId, setRoadmapId] = useState<string>(currentIteration?.roadmap_id || defaultRoadmapId || "");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [targetVersion, setTargetVersion] = useState<number | null>(0);
  const roadmapTarget = useMemo(() => {
    // The roadmap that the parent roadmap works towards, if any
    return roadmapAlternatives?.find((parentRoadmap) => parentRoadmap.id === roadmapAlternatives?.find((roadmap) => roadmap.id === roadmapId)?.parent_roadmap_id);
  }, [roadmapId, roadmapAlternatives]);

  // Validate file when it changes
  useEffect(() => {
    if (!currentFile) return;
    if (currentFile) {
      setIsLoading(true);
      try {
        currentFile.arrayBuffer()
          .then((buffer) => parseCsv(buffer))
          .then((csv) => {
            checkForBadDecoding(csv, t, addToast);
            return csvToGoalList(csv, () => addToast(t("forms:roadmap.scale_deprecated_extended"), "warning"));
          })
          .then(() => setIsLoading(false))
          .catch((err: unknown) => {
            throw new Error(t("forms:roadmap.file_read_error", { error: err instanceof Error ? err.message || t("forms:roadmap.unknown_error") : t("forms:roadmap.unknown_error") }));
          });
      }
      catch (err) {
        addToast(t("forms:roadmap.file_read_error", { error: err instanceof Error ? err.message || t("forms:roadmap.unknown_error") : t("forms:roadmap.unknown_error") }), "error");
        setIsLoading(false);
        return;
      }
    }
  }, [addToast, currentFile, t]);

  async function handleSubmit(event: React.ChangeEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!roadmapId && !currentIteration) { return; }

    setIsLoading(true);

    const form = event.target.elements;
    const description = (form.namedItem("description") as HTMLInputElement | null)?.value ?? null;
    const publish = (form.namedItem("publish") as HTMLInputElement | null)?.checked ?? false;

    let goals: GoalCreateFull[] = [];
    if (currentFile) {
      try {
        goals = csvToGoalList(parseCsv(await currentFile.arrayBuffer().then((buffer) => { return buffer; })), () => addToast(t("forms:roadmap.scale_deprecated"), "warning"));
      }
      catch (err) {
        setIsLoading(false);
        addToast(t("forms:roadmap.roadmap_version_creation_error", { error: err instanceof Error ? err.message || t("forms:roadmap.unknown_error") : t("forms:roadmap.unknown_error") }), "error");
        return;
      }
    }

    let formData: RoadmapIterationCreateInput | RoadmapIterationUpdateInput;
    if (currentIteration) {
      // Updating existing iteration
      formData = {
        iterationId: currentIteration.id,
        timestamp: timestamp,

        description: description ?? undefined,
        targetVersion: parseInt((form.namedItem('target-version') as HTMLSelectElement)?.value, 10) || null,
        publish: publish,

        roadmapId: undefined, // Can't change the roadmap after creation
        goals: goals,
      } satisfies RoadmapIterationUpdateInput;
    } else {
      // Creating new iteration
      formData = {
        iterationId: undefined,
        timestamp: undefined,

        description: description ?? null,
        targetVersion: parseInt((form.namedItem('target-version') as HTMLSelectElement)?.value, 10) || null,
        publish: publish,

        roadmapId: roadmapId,
        goals: goals,
      } satisfies RoadmapIterationCreateInput;
    }

    const formJSON = JSON.stringify(formData);

    formSubmitter('/api/roadmapIteration', formJSON, currentIteration ? 'PUT' : 'POST', t, setIsLoading, undefined, undefined, undefined, addToast, (url) => router.push(url));
  }

  // Indexes for the data-position attribute in the legend elements
  let positionIndex = 1;

  const roadmapOptions = useMemo(() => {
    return (roadmapAlternatives ?? []).map(roadmap => ({
      name: roadmap.name,
      value: roadmap.id,
    }));
  }, [roadmapAlternatives]);

  return (
    <form onSubmit={(e: React.ChangeEvent<HTMLFormElement>) => {
      e.preventDefault();
      void handleSubmit(e);
    }}>
      {/* This hidden submit button prevents submitting by pressing enter, this avoids accidental submission in text inputs */}
      <input type="submit" disabled={true} className="display-none" aria-hidden={true} />

      {(!(currentIteration?.roadmap_id || defaultRoadmapId) || roadmapTarget?.iterations.length) ?

        <fieldset className={`${styles.timeLineFieldset} width-100`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} font-weight-bold padding-block-125`}>{t("forms:roadmap.relationship_legend")}</legend>
          {/* Allow user to select parent roadmap if not already selected */}
          {!(currentIteration?.roadmap_id || defaultRoadmapId) ?
            <>
              <label id="parent-roadmap-label" htmlFor="parent-roadmap">{t("forms:roadmap.relationship_label")}</label> {/* TODO: Not capitalized properly due to issues in english translation */}
              <SelectSingleSearch
                props={{
                  required: true,
                  className: "margin-top-25 margin-bottom-100",
                  id: "parent-roadmap",
                  name: "parent-roadmap",
                  placeholder: `${t("common:tsx.select")}  ${t("common:roadmap_series_one")}`,
                }}
                onChange={(value) => value?.value ? setRoadmapId(value.value) : setRoadmapId("")}
                options={roadmapOptions}
              />

            </>
            : null
          }

          {roadmapTarget?.iterations.length ? <label>
            {t("forms:roadmap.roadmap_target_label", { targetName: roadmapTarget.name })}
            <select className="block margin-top-25 margin-bottom-100 width-100" name="target-version" id="target-version" required={true} defaultValue={currentIteration?.target_version ?? ""} onChange={(e) => setTargetVersion(parseInt(e.target.value, 10) || null)}>
              <option value="">{t("forms:roadmap.roadmap_target_no_chosen")}</option>
              <option value={0}>{t("forms:roadmap.roadmap_target_always_latest")}</option>
              {roadmapTarget.iterations.map((iteration) => {
                return (
                  <option key={iteration.version} value={iteration.version}>{`Version ${iteration.version}`}</option>
                );
              })}
            </select>
          </label> : null}
        </fieldset>
        : null
      }

      <fieldset className={`${styles.timeLineFieldset} width-100 ${positionIndex > 1 ? "margin-top-200" : ""}`}>
        <legend data-position={positionIndex++} className={`${styles.timeLineLegend} font-weight-bold padding-block-125`}>{t("forms:roadmap.roadmap_version_legend")}</legend>
        <label id="description-label">{t("forms:roadmap.roadmap_description")}</label>
        <TextEditor
          className="margin-top-25 margin-bottom-100" // TODO: Need label for texteditormenu
          id="description"
          ariaLabelledBy="description-label"
          placeholder={t("forms:text_editor_menu.default_placeholder")}
          editable={true}
          content={currentIteration ? currentIteration.description : ""}
          updater={(json) => descriptionRef.current ? descriptionRef.current.value = JSON.stringify(json) : null}
        />
        <input ref={descriptionRef} type="hidden" name="description" />

        {/* Drafts (unpublished iterations) are only visible to people who can edit the roadmap */}
        <label className="flex width-fit-content align-items-center gap-50 margin-bottom-100">
          <input
            type="checkbox"
            name="publish"
            id="publish"
            defaultChecked={!!currentIteration?.published_at}
          />
          {t("forms:roadmap.publish")}
        </label>
        <small className="block margin-bottom-100">{t("forms:roadmap.publish_hint")}</small>

      </fieldset>

      <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
        <legend
          // Technically incrementing here is unused but if you add a another entry after this one it will be correct
          // eslint-disable-next-line no-useless-assignment
          data-position={positionIndex++}
          className={`${styles.timeLineLegend} font-weight-bold padding-block-125`}
        >{t("forms:roadmap.upload_goals")}</legend>
        <label>
          <Trans
            i18nKey={"forms:roadmap.goal_accepted_formats"}
            tOptions={{ fileTypes: [".csv"], encodings: ["UTF-8"], type: "unit" }}
            components={{ small: <small /> }}
          />
          <div className="focusable flex width-fit-content align-items-center gap-50 margin-top-25 margin-bottom-100">
            <div className="gray-90 padding-block-50 padding-inline-75" style={{ borderRadius: '.25rem 0 0 .25rem' }}>
              <IconUpload width={20} height={20} aria-hidden={true} className="grid" />
            </div>
            <input
              type="file"
              name="csv-upload"
              id="csv-upload"
              accept=".csv"
              onChange={(e) => e.target.files ? setCurrentFile(e.target.files[0]) : setCurrentFile(null)}
            />
          </div>
        </label>
      </fieldset>

      {/* Access control lives on the parent roadmap; sharing is edited in the roadmap form */}

      <div className="margin-top-400 padding-top-100 margin-bottom-100" style={{ borderTop: '1px solid var(--gray-80)' }}>
        <button
          className="text-align-center seagreen color-purewhite width-100"
          style={{ fontSize: '14px', transform: 'none' }}
          type="submit"
          id="submit-button"
          disabled={isLoading}
        >
          {currentIteration ? t("common:tsx.save") : t("forms:roadmap.create")}
        </button>
      </div>
    </form >
  );
}
