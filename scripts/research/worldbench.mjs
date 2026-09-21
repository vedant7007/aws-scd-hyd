/**
 * World-building benchmarks. Each variant builds one environment's rendering
 * pattern on top of our own landing page, from real decoded WebP layers that
 * are generated in-page at the target dimensions (organic blobs with alpha, so
 * decode, layer memory and overdraw are real), plus the CSS and SVG the world
 * needs. Then it scrolls at a CPU throttle and records frame timing, exactly
 * as bench.mjs does. It also reports the encoded byte size of every generated
 * layer, as a sanity check on the asset budgets in CONCEPTS-WORLDS.md.
 *
 *   node scripts/research/worldbench.mjs <outdir> <throttle> [only]
 */
import { chromium } from 'playwright-core'
import { writeFileSync } from 'node:fs'

const OUT = process.argv[2]
const THROTTLE = Number(process.argv[3] ?? 4)
const ONLY = process.argv[4]
const URL = 'http://localhost:3110/'
const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 6a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36'
const browser = await chromium.launch({ channel: 'chrome' })

// Shared helpers injected before every variant. They live on window.__w.
const HELPERS = () => {
  const w = (window.__w = {})
  w.M = { width: 900, height: 1400 }
  w.sizes = []
  // Organic "painted" layer: many soft blobs of varying hue with alpha, plus a
  // little noise so WebP cannot cheat. Returns an object URL and records bytes.
  w.layer = async ({ width, height, blobs = 40, hue = 120, spread = 40, alpha = true, quality = 0.75, noise = 0.06, name }) => {
    const c = document.createElement('canvas'); c.width = width; c.height = height
    const x = c.getContext('2d')
    if (!alpha) { x.fillStyle = `hsl(${hue},40%,20%)`; x.fillRect(0, 0, width, height) }
    for (let i = 0; i < blobs; i++) {
      const r = (0.08 + Math.random() * 0.25) * Math.min(width, height)
      const g = x.createRadialGradient(0, 0, 0, 0, 0, r)
      const h = hue + (Math.random() - 0.5) * spread
      g.addColorStop(0, `hsla(${h},55%,${30 + Math.random() * 30}%,0.95)`)
      g.addColorStop(0.7, `hsla(${h},55%,${25 + Math.random() * 20}%,0.6)`)
      g.addColorStop(1, `hsla(${h},55%,20%,0)`)
      x.save(); x.translate(Math.random() * width, Math.random() * height); x.rotate(Math.random() * 6.28); x.scale(1, 0.4 + Math.random())
      x.fillStyle = g; x.beginPath(); x.arc(0, 0, r, 0, 6.28); x.fill(); x.restore()
    }
    if (noise > 0) {
      const id = x.getImageData(0, 0, width, height); const d = id.data
      for (let i = 0; i < d.length; i += 4) { if (d[i + 3] > 0) { const n = (Math.random() - 0.5) * 255 * noise; d[i] += n; d[i + 1] += n; d[i + 2] += n } }
      x.putImageData(id, 0, 0)
    }
    const blob = await new Promise((res) => c.toBlob(res, 'image/webp', quality))
    w.sizes.push({ name, width, height, alpha, kb: Math.round(blob.size / 1024) })
    const bmp = await createImageBitmap(blob) // force decode now, like a preloaded hero asset
    bmp.close()
    return URL.createObjectURL(blob)
  }
  w.img = (src, style) => { const i = document.createElement('img'); i.src = src; i.decoding = 'sync'; i.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none;' + style; return i }
  w.style = (css) => { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s) }
  // A full-viewport "world stage" placed above the page content; the page still scrolls under it.
  w.stage = (css = '') => { const d = document.createElement('div'); d.className = 'wstage'; d.style.cssText = 'position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden;' + css; document.body.prepend(d); return d }
  w.props = (n, svg, cls) => { const total = document.documentElement.scrollHeight; for (let i = 0; i < n; i++) { const d = document.createElement('div'); d.className = cls; d.innerHTML = svg; d.style.cssText = `position:absolute;left:${Math.random() * 90}%;top:${Math.random() * total}px;width:${40 + Math.random() * 80}px;animation-delay:${-Math.random() * 6}s;pointer-events:none`; document.body.appendChild(d) } }
  w.wait = (ms) => new Promise((r) => setTimeout(r, ms))
}

// Layers are generated at the mobile crop the concepts specify (900x1400),
// set as window.__w.M inside HELPERS since the variants run in the page.

