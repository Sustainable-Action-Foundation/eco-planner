import GraphCookie from '@/components/cookies/graphCookie';
import { TableMenu } from '@/components/tables/tableMenu/tableMenu';
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
        </>
      : null}

      <section className='margin-block-300'>
        <h2 className='margin-bottom-100 padding-bottom-50' style={{borderBottom: '1px solid var(--gray)'}}>
          {session.user?.username === username ?
            'Mina objekt'
          :
            `@${userdata.username}'s objekt`
          }
        </h2>
        <menu className='margin-0 padding-0 flex gap-200 flex-wrap-wrap margin-bottom-100'>
          <fieldset className='flex gap-50'>
            <legend className='font-weight-500 padding-bottom-75'>Objekt</legend>
            <label className='flex gap-25 align-items-center'>
              <input type='checkbox' />
              Färdplan
            </label>
            <label className='flex gap-25 align-items-center'>
              <input type='checkbox' />
              Färdplansserie
            </label>
          </fieldset>

          {session.user?.username === username ?
            <fieldset className='flex gap-50'>
              <legend className='font-weight-500 padding-bottom-75'>Behörighet</legend>
              <label className='flex gap-25 align-items-center'>
                <input type='checkbox' />
                Ägandeskap
              </label>
              <label className='flex gap-25 align-items-center'>
                <input type='checkbox' />
                Redigeringsbehörighet
              </label>
            </fieldset>
          : null }
        </menu> 

        <ul>
          {/* If on users own page, show roadmapsseries and roadmaps with edit access*/}
          {session.user?.username === username ?
            <>
              {editableMetaRoadmaps.map((editableMetaRoadmap, index) => 
                <li key={index} className='margin-block-25'>
                  <div className='flex justify-content-space-between align-items-center'>
                    <div>
                      <a href={`/metaRoadmap/${editableMetaRoadmap.id}`}>{editableMetaRoadmap.name}</a> • <span>Färdplansserie</span> <br/>
                      <small>Antal versioner i denna serie: {editableMetaRoadmap.roadmapVersions.length}</small>
                    </div>
                    <TableMenu object={editableMetaRoadmap} />
                  </div>
                </li>
              )}
              {editableRoadmaps.map((editableRoadmap, index) => 
                <li key={index} className='margin-block-25'>
                  <div className='flex justify-content-space-between align-items-center'>
                    <div>
                      <a href={`/roadmap/${editableRoadmap.id}`}>{editableRoadmap.metaRoadmap.name}</a> • <span>Färdplan</span> <br/> {/* TODO: Check if naming of roadmap is always inherited */}
                      <span>Antal målbanor: {editableRoadmap._count.goals}</span>
                    </div>
                    <TableMenu object={editableRoadmap} />
                  </div>
                </li>
              )}
            </>
          : null}

          {/* Otherwise default to show roadmapsseries and roadmaps with ownership */}
          {userdata.authoredMetaRoadmaps.map((authoredMetaRoadmap, index) => 
            <li key={index} className='margin-block-25'>
              <div className='flex justify-content-space-between align-items-center'>
                <div>
                  <a href={`/metaRoadmap/${authoredMetaRoadmap.id}`}>{authoredMetaRoadmap.name}</a> • <span>Färdplansserie</span> <br/>
                  <span>Antal versioner i denna serie: {authoredMetaRoadmap.roadmapVersions.length}</span>
                </div>
                <TableMenu object={authoredMetaRoadmap} />
              </div>
            </li>
          )}
          {userdata.authoredRoadmaps.map((authoredRoadmaps, index) => 
            <li key={index} className='margin-block-25'>
              <div className='flex justify-content-space-between align-items-center'>
                <div>
                  <a href={`/roadmap/${authoredRoadmaps.id}`}>{authoredRoadmaps.metaRoadmap.name}</a> • <span>Färdplan</span> <br/> {/* TODO: Check if naming of roadmap is always inherited */}
                  <span>Antal målbanor: {authoredRoadmaps._count.goals}</span>
                </div>
                <TableMenu object={authoredRoadmaps} />
              </div>
            </li>
          )}
        </ul>
      </section>

    </main>
  </>
}