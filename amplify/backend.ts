import { defineBackend } from '@aws-amplify/backend'
import { RemovalPolicy, Stack } from 'aws-cdk-lib'
import { AttributeType, BillingMode, ProjectionType, Table } from 'aws-cdk-lib/aws-dynamodb'
import { auth } from './auth/resource'

const backend = defineBackend({ auth })

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
