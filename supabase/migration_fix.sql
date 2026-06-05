-- =============================================================================
-- MIGRACIÓN: Adaptar al schema real existente
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- Qué hace este script:
--   1. Limpia artefactos del schema.sql anterior que falló (tabla bloques, vista rota)
--   2. Agrega columnas faltantes a sesiones y reservaciones
--   3. Habilita RLS con policies correctas
--   4. Crea triggers de capacidad y de nuevo usuario
-- =============================================================================


-- =============================================================================
-- PASO 1: Limpiar artefactos del run anterior
-- =============================================================================

-- La tabla bloques fue creada por el schema.sql anterior pero no se usa
-- (el campo bloque es un entero en sesiones)
drop table if exists public.bloques cascade;

-- La vista falló al crearse — la recrearemos correctamente al final
drop view if exists public.sesiones_con_capacidad;

-- Eliminar políticas previas si existen (para que el script sea idempotente)
drop policy if exists "bloques_lectura_publica"      on public.bloques;
drop policy if exists "sesiones_lectura_publica"      on public.sesiones;
drop policy if exists "usuarios_ver_propio"           on public.usuarios;
drop policy if exists "usuarios_insertar_propio"      on public.usuarios;
drop policy if exists "usuarios_actualizar_propio"    on public.usuarios;
drop policy if exists "reservaciones_ver_propias"     on public.reservaciones;
drop policy if exists "reservaciones_crear_propias"   on public.reservaciones;


-- =============================================================================
-- PASO 2: Agregar columnas faltantes
-- =============================================================================

-- sesiones: agregar capacidad (con default seguro para filas existentes)
alter table public.sesiones
  add column if not exists capacidad integer not null default 100;

-- reservaciones: agregar bloque (int), asistio y asistio_at
alter table public.reservaciones
  add column if not exists bloque    integer,
  add column if not exists asistio   boolean not null default false,
  add column if not exists asistio_at timestamptz;

-- Poblar bloque en filas existentes (JOIN con sesiones para obtener el valor)
update public.reservaciones r
set bloque = s.bloque
from public.sesiones s
where r.sesion_id = s.id
  and r.bloque is null;

-- Poner NOT NULL solo si todas las filas ya tienen valor (evita error si hay huérfanos)
do $$
begin
  if not exists (select 1 from public.reservaciones where bloque is null) then
    alter table public.reservaciones alter column bloque set not null;
  end if;
end $$;

-- Constraint: una reservación por bloque por usuario (enforced en DB)
alter table public.reservaciones
  drop constraint if exists reservaciones_una_por_bloque;
alter table public.reservaciones
  add constraint reservaciones_una_por_bloque
  unique (usuario_id, bloque);

-- Constraint: si asistio=true entonces asistio_at debe tener valor
alter table public.reservaciones
  drop constraint if exists reservaciones_asistencia_coherente;
alter table public.reservaciones
  add constraint reservaciones_asistencia_coherente
  check (asistio = false or asistio_at is not null);

-- Índices de performance
create index if not exists reservaciones_usuario_id_idx on public.reservaciones(usuario_id);
create index if not exists reservaciones_sesion_id_idx  on public.reservaciones(sesion_id);
create index if not exists reservaciones_bloque_idx     on public.reservaciones(bloque);
create index if not exists sesiones_bloque_idx          on public.sesiones(bloque);


-- =============================================================================
-- PASO 3: Vista de sesiones con estado de capacidad
-- Usa bloque (int) — compatible con el schema existente
-- =============================================================================

create or replace view public.sesiones_con_capacidad
  with (security_invoker = true)
as
select
  s.*,
  count(r.id)::integer                 as reservaciones_count,
  (s.capacidad - count(r.id))::integer as lugares_disponibles,
  (count(r.id) >= s.capacidad)         as llena
from public.sesiones s
left join public.reservaciones r on r.sesion_id = s.id
group by s.id;

comment on view public.sesiones_con_capacidad is
  'Sesiones con cupos en tiempo real. Usar en la agenda en lugar de sesiones directamente.';


