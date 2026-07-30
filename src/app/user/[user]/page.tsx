import GraphCookie from '@/components/cookies/graphCookie';
import UserFilters from '@/components/form/filters/userFilters';
import { ControlsMenu } from '@/components/elements/controls/controls';
import accessChecker, { hasEditAccess } from '@/lib/accessChecker';
import { getSession } from '@/lib/session';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import styles from './page.module.css' with { type: "css" };
import serveTea from "@/lib/i18nServer";
import { buildMetadata } from '@/functions/buildMetadata';
import Link from 'next/link';
import { iterationPath } from '@/functions/versionSlug';
import { getRoadmapIterations, getRoadmaps, getUserInfo } from "@/fetchers";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import type { Metadata } from "next";

export async function generateMetadata(props: {
  params: Promise<{ user: string }>,
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
},
): Promise<Metadata> {
  const params = await props.params;
  let username = params.user;
  const userIndicatorRegEx = /^(@|%40)/;
  if (username?.match(userIndicatorRegEx)) {
    username = username?.replace(userIndicatorRegEx, '');
  }

  return buildMetadata({
    title: `@${username}`,
    description: undefined, // TODO: Should be like a bio or something
    og_url: `/user/${username}`,
    og_image_url: undefined,
  });
}

export default async function Page(
  props: {
    params: Promise<{ user: string }>,
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
  },
) {
  const [t, params, searchParams] = await Promise.all([
    serveTea(["pages", "common"]),
    props.params,
    props.searchParams,
  ]);

  let username = params.user;

  /** Matches strings starting with @ or %40 (URL-encoded @) */
  const userIndicatorRegEx = /^(@|%40)/;
  if (username?.match(userIndicatorRegEx)) {
    username = username?.replace(userIndicatorRegEx, '');
  }

  const [session, accessContext, userdata] = await Promise.all([
    getSession(await cookies()),
    getUserAccessContext(),
    getUserInfo(username),
  ]);

  // 404 if the user doesn't exist
  if (!userdata) {
    return notFound();
  }

  // If user is on their own page, also get all roadmaps/iterations they have edit access to
  const [iterations, roadmaps] = await Promise.all([
    (session.user?.username === username) ? getRoadmapIterations() : [],
    (session.user?.username === username) ? getRoadmaps() : [],
  ]);

  const editableRoadmaps = roadmaps.filter(roadmap => hasEditAccess(accessChecker(roadmap, accessContext)));
  const editableIterations = iterations.filter(iteration => hasEditAccess(accessChecker({ access_control: iteration.roadmap.access_control, published_at: iteration.published_at }, accessContext)));

  // Get query params for filtering
  const objectsFilter = searchParams['objects'] ? (Array.isArray(searchParams['objects']) ? searchParams['objects'] : [searchParams['objects']]) : [];
  const accessFilter = searchParams['access'] ? (Array.isArray(searchParams['access']) ? searchParams['access'] : [searchParams['access']]) : [];

  // Update values based on query params
  let displayedRoadmaps: typeof roadmaps = [];
  let displayedIterations: typeof iterations = [];
  function toggleRoadmaps() {

    if (!userdata) {
      return;
    }

    if (objectsFilter.length < 1) {
      if (accessFilter.includes('edit') && session.user?.username === username) {
        displayedRoadmaps = editableRoadmaps;
        displayedIterations = editableIterations;
      } else {
        // Default to only show authored roadmaps if user has not selected the edit option
        // And default to only show authored iterations if user has not selected the edit option
        displayedRoadmaps = userdata.authored_roadmaps;
        displayedIterations = userdata.authored_roadmap_iterations;
      }
    } else {
      displayedRoadmaps = [];
      displayedIterations = [];
    }

    if (objectsFilter.includes('roadmaps')) {
      if (accessFilter.includes('edit') && session.user?.username === username) {
        displayedRoadmaps = editableRoadmaps;
      } else {
        // Default to only show authored roadmaps if user has not selected the edit option
        displayedRoadmaps = userdata.authored_roadmaps;
      }
    }

    if (objectsFilter.includes('roadmap')) {
      if (accessFilter.includes('edit') && session.user?.username === username) {
        displayedIterations = editableIterations;
      } else {
        // Default to only show authored iterations if user has not selected the edit option
        displayedIterations = userdata.authored_roadmap_iterations;
      }
    }
  }

  toggleRoadmaps();

  return <main>
      <section className='margin-block-300'>
        <h1 className='margin-bottom-0'>{userdata.username}</h1>
        <small style={{ color: 'var(--gray-50)' }}>@{userdata.username}</small>
      </section>

      {session.user?.username === username ?
        <section className='margin-block-300'>
            <h2>{t("pages:profile.handle_data")}</h2>
            <GraphCookie />
          </section>
        : null}

      <section className='margin-block-300'>
        <h2 className='margin-bottom-100 padding-bottom-50' style={{ borderBottom: '1px solid var(--gray)' }}>
          {session.user?.username === username ?
            t("pages:profile.my_posts")
            :
            t("pages:profile.user_posts", { name: userdata.username })
          }
        </h2>

        <UserFilters userPage={session.user?.username === username} />

        <nav>
          {displayedRoadmaps.length > 0 ?
            <section className='margin-block-300'>
              <h3 className='margin-top-0'>{t("pages:profile.roadmaps")}</h3>
              <ul className={`${styles.itemsList}`}>
                {displayedRoadmaps.map((roadmap, index) =>
                  <li key={index}>
                    <div className='inline-block width-100' style={{ verticalAlign: 'middle' }}>
                      <div className='flex justify-content-space-between align-items-center'>
                        <Link href={`/roadmap/${roadmap.id}`} className='block text-decoration-none flex-grow-100 color-pureblack'>
                          <h4 className='font-weight-500 margin-0'>{roadmap.name} </h4>
                          <p className='margin-0'>{t("pages:profile.version_count", { count: roadmap.iterations.length })}</p>
                        </Link>
                        <ControlsMenu object={roadmap} />
                      </div>
                    </div>
                  </li>,
                )}
              </ul>
            </section>
            : null}

          {displayedIterations.length > 0 ?
            <section className='margin-block-300'>
              <h3 className='margin-top-0'>{t("pages:profile.roadmap_versions")}</h3>
              <ul className={`${styles.itemsList}`}>
                {displayedIterations.map((iteration, index) =>
                  <li key={index}>
                    <div className='inline-block width-100' style={{ verticalAlign: 'middle' }}>
                      <div className='flex justify-content-space-between align-items-center'>
                        <Link href={iterationPath(iteration.roadmap_id, iteration.version)} className='block text-decoration-none flex-grow-100 color-pureblack'>
                          <h4 className='font-weight-500 margin-0'>{iteration.roadmap.name} {`(v${iteration.version})`}</h4>
                          <p className='margin-0'>{t("common:count.goal", { count: iteration._count.goals })}</p>
                        </Link>
                        <ControlsMenu object={iteration} />
                      </div>
                    </div>
                  </li>,
                )}
              </ul>
            </section>
            : null}

        </nav>
      </section>

    </main>;
}
