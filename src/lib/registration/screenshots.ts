import { randomUUID } from 'node:crypto'
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { REGION } from '../db/client'
import { outputs, required } from '../outputs'

/**
 * Amendment 1 section 7. UPI screenshots carry the payer's bank, account
 * holder and UPI id. They live in a private bucket, go up straight from the
 * browser on a presigned PUT so the bytes never pass through the server, and
 * come back down only through a presigned GET minted inside the admin path.
 * Never in an email, never in a response reachable without admin auth.
 */

// This module is server only. Nothing here may ever be reachable from the browser.

const ALLOWED: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic' }
export const MAX_SCREENSHOT_BYTES = 8 * 1024 * 1024
/** Long enough to upload a phone screenshot on bad wifi, short enough to be useless later. */
const UPLOAD_URL_SECONDS = 10 * 60
/** An admin opens it from the queue; a minute is plenty and the link dies in the history. */
const VIEW_URL_SECONDS = 60

let client: S3Client | null = null
const s3 = () => (client ??= new S3Client({ region: REGION }))

export function screenshotBucket(): string {
  return required((o) => o.custom?.scdScreenshotBucket, 'SCD_SCREENSHOT_BUCKET')
}

/** True once the backend has a bucket to write to. The launch guard asks. */
export const screenshotsConfigured = () => Boolean(outputs()?.custom?.scdScreenshotBucket ?? process.env.SCD_SCREENSHOT_BUCKET)

export type UploadGrant = { key: string; url: string; headers: Record<string, string>; expiresIn: number }

/**
 * A one-shot URL to PUT one image for one pass. The content type and length
 * are signed into it, so nothing else can be uploaded with it.
 */
export async function presignUpload(passId: string, contentType: string, bytes: number): Promise<UploadGrant | { error: string }> {
  const ext = ALLOWED[contentType]
  if (!ext) return { error: 'Upload a JPEG, PNG, WebP or HEIC screenshot.' }
  if (!Number.isInteger(bytes) || bytes <= 0 || bytes > MAX_SCREENSHOT_BYTES) return { error: 'The screenshot must be under 8 MB.' }
  const key = `screenshots/${passId}/${randomUUID()}.${ext}`
  const url = await getSignedUrl(
    s3(),
    new PutObjectCommand({ Bucket: screenshotBucket(), Key: key, ContentType: contentType, ContentLength: bytes }),
    { expiresIn: UPLOAD_URL_SECONDS },
  )
  return { key, url, headers: { 'content-type': contentType }, expiresIn: UPLOAD_URL_SECONDS }
}

/** Whether the object the browser says it uploaded is actually there and is this pass's. */
export async function screenshotExists(passId: string, key: string): Promise<boolean> {
  if (!key.startsWith(`screenshots/${passId}/`)) return false
  try {
    await s3().send(new HeadObjectCommand({ Bucket: screenshotBucket(), Key: key }))
    return true
  } catch {
    return false
  }
}

/** Only ever called after requireAdmin. */
export function presignView(key: string): Promise<string> {
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: screenshotBucket(), Key: key }), { expiresIn: VIEW_URL_SECONDS })
}
