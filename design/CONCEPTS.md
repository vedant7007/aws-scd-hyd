# Concepts: fourteen directions, ranked

Phase 3 of the rebuild brief. Written for someone who is not a designer. Each one is a complete world for the site, the poster, the story and the badge, priced against the budget in [TECHNIQUES.md](TECHNIQUES.md) section 5, and built on what [RESEARCH.md](RESEARCH.md) found rather than on taste alone.

Rules every concept obeys, so they are not repeated fourteen times:

- **AWS orange `#FF9900` appears as an accent in every one.** It is never text on a light background (it measures 1.9 to 2.1:1 against every light background here). It is a fill with near-black ink on it (`#0A0A0A` on `#FF9900` is 9.25:1), a rule, a stamp, a line, a dot. Each concept names a separate **focus colour** that measures at least 3:1 on both of its backgrounds; every ratio below was computed, not estimated.
- **Two type families maximum**, both free on Google Fonts (all checked today), loaded through `next/font` as the repo already does, so the swap is `globals.css` plus one import line.
- **Light and dark are both first class.** Where a concept is "dark by nature", the light mode is designed, not inverted.
- **Empty states are designed in**, because speakers, sponsors, prices and directions will be empty for weeks. Every concept says what "announced soon" looks like in its world.
- **Motion respects the technique budget:** no smooth-scroll library, no custom cursor, no always-on WebGL, one hero loop at most, scroll-timeline only on transform and opacity, everything off under `prefers-reduced-motion`.
- **Razorpay's checkout** takes one `theme.color`. Every palette below names which value to pass so the modal's button is readable (white text on `#FF9900` is not).
- **Nothing here invents content.** Prices, names, logos, capacities and directions stay `TODO(vedant)`.

"Build cost" is total days for the full redesign of every route by one person with help, of which the shell, tokens, register flow and admin are a fixed six to seven days regardless of concept; the number is the whole job. "KB" is what the concept adds on top of today's 186KB.

---

## 1. Line 30

**The pitch.** The event is a transit map. Three coloured lines (AI, Cloud, Careers) run across the page like metro lines, sessions are stations, the venue is the interchange where all three meet, and your pass is a travel card. A student in Hyderabad reads it instantly, because they ride one to college.

**The signature move.** On the hero, three lines draw themselves from the left edge and converge on one station marker labelled with the venue name and the date. It plays once, in about 1.6 seconds, when the page loads. Every other page reuses the line language: the schedule is the route map, each hall a line, each slot a station; the pass shows your chosen stations as stops on your route.

**Palette.**
Light: bg `#F4F1EA` (warm off-white, like a printed map), text `#111318`, muted `#5B5F6B`, accent `#FF9900`, line 1 `#0047AB`, line 2 `#C8102E`, line 3 `#00875A`, focus `#0047AB` (7.48:1).
Dark: bg `#0F1115`, text `#F2F0EA`, muted `#9AA0AB`, accent `#FF9900`, line 1 `#4C8DFF`, line 2 `#FF4D6D`, line 3 `#2DD4A0`, focus `#7FB2FF` (8.74:1).
Orange is the interchange marker, the "you are here" dot, and the ticket stripe. Razorpay `theme.color`: `#0047AB`.

**Type.** **Public Sans** (display and body, weights 400 to 800) because it is a wayfinding face: built for signage, open counters, reads at a glance from across a platform, and it is one family so it counts as one. **DM Mono** for station codes, times and the ticket reference, because transit systems label with monospaced codes and our pass already uses a monospaced ticket ref.

**Motion language.** Things arrive along a line: a heading slides in 12px from the left with the rule that underlines it. Stations "light up" (a dot scales from 0.6 to 1 with a 200ms ease) when they enter the viewport. Nothing floats, nothing bounces. The one loop is the hero draw, played once.

**How the hero works.** Full-viewport. Top left, the eyebrow "AWS Student Builders Group, VJIT" as a small station sign. Centre, the three lines as SVG paths (each under 800px long, stroke 6px), animated with `stroke-dashoffset` as a **one-shot CSS animation on load** (measured cost: ten frames of work once, then zero; tied to scroll it would cost 12% dropped frames, so it is not tied to scroll). They meet at a large orange interchange circle with the date inside it. Below, the headline in Public Sans 800 at 12vw: "AWS Student Community Day" with "Hyderabad" on its own line in line-1 blue. On mobile the lines run top to bottom instead of left to right and the interchange sits above the headline. Under reduced motion the lines are simply there. The countdown becomes a departure board: "Departs in 39 days 11 hrs" in DM Mono.

**Empty states.** A dashed line segment with a hollow station and the label "Station opening soon" for speakers and sponsors. That is a real sign on real metro lines under construction, so it looks planned rather than missing. Passes with no price: the fare box reads "Fare to be announced".

**Build cost.** 11 to 13 days. **+8KB** (three SVG paths, one map-tile pattern; no library). Android risk: **safe**. The only motion that is not plain CSS is the one-shot draw.

**Stress test.** Instagram story: the three lines vertical, the interchange, the date. Passes. A3 poster: metro maps are the most reproduced poster genre there is; it is a poster already. Passes. Lanyard badge: a travel card with a name, a tier stripe and the QR as the "chip". Passes, and it is the best badge of the fourteen.

**Why it might be wrong.** If the colours drift toward Hyderabad Metro's actual red, blue and green it will look like an ad for L&T Metro Rail, so the line colours must stay ours; and a metro is a slightly grown-up image for a room full of second-years.

