'use client'

import { useRef, useState } from "react";
import Image from "next/image";
import styles from './accessSelector.module.css' with { type: "css" }

/**
 * Converts the form data to a JSON object that can be sent to the API.
 * @param formElements The form elements to convert to JSON.
 */
export function getAccessData(editUsers: RadioNodeList | Element | null, viewUsers: RadioNodeList | Element | null, editGroups: RadioNodeList | Element | null, viewGroups: RadioNodeList | Element | null) {
  const editUsersValue: string[] = [];
  const viewUsersValue: string[] = [];
  const editGroupsValue: string[] = [];
  const viewGroupsValue: string[] = [];

  if (editUsers instanceof RadioNodeList) {
    for (const i of editUsers) {
      if (i instanceof HTMLInputElement && i.value) {
        editUsersValue.push(i.value);
      }
    }
  } else if (editUsers instanceof HTMLInputElement && editUsers.value) {
    editUsersValue.push(editUsers.value);
  }

  if (viewUsers instanceof RadioNodeList) {
    for (const i of viewUsers) {
      if (i instanceof HTMLInputElement && i.value) {
        viewUsersValue.push(i.value);
      }
    }
  } else if (viewUsers instanceof HTMLInputElement && viewUsers.value) {
    viewUsersValue.push(viewUsers.value);
  }

  if (editGroups instanceof RadioNodeList) {
    for (const i of editGroups) {
      if (i instanceof HTMLInputElement && i.checked) {
        editGroupsValue.push(i.value);
      }
    }
  } else if (editGroups instanceof HTMLInputElement && editGroups.checked) {
    editGroupsValue.push(editGroups.value);
  }

  if (viewGroups instanceof RadioNodeList) {
    for (const i of viewGroups) {
      if (i instanceof HTMLInputElement && i.checked) {
        viewGroupsValue.push(i.value);
      }
    }
  } else if (viewGroups instanceof HTMLInputElement && viewGroups.checked) {
    viewGroupsValue.push(viewGroups.value);
  }

  return {
    editUsers: editUsersValue,
    viewUsers: viewUsersValue,
    editGroups: editGroupsValue,
    viewGroups: viewGroupsValue,
  }
}

/**
 * A somewhat generic function for handling keydown events on text fields.
 * @param event The event that triggered the function, should be a keydown event.
 * @param selectedOptions A list with the currently selected users/groups, should be a state variable.
 * @param selectedSetter The function to set `selectedOptions` to a new value, should be a state setter.
 * @param allOptions A list with the available users/groups. Is modified in-place if supplied.
 */
function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>, selectedOptions: string[], selectedSetter: React.Dispatch<React.SetStateAction<string[]>>, allOptions?: string[]) {
  if (event.key === 'Enter' && event.currentTarget.value !== '') {
    addUser(event.currentTarget.value, selectedOptions, selectedSetter, allOptions)
    // Clear the text field
    event.currentTarget.value = '';
  }
}

function addUser(name: string | undefined, selectedOptions: string[], selectedSetter: React.Dispatch<React.SetStateAction<string[]>>, allOptions?: string[]) {
  if (!name) return;
  // Add the new user to the list of selected users
  selectedSetter([...selectedOptions, name]);
  if (allOptions) {
    // Add the new user to the list of options
    allOptions.push(name);
  }
}

