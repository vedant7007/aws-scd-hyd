import {
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminSetUserPasswordCommand,
  CodeMismatchException,
  CognitoIdentityProviderClient,
  ConfirmForgotPasswordCommand,
  ExpiredCodeException,
  ForgotPasswordCommand,
  InitiateAuthCommand,
  InvalidPasswordException,
  LimitExceededException,
  NotAuthorizedException,
  UserNotFoundException,
  UsernameExistsException,
} from '@aws-sdk/client-cognito-identity-provider'
import { CognitoJwtVerifier } from 'aws-jwt-verify'
import { randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import type { CrewRole } from '../db/types'
import { required } from '../outputs'
import { BOOTSTRAP_ADMIN, adminCount, bootstrapFirstAdmin, getUser } from './crew'

// Server only. SPEC.md section 7: no AWS SDK call ever runs in the browser, so
// the whole sign in round trip happens here and the browser only ever holds an
// httpOnly cookie it cannot read.

export const REFRESH_COOKIE = 'scd_admin'

const REGION = process.env.AWS_REGION ?? 'ap-south-1'

const userPoolId = () => required((o) => o.auth?.user_pool_id, 'COGNITO_USER_POOL_ID')
const clientId = () => required((o) => o.auth?.user_pool_client_id, 'COGNITO_USER_POOL_CLIENT_ID')

const cognito = new CognitoIdentityProviderClient({ region: REGION })

/** Built lazily so a missing pool id fails the request, not the build. */
let verifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null
function idTokenVerifier() {
  verifier ??= CognitoJwtVerifier.create({
    userPoolId: userPoolId(),
    tokenUse: 'id',
    clientId: clientId(),
  })
  return verifier
}

/**
 * The fallback allowlist. It counts ONLY while the table holds zero admins,
 * so a wiped table does not lock everyone out; once one admin exists in the
 * table, this variable grants nothing.
 */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

/**
 * The one place a role is decided. The table first; the environment only
 * when the table has no admin at all. Cognito membership alone grants
 * nothing: an account can exist and still be nobody here.
 */
export async function resolveRole(email: string): Promise<CrewRole | null> {
  const user = await getUser(email)
  if (user) return user.role
  if ((await adminCount()) === 0 && adminEmails().includes(email.trim().toLowerCase())) return 'admin'
  return null
}

/**
 * Resolving a session costs a round trip to Cognito, measured at 135ms against
 * ap-south-1. The result is held in process so a burst of scans at the gate
 * pays it once rather than once per tap.
 *
 * Five seconds, not sixty. This window is the delay before a removal or a
 * demotion takes effect, and on event day pulling someone's access has to
 * be immediate. A slower dashboard is a much cheaper problem than a revoked
 * organiser who still has the roster for another minute. Sign out clears the
 * entry outright.
 */
const SESSION_TTL_MS = 5_000
const SESSION_CACHE_MAX = 100
const sessionCache = new Map<string, { at: number; session: CrewSession }>()

export type CrewSession =
  | { status: 'ok'; email: string; role: CrewRole }
  /** No usable session. Show the sign in form. */
  | { status: 'signed-out' }
  /** Signed in to Cognito but on no crew list. Show an explicit refusal. */
  | { status: 'refused'; email: string }

/**
 * Resolves the caller on every crew request.
 *
 * The cookie holds only a refresh token, so an id token is minted server side
 * per request and verified against the pool's JWKS. That means no hourly re
 * login on event day, and nothing long lived that the browser can read.
 *
 * Wrapped in React cache so one render resolves the session once. The layout
 * and the page both need it, and without this every admin page load made two
 * round trips to Cognito instead of one.
 */
export const currentCrew = cache(async (): Promise<CrewSession> => {
  const refreshToken = (await cookies()).get(REFRESH_COOKIE)?.value
  if (!refreshToken) return { status: 'signed-out' }

  const hit = sessionCache.get(refreshToken)
  if (hit && Date.now() - hit.at < SESSION_TTL_MS) return hit.session

  let idToken: string
  try {
    const res = await cognito.send(
      new InitiateAuthCommand({
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        ClientId: clientId(),
        AuthParameters: { REFRESH_TOKEN: refreshToken },
      }),
    )
    idToken = res.AuthenticationResult?.IdToken ?? ''
    if (!idToken) return { status: 'signed-out' }
  } catch {
    // Revoked, expired or tampered with. Treated the same as no session.
    return { status: 'signed-out' }
  }

  let email: string
  try {
    const claims = await idTokenVerifier().verify(idToken)
    email = String(claims.email ?? '')
  } catch {
    return { status: 'signed-out' }
  }

  if (!email) return { status: 'signed-out' }

  const role = await resolveRole(email)
  const session: CrewSession = role ? { status: 'ok', email, role } : { status: 'refused', email }

  // Only decided answers are cached. A signed out result is cheap anyway.
  if (sessionCache.size >= SESSION_CACHE_MAX) sessionCache.clear()
  sessionCache.set(refreshToken, { at: Date.now(), session })
  return session
})

export type SignInResult = { ok: true; email: string; role: CrewRole } | { ok: false; message: string }

/**
 * Authenticates against Cognito and, only if the email has a role, stores the
 * refresh token. A valid Cognito user with no role is told so plainly rather
 * than handed a session that every page then rejects. The first admin is
 * seeded on their first sign in; that runs once and never again.
 */
export async function signIn(email: string, password: string): Promise<SignInResult> {
  const trimmed = email.trim().toLowerCase()
  if (!trimmed || !password) return { ok: false, message: 'Enter your email and password.' }

  let refreshToken: string | undefined
  try {
    const res = await cognito.send(
      new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: clientId(),
        AuthParameters: { USERNAME: trimmed, PASSWORD: password },
      }),
    )
    if (res.ChallengeName) {
      return { ok: false, message: 'This account has no password yet. Use "Forgot password" below to set one.' }
    }
    refreshToken = res.AuthenticationResult?.RefreshToken
  } catch (err) {
    if (err instanceof NotAuthorizedException || err instanceof UserNotFoundException) {
      // One message for both, so this cannot be used to discover who has an account.
      return { ok: false, message: 'That email and password combination was not recognised.' }
    }
    throw err
  }

  if (!refreshToken) return { ok: false, message: 'Sign in did not return a session. Try again.' }

  if (trimmed === BOOTSTRAP_ADMIN) await bootstrapFirstAdmin()

  const role = await resolveRole(trimmed)
  if (!role) {
    return { ok: false, message: `${trimmed} is not on the crew list. Ask an admin to add you.` }
  }

  const store = await cookies()
  store.set(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })

  return { ok: true, email: trimmed, role }
}

