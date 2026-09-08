import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const OUTPUTS_FILE = 'amplify_outputs.json'

export type AmplifyOutputs = {
  auth?: {
    user_pool_id?: string
    user_pool_client_id?: string
    aws_region?: string
  }
  custom?: {
    scdTableName?: string
    scdRegion?: string
  }
}

let cache: AmplifyOutputs | null | undefined

/**
 * ampx writes amplify_outputs.json to the repo root on every sandbox deploy.
 * It is the single source of truth locally, so scripts, pages and route
 * handlers all resolve the same backend without anyone exporting a var.
 *
 * It is gitignored and is not guaranteed to sit next to the server bundle in
 * Amplify Hosting, which is why every read falls back to an env var.
 */
export function outputs(): AmplifyOutputs | null {
  if (cache !== undefined) return cache

  const path = join(process.cwd(), OUTPUTS_FILE)
  let raw: string
  try {
    raw = readFileSync(path, 'utf8')
  } catch (err) {
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

/** Reads from amplify_outputs.json first, then the env var, then fails loudly. */
export function required(pick: (o: AmplifyOutputs) => string | undefined, envVar: string): string {
  const value = (outputs() ? pick(outputs() as AmplifyOutputs) : undefined) ?? process.env[envVar]
  if (!value) {
    throw new Error(`Cannot resolve ${envVar}. Deploy the sandbox to generate ${OUTPUTS_FILE}, or set ${envVar}.`)
  }
  return value
}
