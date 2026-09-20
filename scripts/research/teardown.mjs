/**
 * Teardown harness. For each URL: desktop + mobile load with CDP network
 * capture, library detection via globals and script URLs, canvas context
 * types (getContext is patched before any page script runs), sticky/fixed
 * counts, fonts, type scale, palette sample, running animation counts, and the
 * same animation count again under prefers-reduced-motion. Screenshots both.
 *
 *   node scripts/research/teardown.mjs <outdir> <url> [url...]
 */
import { chromium } from 'playwright-core'
import { writeFileSync, existsSync, readFileSync } from 'node:fs'

const OUT = process.argv[2]
const URLS = process.argv.slice(3)
const browser = await chromium.launch({ channel: 'chrome' })
const TODAY = new Date().toISOString().slice(0, 10)

const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 6a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36'

const INIT = () => {
  window.__ctx = []
  const orig = HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    window.__ctx.push(type)
    return orig.call(this, type, ...rest)
  }
  const oorig = typeof OffscreenCanvas !== 'undefined' ? OffscreenCanvas.prototype.getContext : null
  if (oorig) OffscreenCanvas.prototype.getContext = function (type, ...rest) { window.__ctx.push('offscreen:' + type); return oorig.call(this, type, ...rest) }
  window.__ioCount = 0
  const IO = window.IntersectionObserver
  if (IO) window.IntersectionObserver = class extends IO { constructor(...a) { super(...a); window.__ioCount++ } }
  window.__rafCount = 0
  const raf = window.requestAnimationFrame
  window.requestAnimationFrame = function (cb) { window.__rafCount++; return raf.call(window, cb) }
  window.__scrollListeners = 0
  const ael = EventTarget.prototype.addEventListener
  EventTarget.prototype.addEventListener = function (t, ...r) { if (t === 'scroll' || t === 'wheel') window.__scrollListeners++; return ael.call(this, t, ...r) }
}