---

## 2. Admit One

**The pitch.** The whole site is made of tickets. Perforated edges, a stub you can tear, stamps that say PAID and ADMIT ONE, a barcode strip. The pass page is the same object the hero is, so the thing a student screenshots is the thing they saw first.

**The signature move.** The hero is one enormous ticket, wider than the screen, angled two degrees. When registration opens, tapping "Get a pass" tears the stub off along the perforation (a clip-path animation, 400ms) and the stub becomes the register page. Until then the stub reads "Opens soon" and the tear does not happen; that is the empty state, and it is honest.

**Palette.**
Light: bg `#FFFDF7` (ticket stock), text `#1A1A1A`, muted `#6B6660`, accent `#FF9900`, stamp red `#C8102E`, focus `#1A1A1A` (17.1:1).
Dark: bg `#141210`, text `#F5EFE0`, muted `#A39C90`, accent `#FF9900`, stamp `#FF4D6D`, focus `#F5EFE0` (16.3:1).
Orange is the ticket's edge stripe and the "recommended" tier band. Razorpay `theme.color`: `#1A1A1A`.

**Type.** **Archivo** (variable width and weight; the Black and Narrow cuts) because a ticket needs one loud condensed word ("ADMIT ONE") and a normal reading weight, and Archivo does both in one family. **Chivo Mono** for the ticket number, gate, seat, time and the QR label, because a ticket's data is monospaced and dot-matrix printed.

**Motion language.** Stamps land: a stamp appears at 1.15 scale and 0 opacity and settles to 1 in 180ms with a slight rotation, like a rubber stamp hitting paper. Perforations do not move. Section entrances are a single fade. Nothing loops.

**How the hero works.** A ticket 110vw wide, rotated -2deg, in ticket stock with a hairline border and a row of punched holes along the tear line. Left block: the event name in Archivo Black at 11vw, three lines. Right stub: date, venue, "Doors 09:00", and the countdown as a printed "VALID IN 39 DAYS" line in Chivo Mono. An orange stripe runs down the left edge. On mobile the ticket rotates to portrait with the stub at the bottom. Under reduced motion the stamps are already stamped.

**Empty states.** A tier with no price shows the price field as a blank line with "to be printed" beneath it, like a ticket before the price is set at the box office. Speakers: a row of ticket stubs with "Name to follow". Sponsors: an empty "PRESENTED BY" line on the ticket back.

**Build cost.** 10 to 12 days. **+4KB** (one perforation SVG, one stamp SVG). Android risk: **safe**.

**Stress test.** Story: a ticket in portrait, that is what an Instagram story of a ticket already is. Passes. Poster: a ticket enlarged to A3 is a known poster form. Passes. Badge: it is a ticket stub with a QR. Passes.

**Why it might be wrong.** Every ticketing platform on earth (Konfhub included) uses ticket-shaped cards, so it risks reading as a product's UI rather than an event's identity, and it has no answer for "why Hyderabad".

---

## 3. Blueprint

**The pitch.** An engineering drawing of the day. Blue lines on paper (or white lines on blueprint blue in dark mode), a title block in the corner with sheet number and revision, figures numbered and captioned. It says "student builders" without a single word, and it looks like it was made by the people it is for.

**The signature move.** The hero is a technical drawing that draws itself once on load: the venue outline, the three halls, the stage, with dimension lines and callouts. Sections are sheets: "SHEET 03 / TRACKS / REV B". Empty content is exactly what a blueprint does with it: a dashed outline and "DETAIL TO FOLLOW".

**Palette.**
Light: bg `#F7F5EE`, text `#1B2A6B`, muted `#5C6693`, accent `#FF9900`, line `#2F4BC7`, focus `#1B2A6B` (12.1:1).
Dark: bg `#0B1F5C` (blueprint), text `#EDF1FF`, muted `#A9B6E8`, accent `#FF9900`, line `#7FA3FF`, focus `#9DC1FF` (8.4:1).
Orange is the revision cloud, the "recommended" callout and the one highlighted dimension. Razorpay `theme.color`: `#1B2A6B`.

**Type.** **Instrument Sans** for body and headings, because a drawing's lettering is a plain engineering sans, upright, slightly narrow, and Instrument Sans has that character without being a stencil. **Geist Mono** for the title block, dimensions, sheet numbers and captions, because a drawing's data is monospaced and the repo already ships a mono role.

**Motion language.** Lines are drawn, never faded: a rule extends from left to right in 300ms when its section enters. Callouts appear after the line reaches them. Nothing loops. The self-drawing hero plays once.

**How the hero works.** A paper field with a faint 8px grid (a 3KB tile). In the lower right, a title block: project name, "AWS Student Community Day", location, date, "Sheet 1 of 9", "Scale NTS". Centre: the drawing, an SVG under 20 paths, one-shot `stroke-dashoffset` over 1.8s (not on scroll; see TECHNIQUES 4.9). The headline sits along the top edge in Instrument Sans 700 at 9vw as the drawing's title. Countdown as a dimension line: "|<- 39 days ->|". On mobile the drawing stacks above the title block. Under reduced motion the drawing is complete on arrival. **The drawings must be SVG with few paths or rasterised**: makingsoftware.com's large inline SVGs cost it 93% of frames.

**Empty states.** Dashed outlines with "DETAIL TO FOLLOW, REV B" and a revision cloud in orange. On a drawing that reads as a normal stage of the work, not as missing.

