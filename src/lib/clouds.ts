/**
 * SCD cloud page transition, the engine. Port of the handoff's
 * cloud-transition.js, run inline before anything paints, exactly as the
 * handoff loaded it, so on a full load the clouds are already over the page
 * in the first frame and part from there. Building it in a React effect
 * instead put it on screen after hydration, on top of a page the reader had
 * already seen, which is the pop-in that looked like a glitch.
 *
 * Fail-safes, all kept: the overlay is built in JS (a script that fails to
 * load means no overlay at all), every hide path is raced against a timeout,
 * it self-destructs on a bfcache restore, and a tab coming back to the
 * foreground clears whatever is covering it.
 *
 * Two additions over the handoff. The sheet is decoded once up front and a
 * cover only runs with clouds on it: on a cold cache the page reveal waits
 * for the decode, capped at WAIT_MS, and a click before the sheet is ready
 * navigates plainly instead of showing an empty tint. And every cover starts
 * from a fresh overlay, because reusing one that was mid-dissolve inherited
 * its delayed fade and its pending destroy timer, which is what cut the
 * clouds off when a link was clicked just after load.
 *
 * Plain JS in a string because it runs before any module does. The App
 * Router glue that drives it lives in components/layout/CloudTransition.tsx.
 */
export const CLOUDS_BOOT = `(function () {
  if (window.__scdClouds) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var SRC = '/assets/cloud-sheet.png';
  var IN_MS = 1150;
  var OUT_MS = 1250;
  var EASE = 'cubic-bezier(.45,.02,.24,1)';
  var WAIT_MS = 700;
  var COVER_LIMIT_MS = 4000;

  var wrap = null, sheets = [], hideTimer = null, killTimer = null, ready = false;

  // Fetch and decode once, and hold the reference so it stays in memory.
  var img = new Image();
  var markReady = function () { ready = true; };
  img.onload = markReady;
  img.src = SRC;
  if (img.decode) img.decode().then(markReady, function () {});

  function dark() { return document.documentElement.getAttribute('data-theme') === 'dark'; }

  // Two sheets: a slower, larger one behind for depth, a sharp one in front.
  var PLAN = [
    { scale: 1.35, dur: 1.18, delay: 0,  flip: true,  dim: 0.86 },
    { scale: 1.00, dur: 1.00, delay: 90, flip: false, dim: 1.00 }
  ];

  function tx(pct, p) {
    return 'translate3d(' + pct + ',0,0) scale(' + p.scale + ')' + (p.flip ? ' scaleX(-1)' : '');
  }

  function ensure() {
    if (wrap) return;
    var d = dark();
    wrap = document.createElement('div');
    wrap.setAttribute('aria-hidden', 'true');
    wrap.style.cssText =
      'position:fixed;inset:0;z-index:2147483000;pointer-events:none;overflow:hidden;' +
      'background:' + (d ? 'linear-gradient(#0B1220,#16233A 60%,#20304C)' : 'linear-gradient(#DCEAF8,#C6DCF2 60%,#BCD4EC)') + ';opacity:0;' +
      'transition:opacity 260ms linear;';
    sheets = [];
    for (var i = 0; i < PLAN.length; i++) {
      var p = PLAN[i];
      var s = document.createElement('div');
      s.style.cssText =
        'position:absolute;top:-8%;left:0;width:118%;height:116%;' +
        'background-image:url(' + SRC + ');background-size:cover;' +
        'background-position:center;background-repeat:no-repeat;' +
        'image-rendering:pixelated;will-change:transform;' +
        'transform:' + tx('-118%', p) + ';' +
        (d ? 'filter:brightness(' + (p.dim * 0.80).toFixed(2) + ') saturate(1.15) hue-rotate(-8deg);'
           : (p.dim < 1 ? 'filter:brightness(' + p.dim + ');' : ''));
      s._p = p;
      sheets.push(s);
      wrap.appendChild(s);
    }
    (document.body || document.documentElement).appendChild(wrap);
  }

  function settle() {
    wrap.style.opacity = '1';
    for (var i = 0; i < sheets.length; i++) {
      var p = sheets[i]._p;
      sheets[i].style.transition = 'transform ' + Math.round(IN_MS * p.dur) + 'ms ' + EASE + ' ' + p.delay + 'ms';
      sheets[i].style.transform = tx('-9%', p);
    }
  }

  // bare: no clouds on the sheets, so the tint fades at once instead of
  // holding for a slide nobody can see.
  function clear(bare) {
    if (!wrap) return;
    wrap.style.pointerEvents = 'none';
    for (var i = 0; i < sheets.length; i++) {
      var p = sheets[i]._p;
      sheets[i].style.transition = 'transform ' + Math.round(OUT_MS * p.dur) + 'ms ' + EASE + ' ' + (i * 70) + 'ms';
      sheets[i].style.transform = tx('118%', p);
    }
    wrap.style.transition = 'opacity 320ms linear ' + (bare === true ? 0 : Math.round(OUT_MS * 0.62)) + 'ms';
    wrap.style.opacity = '0';
    clearTimeout(hideTimer);
    hideTimer = setTimeout(destroy, OUT_MS + 700);
  }

  function destroy() {
    clearTimeout(hideTimer); clearTimeout(killTimer);
    if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
    wrap = null; sheets = [];
  }

  function cover(done) {
    destroy();
    ensure();
    wrap.style.pointerEvents = 'auto';
    void wrap.offsetWidth;
    settle();
    setTimeout(done, Math.round(IN_MS * 0.96));
    // The route may never change: a failed fetch, a thrown render. Uncover anyway.
    killTimer = setTimeout(clear, COVER_LIMIT_MS);
  }

  function reveal() {
    ensure();
    wrap.style.transition = 'none';
    wrap.style.opacity = '1';
    for (var i = 0; i < sheets.length; i++) {
      sheets[i].style.transition = 'none';
      sheets[i].style.transform = tx('-9%', sheets[i]._p);
    }
    void wrap.offsetWidth;
    var started = false;
    var go = function () {
      if (started) return;
      started = true;
      var part = function () { clear(!ready); };
      requestAnimationFrame(function () { requestAnimationFrame(part); });
      setTimeout(part, 360);
    };
    // Part once the sheet has decoded and the document has parsed. Past
    // WAIT_MS, part without it: the sheets are hidden so they cannot pop in
    // mid-slide, and only the tint fades.
    var parsed = document.readyState !== 'loading';
    var waited = false;
    var check = function () { if (parsed && (ready || waited)) go(); };
    if (!parsed) document.addEventListener('DOMContentLoaded', function () { parsed = true; check(); }, { once: true });
    setTimeout(function () {
      if (!ready) for (var i = 0; i < sheets.length; i++) sheets[i].style.visibility = 'hidden';
      waited = true; check();
    }, WAIT_MS);
    if (ready) check();
    else if (img.decode) img.decode().then(function () { markReady(); check(); }, function () {});
    else img.addEventListener('load', function () { markReady(); check(); }, { once: true });
    killTimer = setTimeout(destroy, 5000);
  }

  reveal();

  window.addEventListener('pageshow', function (e) { if (e.persisted) destroy(); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden && wrap) clear(); });

  window.__scdClouds = { cover: cover, clear: clear, ready: function () { return ready; } };
})();`
