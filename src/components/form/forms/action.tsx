"use client";

import { ActionFieldHeaders, actionFieldLabel, defaultActionFieldType, groupActionFields, parseCsvList } from "@/functions/actionFields";
import formSubmitter from "@/functions/formSubmitter";
import type { Action, ActionInput, DateValuesWithUnit, MultiRoadmapInstance } from "@/types";
import { ActionFormName } from "@/types/form-names";
import { isDateValuesWithUnit } from "@/types/typeguards";
import { ActionFieldType, ActionImpactType } from "@/lib/prisma/generated";
import { useTranslation } from "react-i18next";
import styles from '../forms.module.css';
import { FormSync, ManualDataSeriesInput, RecipeContextProvider } from "@/components/recipe";
import { Recipe } from "@/functions/recipe/recipe";
import TextSingleAutocomplete from "@/components/form/elements/combobox/textSingleAutocomplete";
import { clientSafeGetAllTags } from "@/fetchers/clientSafeGetAllTags";
import { clientSafeGetAllFieldHeaders } from "@/fetchers/clientSafeGetAllFieldHeaders";
import { Fragment, useEffect, useState } from "react";
import { useToast } from "@/components/generic/toast/toastContext.use";
import { useRouter } from "next/navigation";
import { UnitFlags } from "@/types/enums";

