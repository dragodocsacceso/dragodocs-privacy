/* =========================================================
   DragoDocs AI — Panel de Afiliados / Creadores (lógica)
   ---------------------------------------------------------
   - Login por CÓDIGO + CONTRASEÑA (sin correo visible).
     Por dentro usa Firebase Auth con un correo sintético
     <codigo>@<AFFILIATE_EMAIL_DOMAIN>.
   - Carga perfil, compras, comisiones y ranking desde Firestore.
   - Calcula ventas hoy/semana/mes y dibuja la gráfica (SVG propio).
   - Modo DEMO (?demo=1): rellena datos de ejemplo SIN tocar Firebase,
     para previsualizar el diseño antes de terminar la configuración.

   Nada de esto expone datos de otros creadores: las Reglas de
   Seguridad de Firestore restringen cada lectura al dueño.
   ========================================================= */

import { firebaseConfig, AFFILIATE_EMAIL_DOMAIN, FIREBASE_SDK_VERSION } from './firebase-config.js';

const CDN = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}`;
const PARAMS = new URLSearchParams(location.search);
const DEMO = PARAMS.get('demo') === '1';
const IS_CONFIGURED = !!firebaseConfig.appId && !firebaseConfig.appId.startsWith('REEMPLAZA');
const SHARE_BASE = `${location.origin}${location.pathname.replace(/afiliados\.html$/, '')}`;

// ── Referencias del DOM ──────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const views = {
  auth: $('authView'),
  loading: $('loadingView'),
  dashboard: $('dashboardView'),
};

let fb = null; // { app, auth, db, authMod, fsMod }

// ── Utilidades ───────────────────────────────────────────────────────────────
function showView(name) {
  Object.entries(views).forEach(([k, el]) => el.classList.toggle('is-hidden', k !== name));
}

function fmtMoneyMicros(micros, currency = 'MXN') {
  const value = (Number(micros) || 0) / 1e6;
  try {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(value);
  } catch {
    return value.toFixed(2) + ' ' + currency;
  }
}

function toDate(v) {
  // Acepta Timestamp de Firestore, número (millis) o Date.
  if (!v) return null;
  if (typeof v.toDate === 'function') return v.toDate();
  if (typeof v === 'number') return new Date(v);
  if (v instanceof Date) return v;
  if (v.seconds) return new Date(v.seconds * 1000);
  return null;
}

function fmtDate(d) {
  return d ? d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
}
function fmtTime(d) {
  return d ? d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '—';
}

function statusBadge(status) {
  const map = {
    paid: ['paid', 'Pagada'],
    pending: ['pending', 'Pendiente'],
    refunded: ['refunded', 'Reembolsada'],
  };
  const [cls, label] = map[status] || ['pending', 'Pendiente'];
  return `<span class="badge ${cls}">${label}</span>`;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// ── Carga perezosa del SDK de Firebase ───────────────────────────────────────
async function loadFirebase() {
  if (fb) return fb;
  const [appMod, authMod, fsMod] = await Promise.all([
    import(`${CDN}/firebase-app.js`),
    import(`${CDN}/firebase-auth.js`),
    import(`${CDN}/firebase-firestore.js`),
  ]);
  const app = appMod.initializeApp(firebaseConfig);
  const auth = authMod.getAuth(app);
  const db = fsMod.getFirestore(app);
  fb = { app, auth, db, authMod, fsMod };
  return fb;
}

// ── Login ────────────────────────────────────────────────────────────────────
function showLoginError(msg) {
  const box = $('loginError');
  $('loginErrorText').textContent = msg;
  box.classList.remove('is-hidden');
}
function clearLoginError() {
  $('loginError').classList.add('is-hidden');
}
function setLoginLoading(loading) {
  const btn = $('loginBtn');
  btn.disabled = loading;
  btn.innerHTML = loading ? '<span class="btn-spinner"></span>' : 'Entrar';
}

function mapAuthError(err) {
  const code = err && err.code ? err.code : '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Código o contraseña incorrectos.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.';
    case 'auth/network-request-failed':
      return 'Sin conexión. Revisa tu internet e inténtalo de nuevo.';
    case 'auth/operation-not-allowed':
      return 'El acceso por contraseña no está habilitado en Firebase todavía.';
    default:
      return 'No se pudo iniciar sesión. Inténtalo de nuevo.';
  }
}

async function handleLogin(e) {
  e.preventDefault();
  clearLoginError();
  const code = $('codeInput').value.trim().toUpperCase();
  const password = $('passwordInput').value;
  if (!code || !password) { showLoginError('Introduce tu código y tu contraseña.'); return; }
  if (!IS_CONFIGURED) {
    showLoginError('La conexión con Firebase aún no está configurada. Consulta AFILIADOS-SETUP.md.');
    return;
  }
  setLoginLoading(true);
  try {
    await loadFirebase();
    const email = `${code.toLowerCase()}@${AFFILIATE_EMAIL_DOMAIN}`;
    await fb.authMod.signInWithEmailAndPassword(fb.auth, email, password);
    // onAuthStateChanged se encarga de cargar el panel.
  } catch (err) {
    setLoginLoading(false);
    showLoginError(mapAuthError(err));
  }
}

// ── Carga de datos del creador ───────────────────────────────────────────────
async function fetchAffiliateData(uid) {
  const { doc, getDoc, collection, query, where, getDocs, orderBy } = fb.fsMod;

  const profSnap = await getDoc(doc(fb.db, 'affiliates', uid));
  if (!profSnap.exists()) throw new Error('Perfil de creador no encontrado.');
  const profile = { uid, ...profSnap.data() };

  const purSnap = await getDocs(query(
    collection(fb.db, 'purchases'),
    where('affiliateUid', '==', uid),
    orderBy('createdAt', 'desc'),
  ));
  const purchases = purSnap.docs.map((d) => d.data());

  // Ranking (colección pública, opcional). Si falla, no bloquea el panel.
  let rank = null, totalCreators = null;
  try {
    const lbSnap = await getDocs(query(
      collection(fb.db, 'leaderboard'),
      orderBy('totalRevenueMicros', 'desc'),
    ));
    const codes = lbSnap.docs.map((d) => d.id);
    const idx = codes.indexOf(profile.code);
    if (idx >= 0) { rank = idx + 1; totalCreators = codes.length; }
  } catch { /* ranking opcional */ }

  return { profile, purchases, rank, totalCreators };
}

// ── Cálculo de métricas ──────────────────────────────────────────────────────
function computeStats(purchases) {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startWeek = new Date(startToday); startWeek.setDate(startToday.getDate() - ((startToday.getDay() + 6) % 7)); // lunes
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const s = {
    currency: 'MXN',
    accumulated: 0, pending: 0, paid: 0,
    today: 0, todayAmount: 0,
    week: 0, weekAmount: 0,
    month: 0, monthAmount: 0,
    total: purchases.length,
  };

  purchases.forEach((p) => {
    if (p.currency) s.currency = p.currency;
    const commission = Number(p.commissionMicros) || 0;
    const price = Number(p.priceMicros) || 0;
    if (p.status !== 'refunded') s.accumulated += commission;
    if (p.status === 'pending') s.pending += commission;
    if (p.status === 'paid') s.paid += commission;

    const d = toDate(p.createdAt) || toDate(p.purchaseTimeMillis);
    if (d) {
      if (d >= startToday) { s.today++; s.todayAmount += price; }
      if (d >= startWeek) { s.week++; s.weekAmount += price; }
      if (d >= startMonth) { s.month++; s.monthAmount += price; }
    }
  });
  return s;
}

function monthlySeries(purchases, months = 6) {
  const now = new Date();
  const buckets = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleDateString('es-MX', { month: 'short' }),
      value: 0,
    });
  }
  const index = new Map(buckets.map((b, i) => [b.key, i]));
  purchases.forEach((p) => {
    if (p.status === 'refunded') return;
    const d = toDate(p.createdAt) || toDate(p.purchaseTimeMillis);
    if (!d) return;
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (index.has(key)) buckets[index.get(key)].value += (Number(p.commissionMicros) || 0) / 1e6;
  });
  return buckets;
}

// ── Gráfica (SVG dibujado a mano, sin librerías) ─────────────────────────────
function renderChart(container, series, currency) {
  if (!series.length || series.every((s) => s.value === 0)) {
    container.innerHTML = '<div class="chart-empty">Aún no hay datos suficientes para la gráfica.</div>';
    return;
  }
  const W = 700, H = 240, padL = 56, padR = 18, padT = 18, padB = 34;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const baseline = padT + innerH;
  const max = Math.max(...series.map((s) => s.value)) || 1;
  const niceMax = max * 1.15;
  const stepX = series.length > 1 ? innerW / (series.length - 1) : 0;
  const xAt = (i) => padL + stepX * i;
  const yAt = (v) => padT + innerH - (v / niceMax) * innerH;

  const pts = series.map((s, i) => [xAt(i), yAt(s.value)]);
  const linePath = pts.map((p, i) => `${i ? 'L' : 'M'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const areaPath =
    `M ${xAt(0).toFixed(1)} ${baseline} ` +
    pts.map((p) => `L ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ') +
    ` L ${xAt(series.length - 1).toFixed(1)} ${baseline} Z`;

  const gridCount = 4;
  let grid = '';
  for (let g = 0; g <= gridCount; g++) {
    const val = (niceMax / gridCount) * g;
    const y = yAt(val);
    grid += `<line class="chart-grid" x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}"/>`;
    grid += `<text class="chart-axis-label" x="${padL - 8}" y="${(y + 3).toFixed(1)}" text-anchor="end">${fmtMoneyMicros(val * 1e6, currency).replace(/\.00$/, '')}</text>`;
  }

  const xLabels = series.map((s, i) =>
    `<text class="chart-axis-label" x="${xAt(i).toFixed(1)}" y="${H - 10}" text-anchor="middle">${escapeHtml(s.label)}</text>`
  ).join('');

  const dots = pts.map((p) => `<circle class="chart-dot" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.5"/>`).join('');

  container.innerHTML = `
    <svg class="chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Gráfica de crecimiento de comisiones">
      <defs>
        <linearGradient id="affGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--color-cyan)" stop-opacity="0.6"/>
          <stop offset="100%" stop-color="var(--color-cyan)" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${grid}
      <path class="chart-area" d="${areaPath}"/>
      <path class="chart-line" d="${linePath}"/>
      ${dots}
      ${xLabels}
    </svg>`;
}