export async function signOut(): Promise<void> {
  const store = await cookies()
  const token = store.get(REFRESH_COOKIE)?.value
  // Drop the cached decision too, so signing out is immediate rather than
  // lasting until the TTL expires.
  if (token) sessionCache.delete(token)
  store.delete(REFRESH_COOKIE)
}

/** Forgets every cached decision. Called after a role change so it lands within the request, not the TTL. */
export function forgetSessions(): void {
  sessionCache.clear()
}

/**
 * Guard for every admin page and server action. Call it BEFORE loading any
 * data.
 *
 * Returning a refusal from the layout is not enough: Next still renders the
 * child page, and its data lands in the RSC payload of the response. That
 * leaked the full attendee roster to a refused account until this existed.
 * redirect() throws, so nothing after this line runs and nothing is fetched.
 * A volunteer is sent to the one screen they may use.
 */
export async function requireAdmin(): Promise<{ email: string }> {
  const session = await currentCrew()
  if (session.status === 'signed-out') redirect('/admin/login')
  if (session.status === 'refused') redirect('/admin/no-access')
  if (session.role !== 'admin') redirect('/admin/scan')
  return { email: session.email }
}

/** Guard for the scanner and its route: any crew role. */
export async function requireCrew(): Promise<{ email: string; role: CrewRole }> {
  const session = await currentCrew()
  if (session.status === 'signed-out') redirect('/admin/login')
  if (session.status === 'refused') redirect('/admin/no-access')
  return { email: session.email, role: session.role }
}