const INSPECT = () => {
  const g = (k) => { try { return !!window[k] } catch { return false } }
  const scripts = [...document.scripts].map((s) => s.src).filter(Boolean)
  const inline = [...document.scripts].filter((s) => !s.src).map((s) => s.textContent).join('\n')
  const has = (re) => scripts.some((s) => re.test(s)) || re.test(inline)
  const q = (sel) => !!document.querySelector(sel)
  const libs = {
    gsap: g('gsap') || has(/gsap/i),
    scrollTrigger: g('ScrollTrigger') || has(/scrolltrigger/i),
    scrollSmoother: g('ScrollSmoother') || has(/scrollsmoother/i),
    lenis: g('Lenis') || q('html.lenis, .lenis') || has(/lenis/i),
    locomotive: has(/locomotive/i) || q('[data-scroll-container]'),
    three: g('THREE') || has(/three(\.min)?\.js|three\.module|\/three\//i),
    r3f: has(/react-three|@react-three|r3f/i),
    pixi: g('PIXI') || has(/pixi/i),
    framerMotion: has(/framer-motion|motion\.dev/i),
    lottie: g('lottie') || g('bodymovin') || has(/lottie|bodymovin/i) || q('lottie-player, dotlottie-player, dotlottie-wc'),
    rive: g('rive') || has(/rive/i) || q('canvas[data-rive], .rive-canvas'),
    spline: has(/spline/i) || q('spline-viewer'),
    webflow: g('Webflow') || q('html[data-wf-page], [data-wf-site]'),
    framerSites: q('[data-framer-hydrate-v2], meta[name="generator"][content*="Framer"], [data-framer-name]'),
    next: g('__next_f') || q('#__next, script#__NEXT_DATA__') || has(/_next\//),
    nuxt: g('__NUXT__') || q('#__nuxt'),
    astro: q('astro-island, [data-astro-cid], astro-slot') || has(/_astro\//),
    svelte: q('[class*="svelte-"]') || has(/_app\/immutable/),
    vue: g('__VUE__') || q('[data-v-app]'),
    react: q('[data-reactroot]') || g('__REACT_DEVTOOLS_GLOBAL_HOOK__') || g('__next_f'),
    gatsby: q('#___gatsby'),
    remix: g('__remixContext'),
    barba: g('barba') || has(/barba/i),
    swup: has(/swup/i),
    splitType: has(/split-type|splittext|splitting/i),
    anime: g('anime') || has(/anime(\.min|\.es)?\.js/i),
    wix: q('meta[name="generator"][content*="Wix"]'),
    squarespace: q('meta[name="generator"][content*="Squarespace"]') || has(/squarespace/i),
    shopify: g('Shopify') || has(/cdn\.shopify/i),
    wordpress: q('meta[name="generator"][content*="WordPress"]') || has(/wp-content/),
    elementor: q('[data-elementor-type]'),
    tailwind: [...document.querySelectorAll('[class]')].slice(0, 400).some((el) => /(^|\s)(flex|grid|px-\d|py-\d|md:|lg:|sm:)/.test(el.className)),
    jquery: g('jQuery'),
    alpine: g('Alpine'),
    swiper: g('Swiper') || has(/swiper/i),
    embla: has(/embla/i),
    matter: g('Matter') || has(/matter(\.min)?\.js/i),
    typedjs: has(/typed(\.min)?\.js/i),
    particles: has(/particles|tsparticles/i),
    curtains: has(/curtains/i),
    ogl: has(/\bogl\b/i),
    p5: g('p5') || has(/p5(\.min)?\.js/i),
    vanta: g('VANTA') || has(/vanta/i),
    scrollreveal: g('ScrollReveal') || has(/scrollreveal/i),
    aos: g('AOS') || has(/aos(\.js|\.css)/i) || q('[data-aos]'),
    motionOne: has(/motion-one|@motionone/i),
    viewTransitions: q('meta[name="view-transition"]'),
  }
  const generator = document.querySelector('meta[name="generator"]')?.content ?? null

  let sticky = 0, fixed = 0, animated = 0, transitioned = 0, blend = 0, filtered = 0, willChange = 0
  const colorCount = new Map()
  const bgCount = new Map()
  const all = [...document.querySelectorAll('body *')]
  const step = Math.max(1, Math.ceil(all.length / 3000))
  const sample = all.filter((_, i) => i % step === 0)
  for (const el of sample) {
    const s = getComputedStyle(el)
    if (s.position === 'sticky') sticky++
    if (s.position === 'fixed') fixed++
    if (s.animationName !== 'none' && s.animationDuration !== '0s') animated++
    if (s.transitionDuration && s.transitionDuration !== '0s' && s.transitionProperty !== 'none') transitioned++
    if (s.mixBlendMode !== 'normal') blend++
    if (s.filter !== 'none' || (s.backdropFilter && s.backdropFilter !== 'none')) filtered++
    if (s.willChange !== 'auto') willChange++
    const rect = el.getBoundingClientRect()
    if (rect.width * rect.height > 400 && rect.top < window.innerHeight * 3) {
      const bg = s.backgroundColor
      if (bg && !bg.startsWith('rgba(0, 0, 0, 0)')) bgCount.set(bg, (bgCount.get(bg) ?? 0) + rect.width * rect.height)
      if (el.textContent?.trim() && el.children.length === 0) colorCount.set(s.color, (colorCount.get(s.color) ?? 0) + 1)
    }
  }
  const top = (m, n) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k)
  const toHex = (rgb) => {
    const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
    if (!m) return rgb
    const h = (n) => Number(n).toString(16).padStart(2, '0')
    return '#' + h(m[1]) + h(m[2]) + h(m[3]) + (m[4] && Number(m[4]) < 1 ? ' a' + m[4] : '')
  }

  let scrollTimeline = false, viewTimeline = false, containerQueries = false, hasScrollSnap = false, cssRules = 0
  try {
    for (const sheet of document.styleSheets) {
      let rules
      try { rules = sheet.cssRules } catch { continue }
      for (const r of rules) {
        cssRules++
        const t = r.cssText
        if (t.includes('animation-timeline') || t.includes('scroll-timeline')) scrollTimeline = true
        if (t.includes('view-timeline') || t.includes('view()')) viewTimeline = true
        if (t.startsWith('@container')) containerQueries = true
        if (t.includes('scroll-snap-type')) hasScrollSnap = true
      }
    }
  } catch {}

  const h1 = document.querySelector('h1') ?? document.querySelector('h2')
  const h1s = h1 ? getComputedStyle(h1) : null
  const bodyS = getComputedStyle(document.body)
  const p = [...document.querySelectorAll('p')].find((el) => el.textContent.trim().length > 40)
  const pS = p ? getComputedStyle(p) : bodyS
  const fonts = [...new Set([...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family.replace(/["']/g, '')} ${f.weight}${f.style !== 'normal' ? ' ' + f.style : ''}`))]
  const bigText = h1 ? h1.textContent.trim().replace(/\s+/g, ' ').slice(0, 120) : null

  const media = {
    video: document.querySelectorAll('video').length,
    videoAutoplay: [...document.querySelectorAll('video')].filter((v) => v.autoplay).length,
    canvas: document.querySelectorAll('canvas').length,
    svg: document.querySelectorAll('svg').length,
    img: document.querySelectorAll('img').length,
    lazyImgs: document.querySelectorAll('img[loading="lazy"]').length,
    picture: document.querySelectorAll('picture').length,
    iframes: document.querySelectorAll('iframe').length,
  }

  const cursorCustom = bodyS.cursor === 'none' || q('[class*="cursor"], #cursor')
  const marquee = q('[class*="marquee"], [class*="ticker"], marquee')
  const preloader = q('[class*="preload"], [class*="loader"], #loader, [class*="intro"]')
  const grain = q('[class*="grain"], [class*="noise"]') || sample.some((el) => /noise|grain/i.test(getComputedStyle(el).backgroundImage))
  const horizontalScroll = document.documentElement.scrollWidth > document.documentElement.clientWidth

  return {
    title: document.title,
    generator,
    libs: Object.keys(Object.fromEntries(Object.entries(libs).filter(([, v]) => v))),
    scriptCount: scripts.length,
    scriptHosts: [...new Set(scripts.map((s) => { try { return new URL(s).host } catch { return s } }))].slice(0, 12),
    ctx: [...new Set(window.__ctx)],
    ioCount: window.__ioCount,
    rafCount: window.__rafCount,
    scrollListeners: window.__scrollListeners,
    counts: { sticky, fixed, animated, transitioned, blend, filtered, willChange, elements: all.length, cssRules },
    css: { scrollTimeline, viewTimeline, containerQueries, hasScrollSnap },
    type: {
      h1: h1s ? { family: h1s.fontFamily.split(',')[0].replace(/["']/g, ''), size: parseFloat(h1s.fontSize), weight: h1s.fontWeight, lh: h1s.lineHeight, ls: h1s.letterSpacing, transform: h1s.textTransform } : null,
      body: { family: pS.fontFamily.split(',')[0].replace(/["']/g, ''), size: parseFloat(pS.fontSize), weight: pS.fontWeight, lh: pS.lineHeight },
      ratio: h1s ? +(parseFloat(h1s.fontSize) / parseFloat(pS.fontSize)).toFixed(1) : null,
      fonts,
      bigText,
    },
    palette: { bg: top(bgCount, 6).map(toHex), text: top(colorCount, 6).map(toHex), bodyBg: toHex(bodyS.backgroundColor) },
    media,
    flags: { cursorCustom, marquee, preloader, grain, horizontalScroll },
    scrollHeight: document.documentElement.scrollHeight,
    vh: window.innerHeight,
  }
}

async function load(url, { mobile, reduced, shotName }) {
  const context = await browser.newContext(
    mobile
      ? { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true, userAgent: MOBILE_UA, reducedMotion: reduced ? 'reduce' : 'no-preference' }
      : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: reduced ? 'reduce' : 'no-preference' },
  )
  const page = await context.newPage()
  await page.addInitScript(INIT)
  const cdp = await context.newCDPSession(page)
  await cdp.send('Network.enable')
  const reqs = new Map()
  cdp.on('Network.responseReceived', (e) => reqs.set(e.requestId, { url: e.response.url, type: e.type, mime: e.response.mimeType, bytes: 0 }))
  cdp.on('Network.loadingFinished', (e) => { const r = reqs.get(e.requestId); if (r) r.bytes = e.encodedDataLength })
  let status = null, error = null
  const t0 = Date.now()
  try {
    const resp = await page.goto(url, { waitUntil: 'load', timeout: 45000 })
    status = resp?.status() ?? null
  } catch (e) { error = String(e.message).split('\n')[0] }
  const loadMs = Date.now() - t0
  try { await page.waitForLoadState('networkidle', { timeout: 15000 }) } catch {}
  await page.waitForTimeout(2500)
  try { await page.evaluate(async () => { window.scrollTo(0, window.innerHeight * 1.5); await new Promise((r) => setTimeout(r, 700)); window.scrollTo(0, 0); await new Promise((r) => setTimeout(r, 500)) }) } catch {}
  let info = null
  try { info = await page.evaluate(INSPECT) } catch (e) { error = (error ? error + ' | ' : '') + 'inspect: ' + String(e.message).split('\n')[0] }
  if (shotName) { try { await page.screenshot({ path: `${OUT}/${shotName}.png` }) } catch {} }
  const byType = {}
  const big = []
  for (const r of reqs.values()) {
    const t = r.type ?? 'Other'
    byType[t] = (byType[t] ?? 0) + r.bytes
    if (r.bytes > 30000) big.push({ url: r.url.replace(/\?.*$/, '').slice(0, 110), kb: Math.round(r.bytes / 1024), type: t })
  }
  big.sort((a, b) => b.kb - a.kb)
  const seq = [...reqs.values()].filter((r) => r.type === 'Image' && /[_\-/]?\d{2,5}\.(jpe?g|webp|png|avif)$/i.test(r.url.replace(/\?.*$/, ''))).length
  const total = Object.values(byType).reduce((a, b) => a + b, 0)
  const kb = (n) => Math.round((n ?? 0) / 1024)
  await context.close()
  return {
    status, error, loadMs, requests: reqs.size,
    kb: { total: kb(total), script: kb(byType.Script), css: kb(byType.Stylesheet), font: kb(byType.Font), image: kb(byType.Image), media: kb(byType.Media), doc: kb(byType.Document), other: kb(byType.Other) + kb(byType.XHR) + kb(byType.Fetch) },
    imageSequenceFrames: seq,
    big: big.slice(0, 10),
    info,
  }
}

const file = `${OUT}/teardown.json`
const results = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : []
for (const url of URLS) {
  if (results.some((r) => r.url === url && !r.error && r.desktop?.info)) { process.stderr.write(`skip ${url}\n`); continue }
  const slug = url.replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/gi, '-').replace(/-+$/, '').slice(0, 50)
  process.stderr.write(`\n== ${url}\n`)
  const r = { url, date: TODAY }
  try {
    r.desktop = await load(url, { mobile: false, reduced: false, shotName: `${slug}--desktop` })
    process.stderr.write(`   desktop ${r.desktop.status} ${r.desktop.kb.total}KB js=${r.desktop.kb.script}KB libs=${(r.desktop.info?.libs ?? []).join(',')} ctx=${(r.desktop.info?.ctx ?? []).join(',')}\n`)
    r.mobile = await load(url, { mobile: true, reduced: false, shotName: `${slug}--mobile` })
    process.stderr.write(`   mobile  ${r.mobile.status} ${r.mobile.kb.total}KB js=${r.mobile.kb.script}KB animated=${r.mobile.info?.counts.animated} canvas=${r.mobile.info?.media.canvas}\n`)
    r.reduced = await load(url, { mobile: false, reduced: true, shotName: null })
    process.stderr.write(`   reduced animated=${r.reduced.info?.counts.animated} vs ${r.desktop.info?.counts.animated}; transitions ${r.reduced.info?.counts.transitioned} vs ${r.desktop.info?.counts.transitioned}\n`)
  } catch (e) { r.error = String(e.message) }
  const i = results.findIndex((x) => x.url === url)
  if (i >= 0) results[i] = r; else results.push(r)
  writeFileSync(file, JSON.stringify(results, null, 1))
}
await browser.close()
console.log('done', results.length)
