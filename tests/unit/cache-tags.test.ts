import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { cwd } from "node:process";
import { expect, test } from "playwright/test";

/*
 * Static check of the reader rules in caching.md ("A new cached DB reader must", rule 4):
 * a `'use cache'` reader declares a tag for every entity whose rows it returns or filters by.
 * A reader that misses one serves its entry for minutes after the write that should have
 * expired it (revoked sharing still readable, an old org name, ...), and nothing fails.
 *
 * The check reads the source of every cached reader in src/fetchers together with the
 * selections and helpers it uses, and looks for what each rule keys on. It is textual on
 * purpose: when it reports a tag the reader really does not need, tighten the rule's
 * pattern here instead of declaring a tag nobody needs.
 */

const fetchersDir = path.join(cwd(), "src/fetchers");

type Rule = { tags: string[], why: string, pattern: RegExp };

const rules: Rule[] = [
  { tags: ["roadmap", "roadmapIteration"], why: "filters by visibility (roadmap access and version status)", pattern: /\b(visible\w+WHERE|readableAccessControlWHERE|listed\w+WHERE|publishedIterationsOfTypeWHERE)\(/ },
  { tags: ["goal", "action"], why: "series visibility is derived from the goal or effect (action + goal) the series belongs to", pattern: /\bvisibleDataSeriesWHERE\(/ },
  { tags: ["org"], why: "returns an org's name or area", pattern: /\borg:\s*\{\s*select:\s*\{[^}]*\bname:\s*true|\bprisma\.orgs\./ },
  // Only readers that query users directly. A nested `author: { select: ... }` (a byline) is deliberately
  // untagged: caching.md, "Author names (bylines) are not tagged"
  { tags: ["user"], why: "reads users directly (a profile)", pattern: /\bprisma\.users\./ },
  { tags: ["dataSeries"], why: "returns series values or recipes", pattern: /\bvalues:\s|\brecipe:\s*true|\bsource_data_series\b|\bprisma\.(dataSeries|recipes)\./ },
  { tags: ["goal"], why: "returns goals, their ids or their count", pattern: /\bgoals?:\s*\{|\bprisma\.goals\./ },
  { tags: ["action"], why: "returns actions, their fields, ids or count", pattern: /\bactions?:\s*(\{|true)|\bprisma\.(actions|actionFields)\./ },
  { tags: ["goal", "action"], why: "returns effects, which sit between an action and a goal", pattern: /\beffects:\s|\bprisma\.effects\./ },
  { tags: ["goalLike"], why: "returns likes", pattern: /\blikes:\s/ },
  { tags: ["roadmap"], why: "returns roadmaps", pattern: /\bprisma\.roadmaps\./ },
  { tags: ["roadmapIteration"], why: "returns roadmap versions", pattern: /\biterations:\s|\bprisma\.roadmapIterations\./ },
];

/** Source without comments, so prose never trips a rule */
function code(file: string): string {
  return readFileSync(path.join(fetchersDir, file), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1");
}

/** The top-level declarations of a file by name: each runs until the next one starts */
function declarations(source: string): Map<string, string> {
  const starts = Array.from(source.matchAll(/^(?:export )?(?:async )?(?:function|const|type) (\w+)/gm));
  return new Map(starts.map((match, index) => [match[1], source.slice(match.index, starts.at(index + 1)?.index)]));
}

/** `text` plus every declaration it mentions, transitively */
function withDependencies(name: string, pool: Map<string, string>): string {
  const seen = new Set([name]);
  const queue = [pool.get(name) ?? ""];
  for (const text of queue) {
    for (const [other, body] of pool) {
      if (!seen.has(other) && new RegExp(`\\b${other}\\b`).test(text)) {
        seen.add(other);
        queue.push(body);
      }
    }
  }
  return queue.join("\n");
}

type Reader = { name: string, file: string, declared: string[], source: string };

function cachedReaders(): Reader[] {
  const selections = declarations(code("inclusionSelectors.ts"));
  return readdirSync(fetchersDir).filter(file => file.endsWith(".ts") && file !== "inclusionSelectors.ts").flatMap(file => {
    const own = declarations(code(file));
    const pool = new Map([...selections, ...own]);
    // The database readers only: `'use cache: upstream'` readers hold external statistics, tagged per source
    return [...own].filter(([, body]) => /['"]use cache['"];/.test(body)).map(([name, body]) => ({
      name,
      file,
      declared: Array.from((body.match(/\bcacheTag\(([^)]*)\)/)?.[1] ?? "").matchAll(/['"]([^'"]+)['"]/g), match => match[1]),
      source: withDependencies(name, pool),
    }));
  });
}

test("every cached database reader is found", () => {
  const readers = cachedReaders();
  // A floor, not a count to maintain: an empty or halved list means the scan broke, not that readers were removed
  expect(readers.length).toBeGreaterThan(25);
  for (const reader of readers) {
    expect(reader.declared, `${reader.name} (${reader.file}) declares tags`).not.toEqual([]);
  }
});

test("a cached reader declares a tag for every entity it returns or filters by", () => {
  const missing = cachedReaders().flatMap(reader => rules
    .filter(rule => rule.pattern.test(reader.source))
    .flatMap(rule => rule.tags.filter(tag => !reader.declared.includes(tag)).map(tag => `${reader.name} (${reader.file}) ${rule.why}: declare '${tag}'`)));
  expect([...new Set(missing)]).toEqual([]);
});

test("the rules notice a reader that leaves a tag out", () => {
  // The shapes behind the stale-cache findings: an access filter without the roadmap tags, an org name without `org`
  const filtered = "where: { id, roadmap_iteration: visibleRoadmapIterationsWHERE(accessContext) }";
  const named = "select: { access_control: { select: { sharing: true, org: { select: { name: true } } } } }";
  const required = (source: string) => [...new Set(rules.filter(rule => rule.pattern.test(source)).flatMap(rule => rule.tags))].sort();
  expect(required(filtered)).toEqual(["roadmap", "roadmapIteration"]);
  expect(required(named)).toEqual(["org"]);
  // A byline does not ask for `user`; a direct read of users does
  expect(required("author: { select: { id: true, first_name: true } }, data_series: { select: { values: { orderBy: {} } } }")).toEqual(["dataSeries"]);
  expect(required("prisma.users.findUnique({ where: { username_lower } })")).toEqual(["user"]);
});
