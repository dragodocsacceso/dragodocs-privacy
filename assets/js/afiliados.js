/* =========================================================
   DragoDocs AI — Panel de Afiliados / Creadores (lógica)
   ---------------------------------------------------------
   Panel SIMPLE: el creador entra con CÓDIGO + CONTRASEÑA y ve
   solo cuántas compras se han hecho con su código, su ranking y
   un historial básico (fecha, hora, producto, estado). Sin montos
   de comisión (esos se guardan en Firebase para el administrador).

   Login por correo sintético <codigo>@<AFFILIATE_EMAIL_DOMAIN>.
   Modo DEMO (?demo=1): datos de ejemplo sin tocar Firebase.
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

function toDate(v) {
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
    pending: ['pending', 'Registrada'],
    refunded: ['refunded', 'Reembolsada'],
  };
  const [cls, label] = map[status] || ['pending', 'Registrada'];
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
  $('loginErrorText').textContent = msg;
  $('loginError').classList.remove('is-hidden');
}
function clearLoginError() { $('loginError').classList.add('is-hidden'); }
function setLoginLoading(loading) {
  const btn = $('loginBtn');
  btn.disabled = loading;
  btn.innerHTML = loading ? '<span class="btn-spinner"></span>' : 'Entrar';
}

function mapAuthError(err) {
  switch (err && err.code) {
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

  // Ranking por NÚMERO de compras (colección pública). Si falla, no bloquea.
  let rank = null, totalCreators = null;
  try {
    const lbSnap = await getDocs(query(
      collection(fb.db, 'leaderboard'),
      orderBy('salesCount', 'desc'),
    ));
    const codes = lbSnap.docs.map((d) => d.id);
    const idx = codes.indexOf(profile.code);
    if (idx >= 0) { rank = idx + 1; totalCreators = codes.length; }
  } catch { /* ranking opcional */ }

  return { profile, purchases, rank, totalCreators };
}

// ── Render del dashboard ─────────────────────────────────────────────────────
function renderDashboard(data) {
  const { profile, purchases, rank, totalCreators } = data;

  // Cabecera
  $('creatorName').textContent = profile.name || profile.code || 'Creador';
  if (profile.photoUrl) $('creatorAvatar').src = profile.photoUrl;
  $('creatorRank').textContent = rank
    ? `Ranking global: #${rank}${totalCreators ? ' de ' + totalCreators : ''}`
    : 'Ranking global: sin datos';

  // Código + enlace
  $('codeValue').textContent = profile.code || '—';
  $('shareLink').value = `${SHARE_BASE}?ref=${encodeURIComponent(profile.code || '')}`;

  // Resumen simple
  $('statTotalSales').textContent = purchases.length;
  $('statRank').textContent = rank ? `#${rank}` : '—';

  // Historial básico (fecha, hora, producto, estado)
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

  const ref = PARAMS.get('ref');
  if (ref && !DEMO) $('codeInput').value = ref.toUpperCase();
}

// ── Datos de demostración (?demo=1) ──────────────────────────────────────────
function demoData() {
  const now = Date.now();
  const day = 86400000;
  const products = ['Premium anual', 'Premium mensual'];
  const purchases = [];
  const offsets = [0, 0, 1, 2, 4, 9, 15, 22, 38, 51, 66, 80, 95, 120];
  offsets.forEach((off, i) => {
    purchases.push({
      product: products[i % products.length],
      code: 'DRAGO10', affiliateUid: 'demo',
      status: i % 5 === 0 ? 'pending' : (i % 7 === 0 ? 'refunded' : 'paid'),
      createdAt: now - off * day - i * 3600000,
    });
  });
  return {
    profile: { uid: 'demo', code: 'DRAGO10', name: 'Creador de Demostración', photoUrl: 'assets/images/logo.png' },
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
