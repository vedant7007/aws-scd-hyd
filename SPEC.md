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
2. **Sell tickets.** Four paid tiers. We own the registration form; the money moves on Razorpay's infrastructure, never in our code. Card details never touch our server.
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
│  │  ├─ pass/page.tsx            # pass id entry
│  │  ├─ pass/[passId]/page.tsx
│  │  ├─ admin/
│  │  │  ├─ page.tsx
│  │  │  └─ scan/page.tsx
│  │  └─ api/
│  │     ├─ subscribe/route.ts
│  │     ├─ register/screenshot/route.ts # presigned upload
│  │     ├─ webhook/razorpay/route.ts    # the only thing that marks paid
│  │     ├─ register/route.ts            # step one, counter
│  │     ├─ register/utr/route.ts        # step two
│  │     └─ pass/[passId]/sessions/route.ts
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
│     ├─ tickets/  ├─ razorpay.ts ├─ settle.ts ├─ pricing.ts
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

# Razorpay. Test keys locally, live keys only on the production app.
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
# PLACEHOLDER, REMOVE BEFORE LAUNCH. See section 8.
RAZORPAY_TEST_AMOUNT_PAISE=100

# Send only. There is no mailbox on awsscdhyd.in, so replies must go elsewhere.
SES_FROM="AWS SBG VJIT <vjit@awsscdhyd.in>"
SES_REPLY_TO=awssbgvjit@gmail.com
ADMIN_EMAILS=
CRON_SECRET=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Locally, credentials come from the `scd` CLI profile, so set `AWS_PROFILE=scd` rather than putting keys in `.env.local`. In Amplify Hosting, the SSR compute role supplies credentials automatically and there are no keys at all.

Razorpay test mode is what lets the whole payment flow be exercised with no money moving. Test keys and live keys are the same code path; only the key pair differs.

---

## 6. Data model

One DynamoDB table. `PK` and `SK` as strings, one global secondary index `GSI1` on `GSI1PK` and `GSI1SK`. On-demand billing. Point-in-time recovery on.

| Item | PK | SK | GSI1PK | GSI1SK |
|---|---|---|---|---|
| Attendee | `ATT#<passId>` | `PROFILE` | `PASS#<passId>` | `ATT` |
| Seat | `ATT#<passId>` | `SEAT#<sessionId>` | | |
| Verification log | `ATT#<passId>` | `VERIFY#<ISO>` | | |
| Session | `SESSION#<sessionId>` | `META` | `SLOT#<slotId>` | `SESSION#<sessionId>` |
| Track counter | `TRACK#<track>` | `COUNTER` | | |
| UTR claim | `UTR#<utr>` | `CLAIM` | | |
| Submission key | `SUBMIT#<key>` | `REG` | | |
| Config | `CONFIG` | `EVENT` | | |
| Subscriber | `SUB#<email>` | `PROFILE` | `SUBS` | `<createdAt ISO>` |

### The pass id, the one identifier

`passId` replaces the earlier `ticketRef` and `passToken`. There is one value: it is the pass page URL, the QR payload, the reference typed into the UPI note, the CSV key, the admin search key and what the gate reads aloud. Two identifiers meant two things to print, two things to mistype and a lookup between them; one removes all three.

Format: `SCD-` and ten characters from `ABCDEFGHJKMNPQRSTVWXYZ23456789`, thirty characters with no I, L, O, U, 0 or 1. Generated at submission with `crypto.randomBytes` and rejection sampling (a byte is accepted only below 240, the largest multiple of 30 that fits, then reduced), never `Math.random` and never a bare modulo. 30^10 is about 49 bits, which is why it is safe to expose in a form people type. It never changes for the life of the record.

Every lookup normalises first: uppercase, strip whitespace and hyphens, re-apply `SCD-`. `scd k4m7pqr29t`, `SCDK4M7PQR29T` and `SCD-K4M7PQR29T` are the same record. The public entry page looks up through GSI1 (`GSI1PK = PASS#<passId>`); a page or route that already holds the canonical id reads the item by key, which is strongly consistent, so the link in an email works the second after the verify that sent it.