**Build cost.** 12 to 14 days, because the drawing is real work. **+12KB** (grid tile, hero SVG, title block). Android risk: **safe** if the SVG stays small; **moderate** if the drawings grow.

**Stress test.** Story: one sheet with the title block. Passes. Poster: a blueprint is a poster; A3 is a real drawing size. Passes, best of the set for print. Badge: a small title block with the QR as the stamp. Passes.

**Why it might be wrong.** It is dry: a 19-year-old may read it as an exam paper, and blue-on-cream has no heat unless the orange is used bravely.

---

## 4. Front Page

**The pitch.** A newspaper. A masthead, "Vol. 1, No. 1, Hyderabad, Friday 30 October 2026", columns, rules, a lead story, classifieds. Announcements of speakers and sponsors are news items, so a site that is 80% "announced soon" reads as a paper waiting for tomorrow's edition, which is what it is.

**The signature move.** The masthead is the hero: "THE HYDERABAD BUILDER" (or whatever the team names it) in a blackletter-free, heavy serif at full width, with the date line and a live "edition" counter beneath it: "39 days to press". Each content update is a new "edition" number in the footer, so the site visibly changes as content lands.

**Palette.**
Light: bg `#F5F1E8` (newsprint), text `#121212`, muted `#5A5650`, accent `#FF9900`, rules `#121212`, focus `#121212` (16.6:1).
Dark: bg `#121212`, text `#EDE8DD`, muted `#9C968A`, accent `#FF9900`, rules `#EDE8DD`, focus `#EDE8DD` (15.3:1).
Orange is the one spot colour a paper can afford: the "EXTRA" banner, the highlighted price, the ticket stub in the classifieds. Razorpay `theme.color`: `#121212`.

**Type.** **Fraunces** (variable, with the optical-size and "soft" axes) for the masthead and headlines, because it is a modern newspaper serif with real character at display size and it is one family. **Public Sans** for body, captions and UI, because news body copy needs a plain, dense, legible sans and it pairs with a serif without fighting.

**Motion language.** Almost none, and that is the point. Sections arrive as a page turn: a 250ms fade with a 6px drop. Rules draw. Under reduced motion nothing changes because nothing was moving.

**How the hero works.** Masthead across the top at 14vw in Fraunces 900, the date line in small caps beneath it, a hairline rule, then a three-column lead: column one the "story" (three sentences of about), column two the venue and date as a boxed notice, column three the countdown as a "days to press" box in orange with black ink. On mobile the columns stack and the masthead breaks to two lines. No loop. This is the cheapest hero of the fourteen and it looks like the most expensive to typeset.

**Empty states.** A classified ad box: "SPEAKERS WANTED, names in the next edition"; sponsors: "ADVERTISE HERE" in a bordered box with the mail subject, which is exactly what our become-a-sponsor block already is.

**Build cost.** 9 to 11 days. **+0KB** beyond fonts (Fraunces variable is about 90KB; subset it). Android risk: **safe**.

**Stress test.** Story: the masthead and a headline. Passes. Poster: A3 is literally a broadsheet page. Passes. Badge: a press pass, which is a real object. Passes.

**Why it might be wrong.** Dense text is what students skim past on a phone, and a "newspaper" can feel like their parents' medium unless the type is big and brave.

---

## 5. Root

**The pitch.** The site is a terminal session. A dark screen, a prompt, and the event typed out as commands with their output. Every developer student has stared at exactly this screen; it is home turf.

**The signature move.** The hero types itself: `$ scd --city hyderabad --date 2026-10-30` and the output is the event card, line by line, over two seconds. Registration opening is a new line appearing in the log. Under reduced motion the whole transcript is printed already.

**Palette.**
Light: bg `#F2F4F1`, text `#101410`, muted `#5A6358`, accent `#FF9900`, ok green `#0B6E3A`, focus `#0B6E3A` (5.7:1).
Dark: bg `#0B0F0C`, text `#D9F0DC`, muted `#7E9A83`, accent `#FF9900`, ok `#5EF28A`, focus `#5EF28A` (13.4:1).
Orange is the prompt character and the highlighted output line. Razorpay `theme.color`: `#0B6E3A`.

**Type.** **JetBrains Mono** (already in the repo) for everything on screen, because the world is a terminal and it is a variable mono with real italics. **Bricolage Grotesque** (already in the repo) only for the one big non-terminal moment on each page (the event name in the hero output), because a page set entirely in mono at body sizes measured as the least readable thing in the research (Gravitas, 14px mono body; Pune, 9.6px pixel body).

**Motion language.** Typing (a `steps()` CSS animation on width, or a JS type-on for the hero only), a blinking cursor (one element, `opacity` keyframe), lines appearing one at a time. Nothing else moves.

**How the hero works.** A full-viewport "window" with a title bar (three dots, `scd@vjit:~`). The command types on. The output block: event name in Bricolage 800 at 10vw, then `date:`, `venue:`, `doors:` as key-value lines, the countdown as `T-39d 11h 56m`. The CTA is a line: `$ scd register` with "opens soon" in muted text after it. On mobile the window is edge to edge. One hero loop (the cursor blink), paused off-screen.

**Empty states.** `speakers: []  # announced soon`. `sponsors: []  # write to us`. In this world an empty array is normal and it is funny in the right way for the audience.

**Build cost.** 9 to 11 days. **+0KB**. Android risk: **safe**.

**Stress test.** Story: a terminal screenshot is native to Instagram tech culture. Passes. Poster: a black A3 with green mono reads as a hacker poster, which is fine and slightly dated. Passes with reservations. Badge: mono name and QR on black. Passes.

