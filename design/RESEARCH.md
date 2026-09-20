# Design research

Phase 1 of the rebuild brief. Everything here was looked at on **20 September 2026** with real tooling, not recalled. Where a source could not be reached, it says so. Where a number is measured, the method is named. Where something is an inference from a screenshot, it is marked as one.

The companion files are [TECHNIQUES.md](TECHNIQUES.md) (how the impressive sites are built and what each technique costs) and [CONCEPTS.md](CONCEPTS.md) (fourteen directions for this site, ranked).

---

## 1. Method

Three harnesses, all Playwright driving the installed Chrome over CDP, all kept in `scripts/research/` so the numbers can be reproduced:

| Harness | What it does |
|---|---|
| `teardown.mjs` | Loads each site at 1440x900 desktop, then at 412x915 / 2.6x with an Android UA, then again on desktop with `prefers-reduced-motion: reduce`. Records every network response with its transfer size by type, patches `canvas.getContext` before any page script runs so WebGL vs 2D use is a fact not a guess, counts `IntersectionObserver` constructions, `requestAnimationFrame` calls and scroll listeners, walks computed styles for sticky/fixed/animated/transitioned/blend/filter counts, reads `document.fonts`, measures h1 vs body size, samples the dominant background and text colours, scans stylesheets for `animation-timeline`, `view-timeline`, scroll-snap and container queries, and screenshots both viewports. |
| `fingerprint.mjs` | Downloads the body of every script the page loads and greps it for library signatures (`gsap.registerPlugin`, `new Lenis`, `THREE.REVISION`, `rive.wasm`, `AnimatePresence`, GLSL `gl_FragColor`, and so on), which is far more reliable than globals or file names on bundled sites. Also calls `document.getAnimations()` to read real durations and iteration counts. |
| `walk.mjs` / `perf.mjs` | Dismisses popups, screenshots the page at ten scroll depths on both viewports into a contact sheet, and measures scroll frame timing on the mobile profile with the CPU throttled 4x through CDP, using the same rAF method as this repo's `scripts/measure-scroll.mjs`, so the numbers compare directly with the table in the brief. `perf.mjs` runs each site twice in isolation and keeps the better pass. |

Library sizes came from the bundlephobia API and from gzipping the actual files off unpkg. Browser support came from caniuse pages fetched today.

**41 sites** went through the teardown harness, **18** through the deep walk, **24** through the isolated 4x perf pass. The per-site studies below cover the 30 that mattered; the rest are in the summary table at the end.

### What I could not access, and did not guess at

| Source | What happened |
|---|---|
| **mobbin.com** | The Mobbin MCP connector answers `requires a paid plan`. The web gallery returns HTTP 403 to automation. **No Mobbin flows were studied.** Section 5 substitutes the ticketing products Hyderabad students actually use. |
| **lapa.ninja** | HTTP 403. |
| **land-book.com** | HTTP 403. |
| **godly.website** | 301 redirects to `recent.design`, which is now a design-shots feed with internal `/i/` links rather than a site gallery. Studied as that. |
| **lisa.locomotive.ca** (Awwwards SOTD 16 Sep) | Cloudflare challenge page (403). Could not be loaded by the harness. |
| **in.bookmyshow.com** | Cloudflare block on desktop ("Sorry, you have been blocked"). The mobile-UA load got through but only to the shell. |
| **cult-ui.com** | HTTP 429 on two attempts. Not studied. |
| **luma.com/hyderabad** | Event discovery needs a sign-in. The lu.ma homepage was studied instead; no event page. |
| **awwwards.com/annual-awards** | The winners page lists names but no external URLs or year. I matched Lando Norris and Scout Motors to their real sites and studied those. |
| **cursor.com/compile, builderstable.net, spatial-festival.com** | Teardown succeeded; the deep-walk script crashed on navigation for these three, so their motion notes come from the teardown pass and the first-fold screenshots only. |

Sites that never finished loading inside 45 seconds on a normal connection: spatial-festival.com, scoutmotors.com. Both are reported with what loaded.

---

## 2. What the galleries surfaced

Fetched today. These are the sources for the per-site list; the galleries themselves are not design references.

**Awwwards, Sites of the Day, September 2026.** Pensatori Irrazionali (20 Sep), Boc.Studio (19), Noho (18), LxL Creative (17), L.I.S.A. by Locomotive (16), Aspen Search (15), Léo Parpeix (14), Miu Miu Tuscan Journey (13), Warm & Fuzzy (12), White Desert (11), Cerebrium (10), USAvionix (9), Seasats (8), Why Zero (7), United Carriers (6), Gionatan Nese (5), Illoca (4), Trevor Noah (3), Paul Kalkbrenner (2), Squarespace Foundations (1). August: ERA Residence (Site of the Month), Aardvark Book Club, Hobro Digital, Decathlon Yestalgia, Sharplink, AI in Design Report 2026, Miu Miu, /zeroz, Kononenko, mesh3d gallery, Oimachi. Nearly all carry a Developer Award, which on Awwwards means heavy custom front-end.

**Awwwards annual winners (the 2025 awards).** Site of the Year: Lando Norris. Developer Site of the Year: Messenger. E-commerce: Scout Motors. Agency: Immersive Garden. Studio: Malvah. Independent: Louis Paquet. Users' Choice: Lando Norris.

**Awwwards events category.** Design Bomb Festival, OFFF Forum, Hack the North (Honorable Mention, 3 Aug 2026), No Art (SOTD 6 Aug), Readymag London Meetup, Kortrijk Xpo, Le Mans Classic, Frontier Dialogues, and a run of agency and wedding sites. Hack the North is the only student event in the list.

**onepagelove, Event category** (377 curated). Spatial festival, Superlocal 2026, Builders Table, Rendez-vous Francéclat, Cursor Compile, The Deep End, L'Aia e il Pagliaio. Three of these are tech or design conferences in the same month as ours.

**landing.love** (2,150 catalogued). Léo Parpeix, Nicolás Martins, Ascension, illoca, typo.love, Zero, Santioni Spirits, The Art of Hosting (Luma), Heron AI, Artemii Lebedev, Huy Phan, Jesper Landberg. Sponsored Webflow and Framer entries mixed in.

**httpster.** Making Software, Footer Design Gallery, Warren & Mahoney, Jacky Winter, Drams, Bauhaus Clock, Visual Journal, Benvenusa, Developments, Patrick Mason, Cosmos, Overpass, Snøhetta, Wiz, Viens-là, Middle Name, Ossa Wines, Vivien's Creative, USPS, Counter Forms, Uncut, LiveSurface, Buffet Digital.

**siteinspire** (page 1 of many). Forty sites, heavily portfolios and fashion e-commerce; Whole Earth Index, Atlason and CcType under "Typographic".

**minimal.gallery** (131 pages). United Flags of Fashion, LinkLetter, Driftime Impact Report, Kiara Di Gregorio, Onœra, Sonderdays, Watts Pet, Goodside, Eternal Blue, Buena, Boc.Studio, Cozy Journal, Denmu, and others.

**recent.design** (what godly.website now is). Shots rather than sites: "Holographic Card Effect", "ASCII Image Loader", "OTP Slingshot Input", "Liquid Glass Hero", "WebGL Particle Creature", "Infinite FAQ Component". Useful as a read on what the 2026 feed rewards: single interactions, not pages.