// ── Render del dashboard ─────────────────────────────────────────────────────
function renderDashboard(data) {
  const { profile, purchases, rank, totalCreators } = data;
  const stats = computeStats(purchases);
  const currency = stats.currency;

  // Cabecera
  $('creatorName').textContent = profile.name || profile.code || 'Creador';
  if (profile.photoUrl) $('creatorAvatar').src = profile.photoUrl;
  $('creatorRank').textContent = rank
    ? `Ranking global: #${rank}${totalCreators ? ' de ' + totalCreators : ''}`
    : 'Ranking global: sin datos';

  // Código + enlace
  $('codeValue').textContent = profile.code || '—';
  $('shareLink').value = `${SHARE_BASE}?ref=${encodeURIComponent(profile.code || '')}`;

  // Comisiones
  $('statAccumulated').textContent = fmtMoneyMicros(stats.accumulated, currency);
  $('statPending').textContent = fmtMoneyMicros(stats.pending, currency);
  $('statPaid').textContent = fmtMoneyMicros(stats.paid, currency);

  // Ventas por periodo
  $('statToday').textContent = stats.today;
  $('statTodayAmount').textContent = fmtMoneyMicros(stats.todayAmount, currency);
  $('statWeek').textContent = stats.week;
  $('statWeekAmount').textContent = fmtMoneyMicros(stats.weekAmount, currency);
  $('statMonth').textContent = stats.month;
  $('statMonthAmount').textContent = fmtMoneyMicros(stats.monthAmount, currency);
  $('statTotalSales').textContent = stats.total;

  // Gráfica
  renderChart($('chart'), monthlySeries(purchases), currency);

  // Historial
  const body = $('historyBody');
  const empty = $('historyEmpty');
  if (!purchases.length) {
    body.innerHTML = '';
    empty.classList.remove('is-hidden');
  } else {
    empty.classList.add('is-hidden');
    body.innerHTML = purchases.map((p) => {
      const d = toDate(p.createdAt) || toDate(p.purchaseTimeMillis);
      return `<tr>
        <td class="num">${fmtDate(d)}</td>
        <td class="num">${fmtTime(d)}</td>
        <td>${escapeHtml(p.product || p.productId || 'Premium')}</td>
        <td class="num">${fmtMoneyMicros(p.priceMicros, p.currency || currency)}</td>
        <td class="num">${escapeHtml(p.code || profile.code || '')}</td>
        <td class="commission">${fmtMoneyMicros(p.commissionMicros, p.currency || currency)}</td>
        <td>${statusBadge(p.status)}</td>
      </tr>`;
    }).join('');
  }

  showView('dashboard');
}

