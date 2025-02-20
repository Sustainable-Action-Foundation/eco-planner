import { DEFAULT_LOCALE, LOCALES } from "@/constants";
import { getSession } from '@/lib/session';
import { match } from "@formatjs/intl-localematcher";
import Negotiator from "negotiator";
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { Locale } from "./types";

export async function middleware(req: NextRequest) {
  const session = await getSession(cookies())

  let locale: Locale;

  // Check if the user has set a language cookie...
  const language = cookies().get("language")?.value;

  if (language && LOCALES.includes(language as Locale)) {
    locale = language as Locale; // ...and use that language if it exists
  } else {
    // If no cookie, detect language from browser settings
    const headers = {
      "accept-language": req.headers.get("accept-language") || "",
    };  
    // Use Negotiator to parse browser language preferences
    const languages = new Negotiator({ headers }).languages();

    // Match the best language based on available locales
    locale = match(languages, LOCALES, DEFAULT_LOCALE) as Locale;
  }

  // Set the detected locale in request headers for downstream use
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("locale", locale);

  // Redirect away from login page if already logged in
  if (req.nextUrl.pathname.startsWith('/login')) {
    if (session.user?.isLoggedIn === true) {
      return NextResponse.redirect(new URL('/', req.url), {headers: requestHeaders})
    }
  }

  // Redirect away from signup page if already logged in
  if (req.nextUrl.pathname.startsWith('/signup')) {
    if (session.user?.isLoggedIn === true) {
      return NextResponse.redirect(new URL('/', req.url), {headers: requestHeaders})
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
      return NextResponse.redirect(loginUrl, {headers: requestHeaders})
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
      return NextResponse.redirect(loginUrl, {headers: requestHeaders})
    }
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
}
