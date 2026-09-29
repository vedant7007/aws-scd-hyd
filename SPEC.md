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
2. **Sell tickets.** Four paid tiers. We own the registration flow; the money moves by UPI straight to the college account, and a person on the team matches each UTR against the bank statement. We never see a card, an account or a PIN.
3. **Give each attendee a pass.** Sessions are chosen while registering. Once the payment is verified, a private link in the confirmation email opens their QR ticket. **There is no student login anywhere.**
4. **Run the day.** An organiser dashboard for check-in scanning, live counts, the lunch headcount and swag issuance.

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
│  ├─ backend.ts              # composes everything: table, bucket, SES, DNS
│  ├─ package.json            # {"type":"module"}, load bearing, see CLAUDE.md
│  ├─ auth/resource.ts        # Cognito, crew only
│  └─ functions/reconcile/    # hourly sweep and owed-ticket retry
├─ src/
│  ├─ app/
│  │  ├─ globals.css          # ALL design tokens
│  │  ├─ page.tsx             # the landing
│  │  ├─ (public)/            # code of conduct, speak, sponsor, pass, pass entry
│  │  ├─ (register)/register/ # notify page or the flow; preview/, pay/[passId]/
│  │  ├─ admin/               # login, dashboard, scan, users, settings, notify, traffic
│  │  └─ api/
│  │     ├─ registrations/hold/route.ts        # the payment step: record + seats
│  │     ├─ registrations/screenshot/route.ts  # presigned upload
│  │     ├─ registrations/submit/route.ts      # UTR in, email 1 out
│  │     ├─ notify/route.ts                    # the closed page's email list
│  │     ├─ hit/route.ts                       # page view counter
│  │     └─ admin/…                            # scan, CSV exports
│  ├─ components/             # landing/, register/ (Flow.tsx), pass/, admin/, layout/
│  ├─ content/                # event, passes, program, payment, speakers, sponsors…
│  └─ lib/
│     ├─ db/                  # client, keys, types, queries, tx, stats
│     ├─ registration/        # state (transitions), flow, validate, screenshots
│     ├─ tickets/             # launch guard, pricing
│     └─ email/               # send, templates
├─ scripts/                   # seed, launch-check, race-test, lifecycle-test
├─ .env.example
└─ SPEC.md
```

---

## 5. Environment

`.env.example`, committed with empty values:

```bash
AWS_REGION=ap-south-1
SCD_TABLE_NAME=
SCD_SCREENSHOT_BUCKET=
# Development only: opens registration for tests and local walkthroughs.
SCD_DEV_REGISTRATION_OPEN=

# Send only. There is no mailbox on awsscdhyd.in, so replies must go elsewhere.
SES_FROM="AWS SBG VJIT <vjit@awsscdhyd.in>"
SES_REPLY_TO=awssbgvjit@gmail.com
# Fallback only. Roles live in the table; this list grants nothing while the table holds one admin.
ADMIN_EMAILS=
CRON_SECRET=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Locally, credentials come from the `scd` CLI profile, so set `AWS_PROFILE=scd` rather than putting keys in `.env.local`. In Amplify Hosting, the SSR compute role supplies credentials automatically and there are no keys at all.

The admin preview at `/register/preview` is what lets the whole flow be walked on the live site with registration closed; see section 11.

---

## 6. Data model

One DynamoDB table. `PK` and `SK` as strings, one global secondary index `GSI1` on `GSI1PK` and `GSI1SK`. On-demand billing. Point-in-time recovery on.

| Item | PK | SK | GSI1PK | GSI1SK |
|---|---|---|---|---|
| Attendee | `ATT#<passId>` | `PROFILE` | `PASS#<passId>` | `ATT` |
| Verification log | `ATT#<passId>` | `VERIFY#<ISO>` | | |
| Session counter | `SESSION#<sessionId>` | `META` | | |
| UTR claim | `UTR#<utr>` | `CLAIM` | | |
| Config | `CONFIG` | `EVENT` | | |
| Form submission | `FORM#<speak\|sponsor\|report>` | `<ISO>#<ref>` | | |
| Subscriber | `SUB#<email>` | `PROFILE` | `SUBS` | `<createdAt ISO>` |

