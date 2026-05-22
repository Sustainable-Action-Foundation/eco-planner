
export function reporter(keyWithNS: string, value: string) {

  const key = keyWithNS.replace(/[^:]+:/, "");
  if (value === "") return "[EMPTY]";
  if (key === value) return "[MISSING]";

  return value;
}
