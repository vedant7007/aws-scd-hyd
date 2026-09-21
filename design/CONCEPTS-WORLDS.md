# Concepts, second round: ten worlds

Ten environments a person could stand inside. None is a document, an interface, a print format or an editorial metaphor. Pixel art is out (Pune) and purple space is out (Gravitas).

The first round concluded that worlds were unaffordable. That was the wrong reading of the research: Hack the North is a full illustrated world with no animation library and no WebGL, and it misses the budget because it ships 1,206 images and 9.4MB, not because it is a world. So this round starts from measurements of worlds themselves, not from sites that happen to contain one.

## What was measured before any of this was written

`scripts/research/worldbench.mjs` builds each world's rendering pattern on top of our own landing page from **real decoded WebP layers generated in-page at the mobile dimensions the concepts specify** (900×1400, alpha, organic shapes with grain so the encoder cannot cheat), plus the CSS and SVG the world needs, then scrolls it at 4x CPU throttle on the 412×915 / 2.6x profile, the same method as every other number in this folder. Baseline for our page in the same session: **p95 16.8ms, 1.3% of frames over 32ms.**

| Pattern injected into our page | p95 | > 32ms | Verdict |
|---|---|---|---|
| 2 full-screen alpha layers on scroll-timeline parallax | 16.8ms | 1.7% | free |
| 3 alpha layers, parallax, 12 swaying SVG leaves | 16.8ms | 1.5% | free |
| 3 alpha layers, the front one with a live `filter: blur(2px)` | 16.8ms | 1.1% | free on the CPU (GPU cost invisible here) |
| 4 alpha layers, parallax | 16.8ms | 1.7% | free |
| **6 alpha layers, parallax (the stress test)** | 16.8ms | 2.6% | free |
| 3 rain layers (repeating gradients on transform), skyline SVG, reflection layer | 16.8ms | 1.3% | free |
| 40 SVG bulbs on 3 swaying strings, glow by box-shadow | 16.8ms | 1.3% | free |
| same, glow by `filter: drop-shadow` per bulb | 16.8ms | 1.3% | free on the CPU |
| 2 rock layers, moving full-screen radial-gradient "lamp", 8 pulsing crystals | 16.9ms | 4.0% | passes, borderline |
| sky crossfade (opacity on scroll-timeline), 3 ridge layers, sun translating | 16.8ms | 1.3% | free |
| CSS sky, skyline SVG, 1 cloud layer, 60 twinkling stars, satellite | 17.0ms | 4.3% | passes, borderline |
| 2 small tiled textures, 14 SVG tools swinging | 16.8ms | 2.4% | free |
| neon headline (text-shadow, flicker), 6 SVG tubes with blur glow, 1 layer, scanlines | 16.8ms | 0.9% | free |
| 2 layers + 2 rotating floodlight cones + **200 blinking crowd dots** | **66.6ms** | **47.4%** | **fails** |
| the same with 24 dots | 17.0ms | 3.7% | passes |
| 2 layers + 4 god rays + **30 rising bubbles** | **33.2ms** | 5.9% | fails |
| the same with 12 bubbles | 33.3ms | 6.9% | fails |
| 2 layers + 4 god rays, no bubbles | 16.9ms | 1.9% | free |
| 12 / 24 / 48 / 96 small props animating `transform` | 16.8 / 16.8 / 33.3 / noisy | | tips between 24 and 48 |
| 24 / 48 / 96 small props animating `opacity` | 16.8 / 16.9 / 33.4 | | tips between 48 and 96 |
| **200 stars baked into one tiled background, one opacity pulse** | 16.8ms | 2.4% | free |

Three rules fall out of that, and every world below obeys them:

1. **Full-screen image layers are free on the CPU, up to at least six.** Weight, not layer count, is the constraint. (GPU overdraw and memory are invisible to this harness; four layers at 2.6x is about 40MB of texture, which a 2021 mid-range phone handles.)
2. **Individually animated small elements are the cost.** Up to about 16 on screen is safe, 24 is the edge, 48 drops frames, 96 to 200 is Stadium's 47%. Crowds, stars, bubbles, rain, sparks: bake them into **one** tiled image or gradient and move that one element.
3. **Decode happens once, at load.** Every world preloads its layers with `decoding="async"` and a `<link rel="preload">` for the hero layers, never lazily mid-scroll. That is Zero's 17-second mistake in reverse.

**Measured encoded sizes for the synthetic layers** (WebP, quality 0.70 to 0.75, 900×1400): complex organic alpha layers 180 to 295KB; simple silhouette-style alpha layers (dune ridges) 90 to 115KB; smooth opaque backdrops 42 to 45KB; a 512×512 opaque texture tile 21KB; a 720×1120 alpha layer 180KB; a 1600×1000 desktop alpha layer 296KB. The synthetic layers are deliberately high-entropy (grain on every pixel), so real generated illustration will usually come in under these. The budgets below use the measured numbers, not the hopeful ones, and AVIF with a WebP fallback would take another 30 to 40% off; that is margin, not counted.

## How every world is made, since there is no illustrator

- **CSS** for skies, depth, light: layered `linear-gradient` and `radial-gradient`, 0KB, and they crossfade between light and dark mode for free.
- **SVG** for silhouettes and props: skylines, leaves, tools, lanterns, bulbs, tubes, crystals. Drawn by hand as simple paths (a skyline is one path; a leaf is one path). 1 to 8KB each. Never more than a few hundred path points on screen; Making Software's giant inline SVGs are the counter-example.
- **Generated raster layers** for anything organic: foliage, rock, coral, crowds, clouds, cabinets. Generated with an image model at twice the target size on a flat key colour or with an alpha output, cut out, downscaled, and encoded to WebP (quality 70) and AVIF, in two crops: **1600×1000 desktop** and **900×1400 mobile**, served through `<picture>`. This is a build step in `scripts/`, never a runtime cost. Every generated image is checked by a human before it ships and nothing in it may depict a real person, logo or place it should not.
- **Photography** only where we have it (none today).
- **The pass page never joins the world at full strength.** The QR plate stays dark-on-light in every concept (already a token rule), and the pass card sits on a solid surface with the world dimmed behind it, so it scans at a gate in sunlight.

