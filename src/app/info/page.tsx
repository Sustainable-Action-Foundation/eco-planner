import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import { buildMetadata } from "@/functions/buildMetadata";
import { env } from "node:process";
import serveTea from "@/lib/i18nServer";
// Uses TransWithoutContext, passing in our server-side i18n instance to the component,
// rather than using the base Trans component which would use a client-side i18n instance.
import { Trans } from "react-i18next/TransWithoutContext";
import i18next from "i18next";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
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

  return (
    <>
      <Breadcrumb customSections={[t("pages:info.breadcrumb")]} />

      <h1>{t("pages:info.title")}</h1>
      <p>{t("pages:info.info_body")}</p>

      {/* TODO: Link to wiki once created */}

      {/* Repo */}
      <p>
        <Trans
          i18nKey="pages:info.known_remote"
          components={{
            a: <a href={env.REMOTE_REPO_URL} target="_blank" />
          }}
          tOptions={{
            remote: env.REMOTE_REPO_URL
          }}
          i18n={i18next}
        />
      </p>

      {/* Version */}
      <p>{t("pages:info.version", { version: env.APP_VERSION })}</p>

      {/* Commit */}
      <p>
        {env.COMMIT_URL
          ? <Trans
            i18nKey="pages:info.commit_with_link"
            components={{ a: <a href={env.COMMIT_URL} target="_blank" /> }}
            tOptions={{ commit: env.COMMIT_SHA }}
            i18n={i18next}
          />
          : t("pages:info.commit_without_link", { commit: env.COMMIT_SHA })
        }
      </p>
    </>
  )
}