**Search, for our direct peers.** AWS Student Community Day Chennai 2026 and Thane 2026 both sell through Konfhub (`konfhub.com/aws-scd-2026-chennai`, `konfhub.com/aws-student-community-day-thane-2026`); AWS Community Day Nagpur runs its own site (`acd.awsugngp.com`); Malaysia, Ahmedabad, Vadodara, Pune, Bengaluru community days are all Konfhub pages. Our sister events do not have sites; they have a ticketing page.

---

## 3. Site studies

Each entry: what it sells and to whom; the strongest visual move; type as measured (family, computed h1 size and weight, computed body size, the ratio between them); colour as sampled from computed styles (the dominant backgrounds and text colours, not a brand guide); motion as detected (library fingerprints, `getAnimations()` durations, reduced-motion behaviour); one thing to steal; one thing that is decoration. Weight is transfer size as recorded by CDP on a desktop load, then the mobile load. The 4x-throttle numbers are from the isolated perf pass; where a site was only measured in the contended walk pass, it says "walk".

The single most useful column in all of this is **reduced motion**. It is the difference between the animated-element count with `prefers-reduced-motion: no-preference` and with `reduce`. A site that shows the same count in both has not implemented it.

### 3.1 The three sites Vedant named

#### gravitas.vit.ac.in
*VIT Vellore's tech fest, 18 to 20 September 2026. Sells events, merchandise and sponsor visibility to students.*