**Why it might be wrong.** It is the most familiar idea in this list to exactly this audience; a "hacker terminal" site has been done for every hackathon since 2015 and it can read as low effort even when it is not.

---

## 6. Loud

**The pitch.** A protest poster. Giant condensed capitals stacked to the edges, black on off-white, one acid colour and the orange, names in type so big they are the picture. It shouts, and it is honest about having no photos yet because it does not want any.

**The signature move.** The headline is a column of stacked words that fill the viewport edge to edge and change weight as they enter (one-shot entrance, not a loop, because a variable-font loop measured as the single worst technique in the benchmark). The speaker list is the same idea: every name at 8vw, no headshots, role in small text under it, like Design Bomb.

**Palette.**
Light: bg `#F2EFE6`, text `#0A0A0A`, muted `#57544D`, accent `#FF9900`, acid `#C9FF00` (fill only, never text), focus `#0A0A0A` (17.2:1).
Dark: bg `#0A0A0A`, text `#F2EFE6`, muted `#A09C93`, accent `#FF9900`, acid `#C9FF00`, focus `#C9FF00` (16.8:1).
Orange and acid are flat blocks behind a word, or a whole section's background with black type on it. Razorpay `theme.color`: `#0A0A0A`.

**Type.** **Big Shoulders Display** (variable, from thin to black, very condensed) for everything large, because a poster needs a face that packs six words into one screen width. **Familjen Grotesk** for body and UI, because a warm, slightly quirky grotesk keeps the small text friendly under all that shouting.

**Motion language.** Blunt. Blocks slide in from an edge in 220ms with no easing curve to speak of. The ticker runs. Weight snaps rather than eases. Under reduced motion everything is already in place.

**How the hero works.** Five stacked lines in Big Shoulders 900, each sized to fill the width exactly: "AWS / STUDENT / COMMUNITY / DAY / HYDERABAD", the last on an orange block. The date and venue are a single line of small caps across the bottom, OFFF-style: "FRIDAY 30 OCTOBER 2026 · VJIT, AZIZNAGAR · DOORS 09:00". Countdown as one enormous number "39" with "DAYS" beside it. On mobile it is identical because the type is sized to width. Nothing loops.

**Empty states.** "SPEAKERS: SOON" in the same 8vw type as a real name would be. It does not look empty; it looks like a poster before the lineup drops, which is a poster people put up.

**Build cost.** 8 to 10 days, the cheapest. **+0KB**. Android risk: **safe**. It measures like uncut.wtf.

**Stress test.** Story: this is a story format already. Passes. Poster: it is a poster. Passes, obviously. Badge: a name at badge width in Big Shoulders, tier band in orange, QR. Passes.

**Why it might be wrong.** "Brutalist poster" is the most common look on every gallery this year, and shouting for twelve sections is tiring; it needs a second, quiet register for the register flow and the pass.

---

## 7. The Gate

**The pitch.** You enter the site through an arch. On load the page opens from the centre in the shape of a Charminar arch, and the arch shape frames everything after: section openers, the pass, the poster. It is Hyderabad without a monument photo, a single shape people already know.

**The signature move.** The arch reveal: a `clip-path` that grows from a small arch at the centre to the full screen in 700ms, once, on the landing page only. The same arch is the top edge of the pass card and the frame around each track heading. Vedant already reacted well to this idea; the rejected version was muted green, so this one is warm stone and deep red with the orange.

**Palette.**
Light: bg `#F8F3EA` (limewash), text `#1C1A17`, muted `#6A6258`, accent `#FF9900`, deep red `#7A1F1F`, stone `#D9CDB8` (surfaces only), focus `#7A1F1F` (9.3:1).
Dark: bg `#161310`, text `#F3EBDD`, muted `#A79E90`, accent `#FF9900`, deep `#E0525A`, stone `#2A241D`, focus `#FFB84D` (10.8:1).
Orange is the keystone of every arch and the tier band. Razorpay `theme.color`: `#7A1F1F`.

**Type.** **Fraunces** for display, because its "wonky" axis at heavy weights has a carved, slightly ornamental quality that suits arches without becoming a pastiche of Deccani lettering. **Instrument Sans** for body and UI, plain and quiet, so the arch and the serif carry the identity and the reading text does not compete.

**Motion language.** Openings. Things reveal from behind an arch-shaped mask (clip-path on transform-friendly shapes, measured free). Slow and formal: 500 to 700ms with a long ease-out. Nothing bounces. Under reduced motion the arch is simply the frame; no reveal.

**How the hero works.** First paint: the page is visible inside a small arch at the centre (so there is never a blank screen), then the arch opens to full width. Behind it: the headline in Fraunces 800 at 11vw on limewash, "Hyderabad" in deep red, date and venue beneath in small caps, the countdown inside a small arch-topped panel with the orange keystone. Optionally, a faint four-minaret silhouette as a 4KB SVG line drawing at 10% opacity in the background, no photo. On mobile the arch is taller than wide, which is its natural proportion anyway.

**Empty states.** An empty arch-topped niche with "Coming soon" carved in small caps beneath it. Niches in old walls are often empty; it reads as intentional.

**Build cost.** 10 to 12 days. **+5KB** (arch SVG, optional silhouette). Android risk: **safe**; the reveal is one clip-path animation on one element.

