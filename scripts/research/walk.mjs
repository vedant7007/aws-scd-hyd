/**
 * Deep look at one site: dismiss popups, screenshot the page at several scroll
 * depths on desktop and mobile into a contact sheet, and measure scroll frame
 * timing on the mobile profile at 4x CPU throttle with the exact method used
 * for our own site in scripts/measure-scroll.mjs, so the numbers compare.
 *
 *   node scripts/research/walk.mjs <outdir> <url> [throttle=4]
 */
import { chromium } from 'playwright-core'
import { writeFileSync, existsSync, readFileSync } from 'node:fs'

const OUT = process.argv[2]
const url = process.argv[3]
const THROTTLE = Number(process.argv[4] ?? 4)
const slug = url.replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/gi, '-').replace(/-+$/, '').slice(0, 50)
const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 6a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36'
const browser = await chromium.launch({ channel: 'chrome' })

async function dismiss(page) {
  try { await page.keyboard.press('Escape') } catch {}
  const sels = ['[aria-label*="close" i]', '[aria-label*="dismiss" i]', 'button:has-text("Accept")', 'button:has-text("Got it")', 'button:has-text("Close")', '[class*="close" i]', '[class*="modal" i] button', '[role="dialog"] button']
  for (const s of sels) {
    try { const el = page.locator(s).first(); if (await el.isVisible({ timeout: 300 })) { await el.click({ timeout: 800 }); await page.waitForTimeout(400) } } catch {}
  }
}

async function walk(mobile) {
  const context = await browser.newContext(mobile
    ? { viewport: { width: 412, height: 915 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, userAgent: MOBILE_UA }
    : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  try { await page.goto(url, { waitUntil: 'load', timeout: 45000 }) } catch {}
  try { await page.waitForLoadState('networkidle', { timeout: 12000 }) } catch {}
  await page.waitForTimeout(2500)
  await dismiss(page)
  const vh = mobile ? 915 : 900
  const total = await page.evaluate(() => document.documentElement.scrollHeight)
  const stops = [0, 0.6, 1.2, 2, 3, 4.5, 6, 8, 11, 15].map((n) => n * vh).filter((y) => y < total - vh / 2)
  if (stops.length < 3) { for (let y = stops.length * vh; y < total - vh / 2 && stops.length < 8; y += vh) stops.push(y) }
  const shots = []
  for (const y of stops) {
    // scroll in steps so scroll-triggered libraries actually fire
    await page.evaluate(async (y) => { const from = window.scrollY; const steps = 12; for (let i = 1; i <= steps; i++) { window.scrollTo(0, from + ((y - from) * i) / steps); await new Promise((r) => setTimeout(r, 40)) } }, y)
    await page.waitForTimeout(700)
    const buf = await page.screenshot()
    shots.push(buf)
    writeFileSync(`${OUT}/${slug}--${mobile ? 'm' : 'd'}${String(shots.length).padStart(2, '0')}.png`, buf)
  }
  await context.close()
  return { shots, total, vh }
}

async function measure() {
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true, userAgent: MOBILE_UA })
  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE })
  try { await page.goto(url, { waitUntil: 'load', timeout: 60000 }) } catch {}
  try { await page.waitForLoadState('networkidle', { timeout: 15000 }) } catch {}
  await page.waitForTimeout(3000)
  await dismiss(page)
  const result = await page.evaluate(async (duration) => {
    const frames = []
    const longTasks = []
    let observer
    try { observer = new PerformanceObserver((list) => { for (const e of list.getEntries()) longTasks.push(Math.round(e.duration)) }); observer.observe({ entryTypes: ['longtask'] }) } catch {}
    const start = performance.now()
    let last = start
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
    return { frames: iv.length, median: +at(0.5).toFixed(1), p95: +at(0.95).toFixed(1), worst: +(iv[iv.length - 1] ?? 0).toFixed(1), over16: iv.filter((d) => d > 16.7).length, over32: iv.filter((d) => d > 32).length, longTasks: longTasks.length, longestTask: longTasks.length ? Math.max(...longTasks) : 0, scrolled: total }
  }, 8000)
  await context.close()
  result.over16pct = +((result.over16 / Math.max(1, result.frames)) * 100).toFixed(1)
  result.over32pct = +((result.over32 / Math.max(1, result.frames)) * 100).toFixed(1)
  result.throttle = THROTTLE
  return result
}

const d = await walk(false)
const m = await walk(true)
// contact sheet via a tiny page rendered in the browser itself
const sheetCtx = await browser.newContext({ viewport: { width: 100, height: 100 }, deviceScaleFactor: 1 })
const sheet = await sheetCtx.newPage()
const b64 = (b) => 'data:image/png;base64,' + b.toString('base64')
const html = `<body style="margin:0;background:#222"><div style="display:flex;flex-wrap:wrap;gap:4px;width:${d.shots.length * 364}px">${d.shots.map((b) => `<img src="${b64(b)}" style="width:360px;height:225px;object-fit:cover;object-position:top">`).join('')}</div><div style="display:flex;gap:4px;margin-top:8px">${m.shots.map((b) => `<img src="${b64(b)}" style="width:180px;height:400px;object-fit:cover;object-position:top">`).join('')}</div></body>`
await sheet.setContent(html)
await sheet.setViewportSize({ width: Math.max(d.shots.length * 364, m.shots.length * 184) + 8, height: 225 + 400 + 24 })
await sheet.screenshot({ path: `${OUT}/${slug}--walk.png`, fullPage: true })
await sheetCtx.close()

let perf = null
try { perf = await measure() } catch (e) { perf = { error: String(e.message).split('\n')[0] } }
const file = `${OUT}/walk.json`
const all = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {}
all[url] = { desktopHeight: d.total, mobileHeight: m.total, perf }
writeFileSync(file, JSON.stringify(all, null, 1))
console.log(slug, 'desktop', d.total + 'px', 'mobile', m.total + 'px', 'perf', JSON.stringify(perf))
await browser.close()