### The pass id, the one identifier

`passId` replaces the earlier `ticketRef` and `passToken`. There is one value: it is the pass page URL, the QR payload, the reference typed into the UPI note, the CSV key, the admin search key and what the gate reads aloud. Two identifiers meant two things to print, two things to mistype and a lookup between them; one removes all three.

Format: `SCD-` and ten characters from `ABCDEFGHJKMNPQRSTVWXYZ23456789`, thirty characters with no I, L, O, U, 0 or 1. Generated when the student reaches the payment step, with `crypto.randomBytes` and rejection sampling (a byte is accepted only below 240, the largest multiple of 30 that fits, then reduced), never `Math.random` and never a bare modulo. 30^10 is about 49 bits, which is why it is safe to expose in a form people type. It never changes for the life of the record.

Every lookup normalises first: uppercase, strip whitespace and hyphens, re-apply `SCD-`. `scd k4m7pqr29t`, `SCDK4M7PQR29T` and `SCD-K4M7PQR29T` are the same record. The public entry page looks up through GSI1 (`GSI1PK = PASS#<passId>`); a page or route that already holds the canonical id reads the item by key, which is strongly consistent, so the link in an email works the second after the verify that sent it.

### The lifecycle: five states

Every transition is a conditional write asserting the current state. An attempt from any other state fails and changes nothing, which is what stops a double-clicked Verify sending two emails. The legal transitions live in `lib/registration/state.ts` and nowhere else.

| State | Meaning |
|---|---|
| `AWAITING_PAYMENT` | reached the payment step; seats held for 90 minutes; no UTR yet |
| `PENDING_VERIFICATION` | UTR and screenshot submitted, nobody has checked |
| `VERIFIED` | an admin matched the UTR against the bank statement. This is the ticket |
| `REJECTED` | admin could not match the payment. Seats stay held |
| `ABANDONED` | `AWAITING_PAYMENT` whose hold lapsed without a UTR. Seats given back |

| From | To | By |
|---|---|---|
| (new) | `AWAITING_PAYMENT` | the payment step, claiming its session seats in the same transaction |
| `AWAITING_PAYMENT` | `PENDING_VERIFICATION` | student submits UTR and screenshot |
| `AWAITING_PAYMENT` | `ABANDONED` | the hourly sweep after the hold lapses, releasing the seats in the same transaction |
| `ABANDONED` | `PENDING_VERIFICATION` | admin reinstate with a typed UTR, reclaiming the seats or failing loudly |
| `PENDING_VERIFICATION` | `VERIFIED` | admin verify |
| `PENDING_VERIFICATION` | `REJECTED` | admin reject, with a reason |
| `REJECTED` | `PENDING_VERIFICATION` | student resubmits a UTR at the pay page |

Nothing else is legal. `state` is a DynamoDB reserved word and is aliased `#state` in every expression.

**Attendee attributes**
`passId, firstName, middleName?, lastName, name` (the three joined)`, email` (lowercased)`, phone` (`+91` and ten digits)`, college, branch, rollNumber` (uppercased)`, yearOfStudy` (`1`..`5+`)`,, dateOfBirth, tier` (`basic` | `premium` | `ultra` | `vip`, shown as Regular, Premium, Platinum, VIP)`, technicalSession, workshop?, state, amountPaise, submissionKeyHash, holdUntil, utr, utrSubmittedAt, screenshotKey, rejectionReason, verifiedBy, verifiedAt, paymentId, paidAt, receiptSentAt, confirmationSentAt, checkedInAt, swagIssuedAt, source` (`checkout` | `manual` | `preview`)`, createdAt`

**Session counter attributes**
`sessionId, sellableCapacity` (null until an admin sets it)`, seatsTaken`. Seven of them: technical sessions `t1` to `t5` and workshops `w1`, `w2`, named in `content/program.ts`.

**Config attributes**
`registrationOpen, registrationOpenChangedAt, registrationOpenChangedBy`

