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

const arg = process.argv[2]
if (arg !== 'on' && arg !== 'off') {
  console.error('usage: npm run site -- on|off')
  process.exit(1)
}
ddb
  .send(new UpdateCommand({ TableName: tableName(), Key: keys.config(), UpdateExpression: 'SET siteOffline = :v', ExpressionAttributeValues: { ':v': arg === 'off' } }))
  .then(() => console.log(`site ${arg === 'off' ? 'OFFLINE (503 everywhere)' : 'ONLINE'} on ${tableName()}`))