// ── Sesión ───────────────────────────────────────────────────────────────────
async function onLoggedIn(user) {
  showView('loading');
  try {
    const data = await fetchAffiliateData(user.uid);
    renderDashboard(data);
  } catch (err) {
    setLoginLoading(false);
    showView('auth');
    showLoginError('No se pudo cargar tu panel: ' + (err.message || 'error desconocido.'));
    try { await fb.authMod.signOut(fb.auth); } catch {}
  }
}

async function handleLogout() {
  if (fb) { try { await fb.authMod.signOut(fb.auth); } catch {} }
  setLoginLoading(false);
  $('loginForm').reset();
  showView('auth');
}

// ── Copiar / compartir ───────────────────────────────────────────────────────
async function copyText(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch {}
    document.body.removeChild(ta);
  }
  if (btn) {
    const label = btn.querySelector('span');
    const original = label ? label.textContent : '';
    btn.classList.add('is-copied');
    if (label) label.textContent = '¡Copiado!';
    setTimeout(() => { btn.classList.remove('is-copied'); if (label) label.textContent = original; }, 1600);
  }
}

// ── Wiring de la UI ──────────────────────────────────────────────────────────
function wireUI() {
  const yearEl = $('currentYear');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  $('loginForm').addEventListener('submit', handleLogin);
  $('logoutBtn').addEventListener('click', handleLogout);

  $('revealBtn').addEventListener('click', () => {
    const input = $('passwordInput');
    input.type = input.type === 'password' ? 'text' : 'password';
    $('revealBtn').setAttribute('aria-label', input.type === 'password' ? 'Mostrar contraseña' : 'Ocultar contraseña');
  });

  $('copyCodeBtn').addEventListener('click', () => copyText($('codeValue').textContent.trim(), $('copyCodeBtn')));
  $('copyLinkBtn').addEventListener('click', () => copyText($('shareLink').value, $('copyLinkBtn')));

  // Prefijar código desde ?ref= (comodidad para el creador)
  const ref = PARAMS.get('ref');
  if (ref && !DEMO) $('codeInput').value = ref.toUpperCase();
}

