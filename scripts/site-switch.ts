/**
 * The kill switch, see src/proxy.ts.
 *
 *   AWS_PROFILE=scd SCD_TABLE_NAME=<production table> npm run site -- off
 *   AWS_PROFILE=scd SCD_TABLE_NAME=<production table> npm run site -- on
 *
 * off: every page, admin included, answers 503 within about five seconds.
 * on:  everything is back within about five seconds. Nothing else changes.
 */
import { UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, tableName } from '../src/lib/db/client'
import { keys } from '../src/lib/db/keys'

// An explicit SCD_TABLE_NAME wins: tableName() prefers the local sandbox
// outputs file, and the switch must hit the table it is told to.
const table = process.env.SCD_TABLE_NAME || tableName()
const arg = process.argv[2]
if (arg !== 'on' && arg !== 'off') {
  console.error('usage: npm run site -- on|off')
  process.exit(1)
}
ddb
  .send(new UpdateCommand({ TableName: table, Key: keys.config(), UpdateExpression: 'SET siteOffline = :v', ExpressionAttributeValues: { ':v': arg === 'off' } }))
  .then(() => console.log(`site ${arg === 'off' ? 'OFFLINE (503 everywhere)' : 'ONLINE'} on ${table}`))