### The lifecycle: six states

Every transition is a conditional write asserting the current state. An attempt from any other state fails and changes nothing, which is what stops a double-clicked Verify sending two emails. The legal transitions live in `lib/registration/state.ts` and nowhere else.

| State | Meaning |
|---|---|
| `AWAITING_PAYMENT` | form submitted, home track chosen, no UTR yet |
| `PENDING_VERIFICATION` | UTR and screenshot submitted, nobody has checked |
| `VERIFIED` | an admin matched the UTR against the bank statement |
| `SESSIONS_SELECTED` | student has picked one session per slot |
| `REJECTED` | admin could not find the payment |
| `ABANDONED` | `AWAITING_PAYMENT` that expired without a UTR |

| From | To | By |
|---|---|---|
| (new) | `AWAITING_PAYMENT` | step one of registration |
| `AWAITING_PAYMENT` | `PENDING_VERIFICATION` | student submits UTR and screenshot |
| `AWAITING_PAYMENT` | `ABANDONED` | the hourly sweep, after the 60 minute hold |
| `AWAITING_PAYMENT` | `VERIFIED` | Razorpay mode only: a signature-verified capture for the recorded amount |
| `ABANDONED` | `PENDING_VERIFICATION` | admin reinstate with a typed UTR |
| `PENDING_VERIFICATION` | `VERIFIED` | admin verify |
| `PENDING_VERIFICATION` | `REJECTED` | admin reject, with a reason |
| `REJECTED` | `PENDING_VERIFICATION` | student resubmits a UTR |
| `VERIFIED` | `SESSIONS_SELECTED` | student completes four picks |

Nothing else is legal. `state` is a DynamoDB reserved word and is aliased `#state` in every expression.

**Attendee attributes**
`passId, name, email` (lowercased on write)`, phone, college, tier` (`basic` | `premium` | `ultra` | `vip`, display names Regular, Premium, Platinum, VIP)`, homeTrack, foodPreference, state, paymentMode, amountPaise, utr, utrSubmittedAt, screenshotKey, rejectionReason, verifiedBy, verifiedAt, holdUntil, sessionsSelectedAt, receiptSentAt, confirmationSentAt, sessionsReleaseEmailSentAt, passReadySentAt, checkedInAt, swagIssuedAt, source, createdAt`

**Session attributes**
`sessionId` (`<slot>-<track>`)`, slotId, track, roomId, title, speaker, type` (`keynote` | `talk` | `qa` | `workshop` | `panel`, null until decided, nothing is a workshop by default)`, physicalCapacity, sellableCapacity, seatsTaken`

**Track counter attributes**
`track, registered, ceiling`

**Config attributes**
`rooms, slots, roomForTrack, registrationOpen, sessionsReleased, sessionsReleasedAt`

Rooms: VJIT's four, with physical seat counts. E Block auditorium 240, C Block ground floor 400, C Block first floor 100, C Block second floor 100. Three host a track; the fourth is marked `role: buffer` and is never a session venue. `TODO(vedant)`: which track runs in which room (`roomForTrack`, empty), which room is the buffer (assumed the last listed), slot times, session titles, speakers, types, and `sellableCapacity` per session. Every surface renders all of these unset.

### Access patterns

| Need | Query |
|---|---|
| Pass by typed id | normalise, then GSI1, `GSI1PK = PASS#<passId>` |
| Pass by canonical id | `GetItem PK = ATT#<passId>` |
| Attendee plus seats plus admin log | Query `PK = ATT#<passId>` |
| All sessions in a slot | GSI1, `GSI1PK = SLOT#<slotId>` |
| All 12 sessions, all 3 counters | `BatchGetItem` on known keys |
| Every attendee, for the admin | Scan with a `PROFILE` filter |

The Scan is deliberate. At a few thousand items it costs a fraction of a rupee and is far simpler than another index. Do not add a GSI to avoid it.

---

## 7. Security

