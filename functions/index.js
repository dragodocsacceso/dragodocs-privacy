/* =========================================================
   DragoDocs AI — Cloud Functions (Afiliados)
   ---------------------------------------------------------
   registerAffiliatePurchase: la app la llama DESPUÉS de que
   Google Play confirma una compra Premium con un código de
   creador aplicado.

   Qué hace (y por qué es segura):
   1. Exige App Check (Play Integrity) => solo la app real, no un
      APK clonado ni un bot, puede llamarla.
   2. VERIFICA el token de compra contra la API de Google Play
      (androidpublisher). Si la compra no es real / no está pagada,
      se rechaza. Esto impide "fingir" compras para inflar comisiones.
   3. Es idempotente: el id del documento es el hash del purchaseToken,
      así una misma compra no se cuenta dos veces.
   4. Escribe la compra + actualiza el ranking con el Admin SDK
      (salta las reglas), así el cliente nunca escribe datos sensibles.

   Requiere (ver AFILIADOS-SETUP.md):
   - Plan Blaze en Firebase.
   - API "Google Play Android Developer" habilitada en Google Cloud.
   - La cuenta de servicio de las Functions invitada en Play Console
     con permiso para ver información financiera / pedidos.
   ========================================================= */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { google } = require("googleapis");
const crypto = require("crypto");

initializeApp();
const db = getFirestore();

setGlobalOptions({ region: "us-central1", maxInstances: 10 });

// ⚠️ DEBE ser el applicationId real publicado en Google Play.
//    Coincide con app/build.gradle.kts (applicationId = "com.dragodocs.app").
const PACKAGE_NAME = "com.dragodocs.app";

// Cliente autenticado de la API de Google Play (usa las credenciales
// por defecto de la Cloud Function; esa cuenta de servicio debe estar
// invitada en Play Console).
let _publisher = null;
async function androidPublisher() {
  if (_publisher) return _publisher;
  const auth = new google.auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/androidpublisher"],
  });
  _publisher = google.androidpublisher({ version: "v3", auth });
  return _publisher;
}

function sha256(s) {
  return crypto.createHash("sha256").update(String(s)).digest("hex");
}

/**
 * Verifica el token contra Google Play y devuelve un objeto normalizado:
 *  { valid, orderId, purchaseTimeMillis, priceMicros, currency }
 * priceMicros/currency solo llegan de Play en suscripciones; para compra
 * única (INAPP) Play no devuelve precio y se resuelve fuera.
 */
async function verifyWithPlay(productType, productId, purchaseToken) {
  const publisher = await androidPublisher();

  if (productType === "subs") {
    const { data } = await publisher.purchases.subscriptions.get({
      packageName: PACKAGE_NAME,
      subscriptionId: productId,
      token: purchaseToken,
    });
    // paymentState: 0 pendiente, 1 recibido, 2 prueba gratis, 3 diferido.
    const paid = data.paymentState === 1 || data.paymentState === 2;
    return {
      valid: paid,
      orderId: data.orderId || null,
      purchaseTimeMillis: data.startTimeMillis ? Number(data.startTimeMillis) : Date.now(),
      priceMicros: data.priceAmountMicros ? Number(data.priceAmountMicros) : null,
      currency: data.priceCurrencyCode || null,
    };
  }

  // INAPP (compra única, p. ej. Premium de por vida)
  const { data } = await publisher.purchases.products.get({
    packageName: PACKAGE_NAME,
    productId: productId,
    token: purchaseToken,
  });
  // purchaseState: 0 comprado, 1 cancelado, 2 pendiente.
  return {
    valid: data.purchaseState === 0,
    orderId: data.orderId || null,
    purchaseTimeMillis: data.purchaseTimeMillis ? Number(data.purchaseTimeMillis) : Date.now(),
    priceMicros: null, // Play no lo devuelve para compra única.
    currency: null,
  };
}

