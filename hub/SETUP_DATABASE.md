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
- Sin Supabase: el Hub sigue funcionando; el historial en memoria sigue disponible; la API devuelve 503 en GET y no persiste en POST.
- Sin Blob: la API puede seguir guardando en Supabase usando la data URL en `blob_url` (solo recomendable para pruebas; en producción usá Blob).

## 4. Variables en Vercel

En el deployment, agregá en **Environment Variables**:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `BLOB_READ_WRITE_TOKEN`

Luego redeploy.