- **Nothing client-side ever touches AWS.** All reads and writes happen in server components, route handlers, or Lambdas.
- The pass id is generated with `crypto.randomBytes` and rejection sampling, see section 6. Never `Math.random`, never derived from anything.
- **The pass entry page cannot be used to learn which ids exist.** An unknown id, a mistyped one and a record in any state but `VERIFIED` or `SESSIONS_SELECTED` produce the one same response, built by the one same line. Failed lookups are throttled per IP at a high ceiling (300 an hour) because students share NATed campus addresses; successful lookups are never counted.
- **A UTR is used exactly once across the whole system, enforced by the table.** Submitting one puts a `UTR#<utr>` item in the same transaction as the attendee update, conditional on it not existing (or already belonging to this pass, so a rejected UTR can be resubmitted). A second submission of the same UTR from any other pass fails the transaction.
- UTR format is validated server side: exactly twelve digits.
- **UPI screenshots** carry the payer's bank, account holder and UPI id. Private bucket, block all public access, SSL only, encrypted, deleted 30 days after the event date by lifecycle rule. The browser uploads straight to the bucket on a one-shot presigned PUT with the content type and length signed in; the server never sees the bytes. An admin reads one through a 60 second presigned URL minted inside `requireAdmin`. Never in an email, never in any response reachable without admin auth.
- `/api/webhook/razorpay` (Razorpay mode) verifies `X-Razorpay-Signature` against `RAZORPAY_WEBHOOK_SECRET` **before parsing the body**. Unverified requests get a 401 and the body is not logged.
- The amount is never a parameter. It is computed on the server from `content/passes.ts` and stored on the record; a verify checks against it.
- Step one of registration is rate limited **per email**, five an hour, because the audience is students on college wifi with hundreds behind one NATed address. A per-IP ceiling of 500 an hour exists only against abuse.
- Registration is guarded independently of `registrationOpen`, see section 8.
- `/pass/[passId]` sets `noindex`. Pass URLs never appear in the sitemap.
- `/admin/*` checks the Cognito session and that the email is in `ADMIN_EMAILS`. A signed-in user not on the list gets an explicit refusal, not a blank page. Every admin action is logged under the attendee with who, when and which UTR.

---

## 8. Payments

Two modes, switched by `PAYMENT_MODE` (`manual` | `razorpay`), default manual. Manual is what the site is built around: the college's UPI QR, a UTR, an admin verifying against the bank statement. Razorpay is kept intact behind the switch because the college QR route depends on the college sharing bank statements, which is not yet guaranteed. Both end in the same `VERIFIED` state through the same transition and send the same email 2. Nothing about Razorpay exists outside `src/lib/tickets/`.

### Registration is two steps, and why

The student fills the form, then leaves the site to pay in their UPI app, then comes back to enter the UTR. That gap is real and it is minutes long.

**Step one.** Form plus home track. The record is created in `AWAITING_PAYMENT` with its pass id, and **in the same transaction the home track's counter is incremented, conditional on `registered < ceiling`**. The ceiling is the sellable capacity of the room that track runs in. If the increment fails, the track is full: no record is created and the student is told which track, before ever seeing the payment screen. This counter is the only thing protecting the event from selling more passes for a track than its room holds, because seats are claimed later, at selection. A submission key minted once per form rides in the transaction too, so a double click or a retry after a timeout resolves to the record the first one made instead of counting twice.

The student then sees the college QR, the exact amount for their tier, their pass id to put in the UPI note, and the UTR form, at `/register/pay/<passId>`. That page is reachable by pass id alone, because no email exists yet and the id on screen is the only thing they can carry across the gap. It renders only for `AWAITING_PAYMENT` and `REJECTED`; every other state gets the generic not-found.

**Step two.** UTR and screenshot in. `AWAITING_PAYMENT` (or `REJECTED`) to `PENDING_VERIFICATION`, `holdUntil` cleared, email 1 sent.