export default function ActionForm({
  goalId,
  iterationId,
  currentAction,
  roadmaps,
}: {
  goalId?: string,
  /** The roadmap iteration the action belongs to, if preselected */
  iterationId?: string,
  currentAction?: Action,
  roadmaps: MultiRoadmapInstance[],
}) {
  const { t } = useTranslation(["forms", "common"]);
  const [timestamp] = useState(() => Date.now());
  const router = useRouter();

  const { addToast } = useToast();

  // Free-form descriptive fields, replacing the old fixed columns. New actions are
  // seeded with the canonical machine-key headers (the same ones the migration used
  // for old data); the UI translates known keys for display.
  // Edited as groups (one header/type, any number of values), matching how same-header
  // fields render as one list; each value becomes its own ActionFields row on submit.
  const [fields, setFields] = useState<{ header: string, type: ActionFieldType, values: string[] }[]>(() =>
    currentAction
      ? groupActionFields(currentAction.fields.filter(field => field.header !== ActionFieldHeaders.Tag && field.header !== ActionFieldHeaders.Description))
      : [
        ActionFieldHeaders.CostEfficiency,
        ActionFieldHeaders.ExpectedOutcome,
        ActionFieldHeaders.RelevantActors,
      ].map(header => ({ header, type: defaultActionFieldType(header), values: [""] })),
  );

  // The description is stored as a DESCRIPTION-headed paragraph field but edited through
  // its own optional input; left blank, no field is saved at all
  const [description, setDescription] = useState<string>(() =>
    currentAction?.fields.filter(field => field.header === ActionFieldHeaders.Description).map(field => field.value).join("\n\n") ?? "",
  );

  // Tags are stored as TAG-headed fields but edited through their own input rather
  // than the free-form rows; they render as cards under the title on the view page
  const [tags, setTags] = useState<string[]>(() =>
    (currentAction?.fields.filter(field => field.header === ActionFieldHeaders.Tag).map(field => field.value) ?? []).sort((a, b) => a.localeCompare(b)),
  );
  const [tagDraft, setTagDraft] = useState("");
  // Chips toggle between kept and marked-for-deletion; marked tags are dropped at submit
  const [tagsMarkedForDeletion, setTagsMarkedForDeletion] = useState<string[]>([]);

  // Tags and field headers on other visible actions, offered as suggestions (free text is still allowed)
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [headerSuggestions, setHeaderSuggestions] = useState<string[]>([]);
  useEffect(() => {
    clientSafeGetAllTags().then(setTagSuggestions).catch(() => setTagSuggestions([]));
    clientSafeGetAllFieldHeaders().then(setHeaderSuggestions).catch(() => setHeaderSuggestions([]));
  }, []);

  function addTag() {
    const value = tagDraft.trim();
    setTagDraft("");
    if (!value) return;
    setTags(previous => previous.includes(value) ? previous : [...previous, value].sort((a, b) => a.localeCompare(b)));
    // Re-adding a tag marked for deletion revives it
    setTagsMarkedForDeletion(previous => previous.filter(existing => existing !== value));
  }

  function toggleTagDeletion(tag: string) {
    setTagsMarkedForDeletion(previous => previous.includes(tag) ? previous.filter(existing => existing !== tag) : [...previous, tag]);
  }

  function updateGroup(index: number, patch: Partial<{ header: string, type: ActionFieldType }>) {
    setFields(previous => previous.map((group, i) => {
      if (i !== index) return group;
      // A renamed group adopts its header's established type: another group already
      // using the header wins, else the header's canonical default.
      const type = patch.header !== undefined
        ? previous.find((other, o) => o !== index && other.header === patch.header)?.type ?? defaultActionFieldType(patch.header)
        : patch.type ?? group.type;
      return { ...group, ...patch, type };
    }));
  }

  function updateValue(groupIndex: number, valueIndex: number, value: string) {
    setFields(previous => previous.map((group, i) =>
      i === groupIndex
        ? { ...group, values: group.values.map((existing, v) => v === valueIndex ? value : existing) }
        : group,
    ));
  }

  function addValue(groupIndex: number) {
    setFields(previous => previous.map((group, i) => i === groupIndex ? { ...group, values: [...group.values, ""] } : group));
  }

  // Removing a group's last value removes the whole group
  function removeValue(groupIndex: number, valueIndex: number) {
    setFields(previous => previous
      .map((group, i) => i === groupIndex ? { ...group, values: group.values.filter((_, v) => v !== valueIndex) } : group)
      .filter(group => group.values.length > 0),
    );
  }

  function handleSubmit(event: React.ChangeEvent<HTMLFormElement>) {
    event.preventDefault();

    // TAG-headed fields are managed by the dedicated tags input
    if (fields.some(field => field.header.trim() === ActionFieldHeaders.Tag)) {
      addToast(t("forms:action.tag_header_forbidden"), "error");
      return;
    }

    // TODO: Use formData instead of DOM traversal
    const form = event.target.elements;

    let startYear: number | undefined = parseInt((form.namedItem(ActionFormName.StartYear) as HTMLInputElement).value, 10);
    let endYear: number | undefined = parseInt((form.namedItem(ActionFormName.EndYear) as HTMLInputElement).value, 10);

    if (!Number.isFinite(startYear)) {
      startYear = undefined;
    }
    if (!Number.isFinite(endYear)) {
      endYear = undefined;
    }

    let dataSeries: DateValuesWithUnit | undefined;
    try {
      const rawDataSeries = JSON.parse((form.namedItem(ActionFormName.ResultingDateValues) as HTMLInputElement)?.value) as unknown;
      if (rawDataSeries && isDateValuesWithUnit(rawDataSeries)) {
        dataSeries = rawDataSeries;
      }
    } catch {
      if (!goalId) {
        // If there is no goalId, no data series should be submitted.
        dataSeries = undefined;
      } else {
        event.target.reportValidity();
        addToast(t("common:errors.something_went_wrong"), "error");
        console.error("Failed to parse data series, invalid JSON or incorrect format.");
        return;
      }
    }

    const formContent: ActionInput = {
      actionId: currentAction ? currentAction.id : undefined,
      iterationId: iterationId ?? (form.namedItem(ActionFormName.RoadmapId) as HTMLInputElement)?.value ?? undefined,
      orgId: undefined, // Derived from the iteration's roadmap
      goalId: goalId ?? undefined,
      name: (form.namedItem(ActionFormName.ActionName) as HTMLInputElement)?.value ?? "",
      indicatorParameter: currentAction?.indicator_parameter ?? undefined, // Falls back to the name server-side
      startYear,
      endYear,
      // Empty rows carry no data; drop them rather than storing blank fields.
      fields: [
        ...(description.trim() !== ""
          ? [{ header: ActionFieldHeaders.Description as string, value: description.trim(), type: ActionFieldType.PARAGRAPH }]
          : []),
        ...fields
          .filter(group => group.header.trim() !== "")
          .flatMap(group => group.values
            .filter(value => value.trim() !== "")
            .map(value => ({ header: group.header, value, type: group.type })),
          ),
        ...tags
          .filter(tag => !tagsMarkedForDeletion.includes(tag))
          .map(value => ({ header: ActionFieldHeaders.Tag as string, value, type: defaultActionFieldType(ActionFieldHeaders.Tag) })),
      ],
      parentActionId: currentAction?.parent_action_id ?? undefined,
      dataSeries,
      impactType: goalId && !currentAction
        ? (form.namedItem(ActionFormName.ImpactType) as HTMLInputElement)?.value as ActionImpactType
        : undefined,
      timestamp,
    };

    const formJSON = JSON.stringify(formContent);

    formSubmitter('/api/action', formJSON, currentAction ? 'PUT' : 'POST', t, undefined, undefined, undefined, undefined, addToast, (url) => router.push(url));
  }

  // Indexes for the data-position attribute in the legend elements
  let positionIndex = 1;

  return (
    <form onSubmit={handleSubmit}>
      {/* This hidden submit button prevents submitting by pressing enter, to avoid accidental submission */}
      <button type="submit" disabled={true} className="display-none" aria-hidden={true} />

      {!(iterationId || currentAction?.roadmap_iteration_id) ?
        <fieldset className={`${styles.timeLineFieldset} width-100`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} font-weight-bold padding-block-125`}>{t("forms:action.choose_relationship")}</legend>
          <label>
            {t("forms:action.relationship_label")}
            <select name={ActionFormName.RoadmapId} id="iterationId" required={true} className="block margin-top-25 margin-bottom-100 width-100" defaultValue={""}>
              <option value="" disabled={true}>{t("forms:action.relationship_no_chosen")}</option>
              {roadmaps.map(iteration => (
                <option key={iteration.id} value={iteration.id}>
                  {`${iteration.roadmap.name} (v${iteration.version}): ${t("common:count.action", { count: iteration._count.actions })}`}
                </option>
              ))}
            </select>
          </label>
        </fieldset>
        : null
      }

      <fieldset className={`${styles.timeLineFieldset} width-100 ${positionIndex > 1 ? "margin-top-200" : ""}`}>
        <legend data-position={positionIndex++} className={`${styles.timeLineLegend} font-weight-bold padding-block-125`}>{t("forms:action.action_description_legend")}</legend>
        <label>
          {t("forms:action.action_name")}
          <input className="margin-top-25 margin-bottom-100" type="text" name={ActionFormName.ActionName} required={true} id="actionName" defaultValue={currentAction?.name} />
        </label>

        <label>
          {t("forms:action.action_description")}
          <textarea
            className="margin-top-25 margin-bottom-100"
            id="action-description"
            data-testid="action-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>

        {/* The chips live outside the label: a label's implicit control is its first
            form control, which would hijack hover and clicks meant for the other chips' delete buttons */}
        <div className="margin-bottom-100">
          <label htmlFor="action-tag-input">
            {t("forms:action.tags_label")}
          </label>
          {/* Enter adds the draft as a tag, unless a suggestion is highlighted
              (aria-activedescendant marks that state) — then it accepts the suggestion
              into the input first, and a second Enter adds it */}
          <div
            onKeyDownCapture={(event) => {
              if (event.key !== "Enter") return;
              if (!(event.target instanceof HTMLInputElement)) return;
              if (event.target.getAttribute("aria-activedescendant")) return;
              event.preventDefault();
              event.stopPropagation();
              addTag();
            }}
          >
            <TextSingleAutocomplete
              props={{
                id: "action-tag-input",
                name: "action-tag-input",
                placeholder: t("forms:combobox.default_autocomplete_placeholder"),
                className: "margin-top-25",
              }}
              options={tagSuggestions.filter(tag => !tags.includes(tag)).map(tag => ({ name: tag, value: tag }))}
              fuseOptions={{
                threshold: 0.3,
                ignoreLocation: true,
              }}
              value={tagDraft}
              setter={setTagDraft}
            />
          </div>
          <button type="button" className="margin-top-25" onClick={addTag}>
            {t("forms:action.add_tag")}
          </button>
          {tags.length > 0 &&
            <ul className="flex gap-25 margin-top-50 margin-bottom-0 padding-0" style={{ listStyle: 'none', flexWrap: 'wrap' }}>
              {tags.map(tag => {
                const marked = tagsMarkedForDeletion.includes(tag);
                return (
                  <li
                    key={tag}
                    className={`smooth padding-inline-50 padding-block-25 flex gap-25 align-items-center ${marked ? styles.chipMarkedForDeletion : ''}`}
                    style={{ backgroundColor: 'var(--seagreen-90)', border: '1px solid var(--seagreen-80)', color: 'var(--seagreen-30)' }}
                  >
                    {tag}
                    <button
                      type="button"
                      aria-label={`${marked ? t("forms:action.restore_tag") : t("common:tsx.delete")}: ${tag}`}
                      aria-pressed={marked}
                      className="padding-0 transparent"
                      // Fixed-size box so swapping the ×/↺ glyphs doesn't resize the chip
                      style={{ lineHeight: 1, fontSize: '1.25em', width: '1em', height: '1em', display: 'inline-grid', placeItems: 'center' }}
                      onClick={() => toggleTagDeletion(tag)}
                    >
                      {marked ? '↺' : '×'}
                    </button>
                  </li>
                );
              })}
            </ul>
          }
        </div>
      </fieldset>

      <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
        <legend
          data-position={positionIndex++}
          className={`${styles.timeLineLegend} padding-block-125 font-weight-bold`}
        >
          {t("forms:action.action_years_legend")}
        </legend>
        <label>
          {t("forms:action.start_year")}
          <input className="margin-top-25 margin-bottom-100" type="number" name={ActionFormName.StartYear} id="startYear" defaultValue={currentAction?.start_year ?? undefined} min={2000} />
        </label>

        <label>
          {t("forms:action.end_year")}
          <input className="margin-top-25 margin-bottom-100" type="number" name={ActionFormName.EndYear} id="endYear" defaultValue={currentAction?.end_year ?? undefined} min={2000} />
        </label>
      </fieldset>

      {/* Repeatable free-form fields, replacing the old fixed inputs
          (description, cost efficiency, expected outcome, project manager, relevant actors...) */}
      <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
        <legend data-position={positionIndex++} className={`${styles.timeLineLegend} font-weight-bold padding-block-125`}>{t("forms:action.custom_fields_legend")}</legend>

        {fields.map((group, index) =>
          <details key={index} className="margin-bottom-100 cursor-pointer">
            <summary>
              {group.header ? group.header : t("forms:action.field_header")} ({group.type.toLocaleLowerCase()}) {/* TODO: Actually pass the locale, TODO: Title needs to make sense, TODO: group needs to be localized (i.e paragraph -> stycke)*/} 
              <button
                type="button"
                onClick={() => removeValue(index, 0)}
              >
                {t("common:tsx.delete")}
              </button>
            </summary>
            <label htmlFor={`action-field-header-${index}`}>{t("forms:action.field_header")}</label>
            <TextSingleAutocomplete
              props={{
                id: `action-field-header-${index}`,
                name: `action-field-header-${index}`,
                className: "margin-bottom-100 margin-top-25",
                ariaLabel: t("forms:action.field_header"),
                dataTestid: "action-field-header",
              }}
              options={headerSuggestions.map(header => ({ name: header, value: header }))}
              fuseOptions={{
                threshold: 0.3,
                ignoreLocation: true,
              }}
              value={group.header}
              setter={(action) => {
                const header = typeof action === "function" ? action(group.header) : action;
                updateGroup(index, { header });
              }}
            />

            <fieldset>
              <legend>{t("forms:action.field_type_label")}</legend>
              <select
                className="width-100 margin-bottom-100 margin-top-25"
                aria-label={t("forms:action.field_type_label")}
                data-testid="action-field-type"
                value={group.type}
                onChange={(event) => updateGroup(index, { type: event.target.value as ActionFieldType })}
              >
                <option value={ActionFieldType.PARAGRAPH}>{t("forms:action.field_types.paragraph")}</option>
                <option value={ActionFieldType.SHORT}>{t("forms:action.field_types.short")}</option>
                <option value={ActionFieldType.DATE}>{t("forms:action.field_types.date")}</option>
              </select>
            </fieldset>

            <fieldset>
              <legend>{t("forms:action.field_content")}</legend>
              {(() => {
                const contentLabel = actionFieldLabel(group.header, t) === group.header
                  ? t("forms:action.field_content")
                  : actionFieldLabel(group.header, t);

                const valueControl = (valueIndex: number) =>
                  group.type === ActionFieldType.PARAGRAPH ? (
                    <textarea
                      rows={2}
                      aria-label={contentLabel}
                      data-testid="action-field-value"
                      value={group.values[valueIndex]}
                      onChange={(event) => updateValue(index, valueIndex, event.target.value)}
                    />
                  ) : (
                    <input
                      type={group.type === ActionFieldType.DATE ? "date" : "text"}
                      aria-label={contentLabel}
                      data-testid="action-field-value"
                      value={group.values[valueIndex]}
                      onChange={(event) => updateValue(index, valueIndex, event.target.value)}
                      onPaste={group.type === ActionFieldType.SHORT ? (event) => {
                        const items = parseCsvList(event.clipboardData.getData("text"));
                        if (items.length < 2) return;
                        event.preventDefault();
                        setFields(previous => previous.map((g, i) =>
                          i === index
                            ? { ...g, values: [...g.values.slice(0, valueIndex), ...items, ...g.values.slice(valueIndex + 1)] }
                            : g,
                        ));
                      } : undefined}
                    />
                  );

                return (
                  <>
                    {valueControl(0)}
                    { /* Additional list values render underneath, sharing the group's heading and type */}
                    {group.values.slice(1).map((_, restIndex) => (
                      <div className="flex gap-25 align-items-center margin-block-50" key={restIndex + 1}>
                        {valueControl(restIndex + 1)}
                        <button
                          type="button"
                          onClick={() => removeValue(index, restIndex + 1)}
                        >
                          {t("common:tsx.delete")}
                        </button>
                      </div>
                    ))}

                    {/* Short texts and dates may hold several values; they render as a list */}
                    {group.type !== ActionFieldType.PARAGRAPH &&
                      <button
                        type="button"
                        style={{ justifySelf: 'start' }}
                        onClick={() => addValue(index)}
                      >
                        {t("forms:action.add_list_item")}
                      </button>
                    }
                  </>
                );
              })()}
            </fieldset>
          </details>,
        )}
        <button
          type="button"
          className="margin-top-100"
          onClick={() => setFields(previous => [...previous, { header: "", type: defaultActionFieldType(""), values: [""] }])}
        >
          {t("forms:data_series_input.add_new_row")}
        </button>
      </fieldset>


      {(goalId && !currentAction) ?
        // TODO: Allow conversion between absolute and delta like in effectForm?
        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend
            // Technically incrementing here is unused but if you add a another entry after this one it will be correct
            // eslint-disable-next-line no-useless-assignment
            data-position={positionIndex++}
            className={`${styles.timeLineLegend} padding-block-125 font-weight-bold`}>
            {t("forms:action.expected_effect_legend")}
          </legend>
          <label>
            {t("forms:action.impact_type_label")}
            <select name={ActionFormName.ImpactType} id="impactType" className="block margin-top-25 margin-bottom-100 width-100" /* defaultValue={actionImpactType} onChange={e => setActionImpactType(e.target.value as ActionImpactType)} */ >
              <option value={ActionImpactType.ABSOLUTE}>{t("forms:action.impact_types.absolute")}</option>
              <option value={ActionImpactType.DELTA}>{t("forms:action.impact_types.delta")}</option>
              <option value={ActionImpactType.PERCENT}>{t("forms:action.impact_types.percent")}</option>
            </select>
          </label>

          <RecipeContextProvider
            initialRecipe={Recipe.fromManualDateValues({ unit: UnitFlags.Missing, dateValues: {} }).serialize()}
          >
            <ManualDataSeriesInput
              id="action-dataseries"
              label={t("forms:data_series_input.data_series")}
            />
            <FormSync DateValuesFormElement={<input name={ActionFormName.ResultingDateValues} />} />
          </RecipeContextProvider>
        </fieldset>
        : null
      }

      <div className="margin-top-400 padding-top-100 margin-bottom-100" style={{ borderTop: '1px solid var(--gray-80)' }}>
        <button
          className="text-align-center seagreen color-purewhite width-100"
          style={{ fontSize: '14px', transform: 'none' }}
          type="submit"
          id="submit-button"
        >
          {currentAction ? t("common:tsx.save") : t("forms:action.create")}
        </button>
      </div>
    </form>
  );
}