Rooms are reference only now: VJIT's four with physical seat counts (E Block auditorium 240, C Block ground floor 400, C Block first and second floor 100 each) sit in `content/event.ts` as a hint beside the seat-count fields on the settings page. `TODO(vedant)`: the seat count of each session, set by an admin on `/admin/settings`.

### Access patterns

| Need | Query |
|---|---|
| Pass by typed id | normalise, then GSI1, `GSI1PK = PASS#<passId>` |
| Pass by canonical id | `GetItem PK = ATT#<passId>` |
| Attendee plus admin log | Query `PK = ATT#<passId>` |
| All seven session counters | `BatchGetItem` on known keys |
| Every attendee, for the admin | Scan with a `PROFILE` filter |

The Scan is deliberate. At a few thousand items it costs a fraction of a rupee and is far simpler than another index. Do not add a GSI to avoid it.

---

## 7. Security

- **Nothing client-side ever touches AWS.** All reads and writes happen in server components, route handlers, or Lambdas.
- The pass id is generated with `crypto.randomBytes` and rejection sampling, see section 6. Never `Math.random`, never derived from anything.
- **The pass entry page cannot be used to learn which ids exist.** An unknown id, a mistyped one and a record in any state but `VERIFIED` produce the one same response, built by the one same line. Failed lookups are throttled per IP at a high ceiling (300 an hour) because students share NATed campus addresses; successful lookups are never counted.
- **A UTR is used exactly once across the whole system, enforced by the table.** Submitting one puts a `UTR#<utr>` item in the same transaction as the attendee update, conditional on it not existing (or already belonging to this pass, so a rejected UTR can be resubmitted). A second submission of the same UTR from any other pass fails the transaction.
- UTR format is validated server side: letters and digits, 12 to 40 characters, spaces dropped and uppercased first. Banks differ; twelve digits is only the common case.
- **UPI screenshots** carry the payer's bank, account holder and UPI id. Private bucket, block all public access, SSL only, encrypted, deleted 30 days after the event date by lifecycle rule. The browser uploads straight to the bucket on a one-shot presigned PUT with the content type and length signed in; the server never sees the bytes. An admin reads one through a 60 second presigned URL minted inside `requireAdmin`. Never in an email, never in any response reachable without admin auth.
- The amount is never a parameter. It is computed on the server from `content/passes.ts` and stored on the record; a verify checks against it. A request body carrying any field that is not a form field is refused outright.
- Everything the flow checks in the browser is checked again on the server: the workshop only on Premium and above (and required there), 18 or older on 30 October 2026 computed from the date of birth, phone shape, every required field.
- Only the browser that made a hold can change it: the record stores a SHA-256 of a random submission key the browser keeps in `sessionStorage`, and a move is conditional on it.
- The payment step is rate limited **per email**, eight an hour, because the audience is students on college wifi with hundreds behind one NATed address. A per-IP ceiling of 500 an hour exists only against abuse.
- Registration is guarded independently of `registrationOpen`, see section 8.
- `/pass/[passId]` sets `noindex`. Pass URLs never appear in the sitemap.
- `/admin/*` checks the Cognito session, then looks the email up in the table for a role. **Two roles.** `admin` does everything: verification queue, attendee list, exports, seat counts, settings, crew management, the registration preview. `volunteer` gets the gate scanner and nothing else: not the attendee list, not any email address, not the payment queue, the exports, the settings or the crew page, by navigation, by direct URL or by API call. The role is enforced in `requireAdmin` / `requireCrew` in `src/lib/auth/admin.ts` and in the route handlers, never in the UI: a volunteer asking for an admin page is redirected to the scanner before any data loads, and an admin API answers 403 with nothing in the body. A signed-in user with no role gets an explicit refusal, not a blank page.
- **Roles are managed on `/admin/users`** (admin only): list, add by email with a role, change a role, remove. Every change is one transaction with its audit item (who, to whom, when). The admin count is kept race-safe on a META item, so the last admin cannot demote or remove themselves and two admins cannot demote each other into zero at the same instant. Adding someone creates their Cognito account with no password anyone sees; they set their own through the forgot-password flow on the sign-in page. No password is printed, logged, returned or emailed by this application.
- **Bootstrap.** `vedantidlgave16@gmail.com` is seeded as the first admin the first time that account signs in, in a transaction that also writes a BOOTSTRAP marker conditional on it not existing, so the seed runs once and can never grant admin again. `ADMIN_EMAILS` still works, **only** while the table holds zero admins, so a wiped table does not lock everyone out.
- Every admin action on a registration is logged under the attendee with who, when and which UTR.

