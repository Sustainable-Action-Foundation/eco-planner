// NOTE: Guest invites are DISABLED until further notice, so invite links dead-end
// in a 404. The full page is preserved, line-commented, at the bottom of this
// file; restore it (grep "disabled until further notice") to bring it back.
import { notFound } from "next/navigation";

export default function Page() {
  notFound();
}

// ===========================================================================
// Original implementation (disabled until further notice)
// ===========================================================================
// import { getGuestInvite } from "@/fetchers";
// import AcceptInvite from "@/components/pages/acceptInvite";
// import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
// import { getSession } from "@/lib/session";
// import serveTea from "@/lib/i18nServer";
// import { buildMetadata } from "@/functions/buildMetadata";
// import { cookies } from "next/headers";
// import Link from "next/link";
// import { notFound } from "next/navigation";
// import type { Metadata } from "next";
//
// export async function generateMetadata(): Promise<Metadata> {
//   const t = await serveTea("metadata");
//   return await buildMetadata({
//     title: t("metadata:invite.title"),
//     description: undefined,
//     og_url: undefined,
//     og_image_url: undefined,
//   });
// }
//
// export default async function Page(props: { params: Promise<{ inviteToken: string }> }) {
//   const params = await props.params;
//   const [t, session, invite] = await Promise.all([
//     serveTea(["pages", "common"]),
//     getSession(await cookies()),
//     getGuestInvite(params.inviteToken),
//   ]);
//
//   // Accepted, revoked, or made up: pending invites are the only ones that exist
//   if (!invite) {
//     notFound();
//   }
//
//   return (
//     <>
//       <Breadcrumb customSections={[t("pages:invite.title")]} />
//
//       <main className="padding-bottom-500" style={{ maxWidth: '40rem' }}>
//         <h1 className="margin-block-300">{t("pages:invite.heading", { org: invite.orgName })}</h1>
//         <p>{t("pages:invite.description", { org: invite.orgName, email: invite.email })}</p>
//
//         {session.user?.isLoggedIn ? (
//           <AcceptInvite token={invite.token} orgName={invite.orgName} />
//         ) : (
//           <>
//             <p>{t("pages:invite.login_prompt")}</p>
//             <div className="flex gap-50 flex-wrap-wrap margin-top-100">
//               <Link href={`/login?from=/invite/${invite.token}`} className="button seagreen color-purewhite round font-weight-500">
//                 {t("pages:invite.login_link")}
//               </Link>
//               <Link href="/signup" className="button round">
//                 {t("pages:invite.signup_link")}
//               </Link>
//             </div>
//             <p className="margin-top-100 color-gray">{t("pages:invite.signup_hint")}</p>
//           </>
//         )}
//       </main>
//     </>
//   );
// }
