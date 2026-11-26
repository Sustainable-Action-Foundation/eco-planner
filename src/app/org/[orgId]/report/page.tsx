import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import OrgReport from "@/components/pages/orgReport/orgReport";
import PrintButton from "@/components/pages/orgReport/printButton";
import styles from "@/components/pages/orgReport/orgReport.module.css";
import { getOrgProfile, getRoadmaps } from "@/fetchers";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import { buildMetadata } from "@/functions/buildMetadata";
import { OrgView, orgLandingPath, resolveOrgView } from "@/functions/orgLanding";
import { orgReportPath, reportUnlistedParam } from "@/functions/orgReport";
import accessChecker, { hasViewAccess, writesInOrg } from "@/lib/accessChecker";
import serveTea from "@/lib/i18nServer";
import { isRoadmapListed } from "@/lib/listing";
import { HiddenRoadmaps } from "@/types/enums";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";

type Props = {
  params: Promise<{ orgId: string }>,
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>,
};

export async function generateMetadata(props: Props): Promise<Metadata> {
  const [t, params] = await Promise.all([serveTea("metadata"), props.params]);
  const org = await getOrgProfile(params.orgId);
  return await buildMetadata({
    // The browser suggests the page title as the PDF's file name
    title: org ? t("metadata:org_report.title", { name: org.name }) : undefined,
    description: org?.description,
    og_url: `/org/${params.orgId}/report`,
    og_image_url: undefined,
  });
}

/**
 * An org's report: its whole content as one printable document (the browser's print dialog
 * saves it as a PDF). Open to anyone, like the org's landing, and like it shows what the
 * viewer may read: `?view=public` gives those entitled to the working view the version a
 * visitor without a login gets, `?unlisted=true` adds the unlisted goals they can edit.
 */
export default async function Page(props: Props) {
  // Rendered per request, never ahead of time: the document carries the moment it was exported
  const [params, searchParams] = await Promise.all([props.params, props.searchParams, connection()]);
  const [t, org, accessContext, allRoadmaps] = await Promise.all([
    serveTea(["pages", "common"]),
    getOrgProfile(params.orgId),
    getUserAccessContext(),
    // As on the landing: who may work in the org is decided from the hidden roadmaps too
    getRoadmaps(HiddenRoadmaps.Writable),
  ]);
  if (!org) {
    notFound();
  }

  // The same two views as the landing: those who can write in the org get everything they
  // may read, and can ask for the public version; everyone else just gets what they may read
  const entitled = writesInOrg(accessContext, org.id, allRoadmaps);
  const asVisitor = entitled && resolveOrgView(searchParams, entitled) === OrgView.Public;
  const viewerContext = asVisitor ? null : accessContext;
  const includeUnlisted = entitled && !asVisitor && searchParams[reportUnlistedParam] === "true";
  const roadmaps = allRoadmaps.filter(roadmap => {
    const accessLevel = accessChecker(roadmap, viewerContext);
    return roadmap.access_control.org_id === org.id && hasViewAccess(accessLevel) && isRoadmapListed(roadmap, accessLevel, HiddenRoadmaps.Exclude);
  });

  const pill = (active: boolean) => `button round smooth font-size-14px${active ? " seagreen color-purewhite font-weight-500" : ""}`;

  return <>
    <Breadcrumb customSections={[{ link: orgLandingPath(org.id), linkText: org.name }, t("pages:org_report.toolbar.title")]} />

    <main>
      <div className={styles.screenOnly} data-testid="org-report-toolbar">
        <div className={styles.toolbar}>
          <div>
            <p className="font-weight-600 font-size-125">{t("pages:org_report.toolbar.title")}</p>
            <p className="color-gray">{t("pages:org_report.toolbar.hint")}</p>
          </div>
          <PrintButton />
        </div>

        {entitled ?
          <div className={styles.options}>
            <nav className="flex gap-50 flex-wrap-wrap" aria-label={t("pages:org_report.toolbar.version_label")} data-testid="org-report-versions">
              <Link href={orgReportPath(org.id, { unlisted: includeUnlisted })} prefetch={false} aria-current={asVisitor ? undefined : "page"} className={pill(!asVisitor)} data-view={OrgView.Working}>
                {t("pages:org_report.toolbar.viewer_version")}
              </Link>
              <Link href={orgReportPath(org.id, { view: OrgView.Public })} prefetch={false} aria-current={asVisitor ? "page" : undefined} className={pill(asVisitor)} data-view={OrgView.Public}>
                {t("pages:org_report.toolbar.public_version")}
              </Link>
            </nav>
            {asVisitor ? null :
              <Link
                href={orgReportPath(org.id, { unlisted: !includeUnlisted })}
                prefetch={false}
                className={pill(includeUnlisted)}
                data-testid="org-report-unlisted"
              >
                {includeUnlisted ? t("pages:org_report.toolbar.unlisted_on") : t("pages:org_report.toolbar.unlisted_off")}
              </Link>}
            <small className="color-gray">
              {asVisitor ? t("pages:org_report.toolbar.public_note") : t("pages:org_report.toolbar.viewer_note")}
            </small>
          </div>
          : null}
      </div>

      <div className={styles.frame}>
        {/* Without a login the viewer's version is the public one */}
        <OrgReport org={org} roadmaps={roadmaps} asVisitor={asVisitor || !accessContext} includeUnlisted={includeUnlisted} exportedAt={new Date()} />
      </div>
    </main>
  </>;
}
