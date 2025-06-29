import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import { buildMetadata } from "@/functions/buildMetadata";
import { JSONValue } from "@/types.ts";
import fs from "fs";
import metadata from "package.json" with { type: "json" };
import serveTea from "@/lib/i18nServer";
// Uses TransWithoutContext, passing in our server-side i18n instance to the component,
// rather than using the base Trans component which would use a client-side i18n instance.
import { Trans } from "react-i18next/TransWithoutContext";
import i18next from "i18next";
import { PopoverButton, Popover } from "@/components/generic/popovers/popovers";
import { IconCirclePlus, IconX, IconPlus } from "@tabler/icons-react";
import Link from "next/link";

export async function generateMetadata() {
  const t = await serveTea("pages");

  return buildMetadata({
    title: t("pages:info.title"),
    description: t("pages:info.info_body"),
    og_url: `/info`,
    og_image_url: undefined,
  })
}

export default async function Page() {
  const t = await serveTea("pages");
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

  const remoteURLObject = remoteURL ? new URL(remoteURL) : undefined;
  const remoteURLString = remoteURLObject ? `${remoteURLObject.hostname}${remoteURLObject.pathname}` : null;

  return (
    <>
      <Breadcrumb customSections={[t("pages:info.breadcrumb")]} />

      <h1>{t("pages:info.title")}</h1>

      <p>{t("pages:info.info_body")}</p>

      {/* TODO: Link to wiki once created */}

      <p>
        {remoteURL ?
          <Trans
            i18nKey="pages:info.known_remote"
            components={{
              a: <a href={remoteURL} target="_blank" />
            }}
            tOptions={{
              remote: remoteURLString
            }}
            i18n={i18next}
          />
          :
          <Trans
            i18nKey="pages:info.fallback_remote"
            components={{
              a: <a href="https://github.com/Sustainable-Action-Foundation/eco-planner" target="_blank" />,
            }}
            i18n={i18next}
          />
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
          <p>
            <Trans
              i18nKey="pages:info.commit_with_link"
              components={{
                a: <a href={commitURL} target="_blank" />
              }}
              tOptions={{
                commit: gitHash.shortHash || gitHash.longHash || "",
              }}
              i18n={i18next}
            />
          </p>
          :
          <p>{t("pages:info.commit_without_link", { commit: gitHash.shortHash || gitHash.longHash || "" })}</p>
        : null
      }
      <PopoverButton
        anchorName='--test-popover-button'
        popoverTarget='test-popover'
        className='transparent rounded flex align-items-center gap-25'
        style={{ fontSize: '1rem', marginLeft: '10rem' }}
      >
        <IconCirclePlus aria-hidden="true" />
        test
      </PopoverButton>
      <Popover
        id='test-popover'
        popover='auto'
        positionAnchor='--test-popover-button'
        anchorInlinePosition='start'
        popoverDirection={{ vertical: 'down' }}
        margin={{right: '1rem'}}
        indicator={false}
      >
        <nav className='padding-25 smooth' style={{ backgroundColor: 'white', border: '1px solid silver' }}>
          <header
            className='padding-bottom-50 margin-bottom-25 margin-inline-25 flex gap-300 justify-content-space-between align-items-center'
            style={{ borderBottom: '1px solid var(--gray)' }}
          >
            <h2 className='font-weight-600 margin-0' style={{ fontSize: 'inherit' }}>{t("components:sidebar.create")}</h2>
            <button popoverTarget='test-popover' aria-label={t("components:sidebar.close_menu_create")} className='transparent grid padding-25 round'>
              <IconX aria-hidden='true' width={16} height={16} />
            </button>
          </header>
          <ul className='padding-0 margin-0' style={{ listStyle: 'none' }}>
            <li>
              <Link href='/metaRoadmap/create' className='text-transform-capitalize flex align-items-center justify-content-space-between gap-300 padding-25 smooth color-pureblack text-decoration-none'>
                {t("common:roadmap_series_one")}
                <IconPlus width={16} height={16} />
              </Link>
            </li>
            <li>
              <Link href='/roadmap/create' className='text-transform-capitalize flex align-items-center justify-content-space-between gap-300 padding-25 smooth color-pureblack text-decoration-none'>
                {t("common:roadmap_short_one")}
                <IconPlus width={16} height={16} />
              </Link>
            </li>
            <li>
              <Link href='/goal/create' className='text-transform-capitalize flex align-items-center justify-content-space-between gap-300 padding-25 smooth color-pureblack text-decoration-none'>
                {t("common:goal_one")}
                <IconPlus width={16} height={16} />
              </Link>
            </li>
            <li>
              <Link href='/action/create' className='text-transform-capitalize flex align-items-center justify-content-space-between gap-300 padding-25 smooth color-pureblack text-decoration-none'>
                {t("common:action_one")}
                <IconPlus width={16} height={16} />
              </Link>
            </li>
            <li>
              <Link href='/effect/create' className='text-transform-capitalize flex align-items-center justify-content-space-between gap-300 padding-25 smooth color-pureblack text-decoration-none'>
                {t("common:effect_one")}
                <IconPlus width={16} height={16} />
              </Link>
            </li>
          </ul>
        </nav>
      </Popover>
    </>
  )
}