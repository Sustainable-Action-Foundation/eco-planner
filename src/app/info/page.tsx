import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import { JSONValue } from "@/types.ts";
import fs from "fs";
import metadata from "package.json" with { type: "json" };
import { t } from "@/lib/i18nServer";
import { CommitWithLink, FallbackRemote, Intro, KnownRemote } from "@/components/info/appMetaInfo";

export default async function Page() {
  const gitHash = { shortHash: process.env.GIT_SHORT_HASH, longHash: process.env.GIT_LONG_HASH };

  // If hash is not set in env, try to get it from file
  if (!gitHash.shortHash && !gitHash.longHash) {
    try {
      if (fs.existsSync("src/lib/commitHash.json")) {
        const parsedVersion: JSONValue = JSON.parse(fs.readFileSync("src/lib/commitHash.json", "utf-8"));

        // Set hashes if they are properly formatted
        if (parsedVersion instanceof Object && !(parsedVersion instanceof Array)) {
          if (typeof parsedVersion.shortHash === "string") {
            gitHash.shortHash = parsedVersion?.shortHash;
          }
          if (typeof parsedVersion.longHash === "string") {
            gitHash.longHash = parsedVersion?.longHash;
          }
        }
      }
    } catch { /* Silently fail */ }
  }

  let remoteURL: string | null = null;
  let commitURL: string | null = null;
  let version: string | null = null;
  try {
    // Try to get repository url from package.json
    if (metadata.homepage) {
      let repo = metadata.homepage.replace(".git", "");
      if (!repo.endsWith("/")) {
        repo += "/";
      }
      remoteURL = new URL(repo).toString();
    }

    // Try to get version from package.json
    if (metadata.version) {
      version = metadata.version;
    }
  } catch { /* Silently fail */ }

  if ((gitHash.shortHash || gitHash.longHash) && remoteURL) {
    commitURL = new URL(`commit/${gitHash.longHash || gitHash.shortHash}`, remoteURL).toString();
  }

  return (
    <>
      <Breadcrumb customSections={[t("pages:info.breadcrumb")]} />

      {/* This is static but the above code seems to be messing with the translations and make them disappear sometimes. The below component is client side */}
      <Intro />

      {/* TODO: Add wiki once created */}

      <p>
        {remoteURL ?
          <KnownRemote remoteURL={remoteURL} />
          :
          <FallbackRemote />
        }
      </p>

      {version ?
        <p>{t("pages:info.version", { version: version })}</p>
        :
        null
      }

      {gitHash.shortHash || gitHash.longHash
        ? commitURL
          ?
          <p><CommitWithLink commitURL={commitURL} gitHash={gitHash.shortHash || gitHash.longHash || ""} /></p>
          :
          <p>{t("pages.info.commit_without_link", { commit: gitHash.shortHash || gitHash.longHash || "" })}</p>
        : null
      }
    </>
  )
}