const VARIANTS = {
  baseline: async () => {},

  'canopy: 3 alpha leaf layers (blur baked in), parallax on scroll-timeline, dappled gradient, 12 swaying SVG leaves': async () => {
    const w = window.__w; const M = w.M
    w.style('.wstage .lyr{will-change:transform;animation:par linear both;animation-timeline:scroll()} @keyframes par{to{transform:translate3d(0,var(--d),0)}} .leaf{animation:sway 4s ease-in-out infinite alternate} @keyframes sway{from{transform:rotate(-6deg)}to{transform:rotate(6deg)}}')
    const s = w.stage('background:linear-gradient(180deg,#dfe9c9 0%,#9fb87a 40%,#3e5a2f 100%)')
    const back = await w.layer({ ...M, blobs: 60, hue: 110, spread: 30, quality: 0.72, name: 'canopy-back' })
    const mid = await w.layer({ ...M, blobs: 40, hue: 120, spread: 30, quality: 0.75, name: 'canopy-mid' })
    const front = await w.layer({ ...M, blobs: 18, hue: 130, spread: 25, quality: 0.7, name: 'canopy-front' })
    s.appendChild(w.img(back, 'opacity:.9;--d:-120px')).classList.add('lyr')
    s.appendChild(w.img(mid, 'opacity:.95;--d:-260px')).classList.add('lyr')
    s.appendChild(w.img(front, '--d:-420px')).classList.add('lyr')
    w.props(12, '<svg viewBox="0 0 40 60"><path d="M20 2C5 20 5 40 20 58C35 40 35 20 20 2Z" fill="#2f6b3a"/></svg>', 'leaf')
  },

  'reef: teal depth gradient per section, 2 alpha layers, god rays (skewed gradient bands, transform), 30 rising bubbles': async () => {
    const w = window.__w; const M = w.M
    w.style('.ray{position:absolute;top:-20%;height:140%;width:14%;background:linear-gradient(180deg,rgba(255,255,255,.35),rgba(255,255,255,0) 70%);transform:skewX(-14deg);animation:ray 7s ease-in-out infinite alternate;will-change:transform} @keyframes ray{to{transform:skewX(-10deg) translate3d(40px,0,0)}} .bub{border-radius:50%;background:radial-gradient(circle at 35% 35%,rgba(255,255,255,.8),rgba(255,255,255,.15) 60%,transparent 70%);animation:rise 9s linear infinite} @keyframes rise{to{transform:translate3d(20px,-140vh,0)}} .wstage .lyr{will-change:transform;animation:par linear both;animation-timeline:scroll()} @keyframes par{to{transform:translate3d(0,var(--d),0)}}')
    const s = w.stage('background:linear-gradient(180deg,#5fd3d6 0%,#1a8f9c 35%,#0b4c62 70%,#04222f 100%)')
    for (let i = 0; i < 4; i++) { const r = document.createElement('div'); r.className = 'ray'; r.style.left = (10 + i * 22) + '%'; r.style.animationDelay = (-i * 2) + 's'; s.appendChild(r) }
    const coral = await w.layer({ ...M, blobs: 30, hue: 15, spread: 40, quality: 0.75, name: 'reef-coral' })
    const kelp = await w.layer({ ...M, blobs: 25, hue: 150, spread: 30, quality: 0.72, name: 'reef-kelp' })
    s.appendChild(w.img(coral, 'opacity:.9;--d:-200px')).classList.add('lyr')
    s.appendChild(w.img(kelp, 'opacity:.8;--d:-360px')).classList.add('lyr')
    w.props(30, '', 'bub')
  },

  'dune: sky gradient crossfade (2 layers, opacity on scroll-timeline), 3 ridge layers, sun translating, heat shimmer off': async () => {
    const w = window.__w; const M = w.M
    w.style('.sky{position:absolute;inset:0;will-change:opacity;animation:fade linear both;animation-timeline:scroll()} @keyframes fade{to{opacity:0}} .wstage .lyr{will-change:transform;animation:par linear both;animation-timeline:scroll()} @keyframes par{to{transform:translate3d(0,var(--d),0)}} .sun{position:absolute;left:60%;top:18%;width:22vw;height:22vw;border-radius:50%;background:radial-gradient(circle,#ffb347,#ff9900 60%,rgba(255,153,0,0) 72%);will-change:transform;animation:set linear both;animation-timeline:scroll()} @keyframes set{to{transform:translate3d(-30vw,60vh,0)}}')
    const s = w.stage('background:#1a1230')
    const day = document.createElement('div'); day.className = 'sky'; day.style.background = 'linear-gradient(180deg,#ffe3b0,#ffb46b 50%,#e8894a)'; s.appendChild(day)
    const sun = document.createElement('div'); sun.className = 'sun'; s.appendChild(sun)
    for (const [i, hue] of [[0, 30], [1, 25], [2, 20]]) { const src = await w.layer({ ...M, blobs: 8, hue, spread: 10, quality: 0.75, noise: 0.03, name: 'dune-ridge-' + i }); s.appendChild(w.img(src, `--d:${-80 * (i + 1)}px`)).classList.add('lyr') }
  },

  'monsoon: 3 rain layers (repeating-linear-gradient, translate keyframes), skyline SVG silhouette, wet-ground reflection layer (transform scaleY)': async () => {
    const w = window.__w; const M = w.M
    w.style('.rain{position:absolute;inset:-20% 0;background:repeating-linear-gradient(100deg,transparent 0 22px,rgba(210,225,240,.28) 22px 23px,transparent 23px 60px);will-change:transform;animation:rain linear infinite} @keyframes rain{to{transform:translate3d(-60px,120px,0)}} .refl{position:absolute;left:0;right:0;bottom:0;height:35%;transform:scaleY(-1);opacity:.35;filter:blur(3px);will-change:transform;animation:wob 3s ease-in-out infinite alternate} @keyframes wob{to{transform:scaleY(-1) translate3d(0,4px,0)}}')
    const s = w.stage('background:linear-gradient(180deg,#2a3340 0%,#3d4756 55%,#1b2028 100%)')
    const sky = await w.layer({ ...M, blobs: 20, hue: 215, spread: 20, quality: 0.7, alpha: false, name: 'monsoon-clouds' })
    s.appendChild(w.img(sky, 'opacity:.6'))
    const sil = document.createElement('div'); sil.innerHTML = `<svg viewBox="0 0 900 300" preserveAspectRatio="none" style="position:absolute;left:0;right:0;bottom:30%;width:100%;height:30%"><path d="M0 300V180h40v-60h30v60h50V90h20v90h60v-40h40v40h30V60h50v120h60v-70h30v70h80V120h40v60h60v-90h30v90h70v-50h30v50h60V300Z" fill="#0f141b"/></svg>`; s.appendChild(sil)
    const ground = await w.layer({ ...M, blobs: 25, hue: 30, spread: 60, quality: 0.7, alpha: false, name: 'monsoon-wet-ground' })
    const g = w.img(ground, ''); g.className = 'refl'; s.appendChild(g)
    for (const [i, d] of [[0, 1.1], [1, 1.7], [2, 2.6]].entries()) { const r = document.createElement('div'); r.className = 'rain'; r.style.animationDuration = d + 's'; r.style.opacity = String(0.9 - i * 0.25); r.style.backgroundSize = `${60 + i * 30}px ${60 + i * 30}px`; s.appendChild(r) }
  },

  'night market: 40 SVG bulbs on 3 swaying strings (rotate transform), CSS glow via box-shadow (paint once), 2 stall layers': async () => {
    const w = window.__w; const M = w.M
    w.style('.string{position:absolute;left:-5%;right:-5%;height:40px;transform-origin:50% 0;animation:sway 5s ease-in-out infinite alternate;will-change:transform} @keyframes sway{from{transform:rotate(-1.2deg)}to{transform:rotate(1.2deg)}} .bulb{position:absolute;top:18px;width:14px;height:20px;border-radius:50% 50% 45% 45%;background:#ffd27a;box-shadow:0 0 18px 6px rgba(255,170,60,.55)} .wstage .lyr{will-change:transform;animation:par linear both;animation-timeline:scroll()} @keyframes par{to{transform:translate3d(0,var(--d),0)}}')
    const s = w.stage('background:linear-gradient(180deg,#120c14 0%,#2a1622 60%,#3d1f24 100%)')
    const stalls = await w.layer({ ...M, blobs: 40, hue: 20, spread: 40, quality: 0.75, name: 'market-stalls' })
    const crowd = await w.layer({ ...M, blobs: 30, hue: 350, spread: 30, quality: 0.72, name: 'market-crowd' })
    s.appendChild(w.img(stalls, 'opacity:.9;--d:-150px')).classList.add('lyr')
    s.appendChild(w.img(crowd, 'opacity:.85;--d:-300px')).classList.add('lyr')
    for (let r = 0; r < 3; r++) { const st = document.createElement('div'); st.className = 'string'; st.style.top = (8 + r * 9) + '%'; st.style.animationDelay = (-r * 1.7) + 's'; st.style.borderTop = '2px solid #3a2a28'; for (let i = 0; i < 14; i++) { const b = document.createElement('div'); b.className = 'bulb'; b.style.left = (i * 7.5 + 2) + '%'; st.appendChild(b) } s.appendChild(st) }
  },

  'night market, glow via filter:drop-shadow on each bulb instead of box-shadow': async () => {
    const w = window.__w
    w.style('.string{position:absolute;left:-5%;right:-5%;height:40px;transform-origin:50% 0;animation:sway 5s ease-in-out infinite alternate;will-change:transform} @keyframes sway{from{transform:rotate(-1.2deg)}to{transform:rotate(1.2deg)}} .bulb{position:absolute;top:18px;width:14px;height:20px;border-radius:50% 50% 45% 45%;background:#ffd27a;filter:drop-shadow(0 0 10px rgba(255,170,60,.8))}')
    const s = w.stage('background:linear-gradient(180deg,#120c14 0%,#2a1622 60%,#3d1f24 100%)')
    for (let r = 0; r < 3; r++) { const st = document.createElement('div'); st.className = 'string'; st.style.top = (8 + r * 9) + '%'; st.style.animationDelay = (-r * 1.7) + 's'; for (let i = 0; i < 14; i++) { const b = document.createElement('div'); b.className = 'bulb'; b.style.left = (i * 7.5 + 2) + '%'; st.appendChild(b) } s.appendChild(st) }
  },

  'cavern: 2 rock layers, lamp = full-screen radial-gradient darkness with a hole, moved by transform (pointer/drift), 8 glowing crystals': async () => {
    const w = window.__w; const M = w.M
    w.style('.lamp{position:absolute;inset:-50%;background:radial-gradient(circle at 50% 50%,rgba(0,0,0,0) 0,rgba(0,0,0,0) 120px,rgba(8,6,4,.55) 260px,rgba(8,6,4,.92) 520px);will-change:transform;animation:drift 9s ease-in-out infinite alternate} @keyframes drift{from{transform:translate3d(-12%,-8%,0)}to{transform:translate3d(12%,10%,0)}} .cry{background:linear-gradient(160deg,#ffb84d,#ff9900);clip-path:polygon(50% 0,100% 40%,80% 100%,20% 100%,0 40%);animation:pulse 3s ease-in-out infinite alternate} @keyframes pulse{from{opacity:.55}to{opacity:1}}')
    const s = w.stage('background:#0b0906')
    const rock = await w.layer({ ...M, blobs: 50, hue: 28, spread: 15, quality: 0.72, alpha: false, noise: 0.1, name: 'cavern-rock' })
    const rock2 = await w.layer({ ...M, blobs: 20, hue: 24, spread: 10, quality: 0.7, name: 'cavern-rock-front' })
    s.appendChild(w.img(rock, ''))
    s.appendChild(w.img(rock2, 'opacity:.9'))
    w.props(8, '', 'cry')
    const lamp = document.createElement('div'); lamp.className = 'lamp'; s.appendChild(lamp)
  },

  'stadium: stands + crowd layers, 2 rotating floodlight cones (conic-gradient, transform rotate), scoreboard DOM, 200 crowd dots blinking': async () => {
    const w = window.__w; const M = w.M
    w.style('.cone{position:absolute;top:-20%;width:60vw;height:120vh;left:20%;background:conic-gradient(from 0deg at 50% 0,rgba(255,240,200,0) 0deg,rgba(255,240,200,.28) 8deg,rgba(255,240,200,0) 16deg);transform-origin:50% 0;will-change:transform;animation:sweep 8s ease-in-out infinite alternate} @keyframes sweep{from{transform:rotate(-25deg)}to{transform:rotate(25deg)}} .fan{width:6px!important;height:6px;border-radius:50%;background:#fff;animation:blink 2.2s steps(2) infinite} @keyframes blink{50%{opacity:.15}} .wstage .lyr{will-change:transform;animation:par linear both;animation-timeline:scroll()} @keyframes par{to{transform:translate3d(0,var(--d),0)}}')
    const s = w.stage('background:linear-gradient(180deg,#05070d 0%,#0e1526 50%,#1b2a1e 100%)')
    const stands = await w.layer({ ...M, blobs: 60, hue: 220, spread: 20, quality: 0.72, name: 'stadium-stands' })
    const crowd = await w.layer({ ...M, blobs: 80, hue: 30, spread: 60, quality: 0.7, name: 'stadium-crowd' })
    s.appendChild(w.img(stands, 'opacity:.9;--d:-120px')).classList.add('lyr')
    s.appendChild(w.img(crowd, 'opacity:.85;--d:-240px')).classList.add('lyr')
    for (let i = 0; i < 2; i++) { const c = document.createElement('div'); c.className = 'cone'; c.style.left = i ? '55%' : '-15%'; c.style.animationDelay = i ? '-4s' : '0s'; s.appendChild(c) }
    w.props(200, '', 'fan')
  },

  'rooftop: CSS sky gradient dusk-to-night (opacity crossfade on scroll), skyline SVG, 1 cloud layer parallax, 60 CSS stars, 1 satellite dot': async () => {
    const w = window.__w; const M = w.M
    w.style('.sky{position:absolute;inset:0;will-change:opacity;animation:fade linear both;animation-timeline:scroll()} @keyframes fade{to{opacity:0}} .star{width:3px!important;height:3px;border-radius:50%;background:#fff;animation:tw 3s ease-in-out infinite alternate} @keyframes tw{from{opacity:.3}to{opacity:1}} .sat{position:absolute;top:22%;left:-2%;width:4px;height:4px;border-radius:50%;background:#ffd27a;box-shadow:0 0 6px 2px rgba(255,210,122,.6);animation:fly 28s linear infinite;will-change:transform} @keyframes fly{to{transform:translate3d(104vw,-12vh,0)}} .wstage .lyr{will-change:transform;animation:par linear both;animation-timeline:scroll()} @keyframes par{to{transform:translate3d(0,var(--d),0)}}')
    const s = w.stage('background:linear-gradient(180deg,#070a14 0%,#141a33 60%,#3a2a2e 100%)')
    const dusk = document.createElement('div'); dusk.className = 'sky'; dusk.style.background = 'linear-gradient(180deg,#5b6aa8 0%,#e4906a 60%,#ffc48a 100%)'; s.appendChild(dusk)
    const clouds = await w.layer({ ...M, blobs: 14, hue: 20, spread: 20, quality: 0.7, name: 'rooftop-clouds' })
    s.appendChild(w.img(clouds, 'opacity:.55;--d:-160px')).classList.add('lyr')
    const sil = document.createElement('div'); sil.innerHTML = `<svg viewBox="0 0 900 300" preserveAspectRatio="none" style="position:absolute;left:0;right:0;bottom:0;width:100%;height:32%"><path d="M0 300V200h30v-40h40v40h40V120h30v80h50v-60h30v60h60V80h40v120h50v-50h30v50h70V140h30v60h60v-90h40v90h60v-40h30v40h60V300Z" fill="#05060a"/></svg>`; s.appendChild(sil)
    w.props(60, '', 'star')
    const sat = document.createElement('div'); sat.className = 'sat'; s.appendChild(sat)
  },

  'workshop: tiled plywood + pegboard (2 small repeating textures), 14 SVG tools swinging on hooks (rotate), lamp gradient': async () => {
    const w = window.__w
    w.style('.tool{transform-origin:50% 0;animation:swing 3.6s ease-in-out infinite alternate} @keyframes swing{from{transform:rotate(-4deg)}to{transform:rotate(4deg)}}')
    const s = w.stage('')
    const ply = await w.layer({ width: 512, height: 512, blobs: 30, hue: 32, spread: 10, quality: 0.7, alpha: false, noise: 0.08, name: 'workshop-plywood-tile' })
    const peg = await w.layer({ width: 256, height: 256, blobs: 4, hue: 40, spread: 5, quality: 0.7, alpha: false, noise: 0.05, name: 'workshop-pegboard-tile' })
    s.style.background = `url(${peg}) repeat`; s.style.backgroundSize = '128px 128px'
    const bench = document.createElement('div'); bench.style.cssText = `position:absolute;left:0;right:0;bottom:0;height:38%;background:url(${ply}) repeat;background-size:256px 256px;box-shadow:0 -20px 40px rgba(0,0,0,.35)`; s.appendChild(bench)
    const lamp = document.createElement('div'); lamp.style.cssText = 'position:absolute;inset:0;background:radial-gradient(ellipse at 70% 10%,rgba(255,220,160,.35),rgba(0,0,0,0) 45%),linear-gradient(180deg,rgba(0,0,0,.25),rgba(0,0,0,.55))'; s.appendChild(lamp)
    w.props(14, '<svg viewBox="0 0 40 90"><rect x="17" y="0" width="6" height="55" fill="#8a6a3a"/><path d="M6 55h28l-4 30H10Z" fill="#c9c9c9"/></svg>', 'tool')
  },

  'arcade: neon headline (text-shadow, flicker opacity), 6 SVG neon tubes with blur glow filter, 1 cabinet-row layer, CRT scanline overlay (repeating gradient, static)': async () => {
    const w = window.__w; const M = w.M
    w.style('.neon{position:absolute;top:14%;left:6%;right:6%;text-align:center;font:900 13vw/1 system-ui;color:#fff7ea;text-shadow:0 0 6px #ff9900,0 0 18px #ff9900,0 0 40px rgba(255,153,0,.7);animation:flick 4s steps(1) infinite} @keyframes flick{0%,92%,100%{opacity:1}93%{opacity:.6}95%{opacity:1}97%{opacity:.75}} .tube{position:absolute;filter:blur(1.5px) drop-shadow(0 0 8px #2be0ff);animation:hum 2.5s ease-in-out infinite alternate} @keyframes hum{from{opacity:.85}to{opacity:1}} .scan{position:absolute;inset:0;background:repeating-linear-gradient(180deg,rgba(0,0,0,.18) 0 2px,transparent 2px 4px);pointer-events:none}')
    const s = w.stage('background:linear-gradient(180deg,#06040c 0%,#1a0a24 60%,#08060e 100%)')
    const cabs = await w.layer({ ...M, blobs: 40, hue: 280, spread: 60, quality: 0.72, name: 'arcade-cabinets' })
    s.appendChild(w.img(cabs, 'opacity:.85'))
    for (let i = 0; i < 6; i++) { const t = document.createElement('div'); t.className = 'tube'; t.style.cssText += `left:${5 + i * 15}%;top:${55 + (i % 3) * 8}%;width:12%`; t.innerHTML = '<svg viewBox="0 0 100 40"><path d="M5 30C20 5 40 5 50 20S80 35 95 10" fill="none" stroke="#2be0ff" stroke-width="4" stroke-linecap="round"/></svg>'; s.appendChild(t) }
    const n = document.createElement('div'); n.className = 'neon'; n.textContent = 'AWS SCD HYD'; s.appendChild(n)
    const sc = document.createElement('div'); sc.className = 'scan'; s.appendChild(sc)
  },

  'canopy variant: same 3 layers but the front one has a live filter:blur(2px)': async () => {
    const w = window.__w; const M = w.M
    w.style('.wstage .lyr{will-change:transform;animation:par linear both;animation-timeline:scroll()} @keyframes par{to{transform:translate3d(0,var(--d),0)}}')
    const s = w.stage('background:linear-gradient(180deg,#dfe9c9 0%,#9fb87a 40%,#3e5a2f 100%)')
    for (const [i, q] of [[0, 0.72], [1, 0.75], [2, 0.7]]) { const src = await w.layer({ ...M, blobs: 40, hue: 110 + i * 10, spread: 30, quality: q, name: 'canopy-blur-' + i }); s.appendChild(w.img(src, `${i === 2 ? 'filter:blur(2px);' : ''}--d:${-140 * (i + 1)}px`)).classList.add('lyr') }
  },

  'canopy variant: 4 alpha layers, no filters (the ceiling test for parallax worlds)': async () => {
    const w = window.__w; const M = w.M
    w.style('.wstage .lyr{will-change:transform;animation:par linear both;animation-timeline:scroll()} @keyframes par{to{transform:translate3d(0,var(--d),0)}}')
    const s = w.stage('background:linear-gradient(180deg,#dfe9c9 0%,#9fb87a 40%,#3e5a2f 100%)')
    for (let i = 0; i < 4; i++) { const src = await w.layer({ ...M, blobs: 40, hue: 110 + i * 8, spread: 30, quality: 0.72, name: 'canopy4-' + i }); s.appendChild(w.img(src, `opacity:.9;--d:${-110 * (i + 1)}px`)).classList.add('lyr') }
  },

  'size probe: the same 900x1400 alpha layer at noise 0 / 0.03 / 0.06 and quality 0.6 / 0.75 (no perf meaning)': async () => {
    const w = window.__w; const M = w.M
    for (const noise of [0, 0.03, 0.06]) for (const quality of [0.6, 0.75]) await w.layer({ ...M, blobs: 40, hue: 120, spread: 30, quality, noise, name: `probe-n${noise}-q${quality}` })
    await w.layer({ width: 720, height: 1120, blobs: 40, hue: 120, spread: 30, quality: 0.72, noise: 0.03, name: 'probe-720x1120-n0.03-q0.72' })
    await w.layer({ width: 1600, height: 1000, blobs: 40, hue: 120, spread: 30, quality: 0.72, noise: 0.03, name: 'probe-desktop-1600x1000-n0.03-q0.72' })
  },


  'props sweep: 12 small elements animating transform (translate loop)': async () => { const w = window.__w; w.style('.pt{width:14px!important;height:14px;border-radius:50%;background:#ff9900;animation:pt 6s linear infinite} @keyframes pt{to{transform:translate3d(20px,-120vh,0)}}'); w.props(12, '', 'pt') },
  'props sweep: 24 small elements animating transform': async () => { const w = window.__w; w.style('.pt{width:14px!important;height:14px;border-radius:50%;background:#ff9900;animation:pt 6s linear infinite} @keyframes pt{to{transform:translate3d(20px,-120vh,0)}}'); w.props(24, '', 'pt') },
  'props sweep: 48 small elements animating transform': async () => { const w = window.__w; w.style('.pt{width:14px!important;height:14px;border-radius:50%;background:#ff9900;animation:pt 6s linear infinite} @keyframes pt{to{transform:translate3d(20px,-120vh,0)}}'); w.props(48, '', 'pt') },
  'props sweep: 96 small elements animating transform': async () => { const w = window.__w; w.style('.pt{width:14px!important;height:14px;border-radius:50%;background:#ff9900;animation:pt 6s linear infinite} @keyframes pt{to{transform:translate3d(20px,-120vh,0)}}'); w.props(96, '', 'pt') },
  'props sweep: 24 small elements animating opacity (twinkle)': async () => { const w = window.__w; w.style('.po{width:6px!important;height:6px;border-radius:50%;background:#fff;animation:po 2.2s ease-in-out infinite alternate} @keyframes po{from{opacity:.2}}'); w.props(24, '', 'po') },
  'props sweep: 48 small elements animating opacity': async () => { const w = window.__w; w.style('.po{width:6px!important;height:6px;border-radius:50%;background:#fff;animation:po 2.2s ease-in-out infinite alternate} @keyframes po{from{opacity:.2}}'); w.props(48, '', 'po') },
  'props sweep: 96 small elements animating opacity': async () => { const w = window.__w; w.style('.po{width:6px!important;height:6px;border-radius:50%;background:#fff;animation:po 2.2s ease-in-out infinite alternate} @keyframes po{from{opacity:.2}}'); w.props(96, '', 'po') },
  'props sweep: 96 stars, opacity, but inside ONE fixed stage element (not spread over the document)': async () => { const w = window.__w; w.style('.ps{position:absolute;width:6px;height:6px;border-radius:50%;background:#fff;animation:po 2.2s ease-in-out infinite alternate} @keyframes po{from{opacity:.2}}'); const s = w.stage('background:#070a14'); for (let i = 0; i < 96; i++) { const d = document.createElement('div'); d.className = 'ps'; d.style.cssText += `left:${Math.random() * 100}%;top:${Math.random() * 100}%;animation-delay:${-Math.random() * 3}s`; s.appendChild(d) } },
  'props sweep: 200 stars as ONE tiled background-image (no per-element animation), stage opacity pulse': async () => { const w = window.__w; w.style('.st{position:absolute;inset:0;background:radial-gradient(circle,#fff 0 1px,transparent 1.5px) 0 0/90px 70px,radial-gradient(circle,#fff 0 1px,transparent 1.5px) 40px 30px/130px 110px;animation:po 3s ease-in-out infinite alternate} @keyframes po{from{opacity:.4}}'); const s = w.stage('background:#070a14'); const d = document.createElement('div'); d.className = 'st'; s.appendChild(d) },
  'stadium fixed: same layers and cones, 24 crowd dots instead of 200': async () => {
    const w = window.__w; const M = w.M
    w.style('.cone{position:absolute;top:-20%;width:60vw;height:120vh;left:20%;background:conic-gradient(from 0deg at 50% 0,rgba(255,240,200,0) 0deg,rgba(255,240,200,.28) 8deg,rgba(255,240,200,0) 16deg);transform-origin:50% 0;will-change:transform;animation:sweep 8s ease-in-out infinite alternate} @keyframes sweep{from{transform:rotate(-25deg)}to{transform:rotate(25deg)}} .fan{width:6px!important;height:6px;border-radius:50%;background:#fff;animation:blink 2.2s steps(2) infinite} @keyframes blink{50%{opacity:.15}} .wstage .lyr{will-change:transform;animation:par linear both;animation-timeline:scroll()} @keyframes par{to{transform:translate3d(0,var(--d),0)}}')
    const s = w.stage('background:linear-gradient(180deg,#05070d 0%,#0e1526 50%,#1b2a1e 100%)')
    const stands = await w.layer({ ...M, blobs: 60, hue: 220, spread: 20, quality: 0.72, name: 'stadium-stands' })
    const crowd = await w.layer({ ...M, blobs: 80, hue: 30, spread: 60, quality: 0.7, name: 'stadium-crowd' })
    s.appendChild(w.img(stands, 'opacity:.9;--d:-120px')).classList.add('lyr')
    s.appendChild(w.img(crowd, 'opacity:.85;--d:-240px')).classList.add('lyr')
    for (let i = 0; i < 2; i++) { const c = document.createElement('div'); c.className = 'cone'; c.style.left = i ? '55%' : '-15%'; c.style.animationDelay = i ? '-4s' : '0s'; s.appendChild(c) }
    w.props(24, '', 'fan')
  },
  'reef fixed: same layers and rays, 12 bubbles instead of 30': async () => {
    const w = window.__w; const M = w.M
    w.style('.ray{position:absolute;top:-20%;height:140%;width:14%;background:linear-gradient(180deg,rgba(255,255,255,.35),rgba(255,255,255,0) 70%);transform:skewX(-14deg);animation:ray 7s ease-in-out infinite alternate;will-change:transform} @keyframes ray{to{transform:skewX(-10deg) translate3d(40px,0,0)}} .bub{border-radius:50%;background:radial-gradient(circle at 35% 35%,rgba(255,255,255,.8),rgba(255,255,255,.15) 60%,transparent 70%);animation:rise 9s linear infinite} @keyframes rise{to{transform:translate3d(20px,-140vh,0)}} .wstage .lyr{will-change:transform;animation:par linear both;animation-timeline:scroll()} @keyframes par{to{transform:translate3d(0,var(--d),0)}}')
    const s = w.stage('background:linear-gradient(180deg,#5fd3d6 0%,#1a8f9c 35%,#0b4c62 70%,#04222f 100%)')
    for (let i = 0; i < 4; i++) { const r = document.createElement('div'); r.className = 'ray'; r.style.left = (10 + i * 22) + '%'; r.style.animationDelay = (-i * 2) + 's'; s.appendChild(r) }
    const coral = await w.layer({ ...M, blobs: 30, hue: 15, spread: 40, quality: 0.75, name: 'reef-coral' })
    const kelp = await w.layer({ ...M, blobs: 25, hue: 150, spread: 30, quality: 0.72, name: 'reef-kelp' })
    s.appendChild(w.img(coral, 'opacity:.9;--d:-200px')).classList.add('lyr')
    s.appendChild(w.img(kelp, 'opacity:.8;--d:-360px')).classList.add('lyr')
    w.props(12, '', 'bub')
  },


  'reef attribution: 2 layers only, no rays, no bubbles': async () => {
    const w = window.__w; const M = w.M
    w.style('.wstage .lyr{will-change:transform;animation:par linear both;animation-timeline:scroll()} @keyframes par{to{transform:translate3d(0,var(--d),0)}}')
    const s = w.stage('background:linear-gradient(180deg,#5fd3d6 0%,#1a8f9c 35%,#0b4c62 70%,#04222f 100%)')
    const coral = await w.layer({ ...M, blobs: 30, hue: 15, spread: 40, quality: 0.75, name: 'reef-coral' })
    const kelp = await w.layer({ ...M, blobs: 25, hue: 150, spread: 30, quality: 0.72, name: 'reef-kelp' })
    s.appendChild(w.img(coral, 'opacity:.9;--d:-200px')).classList.add('lyr')
    s.appendChild(w.img(kelp, 'opacity:.8;--d:-360px')).classList.add('lyr')
  },
  'reef attribution: 2 layers + 4 skewed god rays, no bubbles': async () => {
    const w = window.__w; const M = w.M
    w.style('.ray{position:absolute;top:-20%;height:140%;width:14%;background:linear-gradient(180deg,rgba(255,255,255,.35),rgba(255,255,255,0) 70%);transform:skewX(-14deg);animation:ray 7s ease-in-out infinite alternate;will-change:transform} @keyframes ray{to{transform:skewX(-10deg) translate3d(40px,0,0)}} .wstage .lyr{will-change:transform;animation:par linear both;animation-timeline:scroll()} @keyframes par{to{transform:translate3d(0,var(--d),0)}}')
    const s = w.stage('background:linear-gradient(180deg,#5fd3d6 0%,#1a8f9c 35%,#0b4c62 70%,#04222f 100%)')
    for (let i = 0; i < 4; i++) { const r = document.createElement('div'); r.className = 'ray'; r.style.left = (10 + i * 22) + '%'; r.style.animationDelay = (-i * 2) + 's'; s.appendChild(r) }
    const coral = await w.layer({ ...M, blobs: 30, hue: 15, spread: 40, quality: 0.75, name: 'reef-coral' })
    const kelp = await w.layer({ ...M, blobs: 25, hue: 150, spread: 30, quality: 0.72, name: 'reef-kelp' })
    s.appendChild(w.img(coral, 'opacity:.9;--d:-200px')).classList.add('lyr')
    s.appendChild(w.img(kelp, 'opacity:.8;--d:-360px')).classList.add('lyr')
  },
  'reef attribution: 2 layers + 4 rays that only translate (no skew in the keyframe)': async () => {
    const w = window.__w; const M = w.M
    w.style('.ray{position:absolute;top:-20%;height:140%;width:14%;background:linear-gradient(180deg,rgba(255,255,255,.35),rgba(255,255,255,0) 70%);transform:skewX(-14deg);animation:ray 7s ease-in-out infinite alternate;will-change:transform} @keyframes ray{to{transform:skewX(-14deg) translate3d(40px,0,0)}} .wstage .lyr{will-change:transform;animation:par linear both;animation-timeline:scroll()} @keyframes par{to{transform:translate3d(0,var(--d),0)}}')
    const s = w.stage('background:linear-gradient(180deg,#5fd3d6 0%,#1a8f9c 35%,#0b4c62 70%,#04222f 100%)')
    for (let i = 0; i < 4; i++) { const r = document.createElement('div'); r.className = 'ray'; r.style.left = (10 + i * 22) + '%'; r.style.animationDelay = (-i * 2) + 's'; s.appendChild(r) }
    const coral = await w.layer({ ...M, blobs: 30, hue: 15, spread: 40, quality: 0.75, name: 'reef-coral' })
    const kelp = await w.layer({ ...M, blobs: 25, hue: 150, spread: 30, quality: 0.72, name: 'reef-kelp' })
    s.appendChild(w.img(coral, 'opacity:.9;--d:-200px')).classList.add('lyr')
    s.appendChild(w.img(kelp, 'opacity:.8;--d:-360px')).classList.add('lyr')
  },

  'stress: 6 full-screen alpha layers all on parallax (twice any concept above)': async () => {
    const w = window.__w; const M = w.M
    w.style('.wstage .lyr{will-change:transform;animation:par linear both;animation-timeline:scroll()} @keyframes par{to{transform:translate3d(0,var(--d),0)}}')
    const s = w.stage('background:#223')
    for (let i = 0; i < 6; i++) { const src = await w.layer({ ...M, blobs: 40, hue: 60 * i, spread: 30, quality: 0.72, name: 'stress-' + i }); s.appendChild(w.img(src, `opacity:.8;--d:${-90 * (i + 1)}px`)).classList.add('lyr') }
  },
}

