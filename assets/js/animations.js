/**
 * DragoDocs AI — Animations
 * Hover effects, parallax, card interactions and FAQ behavior.
 */

(function () {
  'use strict';

  const WIN = window;
  const DOC = document;

  const prefersReducedMotion = WIN.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouchDevice = WIN.matchMedia('(pointer: coarse)').matches;

  /**
   * Initialize 3D tilt effect on cards
   */
  function initCardTilt() {
    if (isTouchDevice || prefersReducedMotion) return;

    DOC.querySelectorAll('.feature-card, .premium-card, .tech-item, .security-card').forEach((card) => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = (y - centerY) / 25;
        const rotateY = (centerX - x) / 25;

        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-6px)`;
      });

      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
      });
    });
  }

  /**
   * Initialize hero parallax
   */
  function initHeroParallax() {
    if (prefersReducedMotion || isTouchDevice) return;

    const hero = DOC.querySelector('.hero');
    if (!hero) return;

    let ticking = false;

    function updateParallax() {
      const scrollY = WIN.scrollY;
      const heroHeight = hero.offsetHeight;

      if (scrollY < heroHeight) {
        const heroBg = hero.querySelector('.hero-bg');
        const heroLogo = hero.querySelector('.hero-logo');
        const heroTitle = hero.querySelector('.hero-title');

        if (heroBg) heroBg.style.transform = `translateY(${scrollY * 0.3}px)`;
        if (heroLogo) heroLogo.style.transform = `translateY(${scrollY * -0.1}px)`;
        if (heroTitle) heroTitle.style.transform = `translateY(${scrollY * -0.05}px)`;
      }

      ticking = false;
    }

    WIN.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(updateParallax);
        ticking = true;
      }
    }, { passive: true });

    updateParallax();
  }

  /**
   * Initialize FAQ auto-close behavior
   */
  function initFaqBehavior() {
    const faqItems = DOC.querySelectorAll('.faq-item');
    if (faqItems.length === 0) return;

    faqItems.forEach((item) => {
      item.addEventListener('toggle', () => {
        if (item.open) {
          faqItems.forEach((other) => {
            if (other !== item && other.open) {
              other.open = false;
            }
          });
        }
      });
    });
  }

  /**
   * Initialize glow effects on interactive elements
   */
  function initGlowEffects() {
    if (isTouchDevice) return;

    DOC.querySelectorAll('.btn, .nav-link, .footer-links a, .support-option, .faq-question').forEach((el) => {
      el.addEventListener('focus', () => el.classList.add('focus-glow'));
      el.addEventListener('blur', () => el.classList.remove('focus-glow'));
    });
  }

  /**
   * Initialize magnetic buttons
   */
  function initMagneticButtons() {
    if (isTouchDevice || prefersReducedMotion) return;

    DOC.querySelectorAll('.btn-primary').forEach((btn) => {
      btn.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        btn.style.transform = `translate(${x * 0.12}px, ${y * 0.12}px)`;
      });

      btn.addEventListener('mouseleave', () => {
        btn.style.transform = '';
      });
    });
  }

  /**
   * Initialize all animation modules
   */
  function init() {
    initCardTilt();
    initHeroParallax();
    initFaqBehavior();
    initGlowEffects();
    initMagneticButtons();
  }

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
