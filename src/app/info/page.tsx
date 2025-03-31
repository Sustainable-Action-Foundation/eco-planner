import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import { t } from "@/lib/i18nServer";
import { JSONValue } from "@/types.ts";
import fs from "fs";
import metadata from "package.json" with { type: "json" };
import { Trans } from "react-i18next";

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

  let remoteURL: URL | null = null;
  let commitURL: URL | null = null;
  let version: string | null = null;
  try {
    // Try to get repository url from package.json
    if (metadata.homepage) {
      let repo = metadata.homepage.replace(".git", "");
      if (!repo.endsWith("/")) {
        repo += "/";
      }
      remoteURL = new URL(repo);
    }

    // Try to get version from package.json
    if (metadata.version) {
      version = metadata.version;
    }
  } catch { /* Silently fail */ }

  if ((gitHash.shortHash || gitHash.longHash) && remoteURL) {
    commitURL = new URL(`commit/${gitHash.longHash || gitHash.shortHash}`, remoteURL)
  }

  return (
    <>
      <Breadcrumb customSections={[t("pages:info.breadcrumb")]} />

      <h1>{t("pages:info.title")}</h1>
      <p>
        {t("pages:info.info_body")}
      </p>

      {/* TODO: Add wiki once created */}

      <p>
        {remoteURL ?
          <Trans
            i18nKey="pages:info.known_remote"
            components={{
              a: <a href={remoteURL.href} target="_blank" />
            }}
            tOptions={{
              remote: remoteURL.pathname.split("/")[remoteURL.pathname.split("/").length - 2] || remoteURL.hostname
            }}
          />
          :
          <Trans
            i18nKey="pages:info.fallback_remote"
            components={{
              a: <a href="https://github.com/Sustainable-Action-Foundation/eco-planner" target="_blank" />,
            }}
          />
        }
      </p>

      {
        version
          ? <p>{t("pages:info.version", { version: version })}</p>
          : null
      }

      {
        gitHash.shortHash || gitHash.longHash
          ? commitURL
            ? <Trans
              i18nKey="pages.info.commit_with_link"
              components={{
                a: <a href={commitURL.href} target="_blank" />
              }}
              tOptions={{
                commit: gitHash.shortHash || gitHash.longHash
              }}
            />
            :
            <p>{t("pages.info.commit_without_link", { commit: gitHash.shortHash || gitHash.longHash })}</p>
          : null
      }
    </>
  )
}