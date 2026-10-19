-- =====================================================================
-- Mis Préstamos · esquema inicial
-- Cada usuario ve y maneja SOLO sus propios préstamos y pagos (RLS).
-- Ejecutar en Supabase: SQL Editor → pegar todo → Run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------
create table if not exists public.prestamos (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  codigo           text not null,
  deudor           text not null check (length(trim(deudor)) > 0),
  telefono         text,
  fecha            date not null,
  capital          numeric(14, 2) not null check (capital > 0),
  tasa             numeric(8, 5) not null check (tasa >= 0 and tasa < 1),           -- por periodo: 0.05 = 5 %
  frecuencia       text not null check (frecuencia in ('Mensual', 'Quincenal', 'Semanal', 'Diario')),
  abono_pactado    numeric(14, 2) not null default 0 check (abono_pactado >= 0),
  dias_gracia      integer not null default 3 check (dias_gracia between 0 and 60),
  activo           boolean not null default true,
  inactivo_desde   date,
  motivo_inactivo  text,
  notas            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint prestamos_codigo_unico unique (owner_id, codigo)
);
create index if not exists prestamos_owner_idx on public.prestamos (owner_id);

create table if not exists public.pagos (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  prestamo_id       uuid not null references public.prestamos (id) on delete restrict,
  fecha             date not null,
  tipo              text not null check (tipo in ('Réditos', 'Capital')),
  monto             numeric(14, 2) not null check (monto > 0),
  medio             text not null check (medio in ('Efectivo', 'Nequi', 'Transferencia')),
  comprobante_path  text,
  nota              text,
  created_at        timestamptz not null default now(),
  -- Nequi y transferencia exigen comprobante como evidencia.
  constraint pagos_comprobante_digital check (medio = 'Efectivo' or comprobante_path is not null)
);
create index if not exists pagos_prestamo_idx on public.pagos (prestamo_id);
create index if not exists pagos_owner_fecha_idx on public.pagos (owner_id, fecha desc);

-- Historial de cambios: lo llenan los triggers, nadie lo escribe a mano.
create table if not exists public.prestamo_eventos (
  id           bigint generated always as identity primary key,
  owner_id     uuid not null references auth.users (id) on delete cascade,
  prestamo_id  uuid references public.prestamos (id) on delete cascade,
  tipo         text not null,          -- creado | editado | activado | desactivado | pago
  antes        jsonb,
  despues      jsonb,
  usuario      uuid default auth.uid(),
  created_at   timestamptz not null default now()
);
create index if not exists eventos_prestamo_idx on public.prestamo_eventos (prestamo_id, created_at desc);

-- ---------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------
create or replace function public.tocar_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists prestamos_updated_at on public.prestamos;
create trigger prestamos_updated_at before update on public.prestamos
  for each row execute function public.tocar_updated_at();

-- El dueño de un préstamo no se puede cambiar.
create or replace function public.bloquear_cambio_owner()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.owner_id is distinct from old.owner_id then
    raise exception 'No se puede cambiar el dueño del registro';
  end if;
  return new;
end $$;

drop trigger if exists prestamos_owner_fijo on public.prestamos;
create trigger prestamos_owner_fijo before update on public.prestamos
  for each row execute function public.bloquear_cambio_owner();

-- Auditoría (security definer: escribe aunque el usuario no tenga permiso directo).
create or replace function public.auditar_prestamo()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_tipo text;
  v_antes jsonb;
  v_despues jsonb;
begin
  if tg_op = 'INSERT' then
    v_tipo := 'creado';
    v_despues := to_jsonb(new);
  else
    if old.activo <> new.activo then
      v_tipo := case when new.activo then 'activado' else 'desactivado' end;
    else
      v_tipo := 'editado';
    end if;
    -- Solo guarda los campos que cambiaron.
    select jsonb_object_agg(o.key, o.value), jsonb_object_agg(n.key, n.value)
      into v_antes, v_despues
      from jsonb_each(to_jsonb(old)) o
      join jsonb_each(to_jsonb(new)) n using (key)
     where o.value is distinct from n.value and o.key not in ('updated_at');
    if v_despues is null then
      return new;
    end if;
  end if;
  insert into public.prestamo_eventos (owner_id, prestamo_id, tipo, antes, despues)
  values (new.owner_id, new.id, v_tipo, v_antes, v_despues);
  return new;
end $$;

drop trigger if exists prestamos_auditoria on public.prestamos;
create trigger prestamos_auditoria after insert or update on public.prestamos
  for each row execute function public.auditar_prestamo();

create or replace function public.auditar_pago()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.prestamo_eventos (owner_id, prestamo_id, tipo, despues)
  values (new.owner_id, new.prestamo_id, 'pago', to_jsonb(new));
  return new;
end $$;

drop trigger if exists pagos_auditoria on public.pagos;
create trigger pagos_auditoria after insert on public.pagos
  for each row execute function public.auditar_pago();

-- ---------------------------------------------------------------------
-- Seguridad por filas (RLS): cada quien ve solo lo suyo
-- ---------------------------------------------------------------------
alter table public.prestamos        enable row level security;
alter table public.pagos            enable row level security;
alter table public.prestamo_eventos enable row level security;

-- Préstamos: ver, crear y editar los propios. No se borran: se desactivan.
drop policy if exists prestamos_ver on public.prestamos;
create policy prestamos_ver on public.prestamos for select to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists prestamos_crear on public.prestamos;
create policy prestamos_crear on public.prestamos for insert to authenticated
  with check ((select auth.uid()) = owner_id);

drop policy if exists prestamos_editar on public.prestamos;
create policy prestamos_editar on public.prestamos for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

-- Pagos: ver los propios y crear solo sobre préstamos propios y activos.
drop policy if exists pagos_ver on public.pagos;
create policy pagos_ver on public.pagos for select to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists pagos_crear on public.pagos;
create policy pagos_crear on public.pagos for insert to authenticated
  with check (
    (select auth.uid()) = owner_id
    and exists (
      select 1 from public.prestamos p
       where p.id = prestamo_id and p.owner_id = (select auth.uid()) and p.activo
    )
  );

-- Historial: solo lectura de lo propio.
drop policy if exists eventos_ver on public.prestamo_eventos;
create policy eventos_ver on public.prestamo_eventos for select to authenticated
  using ((select auth.uid()) = owner_id);

-- Usuarios sin sesión (anon) no tocan nada.
revoke all on public.prestamos, public.pagos, public.prestamo_eventos from anon;

-- ---------------------------------------------------------------------
-- Almacenamiento de comprobantes (bucket privado, carpeta por usuario)
-- Ruta de cada archivo: <id del usuario>/<id del préstamo>/<archivo>
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comprobantes', 'comprobantes', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

drop policy if exists comprobantes_ver on storage.objects;
create policy comprobantes_ver on storage.objects for select to authenticated
  using (bucket_id = 'comprobantes' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists comprobantes_subir on storage.objects;
create policy comprobantes_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'comprobantes' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------
-- Ping para el workflow "Mantener Supabase activo" (no expone datos).
-- ---------------------------------------------------------------------
create or replace function public.ping()
returns text language sql stable set search_path = '' as $$ select 'ok'::text $$;
grant execute on function public.ping() to anon;