**The sweep.** The hourly reconcile Lambda moves every `AWAITING_PAYMENT` record whose 60 minute hold has lapsed to `ABANDONED` **and decrements its track counter in the same transaction**. A crash between the two would leak a track place for good, and over forty days of registration that silently shrinks sellable capacity; bound together, either both happen or neither. No email is sent: a student who never paid is not chased. The hold is `holdMinutes` in `content/payment.ts`; with an hourly sweep the effective hold is 60 to 120 minutes.

**Late payers.** Someone will abandon, pay anyway an hour later, and come back. The admin reinstate action takes an `ABANDONED` record back to `PENDING_VERIFICATION` with a UTR the admin types in, re-incrementing the counter under its ceiling in the same transaction. If the track is now full it fails loudly and nothing changes, so the admin offers a refund or another track rather than quietly overselling the room.

**Conservative by design.** A Premium or VIP holder counts against their home track's counter even though they may later pick sessions in other rooms. That under-sells slightly, deliberately: under-selling means empty chairs, over-selling means students standing in a corridor.

### Verification

The admin dashboard's default view is the `PENDING_VERIFICATION` queue, oldest UTR first: name, email, tier, home track, amount expected, UTR, screenshot. Verify moves the record to `VERIFIED` and sends email 2; Reject moves it to `REJECTED` with a reason and sends the rejection email; both are conditional on the current state, so two admins acting at once produce one change and one email. A rejected student resubmits at the pay page and goes back into the queue with the same record.

### The launch guard

`registrationOpen` is one edit in a content file, so it is not allowed to be the only thing between a half-configured site and real students. `src/lib/tickets/launch.ts` refuses to register anyone, in production, while any blocker for the current mode holds.

Manual mode: every tier priced, the college QR at `public/assets/upi-qr.png`, `VERIFICATION_WINDOW` set, at least one address in `ADMIN_EMAILS`, a room assigned to every track, and a `sellableCapacity` on every session.

Razorpay mode: a live key, every tier priced, `RAZORPAY_TEST_AMOUNT_PAISE` absent, plus the room and capacity conditions.

Every entry point asks `registrationIsOpen()`, which is `registrationOpen` **and** no enforced blocker. Enforcement is keyed on `NODE_ENV === 'production'`; development is exempt so the flow can be exercised at all, and `SCD_DEV_REGISTRATION_OPEN=1` opens step one outside production for the acceptance suite. `npm run check:launch` proves each condition blocks on its own.

### Pricing

Every tier in `content/passes.ts` is priced (Rs 399, 799, 1,299, 1,699, confirmed 22 September 2026) and that file is the only source: the landing page, the pay page and the record all read from it. A tier with `pricePaise: null` would be offered at `RAZORPAY_TEST_AMOUNT_PAISE`, default 100, and the launch guard refuses to sell while that could apply.

### Early bird and coupons: none

No early bird is offered and there is no discount logic. `earlyBirdEndsAt` stays null. The design handoff's Register screen carries demo coupon codes (EARLYBIRD, SBGVJIT, CAMPUS5) that its own notes flag as invented; they must not come across when that screen is ported.

### Reconciliation (Razorpay mode)

The hourly Lambda, in Razorpay mode only, also asks the provider what settled in the last three days and applies every event through `settle()`, which is idempotent: a capture is the one provider transition, `AWAITING_PAYMENT` to `VERIFIED`, for the recorded amount. A full refund releases the seats and moves the record to `REJECTED`, which closes the pass and refuses the gate. In both modes the run sends any owed email 2 and writes a summary the dashboard shows.

---

## 9. Seat claiming

Seats are claimed at session selection, not at registration. Everyone holds exactly four, one per slot, whatever the tier.

Twelve sessions: three tracks by four slots, one session per track per slot, each session in its track's room, so each has that room's `physicalCapacity` and its own `sellableCapacity`, always at most physical. The difference is the reserve for speakers, sponsors, organisers, VIP flex and no-shows. A session whose `sellableCapacity` is unset refuses every claim rather than falling back to physical.

### Tier to track allowance

`tracksAllowed` in `content/passes.ts` is how many tracks a tier may **pick sessions from, counting the home track chosen at registration**. It is not a number of seats.

