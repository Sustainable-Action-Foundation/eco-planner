import getMetaRoadmaps from '@/fetchers/getMetaRoadmaps';
import getRoadmaps from '@/fetchers/getRoadmaps';
import getUserInfo from '@/fetchers/getUserInfo';
import accessChecker from '@/lib/accessChecker';
import { getSession } from '@/lib/session';
import { AccessLevel } from '@/types';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';

export default async function Page({ params }: { params: { user: string } }) {
  let username = params.user;

  // Check if user starts with @ 
  // (%40 = @ due to URI encoding)
  /** Matches strings starting with @ or %40 (URL-encoded @) */
  const userIndicatorRegEx = /^(@|%40)/;
  if (username?.match(userIndicatorRegEx)) {
    username = username?.replace(userIndicatorRegEx, '');
  }

  const [session, userdata] = await Promise.all([
    getSession(cookies()),
    getUserInfo(username),
  ]);

  // 404 if the user doesn't exist
  if (!userdata) {
    return notFound();
  }

  // If user is on their own page, also get all roadmaps/metaRoadmaps they have edit access to
  const [roadmaps, metaRoadmaps] = await Promise.all([
    (session.user?.username === username) ? getRoadmaps() : [],
    (session.user?.username === username) ? getMetaRoadmaps() : []
  ]);
  const editAccess = [AccessLevel.Edit, AccessLevel.Author, AccessLevel.Admin];

  const editableRoadmaps = roadmaps.filter(roadmap => editAccess.includes(accessChecker(roadmap, session.user)));
  const editableMetaRoadmaps = metaRoadmaps.filter(metaRoadmap => editAccess.includes(accessChecker(metaRoadmap, session.user)));

  return <>
    <h1>{userdata.username}</h1>
  </>
}