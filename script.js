document.documentElement.classList.add("js");

const year = document.querySelector("#year");
if (year) year.textContent = new Date().getFullYear();

let navigationScrollFrame = 0;
let restoreScrollBehavior = null;

const cancelNavigationScroll = () => {
  if (!navigationScrollFrame) return;
  window.cancelAnimationFrame(navigationScrollFrame);
  navigationScrollFrame = 0;
  restoreScrollBehavior?.();
  restoreScrollBehavior = null;
};

const smoothScrollTo = (target) => {
  cancelNavigationScroll();

  const root = document.documentElement;
  const previousBehavior = root.style.scrollBehavior;
  root.style.scrollBehavior = "auto";
  restoreScrollBehavior = () => { root.style.scrollBehavior = previousBehavior; };

  const start = window.scrollY;
  const destination = Math.max(0, target.getBoundingClientRect().top + start - 16);
  const distance = destination - start;
  const duration = Math.min(400, Math.max(200, Math.abs(distance) * 0.2));
  let startTime;

  const step = (time) => {
    if (startTime === undefined) startTime = time;
    const progress = Math.min(1, (time - startTime) / duration);
    const eased = progress * progress * (3 - 2 * progress);
    window.scrollTo(0, start + distance * eased);

    if (progress < 1) {
      navigationScrollFrame = window.requestAnimationFrame(step);
    } else {
      navigationScrollFrame = 0;
      restoreScrollBehavior?.();
      restoreScrollBehavior = null;
    }
  };

  navigationScrollFrame = window.requestAnimationFrame(step);
};

["wheel", "touchstart", "keydown"].forEach((eventName) => {
  window.addEventListener(eventName, cancelNavigationScroll, { passive: true });
});

document.querySelectorAll('.site-header nav a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    const target = document.querySelector(link.getAttribute("href"));
    if (!target) return;

    event.preventDefault();
    history.pushState(null, "", link.getAttribute("href"));
    smoothScrollTo(target);
  });
});

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const revealItems = document.querySelectorAll(".reveal");
const pageCanAnimate = !reduceMotion.matches;
const hero = document.querySelector(".hero");
const heroVisual = document.querySelector(".hero-visual");
const heroWindow = heroVisual?.querySelector(".hero-window");
const scrollHeadings = document.querySelectorAll(".scroll-heading");
const projectArts = document.querySelectorAll(".project-art");
let framePending = false;

if (pageCanAnimate && "IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12 });

  revealItems.forEach((item) => revealObserver.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("is-visible"));
}

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const updateScrollMotion = () => {
  if (framePending) return;
  framePending = true;

  window.requestAnimationFrame(() => {
    framePending = false;
    if (!pageCanAnimate) return;

    const viewportHeight = window.innerHeight || 1;

    if (hero && heroVisual) {
      const heroTop = hero.getBoundingClientRect().top;
      const heroTravel = clamp(-heroTop, 0, hero.offsetHeight);
      heroVisual.style.setProperty("--scroll-parallax", `${-heroTravel * 0.16}px`);
    }

    scrollHeadings.forEach((heading) => {
      const top = heading.getBoundingClientRect().top;
      const progress = clamp((viewportHeight * 0.88 - top) / (viewportHeight * 0.55));
      const remaining = 1 - progress;
      heading.style.setProperty("--heading-wipe", `${remaining * 100}%`);
      heading.style.setProperty("--heading-lift", `${remaining * 28}px`);
      heading.style.setProperty("--heading-rotate", `${remaining * 2}deg`);
    });

    projectArts.forEach((art, index) => {
      const top = art.getBoundingClientRect().top;
      const progress = clamp((viewportHeight * 0.94 - top - index * 42) / (viewportHeight * 0.72));
      const remaining = 1 - progress;
      art.style.setProperty("--scroll-opacity", `${progress}`);
      art.style.setProperty("--scroll-lift", `${remaining * 110}px`);
      art.style.setProperty("--scroll-rotate", `${remaining * 24}deg`);
      art.style.setProperty("--scroll-scale", `${0.82 + progress * 0.18}`);
      art.style.setProperty("--scroll-y", `${remaining * 24}px`);
    });
  });
};

window.addEventListener("scroll", updateScrollMotion, { passive: true });
window.addEventListener("resize", updateScrollMotion, { passive: true });
updateScrollMotion();

const setPointerTilt = (element, event, tiltXVar, tiltYVar, maxTilt = 12) => {
  if (event.pointerType === "touch") return;
  const bounds = element.getBoundingClientRect();
  const x = clamp((event.clientX - bounds.left) / bounds.width);
  const y = clamp((event.clientY - bounds.top) / bounds.height);
  element.style.setProperty(tiltXVar, `${(0.5 - y) * maxTilt}deg`);
  element.style.setProperty(tiltYVar, `${(x - 0.5) * maxTilt}deg`);
  element.style.setProperty("--pointer-x", `${x * 100}%`);
  element.style.setProperty("--pointer-y", `${y * 100}%`);
};

if (pageCanAnimate) {
  heroVisual?.addEventListener("pointermove", (event) => {
    if (heroWindow) setPointerTilt(heroWindow, event, "--hero-tilt-x", "--hero-tilt-y", 10);
  });
  heroVisual?.addEventListener("pointerleave", () => {
    heroWindow?.style.removeProperty("--hero-tilt-x");
    heroWindow?.style.removeProperty("--hero-tilt-y");
  });

  document.querySelectorAll(".project-art").forEach((art) => {
    art.addEventListener("pointermove", (event) => {
      setPointerTilt(art, event, "--tilt-x", "--tilt-y", 10);
    });
    art.addEventListener("pointerleave", () => {
      art.style.removeProperty("--tilt-x");
      art.style.removeProperty("--tilt-y");
      art.style.removeProperty("--pointer-x");
      art.style.removeProperty("--pointer-y");
    });
  });
}

const contactForm = document.querySelector("#contact-form");
if (contactForm) {
  contactForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!contactForm.reportValidity()) return;

    const formData = new FormData(contactForm);
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const message = String(formData.get("message") || "").trim();
    const subject = encodeURIComponent(`Portfolio message from ${name}`);
    const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\n${message}`);
    window.location.href = `mailto:developer@liamhuang.dev?subject=${subject}&body=${body}`;
  });
}
