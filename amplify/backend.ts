import { defineBackend } from '@aws-amplify/backend'
import { RemovalPolicy, Stack } from 'aws-cdk-lib'
import { AttributeType, BillingMode, ProjectionType, Table } from 'aws-cdk-lib/aws-dynamodb'
import { auth } from './auth/resource'

const backend = defineBackend({ auth })

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

// TODO: reconcile function and its hourly EventBridge schedule land in phase 3.
// TODO: the Amplify SSR compute role needs read and write on this table plus
// ses:SendEmail. That grant is wired when hosting is connected in phase 1.