// ── Datos de demostración (?demo=1) ──────────────────────────────────────────
function demoData() {
  const now = Date.now();
  const day = 86400000;
  const products = [
    ['Premium de por vida', 'dragodocs_premium_lifetime', 149000000],
    ['Premium anual', 'dragodocs_premium_yearly', 99000000],
    ['Premium mensual', 'dragodocs_premium_monthly', 19000000],
  ];
  const rate = 0.20;
  const purchases = [];
  const offsets = [0, 0, 1, 2, 4, 9, 15, 22, 38, 51, 66, 80, 95, 120];
  offsets.forEach((off, i) => {
    const [name, pid, price] = products[i % products.length];
    const status = i % 5 === 0 ? 'pending' : (i % 7 === 0 ? 'refunded' : 'paid');
    purchases.push({
      product: name, productId: pid,
      priceMicros: price, currency: 'MXN',
      commissionMicros: Math.round(price * rate),
      commissionRate: rate,
      code: 'DRAGO10', affiliateUid: 'demo',
      status,
      createdAt: now - off * day - i * 3600000,
    });
  });
  return {
    profile: {
      uid: 'demo', code: 'DRAGO10', name: 'Creador de Demostración',
      photoUrl: 'assets/images/logo.png', commissionRate: rate,
    },
    purchases,
    rank: 3, totalCreators: 27,
  };
}

// ── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  wireUI();

  if (DEMO) {
    $('configBanner').classList.remove('is-hidden');
    renderDashboard(demoData());
    return;
  }

  if (!IS_CONFIGURED) {
    $('configBanner').classList.remove('is-hidden');
    showView('auth');
    return;
  }

  // Configurado: cargar Firebase y observar la sesión (restaura si ya había login).
  try {
    await loadFirebase();
    fb.authMod.onAuthStateChanged(fb.auth, (user) => {
      if (user) onLoggedIn(user);
      else { setLoginLoading(false); showView('auth'); }
    });
  } catch (err) {
    $('configBanner').classList.remove('is-hidden');
    showView('auth');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
