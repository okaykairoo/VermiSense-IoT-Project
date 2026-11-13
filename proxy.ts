import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

/**
 * Runs before every page request and keeps visitors who are not logged in as
 * the farm administrator away from the dashboard. Pages and Server Actions
 * verify the session again themselves (see `lib/session.ts`).
 */
export async function proxy(request: NextRequest) {
  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  const isLoginPage = request.nextUrl.pathname === "/login";

  if (!session && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (session && isLoginPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Everything except Next.js internals (scripts, styles, dev tooling) and the favicon.
  matcher: ["/((?!_next/|__nextjs|favicon.ico).*)"],
};
