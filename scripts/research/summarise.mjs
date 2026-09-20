import { readFileSync } from 'node:fs'
const r = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const only = process.argv[3]
for (const s of r) {
  if (only && !s.url.includes(only)) continue
  if (!s.desktop) { console.log(s.url, 'ERR', s.error); continue }
  const d = s.desktop, m = s.mobile, x = s.reduced
  console.log('\n' + s.url, 'status', d.status, d.error || '')
  console.log(' D total', d.kb.total, 'KB js', d.kb.script, 'css', d.kb.css, 'font', d.kb.font, 'img', d.kb.image, 'media', d.kb.media, 'reqs', d.requests, 'load', d.loadMs + 'ms')
  console.log(' M total', m.kb.total, 'KB js', m.kb.script, 'img', m.kb.image, 'media', m.kb.media)
  const i = d.info; if (!i) { console.log(' no info'); continue }
  console.log(' gen', i.generator, 'libs', i.libs.join(','))
  console.log(' ctx', i.ctx.join(','), 'canvas', i.media.canvas, 'video', i.media.video, 'auto', i.media.videoAutoplay, 'img', i.media.img, 'seqFrames', d.imageSequenceFrames)
  console.log(' counts', JSON.stringify(i.counts), 'css', JSON.stringify(i.css))
  console.log(' io', i.ioCount, 'raf', i.rafCount, 'scrollL', i.scrollListeners, 'flags', JSON.stringify(i.flags))
  console.log(' h1', JSON.stringify(i.type.h1), 'body', JSON.stringify(i.type.body), 'ratio', i.type.ratio)
  console.log(' fonts', i.type.fonts.join(' | '))
  console.log(' text:', i.type.bigText)
  console.log(' bg', i.palette.bg.join(' '), '| text', i.palette.text.join(' '), '| body', i.palette.bodyBg)
  console.log(' big', d.big.map((b) => b.kb + 'KB ' + b.type + ' ' + b.url.split('/').pop()).join('; '))
  console.log(' reduced: animated', x.info?.counts.animated, 'vs', i.counts.animated, '; transitions', x.info?.counts.transitioned, 'vs', i.counts.transitioned)
  console.log(' M libs', (m.info?.libs || []).join(','), 'M ctx', (m.info?.ctx || []).join(','), 'M animated', m.info?.counts.animated, 'M sticky', m.info?.counts.sticky, 'M hscroll', m.info?.flags.horizontalScroll, 'M height', m.info?.scrollHeight, 'M h1', m.info?.type.h1?.size, 'M body', m.info?.type.body?.size)
}