export function EditUsers({ existingUsers, groupOptions, existingGroups }: { existingUsers?: string[], groupOptions: string[], existingGroups?: string[] }) {
  // The users that have editing access to the item
  const [editUsers, setEditUsers] = useState<string[]>(existingUsers ?? []);

  // Add existing groups with access to the list of options, in case they are not already there
  let groups = [...groupOptions, ...existingGroups ?? []]
  // Remove duplicates
  groups = groups.filter((group, index) => groups.indexOf(group) === index)

  const editorRef = useRef<HTMLInputElement | null>(null)

  return (
    <>

      <fieldset className="margin-bottom-100">
        <legend>Grupper med redigeringsbehörighet</legend>
        <ul className="padding-left-100" style={{ listStyle: 'none' }}>
          {groups.map((group) => (
            <li key={'viewGroup' + group}>
              <label className="display-flex align-items-center gap-50 margin-block-50">
                <input type="checkbox" name="viewGroups" id={'viewGroup' + group} value={group} defaultChecked={existingGroups?.includes(group)} />
                {group}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      {/* A text field whose contents get appended to editUsers upon pressing enter */}

      <label className="block margin-block-100" htmlFor="newEditUser">
        Användare med redigeringsbehörighet
        <div className={`${styles.multiAddContainer} flex align-items-flex-end flex-wrap-wrap margin-block-25 focusable smooth padding-25 gap-25`}>
          {editUsers.map((user, index) => (
            <span className="display-flex gap-50 align-items-center padding-block-25 padding-inline-50 smooth" style={{ backgroundColor: 'var(--gray-90)', width: 'fit-content' }} key={'viewUser' + index}>
              {/* TODO: Add focusable to span here */}
              {user}
              <button
                className="grid padding-0"
                onClick={() => { setEditUsers(editUsers.filter((editUser) => editUser !== user)); }}
                type="button">
                <Image src="/icons/close.svg" alt="Ta bort användare" width={12} height={12}></Image>
              </button>
            </span>
          ))}
          <input
            style={{ backgroundColor: 'transparent', width: '0', minWidth: '100px', height: '100%' }}
            className="padding-25 flex-grow-100"
            type="text"
            name="editUsers"
            id="newEditUser"
            ref={editorRef}
            onKeyDown={(event) => handleKeyDown(event, editUsers, setEditUsers)} />
        </div>
      </label>
      <button
        type="button"
        onClick={() => { addUser(editorRef.current?.value, editUsers, setEditUsers); if (editorRef.current) editorRef.current.value = '' }}>
        Lägg till användare
      </button>

    </>
  )
}

export function ViewUsers({ existingUsers, groupOptions, existingGroups, isPublic }: { existingUsers?: string[], groupOptions: string[], existingGroups?: string[], isPublic?: boolean }) {
  // The users that have viewing access to the item
  const [viewUsers, setViewUsers] = useState<string[]>(existingUsers ?? []);

  // Add existing groups with access to the list of options, in case they are not already there
  let groups = [...groupOptions, ...existingGroups ?? []]
  // Remove duplicates
  groups = groups.filter((group, index) => groups.indexOf(group) === index)

  const viewRef = useRef<HTMLInputElement | null>(null)

  return (
    <>

      <fieldset className="margin-bottom-100">
        <legend>Grupper med läsbehörighet</legend>
        <ul className="padding-left-100" style={{ listStyle: 'none' }}>
          <li>
            <label className="display-flex align-items-center gap-50 margin-block-50">
              <input type="checkbox" name="isPublic" id="isPublic" defaultChecked={isPublic} />
              Visa inlägg publikt
            </label>
          </li>
          {groups.map((group) => (
            <li key={'viewGroup' + group}>
              <label className="display-flex align-items-center gap-50 margin-block-50">
                <input type="checkbox" name="viewGroups" id={'viewGroup' + group} value={group} defaultChecked={existingGroups?.includes(group)} />
                {group}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      {/* A text field whose contents get appended to viewUsers upon pressing enter */}
      <label className="block margin-block-100" htmlFor="newViewUser">
        Användare med läsbehörighet
        <div className={`${styles.multiAddContainer} flex align-items-flex-end flex-wrap-wrap margin-block-25 focusable smooth padding-25 gap-25`}>
          {viewUsers.map((user, index) => (
            <span className="display-flex gap-50 align-items-center padding-block-25 padding-inline-50 smooth" style={{ backgroundColor: 'var(--gray-90)', width: 'fit-content' }} key={'viewUser' + index}>
              {/* TODO: Add focusable to span here */}
              {user}
              <button
                className="grid padding-0"
                onClick={() => { setViewUsers(viewUsers.filter((viewUser) => viewUser !== user)); }}
                type="button">
                <Image src="/icons/close.svg" alt="Ta bort användare" width={12} height={12}></Image>
              </button>
            </span>
          ))}
          <input
            style={{ backgroundColor: 'transparent', width: '0', minWidth: '100px', height: '100%' }}
            className="padding-25 flex-grow-100"
            type="text"
            name="viewUsers"
            id="newViewUser"
            ref={viewRef} onKeyDown={(event) => handleKeyDown(event, viewUsers, setViewUsers)} />
        </div>
      </label>
      <button
        type="button"
        onClick={() => { addUser(viewRef.current?.value, viewUsers, setViewUsers); if (viewRef.current) viewRef.current.value = '' }}>
        Lägg till användare
      </button>
    </>
  )
} 