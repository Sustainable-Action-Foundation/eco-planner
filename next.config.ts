import type { GlobalEnv } from "@/types";
import type { NextConfig } from "next";
import { execSync } from "node:child_process";
import packageJSON from "./package.json" with { type: "json" };

const { sha, dirty: dirtyTree } = getCommitHash();

const buildTimeEnv: GlobalEnv = {
  APP_VERSION: process.env.npm_package_version ?? "unknown",
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