| Tier | Display | `tracksAllowed` | May pick from |
|---|---|---|---|
| `basic` | Regular | 1 | home track only |
| `premium` | Premium | 2 | home track plus one other, chosen at selection |
| `ultra` | Platinum | 3 | all three |
| `vip` | VIP | 3 | all three |

Enforced server side on submit, read from `passes.ts`, never hardcoded in a route: a submission that picks from a track the tier does not allow, that puts two sessions in one slot, or that leaves a slot unfilled is rejected whatever the UI did.

### The claim

All four seats in a single `TransactWriteItems`: an increment on each session with `ConditionExpression: seatsTaken < #capacity`, and a `SEAT#` item for each, plus the `VERIFIED` to `SESSIONS_SELECTED` transition asserting the current state. Either everything is written or nothing is.

**`#capacity` is an expression attribute name aliasing `sellableCapacity`.** The attribute is not reserved, but `capacity` is, and the bare name has bitten this repo once. Keep the alias so nobody reintroduces it.

### Conflict handling

Two transactions touching one session at the same moment are not judged on their conditions: DynamoDB cancels one outright with `TransactionConflict`, and the SDK does not retry it. A campus registering in a burst is exactly that case. Every seat transaction therefore retries a conflict with jittered backoff until it is actually evaluated, and only then does a `ConditionalCheckFailed` mean what the caller thinks it means. The race test proved this: without the retry, the loser was cancelled with no condition result at all.

On `TransactionCanceledException` the route parses `CancellationReasons` to find which session filled (item index maps back to the pick), answers 409 with that session id, fresh counts for all twelve and the message "That session just filled up, please pick another." The picker keeps every other choice, marks that one Full, and asks for another. Never a 500, never a generic error page, never a partial claim.

**Test:** two verified attendees submitting four picks that include a session with one seat left, at the same time. Exactly one wins and holds four seats; the other is refused with that session named and holds nothing; `seatsTaken` on it rises by exactly one. `npm run race-test`, against the real table.

### Selections are final

On success the record is `SESSIONS_SELECTED` and email 4 goes out. Revisiting the pass shows the completed pass, read only, with a line to contact the organisers at the reply-to address for a change. Only an admin can change a selection, and doing so releases the old seats and claims the new ones in one transaction so counts never drift.

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

1. **Hero.** Name, Hyderabad, date, venue, CTA to passes, countdown to `event.startsAt` (2026-10-30T09:30:00+05:30, doors confirmed 09:30), and a pointer-reactive canvas background that animates gently on its own on mobile. Keep the background in one swappable component, the visual is `TODO(vedant)`.
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

### `/pass` and `/pass/[passId]`

`/pass` is where a student types their pass id. A `VERIFIED` or `SESSIONS_SELECTED` id redirects to the pass. Anything else, an unknown id included, gets the one generic message, byte for byte the same response, so the page cannot be used to discover which ids exist.

`/pass/[passId]` renders by state. The link in email 2 opens it directly.

| State | Renders |
|---|---|
| `AWAITING_PAYMENT`, `PENDING_VERIFICATION`, `ABANDONED`, `REJECTED`, unknown | the same not-found page, a real 404, naming nothing |
| `VERIFIED`, sessions not released | name, pass id, tier, home track, "Agenda coming soon. We will email you when you can pick your sessions." No QR, no picker. |
| `VERIFIED`, sessions released, none chosen | the per-slot picker, section 9. Still no QR. |
| `SESSIONS_SELECTED` | the full pass: QR encoding the pass id, name, pass id, tier, the four chosen sessions with room and time, food preference. Read only. |

The QR appears only in the final state. The pass id is identical in every state; nothing is ever regenerated. Server component; invalid or unfinished renders never a stack trace and never a redirect to a login that does not exist. Must be legible on a phone in bright sunlight at a gate: high contrast, large QR.

### `/register` and `/register/pay/[passId]`