Shared rules from the first round still hold: `#FF9900` is an accent, never text on a light background; each concept names a focus colour at 3:1 or better on both backgrounds (every ratio below is computed); two type families, both on Google Fonts (checked); light and dark both designed; motion off under `prefers-reduced-motion`; nothing invents content. "Build cost" is the whole job, all routes. "Mobile total" is today's 186KB of JS+CSS, plus fonts, plus the world's images, against a 1,536KB ceiling.

---

## 1. Boulders

**The pitch.** You are standing on the Deccan plateau at golden hour, among the enormous round granite boulders that Hyderabad is built on and around, with dry gold grass and a sky that goes from noon to night as you scroll. It is the one landscape in the world that is unmistakably this city, and nobody has put it on a tech event.

**The signature move.** The sun sets as you scroll. The sky crossfades from day to dusk to night over the length of the page, the sun slides down behind the biggest boulder, the boulders go from warm grey to silhouette, and the orange of the accent is the last light on their edges. Light mode is the page at noon; dark mode is the page at night; scrolling is time passing. The theme toggle is literally a sun and a moon.

**Palette.**
Light: bg `#FBEFD8` (noon haze), text `#2B1D12`, muted `#7A6250`, accent `#FF9900`, shade `#9A4B22`, focus `#9A4B22` (5.42:1).
Dark: bg `#1A1230` (night), text `#F6E9D2`, muted `#A6978A`, accent `#FF9900`, shade `#FFB37A`, focus `#FFB84D` (10.41:1).
Orange is the sun, the rim light on rock edges, and the "recommended" band. Razorpay `theme.color`: `#9A4B22`.

**Type.** **Unbounded** for display, wide and geometric like a horizon line, because a landscape this open needs type that sits wide and low rather than tall. **Manrope** for body, because it is plain and warm and reads on both haze and night.

**Motion language.** Slow. The sun moves on scroll only. Grass at the bottom edge sways (one tiled SVG layer, `transform: skewX`, 6s). Nothing bounces, nothing pops. Under reduced motion the page is fixed at late afternoon, the best light.

**How the hero works.** Full viewport. Sky: two stacked CSS gradient layers (day and night) with the day layer's `opacity` on `animation-timeline: scroll()`. Sun: one `radial-gradient` disc, `transform` on the scroll timeline. Three boulder layers (back, mid, front) as generated alpha WebPs on transform parallax at three speeds, the front one large enough that the headline is partly tucked behind its curve. Headline in Unbounded 800 at 11vw: "AWS Student Community Day" with "Hyderabad" on its own line in the shade colour. Countdown as a sundial line: "39 sunsets to go". On mobile the layers are the 900×1400 crops and the sun's path is shorter. Measured pattern: **dune, p95 16.8ms, 1.3% over 32ms.**

**Empty states.** A flat rock face with nothing carved on it yet and the caption "Names go up here". Rock that has not been carved is rock; it does not look unfinished.

**THE ASSET BUDGET.**

| Asset | How made | Format | Mobile size | KB | Desktop size | KB |
|---|---|---|---|---|---|---|
| Sky, day and night | CSS gradients | none | | 0 | | 0 |
| Sun and moon | CSS radial gradient | none | | 0 | | 0 |
| Boulders, back ridge | generated, simple silhouettes | WebP alpha | 900×1400 | 90 | 1600×1000 | 120 |
| Boulders, mid | generated | WebP alpha | 900×1400 | 110 | 1600×1000 | 150 |
| Boulders, front (large, partly cropped) | generated | WebP alpha | 900×1400 | 115 | 1600×1000 | 160 |
| Grass fringe | hand SVG, tiled | SVG | | 3 | | 3 |
| Section backdrop for tracks (a rock face) | generated | WebP | 900×600 | 45 | 1600×700 | 70 |
| Fonts, Unbounded + Manrope, Latin subsets | next/font | woff2 | | ~95 | | ~95 |
| **Images total** | | | | **363** | | **503** |
| **Mobile total** with 186KB JS+CSS and fonts | | | | **644KB** | | |

Under 1,536KB by 892KB. Nine raster images on the landing page in total (Hack the North has 1,206). Measured: p95 16.8ms at 4x. **Fits.**

**Stress test.** Story: boulders at dusk with the sun behind them in portrait. Passes, and it is the most Hyderabad image in either round. Poster: a landscape with a sunset is a poster. Passes. Badge: a boulder silhouette with the sun as the orange dot and the QR on the flat face. Passes.

**Why it might be wrong.** Boulders are grey, and a grey world has to work hard not to be dull; and someone will say "it looks like a screensaver".

---

## 2. Night Market

**The pitch.** A bazaar after dark. Strings of bulbs overhead, lantern light on awnings, stalls in silhouette, a crowd you sense more than see. Everything is warm and a little loud, and the orange is not an accent here, it is the light source.

**The signature move.** The lights come on as you arrive. Each section's heading hangs from the string like a shop sign and swings once as it enters; the bulbs along the string light up in sequence down the page (an IntersectionObserver toggles a class that turns the glow on, one string at a time). The pass is a lantern tag with the QR, on a hook.

**Palette.**
Light: bg `#FBEFD9` (the market at four in the afternoon, awnings up), text `#2A1A12`, muted `#6E5A4C`, accent `#FF9900`, lantern red `#B3261E`, focus `#B3261E` (5.74:1).
Dark: bg `#150C12`, text `#FFEBD2`, muted `#B59C88`, accent `#FF9900`, lantern `#FF6B57`, focus `#FFB84D` (11.17:1).
Orange is the bulb glow, the lantern paper, and the CTA. Razorpay `theme.color`: `#B3261E`.

