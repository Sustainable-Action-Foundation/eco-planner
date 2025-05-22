"use client";

import { Trans, useTranslation } from "react-i18next";

export function Intro() {
  const { t } = useTranslation("pages");
  return (<>
    <h1>{t("pages:info.title")}</h1>
    <p>
      {t("pages:info.info_body")}
    </p>
  </>);
}

export function KnownRemote({ remoteURL }: { remoteURL: string }) {
  const url = new URL(remoteURL);
  return (
    <Trans
      i18nKey="pages:info.known_remote"
      components={{
        a: <a href={remoteURL} target="_blank" />
      }}
      tOptions={{
        remote: `${url.hostname}${url.pathname}`
      }}
    />
  );
}

export function FallbackRemote() {
  return (
    <Trans
      i18nKey="pages:info.fallback_remote"
      components={{
        a: <a href="https://github.com/Sustainable-Action-Foundation/eco-planner" target="_blank" />,
      }}
    />
  );
}

export function CommitWithLink({ commitURL, gitHash }: { commitURL: string, gitHash: string }) {
  return (
    <Trans
      i18nKey="pages:info.commit_with_link"
      components={{
        a: <a href={commitURL} target="_blank" />
      }}
      tOptions={{
        commit: gitHash,
      }}
    />
  );
}