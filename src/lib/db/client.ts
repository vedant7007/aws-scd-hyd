import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'

// This module is server only. Importing it from a client component is a bug,
// see SPEC.md section 7. Nothing here may ever be reachable from the browser.

export const REGION = process.env.AWS_REGION ?? 'ap-south-1'

export const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
})

/**
 * Read at call time rather than module scope, so a missing env var fails the
 * request that needed it instead of the whole build.
 */
export function tableName(): string {
  const name = process.env.SCD_TABLE_NAME
  if (!name) throw new Error('SCD_TABLE_NAME is not set')
  return name
}
