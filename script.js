(function () {
  "use strict";
  var DOCK = 64,
    FRAME_COUNT = 300,
    FRAME_SRC = "blob/ezgif-frame-###_min_min.webp",
    SPEED = 3,
    FRAME_LERP = 0.18,
    WHEEL_TAU = 140,
    WHEEL_MULT = 1.1,
    IDLE_VEL = 18;
  var masthead = document.getElementById("masthead"),
    blobStage = document.querySelector(".blob-stage"),
    blobA = document.getElementById("blob-frame-a"),
    blobB = document.getElementById("blob-frame-b"),
    blobFrame = blobA || document.getElementById("blob-frame"),
    page = document.querySelector(".page"),
    contact = document.getElementById("contact");
  var phraseEls = Array.prototype.slice.call(document.querySelectorAll("[data-phrase]")),
    phraseCopies = Array.prototype.slice.call(document.querySelectorAll("[data-copy]"));
  var pairs = phraseEls.map(function (el, i) {
    return { marker: el, copy: phraseCopies[i] || null };
  });
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var isCoarse = false;
  try {
    isCoarse = window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
  } catch (_) {}
  var hasCrossfade = !!(blobA && blobB);
  var crossfadeOn = hasCrossfade && !reduced;
  var activeBlob = 0;
  var vh = window.innerHeight,
    lockY = 1,
    spanEnd = 1,
    exitStart = 1,
    maxScroll = 1;
  var vhStable = vh;
  var frameCache = new Array(FRAME_COUNT).fill(null),
    lastFrame = -1,
    frameCur = 0,
    idlePos = 0,
    idleActive = true,
    scaleCur = 1,
    scaleRatio = 0.42;
  var introOffset = 0,
    introVel = 320,
    introActive = !reduced;
  var targetY = 0,
    smoothY = 0,
    lastSetY = -1;
  var rafAlive = true,
    lastTime = 0,
    errorCount = 0;

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }
  function pad(n) {
    return n < 10 ? "00" + n : n < 100 ? "0" + n : String(n);
  }
  function frameSrc(i) {
    return FRAME_SRC.replace("###", pad(i + 1));
  }
  function getFrame(i) {
    if (i < 0 || i >= FRAME_COUNT) return null;
    if (!frameCache[i]) {
      var img = new Image();
      img.decoding = "async";
      img.loading = "eager";
      img.src = frameSrc(i);
      frameCache[i] = img;
    }
    return frameCache[i];
  }
  function isReady(i) {
    var c = frameCache[i];
    return !!(c && c.complete && c.naturalWidth);
  }
  // tiny look-ahead - keep it light, progressive loader does the heavy lifting
  function warmNearby(center) {
    var a = center + 1, b = center + 2, c2 = center - 1;
    if (a < FRAME_COUNT) getFrame(a);
    if (b < FRAME_COUNT) getFrame(b);
    if (c2 >= 0) getFrame(c2);
  }
  // progressive idle preload: trickle remaining frames without flooding network
  var preloadNext = 0;
  function scheduleProgressive() {
    preloadNext = 40; // first 40 are eagerly fetched in boot
    if (!("requestIdleCallback" in window)) {
      // fallback: staggered setTimeout batches
      function batch() {
        for (var k = 0; k < 10 && preloadNext < FRAME_COUNT; k++, preloadNext++) getFrame(preloadNext);
        if (preloadNext < FRAME_COUNT) setTimeout(batch, 90);
      }
      setTimeout(batch, 600);
      return;
    }
    function idlePreload(deadline) {
      var budget = 12;
      while (preloadNext < FRAME_COUNT && budget-- > 0) {
        if (deadline.timeRemaining() < 4 && !deadline.didTimeout) break;
        getFrame(preloadNext++);
      }
      if (preloadNext < FRAME_COUNT) requestIdleCallback(idlePreload, { timeout: 1800 });
    }
    requestIdleCallback(idlePreload, { timeout: 900 });
  }

  function setFrame(i) {
    if (i === lastFrame) return;
    // if requested frame not decoded yet, don't show blank - hold last frame and queue it
    if (!isReady(i)) {
      // try nearest ready within 3 steps so motion doesn't freeze completely
      var fallback = -1;
      for (var d = 1; d <= 3; d++) {
        var lo = i - d, hi = i + d;
        if (lo >= 0 && isReady(lo)) { fallback = lo; break; }
        if (hi < FRAME_COUNT && isReady(hi)) { fallback = hi; break; }
      }
      getFrame(i);
      warmNearby(i);
      if (fallback !== -1) i = fallback;
      else return; // keep current visible - prevents flash/chop
      if (i === lastFrame) return;
    }
    if (crossfadeOn) {
      var hidden = activeBlob === 0 ? blobB : blobA;
      var visible = activeBlob === 0 ? blobA : blobB;
      if (!hidden || !visible) return;
      lastFrame = i;
      var src = frameSrc(i);
      // hidden is offscreen (opacity 0) - decode there without janking visible
      hidden.src = src;
      var doFlip = function () {
        hidden.classList.add("is-active");
        visible.classList.remove("is-active");
        activeBlob = activeBlob === 0 ? 1 : 0;
        blobFrame = activeBlob === 0 ? blobA : blobB;
      };
      if (hidden.decode) hidden.decode().then(doFlip).catch(doFlip);
      else doFlip();
      if ("requestIdleCallback" in window) {
        requestIdleCallback(function () { warmNearby(i); }, { timeout: 220 });
      } else setTimeout(function () { warmNearby(i); }, 48);
      return;
    }
    if (!blobFrame) return;
    lastFrame = i;
    blobFrame.src = frameSrc(i);
    if (blobFrame.decode) blobFrame.decode().catch(function () {});
    if ("requestIdleCallback" in window) {
      requestIdleCallback(function () { warmNearby(i); }, { timeout: 220 });
    } else setTimeout(function () { warmNearby(i); }, 48);
  }

  function realVh() {
    var v = (window.visualViewport && window.visualViewport.height) || window.innerHeight;
    return Math.max(280, v);
  }
  function measure() {
    vh = window.innerHeight;
    var rv = realVh();
    if (Math.abs(rv - vhStable) > 48) vhStable = rv;
    var useVh = isCoarse ? vhStable : vh;
    lockY = Math.max(1, useVh / 2 - DOCK);
    var exitAnchor = 0;
    if (phraseEls.length > 0) {
      var last = phraseEls[phraseEls.length - 1];
      var lastCenter = last.offsetTop + last.offsetHeight / 2;
      var fadeOutY = lastCenter - useVh * 0.5 + useVh * 0.3;
      exitAnchor = fadeOutY + 12;
    } else if (contact) {
      exitAnchor = contact.offsetTop - useVh;
    } else if (page) {
      exitAnchor = page.offsetHeight - useVh;
    }
    exitStart = Math.max(lockY + 1, exitAnchor);
    spanEnd = Math.max(1, exitStart);
    maxScroll = Math.max(1, document.documentElement.scrollHeight - useVh);
    targetY = clamp(targetY, 0, maxScroll);
    smoothY = clamp(smoothY, 0, maxScroll);
    var bigFont = Math.min(Math.max(window.innerWidth * 0.042, 24), 51.2);
    scaleRatio = clamp(19 / bigFont, 0.42, 1);
  }

  function render(y, dt) {
    if (!isFinite(y)) y = 0;
    y = clamp(y, 0, maxScroll);
    if (masthead) {
      var docked = y >= lockY;
      masthead.classList.toggle("is-header", docked);
      scaleCur += ((docked ? scaleRatio : 1) - scaleCur) * (1 - Math.exp(-dt / 160));
      if (!isFinite(scaleCur)) scaleCur = 1;
      masthead.style.transform =
        "translate3d(0," + (-Math.min(y, lockY)).toFixed(2) + "px,0) scale(" + scaleCur.toFixed(4) + ")";
    }
    var target;
    if (y < 2) {
      if (!idleActive) {
        idlePos = frameCur - introOffset;
        idleActive = true;
      }
      idlePos += IDLE_VEL * (dt / 1000);
      var m = (idlePos + introOffset) % (FRAME_COUNT * 2);
      target = m < FRAME_COUNT ? m : FRAME_COUNT * 2 - m;
    } else {
      idleActive = false;
      var total = (y / spanEnd) * FRAME_COUNT * SPEED + introOffset;
      var m2 = total % (FRAME_COUNT * 2);
      if (m2 < 0) m2 += FRAME_COUNT * 2;
      target = m2 < FRAME_COUNT ? m2 : FRAME_COUNT * 2 - m2;
    }
    if (!isFinite(target)) target = 0;
    var lerp = 1 - Math.pow(1 - FRAME_LERP, dt / 16.67);
    frameCur += (target - frameCur) * lerp;
    if (Math.abs(target - frameCur) < 0.01) frameCur = target;
    if (!isFinite(frameCur)) frameCur = target;
    setFrame(clamp(Math.floor(frameCur + 1e-4), 0, FRAME_COUNT - 1));
    if (blobStage) {
      var exitY = Math.max(0, y - exitStart);
      blobStage.style.transform = exitY ? "translate3d(0," + (-exitY).toFixed(2) + "px,0)" : "translate3d(0,0,0)";
    }
    var band = vh * 0.3;
    for (var k = 0; k < pairs.length; k++) {
      var pair = pairs[k];
      if (!pair.copy || !pair.marker) continue;
      var r = pair.marker.getBoundingClientRect();
      var c = r.top + r.height / 2;
      pair.copy.classList.toggle("is-visible", Math.abs(c - vh / 2) < band);
    }
  }

  var scrollIsNative = false;
  function useNativeScroll() {
    scrollIsNative = true;
    targetY = smoothY = window.scrollY;
    lastSetY = smoothY;
  }
  function useWheelSmoothScroll() {
    scrollIsNative = false;
  }
  window.addEventListener("touchstart", function () { if (isCoarse) useNativeScroll(); }, { passive: true });
  window.addEventListener("touchmove", function () { if (isCoarse) useNativeScroll(); }, { passive: true });
  window.addEventListener("touchend", function () { if (!isCoarse) return; setTimeout(function () {}, 180); }, { passive: true });
  window.addEventListener(
    "wheel",
    function (e) {
      if (reduced || e.ctrlKey) return;
      if (isCoarse) {
        if (e.deltaMode !== 0) return;
        if (Math.abs(e.deltaY) < 18) return;
      }
      useWheelSmoothScroll();
      e.preventDefault();
      var d = e.deltaY;
      if (e.deltaMode === 1) d *= 16;
      else if (e.deltaMode === 2) d *= vh;
      targetY = clamp(targetY + d * WHEEL_MULT, 0, maxScroll);
      if (!rafAlive) {
        smoothY = targetY;
        window.scrollTo(0, smoothY);
      }
    },
    { passive: false }
  );
  window.addEventListener(
    "scroll",
    function () {
      var cur = window.scrollY;
      if (Math.abs(cur - lastSetY) < 0.5 && !scrollIsNative) return;
      if (scrollIsNative || isCoarse) {
        targetY = smoothY = cur;
        render(smoothY, 16);
        lastSetY = smoothY;
        return;
      }
      if (Math.abs(cur - lastSetY) < 1) return;
      targetY = smoothY = cur;
      if (!rafAlive) render(smoothY, 16);
    },
    { passive: true }
  );

  var contactForm = document.getElementById("contact-form"),
    thanksEl = document.getElementById("form-thanks");
  if (contactForm) {
    contactForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var btn = contactForm.querySelector("button[type=submit]");
      var nameVal = (document.getElementById("name").value || "").trim();
      var first = nameVal ? nameVal.split(/\s+/)[0] : "";
      if (btn) btn.disabled = true;
      document.body.style.cursor = "progress";
      var fd = {},
        fields = new FormData(contactForm);
      fields.forEach(function (v, k) { fd[k] = v; });
      var ctrl = new AbortController(),
        to = setTimeout(function () { ctrl.abort(); }, 12000);
      fetch("https://formsubmit.co/ajax/developer@liamhuang.dev", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(fd),
        signal: ctrl.signal,
      })
        .then(function (r) { return r.json().catch(function () { return {}; }); })
        .then(function (res) {
          clearTimeout(to);
          document.body.style.cursor = "";
          if (btn) btn.disabled = false;
          if ((res && res.success === "true") || (res && res.success === true)) {
            if (thanksEl) {
              thanksEl.textContent = first ? "Thank you, " + first + "!" : "Thank you!";
              thanksEl.hidden = false;
            }
            contactForm.reset();
          } else throw new Error("bad response");
        })
        .catch(function () {
          clearTimeout(to);
          document.body.style.cursor = "";
          if (btn) btn.disabled = false;
          if (thanksEl) {
            thanksEl.textContent = "Something went wrong — please email Developer@liamhuang.dev.";
            thanksEl.hidden = false;
          }
        });
    });
  }

  function updateIntro(dt) {
    if (!introActive) return;
    introVel *= Math.exp(-dt / 110);
    introOffset += (introVel * dt) / 1000;
    if (introVel < 0.8) introActive = false;
  }
  function loop(time) {
    try {
      var dt = lastTime ? Math.min(64, time - lastTime) : 16;
      lastTime = time;
      if (document.visibilityState === "hidden") {
        requestAnimationFrame(loop);
        return;
      }
      updateIntro(dt);
      if (isCoarse && scrollIsNative) {
        smoothY = targetY = window.scrollY;
        lastSetY = smoothY;
        render(smoothY, dt);
        requestAnimationFrame(loop);
        return;
      }
      var k = 1 - Math.exp(-dt / WHEEL_TAU);
      var diff = targetY - smoothY;
      if (Math.abs(diff) < 0.05) smoothY = targetY;
      else smoothY += diff * k;
      if (!isFinite(smoothY)) smoothY = targetY;
      if (Math.abs(smoothY - lastSetY) >= 0.5) {
        lastSetY = smoothY;
        window.scrollTo(0, smoothY);
      }
      render(smoothY, dt);
    } catch (err) {
      errorCount++;
      if (errorCount < 5 && window.console && console.error) console.error("[site] render error:", err);
    }
    requestAnimationFrame(loop);
  }
  function boot() {
    // eagerly warm first 40 frames so initial idle + first scrolls are instant
    for (var i = 0; i < 40 && i < FRAME_COUNT; i++) getFrame(i);
    vhStable = realVh();
    measure();
    targetY = smoothY = window.scrollY;
    lastSetY = smoothY;
    render(smoothY, 16);
    requestAnimationFrame(loop);
    scheduleProgressive();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  var measureRaf = 0;
  function scheduleMeasure() {
    if (measureRaf) return;
    measureRaf = requestAnimationFrame(function () {
      measureRaf = 0;
      measure();
      render(isCoarse && scrollIsNative ? window.scrollY : smoothY, 16);
    });
  }
  window.addEventListener("resize", scheduleMeasure, { passive: true });
  window.addEventListener("orientationchange", function () {
    vhStable = realVh();
    scheduleMeasure();
    setTimeout(scheduleMeasure, 260);
  });
  window.addEventListener("load", function () {
    vhStable = realVh();
    measure();
    render(window.scrollY, 16);
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", scheduleMeasure, { passive: true });
    window.visualViewport.addEventListener("scroll", scheduleMeasure, { passive: true });
  }
})();
