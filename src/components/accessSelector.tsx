'use client'

import { Fragment, useState } from "react";

export default function AccessSelector({ groupOptions }: { groupOptions: string[] }) {
  return (
    <>
      <details open>
        <summary>Redigera behörigheter</summary>
        <p>
          För att lägga till en användare/grupp, skriv in namnet och tryck på enter.<br />
          För att ta bort en användare/grupp, checka ur rutan bredvid namnet.<br />
        </p>
      </details>
      <EditUsers />
      <br />
      <ViewUsers />
      <br />
      <EditGroups groupOptions={groupOptions} />
      <br />
      <ViewGroups groupOptions={groupOptions} />
    </>
  )
}

/**
 * Converts the form data to a JSON object that can be sent to the API.
 * @param formElements The form elements to convert to JSON.
 */
export function getAccessData(editUsers: RadioNodeList | null, viewUsers: RadioNodeList | null, editGroups: RadioNodeList | null, viewGroups: RadioNodeList | null) {
  let editUsersValue: string[] = [];
  let viewUsersValue: string[] = [];
  let editGroupsValue: string[] = [];
  let viewGroupsValue: string[] = [];

  if (editUsers) {
    for (let i of editUsers) {
      if (i instanceof HTMLInputElement && i.checked) {
        editUsersValue.push(i.value);
      }
    }
  }

  if (viewUsers) {
    for (let i of viewUsers) {
      if (i instanceof HTMLInputElement && i.checked) {
        viewUsersValue.push(i.value);
      }
    }
  }

  if (editGroups) {
    for (let i of editGroups) {
      if (i instanceof HTMLInputElement && i.checked) {
        editGroupsValue.push(i.value);
      }
    }
  }

  if (viewGroups) {
    for (let i of viewGroups) {
      if (i instanceof HTMLInputElement && i.checked) {
        viewGroupsValue.push(i.value);
      }
    }
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
    // Add the new user to the list of selected users
    selectedSetter([...selectedOptions, event.currentTarget.value]);
    if (allOptions) {
      // Add the new user to the list of options
      allOptions.push(event.currentTarget.value);
    }
    // Clear the text field
    event.currentTarget.value = '';
  }
}

function EditUsers({ existingUsers }: { existingUsers?: string[] }) {
  // The users that have editing access to the item
  const [editUsers, setEditUsers] = useState<string[]>(existingUsers ?? []);

  return (
    <fieldset style={{ display: 'inline', margin: '10px' }}>
      <legend style={{ outline: '1px solid grey', padding: '3px 6px' }}>Användare med redigeringsbehörighet</legend>
      {editUsers.map((user) => (
        <Fragment key={'editUser' + user}>
          <input type="checkbox" name="editUsers" id={'editUser' + user} value={user} checked={editUsers.includes(user)} onChange={
            (event) => {
              // Remove the user from the list of selected editUsers
              setEditUsers(editUsers.filter((editUser) => editUser !== user));
            }
          } />
          <label htmlFor={'editUser' + user}>{user}</label>
          <br />
        </Fragment>
      ))}
      {/* A text field whose contents get appended to editUsers upon pressing enter */}
      <label htmlFor="newEditUser">Ny användare: </label>
      <input type="text" name="newEditUser" id="newEditUser" onKeyDown={(event) => handleKeyDown(event, editUsers, setEditUsers)} style={{ backgroundColor: '#F5D5274A' }} />
    </fieldset>
  )
}

function ViewUsers({ existingUsers }: { existingUsers?: string[] }) {
  // The users that have viewing access to the item
  const [viewUsers, setViewUsers] = useState<string[]>(existingUsers ?? []);

  return (
    <fieldset style={{ display: 'inline', margin: '10px' }}>
      <legend style={{ outline: '1px solid grey', padding: '3px 6px' }}>Användare med läsbehörighet</legend>
      {viewUsers.map((user) => (
        <Fragment key={'viewUser' + user}>
          <input type="checkbox" name="viewUsers" id={'viewUser' + user} value={user} checked={viewUsers.includes(user)} onChange={
            (event) => {
              // Remove the user from the list of selected viewUsers if the checkbox is unchecked
              setViewUsers(viewUsers.filter((viewUser) => viewUser !== user));
            }
          } />
          <label htmlFor={'viewUser' + user}>{user}</label>
          <br />
        </Fragment>
      ))}
      {/* A text field whose contents get appended to viewUsers upon pressing enter */}
      <label htmlFor="newViewUser">Ny användare: </label>
      <input type="text" name="newViewUser" id="newViewUser" onKeyDown={(event) => handleKeyDown(event, viewUsers, setViewUsers)} style={{ backgroundColor: '#F5D5274A' }} />
    </fieldset>
  )
}

function EditGroups({ groupOptions, existingGroups }: { groupOptions: string[], existingGroups?: string[] }) {
  let groups = groupOptions

  const [editGroups, setEditGroups] = useState<string[]>(existingGroups ?? []); // The groups that have editing access to the item

  return (
    <fieldset style={{ display: 'inline', margin: '10px' }}>
      <legend style={{ outline: '1px solid grey', padding: '3px 6px' }}>Grupper med redigeringsbehörighet</legend>
      {groups.map((group) => (
        <Fragment key={'editGroup' + group}>
          <input type="checkbox" name="editGroups" id={'editGroup' + group} value={group} />
          <label htmlFor={'editGroup' + group}>{group}</label>
          <br />
        </Fragment>
      ))}
      {/* A text field whose contents get appended to groupOptions upon pressing enter */}
      {/* Currently disabled, this functionality might not make sense here */}
      {/* <input type="text" name="newEditGroup" id="newEditGroup" onKeyDown={(event) => handleKeyDown(event, editGroups, setEditGroups, groups)} style={{ backgroundColor: '#F5D5274A' }} /> */}
    </fieldset>
  );
}

function ViewGroups({ groupOptions, existingGroups }: { groupOptions: string[], existingGroups?: string[] }) {
  let groups = groupOptions

  const [viewGroups, setViewGroups] = useState<string[]>(existingGroups ?? []); // The groups that have viewing access to the item

  return (
    <fieldset style={{ display: 'inline', margin: '10px' }}>
      <legend style={{ outline: '1px solid grey', padding: '3px 6px' }}>Grupper med läsbehörighet</legend>
      {groups.map((group) => (
        <Fragment key={'viewGroup' + group}>
          <input type="checkbox" name="viewGroups" id={'viewGroup' + group} value={group} />
          <label htmlFor={'viewGroup' + group}>{group}</label>
          <br />
        </Fragment>
      ))}
    </fieldset>
  );
}