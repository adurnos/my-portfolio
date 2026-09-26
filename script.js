document.documentElement.classList.add("js");

const year = document.querySelector("#year");
if (year) year.textContent = new Date().getFullYear();

const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
const canAnimate = () => !motionPreference.matches;
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const scrollBehavior = () => motionPreference.matches ? "auto" : "smooth";

const revealItems = document.querySelectorAll(".reveal");
const hero = document.querySelector(".hero");
const heroVisual = document.querySelector(".hero-visual");
const heroWindow = heroVisual?.querySelector(".hero-window");
const scrollHeadings = document.querySelectorAll(".scroll-heading");
const projectArts = document.querySelectorAll(".project-art");
let scrollFramePending = false;

if ("IntersectionObserver" in window && canAnimate()) {
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

const updateScrollMotion = () => {
  if (scrollFramePending) return;
  scrollFramePending = true;

  window.requestAnimationFrame(() => {
    scrollFramePending = false;
    if (!canAnimate()) return;

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
    });
  });
};

window.addEventListener("scroll", updateScrollMotion, { passive: true });
window.addEventListener("resize", updateScrollMotion, { passive: true });
updateScrollMotion();

const setPointerTilt = (element, event, tiltXVar, tiltYVar, maxTilt = 12) => {
  if (event.pointerType === "touch") return;
  const bounds = element.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;
  const x = clamp((event.clientX - bounds.left) / bounds.width);
  const y = clamp((event.clientY - bounds.top) / bounds.height);
  element.style.setProperty(tiltXVar, `${(0.5 - y) * maxTilt}deg`);
  element.style.setProperty(tiltYVar, `${(x - 0.5) * maxTilt}deg`);
};

heroVisual?.addEventListener("pointermove", (event) => {
  if (canAnimate() && heroWindow) setPointerTilt(heroWindow, event, "--hero-tilt-x", "--hero-tilt-y", 10);
});

heroVisual?.addEventListener("pointerleave", () => {
  heroWindow?.style.removeProperty("--hero-tilt-x");
  heroWindow?.style.removeProperty("--hero-tilt-y");
});

document.querySelectorAll(".project-art").forEach((art) => {
  art.addEventListener("pointermove", (event) => {
    if (canAnimate()) setPointerTilt(art, event, "--tilt-x", "--tilt-y", 10);
  });
  art.addEventListener("pointerleave", () => {
    art.style.removeProperty("--tilt-x");
    art.style.removeProperty("--tilt-y");
  });
});

const projectList = document.querySelector(".project-list");
const projectCards = projectList ? [...projectList.querySelectorAll(".project")] : [];
const carouselStatus = document.querySelector(".carousel-status");
const previousProjectButton = document.querySelector('[data-carousel-direction="-1"]');
const nextProjectButton = document.querySelector('[data-carousel-direction="1"]');

if (projectList && projectCards.length) {
  let activeCardIndex = 0;
  let statusFramePending = false;
  let dragPointerId = null;
  let dragStartX = 0;
  let dragStartScrollLeft = 0;
  let isDragging = false;
  const isCarouselLayout = () => window.matchMedia("(max-width: 700px)").matches;

  const getContentStart = () => {
    const styles = window.getComputedStyle(projectList);
    return projectList.getBoundingClientRect().left + (Number.parseFloat(styles.paddingLeft) || 0);
  };

  const getCardOffset = (card) => card.getBoundingClientRect().left - getContentStart() + projectList.scrollLeft;

  const updateCarouselControls = () => {
    if (!isCarouselLayout()) {
      activeCardIndex = 0;
      if (carouselStatus) carouselStatus.textContent = `Project 1 of ${projectCards.length}`;
      if (previousProjectButton) previousProjectButton.disabled = true;
      if (nextProjectButton) nextProjectButton.disabled = true;
      return;
    }

    if (projectList.scrollLeft <= 2) {
      activeCardIndex = 0;
    } else if (projectList.scrollLeft + projectList.clientWidth >= projectList.scrollWidth - 2) {
      activeCardIndex = projectCards.length - 1;
    } else {
      const contentStart = getContentStart();
      let nearestDistance = Infinity;

      projectCards.forEach((card, index) => {
        const distance = Math.abs(card.getBoundingClientRect().left - contentStart);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          activeCardIndex = index;
        }
      });
    }

    if (carouselStatus) carouselStatus.textContent = `Project ${activeCardIndex + 1} of ${projectCards.length}`;
    if (previousProjectButton) previousProjectButton.disabled = activeCardIndex === 0;
    if (nextProjectButton) nextProjectButton.disabled = activeCardIndex === projectCards.length - 1;
  };

  const scheduleCarouselUpdate = () => {
    if (statusFramePending) return;
    statusFramePending = true;
    window.requestAnimationFrame(() => {
      statusFramePending = false;
      updateCarouselControls();
    });
  };

  const goToProject = (index) => {
    if (!isCarouselLayout()) return;
    const nextIndex = clamp(index, 0, projectCards.length - 1);
    projectList.scrollTo({ left: getCardOffset(projectCards[nextIndex]), behavior: scrollBehavior() });
  };

  previousProjectButton?.addEventListener("click", () => goToProject(activeCardIndex - 1));
  nextProjectButton?.addEventListener("click", () => goToProject(activeCardIndex + 1));
  projectList.addEventListener("scroll", scheduleCarouselUpdate, { passive: true });
  projectList.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "mouse" || event.button !== 0 || !isCarouselLayout() || projectList.scrollWidth <= projectList.clientWidth) return;
    dragPointerId = event.pointerId;
    dragStartX = event.clientX;
    dragStartScrollLeft = projectList.scrollLeft;
    isDragging = false;
    projectList.setPointerCapture(event.pointerId);
  });

  projectList.addEventListener("pointermove", (event) => {
    if (event.pointerId !== dragPointerId) return;
    const distanceX = event.clientX - dragStartX;
    if (!isDragging && Math.abs(distanceX) < 5) return;
    isDragging = true;
    projectList.classList.add("is-dragging");
    event.preventDefault();
    projectList.scrollLeft = dragStartScrollLeft - distanceX;
  });

  const stopProjectDrag = (event) => {
    if (event.pointerId !== dragPointerId) return;
    if (projectList.hasPointerCapture(event.pointerId)) projectList.releasePointerCapture(event.pointerId);
    projectList.classList.remove("is-dragging");
    dragPointerId = null;
    isDragging = false;
    updateCarouselControls();
  };

  projectList.addEventListener("pointerup", stopProjectDrag);
  projectList.addEventListener("pointercancel", stopProjectDrag);
  projectList.addEventListener("lostpointercapture", stopProjectDrag);
  projectList.addEventListener("keydown", (event) => {
    if (event.target !== projectList || !isCarouselLayout()) return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      goToProject(activeCardIndex + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      goToProject(activeCardIndex - 1);
    }
  });

  window.addEventListener("resize", updateCarouselControls, { passive: true });
  updateCarouselControls();
}

motionPreference.addEventListener?.("change", (event) => {
  if (event.matches) revealItems.forEach((item) => item.classList.add("is-visible"));
  updateScrollMotion();
});

const contactForm = document.querySelector("#contact-form");
contactForm?.addEventListener("submit", (event) => {
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