---

## 8. Payments and registration

UPI only, since the v3 handoff (28 September 2026). The college's UPI id, a QR generated for the exact amount, a UTR and a screenshot, and an admin verifying against the bank statement. The Razorpay integration and its `PAYMENT_MODE` switch were removed then; they are in git history before that date if they are ever wanted back.

### The flow

`/register`, ported from the handoff's `Registration Flow.dc.html` into `components/register/Flow.tsx`. Five steps and two end screens:

1. **Pick your pass.** Four metallic cards and a side by side comparison table whose column headers also pick.
2. **Pick your sessions.** The keynote is on every plan. One technical session of five, required. Premium and above: one workshop of two, required; on Regular the workshop block offers the upgrade instead. Dropping below Premium clears the workshop.
3. **Who is coming?** First, middle (optional) and last name, email, phone, college, branch, roll number, year, date of birth. There is no food question: lunch is one kind for everyone (organiser decision, 28 September 2026), and the Speak and Sponsor forms do not ask either. Under 18 on the event day blocks the step with the handoff's red panel.
4. **Check it over.** Every answer, the amount, edit links.
5. **Pay by UPI.** Going to this step calls `POST /api/registrations/hold`, which makes the `AWAITING_PAYMENT` record **and claims a seat in the technical session and the workshop in one transaction**, each conditional on `seatsTaken < sellableCapacity`. A full session refuses the whole thing: no record, the student is sent back to step 2 with that session named. Coming back from step 4 again moves the same record's seats and keeps its clock. The QR is `upi://pay?pa=<upiId>&pn=<payee>&am=<amount>&cu=INR&tn=<passId>`, drawn in the browser. The UPI id itself is never printed on the page or sent in an API response: the QR and the one-tap app link are the only ways to pay. The hold counts down 90 minutes, orange under ten. The screenshot goes straight to the private bucket (section 7), and SUBMIT posts the UTR and the object key to `/api/registrations/submit`: `PENDING_VERIFICATION`, email 1.

**Received** shows the pass id, the timeline and what was sent; a refresh keeps it. **Expired** offers START AGAIN, which reuses the same browser's record if the sweep has not reached it yet.

The draft lives in the tab's `sessionStorage` (not `localStorage`: a shared lab computer forgets it when the tab closes).

### The sweep, late payers and refunds

**The sweep.** The hourly reconcile Lambda moves every `AWAITING_PAYMENT` record whose hold has lapsed to `ABANDONED` **and gives its seats back in the same transaction**, conditional on the hold still being lapsed, so a UTR submitted a moment earlier wins. No email: a student who never paid is not chased. `holdMinutes` is in `content/payment.ts`; with an hourly sweep the effective hold is 90 to 150 minutes.

**Late payers.** The admin reinstate action takes an `ABANDONED` record to `PENDING_VERIFICATION` with a UTR the admin types, reclaiming its seats in the same transaction. If a session has filled since, it fails loudly naming it and nothing changes: raise that session's seat count or offer a refund.

**Rejected.** The seats stay held while the student fixes a wrong UTR at `/register/pay/<passId>`, the link in the rejection email.

**Refunds.** The wording, on the payment step and in email 2, verbatim: *Refunds are available if you tell us at least two weeks before the event. Write to awssbgvjit@gmail.com with your pass ID.* Reject reasons come from a short list (Could not find this payment; Amount does not match; This payment has already been used for another registration; Other, with a note) and go into the rejection email.

### Verification

The admin dashboard's default view is the `PENDING_VERIFICATION` queue, oldest UTR first: name, contact, college, branch, roll number, date of birth, tier, sessions, amount expected, UTR, screenshot. Verify moves the record to `VERIFIED` and sends email 2, the ticket; Reject moves it to `REJECTED` with a reason; both are conditional on the current state, so two admins acting at once produce one change and one email.