- **Strongest move.** A dark navy world (#0d0e20) with electric purple (#2d1b82) where a giant circle grows on scroll until it becomes the "g" logo, ghost "graVITas" mega-type sits behind content, and clubs appear as round sticker-cards. A modal titled "Upcoming Events!" covers the hero on first load.
- **Type.** Clash Grotesk (display), IBM Plex Mono 14px body (12px on mobile), Aldrich and Aux Mono for labels. Eight loaded font faces. The measured h1 is a 14px uppercase mono marquee, so the display hierarchy is carried by non-heading elements.
- **Colour.** #0d0e20, #2d1b82, white, lavender #d8b4fe at 70%. Four values. The purple carries everything.
- **Motion.** Next.js with GSAP, ScrollTrigger, ScrollSmoother and Lenis (all confirmed in script bodies). Pinned scroll sections, four `react-fast-marquee` bands looping at 50 to 74 seconds, a slot-machine text swap at 400ms, a custom cursor, 4,368 rAF calls in the measurement window. Uses `animation-timeline` in CSS as well. **Reduced motion: 22 → 20 animated elements.** Not implemented.
- **Weight.** 7.9MB desktop, 7.4MB mobile. 626KB of JS. 5.4MB of images including a 1.3MB PNG ("Total Participants") and 973KB, 467KB and 422KB PNG club logos. A 1.1MB mp4. 8,252 DOM nodes.
- **4x throttle.** p95 frame 233ms, 87% of frames over 32ms, 57 long tasks, worst 544ms, 79 frames presented in 8 seconds. Load 17.4s on a normal connection.
- **Steal.** The ghost mega-type layer behind a section (one absolutely-positioned word at 20vw, transform-only) and the round sticker-card cluster for clubs, which would suit our tracks or sponsors.
- **Decoration.** The on-load modal, the custom cursor, and every PNG that should have been a 40KB WebP.

#### zero.university
*Zero, an ed-tech app for students "in debt and still no job". Sells a beta signup.*

- **Strongest move.** A photoreal rendered desk. As you scroll, a university diploma on the desk is crumpled into a paper ball, then a rendered campus city appears, then "and it costs… zero". The hero is a still; the crumple is a **171-frame image sequence** scrubbed on scroll, not live 3D.
- **Type.** STK Bureau Serif Book 90px, letter-spacing -4.5px, against Google Sans Flex 14px 500. **Ratio 6.4x.** Caveat (handwriting) for annotations, PP Supply Mono for labels. Ten font faces.
- **Colour.** White, #fbfaf9, green #0e895a, cyan #99eeff, black. The green is the brand and the accent.
- **Motion.** Framer-built site. Framer Motion, Lenis, a Spline embed, Lottie, three videos, 11 sticky sections, 50 IntersectionObservers, 12,173 rAF calls in the window. `animation-timeline` and `view-timeline` present in CSS. **Reduced motion: 0 → 0**, because every animation is JS-driven, so the media query changes nothing and the sequence still scrubs.
- **Weight.** 17.0MB desktop, 16.2MB mobile. 1.24MB JS. One 6.36MB AVIF ("ZERO-CITY-NEW-6000"). fbevents.js 108KB.
- **4x throttle.** p95 frame **1,017ms**, 97% of frames over 32ms, 35 long tasks, LCP 8.6s, 35 frames presented in 8 seconds. In the contended pass it produced one 17.4-second task. On a mid-range Android the page freezes while decoding frames.
- **Steal.** The narrative. A real object changes state as you scroll and the change means something (the degree becomes rubbish). That is why Vedant liked it, and it is achievable with 12 frames, not 171.
- **Decoration.** The 6MB city render and the Spline embed, both of which exist to prove budget.

#### why.zero.university *(SOTD 7 Sep 2026)*
*The "why" story for the same product.*

- **Strongest move.** A full WebGL scene in deep green (#1c4839): rendered hands (GLB models), a glass-shatter, a HUD with a vertical "scroll ruler" that shows where you are.
- **Type.** Supply Sans, PP Supply Mono. No h1 in the DOM.
- **Colour.** #1c4839, #201d1d, white at 60 to 92%.
- **Motion.** One 329KB bundle containing GSAP, ScrollTrigger, three.js, GLSL, Draco and Basis decoders. Textures as KTX2 (948KB hands, 528KB text), staged audio (mp3). CSS: a 700ms infinite spinner, a 9s shimmer, a 2s bob. **Reduced motion: 7 → 7.**
- **Weight.** 6.3MB, 501KB JS.
- **4x throttle (walk).** p95 150ms, 68% of frames over 16.7ms, 17 long tasks, worst 474ms.
- **Steal.** The scroll ruler as a progress indicator: a fixed vertical rule with tick marks and a moving marker. Pure CSS.
- **Decoration.** Everything rendered. The story is four sentences.

### 3.2 Direct competitors: student and tech events

#### awsstudentcommunitydaypune.com
*Our sister event, held 4 April 2026 at PICT Pune, run by AWS Cloud Clubs.*

- **Strongest move.** A Minecraft world. Sky, floating grass islands, a cloud-headed Steve with a pickaxe, wooden signboards for content, a "Final Quest" at the end that lets you upload a photo and download a badge.
- **Type.** Press Start 2P for everything: h1 28.8px, body 12.8px, **9.6px body on mobile**. One face, unreadable at paragraph length.
- **Colour.** Sky blue, grass green, signboard browns #8b5a3c / #8b4513 / #654321, gold #ffd700, white, black at 80%. The green CTA is the accent.
- **Motion.** No framework beyond a 70KB Vite bundle. CSS keyframes only: `pixelFloat` 2.2s infinite on 16 helpers, `float` 3s, `pixelInstall` and `counterRotate` 4s on speaker frames, 400 to 600ms reveals on IntersectionObserver. 55 animated elements. **Reduced motion: 55 → 55.**
- **Weight.** 13.9MB, of which 13.8MB is PNG: four character sprites at 2.1 to 2.2MB each, a 1.5MB group photo, a 1.5MB nav logo. 72KB JS. Mobile page 17,204px tall.
- **4x throttle.** p95 33.9ms, 50% of frames over 32ms, only 3 long tasks. LCP 8.5s because the hero sprite is 2MB. It is smooth-ish once loaded and slow to arrive.
- **Steal.** The badge generator. A shareable artefact students make themselves is worth more than any hero animation. Ours already exists at `/pass/[token]/share`; it should be treated as the signature, not a utility.
- **Decoration.** Body copy in a pixel font, and every 2MB sprite. Also: **pixel art is now taken.** Doing it in Hyderabad would read as a copy of Pune.

#### hackthenorth.com *(Awwwards Honorable Mention, Aug 2026)*
*Canada's biggest student hackathon, 18 to 20 September 2026, University of Waterloo. Applications closed; sells a mailing-list signup to students.*

- **Strongest move.** An illustrated journey. Sky and mountains, then a wooden table with paper cut-out objects (record player, Polaroid, cassette) with white sticker borders and a dashed trail, then grass, then underwater blue, then forest. The background world changes with every section.
- **Type.** Castledown 56px 900 (rounded, friendly) against Satoshi 16px 700. Ratio 3.5x. 34px h1 on mobile.
- **Colour.** Sky #a9e2f0-ish gradient, warm red-orange gradient headline (#aa2222 to #7f1a1a sampled), greens, sand. Six or seven values; the world supplies the colour, the type stays dark.
- **Motion.** React (Create React App) with styled-components. No animation library at all. CSS keyframes: 600 to 1,000ms entrance fades on images, a 30s marquee. 45 animated elements. **Reduced motion: 45 → 39.** Partial.
- **Weight.** 10.2MB, 9.4MB images across **1,206 `<img>` elements**, 314KB JS. 26,000px page on both viewports.
- **4x throttle.** p95 133ms, 97% of frames over 32ms, **80 long tasks**, LCP 5.9s. The best student-event site in the world is a slideshow on a mid-range phone, and there is not a single WebGL context on it. The cost is image decode and layout of 1,200 images, not tech.
- **Steal.** Section-by-section world change (each section owns a background colour and a few props) and the sticker-bordered photo treatment. Both are CSS.
- **Decoration.** A thousand sprite images, and the 690KB SVG sponsor logo.

#### cursor.com/compile
*Cursor's developer conference "Compile", now touring in 2026. Sells a signup for updates.*

- **Strongest move.** The word COMPILE drawn as single continuous lines, one colour per letter (orange, green, olive, lavender, black, brown, blue), animated on a canvas. Everything else is three small columns of text on warm paper. One object, total restraint.
- **Type.** CursorGothic 16 to 18px throughout. There is no display size; the wordmark is the image.
- **Colour.** #f7f7f4 paper, #edece8, #26251e ink, six line colours. 
- **Motion.** Next.js with a GLSL shader chunk (canvas contexts: webgl, webgl2, 2d). No animation library fingerprinted. 3 animated elements. **Reduced motion: 3 → 3.**
- **Weight.** 3.3MB, **1.4MB JS** for a page with five paragraphs (Next.js chunks, fbevents, analytics). 530KB of fonts.
- **4x throttle.** p95 200ms, 51% of frames over 32ms, 37 long tasks, LCP 0.96s. One canvas is enough to miss half the frames when the main thread is busy with 1.4MB of JS.
- **Steal.** The discipline: one signature and nothing competing with it. Also the three-column footer-as-body.
- **Decoration.** 1.4MB of JavaScript.

#### builderstable.net
*Builders Table, Cape Town, 18 to 19 September 2026. Two days of talks and a 100-person hackathon. Sells a free attendee pass and hackathon applications.*

- **Strongest move.** The page is a design tool. Black canvas with a dot grid, draggable windows with corner handles labelled `INDEX.HTML` (a code block typing itself), `FIELD.GLSL` (a green shader), `SPEAKER.RAW` (a portrait rendered as blue dither), `CTRL.SYS` (a control panel). Headline in condensed caps with the second line greyed: "BUILDERS. FOUNDERS. THINKERS. / TWO DAYS. ONE ROOM."
- **Type.** Laygrotesk 18 to 21px, LabMono and Geist Mono for labels, Mesotrial. Eight faces.
- **Colour.** #111111, white, lime #d9f99d CTA, blue dither. Three values plus the lime.
- **Motion.** jQuery 3.5 plus the entire GSAP family (core, ScrollTrigger, ScrollSmoother, SplitText, Observer, ScrollTo) plus Lenis plus a GLSL "gradient-lab". Preloader. Custom cursor. **Reduced motion: 2 → 0 animated, 180 → 134 transitions.** Partially respected.
- **Weight.** 3.9MB desktop, **1.5MB mobile** (it serves lighter assets on mobile, one of very few here that does). 640KB JS. Speaker photos 120 to 250KB each. 16.7s load.
- **4x throttle.** p95 33.4ms, 14% of frames over 32ms, 4 long tasks. The second-best number in the set, because almost nothing animates continuously once loaded. LCP 9.8s though.
- **Steal.** Two things. The dithered portrait, which unifies any set of speaker photos and can be done as one SVG `feComponentTransfer` filter or pre-rendered. And the window frame with corner handles as the card style for a builders' event.
- **Decoration.** jQuery in 2026, and 13 GSAP script files for a page whose motion is mostly hover.

#### superlocaldesign.com
*Superlocal 2026, a design festival in Montevideo, 7 to 12 September. Sells ticket "packs", lineup and schedule.*

- **Strongest move.** A grey-to-orange gradient field with floating circular photo bubbles and spinning 3D coins bearing speaker faces. Dates in dot-matrix display type. The schedule is colour-blocked by day with the day name in dot-matrix (LUNES, MARTES) at the top of each block.
- **Type.** A custom sans at 32px body and 600 weight, PlataPin dot-matrix for display, "fontDisplay" variable. h1 16px is the nav, so the measured ratio inverts.
- **Colour.** #bcbcbc grey to orange gradient, #1a1302 ink, per-day pastels (light blue, lilac, yellow, orange). 
- **Motion.** Next.js with GSAP, ScrollTrigger, ScrollSmoother, Lenis, three.js and React Three Fiber (the coins), 34 IntersectionObservers, 21 scroll listeners. CSS marquees at 98.8s and 122.2s, "breathe" glows at 22s and 26s, a 6s logo loop. Custom cursor, grain overlay. **Reduced motion: 10 → 0 animated, 607 → 112 transitions.** Properly respected.
- **Weight.** 3.9MB, 577KB JS, a 567KB circular.mp4, two 270 to 293KB coin faces.
- **4x throttle.** p95 317ms, 83% of frames over 32ms, 48 long tasks. The WebGL coins and bubbles cost it.
- **Steal.** The schedule: colour block per day with a big dot-matrix label. That is our per-hall mobile list solved. And speakers as "coins" is a CSS flip away from free.
- **Decoration.** The physics bubbles.

#### designbomb.it
*Design Bomb Festival, Catania, Sicily, May 2026. Sells tickets to a design community.*

- **Strongest move.** A protest poster. Cream (#f7f6eb), black, acid lime (#ceff00), hot pink (#ff3eba). "DESIGN BOMB!!!" in black extra-bold italic at full width. The speaker lineup is a wall of enormous names with a one-line role beneath each, **no photos**. "A Catania, ma dove?" (Where in Catania?) as the venue heading.
- **Type.** PP Frama Black Italic 900 and Extrabold Italic 800 for display, PP Frama Regular 24px body, Inter. 
- **Colour.** #141414, #f7f6eb, #ceff00, #ff3eba, #0055ff. Five, used as flat blocks.
- **Motion.** Framer-built. Framer Motion, Lenis, matter.js physics (a module called "Gravita"), a Lottie player with a 718KB wasm. Two 5.8MB mp4s autoplay. **Reduced motion: 4 → 4.**
- **Weight.** 17.6MB, 11.7MB video, 428KB JS.
- **4x throttle (walk).** p95 333ms, 94% of frames over 16.7ms, 56 long tasks.
- **Steal.** Speakers as a typographic wall. It reads as confident with three names or thirty, and it needs no headshots. This is the answer to our speakers empty state.
- **Decoration.** 11.7MB of video, and the physics.

#### offforum.com
*OFFF Forum, Montréal, 2 to 4 September 2026. A week of design, art and digital culture. Sells tickets.*

- **Strongest move.** Black, white, and posters. A huge "OFFFFORUM" wordmark, a grid of poster thumbnails, and the entire event descriptor as one line of caps serif: "A WEEK OF DESIGN, ART & DIGITAL CULTURE · OFFF SEPT 2–3 · FORUM · SEPT 4, 2026 · SAT, MONTRÉAL".
- **Type.** Forvm 45px uppercase serif, Baikal 11px 600 body. Ratio 4.1x. Two faces.
- **Colour.** Black and white. Two. The posters bring colour.
- **Motion.** Nuxt with GSAP, ScrollTrigger, ScrollSmoother, Lenis, embla carousel. 0 CSS animations. Custom cursor. **Reduced motion: 0 → 0** (nothing to reduce; motion is JS-only).
- **Weight.** 10.6MB, 7.9MB of images including 1.7MB and 1.1MB GIFs. 545KB JS.
- **Steal.** The two-colour discipline, and putting the whole event descriptor (what, when, where) in one wrapped line of caps under the wordmark.
- **Decoration.** Animated GIF thumbnails.

#### spatial-festival.com
*Spatial festival, 12 to 14 September 2025. Past event; the site is still up.*

- **Strongest move.** A white page with black Neue Haas at one size: "12, 13, 14 of September 2025". Then 24 canvases.
- **Type.** Neue Haas Grotesk Display Pro 55 at 29.95px for h1 and body alike. One size, hierarchy by position.
- **Colour.** White, black, a light green at 40%.
- **Motion.** WordPress with GSAP, ScrollTrigger, ScrollSmoother, SplitText, Lenis, three.js. 24 canvas elements, 103 fixed elements, 18,900 rAF calls in the window. Did not finish loading in 45s.
- **Weight.** 1.35MB loaded before timeout. 598KB JS. Mobile page 33,775px tall.
- **Steal.** The one-size typographic system. Everything at 30px, hierarchy from whitespace and position. Brave, cheap, and legible on a phone.
- **Decoration.** Twenty-four canvases.

### 3.3 Award winners, for technique

#### landonorris.com *(Site of the Year)*
*Lando Norris, F1 driver. Sells merchandise and a fan relationship.*

- **Strongest move.** A cut-out portrait wearing a helmet on white, with a hand-drawn lime scribble signature over it; huge slab-type marquees ("AT HOME WE DID IT…"); a helmet "hall of fame" you can spin.
- **Type.** Mona Sans Variable (200 to 900) 38px 700 uppercase, Brier serif 700 for contrast words, 16.7px body. 
- **Colour.** #282c20 olive-black body, #d2ff00 lime, #dde1d2, #b2c73a. Three values plus the lime; the lime does all the work.
- **Motion.** Webflow with one 363KB bundle by OFF+BRAND containing GSAP, ScrollTrigger, ScrollSmoother, SplitText, Lenis, three.js, Rive (199KB wasm), GLSL and Draco. p5.js as well. **21 canvases.** Marquee. Preloader. **Reduced motion: 1 → 1.**
- **Weight.** 5.4MB desktop, 6.9MB mobile (heavier on mobile). 576KB JS.
- **4x throttle.** p95 117ms, 51% of frames over 32ms, 36 long tasks, worst 355ms. In the contended pass it produced one 8.6-second task.
- **Steal.** The hand-drawn accent stroke, an SVG path revealed with `stroke-dashoffset`. It costs a few hundred bytes and it is the most human thing on the page. Also serif italic words inside a sans headline.
- **Decoration.** Twenty-one canvases.

#### trevornoah.com *(SOTD 3 Sep 2026)*
- **Strongest move.** A 3D head with the top open and objects (microphone, brain, clouds, books) spilling out; pink accent words in cream headlines; torn-paper section edges. The first paint is a blank navy screen for over five seconds (preloader).
- **Type.** Die Grotesk D/C/B family, 361px 700 h1, display paragraphs at 108px. Seven faces of one family.
- **Colour.** #1d2440 navy, #f9fcf4 cream, #ff9bb4 pink, #6f7ba9. Four.
- **Motion.** Webflow plus one 366KB bundle: GSAP family, Lenis, three.js, Basis textures. 1.2s transform transitions, a 2s sprite loop, 1.2s clip-path button transitions, a 10s marquee. **Reduced motion: 9 → 0.** Respected.
- **Weight.** 7.4MB, 706KB JS, GLB models 280 to 690KB each.
- **4x throttle (walk).** p95 150ms, 81% over 16.7, 40 long tasks, worst 971ms.
- **Steal.** The torn-paper edge (an SVG mask on the section, one file) and one accent colour reserved for single words.
- **Decoration.** The head.

#### cerebrium.ai *(SOTD 10 Sep 2026)*
- **Strongest move.** Magenta 3D ribbons behind a light-weight 86px headline with one gradient word ("scales").
- **Type.** ABC Favorit 86px 300 against Suisse Intl 17px. **Ratio 5.1x.** Suisse Intl Mono for the nav in uppercase.
- **Colour.** #000, #101421, #ff488b pink, #22273e, #eef2f5. 
- **Motion.** Astro with Lenis, GSAP, ScrollTrigger, SplitText, three.js (a 344KB BackgroundCanvas chunk, Draco GLB), lottie_light, swiper. Preloader with 1s logo bars. **Reduced motion: 2 → 2.**
- **Weight.** 2.5MB, 962KB JS.
- **4x throttle (walk).** p95 266ms, 74% over 16.7, 39 long tasks, worst 692ms.
- **Steal.** Uppercase mono nav labels and one gradient word in a light-weight headline.
- **Decoration.** The ribbons.

#### white-desert.com *(SOTD 11 Sep 2026)*
- **Strongest move.** "ANTARCTICA" in Oswald at 256px across the bottom of a blue-tinted looping video.
- **Type.** Oswald 256px uppercase against Cardinal Classic Long serif 18px. **Ratio 14.2x**, the largest in the set. Inter Tight for UI.
- **Colour.** #1f2a44 navy, white, #ff7e15 orange. Three.
- **Motion.** Next.js with GSAP family, Lenis, Framer Motion. Preloader. 5 sticky. **Reduced motion: 5 → 5.**
- **Weight.** 7.5MB, 4.3MB video, 1.3MB JS.
- **Steal.** The extreme display-to-body jump with a serif body. It makes a page feel expensive using nothing but scale.
- **Decoration.** 1.3MB of JavaScript.

#### seasats.com *(SOTD 8 Sep 2026)*
- **Strongest move.** White serif over a dark ocean video, then 26 autoplay videos and 80-frame image sequences down the page with 34 sticky elements.
- **Type.** seasonMix 124px against seasonSans 16px, 7.8x. supplyMono labels.
- **Colour.** Near-white, greys, sage #b7c8be, sand #d7c5ba.
- **Motion.** Next.js with GSAP, ScrollTrigger, Lenis, three.js and R3F, Framer Motion. 100 animated elements on mobile, 394 `will-change`. **Reduced motion: 13 → 13.**
- **Weight.** 5.6MB, 819KB JS. Mobile page 30,061px.
- **Steal.** Nothing cheap. The serif-on-dark-photo look is a known "premium" register.
- **Decoration.** Twenty-six videos.

#### brand.squarespace.com *(SOTD 1 Sep 2026)*
- **Strongest move.** A fashion-photography brand book. 12.4MB hero video, 3MB WebP backgrounds.
- **Type.** Clarkson 80px / 24px, 3.3x, six weights.
- **Colour.** #111, black, white.
- **Motion.** Nuxt with GSAP, ScrollTrigger, SplitText, Lenis, Rive, three.js.
- **Weight.** **54.4MB desktop, 23.7MB mobile.**
- **Steal.** Nothing. It is a brand book with an unlimited budget.
- **Decoration.** Forty megabytes of images.

#### stateofaidesign.com *(SOTD 26 Aug 2026)*
- **Strongest move.** Solarised flower photography in lavender and coral with floating photo "swatches" (white-bordered crops) and a black title block. A coral block in the nav.
- **Type.** Beausite Classic Medium 120px, letter-spacing -7.2px, against 12px body. **Ratio 10x.**
- **Colour.** White, #cdabfe lavender, #f0ff1c acid, #fe7141 coral, #d1ddd3 sage, black. Six, flat.
- **Motion.** Framer-built. Framer Motion, Lenis, Lottie. 400ms eased transitions. A 2.7MB webm. **Reduced motion: 0 → 0.**
- **Weight.** 5.7MB desktop, 6.6MB mobile, 655KB JS.
- **4x throttle (walk).** p95 83ms, 61% over 16.7, 23 long tasks.
- **Steal.** The swatch collage: photo fragments with white borders drifting over a flat colour. CSS transforms, no library.
- **Decoration.** 3.3MB of video.

#### decathlonyestalgia.com *(SOTD 28 Aug 2026)*
- **Strongest move.** A giant grimacing face, cut-out stickers (lightning bolt, wave), sixteen 9:16 autoplay videos, a Rive surfer.
- **Type.** Roboto Flex variable, weight 100 to 1000, body 24px at weight 535. Weight is the animated property.
- **Colour.** #f4f4f4, #e9dae6 pink-grey, #d7dd44 acid yellow, #eaa0cd pink.
- **Motion.** WordPress with GSAP family, Lenis, Rive (783KB wasm plus a 398KB .riv), swiper. 40 CSS animations. Horizontal scroll present. **Reduced motion: 40 → 40.**
- **Weight.** 17.8MB, 15.3MB video. 43.7s load.
- **Steal.** Variable-font weight animation on hover (one axis, one transition) and sticker cut-outs.
- **Decoration.** Fifteen megabytes of vertical video.

#### boc.studio *(SOTD 19 Sep 2026)*
- **Strongest move.** A full-bleed food video (a burger exploding) with a red-orange marquee band running across the middle: "Boc.Studio® · Creative brand studio · 41.4120° N, 2.1580° E · Barcelona".
- **Type.** PP Mori 28px / 16px, 1.8x. Two weights.
- **Colour.** #181d21, #0d0d0d, the red-orange band, white, #adadad.
- **Motion.** Next.js with Framer Motion, GSAP, ScrollTrigger, Lenis, GLSL, swup page transitions. CSS marquees at 30s to 123s. **Reduced motion: 13 → 2 animated.** Respected.
- **Weight.** 3.9MB, 2.5MB webm, 327KB JS.
- **Steal.** Video plus a marquee band. The most expensive-looking hero in the set for the least code.
- **Decoration.** The "no cookie banner here" banner.

#### leoparpeix.com *(SOTD 14 Sep 2026)*
- **Strongest move.** A WebGL landscape (a 1.5MB GLB scene, mountain and tree textures as KTX2). First paint is a blank page with a name.
- **Type.** A custom "text" face at 14px. Nothing larger in the DOM.
- **Colour.** #f7f7f7, #022016.
- **Motion.** Vue with GSAP family, Lenis, three.js. Preloader. **Reduced motion makes it worse: 1 → 21 animated, 17 → 291 transitions.** The reduced path is a different layout with more CSS motion.
- **Weight.** 18.6MB desktop, 13.1MB mobile.
- **4x throttle (walk).** p95 117ms, 71% over 16.7, 43 long tasks.
- **Steal.** Nothing for us.
- **Decoration.** All of it. It is a portfolio for other designers.

#### scoutmotors.com *(E-commerce of the Year)*
- **Strongest move.** Dark truck video, "Scouts always come back."
- **Type.** scout-sans-wide 72px / 16px, 4.5x; IBM Plex Mono for data.
- **Colour.** Black, white, #ff5432 orange-red, #faf9f5.
- **Motion.** Astro with GSAP, Lenis, swiper. Preloader, marquee. Did not finish loading in 45s.
- **Weight.** 19.4MB desktop, **26.9MB mobile**. 6.2MB hero webm.
- **Steal.** Wide sans with a mono for specifications. Orange-red on black works.
- **Decoration.** The 27MB mobile payload.

### 3.4 Lighter sites worth more than their weight

#### makingsoftware.com *(httpster)*
*A reference manual, as a book and a site, on how software works. Sells early access.*

- **Strongest move.** Blueprint. Blue line drawings (pure blue, oklch(0.51 0.29 265), roughly #2f3bff) on paper white, drop caps, figure numbers and captions in a dot-matrix mono, a table of contents with dotted leaders and page numbers, a "current progress" bar for the book.
- **Type.** "arizona" serif 16px for body and headings; the title is drawn. departureMono for captions. Seven faces.
- **Colour.** #fbfbfb, black, one blue. Three.
- **Motion.** Next.js with Framer Motion. Three `blur-in` animations at 500ms. Nothing else. **Reduced motion: 3 → 3.**
- **Weight.** **687KB total**, 322KB JS, 28 requests, 1.3s load.
- **4x throttle.** See table; measured in the isolated pass.
- **Steal.** The entire grammar: numbered figures, mono captions, leaders in lists, one ink colour, drop caps. A tech event for engineering students can borrow this wholesale.
- **Decoration.** Nothing. The most disciplined page in the set.

#### uncut.wtf *(httpster)*
*A free font library.*

- **Strongest move.** A giant blobby wordmark, then a list with counts: Sans Serif 66, Serif 27, Monospace 23, Display 47.
- **Type.** UncutSans 24.48px everywhere.
- **Colour.** Greys #b7b7b7 and #c4c4c4, near-black.
- **Motion.** None. 343 hover transitions. **18KB of JS.**
- **Weight.** **53KB.** Eleven requests.
- **Steal.** A list with counts is a design. And the proof that 53KB can be on a gallery.
- **Decoration.** None.

#### poetry.camera *(onepagelove)*
*A camera that prints poems. Sells a physical product.*

- **Strongest move.** A yellow field (#ffde5b) and h265 product videos.
- **Type.** Exposure 51px 700 against BitMatrix A2 14px, a dot-matrix face for labels. DM Sans variable.
- **Colour.** #ffde5b, #eee9e9, black, white.
- **Motion.** **21KB JS.** CSS transitions only (800ms video fade). Six autoplay videos. **Reduced motion: 11 → 11.**
- **Weight.** 6.7MB desktop, **12.5MB mobile** (the videos are heavier on mobile).
- **Steal.** Dot-matrix labels against a friendly display face, and one loud field colour.
- **Decoration.** 11.6MB of video on mobile.

#### wholeearth.info *(siteinspire, Typographic)*
- **Strongest move.** A black archive: a hairline grid of magazine mastheads, serif everywhere. 28,000px page.
- **Type.** Whole Earth Modern 23.6px for everything, Whole Earth Mono.
- **Colour.** Black, white.
- **Motion.** None. 460 IntersectionObservers for lazy loading. 
- **Weight.** 995KB, 327KB JS.
- **Steal.** The archive grid as a sponsors wall: logos in a hairline grid on one colour, no tiers of size.
- **Decoration.** None.

#### cosmos.so *(httpster)*
- **Strongest move.** Cards drifting on white around "Your space for inspiration".
- **Type.** cosmosOracle 74px 350 / 26px, 2.8x.
- **Motion.** Next.js, Framer Motion, curtains.js (WebGL planes), Lottie. **1.8MB JS.**
- **Steal.** The drift is doable with CSS transforms on six elements.
- **Decoration.** 1.8MB of JS.

#### bauhausclock.com *(httpster)*
- **Strongest move.** Product photography and "Turn waiting into watching."
- **Type.** Inter and Switzer, 96px / 32px, 3x.
- **Colour.** #eef0f2, black, a red dot.
- **Motion.** Framer-built; 0 CSS animations. **Reduced motion: 0 → 0.**
- **Weight.** 2.5MB, 313KB JS.
- **4x throttle (walk).** p95 67ms, 63% over 16.7.
- **Steal, decoration.** Neither. A clean product page.

#### 2025.driftime.com *(minimal.gallery)*
- **Strongest move.** "Impact Report" repeated in Koulen condensed against Instrument Serif body. Both are free on Google Fonts.
- **Colour.** #dbdcd7, white, black.
- **Motion.** Next.js, Lenis, Framer Motion, three.js and R3F. 1MB JS.
- **Steal.** The pairing. Condensed display with a serif body is a strong, cheap voice.
- **Decoration.** 1MB JS.

#### wiz.io *(httpster)*
- Cloud security, sells to enterprises. Blue line illustration. **3.6MB JS**, 14,520 DOM nodes, React Three Fiber, Lottie, Rive, barba, Vanta all present. Nothing to steal; a warning about what a marketing site becomes.

#### buena.com, typo.love, derolez.dev, nic0martins.com, uff.cfda.com
- Buena: Inter Display 56px, 2MB PNG portraits, 1.4MB JS, no animation. typo.love: a 9px mono body, mostly empty. derolez.dev: a 1.7MB reel and one paragraph. nic0martins.com: blue #1337ff and grey with a GLB, 27 CSS animations ignoring reduced motion. uff.cfda.com: a **74.8MB** mp4, 84.7MB page. None contribute a technique we can afford.

---

## 4. Direct peers: what other AWS student days look like

The Chennai and Thane student community days, and every 2026 AWS community day in India found by search, sell through **Konfhub**. That is the field. Their "site" is a Konfhub event page. I tore down both plus a live Konfhub checkout and the one community day with its own site:

| Page | Weight | JS | What it is |
|---|---|---|---|
| konfhub.com/aws-scd-2026-chennai | **21.2MB** | 1.2MB | The Konfhub template: white page, event title, a poster JPEG, "Expired" button, About (a wall of bold paragraphs), Tickets as bordered cards, Speakers as photo cards with name and role, Venue as a black block with the address. 16,378px tall on mobile. Zero animations. |
| konfhub.com/aws-student-community-day-thane-2026 | **53.2MB** | 1.2MB | Same template. The weight is uncompressed poster and sponsor images. |
| konfhub.com/checkout/… (Malaysia) | 2.0MB | 1.3MB | The checkout flow on a phone: a vertical list of tier cards, each with name, price and a button; then a discount code field; then the attendee form. The tier buttons are **white text on a light orange fill**, exactly the contrast failure our brief rules out. 4x throttle: p95 16.9ms, so the flow itself is light. |
| acd.awsugngp.com (Nagpur, own site) | 216KB | 11KB | A static page. Under reduced motion its 2 animations go to 0. The lightest peer by far. |

For context, and **not** as guidance for our prices (which stay `TODO(vedant)`): Chennai's page listed a student pass at an early and a standard price in the low hundreds of rupees, a professional pass slightly higher, and a "contributor" tier from a few thousand. The structure is early bird versus standard, student versus professional, with lunch and swag itemised per tier. Ours already matches that shape.

What that means for us: **having a site at all is already the differentiator** in this category. The Konfhub template is what a student sees for every other AWS day. The competition for attention is Gravitas and Hack the North, not the other AWS days.

---

## 5. The registration flow, without Mobbin

Mobbin was closed (paid MCP, 403 web). What I could do instead was tear down the products a Hyderabad student pays through:

| Product | Weight | JS | Notes |
|---|---|---|---|
| **lu.ma** (homepage) | 3.1MB / 2.4MB mobile | 2.26MB | System font at 80px, Inter. The event page needs a real event to study; discovery is behind login. |
| **konfhub.com** | 4.6MB | 603KB | See section 4. Colour-heavy, banner-driven. |
| **razorpay.com/demo** | 3.2MB | 2.4MB | The demo page, not the modal. Blue #2b84ea, green #08c972, Mulish. |
| **district.in** (Zomato's events app) | 26.4MB / 24.9MB mobile | 1.6MB | Three cover videos at 4.5 to 4.9MB each on the homepage, 12px body text. |
| **bookmyshow** | blocked | | Cloudflare. |

What is verifiable about the Razorpay Checkout we hand off to, from their integration docs fetched today: the only appearance options are `theme.color`, `theme.backdrop_color`, `image` (logo), `name` and `description`. No font, no dark mode. `display.language` supports Telugu. Our `RegisterForm.tsx` already passes `theme.color` from the `--accent` token, so the modal's button follows the chosen palette. **Whatever accent the concept picks has to work as a button on Razorpay's white modal** with white text on it, which #FF9900 does not (2.1:1). The concepts in CONCEPTS.md account for this by keeping orange as a fill with dark ink, and passing a darker `theme.color` where needed.

What I did not get: inside a real ticket checkout on a phone. That needs a purchase. The structural conclusions for `/register` (one column, one thumb, tier before details, price restated at the pay step) come from our own three-step form and the Konfhub checkout URL pattern (`/checkout/<event>?ticketId=`), not from Mobbin.

---

## 6. Component and effect libraries

All fetched today. "Cost" means what the library the components depend on adds to a bundle, gzipped, measured (see TECHNIQUES.md section 2 for the full size table).

| Library | What it is | Depends on | Cost of the dependency | Notes |
|---|---|---|---|---|
| **React Bits** (reactbits.dev, 47.7k stars) | 200+ animated components, four variants (JS/TS × CSS/Tailwind) | gsap 3.13, motion 12, three 0.180, @react-three/fiber 9, drei, ogl, matter-js, lenis, postprocessing | 27KB (gsap) to 181KB (three) depending on the component | MIT + Commons Clause. The CSS variants of the text effects are usable without any library. |
| **Aceternity UI** | ~100 effects: Background Beams, Aurora, Meteors, Sparkles, Lamp, Tracing Beam, Sticky Scroll Reveal, Macbook Scroll, 3D Card, Text Generate, Flip Words, Globe, World Map | Framer Motion / motion throughout | 47 to 63KB | Free copy-paste plus a paid All-Access tier. Most of its backgrounds are canvas loops that never stop. |
| **Magic UI** | Text Animate, Number Ticker, Marquee, Border Beam, Meteors, Particles, Flickering Grid, Dot Pattern, Globe, Orbiting Circles, Dock, Progressive Blur | motion 12, cobe (globe), canvas-confetti, rough-notation, tw-animate-css | 47KB + 6KB (cobe) + 4KB (confetti) | Pro tier of blocks. |
| **Motion Primitives** | Text Effect, Text Loop, Text Scramble, Animated Number, Sliding Number, In View, Infinite Slider, Magnetic, Morphing Dialog, Progressive Blur, Tilt | motion | 47KB | "CSS-only versions planned", so not yet. Pro tier. |
| **Cult UI** | not studied (429) | | | |
| **Origin UI → coss.com/ui** | 508 static components on Base UI, open source (10.6k stars) | Base UI | 0 for animation | The primitives source if we want accessible Select/Dialog without writing them. |
| **Kokonut UI** | 100+ components via `npx shadcn add @kokonutui/<name>` | React, Tailwind, motion, shadcn | 47KB | Pro tier. Has an MCP registry. |
| **shadcn/ui** | Changelog: Base UI is the default primitive layer since July 2026, Radix still supported; `cn` moved to its own package in September 2026; a Questionnaire multi-step form component landed in August | Base UI or Radix | tree-shaken per component | Our `/register` three-step form could use its Questionnaire pattern as a reference for step semantics. |
| **Base UI 1.8** (MUI) | Unstyled, accessible: Dialog, Select, Tabs, Accordion, Toast, Popover, Menu, 40+ | none | tree-shaken | The right accessibility source for the FAQ accordion and any dialog. |
| **Tailark** | shadcn marketing blocks (heroes, landing pages), freemium | shadcn, no motion library | 0 | Static. |
| **Hover.dev** | Sections and components "built with Framer Motion, vanilla JS animations, keyframes, or another stable library"; Countdown, Text, Loaders | varies | 0 to 63KB | Pricing page exists; free/paid split not stated per component. |

The honest summary: every "animated components" library in this list is a thin layer on `motion` (47KB) or GSAP (27KB plus plugins). The static ones (Base UI, coss/Origin, Tailark) cost nothing at runtime. For our 200KB budget on top of roughly 90 to 100KB of Next.js runtime, one animation library is the maximum, and the CSS variants of React Bits' text effects mean we may not need one at all.

---

## 7. Patterns across the set

What 2026 actually looks like, from the sample, not from memory:

1. **The stack is settled.** Of the 41 sites, 17 fingerprint GSAP with ScrollTrigger (13 of those also ScrollSmoother), 20 fingerprint Lenis, 12 three.js, 16 ship GLSL shader source, 18 match Framer Motion signatures, 9 Lottie, 3 Rive. Of the 15 sites in the set that came from Awwwards listings, **13 have Lenis**; the two that do not are Hack the North and why.zero. Almost nobody on Awwwards uses native scroll.
2. **"3D" is mostly not 3D.** Zero's crumple is 171 JPEGs. Superlocal's coins and Lando's helmet are real WebGL. Cerebrium's ribbons are a GLB. The photoreal hero stills are renders served as images. The image-sequence trick is more common than live WebGL and it is *not* cheaper on a phone: it decodes hundreds of images.
3. **Weight is unbounded.** Median desktop weight of the 15 award-listed sites: 7.5MB. Squarespace 54MB, UFF 85MB, District 26MB. Only four of the 41 are under 1MB: uncut.wtf (53KB), typo.love (595KB), makingsoftware (687KB), wholeearth (995KB), plus AWS Community Day Nagpur's own site (216KB) among the peers. Two of the four are on galleries.
4. **Nobody serves a lighter mobile experience.** Builders Table (3.9MB → 1.5MB) is the only site that got materially lighter on mobile. Several got heavier (Lando Norris, poetry.camera, District, State of AI Design).
5. **Reduced motion is mostly ignored.** 36 of the 45 pages measured show identical animated-element counts with the preference on. Superlocal, Boc.Studio, Trevor Noah, Builders Table and Hack the North respect it in whole or part. Léo Parpeix gets more animated with it on.
6. **Every one of them drops frames on a mid-range phone.** See the perf table in TECHNIQUES.md. At 4x throttle the best award site in the isolated pass is Builders Table at p95 33ms; the worst is Zero at over a second. Our current build is 16.9ms.
7. **Type is where the money shows.** Display-to-body ratios of 5x to 14x (Zero 6.4x, Cerebrium 5.1x, Seasats 7.8x, State of AI 10x, White Desert 14x). Negative tracking of 3 to 7% at display sizes. A serif or a mono somewhere in the system. Our current 3.75rem hero at 1rem body is under 4x on desktop; that is part of why it reads as a template.
8. **Two colours plus one.** OFFF (black, white), Whole Earth (black, white), Making Software (paper, ink, one blue), Lando (olive, cream, lime), Cursor (paper, ink, six line colours only inside the wordmark). The sites that feel designed use very few colours flatly. The sites that feel like SaaS use gradients.
9. **Event sites lean on type, not imagery**, because they have nothing to photograph yet. Design Bomb's speaker wall, OFFF's one-line descriptor, Spatial's date-as-hero, Superlocal's dot-matrix days. All four are for events that had not happened when the site launched. That is our situation for the next six weeks.
10. **The single-signature sites age best.** Cursor Compile, Boc.Studio, Making Software: one memorable object, then quiet. The sites with five competing effects (Gravitas, Seasats, Wiz) read as busy within two scrolls.

---

## 8. Summary table, all 41

Transfer sizes from CDP on the desktop load. JS is wire size from the fingerprint pass where available. "RM" is animated elements normal → reduced. Blank cells mean the harness could not read that value (blocked, timed out, or no h1).

| Site | Total | JS | Images | Video | Libraries confirmed in script bodies | h1 / body | RM |
|---|---|---|---|---|---|---|---|
| gravitas.vit.ac.in | 7.9MB | 624KB | 5.4MB | 1.1MB | GSAP, ScrollTrigger, ScrollSmoother, Lenis | 14px mono / 14px | 22→20 |
| awsstudentcommunitydaypune.com | 13.9MB | 72KB | 13.8MB | 0 | none | 28.8px / 12.8px | 55→55 |
| zero.university | 17.0MB | 1.24MB | 15.5MB | 0 | Framer Motion, Lenis, Spline, Lottie | 90px / 14px | 0→0 |
| why.zero.university | 6.3MB | 528KB | 10KB | 294KB | GSAP, ScrollTrigger, three, GLSL, wasm | none / 16px | 7→7 |
| hackthenorth.com | 10.2MB | 314KB | 9.4MB | 397KB | none | 56px / 16px | 45→39 |
| cursor.com/compile | 3.3MB | 1.41MB | 921KB | 121KB | GLSL | 16px / 18px | 3→3 |
| superlocaldesign.com | 3.9MB | 575KB | 2.5MB | 584KB | GSAP, ScrollTrigger, ScrollSmoother, Lenis, three, R3F | 16px / 32px | 10→0 |
| spatial-festival.com | 1.3MB* | 597KB | 582KB | 0 | GSAP family, SplitText, Lenis, three | 30px / 30px | 0→0 |
| builderstable.net | 3.9MB | 642KB | 2.7MB | 53KB | GSAP family, SplitText, Lenis, jQuery, GLSL | 21.5px / 18px | 2→0 |
| designbomb.it | 17.6MB | 429KB | 4.5MB | 11.7MB | Framer Motion, Lenis, matter.js, Lottie | none / 24px | 4→4 |
| offforum.com | 10.6MB | 549KB | 7.9MB | 0 | GSAP, ScrollTrigger, ScrollSmoother, Lenis, embla | 45px / 11px | 0→0 |
| leoparpeix.com | 18.6MB | 465KB | 0 | 0 | GSAP family, SplitText, Lenis, three, wasm | 14px / 14px | 1→21 |
| boc.studio | 3.9MB | 329KB | 696KB | 2.5MB | Framer Motion, GSAP, ScrollTrigger, Lenis, GLSL | 28px / 16px | 13→2 |
| cerebrium.ai | 2.5MB | 975KB | 344KB | 0 | GSAP, ScrollTrigger, SplitText, Lenis, three, lottie_light, swiper | 86px / 17px | 2→2 |
| lisa.locomotive.ca | blocked | | | | | | |
| white-desert.com | 7.5MB | 1.30MB | 1.2MB | 4.3MB | GSAP family, Lenis, Framer Motion | 256px / 18px | 5→5 |
| seasats.com | 5.6MB | 840KB | 2.5MB | 529KB | GSAP, ScrollTrigger, ScrollSmoother, Lenis, three, R3F, Framer Motion, swiper | 124px / 16px | 13→13 |
| trevornoah.com | 7.4MB | 722KB | 957KB | 0 | GSAP family, SplitText, Lenis, three, wasm | 361px / 108px | 9→0 |
| brand.squarespace.com | 54.4MB | 519KB | 40.5MB | 12.4MB | GSAP, ScrollTrigger, SplitText, Lenis, Rive, three | 80px / 24px | 0→0 |
| stateofaidesign.com | 5.7MB | 653KB | 1.4MB | 3.3MB | Framer Motion, Lenis, Lottie | 120px / 12px | 0→0 |
| decathlonyestalgia.com | 17.8MB | 185KB | 702KB | 15.3MB | GSAP family, Lenis, Rive, swiper | 16px / 24px | 40→40 |
| landonorris.com | 5.4MB | 584KB | 2.5MB | 0 | GSAP family, SplitText, Lenis, three, Rive, GLSL, p5 | 38px / 16.7px | 1→1 |
| scoutmotors.com | 19.4MB* | 1.68MB | 11.3MB | 6.2MB | GSAP, Lenis, swiper | 72px / 16px | 22→22 |
| wiz.io | 5.2MB | 2.75MB | 471KB | 0 | R3F, Lottie, Rive, barba, Vanta | 52px / 18px | 3→1 |
| cosmos.so | 3.4MB | 1.81MB | 0 | 0 | Framer Motion, curtains, Lottie | 74px / 26px | 12→12 |
| makingsoftware.com | 687KB | 322KB | 0 | 0 | Framer Motion | 16px / 16px | 3→3 |
| bauhausclock.com | 2.5MB | 312KB | 1.9MB | 74KB | Framer Motion, Lenis | 96px / 32px | 0→0 |
| uncut.wtf | 53KB | 18KB | 3KB | 0 | none | 24.5px / 24.5px | 0→0 |
| typo.love | 595KB | 233KB | 0 | 0 | Framer Motion | 48px / 9px | 1→1 |
| wholeearth.info | 995KB | 337KB | 336KB | 0 | embla | 23.6px / 23.6px | 0→0 |
| poetry.camera | 6.7MB | 21KB | 281KB | 5.8MB | none | 51px / 14px | 11→11 |
| derolez.dev | 2.4MB | 286KB | 137KB | 1.7MB | Framer Motion | 16px / 16px | 4→4 |
| buena.com | 12.7MB | 1.41MB | 9.2MB | 0 | none detected | 56px / 14px | 0→0 |
| 2025.driftime.com | 1.4MB | 1.01MB | 70KB | 0 | Lenis, Framer Motion, three, R3F, Lottie | 36px / 20px | 0→0 |
| uff.cfda.com | 84.7MB | 411KB | 9.2MB | 74.9MB | GSAP, ScrollTrigger, ScrollSmoother, swiper | none / 14px | 0→0 |
| nic0martins.com | 1.3MB | 483KB | 0 | 0 | Framer Motion, three, R3F, GLSL | 54px / 16px | 27→27 |
| in.bookmyshow.com | blocked | | | | | | |
| lu.ma | 3.1MB | 2.26MB | 682KB | 0 | Framer Motion, three | 80px / 20px | 3→3 |
| konfhub.com | 4.6MB | 604KB | 3.8MB | 43KB | Lottie | 64px / 24px | 19→19 |
| razorpay.com/demo | 3.2MB | 2.32MB | 351KB | 0 | Lottie | none / 14px | 0→0 |
| district.in | 26.4MB | 1.64MB | 10.5MB | 14.0MB | swiper | none / 12px | 0→0 |

\* did not finish loading within 45 seconds; size is what arrived.

**For comparison, this repo's current landing page:** 186KB of JS and CSS gzipped across 12 files, no animation library, 16.9ms p95 at 4x throttle in today's isolated pass.
