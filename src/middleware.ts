import { NextResponse, type NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { cookies } from 'next/headers'

export async function middleware(req: NextRequest) {
  const session = await getSession(cookies())
  const response = NextResponse.next()

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
   * Matches creation and editing pages, with or without trailing slashes.
   * For example, "/metaRoadmap/create" or "/action/edit/"
   * TODO: This no longer works as /createMetaRoadmap now looks like metaRoadmap/create
   */
  const createOrEditRegEx = /\/(create|edit)\/?$/
  // Redirect away from creation and editing pages if not logged in
  if (req.nextUrl.pathname.match(createOrEditRegEx)) {
    if (!session.user?.isLoggedIn) {
      const loginUrl = new URL('/login', req.url)
      // Save the current page as the "from" query parameter so we can redirect back after logging in
      loginUrl.searchParams.set('from', req.nextUrl.pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  /** Matches strings starting with /@ or /%40 (URL-encoded @) */
  const userIndicatorRegEx = /^\/(@|%40)/;

  // Locks all pages except the login/signup process and the info and home pages to logged in users.
  // TODO: Probably invert this? ex. if(!req.nextUrl.pathname.startsWith(/login))?
  // See https://nextjs.org/docs/14/app/building-your-application/routing/middleware#matcher for an example allowing next's internal pages
  if (!session.user?.isLoggedIn) {
    if (
      req.nextUrl.pathname.startsWith('/dashboard')
      || req.nextUrl.pathname.startsWith('/metaRoadmap')
      || req.nextUrl.pathname.startsWith('/roadmap')
      || req.nextUrl.pathname.startsWith('/goal')
      || req.nextUrl.pathname.startsWith('/action')
      || req.nextUrl.pathname.startsWith('/effect')
      || req.nextUrl.pathname.startsWith('/user')
      || req.nextUrl.pathname.match(userIndicatorRegEx)
    ) {
      const loginUrl = new URL('/login', req.url)
      // Save the current page as the "from" query parameter so we can redirect back after logging in
      loginUrl.searchParams.set('from', req.nextUrl.pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  // Silently redirect from "/@username" to "/user/@username"
  if (req.nextUrl.pathname.match(userIndicatorRegEx)) {
    const newUrl = new URL(`/user${req.nextUrl.pathname}`, req.url)
    newUrl.search = req.nextUrl.search
    return NextResponse.rewrite(newUrl)
  }
  // If we add for example # or $ to go to organisation pages or something, we can do it in a similar way to the above user rewrite

  return response;
}