### The master switch and the registration switch

`REGISTRATION_OPEN` in `content/event.ts` was false until 29 September 2026, when the organiser opened it for testing with a temporary UPI account. While it is false, nothing sells: `launchStatus()` ANDs it with the admin switch, the hold route refuses, every REGISTER control reads NOTIFY ME and `/register` is the notify page. Opening is a code change on purpose: it should be a deploy someone reviewed, not a click.

Below it, the `registrationOpen` switch on `/admin/settings` closes registration without a deploy (type CLOSE to confirm). It is enforced in the hold route, not by hiding a button. Closing stops new holds and nothing else: a student already paying can still submit, and verification keeps working.

### The launch guard

`src/lib/tickets/launch.ts` refuses to take a hold, in production, while any of these holds: a tier without a price, the UPI id unset (`SCD_UPI_ID` in the server environment, never in the public repo; `SCD_UPI_PAYEE` optional), no screenshot bucket, `VERIFICATION_WINDOW` empty, no admin, or any of the seven sessions without a seat count. Every blocker is listed on the dashboard. Development is exempt so the flow can be exercised, and `SCD_DEV_REGISTRATION_OPEN=1` opens it outside production. `npm run check:launch` proves each condition blocks on its own.

### Pricing

Every tier in `content/passes.ts` is priced (Rs 499, 799, 999, 1,299, confirmed 24 September 2026) and that file is the only source. `amountFor()` throws for an unpriced tier rather than guess. No early bird and no coupons: the v3 handoff has neither.

---

## 9. Seat claiming

Each registration holds **two seats at most**: its technical session, and its workshop on Premium and above. The keynote, Q&A, panel and expo are for everyone and are not counted.

The ceiling per session is `sellableCapacity` on its `SESSION#` counter, set by an admin on `/admin/settings`; a session with none sells nothing, and the launch guard will not open registration until all seven have one. Lowering a ceiling below the seats already held is refused and names the count. The room sizes in `content/event.ts` are shown beside the field as a hint, with `ROOM_RESERVE` (15) the suggested hold-back for speakers, sponsors and organisers.

**Seats are held from the payment step until verification or the sweep**, not from verification: a student who has just paid must never find their session gone. `AWAITING_PAYMENT`, `PENDING_VERIFICATION`, `REJECTED` and `VERIFIED` all hold; `ABANDONED` does not.

### The claim

`seatsTaken < #capacity`, where `#capacity` is an expression attribute name aliasing `sellableCapacity` (`capacity` is reserved, and the bare name has bitten this repo once). The record and its claims are one `TransactWriteItems`: everything is written or nothing is. A move releases the old seats and claims the new ones in one transaction, conditional on the record still being this browser's live hold.

### Conflict handling

Two transactions touching one counter at once are not judged on their conditions: DynamoDB cancels one with `TransactionConflict`, which the SDK does not retry. Every seat transaction retries that with jittered backoff until it is actually evaluated; only then does a `ConditionalCheckFailed` mean the session is full. `CancellationReasons` maps the failed item back to the session, which the route names in a 409.

**Test:** `npm run race-test` sets one session to a single free seat and places two holds on it concurrently against the real table. Exactly one wins; the other is refused `full` with the session named and leaves no record; `seatsTaken` rises by exactly one.

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

The v3 handoff's `Landing Bitmap.dc.html`, converted to JSX from its own markup rather than restyled by hand, so every inline value is the design's; behaviour is `mount.ts`, a port of the design's script. Departures are listed at the top of `Landing.tsx`. Typing `admin` anywhere outside a text field opens crew sign-in and typing `register` opens `/register`, as the design's `cloud-transition.js` does. In order:

1. **Hero.** Name, Hyderabad, date, venue, CTA to passes, countdown to `event.startsAt` (2026-10-30T09:30:00+05:30, doors confirmed 09:30), and a pointer-reactive canvas background that animates gently on its own on mobile. Keep the background in one swappable component, the visual is `TODO(vedant)`.
2. **Ticker.** Marquee band in accent colour.
3. **About.** Three or four sentences. Not a wall.
4. **Sessions.** The five session formats: keynote, technical sessions, hands-on workshops, panel discussion, Q&A. A pinned horizontal stage, one card each, five progress bars and a `SESSION 0N / 05` counter. There are no tracks anywhere.
5. **Speakers.** Must render well with zero or one entry, with a real "announced soon" state. No placeholder silhouettes.
6. **Passes.** Four tiers, copper, gold, platinum and diamond, each with price and its full perk list written out (from `content/passes.ts`), and swag level. VIP is marked top tier. Q&A is on every pass. No early bird. Lunch is included on every tier and says so on every tier.
7. **Sponsors.** Title sponsor, then an "Organised by AWS SBG VJIT, by students, for students" block, then the community sponsor wall with open slots.
8. **Venue.** Address, map, metro, bus, cab, parking.
9. **FAQ.** Accordion, keyboard operable.
10. **Footer.** Contact, socials, code of conduct link, and this exact line: *AWS User Groups are run by independent volunteers and are not organized by AWS.*

### Session times

Times are not decided and must not appear on the public site. The only public time is doors at 09:30 on Friday 30 October 2026.

### `/schedule`, `/speakers`, `/sponsors` (removed)
The v3 handoff folds all three into the home page. Each is a permanent redirect (308, `next.config.ts`) to its home section: `/#prog`, `/#speakers`, `/#sponsors`.

### `/pass` and `/pass/[passId]`

`/pass` is where a student types their pass id. A `VERIFIED` id redirects to the pass. Anything else, an unknown id included, gets the one generic message, byte for byte the same response, so the page cannot be used to discover which ids exist.

`/pass/[passId]` renders only for `VERIFIED`: the ticket, with the QR encoding the pass id, name, college, tier, the technical session and workshop. Every other state and every unknown id is the same real 404, naming nothing. Legible on a phone in bright sunlight at a gate: high contrast, large QR.

### `/register`

While registration is closed (section 8), `/register` is the notify page, ported from the v3 handoff's `Register.dc.html` in its own route group with its own chrome: a padlock that bobs, shakes when poked and never opens, a drifting grid (the handoff's pointer-lit cells, glow and crosshair were removed at the organiser's request), and one email field with optional pass chips. `POST /api/notify` takes `{ email, interestedPasses, company }`, writes a `SUB#<email>` item and answers 200 whether or not the address was already there. `company` is a honeypot. Ten sign ups per IP per hour. The list is on `/admin/notify` and exports as CSV, admin only.

While open, `/register` is the flow, section 8. In production the closed page stays static; the open check runs per request, never at build time.

### `/register/preview`

The real flow for a signed-in admin while registration is closed to the public, under a PREVIEW banner, with a "Fill test data" button on the details step. Everything is live: seats are claimed, the screenshot uploads, email 1 is sent. The record is marked `source: preview`: it shows in the queue with a PREVIEW badge so it can be verified end to end, and no count, total or caterer export reads it. The hold route accepts `?preview=1` only from an admin session.

### `/register/pay/[passId]`

The payment step on its own, for the rejection email's link and for anyone who lost the tab. Renders for `REJECTED` (with the reason, no clock, seats still held) and for a live `AWAITING_PAYMENT` hold; everything else is the same 404. It has no way back to the earlier steps, which belong to the browser that made the hold.

### `/speak`, `/sponsor` and the `/code-of-conduct` report

The handoff's Speak and Sponsor screens (one component, `components/forms/ApplyForm.tsx`) and the code of conduct page's #report block (`ReportForm.tsx`) are real forms. `POST /api/forms` with `form: speak | sponsor | report` checks every field again on the server (`lib/forms.ts`, the handoff's rules and messages), stores one `FORM#` item with a reference (`SCD-SPK-`, `SCD-SPN-`, `SCD-RPT-`, or `SCD-URG-` for a report marked as happening right now, then five characters from the pass id alphabet), and mails the organisers' inbox with Reply-To set to the sender. Nothing is ever mailed to the sender, so the form cannot be used to send mail to an address someone typed. A failed organiser mail never loses a submission. `company` is a honeypot; twenty submissions per IP per hour. Departure: the speaker form's "Which track?" question is gone, since there are no tracks. `/admin/inbox`, admin only, lists all three newest first with urgent reports marked.

