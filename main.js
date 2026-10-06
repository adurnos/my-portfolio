(() => {
  'use strict';

  const root = document.documentElement;
  const finePointer = window.matchMedia('(any-hover: hover) and (any-pointer: fine)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const desktopScroll = finePointer;

  let disposeScroll = () => {};
  const configureScroll = () => {
    disposeScroll();
    root.classList.remove('scroll-glide');
    if (!desktopScroll.matches || reducedMotion.matches) return;

    root.classList.add('scroll-glide');
    let target = window.scrollY;
    let current = target;
    let writtenPosition = current;
    let velocity = 0;
    let frame = 0;
    let previousTime = 0;
    const maxScroll = () => Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

    const stop = () => {
      window.cancelAnimationFrame(frame);
      frame = 0;
      previousTime = 0;
      velocity = 0;
      current = target = writtenPosition = window.scrollY;
    };

    const tick = (time) => {
      const elapsed = previousTime ? Math.min(time - previousTime, 50) : 16.67;
      previousTime = time;
      target = Math.max(0, Math.min(target, maxScroll()));
      const dt = elapsed / 1000;
      const stiffness = 6.25;
      const offset = current - target;
      const spring = (velocity + stiffness * offset) * dt;
      const decay = Math.exp(-stiffness * dt);
      current = target + (offset + spring) * decay;
      velocity = (velocity - stiffness * spring) * decay;

      if (Math.abs(target - current) < .5 && Math.abs(velocity) < 5) {
        window.scrollTo(0, target);
        stop();
        return;
      }

      window.scrollTo(0, current);
      writtenPosition = window.scrollY;
      frame = window.requestAnimationFrame(tick);
    };

    const wheel = (event) => {
      if (!event.cancelable || event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        stop();
        return;
      }
      let element = event.target instanceof Element ? event.target : null;
      while (element && element !== document.body) {
        if (element.matches('input, textarea, select, [contenteditable="true"]')) {
          stop();
          return;
        }
        const style = getComputedStyle(element);
        if (/(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight) {
          stop();
          return;
        }
        element = element.parentElement;
      }

      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1);
      if (!delta) return;
      if (!frame) {
        current = target = window.scrollY;
        velocity = 0;
      }
      if (Math.sign(delta) !== Math.sign(target - current)) {
        target = current;
        velocity = 0;
      }
      const next = Math.max(0, Math.min(target + delta, maxScroll()));
      if (next === current && !frame) return;
      event.preventDefault();
      target = next;
      if (!frame) frame = window.requestAnimationFrame(tick);
    };

    const nativeScroll = () => {
      if (!frame) {
        current = target = window.scrollY;
        return;
      }
      if (Math.abs(window.scrollY - writtenPosition) > 3) stop();
    };
    const key = (event) => {
      if (['Tab', 'ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)) stop();
    };
    const visibility = () => {
      if (document.hidden) stop();
    };

    window.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('scroll', nativeScroll, { passive: true });
    window.addEventListener('keydown', key);
    window.addEventListener('pointerdown', stop, { passive: true });
    window.addEventListener('touchstart', stop, { passive: true });
    window.addEventListener('resize', stop);
    window.addEventListener('blur', stop);
    document.addEventListener('focusin', stop);
    document.addEventListener('visibilitychange', visibility);

    disposeScroll = () => {
      stop();
      window.removeEventListener('wheel', wheel);
      window.removeEventListener('scroll', nativeScroll);
      window.removeEventListener('keydown', key);
      window.removeEventListener('pointerdown', stop);
      window.removeEventListener('touchstart', stop);
      window.removeEventListener('resize', stop);
      window.removeEventListener('blur', stop);
      document.removeEventListener('focusin', stop);
      document.removeEventListener('visibilitychange', visibility);
    };
  };

  configureScroll();
  desktopScroll.addEventListener('change', configureScroll);
  reducedMotion.addEventListener('change', configureScroll);

  document.querySelectorAll('[data-year]').forEach((element) => {
    element.textContent = String(new Date().getFullYear());
  });

  const form = document.querySelector('.contact-form');
  if (form) {
    const button = form.querySelector('button[type="submit"]');
    const status = form.querySelector('.form-status');
    const fields = Array.from(form.querySelectorAll('[required]'));
    let pending = false;
    let successTimeout;

    const setPending = (value) => {
      pending = value;
      button.disabled = value;
      button.setAttribute('aria-disabled', String(value));
      form.setAttribute('aria-busy', String(value));
    };

    fields.forEach((field) => {
      field.addEventListener('input', () => {
        window.clearTimeout(successTimeout);
        successTimeout = undefined;
        field.setCustomValidity('');
        status.textContent = '';
      });
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (pending) return;
      window.clearTimeout(successTimeout);
      successTimeout = undefined;

      fields.forEach((field) => {
        field.setCustomValidity(field.value.trim() ? '' : 'Please enter more than spaces.');
      });
      if (!form.reportValidity()) return;
      if (!navigator.onLine) {
        status.textContent = 'You appear to be offline. Reconnect and try again. Your message is still here.';
        return;
      }

      setPending(true);
      status.textContent = 'Sending your message...';
      try {
        const response = await fetch('https://formsubmit.co/ajax/developer@liamhuang.dev', {
          method: 'POST',
          headers: { Accept: 'application/json' },
          body: new FormData(form),
        });
        let result;
        try {
          result = await response.json();
        } catch {
          throw new Error('The form service returned an unreadable response.');
        }
        if (!response.ok || result.success === false || result.success === 'false') {
          throw new Error(result.message || 'The form service could not send your message.');
        }
        form.reset();
        status.textContent = 'Thanks. Your message has been sent.';
        successTimeout = window.setTimeout(() => {
          status.textContent = '';
          successTimeout = undefined;
        }, 3000);
      } catch (error) {
        status.textContent = error instanceof TypeError
          ? 'Your message could not be sent. Check your connection and try again, or email developer@liamhuang.dev.'
          : `${error.message} You can try again or email developer@liamhuang.dev.`;
      } finally {
        setPending(false);
      }
    });
  }

  const setupWordReveal = (gsap, ScrollTrigger) => {
    const originalParagraphs = [];
    const words = [];

    gsap.utils.toArray('.about-copy .scroll-copy').forEach((paragraph) => {
      const text = paragraph.textContent;
      originalParagraphs.push({ paragraph, text });
      const fragment = document.createDocumentFragment();

      text.split(/(\s+)/).forEach((part) => {
        if (/^\s+$/.test(part)) {
          fragment.append(document.createTextNode(part));
        } else if (part) {
          const word = document.createElement('span');
          word.className = 'reveal-word';
          word.textContent = part;
          words.push(word);
          fragment.append(word);
        }
      });
      paragraph.replaceChildren(fragment);
    });

    let wordTrigger;
    if (words.length) {
      let revealed = 0;
      const renderWords = (progress) => {
        const next = Math.min(words.length, Math.floor(progress * words.length + 1e-7));
        while (revealed < next) words[revealed++].classList.add('is-read');
        while (revealed > next) words[--revealed].classList.remove('is-read');
      };

      wordTrigger = ScrollTrigger.create({
        trigger: '.about-copy',
        start: 'top 80%',
        end: 'bottom 35%',
        onUpdate: (self) => renderWords(self.progress),
        onRefresh: (self) => renderWords(self.progress),
      });
    }

    return () => {
      wordTrigger?.kill();
      originalParagraphs.forEach(({ paragraph, text }) => {
        paragraph.textContent = text;
      });
    };
  };

  let entrancePlayed = false;

  if (window.gsap && window.ScrollTrigger) {
    const { gsap, ScrollTrigger } = window;
    gsap.registerPlugin(ScrollTrigger);
    const media = gsap.matchMedia();

    media.add('(prefers-reduced-motion: no-preference)', () => {
      if (!entrancePlayed) {
        entrancePlayed = true;
        gsap.fromTo('.hero h1 span', { y: 32, opacity: 0 }, { y: 0, opacity: 1, duration: 1.6, stagger: .16, ease: 'power3.out', clearProps: 'opacity' });
        gsap.fromTo('.wordmark', { opacity: 0 }, { opacity: 1, duration: 1.1, ease: 'power2.out', clearProps: 'opacity' });
        gsap.fromTo('.hero-symbol', { opacity: 0 }, { opacity: 1, duration: 1.4, stagger: .2, delay: .15, ease: 'power2.out', clearProps: 'opacity' });
      } else {
        gsap.set(['.hero h1 span', '.wordmark', '.hero-symbol'], { clearProps: 'all' });
      }
      gsap.utils.toArray('.hero-symbol').forEach((symbol, index) => {
        gsap.fromTo(symbol, { rotation: 0, rotationY: -16, rotationX: 12, y: 0 }, {
          rotation: index ? -360 : 360,
          rotationY: index ? 28 : -32,
          rotationX: -12,
          y: index ? -45 : 45,
          ease: 'none',
          scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: .35 },
        });
      });
      gsap.utils.toArray('.section h2').forEach((heading) => {
        gsap.fromTo(heading, { y: 45, scale: .96 }, {
          y: 0,
          scale: 1,
          ease: 'none',
          scrollTrigger: { trigger: heading, start: 'top 95%', end: 'top 50%', scrub: .25 },
        });
      });
      gsap.utils.toArray('.project').forEach((project, index) => {
        gsap.fromTo(project, { y: index ? 50 : 30 }, {
          y: 0,
          ease: 'none',
          scrollTrigger: { trigger: project, start: 'top 95%', end: 'top 55%', scrub: .3 },
        });
      });
      return setupWordReveal(gsap, ScrollTrigger);
    });

    media.add('(prefers-reduced-motion: reduce)', () => setupWordReveal(gsap, ScrollTrigger));
    if (document.fonts) document.fonts.ready.then(() => ScrollTrigger.refresh());
    window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
  }

  const cursor = document.querySelector('.cursor');
  if (!cursor) return;
  let disposeCursor = () => {};

  const configureCursor = () => {
    disposeCursor();
    root.classList.remove('custom-cursor');
    cursor.classList.add('is-hidden');
    cursor.classList.remove('is-hovering');
    if (!finePointer.matches || window.matchMedia('(forced-colors: active)').matches) return;

    let frame = 0;
    let initialized = false;
    let currentX = 0;
    let currentY = 0;
    let targetX = 0;
    let targetY = 0;
    let previousTime = 0;
    let hovering = false;
    let cursorAngle = 0;
    cursor.style.setProperty('--cursor-angle', '0deg');

    const render = (time) => {
      const elapsed = previousTime ? Math.min(time - previousTime, 64) : 16.67;
      previousTime = time;
      const smoothing = 1 - Math.exp(-elapsed / (reducedMotion.matches ? 8 : 45));
      currentX += (targetX - currentX) * smoothing;
      currentY += (targetY - currentY) * smoothing;
      cursor.style.transform = `translate3d(${currentX - 8}px, ${currentY - 8}px, 0)`;
      if (Math.abs(targetX - currentX) + Math.abs(targetY - currentY) > .1) {
        frame = window.requestAnimationFrame(render);
      } else {
        frame = 0;
        previousTime = 0;
      }
    };

    const move = (event) => {
      if (event.pointerType !== 'mouse') return;
      targetX = event.clientX;
      targetY = event.clientY;
      if (!initialized) {
        currentX = targetX;
        currentY = targetY;
        initialized = true;
      }
      root.classList.add('custom-cursor');
      cursor.classList.remove('is-hidden');
      if (!frame) frame = window.requestAnimationFrame(render);
    };

    const setHover = (next) => {
      if (next === hovering) return;
      hovering = next;
      cursorAngle += 180;
      cursor.style.setProperty('--cursor-angle', `${cursorAngle}deg`);
      cursor.classList.toggle('is-hovering', next);
    };

    const hover = (event) => {
      setHover(event.target instanceof Element && Boolean(event.target.closest('a, button, .project-preview')));
    };

    const hide = () => {
      setHover(false);
      cursor.classList.add('is-hidden');
      root.classList.remove('custom-cursor');
      window.cancelAnimationFrame(frame);
      frame = 0;
      previousTime = 0;
      initialized = false;
    };

    const keyboard = (event) => {
      if (event.key === 'Tab') hide();
    };
    const visibility = () => {
      if (document.hidden) hide();
    };

    window.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerover', hover, { passive: true });
    document.documentElement.addEventListener('pointerleave', hide);
    window.addEventListener('blur', hide);
    window.addEventListener('keydown', keyboard);
    document.addEventListener('visibilitychange', visibility);

    disposeCursor = () => {
      hide();
      window.removeEventListener('pointermove', move);
      document.removeEventListener('pointerover', hover);
      document.documentElement.removeEventListener('pointerleave', hide);
      window.removeEventListener('blur', hide);
      window.removeEventListener('keydown', keyboard);
      document.removeEventListener('visibilitychange', visibility);
    };
  };

  configureCursor();
  finePointer.addEventListener('change', configureCursor);
  reducedMotion.addEventListener('change', configureCursor);
})();
