import GraphCookie from '@/components/cookies/graphCookie';
import UserFilters from '@/components/forms/filters/userFilters';
import { TableMenu } from '@/components/tables/tableMenu/tableMenu';
import getMetaRoadmaps from '@/fetchers/getMetaRoadmaps';
import getRoadmaps from '@/fetchers/getRoadmaps';
import getUserInfo from '@/fetchers/getUserInfo';
import accessChecker from '@/lib/accessChecker';
import { getSession } from '@/lib/session';
import { AccessLevel } from '@/types';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';

export default async function Page({ 
  params, 
  searchParams 
  }: { 
    params: { user: string },
    searchParams: { [key: string]: string | string[] | undefined }
  }) {
    
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

  const editableMetaRoadmaps = metaRoadmaps.filter(metaRoadmap => editAccess.includes(accessChecker(metaRoadmap, session.user)));
  let displayedEditableMetaRoadmaps = editableMetaRoadmaps // TODO: fix default values for this
  let displayedAuthoredMetaRoadmaps = userdata.authoredMetaRoadmaps

  const editableRoadmaps = roadmaps.filter(roadmap => editAccess.includes(accessChecker(roadmap, session.user)));
  let displayedEditableRoadmaps = editableRoadmaps // TODO: Fix default values for this
  let displayedAuthoredRoadmaps = userdata.authoredRoadmaps

  const objectsFilter = searchParams['objects'] ? (Array.isArray(searchParams['objects']) ? searchParams['objects'] : [searchParams['objects']]) : [];
  const accessFilter = searchParams['access'] ? (Array.isArray(searchParams['access']) ? searchParams['access'] : [searchParams['access']]) : [];

  // Update values based on query params
  function toggleRoadmaps() {
    // TODO: temporary fix to do empty lists until i figure out how i wanna handle default values
    displayedAuthoredMetaRoadmaps = []
    displayedAuthoredRoadmaps = []

    if (objectsFilter.includes('roadmapseries')) {
      // Only display roadmapseries with edit access if on own user page
      if (accessFilter.includes('edit') && session.user?.username === username) {
        displayedEditableMetaRoadmaps = editableMetaRoadmaps;
      } else {
        displayedEditableMetaRoadmaps = [];
      }

      // Allow everyone to see roadmapseries if the visited user has userdata
      if (accessFilter.includes('owner') && userdata) {
        displayedAuthoredMetaRoadmaps = userdata.authoredMetaRoadmaps;
      } else {
        displayedAuthoredMetaRoadmaps = [];
      }
    } else {
      displayedEditableMetaRoadmaps = [];
    }

    if (objectsFilter.includes('roadmap')) {
      // Only display roadmaps with edit access if on own user page
      if (accessFilter.includes('edit') && session.user?.username === username) {
        displayedEditableRoadmaps = editableRoadmaps;
      } else {
        displayedEditableRoadmaps = [];
      }

      // Allow everyone to see roadmaps if the visited user has userdata
      if (accessFilter.includes('owner') && userdata) {
        displayedAuthoredRoadmaps = userdata.authoredRoadmaps;
      } else {
        displayedAuthoredRoadmaps = [];
      }
    } else {
      displayedEditableRoadmaps = [];
    }


  }
  
  toggleRoadmaps()

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
        <UserFilters />

        <ul style={{padding: '20px'}}>
          {/* If on users own page, show roadmapsseries and roadmaps with edit access*/}
          {session.user?.username === username ?
            <>
              {displayedEditableMetaRoadmaps.map((editableMetaRoadmap, index) => 
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

              {displayedEditableRoadmaps.map((editableRoadmap, index) => 
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
          {displayedAuthoredMetaRoadmaps.map((authoredMetaRoadmap, index) => 
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
          {displayedAuthoredRoadmaps.map((authoredRoadmaps, index) => 
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