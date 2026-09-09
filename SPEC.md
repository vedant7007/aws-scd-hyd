# AWS_SCD_HYD — Build Specification

**Event** AWS Student Community Day Hyderabad
**Date** Friday 30 October 2026
**Venue** Vidya Jyothi Institute of Technology, Hyderabad
**Host** AWS Student Builders Group, VJIT
**Domain** awsscdhyd.in (registration pending, see Section 15)
**Repo** `github.com/vedant7007/aws-scd-hyd`
**Local path** `C:\CODING\aws-scd-hyd`
**AWS account** 588905689885, region `ap-south-1`
**Built by** Vedant Idlgave, solo

---

## 0. How to use this file

Read this in full before writing code. Re-read the relevant section before starting each task in Section 14.

Anything marked `TODO(vedant)` is an undecided value. Build around it using the stated placeholder, and never invent a real value in its place. Do not block waiting for it.

When `/init` generates `CLAUDE.md`, have it point here rather than duplicating this content.

---

## 1. What this is

A public event website with four jobs.

1. **Sell the event.** Landing page, tracks, speakers, schedule, venue, FAQ. This is most of the site and most of the work.
2. **Sell tickets.** Four paid tiers. Payment happens on an external provider's infrastructure, never in our code.
3. **Give each attendee a pass.** A tokenised link from their confirmation email opens their QR pass and their session picker. **There is no student login anywhere.**
4. **Run the day.** An organiser dashboard for check-in scanning, live counts, food totals and swag issuance.

### Explicitly not building

No student accounts, passwords, or sign-up. No payment processing, and we never see a card number. No CMS, content lives in typed files in `content/`. No blog, no forum.

---

## 2. Hard rules

1. **No AI attribution in git, anywhere.** No `Co-Authored-By` trailers, no "Generated with" lines, no AI names in commit messages, PR bodies, code comments or contributor files. Every commit is authored solely by Vedant. No exceptions.
2. **No em dashes in user-facing copy.** Commas, colons or full stops.
3. **No secrets in the repo.** `.env.local` is gitignored. `.env.example` is committed with empty values.
4. **All AWS access is server-side.** No AWS SDK calls from client components, ever. No AWS credentials reach the browser.
5. **All visual identity lives in `src/app/globals.css`.** If a component hardcodes a hex value, a font, a radius or a shadow, that is a bug. The theme is not final and changing it must be a one-file edit.
   *Amended.* The intent is one-file theme swapping, not banning `next/font`. Loading a face needs a real module import, so `src/app/layout.tsx` may name font families, self host them with `next/font`, and expose them as `--font-*-face` CSS variables. `globals.css` composes the actual stack, fallbacks included, from those variables, so changing a family is still an edit to `globals.css` plus the one import line. `npm run check:tokens` enforces the rule and exempts only that file, only for font names.
6. **TypeScript strict, no `any`.**
7. **Keyboard reachable, visible focus rings, and all motion respects `prefers-reduced-motion`.**

---

## 3. Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15, App Router, TypeScript strict, `src/` dir |
| Styling | Tailwind CSS v4 |
| Animation | Framer Motion |
| Hosting | AWS Amplify Hosting (SSR), includes CloudFront |
| Infrastructure | Amplify Gen 2, defined in `amplify/` as code |
| Database | DynamoDB, single table, **on-demand billing** |
| AWS access | AWS SDK v3, `@aws-sdk/client-dynamodb` and `@aws-sdk/lib-dynamodb` |
| Organiser auth | Cognito user pool via `defineAuth`, email allowlist |
| Email | Amazon SES |
| Scheduled jobs | EventBridge Scheduler to a Lambda |
| QR | `qrcode` server-side for emails, `qrcode.react` in the browser |

We are **not** using Amplify Data or AppSync. A GraphQL layer buys us nothing here and makes conditional writes awkward. Define a plain DynamoDB table in CDK and talk to it with the SDK from server code.

Node 22, npm. Region `ap-south-1` everywhere.

> **Deviation on record.** The scaffold in this repo is Next.js 16.3.4 with React 19.2.8, not Next.js 15. We build on 16. See `AGENTS.md`: read `node_modules/next/dist/docs/` before writing routing or data-fetching code, because 16 has breaking changes from 15.