**Stress test.** Story: an arch in portrait with the name inside. Passes, strongly. Poster: an arch-shaped die-cut or a printed arch frame. Passes. Badge: an arch-topped badge is a real and lovely object. Passes.

**Why it might be wrong.** It is one shape; if the arch is the only idea, page three feels like page one, and there is a real risk it slides back toward the heritage-tourism look Vedant already rejected.

---

## 8. Two-Colour

**The pitch.** A risograph zine. Two inks (orange and a deep blue) printed slightly out of register, grainy, on rough paper, with halftone photos and hand-set type. Cheap-looking on purpose, the way the best student zines and gig posters are.

**The signature move.** Misregistration. The orange layer of every heading sits 3px off from the blue layer, and when a section enters, the orange layer slides those 3px into place (transform, 250ms), like the second ink pass landing. Photos are halftone-dithered in one ink, so any speaker photo becomes part of the same print run.

**Palette.**
Light: bg `#FBF7EE` (uncoated stock), text `#1A1A1A`, muted `#5F5A52`, accent `#FF9900`, ink 2 `#0038A8`, focus `#0038A8` (9.2:1).
Dark: bg `#141414`, text `#F4EEE2`, muted `#A39D92`, accent `#FF9900`, ink 2 `#7FB2FF`, focus `#7FB2FF` (8.5:1).
Orange is one of the two inks, so it is everywhere, always as fill or as thick display strokes, never as body text. Where the inks overlap they multiply (`mix-blend-mode` on small static elements only, measured free at that scale). Razorpay `theme.color`: `#0038A8`.

**Type.** **Syne** (variable, from regular to extra-black, with wide, slightly odd letterforms) for display, because riso type is hand-set, wide and imperfect and Syne has that flavour. **Space Grotesk** for body, because it has enough quirk to feel printed and enough discipline to read at 16px.

**Motion language.** Print mechanics: things slide into register, stamps land, a grain tile sits over everything at 6% (pre-rendered, 5KB, static). Nothing loops. Under reduced motion the inks are already registered.

**How the hero works.** Paper field with grain. Headline in Syne 800 at 11vw set in two overprinted inks, the orange offset 3px up-left of the blue. A halftone-dithered photo of the campus or last year's room (if there is one; otherwise a halftone shape) in a single ink at the right. Date and venue as a hand-set line in small caps with a thick orange underline. Countdown as a stamped number. On mobile the two-ink heading stays; the photo goes below it.

**Empty states.** A blank halftone rectangle with a stamped "TBC" over it, and for sponsors a "YOUR LOGO, ONE INK" box that doubles as the sponsor pitch.

**Build cost.** 11 to 13 days, plus a small script to dither photos offline. **+6KB** (grain tile). Android risk: **safe** for the type; **moderate** if blend modes or dithering are done live instead of pre-rendered, which they must not be.

**Stress test.** Story: riso prints are the aesthetic of half of Instagram's design accounts. Passes. Poster: it is a print form. Passes. Badge: a two-ink stub. Passes.

**Why it might be wrong.** Risograph is the second-most common "print" look in the galleries this year after brutalist, and the misregistration trick can read as a rendering bug on a phone if it is even slightly too large.

---

## 9. Exhibit A

**The pitch.** The day is an exhibition. Each track is a wing, each session a work on loan, each speaker "on view". The type is museum wall labels: small caps captions, a title, the year, the medium. Quiet, expensive, and empty rooms look intentional because galleries always have a room being rehung.

**The signature move.** The spotlight. On the hero a soft radial highlight (one CSS radial-gradient on a transform-only element, no canvas) follows the pointer on desktop and drifts slowly on its own on a phone, lighting the headline like a picture light. That is the one loop. Everything else is still.

**Palette.**
Light: bg `#FAF8F3`, text `#161616`, muted `#6C6862`, accent `#FF9900`, focus `#161616` (17.1:1).
Dark: bg `#111111`, text `#F1EEE7`, muted `#9A968E`, accent `#FF9900`, focus `#F1EEE7` (16.3:1).
Orange is the wayfinding dot next to every label, the "you are here" on the floor plan, the tier marker. Razorpay `theme.color`: `#161616`.

**Type.** **Newsreader** (variable, optical sizes) for titles, because a museum label uses a restrained text serif at modest size rather than a poster face. **Instrument Sans** for captions and UI, small caps where the label needs them.

**Motion language.** Gallery-quiet. 400ms fades. The spotlight drifts. Under reduced motion the spotlight is fixed at the headline.

**How the hero works.** A large field of off-white with the headline in Newsreader 600 at 7vw, not huge, positioned as a work on a wall, with a wall label beneath it: "AWS Student Community Day, 2026 / Hyderabad / One day, three tracks / On view 30 October". The countdown is a label line: "Opens in 39 days". The spotlight lights the headline. On mobile the label sits under the title and the spotlight drifts. This hero is deliberately small; the effect is stillness.

**Empty states.** A label with "Acquisition pending" or "Currently being installed" beside an empty frame outline. Museums do this.

**Build cost.** 9 to 11 days. **+0KB**. Android risk: **safe**.

**Stress test.** Story: a wall label is a fine story, but quiet. Passes weakly. Poster: an exhibition poster is a strong genre. Passes. Badge: a small label with the QR. Passes.

**Why it might be wrong.** It is elegant in a way nineteen-year-olds on a OnePlus may read as a gallery for someone else, and it is the concept closest to the "generic minimal" already rejected.

---

## 10. Canvas

