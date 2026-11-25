import fs from "node:fs";
import path from "node:path";
import { expect, test } from "playwright/test";

/*
 * The rich-text editor only works while each ProseMirror package is loaded once.
 * The packages recognise each other's objects with `instanceof`, so two copies of
 * `prosemirror-model` in the bundle make the editor throw "Can not convert … to a
 * Fragment (looks like multiple versions of prosemirror-model were loaded)" on
 * whatever crosses between them: Enter with one layout, every keystroke and paste
 * with another.
 *
 * Yarn keeps an older resolution when a parent (`@tiptap/pm`) raises its range, and
 * the hoisting then decides which packages share a copy. So the lockfile is the
 * thing to guard. Fix a failure here with `yarn dedupe 'prosemirror-*' '@tiptap/*'`.
 */

/** Every version each package resolves to in `yarn.lock`, by package name */
function lockedVersions(): Map<string, Set<string>> {
  const lockfile = fs.readFileSync(path.join(process.cwd(), "yarn.lock"), "utf-8");
  const versions = new Map<string, Set<string>>();
  // An entry is a line of comma-separated descriptors (`name@npm:range`), quoted when needed, then its fields
  const entry = /^"?([^\s"#][^"\n]*)"?:\n {2}version: "?([^"\n]+)"?$/gm;
  for (const [, descriptors, version] of lockfile.matchAll(entry)) {
    for (const descriptor of descriptors.split(", ")) {
      // The name ends at the first "@" after a possible scope
      const name = descriptor.slice(0, descriptor.indexOf("@", 1));
      if (!versions.has(name)) versions.set(name, new Set());
      versions.get(name)?.add(version);
    }
  }
  return versions;
}

test.describe("Editor dependencies", () => {
  test("every ProseMirror and tiptap package resolves to a single version", () => {
    const editorPackages = [...lockedVersions()].filter(([name]) => name.startsWith("prosemirror-") || name.startsWith("@tiptap/"));
    // Guards the parsing: an empty list would pass the check below without checking anything
    expect(editorPackages.map(([name]) => name)).toEqual(expect.arrayContaining(["prosemirror-model", "prosemirror-view", "@tiptap/pm"]));

    const duplicated = Object.fromEntries(
      editorPackages
        .filter(([, versions]) => versions.size > 1)
        .map(([name, versions]) => [name, [...versions]]),
    );
    expect(duplicated, "run: yarn dedupe 'prosemirror-*' '@tiptap/*'").toEqual({});
  });
});
