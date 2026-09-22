/**
 * The landing page's behaviour, ported from the Component class in the
 * handoff's Landing Bitmap.dc.html. It works on the DOM the markup renders,
 * exactly as the handoff did, and returns the teardown.
 *
 * Rules carried over from the handoff that are load bearing, not decoration:
 *
 * - Nothing here ever sets opacity to 0. Entrances and scroll reveals move on
 *   transform only, so an animation that never runs (print, PDF export,
 *   offscreen render, background tab) can never leave content invisible.
 * - revealPass() runs synchronously at the top of the scroll handler, outside
 *   the rAF batching guard. Only the parallax rides the frame batch. A starved
 *   frame must not be able to latch reveals off.
 * - Everything time based derives its state from the clock, so a throttled or
 *   dropped tick lands on the correct frame rather than stalling mid word.
 * - All of it is off under prefers-reduced-motion.
 */
export function mountLanding(el: HTMLElement): () => void {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const clamp = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
  const step = (v: number, n: number) => Math.round(v * n) / n
  const q = <T extends HTMLElement>(sel: string) => el.querySelector<T>(sel)
  const qa = <T extends HTMLElement>(sel: string) => Array.from(el.querySelectorAll<T>(sel))

  const cleanups: (() => void)[] = []
  const timers = new Set<ReturnType<typeof setTimeout>>()
  const intervals = new Set<ReturnType<typeof setInterval>>()
  const later = (fn: () => void, ms: number) => {
    const t = setTimeout(() => {
      timers.delete(t)
      fn()
    }, ms)
    timers.add(t)
    return t
  }
  const every = (fn: () => void, ms: number) => {
    const i = setInterval(fn, ms)
    intervals.add(i)
    return i
  }
  const on = (target: EventTarget, type: string, fn: EventListener, opts?: AddEventListenerOptions) => {
    target.addEventListener(type, fn, opts)
    cleanups.push(() => target.removeEventListener(type, fn, opts))
  }
  // Teardown puts every inline style this module wrote back to what the
  // markup rendered, so a remount (dev StrictMode runs effects twice) starts
  // from the same DOM the first mount did.
  const restore = (n: HTMLElement, ...props: string[]) =>
    cleanups.push(() => props.forEach((p) => n.style.removeProperty(p)))

  let revealPass: (() => void) | null = null
  let visPass: (() => void) | null = null
  let awsSetLoop: ((run: boolean) => void) | null = null

  // ---- scroll: progress bar, parallax, pinned track stage -----------------
  const hstage = q('[data-hstage]')
  const htrack = q('[data-htrack]')
  const hbars = qa('[data-hbar] > span')
  const hcount = q('[data-hcount]')
  const cards = qa('[data-card]')

  const paint = () => {
    if (revealPass) revealPass()
    if (visPass) visPass()
    const s = el.style
    const h = document.documentElement.scrollHeight - window.innerHeight
    const y = window.scrollY || window.pageYOffset || 0
    s.setProperty('--prog', step(h > 0 ? clamp(y / h) : 0, 24).toFixed(4))
    s.setProperty('--g1', Math.round(y * -0.08) + '')
    s.setProperty('--g2', Math.round(y * 0.05) + '')

    if (hstage && htrack) {
      const r = hstage.getBoundingClientRect()
      const span = hstage.offsetHeight - window.innerHeight
      const t = clamp(-r.top / Math.max(1, span))
      const travel = Math.max(0, htrack.scrollWidth - window.innerWidth + 28)
      htrack.style.transform = 'translate3d(' + Math.round(-t * travel) + 'px,0,0)'
      const seg = t * hbars.length
      hbars.forEach((b, i) => {
        b.style.transform = 'scaleX(' + step(clamp(seg - i), 12).toFixed(3) + ')'
      })
      const idx = Math.min(cards.length - 1, Math.floor(t * (cards.length - 0.001)))
      if (hcount) hcount.textContent = 'TRACK 0' + (idx + 1) + ' / 03'
      cards.forEach((c, i) => {
        c.style.opacity = i === idx ? '1' : '.55'
      })
    }
  }

  if (!reduce) {
    // rAF can be starved (background tab, offscreen render). Race it against
    // a timer so a frame that never arrives can't latch scrolling off.
    let pending = false
    let raf = 0
    let fallbackT: ReturnType<typeof setTimeout> | 0 = 0
    const onScroll = () => {
      // Visibility must never depend on a frame or timer being delivered:
      // reveal synchronously, outside the batching guard. show() is
      // idempotent, so only the parallax rides the rAF/timer race.
      if (revealPass) revealPass()
      if (pending) return
      pending = true
      const fire = () => {
        if (!pending) return
        pending = false
        if (raf) {
          cancelAnimationFrame(raf)
          raf = 0
        }
        if (fallbackT) {
          clearTimeout(fallbackT)
          fallbackT = 0
        }
        paint()
      }
      raf = requestAnimationFrame(fire)
      fallbackT = setTimeout(fire, 90)
    }
    on(window, 'scroll', onScroll, { passive: true })
    on(window, 'resize', onScroll, { passive: true })
    cleanups.push(() => {
      if (raf) cancelAnimationFrame(raf)
      if (fallbackT) clearTimeout(fallbackT)
    })
    paint()
    on(document, 'visibilitychange', () => {
      if (!document.hidden) {
        pending = false
        paint()
      }
    })

    // ---- entrance: transform only, held visible if nothing ever fires ----
    const intro = qa('[data-in]')
    intro.forEach((n, i) => {
      n.style.transform = 'translate3d(0,14px,0)'
      n.style.transition = 'transform .36s steps(4) ' + (i * 110 + 60) + 'ms'
      restore(n, 'transform', 'transition')
    })
    let introDone = false
    const revealIntro = () => {
      if (introDone) return
      introDone = true
      intro.forEach((n) => {
        n.style.transform = 'translate3d(0,0,0)'
      })
    }
    requestAnimationFrame(() => requestAnimationFrame(revealIntro))
    later(revealIntro, 140)
    on(document, 'visibilitychange', () => {
      if (!document.hidden) revealIntro()
    })
  } else if (htrack) {
    htrack.style.overflowX = 'auto'
    htrack.style.scrollSnapType = 'x mandatory'
  }

  // ---- speaker slots: pixel wipe to the track card behind ------------------
  qa('[data-px]').forEach((card) => {
    const back = card.querySelector<HTMLElement>('[data-px-back]')
    const grid = card.querySelector<HTMLElement>('[data-px-grid]')
    if (!back || !grid) return
    const N = 9
    const cells: HTMLDivElement[] = []
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const p = document.createElement('div')
        p.style.cssText =
          'position:absolute;display:none;background:var(--ink);width:' +
          100 / N +
          '%;height:' +
          100 / N +
          '%;left:' +
          (c * 100) / N +
          '%;top:' +
          (r * 100) / N +
          '%'
        grid.appendChild(p)
        cells.push(p)
      }
    }
    const order = cells.map((_, i) => i)
    for (let i = order.length - 1; i > 0; i--) {
      const k = Math.floor(Math.random() * (i + 1))
      const t = order[i]
      order[i] = order[k]
      order[k] = t
    }
    let isOn = false
    let mine: ReturnType<typeof setTimeout>[] = []
    const clearMine = () => {
      mine.forEach((t) => {
        clearTimeout(t)
        timers.delete(t)
      })
      mine = []
    }
    const run = (activate: boolean) => {
      if (reduce) {
        back.style.display = activate ? 'flex' : 'none'
        isOn = activate
        return
      }
      clearMine()
      isOn = activate
      const pace = 300 / order.length
      order.forEach((idx, n) => {
        mine.push(
          later(() => {
            cells[idx].style.display = 'block'
          }, n * pace),
        )
        mine.push(
          later(() => {
            cells[idx].style.display = 'none'
          }, 320 + n * pace),
        )
      })
      mine.push(
        later(() => {
          back.style.display = activate ? 'flex' : 'none'
        }, 300),
      )
    }
    on(card, 'mouseenter', () => {
      if (!isOn) run(true)
    })
    on(card, 'mouseleave', () => {
      if (isOn) run(false)
    })
    on(card, 'click', () => run(!isOn))
    // Keyboard: the same reveal on focus, Enter and Space.
    on(card, 'focus', () => {
      if (!isOn) run(true)
    })
    on(card, 'blur', () => {
      if (isOn) run(false)
    })
    on(card, 'keydown', (e) => {
      const key = (e as KeyboardEvent).key
      if (key === 'Enter' || key === ' ') {
        e.preventDefault()
        run(!isOn)
      }
    })
    cleanups.push(() => {
      clearMine()
      grid.replaceChildren()
      back.style.display = 'none'
    })
  })

  // ---- pause offscreen animation, fail OPEN ---------------------------------
  if (!reduce) {
    // Hosts start running, and the in-view test is computed in the reliable
    // paint() pass. A starved observer can only ever leave animations
    // playing, never frozen.
    const hosts = qa('section, [data-hstage]')
    hosts.forEach((h) => h.setAttribute('data-anim-paused', '0'))
    const inView = (n: Element, pad: number) => {
      const r = n.getBoundingClientRect()
      return r.bottom > -pad && r.top < window.innerHeight + pad
    }
    visPass = () => {
      hosts.forEach((h) => h.setAttribute('data-anim-paused', inView(h, 140) ? '0' : '1'))
      if (awsSetLoop) awsSetLoop(inView(q('[data-aws]') || el, 60))
    }
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => e.target.setAttribute('data-anim-paused', e.isIntersecting ? '0' : '1'))
        },
        { rootMargin: '140px 0px' },
      )
      hosts.forEach((h) => io.observe(h))
      cleanups.push(() => io.disconnect())
    }
  }

  // ---- FAQ: one open at a time, height animated -----------------------------
  const faqs = qa<HTMLDetailsElement>('#faq details')
  faqs.forEach((d) => {
    const body = d.lastElementChild as HTMLElement | null
    if (body) {
      body.style.overflow = 'hidden'
      body.style.maxHeight = d.open ? 'none' : '0px'
      body.style.transition = reduce ? 'none' : 'max-height .28s ease, opacity .22s ease'
      body.style.opacity = d.open ? '1' : '0'
      restore(body, 'overflow', 'max-height', 'transition', 'opacity')
      on(body, 'transitionend', (ev) => {
        if ((ev as TransitionEvent).propertyName === 'max-height' && d.open) body.style.maxHeight = 'none'
      })
    }
    on(d, 'toggle', () => {
      if (d.open) {
        faqs.forEach((o) => {
          if (o !== d && o.open) {
            const ob = o.lastElementChild as HTMLElement | null
            if (ob && ob.style.maxHeight === 'none') ob.style.maxHeight = ob.scrollHeight + 'px'
            o.open = false
          }
        })
        if (body) {
          body.style.maxHeight = body.scrollHeight + 'px'
          body.style.opacity = '1'
          if (reduce) body.style.maxHeight = 'none'
        }
      } else if (body) {
        if (body.style.maxHeight === 'none') body.style.maxHeight = body.scrollHeight + 'px'
        requestAnimationFrame(() => {
          body.style.maxHeight = '0px'
          body.style.opacity = '0'
        })
        later(() => {
          if (!d.open) {
            body.style.maxHeight = '0px'
            body.style.opacity = '0'
          }
        }, 30)
      }
    })
  })

  // ---- headline: typed, held, erased, from the clock ------------------------
  const t1 = q('[data-t1]')
  const t2 = q('[data-t2]')
  if (t1 && t2 && !reduce) {
    const l1 = t1.textContent || ''
    const l2html = t2.innerHTML
    const plain2 = t2.textContent || ''
    t1.textContent = ''
    t2.textContent = ''
    const WORD = 'COMMUNITY'
    const paint2 = (n: number) => {
      if (n <= WORD.length) {
        t2.innerHTML = '<span style="color:var(--amber-ink)">' + plain2.slice(0, n) + '</span>'
      } else {
        t2.innerHTML = '<span style="color:var(--amber-ink)">' + WORD + '</span>' + plain2.slice(WORD.length, n)
      }
    }
    // One self-scheduling interval instead of a chain of one-shot timeouts:
    // a dropped or cancelled tick can no longer terminate the loop.
    // Time-based, not tick-based: each tick derives the exact state from the
    // clock, so throttled or dropped ticks can never leave it stalled
    // mid-word. A single late tick lands on the correct frame.
    const T1 = l1.length * 52
    const GAP = 140
    const T2 = plain2.length * 46
    const HOLD = 2800
    const ER = (l1.length + plain2.length) * 12
    const PAUSE = 560
    const CYCLE = T1 + GAP + T2 + HOLD + ER + PAUSE
    const start = Date.now()
    const tick = () => {
      let m = (Date.now() - start) % CYCLE
      if (m < T1) {
        t1.textContent = l1.slice(0, Math.ceil(l1.length * (m / T1)))
        if (t2.firstChild) t2.textContent = ''
        return
      }
      m -= T1
      t1.textContent = l1
      if (m < GAP) {
        t2.textContent = ''
        return
      }
      m -= GAP
      if (m < T2) {
        paint2(Math.ceil(plain2.length * (m / T2)))
        return
      }
      m -= T2
      if (m < HOLD) {
        t2.innerHTML = l2html
        return
      }
      m -= HOLD
      if (m < ER) {
        const gone = (m / ER) * (l1.length + plain2.length)
        if (gone < plain2.length) paint2(Math.max(0, Math.floor(plain2.length - gone)))
        else {
          t2.textContent = ''
          t1.textContent = l1.slice(0, Math.max(1, Math.floor(l1.length + plain2.length - gone)))
        }
        return
      }
      // Resting state is the READABLE one: hold the full headline through
      // the pause so a stalled tick can never leave the hero blank.
      t1.textContent = l1
      t2.innerHTML = l2html
    }
    tick()
    every(tick, 42)
    // Teardown leaves the full headline in the DOM.
    cleanups.push(() => {
      t1.textContent = l1
      t2.innerHTML = l2html
    })
  }

  // ---- rotating tagline -------------------------------------------------------
  const rotw = q('[data-rotw]')
  if (rotw && !reduce) {
    const lines = ['for the ones who build', 'three tracks, one Friday', 'any college in Hyderabad', '300 seats, then it shuts']
    // Clock-derived, and text + opacity are set in the SAME tick, so a
    // throttled tick can never leave the line transparent.
    const SLOT = 3000
    const rotStart = Date.now()
    let lastK = -1
    const rotStep = () => {
      const m = (Date.now() - rotStart) % (SLOT * lines.length)
      const k = Math.floor(m / SLOT)
      const into = m % SLOT
      if (k !== lastK) {
        lastK = k
        rotw.textContent = lines[k]
      }
      rotw.style.opacity = into < 160 ? '0.35' : '1'
    }
    rotw.style.transition = 'opacity .16s steps(3)'
    rotStep()
    every(rotStep, 120)
    cleanups.push(() => {
      rotw.textContent = lines[0]
      rotw.style.opacity = '1'
    })
  }

  // ---- title sponsor: A W S unfolds while in view ----------------------------
  const awsWord = q('[data-aws]')
  const exps = qa('[data-exp]')
  if (awsWord && exps.length) {
    const widths = ['5.4em', '2.2em', '7.4em']
    if (reduce) {
      exps.forEach((n, i) => {
        n.style.maxWidth = widths[i]
      })
    } else {
      exps.forEach((n, i) => {
        n.style.transition = 'max-width .5s steps(7) ' + i * 240 + 'ms, color .4s steps(3) ' + i * 240 + 'ms'
      })
      const open = () => {
        exps.forEach((n, i) => {
          n.style.maxWidth = widths[i]
          n.style.color = 'var(--gold4)'
        })
      }
      const close = () => {
        exps.forEach((n) => {
          n.style.maxWidth = '0px'
          n.style.color = 'var(--gold2)'
        })
      }
      let isOn = false
      let loop: ReturnType<typeof setInterval> | null = null
      const flip = () => {
        isOn = !isOn
        if (isOn) open()
        else close()
      }
      // Driven from the reliable paint() pass via visPass, not from IO alone.
      awsSetLoop = (shouldRun) => {
        if (shouldRun && !loop) {
          flip()
          loop = every(flip, 2600)
        } else if (!shouldRun && loop) {
          clearInterval(loop)
          intervals.delete(loop)
          loop = null
          isOn = false
          close()
        }
      }
      const r = awsWord.getBoundingClientRect()
      awsSetLoop(r.bottom > 0 && r.top < window.innerHeight)
    }
  }

  // ---- scroll reveals: transform only, driven by the always-delivered pass ---
  const items = qa('[data-rv]')
  if (reduce) {
    items.forEach((n) => {
      n.style.transform = 'none'
    })
  } else {
    const show = (n: HTMLElement, delay: number) => {
      if (n.dataset.shown) return
      n.dataset.shown = '1'
      n.style.transitionDelay = delay + 'ms'
      n.style.transform = 'translate3d(0,0,0)'
      // A stepped transition never advances past step 0 in a frame-starved
      // context, so drop the transition shortly after and let the resting
      // CSS value apply. Keeps the animation, can't strand content.
      later(() => {
        n.style.transition = 'none'
        n.style.transitionDelay = '0ms'
        n.style.transform = 'none'
      }, 460 + delay)
    }
    items.forEach((n) => {
      n.style.transform = 'translate3d(0,16px,0)'
      n.style.transition = 'transform .4s steps(5)'
      restore(n, 'transform', 'transition', 'transition-delay')
      cleanups.push(() => delete n.dataset.shown)
    })
    // Reveals are driven by the (timer-raced, always-delivered) paint pass,
    // so content can never be stranded if rAF and IO are starved.
    revealPass = () => {
      let n = 0
      items.forEach((item) => {
        if (item.dataset.shown) return
        if (item.getBoundingClientRect().top < window.innerHeight * 0.92) {
          show(item, n * 70)
          n += 1
        }
      })
    }
    revealPass()
    later(() => revealPass && revealPass(), 120)
    on(document, 'visibilitychange', () => {
      if (!document.hidden && revealPass) revealPass()
    })
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e, i) => {
            if (e.isIntersecting) show(e.target as HTMLElement, i * 70)
          })
        },
        { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
      )
      items.forEach((item) => io.observe(item))
      cleanups.push(() => io.disconnect())
    }
  }

  return () => {
    revealPass = visPass = awsSetLoop = null
    timers.forEach(clearTimeout)
    intervals.forEach(clearInterval)
    cleanups.forEach((fn) => fn())
  }
}