**Type.** **Syne** for display, wide and slightly odd, the way a hand-painted shop sign is. **Instrument Sans** for body, quiet enough to read under all that light.

**Motion language.** Sway and glow. Strings rotate ±1.2° on a 5s ease (transform), bulbs are static elements whose glow is a `box-shadow` painted once, lit or unlit. Signs swing once on entry (rotate, 600ms, one overshoot). Nothing else moves. Under reduced motion every light is already on and nothing sways.

**How the hero works.** Full viewport, dark mode by nature; light mode is the same stall row by day with the strings unlit. Three bulb strings across the top (SVG line plus 14 bulb elements each, 42 bulbs, static; only the three string containers animate). Behind: a stall-row layer and a crowd layer, generated alpha WebPs on two-speed parallax. The headline in Syne 800 at 11vw sits as a big painted sign in the middle of the stalls, with a hairline "hanging wire" to the top string. Countdown on a small chalk-board sign: "Opens in 39 days". Measured pattern: **night market, p95 16.8ms, 1.3% over 32ms** with both glow methods.

**Empty states.** An empty stall with the shutter down and a small sign: "Opening soon". Every real market has one.

**THE ASSET BUDGET.**

| Asset | How made | Format | Mobile size | KB | Desktop size | KB |
|---|---|---|---|---|---|---|
| Sky and ground | CSS gradients | none | | 0 | | 0 |
| Bulb strings and bulbs | hand SVG + CSS | SVG | | 2 | | 2 |
| Stall row | generated, silhouettes with warm fills | WebP alpha | 900×1400 | 200 | 1600×1000 | 260 |
| Crowd | generated, soft silhouettes | WebP alpha | 900×700 | 110 | 1600×500 | 130 |
| Lantern (pass tag, tier marker) | hand SVG | SVG | | 3 | | 3 |
| Awning stripes for section headers | CSS repeating gradient | none | | 0 | | 0 |
| Fonts, Syne + Instrument Sans | next/font | woff2 | | ~90 | | ~90 |
| **Images total** | | | | **315** | | **395** |
| **Mobile total** | | | | **591KB** | | |

Under the ceiling by 945KB. Measured: 16.8ms. **Fits.**

**Stress test.** Story: strings of lights over a headline in portrait. Passes. Poster: a lantern-lit bazaar poster. Passes. Badge: a lantern tag, the QR as the paper panel. Passes; second-best badge after the arcade token.

**Why it might be wrong.** A bazaar at night is the most photographed idea of Hyderabad after the Charminar, so it can tip into tourism board; and a warm dark world needs a light mode that people will actually use, which is a stall row by day and less magical.

---

## 3. Monsoon

**The pitch.** Hyderabad in the rain. A grey-blue sky, rain slanting across the whole page, the skyline low and dark, wet ground reflecting the orange of the headline. It is the season the city talks about most, it is nothing like any tech event, and the quiet of it is confident.

**The signature move.** The sky clears when registration opens. Until then it rains: three layers of rain streaks slant across the page, the reflection wobbles, the countdown is a forecast ("Clear skies in 39 days"). The morning registration opens, the rain stops, the sky goes gold, and the CTA appears in the break in the cloud. That is a world that changes because something real happened, and it costs one CSS class.

**Palette.**
Light: bg `#E9EEF2` (overcast), text `#14202B`, muted `#56667A`, accent `#FF9900`, wet blue `#1F4E79`, focus `#1F4E79` (7.42:1).
Dark: bg `#0F161E` (night rain), text `#E6EEF5`, muted `#93A3B5`, accent `#FF9900`, wet `#6FB3FF`, focus `#6FB3FF` (8.29:1).
Orange is the one warm thing in a cold world: the headline's reflection in the wet ground, a lit window in the skyline, the CTA. Razorpay `theme.color`: `#1F4E79`.

**Type.** **Bricolage Grotesque** (already in the repo) for display, because its slightly soft, humanist shapes read as warm against cold weather. **DM Mono** for the forecast line, the countdown and data, because a forecast is a readout.

**Motion language.** Rain falls (three `repeating-linear-gradient` layers on a `transform` loop at 1.1s, 1.7s and 2.6s, slower further back). The reflection wobbles 4px on a 3s ease. Section entrances are a fade. Under reduced motion the rain is a static texture and the reflection is still.

**How the hero works.** Sky: CSS gradient plus one smooth cloud layer (opaque WebP, 42KB measured). Skyline: one SVG silhouette path across the bottom third, generic towers with one lit orange window. Ground: the bottom 35% is a reflection of the hero itself (a duplicated headline element with `transform: scaleY(-1)`, `opacity: .35`, `filter: blur(3px)`, painted once) over a wet-asphalt layer. Rain: three full-screen gradient layers. Headline in Bricolage 800 at 11vw in the text colour, its reflection in orange. Countdown in DM Mono as a forecast. Measured pattern: **monsoon, p95 16.8ms, 1.3% over 32ms.**

**Empty states.** A section "still under cloud": the heading, a rain layer at higher opacity, and "Clearing soon". Weather that has not cleared yet is a normal state of weather.

**THE ASSET BUDGET.**

| Asset | How made | Format | Mobile size | KB | Desktop size | KB |
|---|---|---|---|---|---|---|
| Sky | CSS gradient | none | | 0 | | 0 |
| Clouds | generated, smooth | WebP opaque | 900×700 | 42 | 1600×600 | 60 |
| Rain, 3 layers | CSS repeating gradients | none | | 0 | | 0 |
| Skyline | hand SVG, one path | SVG | | 4 | | 4 |
| Wet ground | generated, smooth dark with streaks | WebP opaque | 900×500 | 45 | 1600×400 | 60 |
| Reflection | the DOM, transformed | none | | 0 | | 0 |
| Cleared-sky state | CSS gradient | none | | 0 | | 0 |
| Fonts, Bricolage (already loaded) + DM Mono | next/font | woff2 | | ~60 | | ~60 |
| **Images total** | | | | **91** | | **124** |
| **Mobile total** | | | | **337KB** | | |

