'use client'

import { useState } from "react"
import { useTranslation } from "react-i18next";
import { IconTrashXFilled } from "@tabler/icons-react";

export default function LinkInput({ links }: { links?: { url: string, description: string | null }[] }) {
  const { t } = useTranslation("forms");

  // The list of links
  const [linkList, setLinkList] = useState<{ url: string, description: string | null }[]>(links ?? [])

  return (
    <>
      {/* A text field whose contents get appended to linkList upon pressing enter */}
      <div className="flex gap-25">
        <label className="block margin-block-75">
          {t("forms:link_input.name_label")}
          <input className="margin-block-25" placeholder={t("forms:link_input.name_placeholder")} type="text" name="linkDescription" id="newDescription" onKeyDown={(event) => {
            if (event.key === 'Enter') {
              const url = (document.querySelector('#newLink') as HTMLInputElement)?.value ?? '';
              const description = event.currentTarget.value;
              // Add the new link to the list of links
              setLinkList([...linkList, { url, description }])
              // Clear the text fields
              event.currentTarget.value = '';
              (document.querySelector('#newLink') as HTMLInputElement).value = '';
            }
          }} />
        </label>

        <label className="block margin-block-75 flex-grow-100">
          {t("forms:link_input.url_label")}
          <input className="margin-block-25" type="url" name="linkUrl" id="newLink" placeholder={t("forms:link_input.url_placeholder")} onKeyDown={(event) => {
            if (event.key === 'Enter') {
              const url = event.currentTarget.value;
              // #newDescription is the input field for the description of the link
              const description = (document.querySelector('#newDescription') as HTMLInputElement)?.value ?? '';
              // Add the new link to the list of links
              setLinkList([...linkList, { url, description }])
              // Clear the text fields
              event.currentTarget.value = '';
              (document.querySelector('#newDescription') as HTMLInputElement).value = '';
            }
          }} />
        </label>
      </div>
      <ul className="padding-top-100 margin-top-s" style={{ borderTop: '1px solid var(--gray-90)' }}>
        {linkList.map((link, index) => (
          <li key={`${index}link${link.url}${link.description}`}>
            <div className="flex align-items-flex-end">
              {/* TODO: Missing labels for inputs */}
              <input className="font-weight-bold transparent" type="text" name="linkDescription" defaultValue={link.description || ""} />
              <input className="transparent" type="url" name="linkUrl" defaultValue={link.url} />
              <button
                type="button"
                className="grid transparent round margin-left-100"
                onClick={() => setLinkList(linkList.filter((_, i) => i !== index))}>
                <IconTrashXFilled fill='#CB3C3C' />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}

export function getLinks(form: HTMLFormElement) {
  const links: { url: string, description: string }[] = [];
  // Get all the link fields
  const linkFields = form.querySelectorAll('input[name="linkUrl"]') as NodeListOf<HTMLInputElement>;
  const descriptionFields = form.querySelectorAll('input[name="linkDescription"]') as NodeListOf<HTMLInputElement>;
  // Add the links to the list of links
  for (let i = 0; i < linkFields.length; i++) {
    const url = linkFields[i].value;
    const description = descriptionFields[i].value;
    if (url !== '') {
      links.push({ url, description });
    }
  }
  return links;
}