'use client'

import countiesAndMunicipalities from "@/lib/countiesAndMunicipalities.json" with { type: "json" }
import { LoginData } from "@/lib/session";
import { AccessControlled, MetaRoadmapInput } from "@/types";
import { MetaRoadmap, RoadmapType } from "@prisma/client";
import { useEffect, useState } from "react";
import { EditUsers, ViewUsers, getAccessData } from "@/components/forms/accessSelector/accessSelector";
import LinkInput, { getLinks } from "@/components/forms/linkInput/linkInput"
import formSubmitter from "@/functions/formSubmitter";
import styles from '../forms.module.css'
import FormWrapper from "../formWrapper";

export default function MetaRoadmapForm({
  user,
  userGroups,
  parentRoadmapOptions,
  currentRoadmap,
}: {
  user: LoginData['user'],
  userGroups: string[],
  parentRoadmapOptions?: MetaRoadmap[],
  currentRoadmap?: MetaRoadmap & AccessControlled,
}) {
  async function handleSubmit(event: React.ChangeEvent<HTMLFormElement>) {
    // Mostly the usual submit handler stuff.
    // We might want to redirect the user to the roadmap form immediately after successfully submitting the metaRoadmap form
    // (and pre-populate the roadmap form with the new metaRoadmap's ID)
    event.preventDefault();
    // Prevent double submission
    if (isLoading) return;
    setIsLoading(true);

    const form = event.target.elements;

    const links = getLinks(event.target);

    const { editUsers, viewUsers, editGroups, viewGroups } = getAccessData(
      form.namedItem("editUsers"),
      form.namedItem("viewUsers"),
      form.namedItem("editGroups"),
      form.namedItem("viewGroups")
    );

    const formData: MetaRoadmapInput & { id?: string, timestamp?: number } = {
      name: (form.namedItem("metaRoadmapName") as HTMLInputElement)?.value,
      description: (form.namedItem("description") as HTMLTextAreaElement)?.value,
      type: ((form.namedItem("type") as HTMLSelectElement)?.value as RoadmapType) || null,
      actor: (form.namedItem("actor") as HTMLInputElement)?.value || null,
      editors: editUsers,
      viewers: viewUsers,
      editGroups,
      viewGroups,
      isPublic: (form.namedItem("isPublic") as HTMLInputElement)?.checked || false,
      links,
      parentRoadmapId: (form.namedItem("parentRoadmap") as HTMLSelectElement)?.value || undefined,
      id: currentRoadmap?.id || undefined,
      timestamp,
    };

    const formJSON = JSON.stringify(formData);

    formSubmitter('/api/metaRoadmap', formJSON, currentRoadmap ? 'PUT' : 'POST', setIsLoading);
  }

  const [isLoading, setIsLoading] = useState<boolean>(false)

  const timestamp = Date.now()

  const customRoadmapTypes = {
    [RoadmapType.NATIONAL]: 'Nationell färdplan',
    [RoadmapType.REGIONAL]: 'Regional färdplan',
    [RoadmapType.MUNICIPAL]: 'Kommunal färdplan',
    [RoadmapType.LOCAL]: 'Lokal färdplan',
    [RoadmapType.OTHER]: 'Övrig färdplan, exempelvis för en organisation'
  }

  let currentAccess: AccessControlled | undefined = undefined;
  if (currentRoadmap) {
    currentAccess = {
      author: currentRoadmap.author,
      editors: currentRoadmap.editors,
      viewers: currentRoadmap.viewers,
      editGroups: currentRoadmap.editGroups,
      viewGroups: currentRoadmap.viewGroups,
      isPublic: currentRoadmap.isPublic,
    }
  }


  return (
    <>
      <form onSubmit={handleSubmit} className="padding-left-300" style={{ transform: 'translate(-3rem, 0)' }} >
        {/* This hidden submit button prevents submitting by pressing enter, this avoids accidental submission when adding new entries in AccessSelector (for example, when pressing enter to add someone to the list of editors) */}
        <input type="submit" disabled={true} className="display-none" aria-hidden={true} />

        <fieldset className={`${styles.timeLineFieldset} width-100`}>
          <legend data-position='1' className={`${styles.timeLineLegend} font-weight-bold`}>Beskriv din färdplan</legend>
          <label className="block margin-bottom-100 margin-top-200">
            Namn för den nya färdplanen
            <input id="metaRoadmapName" name="metaRoadmapName" className="margin-block-25" type="text" defaultValue={currentRoadmap?.name ?? undefined} required />
          </label>

          <label className="block margin-block-100">
            Beskrivning av färdplanen
            <textarea className="block smooth margin-block-25" name="description" id="description" defaultValue={currentRoadmap?.description ?? undefined} required></textarea>
          </label>
        </fieldset>

        <fieldset className={`${styles.timeLineFieldset} width-100`}>
          <legend data-position='2' className={`${styles.timeLineLegend} font-weight-bold padding-block-100`}>Välj ansvarig aktör</legend>
          <label className="block margin-block-100">
            Typ av färdplan
            <select className="block margin-block-25" name="type" id="type" defaultValue={currentRoadmap?.type ?? ""} required>
              <option value="">Välj en typ</option>
              {
                Object.values(RoadmapType).map((value) => {
                  if (value == RoadmapType.NATIONAL && !user?.isAdmin) return null;
                  return (
                    <option key={value} value={value}>{value in customRoadmapTypes ? customRoadmapTypes[value] : value}</option>
                  )
                })
              }
            </select>
          </label>

          <label className="block margin-block-100">
            Välj en aktör
            <input className="margin-block-25" list="actors" id="actor" name="actor" type="text" defaultValue={currentRoadmap?.actor ?? undefined} />
          </label>
        </fieldset>

        <fieldset className={`${styles.timeLineFieldset} width-100`}>
          <legend data-position='3' className={`${styles.timeLineLegend} font-weight-bold padding-block-100`}>Bifoga externa resurser</legend>
          <LinkInput />
        </fieldset>

        {(!currentRoadmap || user?.isAdmin || user?.id === currentRoadmap.authorId) &&
          <fieldset className={`${styles.timeLineFieldset} width-100`}>
            <legend data-position='4' className={`${styles.timeLineLegend} font-weight-bold padding-block-100`}>Justera läsbehörighet</legend>
            <ViewUsers
              groupOptions={userGroups}
              existingUsers={currentAccess?.viewers.map((user) => user.username)}
              existingGroups={currentAccess?.viewGroups.map((group) => { return group.name })}
              isPublic={currentAccess?.isPublic ?? false}
            />
          </fieldset>
        }


        {(!currentRoadmap || user?.isAdmin || user?.id === currentRoadmap.authorId) &&
          <fieldset className={`${styles.timeLineFieldset} width-100`}>
            <legend data-position='5' className={`${styles.timeLineLegend} font-weight-bold padding-block-100`}>Justera redigeringsbehörighet</legend>
            <EditUsers
              groupOptions={userGroups}
              existingUsers={currentAccess?.editors.map((user) => user.username)}
              existingGroups={currentAccess?.editGroups.map((group) => { return group.name })}
            />
          </fieldset>
        }

        <fieldset className={`${styles.timeLineFieldset} width-100`}>
          <legend data-position='6' className={`${styles.timeLineLegend} font-weight-bold padding-block-100`}>Jobbar denna färdplan mot en annan färdplan?</legend>
          <label className="block margin-block-100">
            Förälder
            <select name="parentRoadmap" id="parentRoadmap" className="block margin-block-25" defaultValue={currentRoadmap?.parentRoadmapId ?? ""}>
              <option value="">Ingen förälder vald</option>
              {
                !parentRoadmapOptions && currentRoadmap && currentRoadmap.parentRoadmapId && (
                  <option value={currentRoadmap.parentRoadmapId} disabled>{currentRoadmap.parentRoadmapId}</option>
                )
              }
              {
                parentRoadmapOptions && parentRoadmapOptions.map((roadmap) => {
                  return (
                    <option key={roadmap.id} value={roadmap.id}>{roadmap.name}</option>
                  )
                })
              }
            </select>
          </label>
        </fieldset>


        {/* Add copy of RoadmapForm? Only if we decide to include it immediately rather than redirecting to it */}

        <input type="submit" id="submit-button" value={currentRoadmap ? "Spara" : "Skapa färdplan"} />
      </form>

      <datalist id="actors">
        {
          Object.entries(countiesAndMunicipalities).flat(2).map((actor, index) => {
            return (
              <option key={`${actor}${index}`} value={actor} />
            )
          })
        }
      </datalist>
    </>
  )
}