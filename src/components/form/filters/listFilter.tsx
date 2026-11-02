import { IconSearch } from "@tabler/icons-react";

/**
 * A search box with a magnifier icon, for narrowing a list down by text. Plain
 * input props pass through: controlled (`value`) for client-side lists, or
 * uncontrolled (`defaultValue`) when the caller syncs the text elsewhere, such as
 * the URL. Give it an accessible name with `aria-label` or `aria-labelledby`.
 */
export default function ListFilter({
  className,
  style,
  ...inputProps
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
  // Layout props style the box around the input, the rest go to the input itself
  return (
    <div className={`flex align-items-center padding-50 smooth focusable ${className ?? ""}`} style={style}>
      <IconSearch width={20} height={20} style={{ minWidth: '20px' }} strokeWidth={1.5} aria-hidden="true" />
      <input
        type="search"
        className="padding-0 margin-inline-50 flex-grow-100"
        {...inputProps}
        onKeyDown={(event) => {
          // The list filters as one types; Enter must not submit a surrounding form
          if (event.key === "Enter") event.preventDefault();
          inputProps.onKeyDown?.(event);
        }}
      />
    </div>
  );
}

/** Whether any of the texts contains the filter, ignoring case; an empty filter matches everything */
export function matchesFilter(filter: string, ...texts: string[]): boolean {
  const needle = filter.trim().toLocaleLowerCase("sv-SE");
  if (!needle) return true;
  return texts.some(text => text.toLocaleLowerCase("sv-SE").includes(needle));
}