Under the ceiling by 1.2MB. The lightest world in the round after Workshop. Measured: 16.8ms. **Fits.**

**Stress test.** Story: rain over a dark skyline with one orange word in portrait. Passes. Poster: a rain poster is a genre (film posters do it). Passes. Badge: a small skyline with the QR as the lit building. Passes, quietly.

**Why it might be wrong.** Grey-blue and rain read as sad to a lot of people, especially on a poster in a corridor, and the "sky clears" moment happens once, for the people who happen to be there.

---

## 4. Reef

**The pitch.** Underwater. Sunlit turquoise at the surface, light rays slanting down, and the page gets deeper and darker as you scroll until the footer is the sea floor. Coral and kelp drift at the edges. It is bright, calm, and nothing like a conference.

**The signature move.** The descent. The page background is one tall gradient from surface teal to abyss navy, so scrolling is diving; a depth gauge on the side reads "0m … 40m" instead of a scroll bar, and each section is a depth: the tracks at 10m, speakers at 20m, passes at 30m. Light rays at the top fade out by the second screen. The pass is a dive tag.

**Palette.**
Light: bg `#E4F6F5` (the shallows), text `#06303A`, muted `#3F6B72`, accent `#FF9900`, teal `#0B7A8A`, focus `#0B7A8A` (4.51:1).
Dark: bg `#04222F` (deep), text `#DDF5F7`, muted `#83B4BC`, accent `#FF9900`, teal `#3FD5DD`, focus `#3FD5DD` (9.23:1).
Orange is the coral, the one fish, the buoy of the CTA. Razorpay `theme.color`: `#0B7A8A`.

**Type.** **Sora** for display, round and soft like something seen through water. **DM Mono** for the depth gauge and data.

**Motion language.** Drift. Rays sway on a 7s ease (transform). Kelp sways ±3° on a 5s ease. Bubbles rise as **one tiled layer** translating upward (the rule: never individual bubbles). Under reduced motion the water is still and the rays are fixed.

**How the hero works.** Surface light: CSS gradient plus four god-ray elements (skewed gradient bands, transform only). Two generated alpha layers, coral (warm) and kelp (green), on two-speed parallax. One bubble tile (a 256×512 transparent WebP with a dozen bubbles) as a repeating background on one element translating up on a 12s loop. Headline in Sora 700 at 11vw set as if seen from below the surface, with a subtle second copy offset 4px in teal at 30% (one extra element, no filter). Countdown: "Dive in 39 days". Measured pattern: **reef with layers and rays, p95 16.9ms, 1.9% over 32ms**; the same with 12 to 30 individually animated bubbles measured 33ms, which is why the bubbles are a tile.

**Empty states.** A sandy patch on the sea floor with a small flag: "Nothing here yet, come back at low tide". Or plainer: "Announced soon" on a dive slate.

**THE ASSET BUDGET.**

| Asset | How made | Format | Mobile size | KB | Desktop size | KB |
|---|---|---|---|---|---|---|
| Water depth gradient | CSS | none | | 0 | | 0 |
| God rays | CSS gradients | none | | 0 | | 0 |
| Coral | generated | WebP alpha | 900×1400 | 235 | 1600×1000 | 280 |
| Kelp | generated | WebP alpha | 900×1400 | 188 | 1600×1000 | 230 |
| Bubble tile | hand SVG rendered to WebP | WebP alpha | 256×512 | 8 | 256×512 | 8 |
| One fish | hand SVG | SVG | | 2 | | 2 |
| Sea floor (footer) | generated, smooth | WebP opaque | 900×500 | 45 | 1600×400 | 60 |
| Fonts, Sora + DM Mono | next/font | woff2 | | ~80 | | ~80 |
| **Images total** | | | | **478** | | **580** |
| **Mobile total** | | | | **744KB** | | |

Under the ceiling by 792KB. Measured: 16.9ms with the bubbles tiled. **Fits.**

**Stress test.** Story: light rays over turquoise, a headline, one orange fish. Passes. Poster: an underwater poster is a strong genre. Passes. Badge: a dive tag, plastic-looking, the QR as the tag's panel. Passes.

**Why it might be wrong.** There is no reason for a cloud computing event in a landlocked city to be underwater, and every "why the ocean?" answer is a stretch.

---

## 5. Canopy

**The pitch.** Inside a forest. Leaves in front of you and behind you, dappled light coming through, mist lower down, the ground when you reach the footer. You move through the undergrowth as you scroll and the headline is glimpsed between leaves. It is the Hack the North idea done with twelve images instead of twelve hundred.

**The signature move.** Leaves part. Three leaf layers move at three speeds as you scroll, so the front layer slides away from the headline and the back layer follows slower, which reads as walking forward. Dappled light (a soft gradient tile) drifts across everything.

**Palette.**
Light: bg `#EEF3E2` (morning light through leaves), text `#142013`, muted `#4E6047`, accent `#FF9900`, leaf `#2F6B3A`, focus `#2F6B3A` (5.65:1).
Dark: bg `#0B140D` (night forest), text `#E8F1E2`, muted `#92A78E`, accent `#FF9900`, leaf `#7FD08A`, focus `#7FD08A` (10.08:1).
Orange is a flower, a fruit, the CTA, the one bright thing in green. Razorpay `theme.color`: `#2F6B3A`.

**Type.** **Fraunces** for display, because its heavy weights have a living, slightly wonky quality that suits growth. **Public Sans** for body, so the reading text stays plain in a busy world.

**Motion language.** Parallax on scroll, sway on time. Twelve SVG leaves in the foreground sway ±6° on a 4s ease (that is within the measured safe count). The light tile drifts on a 20s transform loop. Nothing bounces. Under reduced motion the layers stack still and the leaves are fixed.

