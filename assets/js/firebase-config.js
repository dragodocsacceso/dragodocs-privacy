/* =========================================================
   DragoDocs AI — Configuración de Firebase (SOLO frontend)
   ---------------------------------------------------------
   Este es el ÚNICO archivo que debes editar para conectar la
   web con tu proyecto de Firebase.

   ⚠️  QUÉ DEBES HACER TÚ (una sola vez):
   1. Ve a Firebase Console → proyecto "dragodocs" → ⚙️ Configuración
      del proyecto → "Tus apps" → añade una app **Web** (</>).
   2. Copia el objeto firebaseConfig que te da la consola y pega
      SOLO el valor de "appId" abajo (el resto ya está prellenado
      con los datos de tu proyecto). authDomain/apiKey/projectId ya
      son correctos porque salen del mismo proyecto Firebase.
   3. En Firebase Console → Authentication → método de acceso,
      ACTIVA el proveedor "Correo electrónico/contraseña".
      (El creador entra con Código + Contraseña; por dentro se usa
       un correo sintético <codigo>@<AFFILIATE_EMAIL_DOMAIN>, que el
       creador NUNCA ve ni escribe.)

   La apiKey de Firebase NO es un secreto: es pública por diseño.
   Lo que protege tus datos son las Reglas de Seguridad de Firestore
   (ver firebase/firestore.rules) y App Check en las Cloud Functions.
   ========================================================= */

export const firebaseConfig = {
  apiKey: "AIzaSyAyPd6G5BLeSuAiPD2C2888jwVXpz2qwLg",
  authDomain: "dragodocs.firebaseapp.com",
  projectId: "dragodocs",
  storageBucket: "dragodocs.firebasestorage.app",
  messagingSenderId: "147932026481",
  // 👇 PEGA AQUÍ el appId de la app Web que registres en Firebase Console.
  //    Tiene el formato: 1:147932026481:web:xxxxxxxxxxxxxxxx
  appId: "1:147932026481:web:6cfa27fa1c77a0f427edd0"
};

/* Dominio del correo sintético para el login por código.
   No necesita ser un dominio real: Firebase solo lo guarda como texto.
   DEBE COINCIDIR con el que use el script de alta de creadores
   (scripts/admin-create-affiliate.js) y las Cloud Functions. */
export const AFFILIATE_EMAIL_DOMAIN = "creadores.dragodocs.app";

/* Versión del SDK de Firebase que se carga desde el CDN de Google. */
export const FIREBASE_SDK_VERSION = "10.12.5";