### `/admin`, `/admin/scan`, `/admin/users`, `/admin/settings`
Cognito sign-in, then a role from the table (section 7). `/admin/scan` is the one screen a volunteer gets; everything else is admin only. `/admin/users` manages the crew; `/admin/settings` holds the registration switch and the seat count of each of the seven sessions.

Dashboard: the launch blockers first; the `PENDING_VERIFICATION` queue, oldest first, with Verify and Reject; counts for all five states; a verified view; search by pass id, UTR, email and roll number; reinstate for `ABANDONED`; seats per session, held, sellable, free and verified; **the lunch headcount with the attendee CSV** (`/api/admin/attendees-csv`: verified and non-preview only, with sessions); the notify list; the last sweep run.

Scanner: camera QR scan reads the pass id, looks it up, shows name, tier and college in large type, buttons to mark checked in and swag issued. **Only `VERIFIED` admits.** An already-checked-in scan says so rather than silently succeeding. **Queue writes and retry on failure, because campus wifi will fail on the day.**

---

---

## 12. Email

SES, `ap-south-1`. Every body lives in `src/lib/email/templates.ts` as named exports, so wording changes there and nowhere else. All transactional, none market anything, plain and mobile-legible.

`VERIFICATION_WINDOW` is one exported constant, `"24 hours"` for now. The organiser has not yet said how often the bank statement is checked; when they do, only that constant changes.

| Email | Trigger | Idempotency mark |
|---|---|---|
| 1, receipt | entering `PENDING_VERIFICATION`: pass id, pass, sessions, amount | `receiptSentAt` |
| 2, confirmation | entering `VERIFIED`: the ticket link, sessions, refund wording | `confirmationSentAt`; the hourly run resends anything owed |
| rejection | entering `REJECTED`, quotes the UTR and the reason, links `/register/pay/<passId>`, **contains no pass link** | none |
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
- Grants: the Amplify SSR compute role gets read and write on the table and the screenshot bucket, `ses:SendEmail`, and the three Cognito admin calls the crew page needs (`AdminCreateUser`, `AdminSetUserPassword`, `AdminDeleteUser`)

Everything is code. Nothing is clicked in the console except the one-time bootstrap, the GitHub connection, and the SES production request.

---

## 14. Build order

Phases 0 to 3 of the original plan are done. The v3 handoff (28 September 2026) set the remaining order:

**v3 phase 1, live.** Landing and the closed `/register` regenerated from the handoff.

**v3 phase 3.** The registration flow, the preview, the pay page, UPI only, seats per session. Built before phase 2 because the organiser asked to see it.

**v3 phase 2, done.** Real forms for Speak, Sponsor and Code of Conduct reports: stored, listed on `/admin/inbox`, emailed to the organisers.

**Week of 21 October.** Content freeze. Rehearse check-in with 50 fake passes on real campus wifi. Take a manual DynamoDB backup the night before.

---

## 15. Blocked on Vedant

Done since this was written: `awsscdhyd.in` is registered, attached to Hosting and verified in SES with DKIM; SES has production access at 50,000 a day; the region is bootstrapped; Amplify builds `main` on push.

| Item | Blocks |
|---|---|
| Pass inclusions and swag levels (names and prices are confirmed) | Section 11 item 6 |
| The college UPI id and the payee name, `content/payment.ts` | The launch guard: nothing sells without the id |
| Seat count for each of the five technical sessions and two workshops, `/admin/settings` | The launch guard: nothing sells into an unsized session |
| Session times (none published until set) | Nothing yet; no time is shown anywhere |
| Speaker list, sponsor tiers, FAQ, code of conduct copy | Content files |

---

## 16. Live status

Kept current as work lands. Everything else in this file is the plan, this section is the fact.

**Phases 0 to 3 are built and deployed to the sandbox. Phase 4 is content and paperwork, which is on Vedant.**

