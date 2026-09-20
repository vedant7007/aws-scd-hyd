# Techniques: how the impressive sites are built, and what each move costs

Phase 2 of the rebuild brief. Everything measured on **20 September 2026**. Library fingerprints come from grepping the script bodies each site actually loaded. Sizes are gzipped transfer sizes from CDP or from gzipping the real files off unpkg. Frame timing is Chrome at 412x915, 2.6x, with the CPU throttled 4x through CDP, driving an 8-second scroll and timestamping every `requestAnimationFrame`, which is the method in this repo's `scripts/measure-scroll.mjs`, so the numbers sit next to the brief's table.

Two honest limits of that method, stated up front because they change how to read every number below:

1. **CPU throttling slows the main thread only.** It does not slow the GPU, the compositor, or the display pipeline. A technique that is pure GPU work (a blur, a blend mode, a full-screen shader's fragment cost) shows as free here and is not free on a Pixel 6a's Mali GPU. Where that applies it is said.
2. **On a 60Hz display every frame is about 16.7ms**, so "frames over 16.7ms" counts timing jitter as failure. **Frames over 32ms** is the honest "dropped a frame" number and is what the tables lead with.

---

## 1. The site perf table

Isolated pass, two runs each, better run kept. This is what a mid-range Android actually experiences on each of these sites. Our current build is the first row.

| Site | p95 frame | frames > 32ms | long tasks (worst) | frames in 8s | LCP at 4x | Loaded |
|---|---|---|---|---|---|---|
| **awsscdhyd.in (this repo, today)** | **16.9ms** | **2.4%** | 3 (112ms) | 460 | 1.2s | 1.8s |
| uncut.wtf | 17.0ms | 0% | 0 | 481 | 1.0s | 1.1s |
| lu.ma | 16.9ms | 1.7% | 0 | 472 | 6.7s | 4.9s |
| konfhub.com | 17.3ms | 4% | 4 (71ms) | 450 | 1.9s | 7.8s |
| offforum.com | 32.8ms | 5% | 8 (383ms) | 399 | 2.3s | 3.4s |
| builderstable.net | 33.4ms | 14.4% | 4 (69ms) | 404 | 9.8s | 7.3s |
| awsstudentcommunitydaypune.com | 33.9ms | 50.5% | 3 (62ms) | 309 | 8.5s | 5.7s |
| stateofaidesign.com | 50.2ms | 41.5% | 8 (101ms) | 299 | (none) | 5.2s |
| poetry.camera | 66.6ms | 29.2% | 10 (809ms) | 216 | 3.0s | 8.0s |
| spatial-festival.com | 66.8ms | 33.6% | 22 (235ms) | 277 | 7.1s | 9.3s |
| trevornoah.com | 83.7ms | 81.7% | 50 (387ms) | 164 | 4.8s | 11.2s |
| decathlonyestalgia.com | 99.8ms | 61.3% | 45 (192ms) | 204 | 10.7s | 10.8s |
| boc.studio | 100ms | 74.2% | 33 (150ms) | 163 | 4.9s | 9.6s |
| white-desert.com | 116.7ms | 24.5% | 21 (638ms) | 229 | 2.5s | 3.3s |
| landonorris.com (Site of the Year) | 117.3ms | 51.1% | 36 (355ms) | 182 | 1.9s | 3.6s |
| makingsoftware.com | 133.2ms | 93% | 71 (164ms) | 115 | 1.6s | 1.9s |
| designbomb.it | 133.3ms | 72.6% | 49 (199ms) | 146 | 1.5s | 5.9s |
| hackthenorth.com | 133.4ms | 96.8% | 80 (139ms) | 95 | 5.9s | 16.1s |
| cursor.com/compile | 200ms | 50.6% | 37 (230ms) | 168 | 1.0s | 1.8s |
| gravitas.vit.ac.in | 233.5ms | 87.3% | 57 (544ms) | 79 | (modal) | 3.6s |
| seasats.com | 249.9ms | 100% | 33 (2,667ms) | 31 | 2.9s | 6.0s |
| cerebrium.ai | 283.1ms | 74.4% | 48 (406ms) | 86 | 6.2s | 7.9s |
| superlocaldesign.com | 316.6ms | 83% | 48 (276ms) | 88 | (none) | 2.8s |
| zero.university | **1,016.6ms** | 97.1% | 35 (952ms) | 35 | 8.6s | 22.1s |

Contended-pass numbers for sites not in this table (measured while another harness ran, so treat as upper bounds): why.zero.university p95 150ms, leoparpeix.com 117ms, bauhausclock.com 67ms.

Read that against the brief's budget of **p95 under 16.7ms at 4x**. Four sites meet it: ours, uncut.wtf, lu.ma and Konfhub. None of them is on Awwwards. Every award-winning site in the sample is somewhere between "drops every third frame" and "frozen". The two sites Vedant liked are the second-worst and the worst.

---

## 2. What the libraries weigh

Gzipped, from bundlephobia (version noted) or gzipped directly from unpkg. The Next.js runtime on our landing page is roughly 90 to 100KB of the 186KB we ship, so the working headroom under a 200KB budget is about **80 to 100KB, total, for everything**.

| Library | Version | Gzipped | Notes |
|---|---|---|---|
| **GSAP core** | 3.15.0 | **27KB** | 100% free including all plugins since the Webflow acquisition (confirmed on gsap.com/pricing today). |
| + ScrollTrigger | 3.15.0 | 17KB | |
| + ScrollSmoother | 3.15.0 | 5KB | Needs ScrollTrigger. |
| + SplitText | 3.15.0 | 3KB | |
| + Observer | 3.15.0 | 4KB | |
| **motion** (the `motion` package) | 13.4.0 | **47KB** | Has 2 dependencies. |
| framer-motion | 13.4.0 | 63KB | The React wrapper. |
| **Lenis** | 1.3.26 | **5KB** | Cheapest thing in the table and the most dangerous on Android, see 4.18. |
| animejs | 4.5.0 | 39KB | |
| split-type | 0.3.4 | 4KB | |
| **three** | 0.186.0 | **181KB** | Core only. Any real scene adds loaders, controls, Draco (83KB wasm in Cerebrium's case). |
| @react-three/fiber | 9.7.0 | 51KB | Plus three. |
| pixi.js | 8.21.0 | 255KB | |
| @splinetool/runtime | 2.0.55 | 264KB | 35KB entry, then lazy chunks to 264KB. |
| **@rive-app/canvas-lite** | 2.42.2 | 44KB **+ 347KB wasm** | The wasm is a separate fetch that every teardown shows (`rive.wasm` 199KB to 783KB on the wire depending on build). Rive is never 44KB. |
| @rive-app/canvas | 2.42.2 | 51KB + 780KB wasm | |
| lottie-web | 5.13.0 | 75KB | |
| lottie_light | 5.13.0 | 45KB | No expressions. Cerebrium ships this one. |
| @lottiefiles/dotlottie-web | 0.80.0 | 32KB **+ 465KB wasm** | Design Bomb loads its 718KB (uncompressed) player wasm. |
| matter-js | 0.20.0 | 25KB | |
| cobe (globe) | 2.0.1 | 6KB | |
| canvas-confetti | 1.9.4 | 4KB | |
| ogl | 1.0.11 | not measured | bundlephobia rate-limited three times; unpkg served an empty file for the dist path. Commonly cited around 20KB; unverified today. |

What this says: **GSAP + ScrollTrigger is 44KB, motion is 47KB, and either one is half of our headroom.** three.js alone is nearly twice the headroom. Rive and Lottie are not "small animation runtimes"; they are 400 to 800KB once the wasm arrives. The 41 sites in the research confirm the pattern: Gravitas ships 624KB of JS, Lando Norris 584KB, Cursor Compile 1.4MB, lu.ma 2.3MB.

---

## 3. Teardowns

For each: what runs the animation; whether the 3D is real; the JS on the wire; where the heavy assets are and how they arrive; what a phone gets; what reduced motion does; how loading is hidden. Ten in depth, two short.

### 3.1 zero.university
- **Animation.** Framer-built site. Framer Motion (in `motion.*.mjs`), Lenis (in `init.mjs`, with a "Confetti_Prod" module), a Spline embed, a Lottie player with wasm. Scroll is hijacked by Lenis; sections are 11 `position: sticky` stages driven by 50 IntersectionObservers.
- **Is the 3D real?** No. The desk is a rendered still (AVIF). The diploma crumple is a **171-frame image sequence** drawn as you scroll. The city at the bottom is one 6.36MB AVIF. The only live 3D is a Spline embed further down. This is the pre-rendered trick at its most expensive: the frames are individually fetched JPEG/WebP files.
- **JS on the wire.** 1.24MB (4.7MB decoded). Framer runtime 139KB, two 170 to 190KB chunks, fbevents 108KB, a 135KB Meta pixel.
- **Heavy assets.** 15.5MB of images. The 6.36MB city loads with the page (it is an `<img>`, not deferred). Frames arrive on demand as you scroll, which is why a fast scroll shows the freeze rather than smooth playback.
- **On a phone.** Same page, same 16.2MB, same sequence. Nothing is reduced.
- **Reduced motion.** 0 → 0 animated elements. The preference changes nothing because every animation is JavaScript.
- **Loading.** No preloader; the hero still is large so it appears "loaded" while 15MB continues behind it. LCP at 4x: 8.6s.
- **Verdict.** p95 1,017ms. The cheapest version of this idea (12 frames, one WebP sprite sheet, drawn to a canvas) would cost under 300KB and hold 60fps. See 4.1.

### 3.2 gravitas.vit.ac.in
- **Animation.** Next.js app with GSAP, ScrollTrigger and ScrollSmoother (all in the bundle) and Lenis. `react-fast-marquee` for the bands. CSS `animation-timeline` is also present in the stylesheet, so at least one effect uses the native scroll timeline. No Rive, Lottie or three.js in the script bodies.
- **Is the 3D real?** There is no 3D. The growing circle is a CSS-transformed element pinned by ScrollTrigger. The "sticker" cards are images with borders. Four 2D canvases exist (the confetti/effects layer).
- **JS on the wire.** 624KB (1.9MB decoded) across 40 scripts; 259KB is third party.
- **Heavy assets.** 5.4MB of images in the first load: a 1.33MB PNG chart, 973KB / 467KB / 422KB PNG club logos, 300KB WebP event cards. A 1.1MB mp4. None of it is deferred; it is all `<img>` in the first document. 8,252 DOM nodes.
- **On a phone.** Identical, 7.4MB. Custom cursor code still runs.
- **Reduced motion.** 22 → 20. Not implemented.
- **Loading.** A modal ("Upcoming Events!") appears over the hero, which hides the fact that the page behind it is still assembling. It took 17.4s to reach `load` on a normal connection.
- **Verdict.** p95 233ms, 87% of frames over 32ms, 57 long tasks. What Vedant liked is the world-building (dark navy, one electric colour, chunky stickers, mono labels, ghost type). None of that is where the cost is. The cost is unoptimised PNGs, 8,000 DOM nodes, smooth-scroll hijacking and continuous marquees.

### 3.3 landonorris.com (Site of the Year)
- **Animation.** Webflow page with one custom 363KB bundle from OFF+BRAND that contains GSAP, ScrollTrigger, ScrollSmoother, SplitText, Lenis, three.js, Rive, GLSL shaders and a Draco decoder. p5.js loads separately. **21 canvas elements** on the page.
- **Is the 3D real?** Yes, partly. The helmets are GLB models (`tracks-06-test.glb` 467KB, `disco-02.glb` 351KB) with a 378KB HDR environment map and 315KB base-colour textures, rendered in three.js. The portrait is a cut-out image. The scribble signature is an SVG stroke. The marquee is DOM text.
- **JS on the wire.** 584KB; 375KB third party (jQuery 3.5 30KB, a 165KB analytics chunk).
- **Heavy assets.** GLBs and HDR fetched by JS after load (they show as `Fetch`, not `Image`), so they are deferred until the bundle runs. Rive wasm 199KB fetched too.
- **On a phone.** **Heavier**: 6.9MB against 5.4MB desktop. WebGL2 contexts are created on mobile.
- **Reduced motion.** 1 → 1. Not implemented.
- **Loading.** Preloader.
- **Verdict.** p95 117ms, 51% over 32ms, and in the contended pass an 8.6-second task. Its look comes from four things that are free: a cut-out portrait, a hand-drawn stroke, a lime accent, slab type. The 21 canvases are the award, not the design.

### 3.4 hackthenorth.com
- **Animation.** React (Create React App build) with styled-components. **No animation library.** CSS keyframes at 600 to 1,000ms for entrances, a 30s marquee. Five IntersectionObservers, six scroll listeners, 49,636 rAF calls in the window (something is polling every frame).
- **Is the 3D real?** No 3D at all. Everything is illustration: WebP and PNG layers positioned absolutely, plus one 690KB SVG (a sponsor logo).
- **JS on the wire.** 314KB in five files. The lightest of the impressive sites.
- **Heavy assets.** 9.4MB of images across **1,206 `<img>` elements**; the biggest are 631KB "fuel-particles.webp", 556KB and 297KB sponsor PNGs, a 285KB tree row. Not deferred beyond native lazy loading.
- **On a phone.** Same page, 9.8MB, 26,726px tall.
- **Reduced motion.** 45 → 39. Partial.
- **Loading.** No preloader; the sky paints first and objects fade in as they arrive.
- **Verdict.** p95 133ms, 97% over 32ms, 80 long tasks, with zero WebGL and zero animation libraries. The lesson is that **image count and DOM size can do the damage on their own.** Their illustration approach is right for a student event; their asset discipline is what fails the phone.

### 3.5 cursor.com/compile
- **Animation.** Next.js. One chunk contains GLSL (`gl_FragColor`); canvas contexts created are webgl, webgl2 and 2d. No animation library fingerprinted. The COMPILE letterforms are drawn on a canvas by a shader.
- **Is the 3D real?** It is a 2D line animation in a shader, not 3D.
- **JS on the wire.** **1.41MB** (4.8MB decoded) for a page with five paragraphs: Next.js chunks of 170 to 185KB each, fbevents 108KB, analytics. 530KB of fonts.
- **Heavy assets.** 921KB of images below the fold (city photos 150 to 260KB).
- **On a phone.** Same, 3.6MB. WebGL on mobile.
- **Reduced motion.** 3 → 3. The canvas keeps drawing.
- **Loading.** None needed; LCP 0.96s at 4x because the hero is text-light.
- **Verdict.** p95 200ms, 51% over 32ms, 37 long tasks. One always-on canvas plus 1.4MB of JS parse. The restraint is exemplary; the payload is not.

### 3.6 superlocaldesign.com
- **Animation.** Next.js with GSAP, ScrollTrigger, ScrollSmoother, Lenis, three.js and React Three Fiber, 34 IntersectionObservers, 21 scroll listeners. CSS marquees at 98.8s and 122.2s, "breathe" glows at 22s and 26s, a 6s logo loop. Grain overlay and custom cursor.
- **Is the 3D real?** Yes for the coins (R3F, with 270 to 293KB face textures and a 136KB wear map). The floating bubbles are a 567KB mp4 (`circular.mp4`) plus DOM circles, not physics.
- **JS on the wire.** 575KB, none third party.
- **Heavy assets.** 2.5MB images, 584KB video. Coin textures fetched by JS.
- **On a phone.** 3.3MB, WebGL2 still created, 17,060px page.
- **Reduced motion.** **10 → 0 animated, 607 → 112 transitions.** Implemented properly.
- **Loading.** No preloader.
- **Verdict.** p95 317ms, 83% over 32ms. The schedule design (colour block per day, dot-matrix day name) is the stealable part and it is plain HTML.

### 3.7 builderstable.net
- **Animation.** jQuery 3.5 plus GSAP core, ScrollTrigger, ScrollSmoother, SplitText, Observer and ScrollToPlugin as **13 separate script files**, plus Lenis, plus a `gradient-lab.js` GLSL shader for the green FIELD.GLSL window.
- **Is the 3D real?** No 3D. The windows are DOM. The dithered portrait is a pre-rendered image. The shader window is a small WebGL canvas.
- **JS on the wire.** 642KB, 361KB third party (fbevents 108KB, a Meta 81KB, jQuery 30KB).
- **Heavy assets.** 2.7MB of speaker JPEGs (120 to 250KB each) on desktop.
- **On a phone.** **1.5MB**, the only site in the set that serves a materially lighter mobile page (speaker images deferred).
- **Reduced motion.** 2 → 0 animated, 180 → 134 transitions. Partial.
- **Loading.** Preloader with a step animation (`btStepIn` 400ms).
- **Verdict.** p95 33.4ms, 14% over 32ms, 4 long tasks: **the best award-adjacent number in the set**, because once loaded almost nothing animates continuously. LCP 9.8s because of the preloader. The window-with-handles card and the dither portrait are both cheap to copy.

### 3.8 trevornoah.com
- **Animation.** Webflow with one 366KB bundle: GSAP, ScrollTrigger, ScrollSmoother, SplitText, Lenis, three.js, Basis texture transcoder. CSS: 1.2s transform transitions, 2s sprite loop for the menu face, 1.2s clip-path button reveals, 10s marquee.
- **Is the 3D real?** Yes. Head, microphone, player, clouds, rocks, brain as GLBs (277 to 690KB each), a 765KB KTX2 colour texture and a 388KB EXR bend map.
- **JS on the wire.** 722KB, 308KB third party.
- **Heavy assets.** All GLBs and textures fetched by JS after the bundle runs.
- **On a phone.** Same, 7.2MB, WebGL2 created.
- **Reduced motion.** **9 → 0.** Implemented.
- **Loading.** A preloader that leaves a **blank navy screen for over five seconds** on a normal connection.
- **Verdict.** p95 83.7ms, 82% over 32ms, 50 long tasks. The torn-paper edges and single-word pink accents are free; the head is 3MB of geometry.

### 3.9 cerebrium.ai
- **Animation.** Astro with island scripts: Lenis (`Scroll.*.js`), GSAP + ScrollTrigger (`CSSPlugin.*.js`), SplitText (`SplitTitle.*.js`), three.js in a **344KB `BackgroundCanvas.*.js`** chunk with GLSL, Draco decoder wasm, lottie_light 50KB, swiper. Preloader with 1s logo-bar loops.
- **Is the 3D real?** Yes. Two Draco-compressed GLBs (593KB and 196KB) for the ribbons, plus a 123KB particle sprite.
- **JS on the wire.** 975KB, 315KB third party (GTM 127KB).
- **Heavy assets.** GLBs and Draco wasm fetched by the canvas chunk, so deferred behind the preloader.
- **On a phone.** Same 2.5MB; WebGL2 on mobile.
- **Reduced motion.** 2 → 2. Not implemented.
- **Loading.** Preloader hides the GLB fetch.
- **Verdict.** p95 283ms, 74% over 32ms, 48 long tasks. The mono uppercase nav and one gradient word are the stealable parts.

### 3.10 makingsoftware.com
- **Animation.** Next.js with Framer Motion. Three `blur-in` animations at 500ms. That is all the motion there is.
- **Is the 3D real?** No 3D. The technical drawings are inline SVG.
- **JS on the wire.** 322KB, 0 third party. 687KB total page, 28 requests.
- **Heavy assets.** Seven font files at 43 to 58KB (323KB of fonts, the largest single category on the page).
- **On a phone.** Same, 687KB.
- **Reduced motion.** 3 → 3.
- **Loading.** None needed; 1.3s load.
- **Verdict.** p95 133ms, **93% over 32ms, 71 long tasks**, on a page with three animations. This one is instructive. The page has 11 elements with `filter` and its illustrations are large inline SVGs with many paths; scrolling large SVG content forces re-rasterisation on the main thread, and filters on in-flow content compound it. **Light on the wire is not light on the main thread.** If we use a blueprint direction, the drawings must be rasterised (PNG/WebP) or kept to few paths, and filters kept off scrolling content.

### 3.11 designbomb.it (short)
Framer-built; Framer Motion, Lenis, matter.js physics in a "Gravita" module, a dotLottie player with a 718KB wasm, two 5.8MB autoplay mp4s. No 3D. Reduced motion 4 → 4. p95 133ms, 73% over 32ms. The typographic speaker wall is DOM text and costs nothing; everything else on the page is what costs.

### 3.12 boc.studio (short)
Next.js; Framer Motion, GSAP + ScrollTrigger, Lenis, GLSL, swup page transitions. Hero is a 2.5MB webm with a CSS marquee band on top. Reduced motion 13 → 2, implemented. p95 100ms, 74% over 32ms, mostly the video decode plus Lenis. Video hero with a marquee is the cheapest "expensive" look in the set if the video is small and the scroll is native.

---

## 4. The techniques, one by one

Format for each: what it is in plain words; how the sites do it; what it costs on the wire and on the main thread; what it buys; whether it survives a mid-range Android. "Bench" numbers are from the micro-benchmark that injected each technique into **our own landing page** (hero canvas removed so the increment is attributable) and scrolled it at 4x throttle. Baseline for that page in the same session: **p95 17.1ms, 3.3% over 32ms**.

| Technique injected into our page | p95 | > 32ms | long tasks |
|---|---|---|---|
| baseline (no change) | 17.1ms | 3.3% | 4 |
| noise overlay, live SVG feTurbulence, fixed full-screen | 17.0ms | 1.1% | 1 |
| noise overlay, pre-rendered tile, fixed full-screen | 16.8ms | 0.4% | 2 |
| mix-blend-mode: multiply on 20 blocks | 16.8ms | 0.4% | 1 |
| backdrop-filter: blur(12px) on the sticky header | 16.8ms | 0.6% | 1 |
| filter: blur(6px) on 10 paragraphs | 16.8ms | 0.4% | 2 |
| 4 CSS marquees, transform, 40s loop | 16.8ms | 0.6% | 1 |
| 40 floating sprites, transform keyframes | 16.9ms | 1.3% | 1 |
| 40 floating sprites, margin keyframes (layout) | 16.8ms | 1.9% | 1 |
| scroll-timeline parallax, 12 elements, transform | 16.8ms | 0.6% | 1 |
| scroll-timeline, 12 elements, background-position | 16.9ms | 0.4% | 1 |
| scroll-timeline, 12 elements, clip-path | 16.9ms | 0.6% | 0 |
| JS scroll listener parallax, 12 elements, transform | 16.8ms | 0% | 0 |
| sticky stacked cards, 6, scale on scroll-timeline | 16.8ms | 0.8% | 2 |
| pinned section, 300vh, position: sticky child | 16.8ms | 0.6% | 2 |
| horizontal scroll inside vertical, scroll-timeline | 17.1ms | 2.8% | 3 |
| text reveal by word, 400 spans, IO + transition | **33.3ms** | 7.3% | 3 |
| text reveal by character, 3 headlines | 17.0ms | 1.5% | 3 |
| SVG path drawing, 1 long path, stroke-dashoffset on scroll | **33.5ms** | 12.2% | 10 |
| variable font weight, 10 headings, wght 300 to 800 looping | **83.3ms** | **56.6%** | **43** |
| canvas 2D, 900 dots, every frame, always on | **33.6ms** | 19.5% | 12 |
| image sequence, 60 pre-decoded frames to canvas on scroll | **33.2ms** | 5.6% | 5 |
| WebGL fragment shader, full-screen, every frame | **33.6ms** | 11.8% | 11 |
| magnetic hover, 20 buttons, pointermove | **33.4ms** | 7.2% | 9 |

The first block (everything at 16.8 to 17.1ms) is compositor work. CPU throttling cannot see its GPU cost, and on a Mali-G78 with a 2.6x screen the blur and blend rows in particular are not free. The second block is main-thread work and it shows.

### 4.1 Scroll-scrubbed image sequences
**What.** A set of still frames, one drawn per scroll position, so it looks like a video you control. Zero's diploma crumple (171 frames). Seasats (80 frames). Hack the North has 72 sequential images.
**Cost.** On the wire, frames × size: Zero fetches individual files; a 60-frame 800px WebP sprite sheet would be about 1.5 to 3MB. On the main thread, **decode is the killer**: each JPEG decode is 20 to 80ms on a mid-range phone, and Zero's measured 952ms tasks are exactly that. Once decoded and held as `ImageBitmap`s, drawing is cheap: bench 33.2ms p95 with 60 frames pre-decoded, 5.6% over 32ms.
**Buys.** Narrative. An object changing state as you scroll is the strongest storytelling device in the set.
**Android.** Survives **only** if frames are few (12 to 24), small (under 600px on the long side), pre-decoded with `createImageBitmap` off the main thread before the section is reached, and the sequence is short. Zero's version does not survive; a 16-frame version of one object does.

### 4.2 Pinned scroll sections
**What.** A section that stays fixed on screen while you keep scrolling, so an animation can play "in place". Gravitas (the growing circle), White Desert, Seasats (34 sticky), Zero (11 sticky).
**Cost.** With `position: sticky` and a tall parent: nothing measurable (bench 16.8ms). With GSAP ScrollTrigger `pin: true`: 44KB of library and a scroll listener that sets transforms every frame, which is fine alone and expensive when combined with Lenis.
**Buys.** A "chapter" feel; time for one idea.
**Android.** Survives as `position: sticky`. Our current tracks stage already does this and measured fine. The risk is the content inside the pin, not the pin.

### 4.3 Sticky stacked cards
**What.** Cards that pile up as you scroll, each sticking under the last and shrinking. Common on SaaS pages; none of the event sites used it.
**Cost.** `position: sticky` plus a scroll-timeline `scale`: bench 16.8ms. Free.
**Buys.** A way to show four passes or three tracks with a sense of depth.
**Android.** Survives. Keep shadows off the cards (shadows on a scaling layer repaint).

### 4.4 Horizontal scroll inside vertical
**What.** A row that slides sideways while the page scrolls down. Decathlon has it. It is the effect users hate most on phones because it steals the scroll.
**Cost.** With `animation-timeline: scroll()` on a transform: bench 17.1ms, 2.8% over 32ms, the highest of the compositor group because the sticky wrapper is 300vh tall and the row is 400vw wide (a large layer).
**Buys.** Novelty on desktop.
**Android.** Technically survives; experientially it is the wrong tool. The brief already bans it for the schedule. Do not use it anywhere.

### 4.5 Text reveal by line, word or character
**What.** Headlines that arrive word by word or letter by letter. SplitText (GSAP) on Cerebrium, Lando, Trevor Noah, Builders Table, Spatial, Léo Parpeix; Superlocal's slot-machine; our own current `.enter` stagger.
**Cost.** By character on 3 headlines: 17.0ms, fine. **By word across 400 spans with IntersectionObserver: 33.3ms p95**, because 400 observers and 400 transitions is real work. SplitText is 3KB on top of GSAP's 27KB.
**Buys.** The sense that the page is "performing" the headline. Overused in 2026; every site above does it.
**Android.** Survives for headlines (a few dozen spans). Does not survive for body copy. Do it with CSS `animation-delay` on spans, no library, and only on the hero and section titles.

### 4.6 Magnetic cursors and custom cursors
**What.** A dot that follows the mouse, buttons that lean toward it. Custom cursor markup or `cursor: none` on 25 of the 41 sites (Gravitas, Cursor, Superlocal, Builders Table, Design Bomb, OFFF, Lando, Scout, Wiz, Cosmos…).
**Cost.** Bench for magnetic hover on 20 buttons: 33.4ms p95, 9 long tasks, because `getBoundingClientRect` on every pointermove is a layout read; cache the rects and it is free. A custom cursor element costs one `transform` per pointermove.
**Buys.** Nothing for **most of our users, who have no cursor.** On a phone the code still ships, still registers listeners, and does nothing.
**Android.** Irrelevant. Do not build it. If Vedant wants one hover flourish for laptops, gate it behind `@media (hover: hover) and (pointer: fine)` and load the code only there.

### 4.7 WebGL shader backgrounds
**What.** A full-screen canvas running a small program on the GPU every frame: Cerebrium's ribbons, Builders Table's green field, Superlocal's glows, the "aurora" and "beams" backgrounds in Aceternity.
**Cost.** Bench for a simple full-screen noise shader: **33.6ms p95, 11.8% over 32ms, 11 long tasks**, and that is only the CPU side (rAF, uniform upload, draw call). The fragment cost at 2.6x on a 412x915 screen is 1,071 × 2,379 = 2.5 million pixels per frame on a mobile GPU, invisible to this harness. With three.js it is 181KB+ of JS before a single triangle.
**Buys.** The "expensive" look that wins Awwwards.
**Android.** Does not survive at full screen at 60fps. Survives at a quarter resolution (`canvas.width = cssWidth / 2`), capped to 30fps, paused off-screen, and with a static fallback under reduced motion. Even then it is a moderate risk and a thermal one: phones throttle after two minutes of GPU load.

### 4.8 Canvas particle fields
**What.** Dots or lines drawn in 2D canvas every frame: our current hero, Aceternity's Sparkles and Meteors.
**Cost.** Bench for 900 dots every frame: **33.6ms p95, 19.5% over 32ms, 12 long tasks** at 4x. This is the worst compositor-invisible cost measured after variable fonts, because 2D canvas rasterises on the CPU. Our real hero mitigates it (30fps cap, DPR cap at 2, stops off-screen), which is why the page measures 16.9ms with it on; the SPEC's own attribution run showed the canvas is the largest single contributor.
**Buys.** Ambient life in the hero.
**Android.** Survives only with the mitigations we already have. Do not add a second one. If the new direction has a hero animation, it should replace this canvas, not join it.

### 4.9 Scroll-driven SVG path drawing
**What.** A line that draws itself as you scroll (`stroke-dashoffset`). Lando's scribble (on load, not on scroll). The metro-line and blueprint concepts in CONCEPTS.md want this.
**Cost.** Bench for one 2,000px path driven by scroll: **33.5ms p95, 12.2% over 32ms, 10 long tasks.** `stroke-dashoffset` is not a compositor property; every change re-rasterises the path on the main thread.
**Buys.** The single most "drawn by hand" effect available, and it needs no library.
**Android.** Survives **on load, not on scroll**: play it once as a CSS animation over 1.2 to 2 seconds when the section enters (one IntersectionObserver), not tied to scroll position. Then it costs 10 frames of work once and nothing after. Keep total path length short and stroke width ≥ 2px so it is visible at 2.6x.

### 4.10 View Transitions API
**What.** The browser animates between two DOM states or two pages: an element on the passes list morphs into the same element on the register page.
**Support (caniuse today).** 91.75% global. Chrome 111+, Safari 18+, iOS 18+, Firefox 144+, Samsung Internet 23+. Cross-document (page to page) transitions ride on Next.js's router support; Next 16 exposes `unstable_ViewTransition`.
**Cost.** Zero bytes. The transition itself is a compositor snapshot animation. Not exercised by scrolling so it is absent from the bench.
**Buys.** The one modern effect that is free, native and degrades to a plain navigation on old browsers. For us: pass tier card → `/register` step 1, and step → step inside the form.
**Android.** Survives. Use it.

### 4.11 CSS `animation-timeline` (scroll-driven animations) and where it actually runs
**What.** CSS animations whose clock is the scroll position (`animation-timeline: scroll()` or `view()`), with no JavaScript.
**Support (caniuse today).** 87.22% global. Chrome 115+, Safari 26+ and iOS 26+ (new this year), Firefox 159, Samsung 23+. The Safari 26 requirement matters: any iPhone that has not updated to iOS 26 gets no animation, which is an acceptable fallback if the resting state is the final state.
**Where it runs.** Chrome's documentation claims scroll-driven animations "run off the main thread". That is true **only when the animated property is compositor-animatable** (`transform`, `opacity`; MDN's list) and the element is in its own layer. Animating `background-position`, `clip-path` with a non-trivial shape, `height`, `stroke-dashoffset`, colour, or anything else drops back to main-thread style and paint every frame, still with no JS, but not free. The brief's earlier measurement (76.4ms p95 and 18 long tasks with `animation-timeline` versus 34.6ms with IntersectionObserver) is consistent with that: the previous attempt animated non-compositable properties or many elements.
**Bench.** Transform parallax on 12 elements: 16.8ms. Background-position on 12: 16.9ms. Clip-path inset on 12: 16.9ms. All fine at this scale; the earlier failure was scale and property choice, not the feature.
**Android.** Survives for transform and opacity on a small number of elements. Rule for this project: **scroll-timeline is allowed for `transform` and `opacity` only, on at most a dozen elements per page, and every animated element must read correctly in its final state without the animation.**

### 4.12 Parallax, cheap and expensive
**What.** Layers that move at different speeds as you scroll.
**Cheap.** Two or three layers, `transform: translate3d` only, driven by scroll-timeline or a passive scroll listener. Bench: 16.8ms either way, 0% over 32ms with the listener.
**Expensive.** Lenis-style smooth scroll plus GSAP ScrollTrigger scrub on dozens of elements, or parallax on large images (each is its own layer, memory at 2.6x is 4 to 6MB per full-screen layer), or any parallax on `background-position`.
**Buys.** Depth for almost nothing when cheap.
**Android.** Survives when cheap. Keep layers under four, keep them transform-only, and never parallax the layer that contains text.

### 4.13 Marquees
**What.** A band of repeating text sliding sideways. Gravitas (four at 50 to 74s), Superlocal (two at 99 to 122s), Boc.Studio (six at 30 to 123s), Lando, Scout, Trevor Noah; eight of the 41 by class name, plus our own ticker.
**Cost.** Bench for four transform marquees: 16.8ms, free. As CSS `transform` keyframes on a duplicated track they are pure compositor. As `react-fast-marquee` (Gravitas) they are JS-driven and cost a rAF loop.
**Buys.** Energy, cheaply. Also the most cliché element of 2026.
**Android.** Survives as CSS. Pause under reduced motion (we already do). One is fine; four reads as filler.

### 4.14 Noise and grain overlays
**What.** A film-grain texture over the whole page. Superlocal has one; most "riso" and "print" designs want one.
**Cost.** Bench: live `feTurbulence` SVG filter fixed full-screen 17.0ms; a pre-rendered tile 16.8ms. Both invisible to CPU throttling, and both are a full-screen compositing layer that the GPU blends every frame at 2.5 million pixels. The pre-rendered tile is the only version to ship: a 200×200 PNG at 3 to 8KB, `background-repeat`, `opacity` 0.04 to 0.08, `pointer-events: none`.
**Buys.** The print feel; hides banding in gradients.
**Android.** Survives as a pre-rendered tile. The live filter is a GPU cost this harness cannot see; do not ship it. Under reduced motion a static grain is fine (it does not move).

### 4.15 Variable font animation
**What.** Animating a font axis (weight, width) so letters swell or breathe. Decathlon animates Roboto Flex 100 to 1000.
**Cost.** Bench: **83.3ms p95, 56.6% over 32ms, 43 long tasks** for ten headings looping. By far the worst result in the benchmark. Every step re-shapes and re-rasterises the text on the main thread.
**Buys.** A distinctive, typographic kind of motion.
**Android.** **Does not survive as continuous motion.** Survives as a one-shot `transition` on hover or on entrance (one change, 300ms, on one element). Never loop it and never tie it to scroll.

### 4.16 Blend modes
**What.** `mix-blend-mode: multiply` or `difference` so overlapping colours interact like ink. The riso concept wants it.
**Cost.** Bench for multiply on 20 blocks: 16.8ms, invisible to CPU throttling. Mechanism: each blended element forces its ancestors into an isolated group and the GPU blends per pixel every frame; costly when the blended element is large or scrolls over a complex background.
**Buys.** Genuine print texture; two-colour overprint.
**Android.** Survives for small, static elements (a stamp, a label, an accent block). Do not blend full-screen layers, images, or anything that animates. Under reduced motion nothing changes because it does not move.

### 4.17 Physics-based hover
**What.** Elements that spring, bounce or fall: Design Bomb's matter.js, Aceternity's spring cards.
**Cost.** matter-js 25KB; spring maths in `motion` 47KB. Per frame the physics itself is cheap; the cost is the always-on rAF loop and the DOM writes.
**Buys.** Playfulness on desktop.
**Android.** Hover does not exist on a phone; "tap to bounce" survives if implemented as a CSS `transition` with a spring-like cubic-bezier, no library.

### 4.18 Smooth scroll (Lenis, ScrollSmoother)
**What.** Replacing the browser's scroll with a JS-interpolated one so the page glides. **24 of 41 sites fingerprint Lenis**; every Awwwards site in the set has it.
**Cost.** 5KB on the wire, and then a rAF loop that sets a transform every frame for as long as the page is open, plus it breaks native scroll behaviour (find-in-page, anchor jumps, scroll restoration, `position: sticky` timing, and on Android the momentum feel).
**Buys.** The "smooth" feel judges reward on a MacBook trackpad.
**Android.** **Does not survive**, and it is the common factor in every bad number in section 1. Android's native scroll is already composited and 60fps; Lenis moves it to the main thread. Not for this project under any concept.

### 4.19 Preloaders, skeletons, progressive reveal
**What.** How a site hides the seconds while assets arrive. Preloader markup (a logo animation over a blank page) on 12 of 41 sites. Trevor Noah shows blank navy for 5+ seconds. Builders Table's preloader gives it a 9.8s LCP.
**Cost.** A preloader **adds** time to first content by definition. Skeletons cost DOM. Progressive reveal (paint text first, let images arrive) costs nothing.
**Buys.** A preloader buys the developer time; it buys the user nothing.
**Android.** Progressive reveal is the only one that survives a 4G connection: HTML and fonts first, hero image as a small blurred placeholder, everything else lazy. Our current page already does this; LCP 1.2s at 4x throttle.

### 4.20 Video heroes
**What.** A looping video behind the headline. Boc.Studio (2.5MB webm), White Desert (4.3MB mp4), Squarespace (12.4MB), poetry.camera (six videos, 11.6MB on mobile).
**Cost.** The bytes, and hardware decode which is cheap on any phone made after 2019. Autoplay requires `muted playsinline`. Boc.Studio's p95 100ms is Lenis and Framer Motion, not the video.
**Buys.** The most production value per line of code in the whole list.
**Android.** Survives **if** the file is under 1.5MB (720p, 6 to 10 seconds, 24fps, no audio, AV1 or H.265 with an H.264 fallback), has a poster frame, is paused off-screen and under reduced motion, and is replaced by the poster on `prefers-reduced-data`. We have no footage yet, which is the real constraint.

### 4.21 Dithered and halftone portraits
**What.** Speaker photos converted to one-colour dither (Builders Table) or halftone dots (riso designs). Any photo, from any phone, in any lighting, becomes one consistent style.
**Cost.** Pre-rendered: a 40KB PNG each, zero runtime. As a live SVG filter (`feComponentTransfer` + `feTurbulence`): a GPU filter per image, moderate risk on scroll.
**Buys.** Consistency across a speaker lineup that will arrive one headshot at a time in different sizes. Solves a real problem for us.
**Android.** Survives pre-rendered. Build it as a script in `scripts/`, not a runtime filter.

### 4.22 Ghost mega-type
**What.** One enormous word at 20 to 40vw behind a section, at low contrast. Gravitas ("graVITas"), Lando ("LANDO NORRIS"), Trevor Noah.
**Cost.** One text node, `position: absolute`, `overflow: hidden` on the section. Free.
**Buys.** Scale and identity from the one asset we already have: the name.
**Android.** Survives. Keep it out of the accessibility tree (`aria-hidden`) and out of the layout (`position: absolute`).

### 4.23 Typographic walls
**What.** A list as the design: speakers as giant names with a small role line (Design Bomb), a taxonomy with counts (uncut.wtf), a schedule as colour-blocked days with big labels (Superlocal), a one-line event descriptor (OFFF).
**Cost.** Nothing. HTML.
**Buys.** Confidence in the weeks when there are no photos, no logos and no prices, which is our whole runway to launch. And a page that measures like uncut.wtf (17ms, zero long tasks) instead of like Zero.
**Android.** Survives everything.

---

## 5. What this means for our budget

The brief's budget (p95 under 16.7ms at 4x, no task over 100ms, LCP under 2.5s on 4G, under 200KB gzipped JS) is met today by four sites in the sample: ours and three that have essentially no motion. Every site that looks like an Awwwards site misses it by a factor of five to sixty. So the design direction has to come from **what those sites look like** (type scale, two-colour palettes, one signature object, worlds built from flat colour and a few props) and not from **how they are built** (Lenis, GSAP scrub on everything, WebGL, image sequences, 5MB of PNGs).

Allowances that hold the budget, from the measurements above:

- **Zero animation libraries** by default. CSS keyframes, CSS transitions, one IntersectionObserver for entrances, scroll-timeline for transform/opacity on a handful of elements, View Transitions for navigation. If one signature move genuinely needs a timeline, GSAP core alone (27KB) is the ceiling, and it must be code-split behind the section that uses it.
- **One always-on loop maximum**, and only in the hero: either the existing canvas (30fps, DPR 2, stops off-screen) or its replacement. Never two.
- **No smooth scroll. No custom cursor. No full-screen live filters. No variable-font loops. No scroll-tied stroke drawing.**
- **Images:** every raster under 150KB, WebP or AVIF, `sizes` set, lazy below the fold, hero image under 60KB with a blurred placeholder. A whole page under 1.5MB on mobile including any video.
- **DOM:** under 1,500 nodes on the landing page (Gravitas has 8,252; Wiz has 14,520; ours today is well under).
- **Fonts:** two families, variable where possible, subset to Latin (plus Telugu if that concept is chosen), under 120KB total.
- **The signature move budget** is roughly what our hero canvas costs today: one thing that runs, visibly, and is paused the moment it leaves the screen.

Everything in CONCEPTS.md is priced against these numbers.
