import GraphCookie from '@/components/cookies/graphCookie';
import { TableMenu } from '@/components/tables/tableMenu/tableMenu';
import getMetaRoadmaps from '@/fetchers/getMetaRoadmaps';
import getRoadmaps from '@/fetchers/getRoadmaps';
import getUserInfo from '@/fetchers/getUserInfo';
import accessChecker from '@/lib/accessChecker';
import { getSession } from '@/lib/session';
import { AccessLevel } from '@/types';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export default async function Page({ params }: { params: { user: string } }) {
  let username = params.user;

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
    <main>
      <section className='margin-block-300'>
        <h1 className='margin-bottom-0'>{userdata.username}</h1>
        <small style={{color: 'var(--gray-50)'}}>@{userdata.username}</small>
        <ul className='margin-top-100'>
          {session.user?.userGroups.map((usergroup, index) =>
            <li key={index}>{usergroup}</li>
          )}
        </ul>
      </section>

      {session.user?.username === username ?
        <>
          <section className='margin-block-300'>
            <h2>Hantera min data</h2>
            <GraphCookie />
          </section>

          <section className='margin-block-300'>
          <h2>Färdplansserier jag kan redigera</h2>
          <ul>
            {editableMetaRoadmaps.map((editableMetaRoadmap, index) => 
              <li key={index} className='margin-block-25'>
                <div className='flex justify-content-space-between align-items-center'>
                  <span>{editableMetaRoadmap.name}</span>
                  <TableMenu object={editableMetaRoadmap} />
                </div>
              </li>
            )}
          </ul>
          </section>

          <section className='margin-block-300'>
          <h2>Färdplaner jag kan redigera</h2>
          <ul>
            {editableRoadmaps.map((editableRoadmap, index) => 
              <li key={index} className='margin-block-25'>
                <div className='flex justify-content-space-between align-items-center'>
                  <span>{editableRoadmap.metaRoadmap.name}</span>
                  <TableMenu object={editableRoadmap} />
                </div>
              </li>
            )}
          </ul>
          </section>
        </>
      : null}

      <section className='margin-block-300'>
        <h2>Mina färdplansserier</h2>
        <ul>
          {userdata.authoredMetaRoadmaps.map((authoredMetaRoadmap, index) => 
            <li key={index} className='margin-block-25'>
              <div className='flex justify-content-space-between align-items-center'>
                <span>{authoredMetaRoadmap.name}</span>
                <TableMenu object={authoredMetaRoadmap} />
              </div>
            </li>
          )}
        </ul>
      </section>

      <section className='margin-block-300'>
        <h2>Mina färdplaner</h2>
        <ul>
          {userdata.authoredRoadmaps.map((authoredRoadmaps, index) => 
            <li key={index} className='margin-block-25'>
              <div className='flex justify-content-space-between align-items-center'>
                <span>{authoredRoadmaps.metaRoadmap.name}</span>
                <TableMenu object={authoredRoadmaps} />
              </div>
            </li>
          )}
        </ul>
      </section>
    </main>
  </>
}