import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  NotAuthorizedException,
  UserNotFoundException,
} from '@aws-sdk/client-cognito-identity-provider'
import { CognitoJwtVerifier } from 'aws-jwt-verify'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { required } from '@/lib/outputs'

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
 * The allowlist from SPEC.md section 7. Cognito membership alone is not
 * authorisation: an account can exist and still not be an organiser.
 */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

export function isAllowed(email: string): boolean {
  return adminEmails().includes(email.trim().toLowerCase())
}

export type AdminSession =
  | { status: 'ok'; email: string }
  /** No usable session. Show the sign in form. */
  | { status: 'signed-out' }
  /** Signed in to Cognito but not an organiser. Show an explicit refusal. */
  | { status: 'refused'; email: string }

/**
 * Resolves the caller on every admin request.
 *
 * The cookie holds only a refresh token, so an id token is minted server side
 * per request and verified against the pool's JWKS. That means no hourly re
 * login on event day, and nothing long lived that the browser can read.
 */
export async function currentAdmin(): Promise<AdminSession> {
  const refreshToken = (await cookies()).get(REFRESH_COOKIE)?.value
  if (!refreshToken) return { status: 'signed-out' }

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
  return isAllowed(email) ? { status: 'ok', email } : { status: 'refused', email }
}

export type SignInResult = { ok: true; email: string } | { ok: false; message: string }

/**
 * Authenticates against Cognito and, only if the email is on the allowlist,
 * stores the refresh token. A valid Cognito user who is not an organiser is
 * told so plainly rather than handed a session that every page then rejects.
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
      return { ok: false, message: `This account needs to finish setup in Cognito first (${res.ChallengeName}).` }
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

  if (!isAllowed(trimmed)) {
    return {
      ok: false,
      message: `${trimmed} is not on the organiser list. Ask Vedant to add it to ADMIN_EMAILS.`,
    }
  }

  const store = await cookies()
  store.set(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })

  return { ok: true, email: trimmed }
}

export async function signOut(): Promise<void> {
  ;(await cookies()).delete(REFRESH_COOKIE)
}

/**
 * Guard for every admin page and route handler. Call it BEFORE loading any
 * data.
 *
 * Returning a refusal from the layout is not enough: Next still renders the
 * child page, and its data lands in the RSC payload of the response. That
 * leaked the full attendee roster to a refused account until this existed.
 * redirect() throws, so nothing after this line runs and nothing is fetched.
 */
export async function requireAdmin(): Promise<{ email: string }> {
  const session = await currentAdmin()
  if (session.status === 'signed-out') redirect('/admin/login')
  if (session.status === 'refused') redirect('/admin/no-access')
  return { email: session.email }
}
