#!/usr/bin/env node
/* =========================================================
   DragoDocs AI — Alta de creadores/afiliados (script de admin)
   ---------------------------------------------------------
   Crea, en una sola ejecución:
     1. Un usuario de Firebase Auth (correo sintético <codigo>@<dominio>
        + contraseña) para que el creador entre en la web con su
        CÓDIGO + CONTRASEÑA.
     2. El documento affiliates/{uid}  (perfil privado del creador).
     3. El documento affiliateCodes/{CODIGO} (público: lo lee la app
        para validar el código, mostrar el nombre y aplicar descuento).
     4. El documento leaderboard/{CODIGO} (para el ranking).
     5. (Opcional) products/{productId} con el precio de referencia.

   REQUISITOS:
     - Node 18+
     - Una clave de cuenta de servicio de Firebase (Configuración del
       proyecto → Cuentas de servicio → "Generar nueva clave privada").
       Guárdala como serviceAccountKey.json en la RAÍZ del repo, o
       exporta GOOGLE_APPLICATION_CREDENTIALS con su ruta.
     - Instala dependencias:  npm install firebase-admin

   USO (ejemplo):
     node scripts/admin-create-affiliate.js \
       --code DRAGO10 \
       --name "Juan Pérez" \
       --password "unaClaveSegura" \
       --commission 0.20 \
       --discount 0.10 \
       --photo "https://.../foto.jpg" \
       --discountProduct dragodocs_premium_lifetime_off10

   Vuelve a ejecutarlo con el mismo --code para ACTUALIZAR ese creador.
   ========================================================= */

'use strict';

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Debe coincidir con AFFILIATE_EMAIL_DOMAIN en assets/js/firebase-config.js
const EMAIL_DOMAIN = 'creadores.dragodocs.app';

// ── Parseo de argumentos --clave valor ───────────────────────────────────────
function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
      out[key] = val;
    }
  }
  return out;
}

function fail(msg) { console.error('❌ ' + msg); process.exit(1); }

async function main() {
  const args = parseArgs(process.argv);

  const code = (args.code || '').trim().toUpperCase();
  const name = (args.name || '').trim();
  const password = args.password || '';
  if (!code) fail('Falta --code (código del creador, ej: DRAGO10).');
  if (!name) fail('Falta --name (nombre del creador).');
  if (!password || password.length < 6) fail('Falta --password (mínimo 6 caracteres).');

  const commissionRate = args.commission != null ? Number(args.commission) : 0.20;
  const discountRate = args.discount != null ? Number(args.discount) : 0;
  const photoUrl = args.photo || null;
  const discountProductId = args.discountProduct || null;

  // ── Inicializar Admin SDK ──────────────────────────────────────────────────
  let credential;
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
    || path.resolve(process.cwd(), 'serviceAccountKey.json');
  if (fs.existsSync(keyPath)) {
    credential = admin.credential.cert(require(keyPath));
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    credential = admin.credential.applicationDefault();
  } else {
    fail('No se encontró serviceAccountKey.json ni GOOGLE_APPLICATION_CREDENTIALS. Ver AFILIADOS-SETUP.md.');
  }

  admin.initializeApp({ credential });
  const auth = admin.auth();
  const db = admin.firestore();

  const email = `${code.toLowerCase()}@${EMAIL_DOMAIN}`;

  // ── 1) Crear o actualizar el usuario de Auth ───────────────────────────────
  let user;
  try {
    user = await auth.getUserByEmail(email);
    await auth.updateUser(user.uid, { password, displayName: name });
    console.log(`↻ Usuario existente actualizado: ${email}`);
  } catch (e) {
    if (e.code === 'auth/user-not-found') {
      user = await auth.createUser({ email, password, displayName: name });
      console.log(`＋ Usuario creado: ${email}`);
    } else {
      throw e;
    }
  }
  const uid = user.uid;

  const now = admin.firestore.FieldValue.serverTimestamp();

  // ── 2) Perfil privado ──────────────────────────────────────────────────────
  await db.collection('affiliates').doc(uid).set({
    code, name, photoUrl, commissionRate, discountRate,
    active: true, updatedAt: now,
    createdAt: now,
  }, { merge: true });

  // ── 3) Código público (lo lee la app) ──────────────────────────────────────
  await db.collection('affiliateCodes').doc(code).set({
    code, uid, name, photoUrl,
    commissionRate, discountRate,
    discountProductId,          // null = sin descuento (solo comisión)
    active: true, updatedAt: now,
    createdAt: now,
  }, { merge: true });

  // ── 4) Ranking ─────────────────────────────────────────────────────────────
  await db.collection('leaderboard').doc(code).set({
    code, name, photoUrl,
    totalRevenueMicros: 0,
    totalCommissionMicros: 0,
    salesCount: 0,
    updatedAt: now,
  }, { merge: true });

  console.log('\n✅ Creador listo:');
  console.log(`   Código:      ${code}`);
  console.log(`   Nombre:      ${name}`);
  console.log(`   Comisión:    ${(commissionRate * 100).toFixed(0)}%`);
  console.log(`   Descuento:   ${(discountRate * 100).toFixed(0)}%${discountProductId ? '  (producto: ' + discountProductId + ')' : ''}`);
  console.log(`   Entra en:    /afiliados.html  con el código y la contraseña que definiste.`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