**The pitch.** The site is a design tool: a dark canvas with a dot grid, windows with corner handles and a selected element with blue handles, a layers panel that is the nav, a properties panel that is the countdown. For an event about building things, the interface of building is the world.

**The signature move.** Selection. When a section enters, its heading gets selected: blue handles pop at the corners and a small label above it says the element name ("h1 · 96px · Bricolage"). The schedule is a layers panel, each hall a group, each session a layer with an eye icon that becomes the "add to my day" toggle on the pass.

**Palette.**
Light: bg `#F5F5F5`, text `#141414`, muted `#666666`, accent `#FF9900`, selection `#0D6EFD`, focus `#0D6EFD` (4.1:1).
Dark: bg `#111111`, text `#F0F0F0`, muted `#9A9A9A`, accent `#FF9900`, selection `#5AA2FF`, focus `#5AA2FF` (7.2:1).
Orange is the "component" colour, used for the CTA and the recommended tier, the way a design tool uses one colour for components. Razorpay `theme.color`: `#0D6EFD`.

**Type.** **Geist Mono** for every label, panel and property, because tools are set in mono UI. **Bricolage Grotesque** (already in the repo) for the content itself, the "artboard" text, so the tool and the work look like two different things.

**Motion language.** Tool feedback: handles pop in 120ms, panels slide 8px, hover shows a blue outline (desktop only). Nothing loops.

**How the hero works.** A dot-grid canvas. Centre: an "artboard" with the headline in Bricolage 800 at 10vw, selected, with blue handles and a measurement label. Right (desktop) or below (mobile): a properties panel in Geist Mono listing Date, Venue, Doors, and "Countdown: 39d 11h" as a live property. The nav is a layers panel top-left. Everything is DOM; no canvas element.

**Empty states.** An empty artboard with a dashed frame and the label "speakers · 0 layers · add when confirmed". Design tools have empty frames all day.

**Build cost.** 11 to 13 days; the panels are a lot of small UI. **+0KB**. Android risk: **safe**, the same measured cost as Builders Table's DOM (its 33ms was jQuery, GSAP and Lenis, none of which we would ship).

**Stress test.** Story: a selected artboard is a good story frame. Passes. Poster: A3 of a design canvas is fine but not exciting. Passes weakly. Badge: a layer row with a name and an eye icon. Passes, and it is a neat badge.

**Why it might be wrong.** Builders Table already did it very well two months ago, and "UI inside UI" is genuinely confusing on a phone where the handles cannot be dragged.

---

## 11. Foil

**The pitch.** A holographic trading card. Dark background, one object (the pass) that shimmers in rainbow foil as it tilts, iridescent type accents. The pass becomes something students want to collect and show, which is exactly the page they screenshot.

**The signature move.** The tilt. On the pass page the card follows the phone's tilt (gyroscope, with permission on iOS) or the pointer on desktop, and a conic-gradient foil layer shifts with it. On the landing page the hero card does the same, slowly on its own.

**Palette.**
Light: bg `#F6F6F8`, text `#121218`, muted `#61616E`, accent `#FF9900`, focus `#4F2ED6` (7.2:1).
Dark: bg `#0A0A10`, text `#F4F4FA`, muted `#9C9CB0`, accent `#FF9900`, focus `#B9A6FF` (9.4:1).
The foil is a gradient of `#FF9900` through violet and cyan, used only inside the card and the accent rule; the rest of the page is one flat dark or light. Razorpay `theme.color`: `#4F2ED6`.

**Type.** **Unbounded** (variable, wide, geometric) for display, because trading-card type is wide, techno and slightly futuristic. **Manrope** for body, because it is clean and reads well on dark.

**Motion language.** Tilt and shimmer, continuous but subtle, on the one card only. Everything else is a plain fade.

**How the hero works.** A dark field. Centre: a pass-shaped card, 3D-tilting (a single `transform: rotateX() rotateY()` on one element; measured free), with a foil layer (`background: conic-gradient(...)` whose `background-position` moves with tilt; this is a paint property so the layer must be small and its own composited element). The headline sits on the card. Countdown on the card back (a flip on tap). On mobile the card tilts with the device after permission, or drifts if denied.

**Empty states.** A card face with "Speakers, next drop" in foil type: the card game language ("drop", "series 1") turns an empty list into anticipation.

**Build cost.** 12 to 14 days. **+3KB**. Android risk: **moderate to ambitious**: a moving conic gradient is a paint cost on every tilt frame and the GPU cost is invisible to our harness; gyroscope permission on iOS is a prompt that many will decline. Must be limited to the card, capped at 30fps, and static under reduced motion.

**Stress test.** Story: a foil card is a perfect story. Passes. Poster: foil does not print on an A3 inkjet; on paper it is just a gradient. Fails. Badge: a foil-printed badge is expensive; a printed gradient looks cheap. Fails.

**Why it might be wrong.** Two of the three physical formats fail, and the effect that makes it work is the one effect this harness cannot measure.

---

## 12. Issue #1

**The pitch.** A comic book. Halftone dots, thick ink outlines, panels with gutters, speech bubbles, and a cover: "AWS SCD HYD, Issue #1, Hyderabad, October 2026, First Issue!". Sections are panels. It is loud, friendly and unmistakably not a corporate event.

**The signature move.** The cover. The hero is a comic cover with a starburst ("FIRST ISSUE!"), a masthead, a price box that says "FREE TO READ" and a barcode that is the site's QR. Scrolling turns the page: each section is a panel that arrives with a 180ms snap and a small "WHOOSH" caption for the CTA.

