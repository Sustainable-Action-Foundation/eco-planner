"use client";

/**
 * Invisible native input overlaying a custom combobox so the browser's own
 * constraint validation covers it: submitting with an empty required combobox
 * is blocked with a visible validation bubble anchored on the combobox. This
 * replaces the old `preventInvalidFormSubmission` listener, which swallowed
 * the submit event (preventDefault + stopPropagation) with no user feedback —
 * forms just silently did nothing.
 *
 * The input is deliberately nameless: it must never add a value to the form's
 * FormData (combobox values reach forms via `onChange`, not submission). It is
 * kept out of the tab order and hidden from assistive tech — the combobox
 * button already announces `aria-required`/`aria-invalid`.
 *
 * Pass `form` pointing at a non-existent form id for a combobox that should
 * not gate the surrounding form (e.g. the historical-data table picker, whose
 * incomplete selection the goal form deliberately skips).
 */
export function ComboboxValidationProxy({
  hasValue,
  required,
  disabled,
  form,
}: {
  hasValue: boolean;
  required?: boolean;
  disabled?: boolean;
  form?: string;
}) {
  return (
    <input
      type="text"
      tabIndex={-1}
      aria-hidden={true}
      required={required}
      disabled={disabled}
      form={form}
      value={hasValue ? "y" : ""}
      onChange={() => undefined}
      style={{
        // Cover the combobox toggle so the validation bubble anchors on it,
        // while staying invisible and click-through. Must not be display:none
        // or visibility:hidden — the browser refuses to show a bubble on an
        // unfocusable control and silently cancels submission instead.
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        opacity: 0,
        pointerEvents: "none",
        border: "none",
        padding: 0,
        margin: 0,
      }}
    />
  );
}