---

## 4. Repo layout

```
aws-scd-hyd/
├─ amplify/
│  ├─ backend.ts              # composes everything, defines the table
│  ├─ auth/resource.ts        # Cognito, organisers only
│  └─ functions/
│     └─ reconcile/           # scheduled reconciliation Lambda
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx
│  │  ├─ page.tsx
│  │  ├─ globals.css          # ALL design tokens
│  │  ├─ schedule/page.tsx
│  │  ├─ speakers/page.tsx
│  │  ├─ sponsors/page.tsx
│  │  ├─ code-of-conduct/page.tsx
│  │  ├─ pass/[token]/page.tsx
│  │  ├─ admin/
│  │  │  ├─ page.tsx
│  │  │  └─ scan/page.tsx
│  │  └─ api/
│  │     ├─ subscribe/route.ts
│  │     ├─ webhook/ticketing/route.ts
│  │     └─ pass/[token]/sessions/route.ts
│  ├─ components/
│  │  ├─ layout/              # Header, Footer, ThemeToggle, Container
│  │  ├─ home/                # Hero, Ticker, Countdown, Tracks, Passes...
│  │  ├─ pass/                # PassCard, SessionPicker, QrPass
│  │  ├─ admin/               # StatCard, AttendeeTable, Scanner
│  │  └─ ui/
│  ├─ content/                # typed content, one file per domain
│  │  ├─ event.ts   ├─ tracks.ts   ├─ speakers.ts
│  │  ├─ passes.ts  ├─ sponsors.ts ├─ faq.ts ├─ schedule.ts
│  └─ lib/
│     ├─ db/       ├─ client.ts ├─ keys.ts ├─ types.ts ├─ queries.ts
│     ├─ tickets/  ├─ provider.ts ├─ mock.ts ├─ konfhub.ts ├─ razorpay.ts
│     ├─ email/    └─ send.ts
│     └─ utils.ts
├─ scripts/seed.ts
├─ .env.example
└─ SPEC.md
```

---

## 5. Environment

`.env.example`, committed with empty values:

```bash
AWS_REGION=ap-south-1
SCD_TABLE_NAME=

# "mock" for all local development until payments are decided
TICKETING_PROVIDER=mock
TICKETING_WEBHOOK_SECRET=
KONFHUB_API_KEY=
KONFHUB_EVENT_ID=

# Send only. There is no mailbox on awsscdhyd.in, so replies must go elsewhere.
SES_FROM="AWS SBG VJIT <vjit@awsscdhyd.in>"
SES_REPLY_TO=awssbgvjit@gmail.com
ADMIN_EMAILS=
CRON_SECRET=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Locally, credentials come from the `scd` CLI profile, so set `AWS_PROFILE=scd` rather than putting keys in `.env.local`. In Amplify Hosting, the SSR compute role supplies credentials automatically and there are no keys at all.

`TICKETING_PROVIDER=mock` is what lets the entire flow be built and tested before the domain, SES access or a merchant account exist. Nothing waits on paperwork.

---

## 6. Data model

One DynamoDB table. `PK` and `SK` as strings, one global secondary index `GSI1` on `GSI1PK` and `GSI1SK`. On-demand billing. Point-in-time recovery on.

| Item | PK | SK | GSI1PK | GSI1SK |
|---|---|---|---|---|
| Attendee | `ATT#<ticketRef>` | `PROFILE` | `TOKEN#<passToken>` | `ATT` |
| Selection | `ATT#<ticketRef>` | `SLOT#<slotId>` | | |
| Session | `SESSION#<sessionId>` | `META` | `SLOT#<slotId>` | `SESSION#<sessionId>` |
| Config | `CONFIG` | `EVENT` | | |
| Subscriber | `SUB#<email>` | `PROFILE` | `SUBS` | `<createdAt ISO>` |

**Attendee attributes**
`ticketRef, passToken, name, email` (lowercased on write)`, phone, college, tier` (`basic` | `premium` | `ultra` | `vip`)`, foodPreference` (`veg` | `nonveg` | `jain`)`, paymentStatus` (`paid` | `refunded` | `cancelled`)`, checkedInAt, swagIssuedAt, source` (`webhook` | `reconcile` | `manual`)`, createdAt`