exports.registerAffiliatePurchase = onCall(
  { enforceAppCheck: true },
  async (request) => {
    const d = request.data || {};
    const code = String(d.code || "").trim().toUpperCase();
    const productId = String(d.productId || "").trim();
    const purchaseToken = String(d.purchaseToken || "").trim();
    const productType = d.productType === "subs" ? "subs" : "inapp";
    const clientPriceMicros = Number(d.priceMicros) || null;
    const clientCurrency = d.currency ? String(d.currency) : null;
    const productLabel = d.product ? String(d.product).slice(0, 120) : null;

    if (!code || !productId || !purchaseToken) {
      throw new HttpsError("invalid-argument", "Faltan datos de la compra.");
    }

    // 1) El código debe existir y estar activo.
    const codeRef = db.collection("affiliateCodes").doc(code);
    const codeSnap = await codeRef.get();
    if (!codeSnap.exists) {
      throw new HttpsError("not-found", "Código de creador no encontrado.");
    }
    const codeData = codeSnap.data();
    if (codeData.active === false) {
      throw new HttpsError("failed-precondition", "El código del creador no está activo.");
    }
    const affiliateUid = codeData.uid;
    const commissionRate = Number(codeData.commissionRate) || 0;

    // 2) Idempotencia: una compra (token) = un documento.
    const purchaseId = sha256(purchaseToken);
    const purchaseRef = db.collection("purchases").doc(purchaseId);
    const existing = await purchaseRef.get();
    if (existing.exists) {
      return { ok: true, alreadyRegistered: true };
    }

    // 3) Verificar la compra REAL contra Google Play.
    let verified;
    try {
      verified = await verifyWithPlay(productType, productId, purchaseToken);
    } catch (err) {
      console.error("Error verificando con Google Play:", err && err.message);
      throw new HttpsError("internal", "No se pudo verificar la compra con Google Play.");
    }
    if (!verified.valid) {
      throw new HttpsError("failed-precondition", "La compra no es válida o no está pagada.");
    }

    // 4) Precio y comisión.
    //    Prioridad: precio verificado por Play (subs) > config products/{id} > dato del cliente.
    let priceMicros = verified.priceMicros;
    let currency = verified.currency;
    if (priceMicros == null) {
      const prodSnap = await db.collection("products").doc(productId).get();
      if (prodSnap.exists) {
        const p = prodSnap.data();
        priceMicros = Number(p.priceMicros) || null;
        currency = p.currency || currency;
      }
    }
    if (priceMicros == null) {
      priceMicros = clientPriceMicros; // último recurso (solo display)
      currency = currency || clientCurrency;
    }
    priceMicros = Number(priceMicros) || 0;
    currency = currency || "MXN";
    const commissionMicros = Math.round(priceMicros * commissionRate);

    const purchaseTime = Timestamp.fromMillis(verified.purchaseTimeMillis || Date.now());

    // 5) Escritura atómica: compra + ranking.
    //    Re-chequeo de idempotencia DENTRO de la transacción. El pre-chequeo del
    //    paso 2 es solo una optimización (evita llamar a Google Play para
    //    duplicados), pero dos llamadas casi simultáneas con el mismo token
    //    podrían pasarlo las dos. La transacción SÍ serializa: si el documento ya
    //    existe aquí, se aborta sin volver a incrementar el ranking (evita contar
    //    la misma venta dos veces). En Firestore, todas las lecturas de la
    //    transacción deben ir ANTES de cualquier escritura.
    const leaderRef = db.collection("leaderboard").doc(code);
    let committed = false;
    await db.runTransaction(async (tx) => {
      const dup = await tx.get(purchaseRef);
      if (dup.exists) return; // ya registrada por otra llamada concurrente

      tx.set(purchaseRef, {
        affiliateUid,
        code,
        product: productLabel || productId,
        productId,
        productType,
        priceMicros,
        currency,
        commissionRate,
        commissionMicros,
        status: "pending", // pasa a "paid" cuando liquides al creador
        orderId: verified.orderId,
        purchaseTimeMillis: verified.purchaseTimeMillis,
        purchaseTime,
        createdAt: FieldValue.serverTimestamp(),
      });

      tx.set(
        leaderRef,
        {
          code,
          name: codeData.name || code,
          photoUrl: codeData.photoUrl || null,
          totalRevenueMicros: FieldValue.increment(priceMicros),
          totalCommissionMicros: FieldValue.increment(commissionMicros),
          salesCount: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      committed = true;
    });

    // Si otra llamada concurrente ganó la carrera, la transacción no escribió:
    // respondemos como idempotente (igual que el pre-chequeo del paso 2).
    if (!committed) {
      return { ok: true, alreadyRegistered: true };
    }

    return { ok: true, commissionMicros, currency };
  }
);
