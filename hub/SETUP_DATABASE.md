# Conectar base de datos (Supabase) y Blob

## ¿Qué es .env.local y dónde configuro?

- **`.env.local`** es un archivo que solo existe en **tu máquina** (desarrollo). Ahí ponés claves y URLs que el Hub necesita (Supabase, NextAuth, etc.). Ese archivo **no se sube a git** (está en `.gitignore`), así que cada desarrollador crea el suyo.
- **Dónde va**: dentro de la carpeta del Hub, al mismo nivel que `package.json`. Ruta completa: `hub/.env.local`. Si no existe, crealo (archivo de texto, una variable por línea: `NOMBRE=valor`).
- **¿Y en producción (Vercel, “afuera”)?** Ahí **no usás un archivo**. En el panel de Vercel (tu proyecto → **Settings** → **Environment Variables**) cargás las **mismas variables** con los **mismos nombres** (`NEXTAUTH_URL`, `NEXTAUTH_SECRET`, etc.) y los valores que correspondan para producción (por ejemplo `NEXTAUTH_URL=https://tu-dominio.vercel.app`). Vercel inyecta esas variables cuando corre el Hub; el código no cambia, solo cambia dónde se definen (archivo local vs panel).

**Resumen**: en tu PC → creás/editás `hub/.env.local`. En Vercel (o el host que uses) → Settings → Environment Variables, mismo nombre de variable, valor de producción.

---

## 1. Supabase

1. Entrá a [supabase.com](https://supabase.com) y creá un proyecto.
2. En **Project Settings** → **API** copiá:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **service_role** (secret) → `SUPABASE_SERVICE_ROLE_KEY`
3. En el Hub, creá o editá `hub/.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   ```
4. En Supabase, abrí **SQL Editor** y ejecutá el contenido de `hub/supabase/schema.sql` (crea tablas `users`, `projects`, `project_members`, `generations` con columna `tags` en generations).
5. Si ya tenías el schema aplicado antes, ejecutá también `hub/supabase/migrations/001_add_tags_to_generations.sql` para agregar la columna `tags` a `generations`.
6. Para crear el usuario admin, ejecutá también `hub/supabase/seed.sql` (define a `lautaro@basement.studio` como admin).

## 1b. Auth (NextAuth) y contraseña del admin

1. En `hub/.env.local` agregá:
   ```env
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=<string-aleatorio-seguro>
   SETUP_PASSWORD_SECRET=<otro-secreto-para-setear-contraseña>
   ```
   Para generar un secreto: en PowerShell podés usar `[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])`.
2. Para definir la contraseña del admin `lautaro@basement.studio` (una vez por entorno), podés usar **el script** (no hace falta tener el Hub corriendo):
   ```powershell
   cd hub
   node scripts/set-password.js lautaro@basement.studio LaContraseñaQueQuieras
   ```
   El script lee `hub/.env.local` y usa Supabase para actualizar el `password_hash`. O bien, si preferís el endpoint: el Hub debe estar corriendo y llamar a `POST /api/setup-password` con header `Authorization: Bearer SETUP_PASSWORD_SECRET` y body `{ "email", "password" }` (ver paso anterior en la doc).
3. Después de eso podés entrar con ese email y contraseña en `/login`.

## 2. Vercel Blob (imágenes)

1. En [vercel.com](https://vercel.com) → tu proyecto → **Storage** → **Create Database** o **Blob**.
2. Creá un Blob store y copiá el token.
3. En **Settings** → **Environment Variables** del proyecto (o en `hub/.env.local` para local):
   ```env
   BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
   ```

## 3. Probar

- Con Supabase y Blob configurados, al usar **"Download and add to history"** en cualquier app:
  - La imagen se sube a Blob.
  - Se inserta una fila en `generations` con `blob_url`, `app_id`, `width`, `height`, etc.
- La página **History** del Hub llama a `GET /api/generations`; si falla, verás el mensaje de error y un botón "Retry". Revisá que `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` estén en `hub/.env.local` y que las tablas existan (schema.sql + seed.sql).
- Sin Supabase: el Hub sigue funcionando; el historial en memoria sigue disponible; la API devuelve 503 en GET y no persiste en POST.
- Sin Blob: la API puede seguir guardando en Supabase usando la data URL en `blob_url` (solo recomendable para pruebas; en producción usá Blob).

## 4. Variables en Vercel (producción)

En el deployment **no hay archivo .env.local**: las variables se cargan en el panel. En tu proyecto de Vercel → **Settings** → **Environment Variables** agregá las mismas que en local (mismos nombres), con valores de producción:

- `NEXT_PUBLIC_SUPABASE_URL` (mismo valor que en local si usás el mismo proyecto Supabase)
- `SUPABASE_SERVICE_ROLE_KEY`
- `BLOB_READ_WRITE_TOKEN`
- `NEXTAUTH_URL` → **acá sí cambiá**: poné la URL pública del Hub, ej. `https://tu-app.vercel.app`
- `NEXTAUTH_SECRET` (puede ser el mismo o uno nuevo solo para producción)
- `SETUP_PASSWORD_SECRET` (solo si querés usar el endpoint para setear contraseñas en producción)

Guardá y hacé redeploy. El Hub en Vercel va a leer estas variables igual que en local.