**Session attributes**
`title, speaker, track` (`ai` | `cloud` | `career`)`, hallId, slotId, capacity, seatsTaken`

**Config attributes**
`halls: { id, name, capacity }[]`, `slots: { id, label, startsAt, endsAt }[]`, `registrationOpen: boolean`

`TODO(vedant)`: hall count is 3 or 4 and unconfirmed. Every hall feature reads from `config.halls`. Never hardcode four.

### Access patterns

| Need | Query |
|---|---|
| Attendee by pass token | GSI1, `GSI1PK = TOKEN#<token>` |
| Attendee plus all their selections | Query `PK = ATT#<ref>` |
| All sessions in a slot | GSI1, `GSI1PK = SLOT#<slotId>` |
| All subscribers by date | GSI1, `GSI1PK = SUBS` |
| Every attendee, for the admin table | Scan with a `PROFILE` filter |

The Scan is deliberate. At a few thousand items it costs a fraction of a rupee and is far simpler than another index. Do not add a GSI to avoid it.

---

## 7. Security

- **Nothing client-side ever touches AWS.** All reads and writes happen in server components, route handlers, or Lambdas.
- `passToken` is 16 url-safe chars from `crypto.randomBytes`. Never `Math.random`, never derived from email or ticket ref.
- `/api/webhook/ticketing` verifies the provider signature against `TICKETING_WEBHOOK_SECRET` **before parsing the body**. Unverified requests get a 401 and the body is not logged.
- `/api/subscribe` validates the email server-side and rate limits to 5 per IP per hour.
- The reconcile Lambda is invoked by EventBridge and is not publicly reachable.
- `/pass/[token]` sets `noindex`. Pass URLs never appear in the sitemap.
- `/admin/*` checks the Cognito session and that the email is in `ADMIN_EMAILS`. A signed-in user not on the list gets an explicit refusal, not a blank page.

---

## 8. Ticketing abstraction

The payment provider is undecided. **No provider-specific code exists outside `src/lib/tickets/`.**

```ts
export type TicketEvent = {
  type: 'registered' | 'cancelled' | 'refunded'
  ticketRef: string
  name: string
  email: string
  phone: string
  college: string
  tier: Attendee['tier']
  foodPreference: Attendee['foodPreference']
}

export interface TicketingProvider {
  checkoutUrl(tierId: string): string
  verifyAndParse(req: Request): Promise<TicketEvent | null>
  listAll(): Promise<TicketEvent[]>
}
```

Implementations: `mock.ts`, `konfhub.ts`, `razorpay.ts`. Chosen at runtime from `TICKETING_PROVIDER`. Switching providers must be one env var change. If it is not, the abstraction is wrong.

### Webhook flow

1. Verify signature, else 401.
2. Parse to `TicketEvent`.
3. `PutItem` with `ConditionExpression: attribute_not_exists(PK)`. On `ConditionalCheckFailedException`, update the existing item instead. **Providers retry webhooks, and duplicate attendees are the single most likely bug in this system.**
4. On create, generate `passToken`, write, then send the confirmation email via SES.
5. On `cancelled` or `refunded`, set `paymentStatus` and delete their selections inside a `TransactWriteItems` that decrements each affected session's `seatsTaken`.
6. **Always return 200 to a verified request**, even on internal failure. Log the failure. A non-200 makes the provider retry indefinitely.

### Reconciliation, not optional

Lambda in `amplify/functions/reconcile`, triggered hourly by EventBridge Scheduler.

1. `listAll()` from the provider.
2. Anything present there and missing here gets inserted with `source: 'reconcile'` and its email sent.
3. Anything marked paid here but cancelled there gets deactivated and its seats freed.
4. Write a summary item and surface the last run plus mismatch count on the admin dashboard.

Without this, one failed webhook means a student arrives on 30 October holding a valid ticket that we have no record of.

---

## 9. Seat claiming

This is the one genuinely hard piece. Get it right and test it properly.

An attendee picks one session per slot. Their tier decides how many slots they may fill. `TODO(vedant)`: per-tier allowance, read from `content/passes.ts`, never hardcoded.

