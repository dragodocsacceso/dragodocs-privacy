/**
 * DragoDocs AI — Main JavaScript
 * Initializes core functionality and coordinates modules.
 */

(function () {
  'use strict';

  const DOC = document;
  const WIN = window;
  const BODY = DOC.body;

  /**
   * Throttle helper
   */
  function throttle(fn, limit = 100) {
    let inThrottle;
    return function (...args) {
      if (!inThrottle) {
        fn.apply(this, args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  }

  /**
   * Initialize navbar scroll state
   */
  function initNavbar() {
    const navbar = DOC.getElementById('navbar');
    if (!navbar) return;

    function updateNavbar() {
      navbar.classList.toggle('is-scrolled', WIN.scrollY > 20);
    }

    WIN.addEventListener('scroll', throttle(updateNavbar, 50), { passive: true });
    updateNavbar();
  }

  /**
   * Initialize mobile menu
   */
  function initMobileMenu() {
    const toggle = DOC.getElementById('mobileMenuToggle');
    const navLinks = DOC.getElementById('navLinks');
    if (!toggle || !navLinks) return;

    function setMenu(open) {
      toggle.classList.toggle('is-open', open);
      navLinks.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
      BODY.classList.toggle('menu-open', open);
    }

    toggle.addEventListener('click', () => setMenu(!toggle.classList.contains('is-open')));

    navLinks.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => setMenu(false));
    });

    DOC.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && toggle.classList.contains('is-open')) {
        setMenu(false);
      }
    });
  }

  /**
   * Initialize smooth scroll for anchor links
   */
  function initSmoothScroll() {
    const prefersReducedMotion = WIN.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const navbar = DOC.getElementById('navbar');

    DOC.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (href === '#') return;

        const target = DOC.querySelector(href);
        if (!target) return;

        e.preventDefault();

        const offset = navbar ? navbar.offsetHeight + 20 : 80;
        const targetPosition = target.getBoundingClientRect().top + WIN.scrollY - offset;

        WIN.scrollTo({
          top: targetPosition,
          behavior: prefersReducedMotion ? 'auto' : 'smooth',
        });

        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      });
    });
  }

  /**
   * Initialize back to top button
   */
  function initBackToTop() {
    const backToTop = DOC.getElementById('backToTop');
    if (!backToTop) return;

    const prefersReducedMotion = WIN.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function updateVisibility() {
      backToTop.classList.toggle('is-visible', WIN.scrollY > 500);
    }

    backToTop.addEventListener('click', () => {
      WIN.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    });

    WIN.addEventListener('scroll', throttle(updateVisibility, 100), { passive: true });
    updateVisibility();
  }

  /**
   * Initialize current year in footer
   */
  function initCurrentYear() {
    const yearEl = DOC.getElementById('currentYear');
    if (yearEl) yearEl.textContent = String(new Date().getFullYear());
  }

  /**
   * Initialize lazy loading for images
   */
  function initLazyLoading() {
    if ('loading' in HTMLImageElement.prototype) {
      DOC.querySelectorAll('img[data-src]').forEach((img) => {
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
        img.classList.add('is-loaded');
      });
      return;
    }

    if (!('IntersectionObserver' in WIN)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target;
            if (img.dataset.src) {
              img.src = img.dataset.src;
              img.onload = () => img.classList.add('is-loaded');
              img.removeAttribute('data-src');
            }
            observer.unobserve(img);
          }
        });
      },
      { rootMargin: '200px' }
    );

    DOC.querySelectorAll('img[data-src]').forEach((img) => observer.observe(img));
  }

  /**
   * Initialize all modules
   */
  function init() {
    initNavbar();
    initMobileMenu();
    initSmoothScroll();
    initBackToTop();
    initCurrentYear();
    initLazyLoading();
  }

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
