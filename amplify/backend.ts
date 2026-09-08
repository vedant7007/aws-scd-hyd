import { defineBackend } from '@aws-amplify/backend'
import { RemovalPolicy, Stack } from 'aws-cdk-lib'
import { AttributeType, BillingMode, ProjectionType, Table } from 'aws-cdk-lib/aws-dynamodb'
import { auth } from './auth/resource'
import { reconcile } from './functions/reconcile/resource'

const backend = defineBackend({ auth, reconcile })

/**
 * Organisers only. Self sign up is off, so an account exists only because an
 * admin created it, and /admin still checks the email against ADMIN_EMAILS
 * afterwards. Two gates, because Cognito membership alone is not authorisation.
 */
const { cfnUserPool, cfnUserPoolClient } = backend.auth.resources.cfnResources
cfnUserPool.adminCreateUserConfig = { allowAdminCreateUserOnly: true }

/**
 * USER_PASSWORD_AUTH so the sign in round trip happens on our server rather
 * than in the browser. SPEC.md section 7 forbids AWS SDK calls from client
 * components, and the SRP flow the Amplify UI library uses runs client side.
 */
cfnUserPoolClient.explicitAuthFlows = ['ALLOW_USER_PASSWORD_AUTH', 'ALLOW_REFRESH_TOKEN_AUTH']

const data = backend.createStack('scd-data')

/**
 * One table for everything, see SPEC.md section 6. RETAIN because tearing down
 * a sandbox must never be able to delete attendee records.
 */
const table = new Table(data, 'ScdTable', {
  partitionKey: { name: 'PK', type: AttributeType.STRING },
  sortKey: { name: 'SK', type: AttributeType.STRING },
  billingMode: BillingMode.PAY_PER_REQUEST,
  pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
  // Rate limit counters carry expiresAt and clean themselves up. Nothing that
  // matters ever gets a TTL, so attendee records are unaffected.
  timeToLiveAttribute: 'expiresAt',
  removalPolicy: RemovalPolicy.RETAIN,
})

table.addGlobalSecondaryIndex({
  indexName: 'GSI1',
  partitionKey: { name: 'GSI1PK', type: AttributeType.STRING },
  sortKey: { name: 'GSI1SK', type: AttributeType.STRING },
  projectionType: ProjectionType.ALL,
})

// Copy scdTableName out of amplify_outputs.json into SCD_TABLE_NAME.
backend.addOutput({
  custom: {
    scdTableName: table.tableName,
    scdRegion: Stack.of(table).region,
  },
})

// The reconcile Lambda is the only backend component that touches the table,
// and it gets exactly the access it needs, nothing wider.
table.grantReadWriteData(backend.reconcile.resources.lambda)
backend.reconcile.addEnvironment('SCD_TABLE_NAME', table.tableName)
backend.reconcile.addEnvironment('TICKETING_PROVIDER', process.env.TICKETING_PROVIDER ?? 'mock')

// TODO: the Amplify SSR compute role needs read and write on this table plus
// ses:SendEmail. That grant is wired when hosting is connected in phase 4.