**How the hero works.** Three generated alpha layers (back, mid, front) on transform parallax, the front one pre-blurred in the image so there is no live filter. Headline in Fraunces 800 at 11vw between the mid and front layers, so leaves cross it. A dappled-light tile as a repeating background on one element with `mix-blend-mode: soft-light`, drifting. Countdown on a wooden signpost SVG: "The clearing opens in 39 days". Measured pattern: **canopy, 3 layers and 12 leaves, p95 16.8ms, 1.5% over 32ms**; the 4-layer and 6-layer stress variants also 16.8ms.

**Empty states.** A clearing with a signpost and no names carved on it yet: "Names will be carved here". Woods have clearings.

**THE ASSET BUDGET.**

| Asset | How made | Format | Mobile size | KB | Desktop size | KB |
|---|---|---|---|---|---|---|
| Sky and mist | CSS gradients | none | | 0 | | 0 |
| Leaves, back | generated | WebP alpha | 900×1400 | 185 | 1600×1000 | 240 |
| Leaves, mid | generated | WebP alpha | 900×1400 | 290 | 1600×1000 | 300 |
| Leaves, front (pre-blurred) | generated | WebP alpha | 900×1400 | 215 | 1600×1000 | 260 |
| Dappled light tile | generated, smooth | WebP opaque | 512×512 | 20 | 512×512 | 20 |
| Foreground leaves, 3 shapes | hand SVG | SVG | | 3 | | 3 |
| Forest floor (footer) | generated | WebP opaque | 900×600 | 50 | 1600×500 | 70 |
| Signpost | hand SVG | SVG | | 2 | | 2 |
| Fonts, Fraunces + Public Sans | next/font | woff2 | | ~130 | | ~130 |
| **Images total** | | | | **765** | | **895** |
| **Mobile total** | | | | **1,081KB** | | |

Under the ceiling by 455KB, the heaviest of the ten, with the measured worst-case layer sizes. AVIF would bring the layers to about 500KB. Measured: 16.8ms. **Fits, with the least margin.**

**Stress test.** Story: leaves parting around a headline in portrait. Passes. Poster: a forest poster. Passes. Badge: a leaf-shaped badge with the QR in the middle. Passes.

**Why it might be wrong.** It is the closest to Hack the North in spirit and will be compared to it, and green-on-green needs the orange to work harder than any other world here.

---

## 6. Rooftop

**The pitch.** A rooftop in the city at dusk. The skyline below you, the sky going from apricot to deep blue as you scroll, the first stars, a satellite crossing. It is the night sky without leaving the ground, which is how it stays out of Gravitas's purple space: there is a horizon, there are buildings, there is warmth.

**The signature move.** Dusk to night on scroll: the sky crossfades between an evening gradient and a night gradient across the page, stars fade in (one tiled star layer, one opacity animation), the skyline's windows light up (an SVG with a second colour), and one satellite crosses the whole width every 28 seconds. The countdown is "39 nights".

**Palette.**
Light: bg `#F5F2EC` (the roof at five in the afternoon), text `#1A1B22`, muted `#5E606A`, accent `#FF9900`, dusk `#C2553E`, focus `#2F3B8F` (8.77:1).
Dark: bg `#070A14`, text `#EEF1FA`, muted `#8F97AD`, accent `#FF9900`, dusk `#FF8A65`, focus `#FFB84D` (11.50:1).
Orange is the last band of sunset on the horizon, the lit windows, the CTA. Razorpay `theme.color`: `#2F3B8F`.

**Type.** **Instrument Serif** for display, a narrow, elegant serif that suits a quiet evening, and **Instrument Sans** for body, the same designer's sans so the two sit together without effort.

**Motion language.** Slow crossfade on scroll, one satellite on a long transform loop, one star layer pulsing. Nothing else. Under reduced motion it is fixed at blue hour and the satellite is parked.

**How the hero works.** Two sky gradient layers (dusk, night), the dusk one's opacity on the scroll timeline. One generated cloud layer on slow parallax. Skyline as one SVG path with a second path for lit windows in orange. Stars as **one tiled background** (the measured 200-star tile) fading in. Headline in Instrument Serif 400 at 12vw, letter-spaced tight, low on the screen against the horizon glow. Countdown in Instrument Sans small caps: "39 nights". Measured pattern: **rooftop, p95 17.0ms, 4.3% over 32ms** with 60 individual stars; with the star tile it drops to the baseline 16.8ms.

**Empty states.** A dark window in the skyline with "Lights on soon" beneath it. Buildings have dark windows.

**THE ASSET BUDGET.**

| Asset | How made | Format | Mobile size | KB | Desktop size | KB |
|---|---|---|---|---|---|---|
| Sky, dusk and night | CSS gradients | none | | 0 | | 0 |
| Clouds | generated, soft | WebP alpha | 900×700 | 90 | 1600×600 | 120 |
| Skyline with lit windows | hand SVG, two paths | SVG | | 5 | | 5 |
| Star tile | hand SVG rendered | WebP alpha | 256×256 | 3 | 256×256 | 3 |
| Satellite | CSS | none | | 0 | | 0 |
| Rooftop edge (foreground parapet) | hand SVG | SVG | | 2 | | 2 |
| Fonts, Instrument Serif + Instrument Sans | next/font | woff2 | | ~70 | | ~70 |
| **Images total** | | | | **100** | | **130** |
| **Mobile total** | | | | **356KB** | | |

Under the ceiling by 1.18MB. Measured: 16.8 to 17.0ms. **Fits.**

**Stress test.** Story: a skyline under a dusk sky in portrait. Passes. Poster: a skyline poster. Passes. Badge: a small skyline with the QR as a rooftop billboard. Passes.

**Why it might be wrong.** It is the quietest world here and the nearest to Orbit and to Gravitas's night; if the skyline is too generic it is any city, and if it is too specific it is a tourism poster.

---

## 7. Stadium

