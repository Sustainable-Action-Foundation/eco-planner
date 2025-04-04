"use server";

export async function KeysColumn({ allKeys, className = "" }: { allKeys: string[], className?: string }) {
  return (<>
    {allKeys.map((key, index) => (
      <p
        data-odd={index % 2 === 0}
        key={key}
        className={className}
        style={{ gridRow: index + 2 }}
      >
        {key}
      </p>
    ))}
  </>);
}