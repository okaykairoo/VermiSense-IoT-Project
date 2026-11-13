import "server-only";

import {
  createHash,
  createPrivateKey,
  createPublicKey,
  scrypt,
  sign,
  timingSafeEqual,
  verify,
  type KeyObject,
} from "node:crypto";

/**
 * Farm administrator login.
 *
 * This repository is public, so the admin password is never written here.
 * Instead the password is stretched (scrypt) into an Ed25519 key pair and only
 * the PUBLIC half is kept in the code:
 *
 *  - logging in = re-deriving the key pair from the submitted password and
 *    checking that it produces the expected public key;
 *  - a session  = a short-lived token signed with the private half, which only
 *    exists while a successful login request is being handled;
 *  - verifying  = checking that signature against the public key.
 *
 * Nothing secret has to be stored on the server, a session cannot be forged
 * without knowing the password, and the same check works in `proxy.ts`, in
 * pages and in Server Actions.
 *
 * To change the login, set ADMIN_USERNAME and/or ADMIN_PASSWORD in the
 * environment (`.env.local`, or your hosting provider's settings).
 */

const DEFAULT_ADMIN_USERNAME = "farmadmin";
/** Public key derived from the default admin password. This is not a secret. */
const DEFAULT_ADMIN_PUBLIC_KEY = "XXmN0u3iYII5_nNTOKby6qkGkK7tpgcS0yCCABQYqNI";

export const SESSION_COOKIE = "vermisense_session";
/** How long a login stays valid before the administrator must sign in again. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

const KEY_DERIVATION_SALT = "vermisense:admin:v1";
const MAX_CREDENTIAL_LENGTH = 200;

// DER headers that wrap a raw 32-byte Ed25519 key (RFC 8410).
const PKCS8_ED25519_HEADER = Buffer.from("302e020100300506032b657004220420", "hex");
const SPKI_ED25519_HEADER = Buffer.from("302a300506032b6570032100", "hex");

export type Session = {
  username: string;
  expiresAt: Date;
};

function adminUsername(): string {
  return process.env.ADMIN_USERNAME?.trim() || DEFAULT_ADMIN_USERNAME;
}

function derivePrivateKey(password: string): Promise<KeyObject> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      KEY_DERIVATION_SALT,
      32,
      { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (error, seed) => {
        if (error) return reject(error);
        resolve(
          createPrivateKey({
            key: Buffer.concat([PKCS8_ED25519_HEADER, seed]),
            format: "der",
            type: "pkcs8",
          })
        );
      }
    );
  });
}

function rawPublicKey(key: KeyObject): Buffer {
  // The raw public key is the last 32 bytes of its SPKI encoding.
  return createPublicKey(key).export({ format: "der", type: "spki" }).subarray(-32);
}

let adminPublicKey: Promise<Buffer> | undefined;

function getAdminPublicKey(): Promise<Buffer> {
  adminPublicKey ??= (async () => {
    const password = process.env.ADMIN_PASSWORD;
    if (password) return rawPublicKey(await derivePrivateKey(password));
    return Buffer.from(DEFAULT_ADMIN_PUBLIC_KEY, "base64url");
  })().catch((error) => {
    adminPublicKey = undefined;
    throw error;
  });
  return adminPublicKey;
}

function sameText(a: string, b: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(a), digest(b));
}

function signSession(privateKey: KeyObject, username: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      sub: username,
      exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
    })
  ).toString("base64url");
  const signature = sign(null, Buffer.from(payload), privateKey).toString("base64url");
  return `${payload}.${signature}`;
}

/**
 * Checks the submitted credentials. Returns a signed session token when they
 * are correct and `null` otherwise.
 */
export async function authenticate(username: string, password: string): Promise<string | null> {
  if (
    !username ||
    !password ||
    username.length > MAX_CREDENTIAL_LENGTH ||
    password.length > MAX_CREDENTIAL_LENGTH
  ) {
    return null;
  }

  const expectedUsername = adminUsername();
  // Always derive the key, so the response time does not reveal whether the
  // username was correct.
  const privateKey = await derivePrivateKey(password);
  const passwordMatches = timingSafeEqual(rawPublicKey(privateKey), await getAdminPublicKey());
  const usernameMatches = sameText(username.trim().toLowerCase(), expectedUsername.toLowerCase());

  if (!passwordMatches || !usernameMatches) return null;
  return signSession(privateKey, expectedUsername);
}

/** Returns the session for a token, or `null` if it is missing, forged or expired. */
export async function verifySessionToken(token: string | undefined): Promise<Session | null> {
  if (!token) return null;

  const [payload, signature, ...extra] = token.split(".");
  if (!payload || !signature || extra.length > 0) return null;

  try {
    const publicKey = createPublicKey({
      key: Buffer.concat([SPKI_ED25519_HEADER, await getAdminPublicKey()]),
      format: "der",
      type: "spki",
    });
    const signatureIsValid = verify(
      null,
      Buffer.from(payload),
      publicKey,
      Buffer.from(signature, "base64url")
    );
    if (!signatureIsValid) return null;

    const data: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof data !== "object" || data === null) return null;
    const { sub, exp } = data as { sub?: unknown; exp?: unknown };
    if (typeof sub !== "string" || typeof exp !== "number") return null;
    if (exp * 1000 <= Date.now()) return null;
    if (sub !== adminUsername()) return null;

    return { username: sub, expiresAt: new Date(exp * 1000) };
  } catch {
    return null;
  }
}
