# Conectar base de datos y almacenamiento (Neon + R2)

## ¿Qué es .env.local y dónde configuro?

- **`.env.local`** es un archivo que solo existe en **tu máquina** (desarrollo). Ahí ponés claves y URLs que el Hub necesita (Neon, NextAuth, R2, etc.). Ese archivo **no se sube a git** (está en `.gitignore`), así que cada desarrollador crea el suyo.
- **Dónde va**: dentro de la carpeta del Hub, al mismo nivel que `package.json`. Ruta completa: `hub/.env.local`. Si no existe, crealo (archivo de texto, una variable por línea: `NOMBRE=valor`).
- **¿Y en producción (Vercel, "afuera")?** Ahí **no usás un archivo**. En el panel de Vercel (tu proyecto → **Settings** → **Environment Variables**) cargás las **mismas variables** con los **mismos nombres** (`NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `DATABASE_URL`, `R2_*`, etc.) y los valores que correspondan para producción (por ejemplo `NEXTAUTH_URL=https://tu-dominio.vercel.app`). Vercel inyecta esas variables cuando corre el Hub; el código no cambia, solo cambia dónde se definen (archivo local vs panel).

**Resumen**: en tu PC → creás/editás `hub/.env.local`. En Vercel (o el host que uses) → Settings → Environment Variables, mismo nombre de variable, valor de producción.

---

## 1. Base de datos (Neon)

1. Entrá a [neon.tech](https://neon.tech) y creá un proyecto.
2. En el **SQL Editor** de Neon ejecutá el contenido de `hub/supabase/neon_setup.sql` (crea todas las tablas).
3. Opcional: ejecutá `hub/supabase/seed.sql` para usuarios iniciales.
4. En el dashboard de Neon, copiá la **connection string** (Connect → connection string).
5. En el Hub, creá o editá `hub/.env.local`:
   ```env
   DATABASE_URL=postgresql://...tu-connection-string...
   ```

## 1b. Auth (NextAuth) y contraseña del admin

1. En `hub/.env.local` agregá:
   ```env
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=<string-aleatorio-seguro>
   SETUP_PASSWORD_SECRET=<otro-secreto-para-setear-contraseña>
   ```
   Para generar un secreto: en PowerShell podés usar `[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])`.
2. Para definir la contraseña del admin (una vez por entorno), podés usar **el script** (no hace falta tener el Hub corriendo):
   ```powershell
   cd hub
   node scripts/set-password.js tu-email@ejemplo.com LaContraseñaQueQuieras
   ```
   El script lee `hub/.env.local` y usa la base de datos para actualizar el `password_hash`. O bien, si preferís el endpoint: el Hub debe estar corriendo y llamar a `POST /api/setup-password` con header `Authorization: Bearer SETUP_PASSWORD_SECRET` y body `{ "email", "password" }`.
3. Después de eso podés entrar con ese email y contraseña en `/login`.

## 2. Cloudflare R2 (imágenes y archivos)

1. En [Cloudflare Dashboard](https://dash.cloudflare.com) → **R2** → **Create bucket**.
2. Creá un bucket y configurá **Public access** (o un custom domain) para poder servir las URLs.
3. En **R2** → **Manage R2 API Tokens** → Create API token con permisos de lectura/escritura en el bucket.
4. En `hub/.env.local` (o en Vercel → Environment Variables):
   ```env
   CLOUDFLARE_ACCOUNT_ID=tu-account-id
   R2_ACCESS_KEY_ID=...
   R2_SECRET_ACCESS_KEY=...
   R2_BUCKET_NAME=nombre-del-bucket
   R2_PUBLIC_URL=https://... (URL pública del bucket, ej. custom domain o r2.dev)
   ```

## 3. Probar

- Con la base de datos (Neon) y R2 configurados, al usar **"Download and add to history"** en cualquier app:
  - La imagen se sube a R2.
  - Se inserta una fila en `generations` con `image_url`, `app_id`, `width`, `height`, etc.
- La página **History** del Hub llama a `GET /api/generations`; si falla, verás el mensaje de error y un botón "Retry". Revisá que `DATABASE_URL` esté en `hub/.env.local` y que las tablas existan (neon_setup.sql).
- Sin base de datos: el Hub devuelve 503 en las APIs que requieren DB.
- Sin R2: la API de generaciones y avatares devuelve 503; no se pueden subir imágenes.

## 4. Variables en Vercel (producción)

En el deployment **no hay archivo .env.local**: las variables se cargan en el panel. En tu proyecto de Vercel → **Settings** → **Environment Variables** agregá las mismas que en local (mismos nombres), con valores de producción:

- `DATABASE_URL` (connection string de Neon)
- `CLOUDFLARE_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`
- `NEXTAUTH_URL` → **acá sí cambiá**: poné la URL pública del Hub, ej. `https://tu-app.vercel.app`
- `NEXTAUTH_SECRET` (puede ser el mismo o uno nuevo solo para producción)
- `SETUP_PASSWORD_SECRET` (solo si querés usar el endpoint para setear contraseñas en producción)

Guardá y hacé redeploy. El Hub en Vercel va a leer estas variables igual que en local.

---

## 5. Thumbnails de apps (opcional)

- **Apps del lab (grid en Home)**: Podés agregar imágenes en `hub/public/app-covers/` con el nombre del slug de cada app: `cineprompt.jpg`, `render.jpg`, `chronos.jpg`, `swag.jpg`, `avatar.jpg`, `frame-variator.jpg`. Si no existen o fallan, se muestra el ícono por defecto.
- **Aplicaciones subidas (Submitted)**: Al agregar una app podés subir una imagen (thumbnail) y/o elegir un ícono de la plantilla. El thumbnail se guarda en R2; si no hay R2 o falla la imagen, se usa el ícono elegido.
