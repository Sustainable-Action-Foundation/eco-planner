'use client'

import { Fragment, useState } from "react"

export default function LinkInput({ links }: { links?: { url: string, description: string | null }[] }) {
  // The list of links. Is displayed as a list of checkboxes.
  const [linkList, setLinkList] = useState<{ url: string, description: string | null }[]>(links ?? [])

  return (
    <fieldset>
      {linkList.map((link, index) => (
        <Fragment key={'link' + index}>
          <label>
            Länk:
            <input type="url" name="linkUrl" defaultValue={link.url} />
          </label>
          <label>
            Beskrivning:
            <input type="text" name="linkDescription" defaultValue={link.description || ""} />
          </label>
          <input type="button" value="Ta bort ↑" onClick={() => setLinkList(linkList.filter((_, i) => i !== index))} />
        </Fragment>
      ))}

      {/* A text field whose contents get appended to linkList upon pressing enter */}
      <label className="block margin-block-75">
        Ny länk:
        <input className="margin-block-25" type="url" name="linkUrl" id="newLink" onKeyDown={(event) => {
          if (event.key === 'Enter') {
            const url = event.currentTarget.value;
            // #newDescription os the input field for the description of the link
            const description = (event.currentTarget.parentNode?.querySelector('#newDescription') as HTMLInputElement)?.value ?? '';
            // Add the new link to the list of links
            setLinkList([...linkList, { url, description }])
            // Clear the text fields
            event.currentTarget.value = '';
            (event.currentTarget.parentNode?.querySelector('#newDescription') as HTMLInputElement).value = '';
          }
        }} />
      </label>

      <label className="block margin-block-75">
        Beskrivning:
        <input className="margin-block-25" type="text" name="linkDescription" id="newDescription" onKeyDown={(event) => {
          if (event.key === 'Enter') {
            const url = (event.currentTarget.parentNode?.querySelector('#newLink') as HTMLInputElement)?.value ?? '';
            const description = event.currentTarget.value;
            // Add the new link to the list of links
            setLinkList([...linkList, { url, description }])
            // Clear the text fields
            event.currentTarget.value = '';
            (event.currentTarget.parentNode?.querySelector('#newLink') as HTMLInputElement).value = '';
          }
        }} />
      </label>

    </fieldset>
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