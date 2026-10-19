# Mis Préstamos

App web para llevar préstamos, pagos y mora. Angular 21 + Supabase, publicada en GitHub Pages.
Cada usuario ve **solo sus propios** préstamos y pagos (seguridad por filas, RLS).

## Qué incluye

- Login con correo y contraseña, recuperación de contraseña y rutas protegidas.
- Inicio con indicadores y cobros ordenados por urgencia.
- Préstamos: crear, editar, buscar, filtrar, activar y desactivar.
- Detalle del préstamo: registrar pagos (reparto automático en réditos y capital), comprobante obligatorio para Nequi y transferencia, extracto de movimientos e historial de cambios.
- Motor de cálculo en `src/app/domain/` (funciones puras con pruebas), listo para traducirse a C#.
- Workflows: publicación en GitHub Pages, respaldo semanal y ping para que Supabase no se pause.

## 1. Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com), región **South America (São Paulo)**.
2. **SQL Editor** → pega todo `supabase/migrations/001_inicial.sql` → **Run**.
3. **Authentication → Sign In / Providers**: deja activo *Email* y **desactiva "Allow new users to sign up"**. Así nadie puede crearse una cuenta solo.
4. **Authentication → Users → Add user**: crea tu usuario y el de la otra persona (o invítala por correo).
5. **Authentication → URL Configuration**:
   - *Site URL*: `https://TU-USUARIO.github.io/mis-prestamos/`
   - *Redirect URLs*: agrega `https://TU-USUARIO.github.io/mis-prestamos/**` y `http://localhost:4200/**`
6. **Project Settings → API**: copia la *Project URL* y la llave *anon public*.
   La llave `service_role` **nunca** va en el código ni en GitHub.

## 2. Desarrollo local

Requiere Node 22.12 o superior.

```bash
npm install
# Pega la URL y la llave anon en src/environments/environment.development.ts
npm start            # http://localhost:4200
npx ng test          # pruebas del motor de cálculo
```

## 3. GitHub Pages

1. Sube el proyecto a un repositorio llamado `mis-prestamos` (público: el código no lleva secretos).
2. **Settings → Pages → Source**: *GitHub Actions*.
3. **Settings → Secrets and variables → Actions → Variables**: crea `SUPABASE_URL` y `SUPABASE_ANON_KEY`.
4. Haz push a `main`. El workflow *Publicar en GitHub Pages* prueba, compila y publica.

> GitHub Pages es para uso personal. Si algún día ofreces la app a otros prestamistas como servicio,
> múdala a un hosting que permita uso comercial (Cloudflare Pages, Netlify, Azure Static Web Apps).

## 4. Respaldos (importante)

1. Crea un repositorio **privado** aparte, por ejemplo `mis-prestamos-respaldos`.
2. Crea un token *fine-grained* con permiso **Contents: Read and write** solo sobre ese repositorio.
3. En este repositorio agrega:
   - Secret `SUPABASE_DB_URL`: Supabase → **Connect** → *Session pooler* (con tu contraseña de base de datos).
   - Secret `BACKUP_TOKEN`: el token del paso 2.
   - Variable `BACKUP_REPO`: `tu-usuario/mis-prestamos-respaldos`.
4. Ejecuta una vez *Respaldo semanal* a mano (Actions → Run workflow) para verificar.

El respaldo incluye las tablas de la app (esquema `public`). Los usuarios y los comprobantes viven en
Supabase Auth y Storage; para un respaldo completo de esos usa el panel de Supabase o su CLI.

## Estructura

```
src/app/
├─ core/       Supabase, autenticación, guard, servicio de préstamos, formatos
├─ domain/     cálculos puros (réditos, mora, reparto de pagos) + pruebas
├─ layout/     encabezado y menú lateral
└─ pages/      login, restablecer, inicio, préstamos, detalle, próximamente
supabase/migrations/   esquema, políticas RLS, auditoría y bucket de comprobantes
.github/workflows/     publicar, respaldo semanal, mantener activo
```

## Paso futuro a .NET

La base de datos se queda igual. La API en ASP.NET Core se conecta a este mismo PostgreSQL y valida
los tokens de Supabase Auth, así los usuarios no cambian de contraseña. El motor de `domain/`
se traduce a C# con las mismas pruebas, y Angular cambia de llamar a Supabase a llamar a la API,
un servicio a la vez.
