import { NextResponse, type NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { cookies } from 'next/headers'

export async function middleware(req: NextRequest) {
  const session = await getSession(cookies())

  // Redirect away from login page if already logged in
  if (req.nextUrl.pathname.startsWith('/login')) {
    if (session.user?.isLoggedIn === true) {
      return NextResponse.redirect(new URL('/', req.url))
    }
  }

  // Redirect away from signup page if already logged in
  if (req.nextUrl.pathname.startsWith('/signup')) {
    if (session.user?.isLoggedIn === true) {
      return NextResponse.redirect(new URL('/', req.url))
    }
  }

  /**
   * Matches the creation and editing pages for MetaRoadmaps, Roadmaps, Goals, Actions, and Effects, with or without trailing slashes.
   * For example, "/createMetaRoadmap" or "/editAction/"
   * TODO: This no longer works as /createMetaRoadmap now looks like metaRoadmap/create
   */
  const createOrEditRegEx = /\/(create|edit)(MetaRoadmap|Roadmap|Goal|Action|Effect)\/?$/
  // Redirect away from creation and editing pages if not logged in
  if (req.nextUrl.pathname.match(createOrEditRegEx)) {
    if (!session.user?.isLoggedIn) {
      const loginUrl = new URL('/login', req.url)
      // Save the current page as the "from" query parameter so we can redirect back after logging in
      loginUrl.searchParams.set('from', req.nextUrl.pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  /**
   * Locks all pages except the login/signup process and the info and home pages to logged in users.
   * TODO: Probably invert this? ex. if(!req.nextUrl.pathname.startsWith(/login))?
   */
  if (!session.user?.isLoggedIn) {
    if (
      req.nextUrl.pathname.startsWith('/dashboard')
      || req.nextUrl.pathname.startsWith('/metaRoadmap')
      || req.nextUrl.pathname.startsWith('/roadmap')
      || req.nextUrl.pathname.startsWith('/goal')
      || req.nextUrl.pathname.startsWith('/action')
      || req.nextUrl.pathname.startsWith('/effect')
      || req.nextUrl.pathname.startsWith('/user')
    ) {
      const loginUrl = new URL('/login', req.url)
      // Save the current page as the "from" query parameter so we can redirect back after logging in
      loginUrl.searchParams.set('from', req.nextUrl.pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}