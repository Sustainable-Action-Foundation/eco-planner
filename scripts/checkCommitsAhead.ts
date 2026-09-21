import { execSync } from "node:child_process";

export function getCommitsAhead(): string | undefined {
  // CI passes the count in, since the docker build only sees a shallow checkout
  if (process.env.COMMITS_AHEAD) {
    return /^[1-9]\d*$/.test(process.env.COMMITS_AHEAD) ? process.env.COMMITS_AHEAD : undefined;
  }

  try {
    // -G limits to commits touching the version line, so dep bumps in package.json don't reset the count
    const bumpCommit = execSync(`git log -1 --format=%H -G'"version":' -- package.json`)?.toString().trim();
    if (!bumpCommit) return undefined;

    const count = execSync(`git rev-list --count ${bumpCommit}..HEAD`)?.toString().trim();
    return count && count !== "0" ? count : undefined;
  }
  catch (err) {
    console.warn("Failed to count commits since last version bump", { err });
    return undefined;
  }
}

// If this file is run by itself, print the count to stdout for use in shell scripts
if (import.meta.main) {
  const commitsAhead = getCommitsAhead();
  if (commitsAhead) {
    console.log(`+${commitsAhead}`);
    process.exit(0);
  }
}