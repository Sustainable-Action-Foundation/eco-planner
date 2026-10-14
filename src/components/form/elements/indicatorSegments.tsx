"use client";

import { clientSafeGetOneRoadmapIteration } from "@/fetchers/client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

/** Both the stored separator ("\") and the one users reach for ("/") split a path */
const separators = /[\\/]+/;

/** `Key\Landtransporter\Personbilar` → `["Key", "Landtransporter", "Personbilar"]` */
function splitPath(path: string): string[] {
  return path.split(separators).map(segment => segment.trim()).filter(segment => segment !== "");
}

/** Joins segments back into the stored format, skipping boxes that are (transiently) empty */
function joinPath(segments: string[]): string {
  return segments.map(segment => segment.trim()).filter(segment => segment !== "").join("\\");
}

/**
 * The goal form's indicator parameter as one text box per path segment instead
 * of a single field with "\"-separated levels (the stored format is unchanged;
 * a hidden input carries the joined path under `name`).
 *
 * - The trailing empty box appends a new segment as soon as it gets content.
 * - Separators are not typable: a trailing "/" or "\" commits the segment and
 *   moves to the next box, and pasting a full path into a box splits it,
 *   replacing that box and everything after it.
 * - Emptying a middle box removes that segment on blur (Backspace in an
 *   already-empty box removes it right away and steps left).
 *
 * Below the boxes, segments already used at the focused level are offered as
 * suggestions: the indicator tree of the target roadmap version (fetched
 * lazily on first focus) plus the static LEAP parameter list.
 */