Step one is the form, section 8. Step two, at the pay page, is reachable by pass id alone and renders the QR, the amount and the UTR form for `AWAITING_PAYMENT` and `REJECTED`, "we have your UTR" for `PENDING_VERIFICATION`, redirects to the pass for `VERIFIED` and `SESSIONS_SELECTED`, and explains the lapse for `ABANDONED`.

### `/admin` and `/admin/scan`
Cognito sign-in, `ADMIN_EMAILS` allowlist.

Dashboard: the `PENDING_VERIFICATION` queue first, oldest first, with Verify and Reject; counts for all six states; a filter for `VERIFIED` attendees who have not chosen sessions, so they can be chased; search by pass id, UTR and email; reinstate for `ABANDONED`; change sessions for `SESSIONS_SELECTED`, releasing and claiming in one transaction; the release-sessions action, which flips the flag and sends email 3; per-track counters against their ceilings; per-session sold, sellable, physical and reserve; **food preference totals with CSV export** (this number goes to the caterer); the last sweep run.

Scanner: camera QR scan reads the pass id, looks it up, shows name, tier and food preference in large type, buttons to mark checked in and swag issued. **Only `SESSIONS_SELECTED` admits.** A `VERIFIED` attendee who never chose sessions gets a distinct message telling the volunteer so, not a generic invalid-pass error, because a volunteer at 9am cannot debug a generic error. An already-checked-in scan says so rather than silently succeeding. **Queue writes and retry on failure, because campus wifi will fail on the day.**

---

---

## 12. Email

SES, `ap-south-1`. Every body lives in `src/lib/email/templates.ts` as named exports, so wording changes there and nowhere else. All transactional, none market anything, plain and mobile-legible.

`VERIFICATION_WINDOW` is one exported constant, `"24 hours"` for now. The organiser has not yet said how often the bank statement is checked; when they do, only that constant changes.

| Email | Trigger | Idempotency mark |
|---|---|---|
| 1, receipt | entering `PENDING_VERIFICATION` | `receiptSentAt` |
| 2, confirmation | entering `VERIFIED` | `confirmationSentAt`; the hourly run resends anything owed |
| 3, sessions live | the admin release action, to every `VERIFIED` attendee | `sessionsReleaseEmailSentAt`, written per attendee right after each send, so an interrupted run resumes where it stopped and a repeated run sends nothing twice |
| 4, pass ready | entering `SESSIONS_SELECTED`, lists the chosen sessions with room and time | `passReadySentAt` |
| rejection | entering `REJECTED`, quotes the UTR, links the pay page for a corrected one, **contains no pass link** | none |
| day before | timings and directions | not yet scheduled |

**Email 1 must never read as a confirmation.** Nobody has checked the money when it is sent. It contains none of successful, success, confirmed, confirmation, paid, complete, approved or verified; the acceptance suite asserts this against `RECEIPT_FORBIDDEN_WORDS`.

No email is sent on `ABANDONED`. A student who never paid is not chased.

### Addresses

| Header | Value |
|---|---|
| `From` | `AWS SBG VJIT <vjit@awsscdhyd.in>` |
| `Reply-To` | `awssbgvjit@gmail.com` |
| Public contact on the site | `awssbgvjit@gmail.com` |

**The domain is send only. There is no mailbox on `awsscdhyd.in`.** Nothing delivered to `vjit@awsscdhyd.in` is ever read, so every outbound message sets `Reply-To`, and the site never prints a domain address as a way to reach us. Every email names the reply-to address in its footer.

Set `Reply-To` in the SES call itself, not in the template body. Seeded and test attendees carry reserved addresses (`example.test`, `.example`) which the send layer refuses, so no code path can mail a fake person. Build against the `console` transport in development; `EMAIL_TRANSPORT=ses` points a local run at real SES on purpose.

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

**Phase 2.** Webhook route with idempotency, pass page, session picker with the transaction, and the two-window race test. Built first against a mock provider, since replaced by Razorpay.

**Phase 3.** Cognito, admin dashboard, scanner with offline queueing. Reconcile Lambda and schedule.

**Phase 4.** Real content as it arrives from the team on 12 September. Theme replacement. SES production access. Domain attached. Razorpay wired.

