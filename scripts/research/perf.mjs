/**
 * Isolated scroll frame timing on the mobile profile at a CPU throttle, same
 * method as scripts/measure-scroll.mjs. Two passes per site, best kept, so a
 * transient stall does not condemn a site. Also records load-to-interactive
 * wall time and a first-fold LCP-ish proxy (largest image/text paint).
 *
 *   node scripts/research/perf.mjs <outdir> <throttle> <url> [url...]
 */
import { chromium } from 'playwright-core'
import { writeFileSync, existsSync, readFileSync } from 'node:fs'

const OUT = process.argv[2]
const THROTTLE = Number(process.argv[3])
const URLS = process.argv.slice(4)
const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 6a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36'
const browser = await chromium.launch({ channel: 'chrome' })

async function dismiss(page) {
  try { await page.keyboard.press('Escape') } catch {}
  for (const s of ['[aria-label*="close" i]', 'button:has-text("Accept")', 'button:has-text("Close")', '[role="dialog"] button']) {
    try { const el = page.locator(s).first(); if (await el.isVisible({ timeout: 250 })) { await el.click({ timeout: 600 }); await page.waitForTimeout(300) } } catch {}
  }
}

async function once(url) {
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true, userAgent: MOBILE_UA })
  const page = await context.newPage()
  await page.addInitScript(() => {
    window.__lcp = 0
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = Math.round(e.startTime) }).observe({ type: 'largest-contentful-paint', buffered: true }) } catch {}
  })
  const cdp = await context.newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE })
  const t0 = Date.now()
  try { await page.goto(url, { waitUntil: 'load', timeout: 60000 }) } catch {}
  const loadMs = Date.now() - t0
  try { await page.waitForLoadState('networkidle', { timeout: 15000 }) } catch {}
  await page.waitForTimeout(3000)
  await dismiss(page)
  const lcp = await page.evaluate(() => window.__lcp)
  const r = await page.evaluate(async (duration) => {
    const frames = []
    const longTasks = []
    let observer
    try { observer = new PerformanceObserver((list) => { for (const e of list.getEntries()) longTasks.push(Math.round(e.duration)) }); observer.observe({ entryTypes: ['longtask'] }) } catch {}
    let last = performance.now()
    let raf = 0
    const tick = (now) => { frames.push(now - last); last = now; raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick)
    const total = Math.min(document.documentElement.scrollHeight - window.innerHeight, window.innerHeight * 12)
    const t0 = performance.now()
    await new Promise((resolve) => { const step = () => { const p = Math.min(1, (performance.now() - t0) / duration); window.scrollTo(0, total * p); if (p < 1) requestAnimationFrame(step); else resolve() }; step() })
    cancelAnimationFrame(raf)
    observer?.disconnect()
    const iv = frames.slice(1).sort((a, b) => a - b)
    const at = (q) => iv[Math.min(iv.length - 1, Math.floor(iv.length * q))] ?? 0
    return { frames: iv.length, median: +at(0.5).toFixed(1), p95: +at(0.95).toFixed(1), worst: +(iv[iv.length - 1] ?? 0).toFixed(1), over16: iv.filter((d) => d > 16.7).length, over32: iv.filter((d) => d > 32).length, longTasks: longTasks.length, longestTask: longTasks.length ? Math.max(...longTasks) : 0, scrolled: Math.round(total) }
  }, 8000)
  await context.close()
  r.over16pct = +((r.over16 / Math.max(1, r.frames)) * 100).toFixed(1)
  r.over32pct = +((r.over32 / Math.max(1, r.frames)) * 100).toFixed(1)
  r.loadMs = loadMs
  r.lcpMs = lcp
  return r
}

const file = `${OUT}/perf-${THROTTLE}x.json`
const all = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {}
for (const url of URLS) {
  if (all[url]) { process.stderr.write(`skip ${url}\n`); continue }
  const passes = []
  for (let i = 0; i < 2; i++) { try { passes.push(await once(url)) } catch (e) { passes.push({ error: String(e.message).split('\n')[0] }) } }
  const ok = passes.filter((p) => !p.error)
  const best = ok.sort((a, b) => a.p95 - b.p95)[0] ?? passes[0]
  all[url] = { best, passes, throttle: THROTTLE }
  writeFileSync(file, JSON.stringify(all, null, 1))
  process.stderr.write(`${url}\n   p95 ${best.p95}ms  over16 ${best.over16pct}%  over32 ${best.over32pct}%  long ${best.longTasks} (max ${best.longestTask}ms)  frames ${best.frames}  lcp ${best.lcpMs}ms  load ${best.loadMs}ms   [other pass p95 ${passes.map((p) => p.p95 ?? 'err').join('/')}]\n`)
}
await browser.close()
