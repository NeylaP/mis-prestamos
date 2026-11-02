-- =====================================================================
-- Día de cobro pactado (independiente de la fecha del préstamo).
-- Ejecutar en Supabase: SQL Editor → pegar → Run.
-- Los préstamos existentes conservan el día de su fecha original.
-- =====================================================================

alter table public.prestamos
  add column if not exists dia_cobro integer;

update public.prestamos
   set dia_cobro = extract(day from fecha)::integer
 where dia_cobro is null;

alter table public.prestamos
  alter column dia_cobro set default 1,
  alter column dia_cobro set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'prestamos_dia_cobro_check'
       and conrelid = 'public.prestamos'::regclass
  ) then
    alter table public.prestamos
      add constraint prestamos_dia_cobro_check check (dia_cobro between 1 and 31);
  end if;
end $$;