**The pitch.** A floodlit stadium at night. Stands rising on both sides, a crowd, floodlights sweeping, the stage where the pitch would be. The countdown is the scoreboard, the schedule is the fixture list, the pass is a season ticket with a seat. It is the loudest, most physical energy in either round.

**The signature move.** Floodlights sweep across the headline (two rotating gradient cones, transform only), and the crowd's phone lights blink in the stands (one tiled layer with a stepped opacity pulse, never individual dots: 200 individual dots measured 66ms). The scoreboard counts down in big stadium digits.

**Palette.**
Light: bg `#F1F4F7` (day match), text `#0D1B2A`, muted `#4E5D6C`, accent `#FF9900`, pitch `#1E7A3C`, focus `#0D1B2A` (15.76:1).
Dark: bg `#05070D` (floodlit night), text `#F2F6FA`, muted `#97A3B0`, accent `#FF9900`, pitch `#3ED37A`, focus `#3ED37A` (10.36:1).
Orange is the scoreboard digits, the team stripe, the CTA. Razorpay `theme.color`: `#0D1B2A`.

**Type.** **Big Shoulders Display** for display, condensed and tall like stadium lettering and shirt numbers. **Public Sans** for body.

**Motion language.** Sweep and flicker. Cones rotate ±25° on an 8s ease. The crowd tile pulses in steps. Scoreboard digits flip (a `transform: rotateX` on a two-face element, once per change). Nothing else. Under reduced motion the lights are fixed and the crowd is still.

**How the hero works.** Two generated alpha layers (stands, crowd) on parallax. Two floodlight cones from the top corners (conic gradients, transform rotate). Crowd phone lights as one tiled layer. Headline in Big Shoulders 900 at 14vw across the "pitch". Scoreboard block in orange digits: "39 DAYS 11 HRS". Measured pattern: **stadium with 24 individual dots, p95 17.0ms, 3.7% over 32ms**; with the crowd baked to a tile it is the baseline.

**Empty states.** An empty stand with "Seats filling" and a stadium announcer's line for speakers: "Line-up to be announced". Stadiums are half empty until kickoff and nobody thinks that is broken.

**THE ASSET BUDGET.**

| Asset | How made | Format | Mobile size | KB | Desktop size | KB |
|---|---|---|---|---|---|---|
| Night sky and pitch | CSS gradients | none | | 0 | | 0 |
| Stands | generated, structured silhouettes | WebP alpha | 900×1400 | 190 | 1600×1000 | 240 |
| Crowd | generated, soft silhouettes | WebP alpha | 900×700 | 140 | 1600×500 | 160 |
| Phone-light tile | hand SVG rendered | WebP alpha | 256×256 | 3 | 256×256 | 3 |
| Floodlight cones | CSS conic gradients | none | | 0 | | 0 |
| Scoreboard frame | hand SVG | SVG | | 3 | | 3 |
| Fonts, Big Shoulders + Public Sans | next/font | woff2 | | ~85 | | ~85 |
| **Images total** | | | | **336** | | **406** |
| **Mobile total** | | | | **607KB** | | |

Under the ceiling by 929KB. Measured: 17.0ms with 24 dots, baseline with the tile. **Fits.**

**Stress test.** Story: floodlights over a headline. Passes. Poster: a match-day poster. Passes, loudly. Badge: a season ticket with a seat number, tier as the stand, the QR as the turnstile code. Passes, and it is a very good badge.

**Why it might be wrong.** A stadium is a sports metaphor for a room of people listening to talks, and the energy it promises is one the actual day may not deliver.

---

## 8. Workshop

**The pitch.** An engineer's workbench. Plywood and pegboard, tools on hooks, a lamp, sawdust, half-built things. Everything on the site hangs on the board or sits on the bench; sections are shelves; the schedule is a wall of hooks. For an event whose host is the Student *Builders* Group, this is the room they actually mean.

**The signature move.** Things hang. Each section's items swing in on their hooks when they enter (rotate around the top, one overshoot), and an unfinished object on the bench is the empty state: a half-built thing with a label "Still being built" is the most honest "coming soon" in either round. The pass is a tool tag on a hook.

**Palette.**
Light: bg `#F3EBDD` (plywood in daylight), text `#1E1810`, muted `#6A5C4A`, accent `#FF9900`, steel `#3B4C5C`, focus `#3B4C5C` (7.47:1).
Dark: bg `#171310` (the shop at night, one lamp on), text `#F2E9DC`, muted `#A89C8B`, accent `#FF9900`, steel `#9DB4C8`, focus `#9DB4C8` (8.62:1).
Orange is the lamp light, the tool handles, the safety stripe on the CTA. Razorpay `theme.color`: `#3B4C5C`.

**Type.** **Archivo** for display, in its Black and Narrow cuts, because stencilled labels on a workshop wall are wide, heavy and plain. **Chivo Mono** for part numbers, times and the ticket ref.

**Motion language.** Swing and settle. Tools swing ±4° on a 3.6s ease continuously (14 on screen, within the safe count). Items swing in once on entry. The lamp does not move. Under reduced motion the tools hang still.

**How the hero works.** A pegboard tile (256×256, 2KB measured) as the wall, a plywood tile (512×512, 21KB measured) as the bench along the bottom 38%, a lamp as a CSS radial gradient top right with a darker vignette. Tools as hand-drawn SVGs on hooks around the headline. Headline in Archivo Black at 11vw, painted on the pegboard, with the orange safety stripe under it. Countdown on a shop clock: "39 days to open". Measured pattern: **workshop, p95 16.8ms, 2.4% over 32ms.**

**Empty states.** The half-built object on the bench with a paper label: "Still being built. Names go here when they are ready." A workshop is never finished; that is the point of it.

**THE ASSET BUDGET.**

