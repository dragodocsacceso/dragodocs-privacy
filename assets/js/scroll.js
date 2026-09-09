/**
 * DragoDocs AI — Scroll Effects
 * Scroll reveal animations and active navigation tracking.
 */

(function () {
  'use strict';

  const WIN = window;
  const DOC = document;

  const prefersReducedMotion = WIN.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /**
   * Initialize scroll reveal animations
   */
  function initScrollReveal() {
    if (prefersReducedMotion) {
      DOC.querySelectorAll('.scroll-reveal, .scroll-reveal-left, .scroll-reveal-right, .scroll-reveal-scale').forEach((el) => {
        el.classList.add('is-visible');
      });
      return;
    }

    if (!('IntersectionObserver' in WIN)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        root: null,
        rootMargin: '0px 0px -50px 0px',
        threshold: 0.1,
      }
    );

    DOC.querySelectorAll('.scroll-reveal, .scroll-reveal-left, .scroll-reveal-right, .scroll-reveal-scale').forEach((el) => {
      observer.observe(el);
    });
  }

  /**
   * Initialize active nav link based on scroll position
   */
  function initActiveNavLink() {
    const sections = DOC.querySelectorAll('main section[id]');
    const navLinks = DOC.querySelectorAll('.nav-link[href^="#"]');
    const navbar = DOC.getElementById('navbar');

    if (sections.length === 0 || navLinks.length === 0) return;
    if (!('IntersectionObserver' in WIN)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('id');
            navLinks.forEach((link) => {
              link.classList.toggle('is-active', link.getAttribute('href') === `#${id}`);
            });
          }
        });
      },
      {
        rootMargin: `-${navbar ? navbar.offsetHeight + 50 : 80}px 0px -60% 0px`,
        threshold: 0,
      }
    );

    sections.forEach((section) => observer.observe(section));
  }

  /**
   * Initialize all scroll modules
   */
  function init() {
    initScrollReveal();
    initActiveNavLink();
  }

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
