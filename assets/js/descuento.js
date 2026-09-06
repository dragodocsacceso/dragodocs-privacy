/* =========================================================
   descuento.js — página pública "Código de descuento"
   Solo copia el código al portapapeles. Misma función que ya
   usa afiliados.js (assets/js/afiliados.js#copyText): se repite
   aquí porque esta página es pura (sin módulos ni Firebase) y
   no tiene sentido cargar ese archivo entero por una función.
   ========================================================= */
(function () {
  async function copyText(text, btn) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch {}
      document.body.removeChild(ta);
    }
    if (btn) {
      const label = btn.querySelector('span');
      const original = label ? label.textContent : '';
      btn.classList.add('is-copied');
      if (label) label.textContent = '¡Copiado!';
      setTimeout(() => {
        btn.classList.remove('is-copied');
        if (label) label.textContent = original;
      }, 1600);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('copyCodeBtn');
    const value = document.getElementById('codeValue');
    if (!btn || !value) return;
    btn.addEventListener('click', () => copyText(value.textContent.trim(), btn));
  });
})();
