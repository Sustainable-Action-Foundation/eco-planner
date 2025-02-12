import { DEFAULT_LOCALE, LOCALES } from "@/constants";
import { getSession } from '@/lib/session';
import { match } from "@formatjs/intl-localematcher";
import Negotiator from "negotiator";
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

// const LOCALES = ["en", "sv"];
// const DEFAULT_LOCALE = "en";

export async function middleware(req: NextRequest) {
  const session = await getSession(cookies())

  // JESPER EXPERIMANTERAR NEDANFÖR DETTA

  let locale;

  const language = cookies().get("language")?.value;

  if (language) {
    locale = language;
  } else {
    // If no cookie, detect language from browser settings
    const headers = {
      "accept-language": req.headers.get("accept-language") || "",
    };
    const locales = LOCALES;
    const defaultLocale = DEFAULT_LOCALE;

    // Use Negotiator to parse browser language preferences
    const languages = new Negotiator({ headers }).languages();

    // Match the best language based on available locales
    locale = match(languages, locales, defaultLocale);
  }

  // Set the detected locale in request headers for downstream use
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("locale", locale);

  // JESPER EXPERIMENTERAR OVANFÖR DETTA

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

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
}

// export const config = {
//   matcher: "/:path*",
// }