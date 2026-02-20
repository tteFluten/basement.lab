# Conectar base de datos (Supabase) y Blob

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
4. En Supabase, abrí **SQL Editor** y ejecutá el contenido de `hub/supabase/schema.sql` (crea tablas `users`, `projects`, `project_members`, `generations`).
5. Para crear el usuario admin, ejecutá también `hub/supabase/seed.sql` (define a `lautaro@basement.studio` como admin).

## 1b. Auth (NextAuth) y contraseña del admin

1. En `hub/.env.local` agregá:
   ```env
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=<string-aleatorio-seguro>
   SETUP_PASSWORD_SECRET=<otro-secreto-para-setear-contraseña>
   ```
   Para generar un secreto: en PowerShell podés usar `[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])`.
2. Para definir la contraseña del admin `lautaro@basement.studio` (una vez por entorno), llamá al endpoint con el secreto. En PowerShell:
   ```powershell
   $body = @{ email = "lautaro@basement.studio"; password = "TU_CONTRASEÑA" } | ConvertTo-Json
   Invoke-RestMethod -Uri "http://localhost:3000/api/setup-password" -Method POST -Body $body -ContentType "application/json" -Headers @{ "Authorization" = "Bearer TU_SETUP_PASSWORD_SECRET" }
   ```
   (Reemplazá `TU_CONTRASEÑA` y `TU_SETUP_PASSWORD_SECRET` por los valores reales. El servidor del Hub debe estar corriendo.)
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

## 4. Variables en Vercel

En el deployment, agregá en **Environment Variables**:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `BLOB_READ_WRITE_TOKEN`
- `NEXTAUTH_URL` (ej. `https://tu-dominio.vercel.app`)
- `NEXTAUTH_SECRET`
- `SETUP_PASSWORD_SECRET` (solo si querés usar el endpoint para setear contraseñas)

Luego redeploy.
