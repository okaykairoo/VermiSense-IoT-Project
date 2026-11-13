import "server-only";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  verifySessionToken,
  type Session,
} from "./auth";

/** Stores a freshly signed session token in an HTTP-only cookie. */
export async function createSession(token: string): Promise<void> {
  // Only mark the cookie `Secure` when the site is served over HTTPS, so the
  // login also works on a plain-HTTP farm network or on localhost.
  const forwardedProto = (await headers()).get("x-forwarded-proto");
  const isHttps = forwardedProto?.split(",")[0].trim() === "https";

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isHttps,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function deleteSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Returns the current administrator session, or `null` when not logged in. */
export async function getSession(): Promise<Session | null> {
  // The check compares the session's expiry with the current time, so it must
  // run for every request and never be prerendered or cached.
  await connection();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}

/** Use in protected pages and actions: sends visitors without a session to /login. */
export async function verifySession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
