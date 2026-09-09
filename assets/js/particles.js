/**
 * DragoDocs AI — Particles System
 * Lightweight canvas particle network for the hero section.
 */

(function () {
  'use strict';

  const WIN = window;
  const DOC = document;

  const prefersReducedMotion = WIN.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouchDevice = WIN.matchMedia('(pointer: coarse)').matches;

  function initParticles() {
    if (prefersReducedMotion || isTouchDevice) return;

    const canvas = DOC.getElementById('particles-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width, height;
    let particles = [];
    let mouse = { x: null, y: null };
    let animationId;
    let isActive = true;

    const config = {
      particleCount: 60,
      connectionDistance: 120,
      mouseDistance: 150,
      speed: 0.4,
      colors: ['#00F0FF', '#2979FF', '#7C4DFF', '#9D4EDD'],
    };

    function resize() {
      const parent = canvas.parentElement;
      width = parent.clientWidth;
      height = parent.clientHeight;
      canvas.width = width * WIN.devicePixelRatio;
      canvas.height = height * WIN.devicePixelRatio;
      ctx.scale(WIN.devicePixelRatio, WIN.devicePixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      createParticles();
    }

    function createParticles() {
      particles = [];
      for (let i = 0; i < config.particleCount; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * config.speed,
          vy: (Math.random() - 0.5) * config.speed,
          size: Math.random() * 2 + 1,
          color: config.colors[Math.floor(Math.random() * config.colors.length)],
          alpha: Math.random() * 0.5 + 0.3,
        });
      }
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < config.connectionDistance) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
            ctx.lineWidth = 1;
            ctx.globalAlpha = 1 - distance / config.connectionDistance;
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
        }

        if (mouse.x !== null && mouse.y !== null) {
          const dx = particles[i].x - mouse.x;
          const dy = particles[i].y - mouse.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < config.mouseDistance) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.strokeStyle = 'rgba(0, 240, 255, 0.2)';
            ctx.lineWidth = 1;
            ctx.globalAlpha = 1 - distance / config.mouseDistance;
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
        }
      }

      if (isActive) {
        animationId = requestAnimationFrame(draw);
      }
    }

    function onMouseMove(e) {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    }

    function onMouseLeave() {
      mouse.x = null;
      mouse.y = null;
    }

    function onVisibilityChange() {
      if (DOC.hidden) {
        isActive = false;
        if (animationId) cancelAnimationFrame(animationId);
      } else {
        isActive = true;
        draw();
      }
    }

    canvas.addEventListener('mousemove', onMouseMove, { passive: true });
    canvas.addEventListener('mouseleave', onMouseLeave);
    WIN.addEventListener('resize', () => {
      resize();
    });
    DOC.addEventListener('visibilitychange', onVisibilityChange);

    resize();
    draw();
  }

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', initParticles);
  } else {
    initParticles();
  }
})();
