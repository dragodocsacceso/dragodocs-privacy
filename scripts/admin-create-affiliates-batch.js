#!/usr/bin/env node
/* =========================================================
   DragoDocs AI — Alta de creadores EN LOTE (script de admin)
   ---------------------------------------------------------
   Da de alta TODOS los creadores definidos en creators-batch.json
   de una sola ejecución. Por cada creador crea/actualiza:
     1. Usuario de Firebase Auth (correo sintético <codigo>@<dominio>
        + contraseña) -> entra en la web con CÓDIGO + CONTRASEÑA.
     2. affiliates/{uid}       (perfil privado del creador).
     3. affiliateCodes/{CODIGO} (público: lo lee la app).
     4. leaderboard/{CODIGO}   (ranking).

   Es idempotente: re-ejecutarlo ACTUALIZA los existentes (por código),
   no los duplica.

   REQUISITOS (ver AFILIADOS-SETUP.md, mismos que el script individual):
     - Node 18+  ·  npm install firebase-admin
     - serviceAccountKey.json en la RAÍZ del repo (o GOOGLE_APPLICATION_CREDENTIALS).
     - El backend desplegado (Auth Email/Password, Firestore, reglas).

   USO:
     node scripts/admin-create-affiliates-batch.js
     node scripts/admin-create-affiliates-batch.js --file scripts/creators-batch.json --dry-run
   ========================================================= */

'use strict';

// firebase-admin se carga PEREZOSAMENTE dentro de main() (solo cuando se crean
// de verdad), para que --dry-run valide la lista sin necesitar la dependencia.
const path = require('path');
const fs = require('fs');

// Debe coincidir con AFFILIATE_EMAIL_DOMAIN en assets/js/firebase-config.js
const EMAIL_DOMAIN = 'creadores.dragodocs.app';

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
  const dryRun = args['dry-run'] === 'true' || args['dry-run'] === true;
  const file = args.file || path.resolve(process.cwd(), 'scripts', 'creators-batch.json');

  if (!fs.existsSync(file)) fail(`No se encontró el archivo de creadores: ${file}`);
  let creators;
  try {
    creators = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    fail(`El archivo ${file} no es un JSON válido: ${e.message}`);
  }
  if (!Array.isArray(creators) || creators.length === 0) {
    fail('El archivo debe ser un array de creadores no vacío.');
  }

  // Validación previa (falla ANTES de tocar Firebase si algo está mal).
  const codes = new Set();
  creators.forEach((c, i) => {
    const code = String(c.code || '').trim().toUpperCase();
    if (!code) fail(`Creador #${i + 1}: falta "code".`);
    if (codes.has(code)) fail(`Código duplicado en el archivo: ${code}`);
    codes.add(code);
    if (!c.password || String(c.password).length < 6) {
      fail(`Creador ${code}: "password" debe tener al menos 6 caracteres.`);
    }
  });

  console.log(`\n📋 ${creators.length} creadores en ${path.basename(file)}${dryRun ? '  (DRY-RUN, no escribe nada)' : ''}\n`);

  if (dryRun) {
    creators.forEach((c, i) => {
      const code = String(c.code).trim().toUpperCase();
      console.log(`${String(i + 1).padStart(2)}  ${code.padEnd(11)}  comisión ${((Number(c.commissionRate) || 0) * 100).toFixed(0)}%  ${c.discountProductId ? '(descuento: ' + c.discountProductId + ')' : '(sin descuento)'}`);
    });
    console.log('\n✅ Dry-run OK. Quita --dry-run para crearlos de verdad.');
    process.exit(0);
  }

  // ── Inicializar Admin SDK (API MODULAR: firebase-admin/app|auth|firestore) ──
  const { initializeApp, cert, applicationDefault } = require('firebase-admin/app');
  const { getAuth } = require('firebase-admin/auth');
  const { getFirestore, FieldValue } = require('firebase-admin/firestore');

  let credential;
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
    || path.resolve(process.cwd(), 'serviceAccountKey.json');
  if (fs.existsSync(keyPath)) {
    credential = cert(require(keyPath));
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    credential = applicationDefault();
  } else {
    fail('No se encontró serviceAccountKey.json ni GOOGLE_APPLICATION_CREDENTIALS. Ver AFILIADOS-SETUP.md.');
  }

  initializeApp({ credential });
  const auth = getAuth();
  const db = getFirestore();
  const now = FieldValue.serverTimestamp();

  let created = 0, updated = 0, failed = 0;

  for (const c of creators) {
    const code = String(c.code).trim().toUpperCase();
    const name = String(c.name || code).trim();
    const password = String(c.password);
    const commissionRate = c.commissionRate != null ? Number(c.commissionRate) : 0.20;
    const discountRate = c.discountRate != null ? Number(c.discountRate) : 0;
    const photoUrl = c.photoUrl || null;
    const discountProductId = c.discountProductId || null;
    const email = `${code.toLowerCase()}@${EMAIL_DOMAIN}`;

    try {
      // 1) Usuario de Auth
      let user;
      try {
        user = await auth.getUserByEmail(email);
        await auth.updateUser(user.uid, { password, displayName: name });
        updated++;
        console.log(`↻ ${code}  (actualizado)`);
      } catch (e) {
        if (e.code === 'auth/user-not-found') {
          user = await auth.createUser({ email, password, displayName: name });
          created++;
          console.log(`＋ ${code}  (creado)`);
        } else {
          throw e;
        }
      }
      const uid = user.uid;

      // 2) Perfil privado
      await db.collection('affiliates').doc(uid).set({
        code, name, photoUrl, commissionRate, discountRate,
        active: true, updatedAt: now, createdAt: now,
      }, { merge: true });

      // 3) Código público (lo lee la app)
      await db.collection('affiliateCodes').doc(code).set({
        code, uid, name, photoUrl, commissionRate, discountRate,
        discountProductId, active: true, updatedAt: now, createdAt: now,
      }, { merge: true });

      // 4) Ranking
      await db.collection('leaderboard').doc(code).set({
        code, name, photoUrl,
        totalRevenueMicros: 0, totalCommissionMicros: 0, salesCount: 0,
        updatedAt: now,
      }, { merge: true });
    } catch (e) {
      failed++;
      console.error(`❌ ${code}: ${e.message}`);
    }
  }

  console.log(`\n✅ Listo. Creados: ${created} · Actualizados: ${updated} · Fallidos: ${failed}`);
  console.log('   Cada creador entra en /afiliados.html con su CÓDIGO y su CONTRASEÑA.');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
