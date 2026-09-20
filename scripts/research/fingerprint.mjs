/**
 * Library fingerprinting by grepping the actual script bodies a page loads,
 * which is far more reliable than globals or URL names. Also records decoded
 * JS bytes per script so the "how much JS" answer is exact.
 *
 *   node scripts/research/fingerprint.mjs <outdir> <url> [url...]
 */
import { chromium } from 'playwright-core'
import { writeFileSync, existsSync, readFileSync } from 'node:fs'

const OUT = process.argv[2]
const URLS = process.argv.slice(3)
const browser = await chromium.launch({ channel: 'chrome' })

const SIGS = {
  gsap: /gsap\.registerPlugin|\bgsap\b.*\bto\(|_gsap|GSAP 3|gsapVersion|"gsap"/,
  ScrollTrigger: /ScrollTrigger/,
  ScrollSmoother: /ScrollSmoother/,
  SplitText: /SplitText|SplitType/,
  Lenis: /new Lenis\b|class Lenis\b|lenis-scrolling|lenis-stopped|data-lenis-prevent|__lenis/,
  locomotive: /locomotive-scroll|LocomotiveScroll/,
  three: /THREE\.REVISION|WebGLRenderer|BufferGeometry|ShaderMaterial|"three"/,
  r3f: /react-three-fiber|@react-three|useFrame\(/,
  ogl: /\bogl\b.*Renderer|new Renderer\(\{.*(dpr|alpha)/,
  pixi: /PIXI\.|pixi\.js/,
  rive: /rive-app|RiveCanvas|rive\.wasm|riveInstance|RiveLoader|new Rive\(/,
  lottie: /lottie-web|bodymovin|lottie\.loadAnimation|dotlottie/i,
  spline: /@splinetool|spline-viewer|splinetool/,
  framerMotion: /framer-motion|MotionConfig|useMotionValue|motion\.div|animate-presence|AnimatePresence/,
  motionOne: /@motionone|motion-one/,
  anime: /animejs|anime\.timeline|anime\(\{/,
  react: /react-dom|__reactFiber|createRoot\(|_jsxRuntime|jsxs\(/,
  next: /_next\/static|__next_f|next\/dist/,
  nuxt: /__NUXT__|nuxt/,
  vue: /createApp\(|__vue__|Vue\.version/,
  svelte: /svelte\/internal|\$\$scope/,
  astro: /astro-island|astro:/,
  webflow: /Webflow|webflow/,
  framerSites: /framerusercontent|data-framer/,
  wordpress: /wp-content|wp-includes/,
  jquery: /jQuery|\$\.fn\./,
  swiper: /Swiper/,
  embla: /embla/i,
  splide: /splide/i,
  barba: /barba/i,
  swup: /swup/i,
  matter: /Matter\.Engine|matter-js/,
  particles: /tsparticles|particlesJS/,
  canvasConfetti: /canvas-confetti|confetti\(/,
  shaderText: /gl_FragColor|precision mediump float|uniform vec2/,
  wasm: /\.wasm/,
  IntersectionObserver: /IntersectionObserver/,
  scrollTimeline: /animation-timeline|ScrollTimeline|ViewTimeline/,
  viewTransition: /startViewTransition/,
  webgpu: /navigator\.gpu|requestAdapter/,
  imageSequence: /frames?\[|frameCount|frame_\d|sequence/i,
}

async function fp(url) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)
  await cdp.send('Network.enable')
  const scripts = new Map()
  cdp.on('Network.responseReceived', (e) => {
    const t = e.type
    const mime = e.response.mimeType || ''
    if (t === 'Script' || /javascript|ecmascript/.test(mime) || /\.m?js(\?|$)/.test(e.response.url)) scripts.set(e.requestId, { url: e.response.url, encoded: 0 })
  })
  cdp.on('Network.loadingFinished', (e) => { const s = scripts.get(e.requestId); if (s) s.encoded = e.encodedDataLength })
  try { await page.goto(url, { waitUntil: 'load', timeout: 45000 }) } catch {}
  try { await page.waitForLoadState('networkidle', { timeout: 12000 }) } catch {}
  await page.waitForTimeout(2000)
  try { await page.evaluate(async () => { window.scrollTo(0, window.innerHeight * 2); await new Promise((r) => setTimeout(r, 800)) }) } catch {}
  await page.waitForTimeout(800)
  const hits = {}
  const perScript = []
  let decodedTotal = 0
  const inline = await page.evaluate(() => [...document.scripts].filter((s) => !s.src).map((s) => s.textContent).join('\n'))
  const anims = await page.evaluate(() => {
    const list = document.getAnimations ? document.getAnimations() : []
    const out = new Map()
    for (const a of list.slice(0, 400)) {
      const t = a.effect?.getTiming?.() ?? {}
      const el = a.effect?.target
      const key = `${a.constructor.name}:${a.animationName ?? a.transitionProperty ?? ''}:${t.duration}:${t.iterations}`
      const cur = out.get(key) ?? { kind: a.constructor.name, name: a.animationName ?? a.transitionProperty ?? '', durationMs: t.duration, iterations: t.iterations, easing: t.easing, count: 0, timeline: a.timeline?.constructor?.name ?? '', sample: '' }
      cur.count++
      if (!cur.sample && el) cur.sample = (el.tagName + '.' + String(el.className).split(' ').slice(0, 2).join('.')).slice(0, 50)
      out.set(key, cur)
    }
    return [...out.values()].sort((a, b) => b.count - a.count).slice(0, 12)
  })
  const scan = (text, label) => {
    for (const [k, re] of Object.entries(SIGS)) if (re.test(text)) (hits[k] ??= []).push(label)
  }
  scan(inline, 'inline')
  for (const [id, s] of scripts) {
    let body = ''
    try { const r = await cdp.send('Network.getResponseBody', { requestId: id }); body = r.base64Encoded ? Buffer.from(r.body, 'base64').toString('utf8') : r.body } catch { continue }
    decodedTotal += body.length
    const name = s.url.replace(/\?.*$/, '').split('/').slice(-1)[0].slice(0, 60)
    perScript.push({ name, host: (() => { try { return new URL(s.url).host } catch { return '' } })(), encodedKB: Math.round(s.encoded / 1024), decodedKB: Math.round(body.length / 1024) })
    scan(body, name)
  }
  perScript.sort((a, b) => b.encodedKB - a.encodedKB)
  const firstParty = (() => { try { return new URL(url).host.replace(/^www\./, '') } catch { return '' } })()
  const thirdKB = perScript.filter((s) => !s.host.includes(firstParty) && !/framerusercontent|cdn|static|assets|cloudfront|vercel|netlify|amazonaws|jsdelivr|unpkg|gstatic/.test(s.host)).reduce((a, s) => a + s.encodedKB, 0)
  await context.close()
  return {
    scripts: perScript.length,
    encodedKB: perScript.reduce((a, s) => a + s.encodedKB, 0),
    decodedKB: Math.round(decodedTotal / 1024),
    thirdPartyKB: thirdKB,
    libs: Object.fromEntries(Object.entries(hits).map(([k, v]) => [k, v.length > 3 ? v.slice(0, 3).concat(['+' + (v.length - 3)]) : v])),
    top: perScript.slice(0, 8),
    animations: anims,
  }
}

const file = `${OUT}/fingerprint.json`
const all = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {}
for (const url of URLS) {
  if (all[url]) { process.stderr.write(`skip ${url}\n`); continue }
  try {
    all[url] = await fp(url)
    process.stderr.write(`${url}\n   js ${all[url].encodedKB}KB wire / ${all[url].decodedKB}KB decoded, 3p ${all[url].thirdPartyKB}KB, libs: ${Object.keys(all[url].libs).join(', ')}\n`)
  } catch (e) { all[url] = { error: String(e.message).split('\n')[0] }; process.stderr.write(`${url} ERR ${all[url].error}\n`) }
  writeFileSync(file, JSON.stringify(all, null, 1))
}
await browser.close()
