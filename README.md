# Wasakaka

Mercado en línea de comida casera latina de Fort Worth, Texas — PWA en Next.js + Prisma + SQLite.

## Arranque

```bash
bun install
bun run db:push      # sincroniza el esquema con SQLite
bun prisma/seed.ts   # datos demo
bun run dev          # http://localhost:3000
```

## Variables de entorno (`.env`)

- `DATABASE_URL`: ruta de la base SQLite.
- `DEMO_MODE=1`: activa el endpoint `/api/demo/identidades` y el cambiador de rol
  («ver la app como…»). **Sin esa variable el endpoint responde 404 y nadie puede
  entrar al panel de administración desde la interfaz.** En producción se
  reemplaza por autenticación real (Supabase Auth) y `DEMO_MODE` se deja apagado.

## Seguridad del repositorio — IMPORTANTE

- `.env` y `db/custom.db` **no deben estar versionados** (están excluidos en
  `.gitignore`). Si en algún momento se llegó a confirmar un `.env` al
  repositorio, **cualquier clave que haya estado en ese archivo debe rotarse
  ANTES de desplegar** (contraseñas de base, claves de Stripe, tokens, etc.).
- El registro de consultas de Prisma (`log: ['query']`) queda activo solo en
  desarrollo (`src/lib/db.ts`).

## Nota sobre dinero

Todos los montos se guardan en **centavos enteros (Int)** en la base; la
conversión a dólares ocurre solo al mostrar, con `formatoDinero` /
`aDolares` (`src/lib/dinero.ts`). La comisión estándar es **8%** y las
cocineras fundadoras en promoción de lanzamiento pagan **0%** (RF-P04).
