import { getSession } from "@/lib/session";
import { match } from "@formatjs/intl-localematcher";
import Negotiator from "negotiator";
import { cookies, headers } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

// const headers = { "accept-language": "en-US,en;q=0.5" };
// const languages = new Negotiator({ headers }).languages();
// const locales = ["en-US", "sv-SE"];
// const defaultLocale = "en-US";

// const foundLocale = match(languages, locales, defaultLocale);
const locales = ["en", "sv"];

function getLocale(request: NextRequest) {
  // let locale = new Negotiator({request.headers}).language(locales) || defaultLocale;
  const foundHeaders = { "accept-language": headers().get("accept-language") as string | string[] | undefined };
  const languages = new Negotiator({ headers: foundHeaders }).languages();
  const defaultLocale = "en";
  return match(languages, locales, defaultLocale);
}

export async function middleware(req: NextRequest) {
  const session = await getSession(cookies());

  // Redirect away from login page if already logged in
  if (req.nextUrl.pathname.startsWith("/login")) {
    if (session.user?.isLoggedIn === true) {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  // Redirect away from signup page if already logged in
  if (req.nextUrl.pathname.startsWith("/signup")) {
    if (session.user?.isLoggedIn === true) {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  const { pathname } = req.nextUrl;
  const pathnameHasLocale = locales.some((locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`);

  if (!pathnameHasLocale) {
    const locale = getLocale(req);
    req.nextUrl.pathname = `/${locale}${pathname}`;
    // e.g. incoming request is /products
    // The new URL is now /en-US/products
    return NextResponse.redirect(req.nextUrl);
  }

  /**
   * Matches creation and editing pages, with or without trailing slashes.
   * For example, "/metaRoadmap/create" or "/action/edit/"
   * TODO: This no longer works as /createMetaRoadmap now looks like metaRoadmap/create
   */
  const createOrEditRegEx = /\/(create|edit)\/?$/;
  // Redirect away from creation and editing pages if not logged in
  if (req.nextUrl.pathname.match(createOrEditRegEx)) {
    if (!session.user?.isLoggedIn) {
      const loginUrl = new URL("/login", req.url);
      // Save the current page as the "from" query parameter so we can redirect back after logging in
      loginUrl.searchParams.set("from", req.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  /**
   * Locks all pages except the login/signup process and the info and home pages to logged in users.
   * TODO: Probably invert this? ex. if(!req.nextUrl.pathname.startsWith(/login))?
   */
  if (!session.user?.isLoggedIn) {
    if (
      req.nextUrl.pathname.startsWith("/dashboard") ||
      req.nextUrl.pathname.startsWith("/metaRoadmap") ||
      req.nextUrl.pathname.startsWith("/roadmap") ||
      req.nextUrl.pathname.startsWith("/goal") ||
      req.nextUrl.pathname.startsWith("/action") ||
      req.nextUrl.pathname.startsWith("/effect") ||
      req.nextUrl.pathname.startsWith("/user")
    ) {
      const loginUrl = new URL("/login", req.url);
      // Save the current page as the "from" query parameter so we can redirect back after logging in
      loginUrl.searchParams.set("from", req.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip all internal paths (_next)
    "/((?![_next|icons|animations|images]).*)",
    // "/((?!icons)/*.*)",
    // "/((?!animations)/*.*)",
    // "/((?!images)/*.*)",

    // Optional: only run on root (/) URL
    // '/'
  ],
};
