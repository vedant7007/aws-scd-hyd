import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'

// This module is server only. Importing it from a client component is a bug,
// see SPEC.md section 7. Nothing here may ever be reachable from the browser.

const OUTPUTS_FILE = 'amplify_outputs.json'

type AmplifyOutputs = {
  custom?: {
    scdTableName?: string
    scdRegion?: string
  }
}

let cache: AmplifyOutputs | null | undefined

/**
 * ampx writes amplify_outputs.json to the repo root on every sandbox deploy.
 * It is the single source of truth locally, so `npm run seed`, `next dev` and
 * a route handler all resolve the same table without anyone exporting a var.
 *
 * It is gitignored and is not guaranteed to sit next to the server bundle in
 * Amplify Hosting, which is why every read falls back to an env var.
 */
function outputs(): AmplifyOutputs | null {
  if (cache !== undefined) return cache

  const path = join(process.cwd(), OUTPUTS_FILE)
  let raw: string
  try {
    raw = readFileSync(path, 'utf8')
  } catch (err) {
    // Not deployed yet, or running somewhere the file was not shipped.
    // Anything other than "no such file" is a real problem worth surfacing.
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
    cache = null
    return cache
  }

  try {
    cache = JSON.parse(raw) as AmplifyOutputs
  } catch (cause) {
    throw new Error(`${path} exists but is not valid JSON. Re-run the sandbox to regenerate it.`, { cause })
  }
  return cache
}

export const REGION = outputs()?.custom?.scdRegion ?? process.env.AWS_REGION ?? 'ap-south-1'

export const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
})

/**
 * Read at call time rather than module scope, so a missing table name fails the
 * request that needed it instead of the whole build.
 */
export function tableName(): string {
  const name = outputs()?.custom?.scdTableName ?? process.env.SCD_TABLE_NAME
  if (!name) {
    throw new Error(
      `Cannot resolve the DynamoDB table name. Deploy the sandbox to generate ${OUTPUTS_FILE}, or set SCD_TABLE_NAME.`,
    )
  }
  return name
}