**Palette.**
Light: bg `#FFF8E7` (pulp paper), text `#111111`, muted `#5C5850`, accent `#FF9900`, cyan `#00A7E1` (fills only), focus `#0057B8` (6.5:1).
Dark: bg `#101010`, text `#FFF4DC`, muted `#A39B8B`, accent `#FF9900`, cyan `#7FD3FF`, focus `#7FD3FF` (11.5:1).
Orange is the starburst and the "POW" fills. Razorpay `theme.color`: `#0057B8`.

**Type.** **Bungee** for display, because it is a chunky, outlined-feeling display face that reads as comic lettering without being a novelty "comic sans". **Public Sans** for body, so the reading text is calm inside loud panels.

**Motion language.** Snaps and pops: panels land hard, captions pop in with a 1.1 scale overshoot. Halftone is a static pre-rendered tile. Nothing loops.

**How the hero works.** A cover at full viewport: thick black border, masthead in Bungee at 12vw, a starburst in orange with "FIRST ISSUE!" in black, the date and venue in a caption box, the countdown in a "coming in 39 days" bubble. A single illustrated element is needed for the cover to work, which is the catch: we have no illustrator, so the cover would have to be type and shapes only.

**Empty states.** A panel with "TO BE CONTINUED…" and a "next issue" caption. Comics do this every issue.

**Build cost.** 11 to 13 days without illustration; more with. **+8KB** (halftone tile, starburst SVG). Android risk: **safe**.

**Stress test.** Story: a comic cover is a great story. Passes. Poster: covers are posters. Passes. Badge: a small panel with the name in Bungee. Passes.

**Why it might be wrong.** Without real illustration a comic is just shapes with thick borders, and the tone can read as younger than a college conference wants to be.

---

## 13. Orbit

**The pitch.** A launch. Dark navy, a countdown that reads like mission control ("T-minus 39 days"), the three tracks as orbits around the venue, a slow two-layer starfield. Space is the safe choice for a tech event, and this version keeps it very quiet so it does not become Gravitas.

**The signature move.** The T-minus countdown, large, in the hero, with the seconds as a thin arc that fills. When it reaches zero on the day, the page changes state to "LIVE" (which is a real moment the site can own).

**Palette.**
Light: bg `#F3F4F8`, text `#0E1220`, muted `#5D6478`, accent `#FF9900`, focus `#0E1220` (17.0:1).
Dark: bg `#070A14`, text `#EEF1FA`, muted `#8F97AD`, accent `#FF9900`, focus `#FFB84D` (11.5:1).
Orange is the thruster: the countdown arc, the CTA, the "recommended" ring. Razorpay `theme.color`: `#0E1220`.

**Type.** **Space Grotesk** for display and body (one family), because it was designed from a monospace and carries the instrument-panel feel without a second face. **DM Mono** for telemetry: the countdown digits, ticket refs, times.

**Motion language.** Slow drift: two starfield layers move at different speeds with scroll (transform-only parallax, measured free). The arc fills. Nothing bounces.

**How the hero works.** Dark field with two star layers (two 20KB tiled PNGs, transform parallax). Centre: "T-minus" in DM Mono above the countdown at 14vw. Below: the headline in Space Grotesk 700 at 8vw, date and venue as a "mission" line. The tracks section draws three orbit ellipses (SVG, static) with the venue at the centre. Light mode is a daytime launch: pale sky, dark type, same layout.

**Empty states.** "Crew: to be announced" and "Mission partners: to be announced" in DM Mono under an empty orbit ring.

**Build cost.** 9 to 11 days. **+40KB** (star tiles). Android risk: **safe**.

**Stress test.** Story: a countdown on navy. Passes. Poster: space posters are a strong genre. Passes. Badge: a mission patch. Passes.

**Why it might be wrong.** It is the default for tech events (Gravitas is purple space already) and the only thing that would make it ours is restraint, which is hard to show on a poster.

---

## 14. Aksharam

**The pitch.** The letters themselves are the identity. Telugu and Latin type set together at enormous size: హైదరాబాద్ beside HYDERABAD, one matched family across both scripts, so the city's own script is the picture. Warm paper, deep maroon, orange. It is the only concept in the list that no other tech event in India could copy.

**The signature move.** The bilingual flip. The hero headline shows "Hyderabad" and, letter by letter, swaps to హైదరాబాద్ and back once, on load (a per-glyph opacity crossfade, no variable-font tricks). Every section label carries both scripts, Telugu small above the Latin.

**Palette.**
Light: bg `#FBF6EE`, text `#1A1612`, muted `#6B6259`, accent `#FF9900`, deep `#7B1E3C`, focus `#7B1E3C` (9.3:1).
Dark: bg `#15110E`, text `#F6EEE2`, muted `#AB9F92`, accent `#FF9900`, deep `#FF8FAF`, focus `#FF8FAF` (8.8:1).
Orange is the underline stroke beneath every Telugu word and the tier band. Razorpay `theme.color`: `#7B1E3C`.

**Type.** **Anek Telugu and Anek Latin**, one multi-script family by Ek Type designed to match across scripts, so this is one family in two scripts and it counts as one. Variable weight and width. **DM Mono** for data. Noto Sans Telugu as the system fallback for the Telugu subset.

**Motion language.** Restrained: crossfades, 300ms, on the script swap and on entrances. Underlines draw once (short paths, on load, not scroll). Nothing loops.