| Thing | State |
|---|---|
| Sandbox backend | deployed: table, Cognito pool, reconcile Lambda, hourly schedule |
| Amplify Hosting | building from `main`, live at https://awsscdhyd.in with a compute role and production env vars attached |
| Landing page | ported from the design handoff (Landing Bitmap). Its own header and footer, theme in localStorage under `scd-theme`, cloud page transition on every route. APPLY TO SPEAK and BECOME A SPONSOR open the `/speak` and `/sponsor` forms |
| Schedule, speakers, sponsors, code of conduct, register, pass, pass entry, admin | ported to the handoff design under `src/app/(public)/` and `src/app/admin/`, one shared header and footer, pre-handoff stylesheet dropped |
| Sessions, not tracks | the public site is built on the five session formats in `content/formats.ts`; registration picks from `content/program.ts`. Tracks, rooms per track, slots and the per-slot picker are deleted |
| Registrations | **closed in code.** `REGISTRATION_OPEN` is false, every CTA reads NOTIFY ME, `/register` is the notify page. The v3 flow is built and walkable by admins at `/register/preview` |
| Design v3 | **Phase 1 live.** The landing and `/register` are regenerated from the v3 handoff markup (`C:/CODING/awsscdhyd_design`, bundle `(1)`). Display face is **Jersey 10** (it replaced Pixelify Sans, whose C read as an O); it has one weight and is never set bold. Shared display sizes in `globals.css` were scaled by 1.25, the ratio the handoff itself applied. Inner pages use the handoff's chrome: a `< SCD.HYD 26` back link and the theme toggle, footer with the site name and the legal line. Ported screens keep the handoff's content-box model under `[data-landing]` / `[data-dc]`. Phases 2 and 3 are built: the registration flow, and real Speak, Sponsor and report forms. |
| Traffic | **live.** A beacon in the root layout posts one page view per route change to `/api/hit`, which adds to `HITS#<IST day>` rows keyed `TOTAL`, `PATH#<route>` and `REF#<host>`. No cookie, IP address, user agent or visitor id is stored; a visit is the first view in a browser tab, counted by the browser. Paths outside an allowlist fold into `(other)`, so a caller can inflate a counter but never create keys. Crew pages, crawlers and Do Not Track / GPC browsers are not counted. `/admin/traffic`, admin only, shows 14 days, top pages, sources and how many `/register` visits left an address |
| Prices | Rs 499 / 799 / 999 / 1,299, confirmed 24 September 2026, every perk written out on every card |
| Registration flow, v3 | five steps and the received and expired screens, ported from the handoff. Seats per session claimed at the payment step, moved on edit, released by the sweep. Race test and the 26-check acceptance suite (`npm run test:lifecycle`, with `TEST_BASE_URL` for the HTTP checks) pass against the sandbox; a browser walkthrough from pass to received, including a real screenshot upload, passes on desktop and at 390px |
| Payments | UPI only. Razorpay removed on 28 September 2026 (in git history). The launch guard currently lists two blockers: the UPI id and the session seat counts |
| Organiser auth, dashboard, scanner | verification queue with sessions and student details, five-state counts, PREVIEW badges, reinstate, seats per session; scanner admits only `VERIFIED` |
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

Cognito `InitiateAuth` costs 135 ms from here and DynamoDB 26 to 40 ms, which is why the resolved session is cached. The window is five seconds: it is the delay before a role change bites, and on event day that has to be near immediate, so most of the latency win is given back on purpose.

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
- **The UPI QR has never been scanned by a real UPI app**, because the college UPI id is not set. Once it is, scan the QR from the preview with GPay, PhonePe and Paytm and check each shows the payee, the exact amount and the pass id in the note.
- The `accent` colour fails the 3:1 contrast a focus indicator needs on the light background, at 2.14:1. The ring uses `--text` instead. Worth raising with the design team on 12 September.
- **`amplify/package.json` is load bearing.** One line, `{"type": "module"}`, without which `ampx` cannot resolve extensionless imports.
- **Re-running the seed rotates nothing.** Seed pass ids are derived from an HMAC of their index, so a bookmarked pass link keeps working.