| Asset | How made | Format | Mobile size | KB | Desktop size | KB |
|---|---|---|---|---|---|---|
| Pegboard tile | generated or drawn, tiled | WebP opaque | 256×256 | 2 | 256×256 | 2 |
| Plywood tile | generated, tiled | WebP opaque | 512×512 | 21 | 512×512 | 21 |
| Lamp and vignette | CSS gradients | none | | 0 | | 0 |
| Tools, 8 shapes | hand SVG | SVG | | 8 | | 8 |
| Half-built object (empty state) | hand SVG | SVG | | 4 | | 4 |
| Tool tag (pass) | hand SVG | SVG | | 2 | | 2 |
| Fonts, Archivo + Chivo Mono | next/font | woff2 | | ~90 | | ~90 |
| **Images total** | | | | **37** | | **37** |
| **Mobile total** | | | | **313KB** | | |

Under the ceiling by 1.22MB, the lightest world in the round. Measured: 16.8ms. **Fits.**

**Stress test.** Story: a pegboard with the headline and tools. Passes. Poster: a workshop wall poster. Passes. Badge: a tool tag with the QR, on a hook. Passes.

**Why it might be wrong.** Wood and tools can read as a hardware store rather than an engineering college, and it has nothing of Hyderabad in it.

---

## 9. Arcade

**The pitch.** A 90s arcade hall at night, not a pixel game. Neon tubes, a cabinet row in the dark, CRT scanlines, tokens. "INSERT COIN" is the CTA, the countdown is a high-score timer, the pass is a brass token. Loud, nostalgic and cheap to build, and it stays clear of Pune because there is no pixel art anywhere: it is neon and glass.

**The signature move.** The neon headline hums and flickers (text-shadow glow painted once, opacity keyframes for the flicker), and tapping "INSERT COIN" drops a token into the slot (one SVG token, one transform animation) to open the register page. The schedule is the cabinet row: each hall a cabinet, each session a screen.

**Palette.**
Light: bg `#F4F1F7` (the hall with the house lights on), text `#16101E`, muted `#5B546A`, accent `#FF9900`, neon cyan `#0A8FB0` (fills only), focus `#16101E` (16.66:1).
Dark: bg `#06040C`, text `#F5F0FA`, muted `#A297B3`, accent `#FF9900`, neon `#2BE0FF`, focus `#2BE0FF` (12.82:1).
Orange is the second neon colour and the token. Razorpay `theme.color`: `#16101E`.

**Type.** **Bungee** for display, a chunky signage face built for lit letters. **Space Grotesk** for body.

**Motion language.** Flicker and hum. The headline flickers on a 4s stepped keyframe. Six neon tube SVGs hum (opacity 0.85 to 1, 2.5s). The cabinet screens glow (static). Under reduced motion everything is lit and steady.

**How the hero works.** One generated alpha layer of cabinet silhouettes with lit screens, static. Six hand-drawn SVG neon tubes with a blur-glow filter (measured free on the CPU; the GPU cost of six small blurred elements is low). Headline in Bungee at 13vw with a two-colour text-shadow glow in orange and cyan. A scanline overlay (repeating gradient, static). CTA: "INSERT COIN", with the token SVG. Countdown as a high-score timer in Space Grotesk tabular figures. Measured pattern: **arcade, p95 16.8ms, 0.9% over 32ms.**

**Empty states.** A cabinet in attract mode with "HIGH SCORES" and empty rows of dashes, and a "COMING SOON" marquee for speakers. Arcades are full of attract screens.

**THE ASSET BUDGET.**

| Asset | How made | Format | Mobile size | KB | Desktop size | KB |
|---|---|---|---|---|---|---|
| Room gradient | CSS | none | | 0 | | 0 |
| Cabinet row | generated, silhouettes with lit screens | WebP alpha | 900×1400 | 275 | 1600×1000 | 300 |
| Neon tubes, 6 | hand SVG | SVG | | 4 | | 4 |
| Scanlines | CSS repeating gradient | none | | 0 | | 0 |
| Token | hand SVG | SVG | | 2 | | 2 |
| Fonts, Bungee + Space Grotesk | next/font | woff2 | | ~75 | | ~75 |
| **Images total** | | | | **281** | | **306** |
| **Mobile total** | | | | **542KB** | | |

Under the ceiling by 994KB. Measured: 16.8ms. **Fits.**

**Stress test.** Story: a neon headline in the dark. Passes. Poster: neon on black is a poster. Passes. Badge: a brass token with the QR stamped in. Passes, and it is the best badge of the round.

**Why it might be wrong.** Neon-and-CRT nostalgia is a look from before this audience was born and it is adjacent enough to Pune's retro-game world that a student who saw both would put them in the same family.

---

## 10. Cavern

**The pitch.** A cave. Rock walls, darkness, one lamp that lights the area around you, orange crystals glowing in the walls. As you scroll, the lamp reveals the next section; what is far from the light is dim. It is the most atmospheric world of the ten and the least like anything a conference has ever done.

**The signature move.** The lamp. A full-screen darkness layer with a soft hole in it moves with the pointer on desktop and drifts slowly on a phone (one element, transform only), so the page is lit where you look. Crystals pulse in the walls; the "recommended" tier is the brightest crystal. The pass is a lit crystal on a cord.

**Palette.**
Light: bg `#EFE9E0` (limestone in daylight, the cave mouth), text `#1C1712`, muted `#625849`, accent `#FF9900`, mineral `#6B3F1E`, focus `#6B3F1E` (7.39:1).
Dark: bg `#0B0906`, text `#F1E8DA`, muted `#A3937F`, accent `#FF9900`, mineral `#FFB84D`, focus `#FFB84D` (11.57:1).
Orange is the crystal light and the lamp. Razorpay `theme.color`: `#6B3F1E`.

**Type.** **Newsreader** for display, a serif with weight and a little age, like something carved. **Geist Mono** for labels.

**Motion language.** The lamp drifts (9s ease, transform). Crystals pulse (8 on screen, opacity, within the safe count). Nothing else. Under reduced motion the lamp is centred and fixed, which also means the whole hero is lit.