**Phase 5, week of 21 October.** Content freeze. Rehearse check-in with 50 fake passes on real campus wifi. Take a manual DynamoDB backup the night before.

---

## 15. Blocked on Vedant

Done since this was written: `awsscdhyd.in` is registered, attached to Hosting and verified in SES with DKIM; SES has production access at 50,000 a day; the region is bootstrapped; Amplify builds `main` on push.

| Item | Blocks |
|---|---|
| Pass tier names, prices, inclusions, swag levels | Section 11 item 6 |
| Sessions allowed per tier | Section 9 |
| Confirmed hall count, names, capacities | Config item, schedule page |
| Registration open date and early bird expiry | Countdown and urgency copy |
| Final theme (due 12 Sept) | Section 10 |
| Speaker list, sponsor tiers, FAQ, code of conduct copy | Content files |

---

## 16. Live status

Kept current as work lands. Everything else in this file is the plan, this section is the fact.

**Phases 0 to 3 are built and deployed to the sandbox. Phase 4 is content and paperwork, which is on Vedant.**

| Thing | State |
|---|---|
| Sandbox backend | deployed: table, Cognito pool, reconcile Lambda, hourly schedule |
| Amplify Hosting | building from `main`, live at https://awsscdhyd.in with a compute role and production env vars attached |
| Landing page | ported from the design handoff (Landing Bitmap). Its own header and footer, theme in localStorage under `scd-theme`, cloud page transition on every route. APPLY TO SPEAK and BECOME A SPONSOR open a mail to awssbgvjit@gmail.com with a fixed subject until the `/speak` and `/sponsor` screens are ported |
| Schedule, speakers, sponsors, code of conduct, register, pay, pass, pass entry, admin | built on the pre-handoff layout, kept under `src/app/(site)/` with the old chrome until each is ported |
| Pass page, QR, per-slot picker, seat transaction | rebuilt on the six-state lifecycle and the one pass id. Race test and the 25-check acceptance suite (`npm run test:lifecycle`) pass against the sandbox |
| Payments | Manual UPI by default: two-step registration, per-track counter at step one, UTR and screenshot, admin verification queue, hourly sweep. Razorpay kept intact behind `PAYMENT_MODE`. Registration stays closed until `registrationOpen` flips; the launch guard lists per-mode blockers on the dashboard |
| Organiser auth, dashboard, scanner | rebuilt: verification queue, six-state counts, reinstate, change sessions, session release, per-track counters; scanner admits only `SESSIONS_SELECTED` and names the verified-but-unselected case |
| Reconcile | hourly, verified to report and repair a deleted record |
| Email | five transactional bodies in one module, each with an idempotency mark; SES sending verified end to end from the sandbox |
| Deliverability | DKIM, SPF via custom MAIL FROM `mail.awsscdhyd.in`, DMARC at `p=none` reporting to awssbgvjit@gmail.com. Records are CDK in `amplify/backend.ts`, created only by the build that carries `SCD_MANAGE_DNS=true`, which is the production Amplify app and nothing else |
| Theme | handoff tokens, one block at the top of `globals.css`. The old token names alias onto it for the unported screens |

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
- **Razorpay's own webhook delivery to the live site has not been observed.** Every webhook in testing was constructed from a real test-mode payment entity and signed with the same scheme, because Razorpay cannot reach localhost. The dashboard webhook and its secret are Vedant's to create; the first live delivery is the remaining check.
- **Razorpay's order list can lag a capture by seconds.** One reconcile run missed a payment captured twenty seconds earlier and the next run applied it. Hourly makes this irrelevant, but do not read one run as the final word.
- The `accent` colour fails the 3:1 contrast a focus indicator needs on the light background, at 2.14:1. The ring uses `--text` instead. Worth raising with the design team on 12 September.
- **`amplify/package.json` is load bearing.** One line, `{"type": "module"}`, without which `ampx` cannot resolve extensionless imports.
- **Re-running the seed rotates nothing.** Seed pass tokens are derived from the ticket ref, so a bookmarked pass link keeps working.