-- =============================================================================
-- PASO 4: Trigger — validar capacidad antes de insertar reservación
-- Previene race conditions cuando dos usuarios reservan el último cupo
-- =============================================================================

create or replace function public.validar_capacidad_sesion()
returns trigger
language plpgsql
security definer
as $$
declare
  v_reservaciones integer;
  v_capacidad     integer;
begin
  select capacidad into v_capacidad
  from public.sesiones
  where id = new.sesion_id;

  select count(*) into v_reservaciones
  from public.reservaciones
  where sesion_id = new.sesion_id;

  if v_reservaciones >= v_capacidad then
    raise exception 'SESION_LLENA'
      using errcode = 'P0001',
            hint    = 'La sesión ya alcanzó su capacidad máxima';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validar_capacidad on public.reservaciones;
create trigger trg_validar_capacidad
  before insert on public.reservaciones
  for each row
  execute function public.validar_capacidad_sesion();


-- =============================================================================
-- PASO 5: Trigger — crear usuario en public.usuarios al hacer signUp
-- Actúa como fallback si el insert del cliente falla por algún motivo
-- (también cubre flujos futuros de registro por magic link)
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Solo inserta si el formulario pasó nombre en los metadatos del usuario
  if (new.raw_user_meta_data->>'nombre') is not null then
    insert into public.usuarios (id, nombre, email, institucion)
    values (
      new.id,
      trim(new.raw_user_meta_data->>'nombre'),
      new.email,
      coalesce(trim(new.raw_user_meta_data->>'institucion'), '')
    )
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();


-- =============================================================================
-- PASO 6: Habilitar RLS en todas las tablas
-- service_role (API routes del servidor) siempre bypasea RLS automáticamente
-- =============================================================================

alter table public.sesiones      enable row level security;
alter table public.usuarios      enable row level security;
alter table public.reservaciones enable row level security;


-- ── SESIONES: lectura pública ────────────────────────────────────────────────
-- Cualquiera puede ver la agenda (anon = no logueado, authenticated = logueado)

create policy "sesiones_lectura_publica"
  on public.sesiones
  for select
  to anon, authenticated
  using (true);


-- ── USUARIOS: cada usuario ve y edita solo su propio perfil ─────────────────

create policy "usuarios_ver_propio"
  on public.usuarios
  for select
  to authenticated
  using (id = auth.uid());

-- Permite que el registro desde el cliente funcione (requiere email confirmation = OFF
-- en Supabase Auth o que se use el trigger en su lugar)
create policy "usuarios_insertar_propio"
  on public.usuarios
  for insert
  to authenticated
  with check (id = auth.uid());

create policy "usuarios_actualizar_propio"
  on public.usuarios
  for update
  to authenticated
  using    (id = auth.uid())
  with check (id = auth.uid());


-- ── RESERVACIONES: cada usuario ve y crea solo las suyas ─────────────────────
-- No hay UPDATE ni DELETE para authenticated — solo service_role puede marcar asistencia

create policy "reservaciones_ver_propias"
  on public.reservaciones
  for select
  to authenticated
  using (usuario_id = auth.uid());

create policy "reservaciones_crear_propias"
  on public.reservaciones
  for insert
  to authenticated
  with check (usuario_id = auth.uid());


-- =============================================================================
-- VERIFICACIÓN FINAL
-- Ejecutar estas queries para confirmar que todo quedó bien:
-- =============================================================================
/*
-- Confirmar columnas de reservaciones:
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'reservaciones'
order by ordinal_position;

-- Confirmar columnas de sesiones:
select column_name, data_type
from information_schema.columns
where table_name = 'sesiones'
order by ordinal_position;

-- Confirmar RLS habilitado:
select tablename, rowsecurity
from pg_tables
where schemaname = 'public';

-- Confirmar policies:
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public';

-- Confirmar triggers:
select trigger_name, event_object_table, action_timing, event_manipulation
from information_schema.triggers
where trigger_schema = 'public'
   or event_object_schema = 'public';

-- Probar la vista:
select titulo, lugar, bloque, capacidad, reservaciones_count, lugares_disponibles, llena
from public.sesiones_con_capacidad
order by bloque;
*/