/* ---------------------------------------------------------------------------
   Cognito accounts. Created and removed here so the user management page
   never handles a password: Cognito is told to send nothing, the account is
   given a random permanent password that is discarded on the spot (Cognito
   refuses a password reset for an account that has never had one), and the
   person sets their own through the forgot password flow. No password is
   printed, logged, returned or emailed by this application.
   --------------------------------------------------------------------------- */

/** Creates the sign-in account for a crew email. Idempotent: an existing account is left as it is. */
export async function createCrewAccount(email: string): Promise<{ created: boolean }> {
  const clean = email.trim().toLowerCase()
  try {
    await cognito.send(
      new AdminCreateUserCommand({
        UserPoolId: userPoolId(),
        Username: clean,
        UserAttributes: [
          { Name: 'email', Value: clean },
          { Name: 'email_verified', Value: 'true' },
        ],
        MessageAction: 'SUPPRESS',
      }),
    )
  } catch (err) {
    if (err instanceof UsernameExistsException) return { created: false }
    throw err
  }
  await cognito.send(
    new AdminSetUserPasswordCommand({
      UserPoolId: userPoolId(),
      Username: clean,
      Password: `${randomBytes(24).toString('base64url')}Aa1!`,
      Permanent: true,
    }),
  )
  return { created: true }
}

/** Removes the sign-in account. Idempotent. */
export async function deleteCrewAccount(email: string): Promise<void> {
  try {
    await cognito.send(new AdminDeleteUserCommand({ UserPoolId: userPoolId(), Username: email.trim().toLowerCase() }))
  } catch (err) {
    if (!(err instanceof UserNotFoundException)) throw err
  }
}

export type ResetResult = { ok: true } | { ok: false; message: string }

/** Step one of forgot password: Cognito emails a code. One answer whether or not the account exists. */
export async function startPasswordReset(email: string): Promise<ResetResult> {
  const clean = email.trim().toLowerCase()
  if (!clean) return { ok: false, message: 'Enter your email.' }
  try {
    await cognito.send(new ForgotPasswordCommand({ ClientId: clientId(), Username: clean }))
  } catch (err) {
    if (err instanceof UserNotFoundException) return { ok: true }
    if (err instanceof LimitExceededException) return { ok: false, message: 'Too many attempts. Wait a while and try again.' }
    if (err instanceof NotAuthorizedException) return { ok: false, message: 'This account cannot reset its password yet. Ask an admin to remove and re-add it.' }
    throw err
  }
  return { ok: true }
}

/** Step two: the code from the email and the new password, straight to Cognito. Nothing is kept. */
export async function finishPasswordReset(email: string, code: string, password: string): Promise<ResetResult> {
  const clean = email.trim().toLowerCase()
  if (!clean || !code.trim() || !password) return { ok: false, message: 'Enter your email, the code and a new password.' }
  try {
    await cognito.send(new ConfirmForgotPasswordCommand({ ClientId: clientId(), Username: clean, ConfirmationCode: code.trim(), Password: password }))
  } catch (err) {
    if (err instanceof CodeMismatchException || err instanceof ExpiredCodeException) return { ok: false, message: 'That code is wrong or has expired. Request a new one.' }
    if (err instanceof InvalidPasswordException) return { ok: false, message: 'Cognito refused that password. Use at least eight characters with upper and lower case, a number and a symbol.' }
    if (err instanceof UserNotFoundException) return { ok: false, message: 'That code is wrong or has expired. Request a new one.' }
    if (err instanceof LimitExceededException) return { ok: false, message: 'Too many attempts. Wait a while and try again.' }
    throw err
  }
  return { ok: true }
}
