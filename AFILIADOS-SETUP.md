# Programa de Afiliados — Guía de configuración

Todo el **código** ya está listo (web + Firebase + app Android). Aquí tienes,
paso a paso, **lo único que debes configurar tú** (no se puede automatizar
porque toca tus cuentas de Firebase y Google Play).

> Proyecto Firebase: **dragodocs** · Paquete de la app: **com.dragodocs.app**
> Región de las Functions: **us-central1** · Dominio de correo interno: **creadores.dragodocs.app**

Sigue las secciones **en orden**. Al final tienes una checklist.

---

## 0) Requisitos previos (una vez)

Instala en tu PC:

```bash
npm install -g firebase-tools     # CLI de Firebase
firebase login                    # inicia sesión con tu cuenta de Google
```

---

## 1) Registrar la app **Web** en Firebase  → obtener el `appId`

1. [Firebase Console](https://console.firebase.google.com/) → proyecto **dragodocs**.
2. ⚙️ **Configuración del proyecto** → pestaña **Tus apps** → botón **</> (Web)**.
3. Apodo: `DragoDocs Web`. **No** marques Hosting. Registrar.
4. Copia el `appId` (formato `1:147932026481:web:xxxxxxxx`).
5. Pégalo en **`assets/js/firebase-config.js`**, en el campo `appId`
   (reemplaza `REEMPLAZA_CON_APP_ID_WEB`). El resto ya está bien.

---

## 2) Activar el acceso por **contraseña** (Authentication)

1. Firebase Console → **Authentication** → **Comenzar** (si no lo has hecho).
2. Pestaña **Sign-in method** → habilita **Correo electrónico/contraseña**.
   - El creador entra con **código + contraseña**; por dentro se usa un correo
     sintético `<codigo>@creadores.dragodocs.app` que él **nunca ve**.

---

## 3) Desplegar **reglas** e **índices** de Firestore

Desde la carpeta del repo web (`dragodocs-privacy`):

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

Esto sube `firestore.rules` (seguridad) y `firestore.indexes.json`
(índice de compras). Si es tu primera vez con Firestore, crea la base de datos
en **Firestore Database → Crear base de datos → modo Producción**.

---

## 4) Subir el plan a **Blaze** (necesario para las Cloud Functions)

1. Firebase Console → ⚙️ **Uso y facturación** → **Plan** → **Blaze (pago por uso)**.
2. Tiene capa gratuita amplia; con poco tráfico el costo suele ser **$0**.
   Puedes ponerle un **presupuesto/alerta** por tranquilidad.

---

## 5) Habilitar la **API de Google Play** para verificar compras

La Cloud Function verifica cada compra contra Google Play. Necesita permiso:

1. **Google Cloud Console** (mismo proyecto `dragodocs`) →
   [APIs y servicios] → habilita **“Google Play Android Developer API”**.
2. Averigua la **cuenta de servicio** que usan tus Functions:
   normalmente `dragodocs@appspot.gserviceaccount.com`
   (Firebase Console → Configuración → Cuentas de servicio).
3. **Google Play Console** → **Usuarios y permisos** → **Invitar nuevo usuario**
   → pega el correo de esa cuenta de servicio → dale permiso a nivel de app
   para **“Ver información financiera, pedidos y respuestas de encuestas de cancelación”**
   (y “Ver datos financieros”). Guarda.
   - *(Puede tardar unos minutos/horas en propagarse.)*

---

## 6) Desplegar la **Cloud Function**

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

Esto publica `registerAffiliatePurchase` (con **App Check** obligatorio).

---

## 7) App Check para la app Android

Tu app **ya** tiene App Check con Play Integrity configurado. Solo asegúrate en
Firebase Console → **App Check**:

1. La app `com.dragodocs.app` aparece **registrada** con **Play Integrity**.
2. En la pestaña **APIs**, marca **Cloud Functions** con **Enforce** (obligatorio).
   *(No fuerces App Check en Firestore: la web no usa App Check y se rompería.
   La seguridad de Firestore ya la dan las Reglas del paso 3.)*

---

## 8) Crear los **productos con descuento** en Play Console

Google Play tiene **precios fijos por producto**: para dar un 10% de descuento
hay que crear un **producto aparte** más barato.

1. Play Console → tu app → **Monetización → Productos → Productos integrados**
   (o **Suscripciones**, según corresponda).
2. Duplica tu producto Premium con un ID nuevo y el **precio ya rebajado**, p. ej.:
   - Base: `dragodocs_premium_lifetime`  →  Descuento: `dragodocs_premium_lifetime_off10`
3. Activa el producto. Ese **ID con descuento** es el que pondrás en el creador
   (campo `discountProductId`, paso 9).
   - Si un creador **no** debe dar descuento (solo comisión), deja `discountProductId` vacío.

*(Opcional pero recomendado)* Para que la comisión de la **compra única** se
calcule con un precio fiable en el servidor, crea en Firestore un documento
`products/<ID_del_producto>` con `{ priceMicros: <precio*1000000>, currency: "MXN" }`.
Para **suscripciones** no hace falta: el precio lo devuelve Google Play.

---

## 9) Dar de alta un **creador** (cuando quieras)

Aún **no** hay ningún creador registrado (como pediste). Cuando quieras crear uno:

1. Firebase Console → ⚙️ → **Cuentas de servicio** → **Generar nueva clave privada**.
   Guarda el archivo como **`serviceAccountKey.json`** en la raíz del repo web.
   *(Está en `.gitignore`; NO lo subas a GitHub.)*
2. Instala la dependencia y ejecuta el script:

```bash
npm install firebase-admin
node scripts/admin-create-affiliate.js \
  --code DRAGO10 \
  --name "Nombre del Creador" \
  --password "unaClaveSegura" \
  --commission 0.20 \
  --discount 0.10 \
  --photo "https://url-de-la-foto.jpg" \
  --discountProduct dragodocs_premium_lifetime_off10
```

- `--commission 0.20` = 20% de comisión para el creador.
- `--discount 0.10` = 10% (informativo) · `--discountProduct` = ID del producto rebajado.
- Omite `--discountProduct` si ese creador solo da comisión sin bajar el precio.
- Vuelve a ejecutarlo con el mismo `--code` para **actualizar** al creador.

El creador ya podrá entrar en **`/afiliados.html`** con su **código** y **contraseña**.

---

## 10) Publicar la web (GitHub Pages)

La web es solo frontend. Cuando quieras publicar los cambios:

```bash
git add -A
git commit -m "Añade sección de Afiliados"
git push
```

GitHub Pages se actualiza solo tras el push. *(Yo no haré el push sin tu permiso.)*

---

## 11) App Android

Las dependencias (`firebase-firestore`, `firebase-functions`) ya están añadidas.
Solo **recompila y publica** la app como siempre (Android Studio → Build → AAB).
El apartado **“¿Tienes un código de creador?”** aparece en el diálogo de compra Premium.

---

## ✅ Checklist rápida

- [ ] `appId` web pegado en `assets/js/firebase-config.js` (paso 1)
- [ ] Auth por Correo/Contraseña habilitado (paso 2)
- [ ] Reglas e índices de Firestore desplegados (paso 3)
- [ ] Plan Blaze activado (paso 4)
- [ ] API de Google Play habilitada + cuenta de servicio invitada en Play Console (paso 5)
- [ ] Cloud Function desplegada (paso 6)
- [ ] App Check: Cloud Functions en modo *Enforce* (paso 7)
- [ ] Producto(s) con descuento creados en Play Console (paso 8)
- [ ] (Cuando toque) Creador dado de alta con el script (paso 9)
- [ ] Web publicada con `git push` (paso 10)
- [ ] App recompilada y publicada (paso 11)

---

## Cómo probar sin terminar todo

- **Diseño del panel sin Firebase:** abre `afiliados.html?demo=1` → verás el
  dashboard con datos de ejemplo.
- **Login real:** requiere pasos 1–3 + un creador (paso 9).
- **Registro de compras real:** requiere pasos 4–8 y una compra Premium de prueba
  con un código aplicado.

## Modelo de datos (referencia)

| Colección | Quién escribe | Quién lee | Contenido |
|---|---|---|---|
| `affiliateCodes/{CODIGO}` | Admin/script | Público (app) | nombre, uid, comisión, descuento, `discountProductId`, activo |
| `affiliates/{uid}` | Admin/script | Solo el dueño | perfil del creador |
| `purchases/{hash}` | Solo Cloud Function | Solo el dueño | compra verificada, comisión, estado (nunca se borra) |
| `leaderboard/{CODIGO}` | Solo Cloud Function | Público | totales para el ranking |
| `products/{productId}` | Admin (opcional) | Público | precio de referencia para comisión |

**Estado de comisión:** cada compra nace como `pending`. Cuando le pagues al
creador, cambia su campo `status` a `paid` en Firestore (a mano o con un script).
