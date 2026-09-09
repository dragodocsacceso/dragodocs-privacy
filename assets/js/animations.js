/**
 * DragoDocs AI — Animations (simplified)
 * Lightweight interactions only.
 */

(function () {
  'use strict';

  const DOC = document;

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

  function init() {
    initFaqBehavior();
  }

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
