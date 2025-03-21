"use server";

export async function KeysColumn({ allKeys }: { allKeys: string[] }) {
  return (<>
    {allKeys.map((key) => (<p key={key}>{key}</p>))}
  </>);
}