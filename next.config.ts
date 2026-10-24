import type { GlobalEnv } from "@/types";
import type { NextConfig } from "next";
import { execSync } from "node:child_process";
import path from "node:path";
import packageJSON from "./package.json" with { type: "json" };
import { getCommitsAhead } from "@root/scripts/checkCommitsAhead";

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
  cacheComponents: true,
  // Size of the in-memory LRU behind 'use cache' (Next's default handler; an entry counts the bytes
  // of its serialized value plus its key). The default 50 MB is too small for this app: DB entries
  // are per user (the access context is part of the key) and one big roadmap version with its
  // goals' series is ~6.7 MB per user (fat seed, 531 goals), so a few users opening a few big
  // roadmaps evicted everything else, org landings included (~0.15 MB per user and org). 256 MB
  // holds ~35 such roadmap entries next to the small ones.
  cacheMaxMemorySize: 256 * 1024 * 1024,
  cacheHandlers: {
    // `'use cache: upstream'`: external statistics persisted on disk across restarts (SAF_CACHE_DIR)
    upstream: path.resolve("src/lib/cache/upstreamCacheHandler.mjs"),
  },
  experimental: {
    // The proxy buffers request bodies and silently truncates them past this; must stay
    // above MaxAttachmentBytes (src/functions/attachments.ts) plus multipart overhead
    proxyClientMaxBodySize: "27mb",
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