**How the hero works.** One opaque rock layer, one alpha front-rock layer on slow parallax, eight crystal SVGs, the lamp as a `radial-gradient` darkness layer sized 200% and moved with transform. Headline in Newsreader 600 at 10vw, lit by the lamp. Countdown as a chalk mark on the wall: "39 days to daylight". Measured pattern: **cavern, p95 16.9ms, 4.0% over 32ms**, the second-highest drop rate in the round because the darkness layer is four times the viewport.

**Empty states.** An unlit alcove with "Not lit yet". A cave has more alcoves than lamps.

**THE ASSET BUDGET.**

| Asset | How made | Format | Mobile size | KB | Desktop size | KB |
|---|---|---|---|---|---|---|
| Rock wall | generated, opaque, low detail | WebP opaque | 900×1400 | 160 | 1600×1000 | 200 |
| Rock, front | generated | WebP alpha | 900×1400 | 215 | 1600×1000 | 250 |
| Crystals, 3 shapes | hand SVG | SVG | | 3 | | 3 |
| Lamp darkness | CSS radial gradient | none | | 0 | | 0 |
| Cave mouth (light mode hero) | generated, opaque | WebP opaque | 900×900 | 60 | 1600×800 | 80 |
| Fonts, Newsreader + Geist Mono | next/font | woff2 | | ~95 | | ~95 |
| **Images total** | | | | **438** | | **533** |
| **Mobile total** | | | | **719KB** | | |

Under the ceiling by 817KB. Measured: 16.9ms. **Fits the budget.** It fails something else, below.

**Stress test.** Story: a lit crystal in the dark. Passes. Poster: a dark poster with one lit area. Passes but prints badly in a bright corridor. Badge: a crystal on a cord. Passes.

**Why it might be wrong.** A world that hides content by design is the wrong world for a page that has to be read on a phone in Hyderabad sun, and the pass page (bright, high contrast, at a gate) is the one place the lamp cannot go, so the site's most important object would have to leave the world.

---

## Ranking

Same judgement as before: the two-second hit on a mid-range phone, how it survives six weeks of empty content, poster, story and badge, the measured budget, and whether it is ours.

| # | World | Two-second hit | Empty weeks | Print / story / badge | Mobile total | Measured p95 | Ours? | Rating |
|---|---|---|---|---|---|---|---|---|
| 1 | **Boulders** | strong | strong | all pass | 644KB | 16.8ms | yes, the landscape | build this |
| 2 | **Night Market** | strongest | strong | all pass | 591KB | 16.8ms | yes, the bazaars | strong second |
| 3 | **Monsoon** | strong | strongest | all pass | 337KB | 16.8ms | yes, the season | strong third |
| 4 | Reef | strong | good | all pass | 744KB | 16.9ms | no | good |
| 5 | Stadium | strongest | good | all pass, best badge | 607KB | 17.0ms | no | good, loud |
| 6 | Canopy | good | good | all pass | 1,081KB | 16.8ms | no | good, heaviest |
| 7 | Rooftop | good | good | all pass | 356KB | 17.0ms | partly | fine, quiet |
| 8 | Workshop | good | strongest | all pass | 313KB | 16.8ms | the host's name | fine |
| 9 | Arcade | strong | good | all pass, great badge | 542KB | 16.8ms | no | fine, near Pune |
| 10 | Cavern | strong | ok | poster weak | 719KB | 16.9ms | no | do not |

### Why Boulders

Because it is the only world here that is Hyderabad without a monument, a bazaar or a filter. The granite boulders are what the city is physically made of; students have sat on them. It is cheap: three simple silhouette layers measured at 90 to 115KB each, and the sky, the sun and the time of day are gradients. The signature move is a genuine idea rather than an effect: **scrolling is the sun going down, and light and dark mode are noon and midnight**, so the theme toggle, the hero and the page rhythm are one system. On a poster it is a landscape at sunset; on a badge it is a silhouette with an orange sun; on a story it is portrait rock and sky. And it has a quietness that lets the type and the orange do the work, which the pass page needs.

### Why Night Market second

It is the most immediately delightful of the ten on a phone: warm, lit, alive, and the orange is the light rather than a decoration, which is the best use of the AWS colour in either round. The bulbs and strings are SVG and CSS; the two generated layers measured under 500KB together. It is second because the "Hyderabad bazaar at night" image is the city's most-used postcard after the Charminar and it can tip into the tourism-board look Vedant already rejected once, and because its light mode is a lesser version of itself.

### Why Monsoon third

The state change is the best single idea in either round: the sky clears the day registration opens, and until then the countdown is a forecast. It is the lightest world with a real signature (337KB total), it is Hyderabad's most talked-about season, and it is nothing like any tech event. It is third because grey-blue and rain are a hard sell on a corridor poster and to a room of nineteen-year-olds who want the day to feel like a festival, and because the best moment happens once.

### What I would combine

Boulders and Monsoon share a sky system (gradient crossfades on scroll) and a skyline-or-ridge silhouette layer. A Boulders site whose hero rains until registration opens, then clears into golden hour, is one world with the best move from each, at Boulders' asset cost plus 45KB. If Vedant picks Boulders, I would build the sky so that Monsoon's state change is a flag away.

### What I would not build

Cavern, because a world that hides content is wrong for a phone in sunlight and wrong for the pass. Arcade, unless Vedant specifically wants the nostalgia, because it will be filed next to Pune's retro world. Canopy is buildable and measured, but it is the heaviest and the most likely to be called a Hack the North copy.

---

## What happens next

Nothing, until Vedant picks. The measurement harness (`scripts/research/worldbench.mjs`) is committed so that any world, or any change to one, can be re-measured in ten minutes before a line of it is built. When a direction is chosen the build order from the brief applies, and the first thing built is the world's layer stack with real generated assets, measured again at 4x on this page before anything else is styled.
