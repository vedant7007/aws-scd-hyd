import { defineBackend } from '@aws-amplify/backend'
import { RemovalPolicy, Stack } from 'aws-cdk-lib'
import { AttributeType, BillingMode, ProjectionType, Table } from 'aws-cdk-lib/aws-dynamodb'
import { PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam'
import { ConfigurationSet, ConfigurationSetEventDestination, EmailSendingEvent, EventDestination } from 'aws-cdk-lib/aws-ses'
import { Topic } from 'aws-cdk-lib/aws-sns'
import { LambdaSubscription } from 'aws-cdk-lib/aws-sns-subscriptions'
import { auth } from './auth/resource'
import { emailEvents } from './functions/email-events/resource'
import { reconcile } from './functions/reconcile/resource'

const backend = defineBackend({ auth, reconcile, emailEvents })

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

/* ---------------------------------------------------------------------------
   Email. SPEC.md section 12, and the bounce handling committed to AWS Support.
   --------------------------------------------------------------------------- */

const mail = backend.createStack('scd-mail')

/**
 * Every email the site sends goes through this configuration set, which is
 * what turns a bounce or a complaint into an SNS event we can act on. The
 * identity itself, awsscdhyd.in, was verified by hand and is not managed here.
 */
const outbound = new ConfigurationSet(mail, 'Outbound', {
  reputationMetrics: true,
})

const bounces = new Topic(mail, 'Bounces', { displayName: 'SES bounces, awsscdhyd.in' })
const complaints = new Topic(mail, 'Complaints', { displayName: 'SES complaints, awsscdhyd.in' })

// CDK adds the topic policy that lets ses.amazonaws.com publish, scoped to
// this configuration set, so nothing else can post into these topics.
new ConfigurationSetEventDestination(mail, 'BouncesToSns', {
  configurationSet: outbound,
  destination: EventDestination.snsTopic(bounces),
  events: [EmailSendingEvent.BOUNCE],
})

new ConfigurationSetEventDestination(mail, 'ComplaintsToSns', {
  configurationSet: outbound,
  destination: EventDestination.snsTopic(complaints),
  events: [EmailSendingEvent.COMPLAINT],
})

// One handler for both. It records the event and suppresses the address.
const eventsLambda = backend.emailEvents.resources.lambda
bounces.addSubscription(new LambdaSubscription(eventsLambda))
complaints.addSubscription(new LambdaSubscription(eventsLambda))
table.grantReadWriteData(eventsLambda)
eventsLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['ses:PutSuppressedDestination'],
    resources: ['*'],
  }),
)
backend.emailEvents.addEnvironment('SCD_TABLE_NAME', table.tableName)

/**
 * Sending. The From and Reply-To are fixed by SPEC.md section 12 and are not
 * secrets, so they default here and can still be overridden from the build
 * environment. NEXT_PUBLIC_SITE_URL has no safe default: the pass link in every
 * email is built from it, and the send layer refuses a localhost origin.
 */
const sesSend = new PolicyStatement({
  actions: ['ses:SendEmail', 'ses:SendRawEmail'],
  resources: ['*'],
})

const emailEnv = {
  EMAIL_TRANSPORT: 'ses',
  SES_FROM: process.env.SES_FROM ?? 'AWS SBG VJIT <vjit@awsscdhyd.in>',
  SES_REPLY_TO: process.env.SES_REPLY_TO ?? 'awssbgvjit@gmail.com',
  SES_CONFIGURATION_SET: outbound.configurationSetName,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? '',
}

/* ---------------------------------------------------------------------------
   Grants.
   --------------------------------------------------------------------------- */

// The reconcile Lambda reads and writes the table, and sends the confirmation
// for any attendee it inserts or finds owed one.
const reconcileLambda = backend.reconcile.resources.lambda
table.grantReadWriteData(reconcileLambda)
reconcileLambda.addToRolePolicy(sesSend)
backend.reconcile.addEnvironment('SCD_TABLE_NAME', table.tableName)
backend.reconcile.addEnvironment('TICKETING_PROVIDER', process.env.TICKETING_PROVIDER ?? 'mock')
for (const [key, value] of Object.entries(emailEnv)) backend.reconcile.addEnvironment(key, value)

/**
 * The role the Next.js server runs as in Amplify Hosting. SPEC.md section 13.
 *
 * Hosting does not attach one on its own. Without it every page that reads
 * the table hangs at its loading state in production, which is exactly what
 * the live site was doing. The role is defined here so its permissions are
 * code, and its ARN is output so it can be attached to the branch.
 */
const ssrCompute = new Role(mail, 'SsrCompute', {
  assumedBy: new ServicePrincipal('amplify.amazonaws.com'),
  description: 'Amplify Hosting compute role for the aws-scd-hyd Next.js server',
})
table.grantReadWriteData(ssrCompute)
ssrCompute.addToPolicy(sesSend)

// Copy these out of amplify_outputs.json: scdTableName into SCD_TABLE_NAME,
// sesConfigurationSet into SES_CONFIGURATION_SET, and ssrComputeRoleArn onto
// the Hosting branch as its compute role.
backend.addOutput({
  custom: {
    scdTableName: table.tableName,
    scdRegion: Stack.of(table).region,
    sesConfigurationSet: outbound.configurationSetName,
    ssrComputeRoleArn: ssrCompute.roleArn,
  },
})
