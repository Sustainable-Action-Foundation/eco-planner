import { execFileSync } from "node:child_process";

/**
 * CI guard that fails when a PR into `main` does not bump the package version.
 *
 * The head version comes from `process.env.npm_package_version`, which Yarn injects when this
 * script is run through `yarn check:version`. The base version is read from git (no tags) so
 * the two `package.json` versions can be compared directly.
 *
 * Run via: `yarn check:version`
 */

type SemverParts = {
  core: [number, number, number];
  prerelease: string[];
};

/** Parse a `major.minor.patch[-prerelease]` string, ignoring any build metadata (`+...`). */
function parseVersion(version: string): SemverParts | null {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(version.trim());
  if (!match) return null;

  return {
    core: [Number(match[1]), Number(match[2]), Number(match[3])],
    prerelease: match[4] ? match[4].split(".") : [],
  };
}

/** Compare two prerelease identifier lists per semver precedence rules. Returns -1, 0, or 1. */
function comparePrerelease(a: string[], b: string[]): number {
  // A version with no prerelease outranks one that has a prerelease (1.0.0 > 1.0.0-rc).
  if (a.length === 0 && b.length === 0) return 0;
  if (a.length === 0) return 1;
  if (b.length === 0) return -1;

  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const idA = a[i];
    const idB = b[i];
    const numA = /^\d+$/.test(idA) ? Number(idA) : null;
    const numB = /^\d+$/.test(idB) ? Number(idB) : null;

    if (numA !== null && numB !== null) {
      if (numA !== numB) return numA < numB ? -1 : 1;
    } else if (numA !== null) {
      return -1; // numeric identifiers have lower precedence than alphanumeric
    } else if (numB !== null) {
      return 1;
    } else if (idA !== idB) {
      return idA < idB ? -1 : 1;
    }
  }

  // All shared identifiers equal: the longer list has higher precedence.
  if (a.length === b.length) return 0;
  return a.length < b.length ? -1 : 1;
}

/** Returns true when `head` is strictly greater than `base` per semver precedence. */
function isGreater(head: SemverParts, base: SemverParts): boolean {
  for (let i = 0; i < 3; i++) {
    if (head.core[i] !== base.core[i]) return head.core[i] > base.core[i];
  }
  return comparePrerelease(head.prerelease, base.prerelease) > 0;
}

function fail(message: string): never {
  console.error(`::error::${message}`);
  process.exit(1);
}

const headRaw = process.env.npm_package_version;
if (!headRaw) {
  fail("npm_package_version is not set — run this script through yarn (e.g. `yarn check:version`).");
}

const baseRef = process.env.GITHUB_BASE_REF || "main";

let baseRaw: string;
try {
  const basePackageJson = execFileSync("git", ["show", `origin/${baseRef}:package.json`], { encoding: "utf8" });
  baseRaw = (JSON.parse(basePackageJson) as { version: string }).version;
}
catch (err) {
  fail(`Could not read package.json version from origin/${baseRef}: ${err instanceof Error ? err.message : String(err)}`);
}

const head = parseVersion(headRaw);
const base = parseVersion(baseRaw);

if (!head) fail(`Could not parse the PR package.json version: "${headRaw}".`);
if (!base) fail(`Could not parse the base (origin/${baseRef}) package.json version: "${baseRaw}".`);

if (!isGreater(head, base)) {
  fail(
    `package.json version (${headRaw}) must be greater than the version on ${baseRef} (${baseRaw}). ` +
    "Bump the version before merging.",
  );
}

console.log(`✅ version bumped: ${baseRaw} -> ${headRaw}`);