async function run(name, fn) {
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true, userAgent: MOBILE_UA })
  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE })
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)
  await page.evaluate(() => document.querySelector('.hero-plate canvas')?.remove())
  await page.evaluate(HELPERS)
  // Build the world with throttling OFF so generation time is not measured, then throttle for the scroll.
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
  await page.evaluate(fn)
  await page.waitForTimeout(1200)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE })
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(600)
  const r = await page.evaluate(async (duration) => {
    const frames = []; const longTasks = []; let observer
    try { observer = new PerformanceObserver((list) => { for (const e of list.getEntries()) longTasks.push(Math.round(e.duration)) }); observer.observe({ entryTypes: ['longtask'] }) } catch {}
    let last = performance.now(); let raf = 0
    const tick = (now) => { frames.push(now - last); last = now; raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick)
    const total = document.documentElement.scrollHeight - window.innerHeight
    const t0 = performance.now()
    await new Promise((resolve) => { const step = () => { const p = Math.min(1, (performance.now() - t0) / duration); window.scrollTo(0, total * p); if (p < 1) requestAnimationFrame(step); else resolve() }; step() })
    cancelAnimationFrame(raf); observer?.disconnect()
    const iv = frames.slice(1).sort((a, b) => a - b)
    const at = (q) => iv[Math.min(iv.length - 1, Math.floor(iv.length * q))] ?? 0
    return { frames: iv.length, median: +at(0.5).toFixed(1), p95: +at(0.95).toFixed(1), worst: +(iv[iv.length - 1] ?? 0).toFixed(1), over16: iv.filter((d) => d > 16.7).length, over32: iv.filter((d) => d > 32).length, longTasks: longTasks.length, longestTask: longTasks.length ? Math.max(...longTasks) : 0, sizes: window.__w.sizes }
  }, 8000)
  await context.close()
  r.over16pct = +((r.over16 / Math.max(1, r.frames)) * 100).toFixed(1)
  r.over32pct = +((r.over32 / Math.max(1, r.frames)) * 100).toFixed(1)
  return r
}

const results = {}
for (const [name, fn] of Object.entries(VARIANTS)) {
  if (ONLY && !name.includes(ONLY)) continue
  const passes = []
  for (let i = 0; i < 2; i++) passes.push(await run(name, fn))
  const best = passes.sort((a, b) => a.p95 - b.p95)[0]
  results[name] = { best, passes }
  const sizes = best.sizes.map((s) => `${s.name} ${s.width}x${s.height}${s.alpha ? 'a' : ''} ${s.kb}KB`).join(', ')
  console.log(`${name.padEnd(120)} p95 ${String(best.p95).padStart(6)}ms  >32ms ${String(best.over32pct).padStart(5)}%  long ${String(best.longTasks).padStart(2)} (max ${best.longestTask}ms)  [${passes.map((p) => p.p95).join('/')}]\n    layers: ${sizes || 'none'}`)
  writeFileSync(`${OUT}/worldbench-${THROTTLE}x.json`, JSON.stringify(results, null, 1))
}
await browser.close()
