import { defineBackend } from '@aws-amplify/backend'
import { Duration, RemovalPolicy, Stack } from 'aws-cdk-lib'
import { AttributeType, BillingMode, ProjectionType, Table } from 'aws-cdk-lib/aws-dynamodb'
import { PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam'
import { HostedZone, MxRecord, TxtRecord } from 'aws-cdk-lib/aws-route53'
import { BlockPublicAccess, Bucket, BucketEncryption, HttpMethods } from 'aws-cdk-lib/aws-s3'
import { ConfigurationSet, ConfigurationSetEventDestination, EmailSendingEvent, EventDestination } from 'aws-cdk-lib/aws-ses'
import { Topic } from 'aws-cdk-lib/aws-sns'
import { LambdaSubscription } from 'aws-cdk-lib/aws-sns-subscriptions'
import { AwsCustomResource, AwsCustomResourcePolicy, PhysicalResourceId } from 'aws-cdk-lib/custom-resources'
import { auth } from './auth/resource'
import { emailEvents } from './functions/email-events/resource'
import { reconcile } from './functions/reconcile/resource'

const backend = defineBackend({ auth, reconcile, emailEvents })

/**
 * Organisers only. Self sign up is off, so an account exists only because an
 * admin created it from the crew page, and /admin still looks the email up
 * in the table for a role afterwards. Two gates, because Cognito membership
 * alone is not authorisation.
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

/**
 * UPI payment screenshots. They carry the payer's bank, account holder and
 * UPI id, so: private, encrypted, SSL only, never listed, and read only by an
 * admin through a presigned URL minted inside requireAdmin. The browser
 * uploads straight to the bucket with a presigned PUT, so the bytes never
 * pass through the Next.js server. Every object is deleted 30 days after the
 * event date, whatever else happens.
 */
const EVENT_DATE_PLUS_30 = new Date('2026-11-29T00:00:00Z')
const siteOrigins = [process.env.NEXT_PUBLIC_SITE_URL, 'http://localhost:3000', 'http://localhost:3123', 'http://localhost:3124'].filter(
  (o): o is string => Boolean(o),
)
const screenshots = new Bucket(data, 'Screenshots', {
  blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
  encryption: BucketEncryption.S3_MANAGED,
  enforceSSL: true,
  removalPolicy: RemovalPolicy.RETAIN,
  lifecycleRules: [{ id: 'delete-30-days-after-the-event', expirationDate: EVENT_DATE_PLUS_30 }],
  cors: [{ allowedMethods: [HttpMethods.PUT], allowedOrigins: siteOrigins, allowedHeaders: ['content-type'], maxAge: 3600 }],
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

// The reconcile Lambda reads and writes the table, asks Razorpay what settled,
// and sends the confirmation for anything it applies or finds owed.
const reconcileLambda = backend.reconcile.resources.lambda
table.grantReadWriteData(reconcileLambda)
reconcileLambda.addToRolePolicy(sesSend)
backend.reconcile.addEnvironment('SCD_TABLE_NAME', table.tableName)
for (const [key, value] of Object.entries(emailEnv)) backend.reconcile.addEnvironment(key, value)

/**
 * Razorpay API keys, passed through from the deploying environment: the
 * Amplify app's variables in production, the shell for a sandbox. Absent means
 * the reconcile run fails loudly on its first API call and says which key is
 * missing, which the dashboard then shows. The webhook secret is not needed
 * here; only the Hosting server receives webhooks.
 */
for (const key of ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'] as const) {
  backend.reconcile.addEnvironment(key, process.env[key] ?? '')
}
// Which way money moves. Manual unless the deploying environment says otherwise.
backend.reconcile.addEnvironment('PAYMENT_MODE', process.env.PAYMENT_MODE ?? 'manual')

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
screenshots.grantReadWrite(ssrCompute)
ssrCompute.addToPolicy(sesSend)
// The crew page creates and removes sign-in accounts. Create, set the
// discarded initial password, delete: nothing that reads a password back.
ssrCompute.addToPolicy(
  new PolicyStatement({
    actions: ['cognito-idp:AdminCreateUser', 'cognito-idp:AdminSetUserPassword', 'cognito-idp:AdminDeleteUser'],
    resources: [backend.auth.resources.userPool.userPoolArn],
  }),
)

/* ---------------------------------------------------------------------------
   Deliverability. DMARC, and a custom MAIL FROM so SPF aligns with the From
   domain instead of the Return-Path sitting at amazonses.com.

   These are facts about the account, not about an environment: one hosted
   zone, one SES identity. Only one stack may own them or the second would
   fail on a duplicate record set, so they are created only where
   SCD_MANAGE_DNS is set, which is the production build and nowhere else.
   A sandbox never touches public DNS.
   --------------------------------------------------------------------------- */

const DOMAIN = 'awsscdhyd.in'
const MAIL_FROM = `mail.${DOMAIN}`
const HOSTED_ZONE_ID = 'Z099191220F3K13R283RC'

if (process.env.SCD_MANAGE_DNS === 'true') {
  const dns = backend.createStack('scd-dns')

  // Attributes, not a lookup: a lookup runs an API call at synth time under
  // whatever credentials are deploying, and this must synthesize identically
  // everywhere.
  const zone = HostedZone.fromHostedZoneAttributes(dns, 'Zone', {
    hostedZoneId: HOSTED_ZONE_ID,
    zoneName: DOMAIN,
  })

  /**
   * DMARC at p=none: monitor only, nothing is rejected or quarantined.
   * Aggregate reports arrive at the rua address as XML attachments, which is
   * expected. Tighten to quarantine, then reject, once the reports show every
   * legitimate source aligning.
   */
  new TxtRecord(dns, 'Dmarc', {
    zone,
    recordName: '_dmarc',
    values: [`v=DMARC1; p=none; rua=mailto:${process.env.SES_REPLY_TO ?? 'awssbgvjit@gmail.com'}`],
    ttl: Duration.seconds(300),
  })

  /**
   * Custom MAIL FROM. SES needs an MX pointing at its feedback host for the
   * region and an SPF record authorising amazonses.com on that subdomain.
   * With these in place the envelope sender is @mail.awsscdhyd.in, which is
   * organisationally aligned with the From domain, so SPF passes DMARC too.
   */
  new MxRecord(dns, 'MailFromMx', {
    zone,
    recordName: 'mail',
    values: [{ priority: 10, hostName: `feedback-smtp.${Stack.of(dns).region}.amazonses.com` }],
    ttl: Duration.seconds(300),
  })

  new TxtRecord(dns, 'MailFromSpf', {
    zone,
    recordName: 'mail',
    values: ['v=spf1 include:amazonses.com ~all'],
    ttl: Duration.seconds(300),
  })

  /**
   * The identity was verified by hand and is not a CDK resource, so its MAIL
   * FROM attributes are set through an SDK call. USE_DEFAULT_VALUE, not
   * REJECT_MESSAGE: if the MX record ever fails to resolve, SES falls back to
   * its own envelope domain and mail still goes out, rather than stopping.
   * No onDelete, so tearing down the stack leaves the identity as it is.
   */
  new AwsCustomResource(dns, 'MailFrom', {
    resourceType: 'Custom::SesMailFrom',
    onCreate: {
      service: '@aws-sdk/client-sesv2',
      action: 'PutEmailIdentityMailFromAttributes',
      parameters: {
        EmailIdentity: DOMAIN,
        MailFromDomain: MAIL_FROM,
        BehaviorOnMxFailure: 'USE_DEFAULT_VALUE',
      },
      physicalResourceId: PhysicalResourceId.of(`mail-from-${DOMAIN}`),
    },
    onUpdate: {
      service: '@aws-sdk/client-sesv2',
      action: 'PutEmailIdentityMailFromAttributes',
      parameters: {
        EmailIdentity: DOMAIN,
        MailFromDomain: MAIL_FROM,
        BehaviorOnMxFailure: 'USE_DEFAULT_VALUE',
      },
      physicalResourceId: PhysicalResourceId.of(`mail-from-${DOMAIN}`),
    },
    policy: AwsCustomResourcePolicy.fromSdkCalls({
      resources: [
        Stack.of(dns).formatArn({ service: 'ses', resource: 'identity', resourceName: DOMAIN }),
      ],
    }),
  })
}

// Copy these out of amplify_outputs.json: scdTableName into SCD_TABLE_NAME,
// sesConfigurationSet into SES_CONFIGURATION_SET, and ssrComputeRoleArn onto
// the Hosting branch as its compute role.
backend.addOutput({
  custom: {
    scdTableName: table.tableName,
    scdScreenshotBucket: screenshots.bucketName,
    scdRegion: Stack.of(table).region,
    sesConfigurationSet: outbound.configurationSetName,
    ssrComputeRoleArn: ssrCompute.roleArn,
  },
})
