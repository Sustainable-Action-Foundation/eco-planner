import { NextResponse, type NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { cookies } from 'next/headers'
import { Locales, uniqueLocales } from "i18n.config";
import acceptLanguage from "accept-language";

// Set accepted languages
acceptLanguage.languages(uniqueLocales);

export async function middleware(req: NextRequest) {
  const session = await getSession(cookies())
  const response = NextResponse.next()

  // Disable caching TODO: REMOVE!!!
  if (process.env.NODE_ENV !== "production") {
    response.headers.set("Cache-Control", "no-store, must-revalidate, max-age=0");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
  }

  // Is there a locale cookie in the request?
  const existingLocaleCookie = req.cookies.get("locale")?.value;
  if (existingLocaleCookie) {
    // Sanitize the locale cookie
    const cookieLocale = acceptLanguage.get(existingLocaleCookie) ?? Locales.default;
    response.cookies.set("locale", cookieLocale);
  }
  else {
    // No locale cookie found, define it with accept-language header (or default)
    const headerLocale = acceptLanguage.get(req.headers.get("accept-language")) ?? Locales.default;
    response.cookies.set("locale", headerLocale ?? Locales.default);
  }

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
    ) {
      const loginUrl = new URL('/login', req.url)
      // Save the current page as the "from" query parameter so we can redirect back after logging in
      loginUrl.searchParams.set('from', req.nextUrl.pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  /** Matches strings starting with /@ or /%40 (URL-encoded @) */
  const userIndicatorRegEx = /^\/(@|%40)/;
  // Silently redirect from "/@username" to "/user/@username"
  if (req.nextUrl.pathname.match(userIndicatorRegEx)) {
    const newUrl = new URL(`/user${req.nextUrl.pathname}`, req.url)
    newUrl.search = req.nextUrl.search
    return NextResponse.rewrite(newUrl)
  }
  // If we add for example # or $ to go to organisation pages or something, we can do it in a similar way to the above user rewrite

  return response;
}