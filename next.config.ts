import type { GlobalEnv } from "@/types";
import type { NextConfig } from "next";
import { execSync } from "node:child_process";
import packageJSON from "./package.json" with { type: "json" };

const { sha, dirty: dirtyTree } = getCommitHash();
const commitsAhead = getCommitsAhead();

const buildTimeEnv: GlobalEnv = {
  // Version bumps are informal, so commits since the last bump ("+N", semver build
  // metadata shape) supply the real granularity between bumps
  APP_VERSION: (process.env.npm_package_version ?? "unknown") + (commitsAhead ? `+${commitsAhead}` : ""),
  COMMIT_SHA: sha,
  COMMIT_URL: dirtyTree ? undefined : new URL(`commit/${sha}`, packageJSON.homepage).toString(),
  REMOTE_REPO_URL: packageJSON.homepage,
} as const;

const nextConfig: NextConfig = {
  devIndicators: {
    position: "bottom-right",
  },
  env: buildTimeEnv,
  ...(process.env.NODE_ENV === "production" ? {
    compiler: {
      removeConsole: {
        exclude: ["info", "error", "warn"],
      },
    },
  } : {}),
  output: process.env.CI ? "standalone" : undefined,
  experimental: {
    useCache: true,
  },
};

export default nextConfig;

function getCommitHash(): { sha: string, dirty: boolean } {
  const hashInfo: { sha: string; dirty: boolean; } = {
    sha: process.env.COMMIT_SHA,
    dirty: false,
  };

  if (hashInfo.sha) {
    console.info(`Commit hash found in environment variable: (${hashInfo.sha})`);
    return hashInfo;
  }

  // Try getting commit hashes via git cli
  try {
    const headCommit = execSync("git rev-parse HEAD")?.toString().trim();
    const cleanStatus = !execSync("git status --porcelain")?.toString().trim();

    if (!cleanStatus) {
      hashInfo.sha = `dirty-${headCommit}`;
      hashInfo.dirty = true;
    }
    else {
      hashInfo.sha = headCommit;
    }
  }
  catch (err) {
    console.warn("Failed to get commit hashes", { err });
  }

  if (!hashInfo.sha) {
    console.warn("No commit hash found, using 'unknown'");
    hashInfo.sha = "unknown";
    hashInfo.dirty = true;
  }

  return hashInfo;
}

function getCommitsAhead(): string | undefined {
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
