'use client';

import areaCodes from "@/lib/areaCodes.json" with { type: "json" };
import countiesAndMunicipalities from "@/lib/countiesAndMunicipalities.json" with { type: "json" };
import type { AccessControlInput, Roadmap, RoadmapCreateInput, RoadmapUpdateInput } from "@/types";
import type { OrgOption } from "@/fetchers/getOrgOptions";
import { OrgRole, RoadmapType } from "@/lib/prisma/generated";
import { useRef, useState } from "react";
import formSubmitter from "@/functions/formSubmitter";
import { areaSorter } from "@/lib/sorters";
import styles from '../forms.module.css';
import { useTranslation } from "react-i18next";
import TextEditor from "@/components/form/elements/textEditor/editor";
import SelectSingleSearch from "../elements/combobox/selectSingleSearch";
import TextSingleAutocomplete from "../elements/combobox/textSingleAutocomplete";
import ConfigureAccess from "../sections/access";
import { useToast } from "@/components/generic/toast/toastContext.use";
import { useRouter } from "next/navigation";

export default function RoadmapForm({
  isSuperAdmin,
  orgOptions,
  parentRoadmapOptions,
  currentRoadmap,
}: {
  isSuperAdmin?: boolean,
  /** Orgs the user can create in / manage, with their groups (see getOrgOptions) */
  orgOptions: OrgOption[],
  parentRoadmapOptions?: Pick<Roadmap, "id" | "name">[],
  currentRoadmap?: Roadmap,
}) {
  const { t } = useTranslation(["forms", "common"]);
  const descriptionRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [roadmapType, setRoadmapType] = useState<string>(currentRoadmap?.type ?? "");
  const [actor, setActor] = useState<string>(currentRoadmap?.actor ?? "");
  const [orgId, setOrgId] = useState<string>(currentRoadmap?.access_control.org_id ?? (orgOptions.length === 1 ? orgOptions[0].id : ""));
  const [access, setAccess] = useState<AccessControlInput | undefined>(undefined);
  const { addToast } = useToast();
  const router = useRouter();

  const [timestamp] = useState(() => Date.now());

  const selectedOrg = orgOptions.find(org => org.id === orgId);
  // Sharing settings are manager-only on existing content; on create the creator sets the initial sharing
  const mayEditSharing = !!selectedOrg && (isSuperAdmin || selectedOrg.role === OrgRole.MANAGER || !currentRoadmap);
  const mayEditPublic = !!selectedOrg && (isSuperAdmin || selectedOrg.role === OrgRole.MANAGER);

  const customRoadmapTypes = {
    [RoadmapType.NATIONAL]: t("common:scope.national"),
    [RoadmapType.REGIONAL]: t("common:scope.regional"),
    [RoadmapType.MUNICIPAL]: t("common:scope.municipal"),
    [RoadmapType.LOCAL]: t("common:scope.local"),
    [RoadmapType.ORGANIZATIONAL]: t("common:scope.organizational"),
    [RoadmapType.OTHER]: t("common:scope.other"),
  };

  function handleSubmit(event: React.ChangeEvent<HTMLFormElement>) {
    event.preventDefault();
    // Prevent double submission
    if (isLoading) return;
    setIsLoading(true);

    const form = event.target.elements;

    const description = form.namedItem("description") as HTMLInputElement | null;
    if (!description?.value && !currentRoadmap) {
      event.target.reportValidity();
      setIsLoading(false);
      addToast(t("forms:meta_roadmap.description_required"), "warning");
      return;
    }

    const geoAreaCode = (form.namedItem("geo-area") as HTMLButtonElement | null)?.value || null;

    let formData: RoadmapCreateInput | RoadmapUpdateInput;
    if (!currentRoadmap) {
      // Create
      formData = {
        name: (form.namedItem("name") as HTMLInputElement)?.value,
        description: (form.namedItem("description") as HTMLInputElement | null)?.value || "", // Should always have a value due to the check above, but just in case
        type: ((form.namedItem("type") as HTMLSelectElement)?.value as RoadmapType) || undefined,
        actor: (form.namedItem("actor") as HTMLInputElement)?.value || null,
        geoAreaCode: geoAreaCode,
        orgId: orgId,
        access: access,
        parentRoadmapId: (form.namedItem("parent-roadmap") as HTMLButtonElement)?.value || undefined,
      } satisfies RoadmapCreateInput;
    } else {
      // Update
      formData = {
        id: currentRoadmap.id,
        name: (form.namedItem("name") as HTMLInputElement)?.value,
        description: (form.namedItem("description") as HTMLInputElement | null)?.value,
        type: ((form.namedItem("type") as HTMLSelectElement)?.value as RoadmapType) || undefined,
        actor: (form.namedItem("actor") as HTMLInputElement)?.value ?? undefined,
        geoAreaCode: geoAreaCode,
        // Sharing settings are only sent when the user may (and did) edit them
        access: mayEditSharing ? access : undefined,
        parentRoadmapId: (form.namedItem("parent-roadmap") as HTMLButtonElement)?.value || undefined,
        timestamp,
      } satisfies RoadmapUpdateInput;
    }

    const formJSON = JSON.stringify(formData);

    formSubmitter('/api/roadmap', formJSON, currentRoadmap ? 'PUT' : 'POST', t, setIsLoading, undefined, undefined, undefined, addToast, (url) => router.push(url));
  }

  // Indexes for the data-position attribute in the legend elements
  let positionIndex = 1;

  return (
    <form onSubmit={handleSubmit} >
      {/* This hidden submit button prevents submitting by pressing enter, this avoids accidental submission when pressing enter in text inputs */}
      <input type="submit" disabled={true} className="display-none" aria-hidden={true} />

      <fieldset className={`${styles.timeLineFieldset} width-100`}>
        <legend data-position={positionIndex++} className={`${styles.timeLineLegend} font-weight-bold padding-block-125`}>{t("forms:meta_roadmap.description_legend")}</legend>
        <label>
          {t("forms:meta_roadmap.name")}
          <input id="name" name="name" className="margin-top-25 margin-bottom-100" type="text" defaultValue={currentRoadmap?.name ?? undefined} autoComplete="off" required={true} />
        </label>

        <label id="description-label">{t("forms:meta_roadmap.description")}</label>
        <TextEditor
          className="margin-top-25 margin-bottom-100" // TODO: Need label for texteditormenu
          id="description"
          ariaLabelledBy="description-label"
          placeholder={t("forms:text_editor_menu.default_placeholder")}
          editable={true}
          content={currentRoadmap ? currentRoadmap.description : ""}
          updater={(json) => descriptionRef.current ? descriptionRef.current.value = JSON.stringify(json) : null}
        />
        <input required={true} ref={descriptionRef} type="hidden" name="description" />

        {/* The owning org is chosen at creation and cannot be changed afterwards */}
        {!currentRoadmap ? (
          <label>
            {t("forms:meta_roadmap.org")}
            <select
              className="block margin-top-25 margin-bottom-100 width-100"
              name="org"
              id="org"
              value={orgId}
              required={true}
              onChange={(e) => setOrgId(e.target.value)}
            >
              <option value="" disabled={true}>{t("forms:meta_roadmap.no_chosen_org")}</option>
              {orgOptions.map((org) => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
          </label>
        ) : null}
      </fieldset>

      <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
        <legend data-position={positionIndex++} className={`${styles.timeLineLegend} font-weight-bold padding-block-125`}>{t("forms:meta_roadmap.actor_legend")}</legend>
        <label>
          {t("forms:meta_roadmap.type")}
          <select
            className="block margin-top-25 margin-bottom-100 width-100"
            name="type"
            id="type"
            defaultValue={currentRoadmap?.type ?? ""}
            required={true}
            onChange={(e) => setRoadmapType((e.target as HTMLSelectElement).value)}
          >
            <option value="" disabled={true}>{t("forms:meta_roadmap.no_chosen_roadmap_scope")}</option>
            {
              Object.values(RoadmapType).map((value) => {
                if (value === RoadmapType.NATIONAL && !isSuperAdmin) return null;
                return (
                  <option key={value} value={value}>{value in customRoadmapTypes ? customRoadmapTypes[value] : value}</option>
                );
              })
            }
          </select>
        </label>

        <label htmlFor="actor">{t("forms:meta_roadmap.actor")}</label>
        <TextSingleAutocomplete
          props={{
            className: "margin-top-25 margin-bottom-100",
            id: "actor",
            name: "actor",
            required: true,
            defaultValue: currentRoadmap?.actor ?? undefined,
            placeholder: roadmapType === "REGIONAL" || roadmapType === "MUNICIPAL" ? t("forms:combobox.default_autocomplete_placeholder") : t("forms:meta_roadmap.actor"),
          }}
          // L10N: the current implementation uses only Swedish counties and municipalities; should probably be adapted for international use in the future
          options={
            roadmapType === "REGIONAL"
              ? Object.keys(countiesAndMunicipalities).map(item => ({ name: item, value: item }))
              : roadmapType === "MUNICIPAL"
                ? Object.values(countiesAndMunicipalities).flat().map(item => ({ name: item, value: item }))
                : []
          }
          value={actor}
          setter={setActor}
        />

        {/* Structured geo marker (SCB region code); the actor above stays a free-text display label */}
        <label id="geo-area-label" htmlFor="geo-area">{t("forms:meta_roadmap.geo_area")}</label>
        <SelectSingleSearch
          props={{
            className: "margin-top-25 margin-bottom-100",
            id: "geo-area",
            name: "geo-area",
            placeholder: t("forms:combobox.select_or_leave"),
          }}
          defaultValue={
            currentRoadmap?.geo_area_code
              ? (() => {
                const selected = Object.entries(areaCodes).find(([, code]) => code === currentRoadmap.geo_area_code);
                return selected ? { name: selected[0], value: selected[1] } : false;
              })()
              : false
          }
          options={[
            { name: t("forms:meta_roadmap.no_chosen_geo_area"), value: "" },
            ...Object.entries(areaCodes)
              .sort((a, b) => areaSorter([a[0], a[1]], [b[0], b[1]]))
              .map(([name, code]) => ({ name: name, value: code })),
          ]}
        />
      </fieldset>

      {/* Sharing settings; manager-only on existing content */}
      {selectedOrg && mayEditSharing ? (
        <ConfigureAccess
          key={selectedOrg.id}
          groups={selectedOrg.groups}
          initialAccess={currentRoadmap?.access_control}
          mayEditPublic={mayEditPublic}
          onChange={setAccess}
          positionIndex={positionIndex++}
          legend={t("forms:meta_roadmap.legend_visibility")}
        />
      ) : null}

      <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
        <legend
          // Technically incrementing here is unused but if you add a another entry after this one it will be correct
          // eslint-disable-next-line no-useless-assignment
          data-position={positionIndex++}
          className={`${styles.timeLineLegend} font-weight-bold padding-block-125`}
        >
          {t("forms:meta_roadmap.relationship_legend")}</legend>
        <label id="parent-roadmap-label" htmlFor="parent-roadmap">{t("forms:meta_roadmap.relationship_label")}</label>
        {parentRoadmapOptions ? ( // TODO: This might not make sense? // TODO: Memoize this?
          <SelectSingleSearch
            props={{
              className: "margin-top-25",
              id: "parent-roadmap",
              name: "parent-roadmap",
              placeholder: t("forms:combobox.select_or_leave"),
              disabled: !parentRoadmapOptions,
            }}
            defaultValue={ // TODO: Might be a better way to do this
              currentRoadmap
                ? currentRoadmap.parent_roadmap_id
                  ? (() => {
                    const selected = parentRoadmapOptions.find(
                      (roadmap) => roadmap.id === currentRoadmap.parent_roadmap_id,
                    );
                    return selected ? { name: selected.name, value: selected.id } : false;
                  })()
                  : { name: t("forms:meta_roadmap.relationship_no_chosen"), value: "" }
                : false
            }
            options={[
              { name: t("forms:meta_roadmap.relationship_no_chosen"), value: "" },
              ...parentRoadmapOptions.map((roadmap) => ({
                name: roadmap.name,
                value: roadmap.id,
              })),
            ]}
          />
        ) : null}
      </fieldset>

      <div className="margin-top-400 padding-top-100 margin-bottom-100" style={{ borderTop: '1px solid var(--gray-80)' }}>
        <button
          className="text-align-center seagreen color-purewhite width-100"
          style={{ fontSize: '14px', transform: 'none' }}
          type="submit"
          id="submit-button"
          disabled={isLoading}
        >
          {currentRoadmap ? t("common:tsx.save") : t("forms:meta_roadmap.create")}
        </button>
      </div>
    </form>
  );
}
