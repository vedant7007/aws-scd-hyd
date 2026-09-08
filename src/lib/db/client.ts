import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { outputs, required } from '@/lib/outputs'

// This module is server only. Importing it from a client component is a bug,
// see SPEC.md section 7. Nothing here may ever be reachable from the browser.

export const REGION = outputs()?.custom?.scdRegion ?? process.env.AWS_REGION ?? 'ap-south-1'

export const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
})

/**
 * Read at call time rather than module scope, so a missing table name fails the
 * request that needed it instead of the whole build.
 */
export function tableName(): string {
  return required((o) => o.custom?.scdTableName, 'SCD_TABLE_NAME')
}
