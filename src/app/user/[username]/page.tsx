import { getSession } from "@/lib/session";
import { cookies } from "next/headers";
import { getServerLocale } from "@/functions/serverLocale";
import parentDict from "../user.dict.json" with { type: "json" };

export default async function Page() {
  const dict = parentDict["[username]"].page
  const locale = await getServerLocale();

  const session = await getSession(cookies())

  return <>
    <h1>{session.user?.username}</h1>
    <h2 style={{ fontSize: '1rem' }}>{dict.belongsTo[locale]}</h2>
    <ul>
      {session.user?.userGroups.map((usergroup, i) => (usergroup &&
        <li key={i}>{usergroup}</li>
      ))}
    </ul>
  </>
}