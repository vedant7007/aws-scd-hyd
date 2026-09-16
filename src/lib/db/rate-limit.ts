import { UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, tableName } from './client'

/**
 * SPEC.md section 7. Per IP, per hour, counted in the table rather than in
 * memory because Amplify Hosting runs more than one instance and an in memory
 * counter would reset on every cold start. Rows carry expiresAt and the table
 * TTL removes them.
 */
export async function withinRateLimit(ip: string, scope: string, limitPerHour: number): Promise<boolean> {
  const hourBucket = new Date().toISOString().slice(0, 13)
  // One hour past the bucket, so rows clean themselves up.
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 2

  const res = await ddb.send(
    new UpdateCommand({
      TableName: tableName(),
      Key: { PK: `RATE#${ip}`, SK: `${scope}#${hourBucket}` },
      UpdateExpression: 'ADD hits :one SET expiresAt = if_not_exists(expiresAt, :exp)',
      ExpressionAttributeValues: { ':one': 1, ':exp': expiresAt },
      ReturnValues: 'UPDATED_NEW',
    }),
  )

  return Number(res.Attributes?.hits ?? 0) <= limitPerHour
}

/** Trusts the leftmost hop of x-forwarded-for, which is what CloudFront sets. */
export function callerIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]!.trim()
  return req.headers.get('x-real-ip')?.trim() || 'unknown'
}
