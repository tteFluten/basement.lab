# Plan: Sub-apps independientes dentro del Hub

## Contexto

El hub actual (`lab.basement.studio`) es un Next.js 14 con auth propio (NextAuth + Neon),
roles globales (`admin` / `member`) y apps embebidas como iframes Vite.

Se quiere incorporar dos secciones nuevas:
- **Finanzas** — controlada por su propio dev
- **CEO** — controlada por Facundo

Requisito: cada sección tiene su propia URL, su propio admin, y sus devs trabajan
de forma independiente sin tocar lo de los demás.

---

## Arquitectura elegida: sub-apps Next.js dentro del monorepo

Cada sección es un conjunto de rutas Next.js dentro del hub, con su propio layout,
admin guard y API routes. No son Vite embeds (iframes) sino páginas full-stack reales.

```
hub/app/
  finanzas/
    layout.tsx        ← guard: requiere role 'finanzas_admin' o 'finanzas_member'
    page.tsx
    admin/
      layout.tsx      ← guard: requiere role 'finanzas_admin'
      ...
  ceo/
    layout.tsx        ← guard: requiere role 'ceo_admin' o 'ceo_member'
    page.tsx
    admin/
      layout.tsx      ← guard: requiere role 'ceo_admin'
      ...
```

### URLs resultantes

| Entorno     | Hub principal          | Finanzas                        | CEO                          |
|-------------|------------------------|---------------------------------|------------------------------|
| Producción  | lab.basement.studio    | lab.basement.studio/finanzas    | lab.basement.studio/ceo      |
| Preview     | basement-lab-git-*.vercel.app | ídem en su branch        | ídem en su branch            |

---

## Sistema de roles extendido

El campo `role` en la tabla `users` pasa de ser un enum fijo a un texto libre
(o se agrega una tabla `user_roles` many-to-many):

```sql
-- Opción simple: column array
ALTER TABLE users ADD COLUMN IF NOT EXISTS roles text[] DEFAULT '{}';

-- Roles posibles:
--   'admin'             → admin del hub principal (Lautaro)
--   'finanzas_admin'    → admin de la sección finanzas
--   'finanzas_member'   → miembro de finanzas
--   'ceo_admin'         → admin de la sección CEO (Facundo)
--   'ceo_member'        → miembro de la sección CEO
--   'member'            → usuario general del hub
```

Cada layout guard chequea el rol correspondiente en `session.user.roles`.

---

## Flujo de trabajo con Git + Vercel

### Branches

```
main              →  producción (lab.basement.studio)
finanzas/dev      →  preview automático de Vercel para finanzas
finanzas/feat-*   →  ramas de features del dev de finanzas
ceo/dev           →  preview automático de Vercel para CEO
ceo/feat-*        →  ramas de features de Facundo
```

Vercel genera una URL de preview por cada push a cualquier branch.
Nadie pushea directo a `main` — todo entra por PR.

### GitHub CODEOWNERS

Archivo `.github/CODEOWNERS` en la raíz:

```
# Hub principal — solo Lautaro aprueba cambios acá
/hub/app/          @lautaro
/hub/lib/          @lautaro
/hub/middleware.ts @lautaro

# Sección finanzas — el dev de finanzas aprueba cambios acá
/hub/app/finanzas/ @dev-finanzas
/hub/app/api/finanzas/ @dev-finanzas

# Sección CEO — Facundo aprueba cambios acá
/hub/app/ceo/      @facundo
/hub/app/api/ceo/  @facundo
```

Con branch protection en `main` activada, GitHub exige la aprobación del CODEOWNER
antes de poder mergear. Cada dev tiene autonomía en su sección.

---

## Pasos de implementación

### 1. Extender roles en DB
- Agregar columna `roles text[]` a la tabla `users` en Neon
- Actualizar `hub/lib/auth.ts` para que el JWT incluya `roles` (array)
- Actualizar el tipo `Session` de NextAuth para reflejar el cambio

### 2. Crear los guards reutilizables
- `hub/lib/requireRole.ts` — helper que recibe un rol y redirige si no lo tiene
- Usado en cada `layout.tsx` de sección

### 3. Scaffoldear las carpetas de sección
- `hub/app/finanzas/` con layout + página placeholder
- `hub/app/ceo/` ídem
- `hub/app/api/finanzas/` y `hub/app/api/ceo/` para sus API routes

### 4. Asignar roles iniciales
- Lautaro: `['admin']`
- Dev de finanzas: `['finanzas_admin']`
- Facundo: `['ceo_admin']`
- Resto del equipo: `['member']` (sin acceso a finanzas ni CEO hasta que se asigne)

### 5. Configurar GitHub
- Crear archivo `.github/CODEOWNERS`
- Activar branch protection en `main` (require PR + CODEOWNER approval)
- Invitar a los devs de finanzas y a Facundo como colaboradores del repo

### 6. Vercel
- No requiere cambios — preview deployments ya funcionan por branch automáticamente
- Opcional: agregar `NEXT_PUBLIC_FINANZAS_ENABLED` / `NEXT_PUBLIC_CEO_ENABLED`
  como feature flags por entorno

---

## Trade-offs

| Aspecto | Detalle |
|---------|---------|
| Build de preview | Despliega TODO el hub, no solo la sección cambiada. Si finanzas rompe algo, la preview de ellos falla entera — pero `main` queda intacto hasta que Lautaro apruebe el PR. |
| DB compartida | Todos usan el mismo Neon. Ventaja: usuarios unificados. Riesgo: una migración mal hecha de finanzas puede afectar tablas del hub. Mitigable con schema separado por sección (`finanzas.*`, `ceo.*`). |
| Secretos | Un solo `.env` en Vercel. Si finanzas necesita claves propias (ej. API de contabilidad), van al mismo Vercel env pero con prefijo claro (`FINANZAS_*`). |
| Autonomía de deploy | Los devs no pueden deployar a producción solos — necesitan el PR aprobado. Si necesitan deploy directo, la alternativa es Vercel per-branch deploy con su propio proyecto de Vercel. |

---

## Alternativa descartada: repos separados

Se evaluó tener `basement-finanzas` y `basement-ceo` como repos independientes
con sus propias URLs (`finanzas.basement.studio`, `ceo.basement.studio`).

**Por qué se descartó:**
- Duplica todo el boilerplate de auth, middleware, DB setup
- Sin SSO nativo — usuarios separados por app
- Más overhead de mantenimiento (3 deploys, 3 configs, 3 DBs)

**Cuándo reconsiderarla:** si finanzas o CEO crecen hasta necesitar DB propia,
equipo grande, o requisitos de seguridad/aislamiento muy distintos al hub.