export default function IndicatorSegmentsInput({
  id,
  name,
  value,
  setter,
  iterationId,
  knownPaths,
  className,
  required,
}: {
  /** Id of the first segment box (the label target, and what `ParameterSync` focuses) */
  id: string,
  /** Name of the hidden input carrying the joined path */
  name: string,
  /** The joined path ("A\B\C"); external updates re-split into boxes */
  value: string,
  setter: React.Dispatch<React.SetStateAction<string>>,
  /** Roadmap version whose existing indicators seed the suggestions, fetched lazily */
  iterationId?: string,
  /** Static paths (the LEAP parameter list) merged into the suggestions */
  knownPaths?: string[],
  className?: string,
  required?: boolean,
}) {
  const { t } = useTranslation(["forms", "common"]);

  const [segments, setSegments] = useState<string[]>(() => splitPath(value));
  // The last focused box; suggestions apply to this level. Sticky rather than
  // cleared on blur: the suggestion area keeps a constant footprint so focus
  // changes never shift the layout under an in-flight click elsewhere.
  const [stickyIndex, setStickyIndex] = useState<number | null>(null);

  const lastEmitted = useRef<string>(value);
  const pendingFocus = useRef<number | null>(null);
  const boxRefs = useRef<(HTMLInputElement | null)[]>([]);

  const joined = useMemo(() => joinPath(segments), [segments]);

  // Applies an edit and pushes the joined path up to the form in the same tick
  // (which feeds name placeholders, recipe suggestions...)
  function applySegments(next: string[]) {
    setSegments(next);
    const nextJoined = joinPath(next);
    if (nextJoined === lastEmitted.current) return;
    lastEmitted.current = nextJoined;
    setter(nextJoined);
  }

  // Re-split on external updates (e.g. the recipe section's "apply parameter" button)
  useEffect(() => {
    if (value === lastEmitted.current) return;
    lastEmitted.current = value;
    setSegments(splitPath(value));
  }, [value]);

  // Focus moves (next box on "/", split paste, Backspace-merge) land after the re-render
  useEffect(() => {
    if (pendingFocus.current === null) return;
    const box = boxRefs.current[pendingFocus.current];
    pendingFocus.current = null;
    box?.focus();
  });

  function handleChange(index: number, raw: string) {
    const next = [...segments];
    while (next.length <= index) next.push("");

    if (!separators.test(raw)) {
      next[index] = raw;
      applySegments(next);
      return;
    }

    // "/" or "\" typed or pasted: never kept as text
    const parts = raw.split(separators);
    const movedOn = parts[parts.length - 1] === "";
    const content = parts.filter(part => part.trim() !== "").map(part => part.trim());

    if (content.length > 1) {
      // A multi-segment paste replaces this box and everything after it
      next.splice(index, next.length - index, ...content);
    } else {
      next[index] = content[0] ?? "";
    }
    applySegments(next);

    if (content.length === 0) return; // Separators alone are stripped
    // A trailing separator commits the segment and moves on to the next box
    pendingFocus.current = index + content.length - (movedOn ? 0 : 1);
  }

  function handleBlur(index: number) {
    if (index >= segments.length) return;
    const trimmed = segments[index].trim();
    if (trimmed === segments[index] && trimmed !== "") return;
    const next = [...segments];
    // An emptied middle box drops its segment once left
    if (trimmed === "") next.splice(index, 1);
    else next[index] = trimmed;
    applySegments(next);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>, index: number) {
    if (event.key === "Enter") {
      // Enter walks to the next box rather than submitting
      event.preventDefault();
      boxRefs.current[Math.min(index + 1, segments.length)]?.focus();
      return;
    }
    if (event.key === "Backspace" && event.currentTarget.value === "" && index > 0) {
      event.preventDefault();
      if (index < segments.length) {
        const next = [...segments];
        next.splice(index, 1);
        applySegments(next);
        pendingFocus.current = index - 1;
      }
      boxRefs.current[index - 1]?.focus();
    }
  }

  // The target roadmap version's existing indicators, fetched once per version
  // on first focus (null = not loaded)
  const [iterationPaths, setIterationPaths] = useState<string[] | null>(null);
  const fetchedFor = useRef<string | null>(null);

  useEffect(() => {
    fetchedFor.current = null;
    setIterationPaths(null);
  }, [iterationId]);

  function ensureIterationPaths() {
    if (!iterationId || fetchedFor.current === iterationId) return;
    const requestedId = iterationId;
    fetchedFor.current = requestedId;
    clientSafeGetOneRoadmapIteration(requestedId)
      .then(iteration => {
        if (fetchedFor.current !== requestedId) return;
        setIterationPaths([...new Set((iteration?.goals ?? []).map(goal => goal.indicator_parameter))]);
      })
      .catch(() => {
        if (fetchedFor.current !== requestedId) return;
        setIterationPaths([]);
      });
  }

  const allPaths = useMemo(
    () => [...new Set([...(iterationPaths ?? []), ...(knownPaths ?? [])])],
    [iterationPaths, knownPaths],
  );
  // The box the suggestions apply to: the last focused one, the trailing box before any focus
  const suggestionIndex = Math.min(stickyIndex ?? segments.length, segments.length);
  const existingAtLevel = useMemo(() => {
    const existing = new Set<string>();
    const prefix = segments.slice(0, suggestionIndex).map(segment => segment.trim().toLowerCase()).filter(segment => segment !== "");
    for (const path of iterationPaths ?? []) {
      const parts = splitPath(path);
      if (parts.length <= prefix.length) continue;
      if (prefix.every((segment, index) => parts[index].toLowerCase() === segment)) {
        existing.add(parts[prefix.length]);
      }
    }
    return existing;
  }, [iterationPaths, segments, suggestionIndex]);
  const suggestions = useMemo(() => {
    // Children of the committed boxes before the suggestion level, filtered by what its box holds so far
    const prefix = segments.slice(0, suggestionIndex).map(segment => segment.trim().toLowerCase()).filter(segment => segment !== "");
    const typed = (segments[suggestionIndex] ?? "").trim().toLowerCase();
    const children = new Set<string>();
    for (const path of allPaths) {
      const parts = splitPath(path);
      if (parts.length <= prefix.length) continue;
      if (!prefix.every((segment, index) => parts[index].toLowerCase() === segment)) continue;
      const child = parts[prefix.length];
      if (child.toLowerCase().includes(typed)) children.add(child);
    }
    return [...children].sort((a, b) => a.localeCompare(b, "sv")).slice(0, 12);
  }, [allPaths, segments, suggestionIndex]);

  // One box per segment plus a trailing empty one; stable index keys keep the
  // trailing box focused while typing into it turns it into a real segment.
  const boxes = [...segments, ""];

  return (
    <div className={className}>
      <div className="flex flex-wrap-wrap align-items-center gap-25">
        {boxes.map((segment, index) => (
          // Boxes are positional; index keys are what keeps focus in place as segments grow
          <span key={index} className="flex align-items-center gap-25" style={{ flex: "1 1 10ch", minWidth: "10ch" }}>
            {index > 0 ? <span aria-hidden="true" style={{ color: "var(--gray-50)", userSelect: "none" }}>›</span> : null}
            <input
              type="text"
              id={index === 0 ? id : `${id}-segment-${index}`}
              ref={(element) => { boxRefs.current[index] = element; }}
              className="width-100"
              value={segment}
              required={!!required && index === 0}
              autoComplete="off"
              aria-label={t("forms:goal.indicator_segments.segment_label", { index: index + 1 })}
              placeholder={index === segments.length ? t("forms:goal.indicator_segments.add_placeholder") : undefined}
              data-testid={`indicator-segment-${index}`}
              onChange={(event) => handleChange(index, event.target.value)}
              onBlur={() => handleBlur(index)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              onFocus={() => { setStickyIndex(index); ensureIterationPaths(); }}
            />
          </span>
        ))}
      </div>
      {/* The stored format, exactly as the single text field used to submit it */}
      <input type="hidden" name={name} value={joined} data-testid="indicator-parameter-value" />

      {/* Always rendered at a constant height: appearing or collapsing with focus
          would shift the form under clicks aimed below it */}
      <div className="margin-top-25 padding-50 smooth" style={{ border: "1px solid var(--gray-80)" }}>
        <p className="margin-0 font-weight-bold" style={{ fontSize: ".75rem", color: "var(--gray-20)" }}>
          {t("forms:goal.indicator_segments.suggestions_title", { index: suggestionIndex + 1 })}
        </p>
        <div className="margin-top-25" style={{ height: "4.5rem", overflowY: "auto" }}>
          {suggestions.length > 0 ?
            <ul className="flex flex-wrap-wrap gap-25 margin-0 padding-0" style={{ listStyle: "none" }}>
              {suggestions.map((suggestion) => (
                <li key={suggestion}>
                  <button
                    type="button"
                    tabIndex={-1}
                    className="transparent smooth"
                    style={{ fontSize: ".75rem", padding: ".25rem .5rem", border: "1px solid var(--gray-80)", fontWeight: existingAtLevel.has(suggestion) ? "bold" : "normal" }}
                    title={existingAtLevel.has(suggestion) ? t("forms:goal.indicator_segments.exists_in_version") : undefined}
                    // Keep focus where it is so blur cleanup doesn't shift indices before the click lands
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      handleChange(suggestionIndex, suggestion);
                      pendingFocus.current = suggestionIndex + 1;
                    }}
                  >
                    {suggestion}
                  </button>
                </li>
              ))}
            </ul>
            : <p className="margin-0" style={{ fontSize: ".75rem", color: "var(--gray-50)" }}>
              {iterationId && iterationPaths === null && stickyIndex !== null
                ? t("forms:combobox.loading")
                : t("forms:goal.indicator_segments.no_suggestions")}
            </p>}
        </div>
      </div>
    </div>
  );
}
