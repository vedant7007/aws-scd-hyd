/**
 * Frame timing for the landing page under mobile-like conditions.
 *
 *   npm start -- --port 3110      # in another shell
 *   npm run measure
 *
 * What this does and does not prove:
 *
 * - It drives the Chrome already installed on this machine, sized and scaled
 *   like a mid range Android, with the CPU throttled through CDP. Throttling
 *   slows the main thread only; it does not emulate a slower GPU, a slower
 *   display pipeline or thermal limits. It is the standard proxy for mid range
 *   mobile, not the same thing as a real handset.
 * - Frame timestamps come from requestAnimationFrame inside the page, so they
 *   measure what the page actually presented, not what the tooling hoped for.
 */
import { chromium } from 'playwright-core'

const URL = process.env.MEASURE_URL ?? 'http://localhost:3110/'
const THROTTLE = Number(process.env.MEASURE_CPU ?? 6)

// A Pixel 6a is a fair mid range reference: 412 CSS px wide at 2.6x.
const VIEWPORT = { width: 412, height: 915 }
const SCALE = 2.6

const measureInPage = async (page, label, ms = 8000) => {
  const result = await page.evaluate(async (duration) => {
    const frames = []
    const longTasks = []

    let observer
    try {
      observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) longTasks.push(Math.round(entry.duration))
      })
      observer.observe({ entryTypes: ['longtask'] })
    } catch {
      // Long task timing is not available everywhere.
    }

    const start = performance.now()
    let last = start
    let raf = 0

    const tick = (now) => {
      frames.push(now - last)
      last = now
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    // Drive a continuous scroll the whole way down, which is the case that
    // matters: sticky header, pinned tracks stage and the hero canvas.
    const total = document.documentElement.scrollHeight - window.innerHeight
    const t0 = performance.now()
    await new Promise((resolve) => {
      const step = () => {
        const progress = Math.min(1, (performance.now() - t0) / duration)
        window.scrollTo(0, total * progress)
        if (progress < 1) requestAnimationFrame(step)
        else resolve()
      }
      step()
    })

    cancelAnimationFrame(raf)
    observer?.disconnect()

    // The first frame after instrumentation starts is not a real interval.
    const intervals = frames.slice(1)
    intervals.sort((a, b) => a - b)
    const at = (q) => intervals[Math.min(intervals.length - 1, Math.floor(intervals.length * q))] ?? 0

    return {
      frames: intervals.length,
      median: at(0.5),
      p95: at(0.95),
      worst: intervals[intervals.length - 1] ?? 0,
      over16: intervals.filter((d) => d > 16.7).length,
      over32: intervals.filter((d) => d > 32).length,
      longTasks: longTasks.length,
      longestTask: longTasks.length ? Math.max(...longTasks) : 0,
      scrollHeight: document.documentElement.scrollHeight,
    }
  }, ms)

  const pct = (n) => ((n / Math.max(1, result.frames)) * 100).toFixed(1)
  const fps = result.median > 0 ? (1000 / result.median).toFixed(0) : 'n/a'

  console.log(`\n  ${label}`)
  console.log(`    frames presented      ${result.frames}`)
  console.log(`    median frame          ${result.median.toFixed(1)} ms  (~${fps} fps)`)
  console.log(`    p95 frame             ${result.p95.toFixed(1)} ms`)
  console.log(`    worst frame           ${result.worst.toFixed(1)} ms`)
  console.log(`    frames over 16.7ms    ${result.over16}  (${pct(result.over16)}%)`)
  console.log(`    frames over 32ms      ${result.over32}  (${pct(result.over32)}%)`)
  console.log(`    long tasks            ${result.longTasks}, longest ${result.longestTask} ms`)
  return result
}

async function run(browser, { reducedMotion, throttle, label, killCanvas = false, killPin = false, killReveal = false, killCv = false }) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: SCALE,
    isMobile: true,
    hasTouch: true,
    reducedMotion: reducedMotion ? 'reduce' : 'no-preference',
  })
  const page = await context.newPage()

  const cdp = await context.newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle })

  await page.goto(URL, { waitUntil: 'networkidle' })
  // Let hydration and the font swap finish. At 6x throttle they are still
  // running well after load, and measuring them would be measuring startup
  // rather than the cost of scrolling, which is what this is about.
  await page.waitForTimeout(3000)

  if (killCv) {
    // content-visibility defers layout until a section enters. Attribution for
    // whether that helps a scroll or just moves the cost into spikes.
    await page.evaluate(() => {
      for (const el of document.querySelectorAll('.cv-auto')) {
        el.style.contentVisibility = 'visible'
      }
    })
    await page.waitForTimeout(500)
  }

  if (killPin) {
    // The pinned CSS only matches counts 2, 3 and 4, so changing the attribute
    // turns the stage back into an ordinary list without touching anything else.
    await page.evaluate(() => {
      const stage = document.querySelector('.tracks-stage')
      if (stage) stage.dataset.count = 'off'
    })
    await page.waitForTimeout(300)
  }

  if (killReveal) {
    await page.evaluate(() => {
      for (const el of document.querySelectorAll('.reveal, .reveal-stagger > *')) {
        el.style.animation = 'none'
      }
    })
    await page.waitForTimeout(300)
  }

  if (killCanvas) {
    // Attribution: remove the hero canvas so its per frame cost is excluded.
    await page.evaluate(() => document.querySelector('.hero-plate canvas')?.remove())
    await page.waitForTimeout(300)
  }

  const result = await measureInPage(page, label)
  await context.close()
  return result
}

const browser = await chromium.launch({ channel: 'chrome' })
console.log(`Measuring ${URL}`)
console.log(`Viewport ${VIEWPORT.width}x${VIEWPORT.height} at ${SCALE}x, CPU throttled ${THROTTLE}x\n`)

// Three passes of the case that matters, because a single run is noisy.
const passes = []
for (let i = 1; i <= 3; i++) {
  passes.push(await run(browser, { reducedMotion: false, throttle: THROTTLE, label: `motion on, CPU ${THROTTLE}x slower, pass ${i}` }))
}
const med = (key) => {
  const v = passes.map((p) => p[key]).sort((a, b) => a - b)
  return v[1]
}
console.log(`
  MEDIAN OF THREE PASSES`)
console.log(`    p95 frame             ${med('p95').toFixed(1)} ms`)
console.log(`    frames over 16.7ms    ${((med('over16') / med('frames')) * 100).toFixed(1)}%`)
console.log(`    frames over 32ms      ${((med('over32') / med('frames')) * 100).toFixed(1)}%`)
console.log(`    long tasks            ${med('longTasks')}`)
await run(browser, { reducedMotion: false, throttle: THROTTLE, killCv: true, label: `content-visibility off, CPU ${THROTTLE}x slower` })
await run(browser, { reducedMotion: true, throttle: THROTTLE, label: `reduced motion, CPU ${THROTTLE}x slower` })
await run(browser, { reducedMotion: false, throttle: THROTTLE, killCanvas: true, label: `motion on but hero canvas removed, CPU ${THROTTLE}x slower` })
await run(browser, { reducedMotion: false, throttle: THROTTLE, killPin: true, label: `pinned tracks stage disabled, CPU ${THROTTLE}x slower` })
await run(browser, { reducedMotion: false, throttle: THROTTLE, killReveal: true, label: `reveal animations disabled, CPU ${THROTTLE}x slower` })
await run(browser, { reducedMotion: false, throttle: 1, label: 'motion on, no CPU throttle' })

await browser.close()