**How the hero works.** Paper field. Headline in Anek at 11vw, 700, width axis slightly condensed: "AWS Student Community Day" in Latin, then "Hyderabad" which performs the one-time swap to Telugu and settles on Latin with the Telugu small above it. An orange stroke underlines the city. Date and venue in both scripts, small. Countdown in DM Mono. On mobile the swap still happens; the Telugu subset is about 70 to 90KB extra, loaded only for the glyphs used (`next/font` subsetting by text).

**Empty states.** Labels that read "త్వరలో · Soon" with the underline. Bilingual "soon" looks like a heading, not a gap.

**Build cost.** 11 to 13 days plus a native Telugu reader on the team to check every string; **this concept must not ship a single Telugu word that has not been read by a Telugu speaker.** **+80KB** (Telugu font subset). Android risk: **safe**; text is text.

**Stress test.** Story: Telugu type at scale is striking and shareable. Passes. Poster: bilingual posters are the norm in the city. Passes. Badge: a name in Latin with the Telugu city mark. Passes.

**Why it might be wrong.** Half the room may not read Telugu (Hyderabad's colleges draw from across the country), and if the Telugu is decorative rather than used, it is exactly the kind of cultural wallpaper that the muted-green Charminar was.

---

## Ranking

Judged on: whether a student on a mid-range phone gets something memorable in two seconds; whether it survives six weeks of empty content; whether it works on a poster, a story and a badge; whether it holds the frame budget; and whether it is ours rather than the year's default.

| # | Concept | Two-second hit | Empty weeks | Print / story / badge | Budget | Ours? | Rating |
|---|---|---|---|---|---|---|---|
| 1 | **Line 30** | strong | strong | all three pass | safe | yes | build this |
| 2 | **Loud** | strongest | strongest | all three pass | safe | no (common) | strong second |
| 3 | **The Gate** | strong | good | all three pass | safe | yes | strong third |
| 4 | Admit One | good | strong | all three pass | safe | partly | good |
| 5 | Front Page | good | strongest | all three pass | safe | partly | good |
| 6 | Blueprint | good | strong | best print | safe / moderate | yes | good, dry |
| 7 | Aksharam | strong | good | all three pass | safe | most | good, needs a reader |
| 8 | Root | good | good | passes | safe | no (familiar) | fine |
| 9 | Two-Colour | good | good | passes | moderate | no (common) | fine |
| 10 | Orbit | ok | ok | passes | safe | no (Gravitas) | fine |
| 11 | Canvas | good | good | badge good | safe | no (Builders Table) | fine |
| 12 | Exhibit A | quiet | strong | passes | safe | no (near "minimal") | risky |
| 13 | Issue #1 | good | ok | passes | safe | partly | needs illustration |
| 14 | Foil | strong on screen | ok | **fails poster and badge** | ambitious | partly | do not |

### Why Line 30 is the obvious answer

It is the only concept that solves the hardest page instead of decorating it. The schedule is the thing the brief singles out (time down, halls across, per-hall list on mobile, never a horizontal table) and a route map is that layout: each hall is a line, each slot a station, and on a phone you read one line at a time top to bottom, which is exactly the per-hall vertical list. The pass becomes a travel card showing the stations you picked, so the session picker and the pass are one object. The tracks are three lines by nature. The empty state ("Station opening soon") is a sign that exists in the real world and never reads as broken. It is Hyderabad through the thing students actually use daily, not through a monument. And it costs eight kilobytes: three SVG paths drawn once on load, and CSS. It measures like uncut.wtf, not like Gravitas, and it is the one direction here that gives the badge, the poster and the story a system rather than a crop.

The risk is real and manageable: keep the line colours ours (the metro's own red, blue and green would make it an L&T ad), and keep the type big and warm so it is not a wayfinding manual.

### Why Loud is second and not first

It is the cheapest, the loudest, the easiest to print, and it is what Design Bomb and OFFF prove works for an event with no content yet. On a phone it is unbeatable: type sized to the width fills the screen with the event name and nothing loads. If Vedant wants the poster to lead, this is the one. It is second because it is the year's default look on every gallery, it has no idea about Hyderabad, and twelve sections of shouting need a second voice that the concept does not naturally have. It would also be the right fallback if Line 30's drawing turns out to eat more days than planned: the type system is the same size and the two share a palette logic.

### Why The Gate is third

It is the idea Vedant already liked, done in a palette that is warm and bold rather than muted, and the arch is a single shape that gives the pass, the poster and the badge a silhouette. The reveal is one clip-path animation and it is genuinely memorable in the first second. It is third rather than first because one shape is thin as a whole system: by the schedule page the arch has nothing to say, and the fall back toward heritage kitsch is one wrong photo away. It would work best combined: the arch as the entrance to Line 30's station. That is a real option, and if Vedant picks The Gate I would build it that way.

### What I would not build, plainly

Foil, because two of the three physical formats fail and its only effect is the one we cannot measure. Exhibit A, because it is the rejected "generic minimal" with better labels. Issue #1 without an illustrator. Orbit, because Gravitas already owns purple space for this audience and the only thing that would distinguish ours is what a poster cannot show.

---

## What happens next

Nothing, until Vedant picks. Per the brief, no site code is written before a direction is chosen. When it is, the build order in section 9 of the brief applies: tokens and theme in `globals.css` first (with a proof that the swap is one file), shell, hero and signature move, landing sections, `/register` mobile-first, `/pass/[token]`, remaining pages, admin last. Every step measured against the table in TECHNIQUES.md section 1, with today's 16.9ms as the number to beat, not merely to match.
