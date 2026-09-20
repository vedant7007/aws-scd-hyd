/**
 * Technique micro-benchmarks. Injects one technique at a time into OUR landing
 * page (so the baseline is known) and measures scroll frame timing on the
 * mobile profile at a CPU throttle. Same rAF method as measure-scroll.mjs.
 *
 *   node scripts/research/bench.mjs <outdir> <throttle> [only]
 */
import { chromium } from 'playwright-core'
import { writeFileSync } from 'node:fs'

const OUT = process.argv[2]
const THROTTLE = Number(process.argv[3] ?? 4)
const ONLY = process.argv[4]
const URL = 'http://localhost:3110/'
const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 6a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36'
const browser = await chromium.launch({ channel: 'chrome' })

const NOISE_SVG = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.5'/></svg>`

// Each variant is a function run inside the page after load. They must be cheap
// to set up and must leave the page scrollable.
const VARIANTS = {
  baseline: () => {},

  'noise overlay, fixed full-screen SVG feTurbulence (live filter)': () => {
    const d = document.createElement('div')
    d.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:50;opacity:.25'
    d.innerHTML = `<svg width="100%" height="100%"><filter id="bn"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3"/></filter><rect width="100%" height="100%" filter="url(#bn)"/></svg>`
    document.body.appendChild(d)
  },

  'noise overlay, fixed tiled PNG-ish data URI (pre-rendered)': (noise) => {
    const d = document.createElement('div')
    d.style.cssText = `position:fixed;inset:0;pointer-events:none;z-index:50;opacity:.25;background:url("${noise}") repeat`
    document.body.appendChild(d)
  },

  'mix-blend-mode: multiply on 20 in-flow blocks': () => {
    const els = [...document.querySelectorAll('h2, .eyebrow')].slice(0, 20)
    for (const el of els) { el.style.mixBlendMode = 'multiply'; el.style.background = 'rgba(255,153,0,.6)' }
  },

  'backdrop-filter: blur(12px) on the sticky header': () => {
    const h = document.querySelector('.site-header') ?? document.querySelector('header')
    if (h) { h.style.backdropFilter = 'blur(12px)'; h.style.background = 'rgba(255,255,255,.6)' }
  },

  'filter: blur(6px) on 10 in-flow elements': () => {
    const els = [...document.querySelectorAll('p')].slice(0, 10)
    for (const el of els) el.style.filter = 'blur(6px)'
  },

  'CSS marquee x4 (transform keyframes, 40s loop)': () => {
    const s = document.createElement('style'); s.textContent = '@keyframes bm{to{transform:translate3d(-50%,0,0)}} .bm{overflow:hidden;white-space:nowrap} .bm>div{display:inline-block;animation:bm 40s linear infinite;font-size:2rem;font-weight:800}'; document.head.appendChild(s)
    for (let i = 0; i < 4; i++) { const d = document.createElement('div'); d.className = 'bm'; d.innerHTML = `<div>${'AWS STUDENT COMMUNITY DAY HYDERABAD · '.repeat(12)}</div>`; document.querySelector('main').insertAdjacentElement('afterbegin', d) }
  },

  '40 floating sprites, transform keyframes (like Pune)': () => {
    const s = document.createElement('style'); s.textContent = '@keyframes fl{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(0,-14px,0)}} .fl{position:absolute;width:48px;height:48px;border-radius:50%;background:#ff9900;animation:fl 2.4s ease-in-out infinite}'; document.head.appendChild(s)
    const total = document.documentElement.scrollHeight
    for (let i = 0; i < 40; i++) { const d = document.createElement('div'); d.className = 'fl'; d.style.left = (Math.random() * 90) + '%'; d.style.top = (Math.random() * total) + 'px'; d.style.animationDelay = (Math.random() * 2) + 's'; document.body.appendChild(d) }
  },

  '40 floating sprites, top/left keyframes (layout property)': () => {
    const s = document.createElement('style'); s.textContent = '@keyframes fl2{0%,100%{margin-top:0}50%{margin-top:-14px}} .fl2{position:absolute;width:48px;height:48px;border-radius:50%;background:#ff9900;animation:fl2 2.4s ease-in-out infinite}'; document.head.appendChild(s)
    const total = document.documentElement.scrollHeight
    for (let i = 0; i < 40; i++) { const d = document.createElement('div'); d.className = 'fl2'; d.style.left = (Math.random() * 90) + '%'; d.style.top = (Math.random() * total) + 'px'; d.style.animationDelay = (Math.random() * 2) + 's'; document.body.appendChild(d) }
  },

  'scroll-timeline parallax, 12 elements, transform only': () => {
    const s = document.createElement('style'); s.textContent = '@keyframes px{from{transform:translate3d(0,80px,0)}to{transform:translate3d(0,-80px,0)}} .px{animation:px linear both;animation-timeline:view();animation-range:entry 0% exit 100%}'; document.head.appendChild(s)
    for (const el of [...document.querySelectorAll('h2')].slice(0, 12)) el.classList.add('px')
  },

  'scroll-timeline, 12 elements, background-position (paint property)': () => {
    const s = document.createElement('style'); s.textContent = '@keyframes bp{from{background-position:0 0}to{background-position:0 200px}} .bp{background:linear-gradient(#ff9900 0 50%,transparent 50%) 0 0/100% 40px;animation:bp linear both;animation-timeline:view();animation-range:entry 0% exit 100%}'; document.head.appendChild(s)
    for (const el of [...document.querySelectorAll('h2')].slice(0, 12)) el.classList.add('bp')
  },

  'scroll-timeline, 12 elements, clip-path inset()': () => {
    const s = document.createElement('style'); s.textContent = '@keyframes cp{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}} .cp{animation:cp linear both;animation-timeline:view();animation-range:entry 0% entry 100%}'; document.head.appendChild(s)
    for (const el of [...document.querySelectorAll('h2')].slice(0, 12)) el.classList.add('cp')
  },

  'JS scroll parallax, 12 elements, transform in a scroll listener': () => {
    const els = [...document.querySelectorAll('h2')].slice(0, 12)
    const tops = els.map((el) => el.getBoundingClientRect().top + window.scrollY)
    window.addEventListener('scroll', () => { const y = window.scrollY; els.forEach((el, i) => { el.style.transform = `translate3d(0,${(tops[i] - y) * 0.15 - 100}px,0)` }) }, { passive: true })
  },

  'sticky stacked cards, 6 cards with scale on scroll-timeline': () => {
    const s = document.createElement('style'); s.textContent = '.stk{position:relative} .stk>div{position:sticky;top:10vh;height:70vh;background:#f6f6f5;border:1px solid #e4e4e3;margin-bottom:10vh;animation:sk linear both;animation-timeline:view();animation-range:exit 0% exit 100%} @keyframes sk{to{transform:scale(.92);opacity:.5}}'; document.head.appendChild(s)
    const w = document.createElement('div'); w.className = 'stk'; for (let i = 0; i < 6; i++) { const c = document.createElement('div'); c.textContent = 'Card ' + (i + 1); w.appendChild(c) }
    document.querySelector('main').insertAdjacentElement('afterbegin', w)
  },

  'pinned section, 300vh with a fixed child via position:sticky': () => {
    const w = document.createElement('div'); w.style.cssText = 'height:300vh;position:relative'
    const c = document.createElement('div'); c.style.cssText = 'position:sticky;top:0;height:100vh;display:grid;place-items:center;font-size:3rem;font-weight:800'; c.textContent = 'PINNED'
    w.appendChild(c); document.querySelector('main').insertAdjacentElement('afterbegin', w)
  },

  'horizontal scroll inside vertical (translateX driven by scroll-timeline)': () => {
    const s = document.createElement('style'); s.textContent = '.hz{height:300vh;position:relative} .hz>div{position:sticky;top:0;height:100vh;overflow:hidden} .hz .row{display:flex;gap:16px;height:100%;width:400vw;animation:hz linear both;animation-timeline:scroll();animation-range:0 30%} .hz .row>div{flex:0 0 90vw;background:#f6f6f5;border:1px solid #e4e4e3} @keyframes hz{to{transform:translate3d(-300vw,0,0)}}'; document.head.appendChild(s)
    const w = document.createElement('div'); w.className = 'hz'; w.innerHTML = '<div><div class="row"><div></div><div></div><div></div><div></div></div></div>'
    document.querySelector('main').insertAdjacentElement('afterbegin', w)
  },

  'text reveal by word, 400 words, IntersectionObserver + CSS transition': () => {
    const s = document.createElement('style'); s.textContent = '.wd{display:inline-block;opacity:0;transform:translate3d(0,8px,0);transition:opacity .4s,transform .4s} .wd.in{opacity:1;transform:none}'; document.head.appendChild(s)
    const ps = [...document.querySelectorAll('p')].slice(0, 20)
    for (const p of ps) { p.innerHTML = p.textContent.split(' ').map((w, i) => `<span class="wd" style="transition-delay:${(i % 12) * 30}ms">${w}</span>`).join(' ') }
    const io = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) e.target.classList.add('in') }, { threshold: 0.1 })
    document.querySelectorAll('.wd').forEach((el) => io.observe(el))
  },

  'text reveal by character, 3 headlines split to spans with transform keyframes': () => {
    const s = document.createElement('style'); s.textContent = '.ch{display:inline-block;animation:ch .6s cubic-bezier(.2,.7,.2,1) both} @keyframes ch{from{opacity:0;transform:translate3d(0,.4em,0)}}'; document.head.appendChild(s)
    for (const h of [...document.querySelectorAll('h2')].slice(0, 3)) { h.innerHTML = [...h.textContent].map((c, i) => `<span class="ch" style="animation-delay:${i * 25}ms">${c === ' ' ? '&nbsp;' : c}</span>`).join('') }
  },

  'SVG path drawing, 1 path 2000px long, stroke-dashoffset on scroll-timeline': () => {
    const s = document.createElement('style'); s.textContent = '.pd path{stroke-dasharray:2000;stroke-dashoffset:2000;animation:pd linear both;animation-timeline:scroll();animation-range:0 40%} @keyframes pd{to{stroke-dashoffset:0}}'; document.head.appendChild(s)
    const d = document.createElement('div'); d.className = 'pd'; d.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:40'
    d.innerHTML = '<svg width="100%" height="100%" viewBox="0 0 400 900" preserveAspectRatio="none"><path d="M20 20 C 200 200, 100 400, 300 500 S 100 800, 380 880" fill="none" stroke="#ff9900" stroke-width="3"/></svg>'
    document.body.appendChild(d)
  },

  'variable font weight animation, 10 headings, wght 300-800 keyframes': () => {
    const s = document.createElement('style'); s.textContent = '@keyframes vw{from{font-variation-settings:"wght" 300}to{font-variation-settings:"wght" 800}} .vw{animation:vw 1.6s ease-in-out infinite alternate}'; document.head.appendChild(s)
    for (const h of [...document.querySelectorAll('h2')].slice(0, 10)) h.classList.add('vw')
  },

  'canvas 2D particle field, 900 dots at 60fps (our hero canvas, always on)': () => {
    const c = document.createElement('canvas'); c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:1'
    document.body.appendChild(c); const ctx = c.getContext('2d'); const dpr = Math.min(devicePixelRatio, 2); c.width = innerWidth * dpr; c.height = innerHeight * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const dots = Array.from({ length: 900 }, () => ({ x: Math.random() * innerWidth, y: Math.random() * innerHeight, v: Math.random() + 0.2 }))
    const loop = () => { ctx.clearRect(0, 0, innerWidth, innerHeight); ctx.fillStyle = '#ff9900'; for (const d of dots) { d.y = (d.y + d.v) % innerHeight; ctx.beginPath(); ctx.arc(d.x, d.y, 1.5, 0, 6.28); ctx.fill() } requestAnimationFrame(loop) }
    requestAnimationFrame(loop)
  },

  'image sequence scrub, 60 frames 800x1200 drawn to canvas on scroll': async () => {
    const c = document.createElement('canvas'); c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none;z-index:1;opacity:.5'
    c.width = 800; c.height = 1200; document.body.appendChild(c); const ctx = c.getContext('2d')
    const frames = []
    for (let i = 0; i < 60; i++) { const f = document.createElement('canvas'); f.width = 800; f.height = 1200; const x = f.getContext('2d'); x.fillStyle = `hsl(${i * 6},70%,50%)`; x.fillRect(0, 0, 800, 1200); x.fillStyle = '#000'; x.font = '200px sans-serif'; x.fillText(String(i), 100, 600); frames.push(await createImageBitmap(f)) }
    window.addEventListener('scroll', () => { const p = window.scrollY / (document.documentElement.scrollHeight - innerHeight); ctx.drawImage(frames[Math.min(59, Math.floor(p * 60))], 0, 0) }, { passive: true })
  },

  'WebGL fragment shader background, full-screen, simple noise, 60fps': () => {
    const c = document.createElement('canvas'); c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:1;opacity:.5'; document.body.appendChild(c)
    const dpr = Math.min(devicePixelRatio, 2); c.width = innerWidth * dpr; c.height = innerHeight * dpr
    const gl = c.getContext('webgl'); if (!gl) return
    const vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'
    const fs = 'precision mediump float;uniform float t;uniform vec2 r;float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5);}float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}void main(){vec2 uv=gl_FragCoord.xy/r;float v=n(uv*6.+t*.2)*.5+n(uv*12.-t*.1)*.25;gl_FragColor=vec4(1.,.6,0.,v);}'
    const P = gl.createProgram(); for (const [t, s] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); gl.attachShader(P, sh) } gl.linkProgram(P); gl.useProgram(P)
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW); const a = gl.getAttribLocation(P, 'p'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0)
    const ut = gl.getUniformLocation(P, 't'), ur = gl.getUniformLocation(P, 'r'); gl.viewport(0, 0, c.width, c.height); gl.uniform2f(ur, c.width, c.height)
    const loop = (t) => { gl.uniform1f(ut, t / 1000); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); requestAnimationFrame(loop) }; requestAnimationFrame(loop)
  },

  'magnetic hover on 20 buttons (pointermove listener, transform)': () => {
    const els = [...document.querySelectorAll('a, button')].slice(0, 20)
    window.addEventListener('pointermove', (e) => { for (const el of els) { const r = el.getBoundingClientRect(); const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2); const d = Math.hypot(dx, dy); el.style.transform = d < 120 ? `translate3d(${dx * 0.2}px,${dy * 0.2}px,0)` : '' } }, { passive: true })
  },

  'view transitions: none (same-document API is not exercised by scrolling)': () => {},
}

async function run(name, fn) {
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true, userAgent: MOBILE_UA })
  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE })
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)
  // remove our own hero canvas so the increments are attributed to the injected technique alone
  await page.evaluate(() => document.querySelector('.hero-plate canvas')?.remove())
  await page.evaluate(fn, NOISE_SVG)
  await page.waitForTimeout(800)
  // scroll from the top so scroll-timeline variants get their full range
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(300)
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
    return { frames: iv.length, median: +at(0.5).toFixed(1), p95: +at(0.95).toFixed(1), worst: +(iv[iv.length - 1] ?? 0).toFixed(1), over16: iv.filter((d) => d > 16.7).length, over32: iv.filter((d) => d > 32).length, longTasks: longTasks.length, longestTask: longTasks.length ? Math.max(...longTasks) : 0 }
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
  console.log(`${name.padEnd(78)} p95 ${String(best.p95).padStart(6)}ms  >32ms ${String(best.over32pct).padStart(5)}%  long ${String(best.longTasks).padStart(2)} (max ${best.longestTask}ms)  median ${best.median}ms   [${passes.map((p) => p.p95).join('/')}]`)
  writeFileSync(`${OUT}/bench-${THROTTLE}x.json`, JSON.stringify(results, null, 1))
}
await browser.close()