One selection per slot is enforced by the key itself: `PK = ATT#<ref>`, `SK = SLOT#<slotId>`. No application logic needed to prevent double booking.

Claiming a seat is a single `TransactWriteItems`:

```ts
// 1. increment the new session, only if it has room
{ Update: {
    Key: { PK: `SESSION#${newId}`, SK: 'META' },
    UpdateExpression: 'SET seatsTaken = seatsTaken + :one',
    ConditionExpression: 'seatsTaken < capacity',
    ExpressionAttributeValues: { ':one': 1 }
}}
// 2. write the selection
{ Put: { Item: { PK: `ATT#${ref}`, SK: `SLOT#${slotId}`, sessionId: newId, ... } } }
// 3. only when replacing an existing choice, release the old seat
{ Update: {
    Key: { PK: `SESSION#${oldId}`, SK: 'META' },
    UpdateExpression: 'SET seatsTaken = seatsTaken - :one',
    ConditionExpression: 'seatsTaken > :zero',
    ExpressionAttributeValues: { ':one': 1, ':zero': 0 }
}}
```

All three succeed or none do. **Never increment and decrement as separate calls.**

On `TransactionCanceledException` where the cancellation reason is `ConditionalCheckFailed` on the new session, the hall filled up while they were deciding. Return a clear message saying exactly that and refresh the counts, do not show a generic error.

UI: show live remaining seats, disable a full session with the reason visible rather than just greyed out.

**Test:** two browser windows claiming the last seat of a one-seat session at the same time. Exactly one must win. If both succeed, the transaction is wrong.

---

## 10. Design tokens

The theme is **not final**. It lands from the design team on 12 September. Everything must be swappable in one file.

```css
:root {
  --bg:#FFFFFF; --surface:#F6F6F5; --text:#0A0A0A;
  --muted:#6B6B6B; --border:#E4E4E3;
  --accent:#FF9900; --accent-ink:#0A0A0A;
  --font-display:"Bricolage Grotesque", system-ui, sans-serif;
  --font-body:"Inter", system-ui, sans-serif;
  --font-mono:"JetBrains Mono", ui-monospace, monospace;
  --radius:2px; --gutter:clamp(1.25rem,4vw,4rem); --measure:68ch;
}
[data-theme="dark"] {
  --bg:#0A0A0A; --surface:#141414; --text:#FAFAFA;
  --muted:#8A8A8A; --border:#232323;
  --accent:#FF9900; --accent-ink:#0A0A0A;
}
```

Light and dark are both first class. Default to the OS preference, allow a manual toggle, persist in a cookie so the server render matches and there is no flash on load.

Type scale uses `clamp()` throughout, no fixed pixel sizes. Display type runs large and tight, weight 700 to 800, `letter-spacing:-0.04em`, `line-height:0.9`.

Layout is minimal. Whitespace and type size carry the hierarchy. No card grids, no drop shadows, no gradient decoration, no rounded boxes around everything. One orchestrated entrance per page, not a fade-up on every section as you scroll.

---

## 11. Pages

### `/` landing

In order, each its own component file.

1. **Hero.** Name, Hyderabad, date, venue, CTA to passes, countdown to `2026-10-30T09:00:00+05:30`, and a pointer-reactive canvas background that animates gently on its own on mobile. Keep the background in one swappable component, the visual is `TODO(vedant)`.
2. **Ticker.** Marquee band in accent colour.
3. **About.** Three or four sentences. Not a wall.
4. **Tracks.** AI and agents, cloud engineering, careers. Large type, hairline separated, no cards.
5. **Speakers.** Must render well with zero or one entry, with a real "announced soon" state. No placeholder silhouettes.
6. **Passes.** Four tiers, each with price, an itemised inclusion list, and swag level. One marked recommended. Early bird expiry date shown, with a plain note that price rises after. Lunch is included on every tier and says so on every tier.
7. **Sponsors.** Tiered logo wall with an empty state, plus a become-a-sponsor block with a fixed mail subject format.
8. **Venue.** Address, map, metro, bus, cab, parking.
9. **FAQ.** Accordion, keyboard operable.
10. **Footer.** Contact, socials, code of conduct link, and this exact line: *AWS User Groups are run by independent volunteers and are not organized by AWS.*

### `/schedule`
Time down, halls across. On mobile, a per-hall vertical list. Never a horizontally scrolling table.

### `/pass/[token]`
Server component. Look up by token via GSI1. Invalid token renders a plain "this pass link is not valid, check your confirmation email or write to us". Never a stack trace, never a redirect to a login that does not exist.

Shows name, tier, a QR encoding `ticketRef`, food preference, the session picker, and an add-to-calendar link. Must be legible on a phone in bright sunlight at a gate: high contrast, large QR.

### `/admin` and `/admin/scan`
Cognito sign-in, `ADMIN_EMAILS` allowlist.

Dashboard: total registrations, split by tier, seats left per hall, **food preference totals with CSV export** (this number goes to the caterer), check-in count, last reconcile run and mismatch count, searchable attendee table.

Scanner: camera QR scan, look up by `ticketRef`, show name, tier and food preference in large type, buttons to mark checked in and swag issued. An already-checked-in scan says so clearly rather than silently succeeding. **Queue writes and retry on failure, because campus wifi will fail on the day.**

---

## 12. Email

SES, `ap-south-1`. Three templates, plain and mobile-legible.

1. **Confirmation.** Name, tier, the pass link, date, venue, what to bring. The pass link is the single most important thing in the email, so make it obvious.
2. **Session reminder.** Sent to anyone who has not picked sessions, a week out.
3. **Day before.** Timings, directions, the pass link again.

### Addresses

| Header | Value |
|---|---|
| `From` | `AWS SBG VJIT <vjit@awsscdhyd.in>` |
| `Reply-To` | `awssbgvjit@gmail.com` |
| Public contact on the site | `awssbgvjit@gmail.com` |

**The domain is send only. There is no mailbox on `awsscdhyd.in`.** Nothing delivered to `vjit@awsscdhyd.in` is ever read, so every outbound message must set `Reply-To`, and the site never prints a domain address as a way to reach us. A student replying to a confirmation email has to land in the Gmail inbox, not in a black hole.

Set `Reply-To` in the SES call itself, not in the template body. A template that says "write to us at" and an envelope that replies elsewhere will drift apart.

Until SES production access is granted the account is sandboxed and can only send to verified addresses. Verify `awssbgvjit@gmail.com` first so the whole loop is testable before the domain is live. Build against a `console.log` transport in development.

---

## 13. Infrastructure

`amplify/backend.ts` defines:
- The DynamoDB table above, on-demand, PITR enabled, `RemovalPolicy.RETAIN`
- The Cognito pool via `defineAuth`
- The reconcile function and its EventBridge hourly schedule
- Grants: the Amplify SSR compute role gets read and write on the table, plus `ses:SendEmail`

Everything is code. Nothing is clicked in the console except the one-time bootstrap, the GitHub connection, and the SES production request.

---

## 14. Build order

**Phase 0, now.** Bootstrap the region as `Vedant-admin`, get `npx ampx sandbox` running, define the table, wire `lib/db`, write `scripts/seed.ts` producing 50 fake attendees and a full session grid. Verify with the AWS CLI that items actually landed.

**Phase 1.** Design tokens, layout shell, theme toggle with no flash. Then hero, ticker, countdown, tracks. Deploy to Amplify Hosting and confirm the live URL works.

**Phase 2.** Mock ticketing provider, webhook route with idempotency, pass page, session picker with the transaction, and the two-window race test. All against seeded data, no real provider.

**Phase 3.** Cognito, admin dashboard, scanner with offline queueing. Reconcile Lambda and schedule.

**Phase 4.** Real content as it arrives from the team on 12 September. Theme replacement. Real ticketing provider once payments are decided. SES production access. Domain attached.

**Phase 5, week of 21 October.** Content freeze. Rehearse check-in with 50 fake passes on real campus wifi. Take a manual DynamoDB backup the night before.

---

## 15. Blocked on Vedant

| Item | Blocks |
|---|---|
| Register `awsscdhyd.in` | SES verification, domain attachment |
| SES production access | All real email. Longest lead time |
| One-time CDK bootstrap as admin | The first sandbox deploy |
| Connect Amplify to GitHub | Automatic deploys |
| Pass tier names, prices, inclusions, swag levels | Section 11 item 6 |
| Sessions allowed per tier | Section 9 |
| Confirmed hall count, names, capacities | Config item, schedule page |
| Registration open date and early bird expiry | Countdown and urgency copy |
| Final theme (due 12 Sept) | Section 10 |
| Payment provider | `konfhub.ts` or `razorpay.ts` |
| Speaker list, sponsor tiers, FAQ, code of conduct copy | Content files |

---

## 16. Live status

Kept current as work lands. Everything else in this file is the plan, this section is the fact.

**Phases 0 to 3 are built and deployed to the sandbox. Phase 4 is content and paperwork, which is on Vedant.**

| Thing | State |
|---|---|
| Sandbox backend | deployed: table, Cognito pool, reconcile Lambda, hourly schedule |
| Amplify Hosting | building from `main` |
| Landing page, schedule, speakers, sponsors, code of conduct | built |
| Pass page, QR, session picker, seat transaction | built, race test passes |
| Ticketing | mock only, by design. No konfhub.ts, no razorpay.ts |
| Organiser auth, dashboard, scanner | built, gated on ADMIN_EMAILS |
| Reconcile | hourly, verified to report and repair a deleted record |
| Email | not built. SES sandboxed and no domain, SPEC.md section 15 |
| Theme | placeholder tokens, awaiting 12 September |

### Verified numbers

Production build, median of five warm requests, local:

| Route | TTFB |
|---|---|
| public pages | 14 to 21 ms |
| `/admin` | 30 ms, was 186 ms before the session cache |
| `/admin/scan` | 20 ms, was 147 ms |
| scan lookup round trip | 41 ms |

Cognito `InitiateAuth` costs 135 ms from here and DynamoDB 26 to 40 ms, which is why the resolved session is cached. The window is five seconds: it is the delay before an `ADMIN_EMAILS` removal bites, and on event day that has to be near immediate, so most of the latency win is given back on purpose.

Landing page ships 186 KB of gzipped JS and CSS across 12 files.

Scroll frame timing on the landing page, Chrome at 412x915 and 2.6x with the CPU throttled through CDP, median of three passes over an eight second scroll of the whole page:

| CPU | p95 frame | frames over 16.7 ms | frames over 32 ms | long tasks |
|---|---|---|---|---|
| 4x slower | 13.9 ms | 2.0% | 0.6% | 2 |
| 6x slower | 27.7 ms | 16.0% | 3.5% | 6 |
| unthrottled | 7.1 ms | 0.2% | 0% | 0 |

Throttling slows the main thread only. It does not emulate a slower GPU or thermal limits, so it is a proxy for a mid range Android and not a substitute for testing on one.

Contrast, computed from the tokens: text 19.80:1 light and 18.97:1 dark, muted 5.33:1 and 5.73:1, focus ring 19.80:1 and 18.97:1.

### Known gaps

- **The camera path has never been run against a real camera.** The decode loop and the jsQR fallback are unverified end to end. Test on the actual gate phones before 30 October.
- **The offline queue was proven in unit tests, not in a browser.** Corrupt storage, duplicate intent, offline survival, drop on 4xx and drain on reconnect all pass. Walking a real device onto a dead network was not done.
- `lambda:InvokeFunction` and `scheduler:*` are denied to the `scd` CLI user, so the deployed Lambda was never invoked directly. Its handler was run against the real table instead, and the function and its schedule were confirmed through CloudFormation.
- **The mock provider reports three tickets, so reconcile inserts MOCK-001 to MOCK-003 every hour.** That is the mock behaving correctly. They disappear when a real provider is wired.
- The `accent` colour fails the 3:1 contrast a focus indicator needs on the light background, at 2.14:1. The ring uses `--text` instead. Worth raising with the design team on 12 September.
- **`amplify/package.json` is load bearing.** One line, `{"type": "module"}`, without which `ampx` cannot resolve extensionless imports.
- **Re-running the seed rotates nothing.** Seed pass tokens are derived from the ticket ref, so a bookmarked pass link keeps working.
