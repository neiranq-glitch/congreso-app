-- =============================================================================
-- CONGRESO APP — Schema completo
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- Este script es IDEMPOTENTE: puede correrse múltiples veces sin errores.
-- Trabaja con el schema existente (sesiones.bloque = integer).
-- =============================================================================


-- =============================================================================
-- 0. LIMPIEZA DE ARTEFACTOS PREVIOS
-- Elimina objetos que puedan haber quedado de runs anteriores
-- =============================================================================

-- Vista que falla si referencia bloque_id (columna que no existe)
drop view if exists public.sesiones_con_capacidad;

-- Tabla bloques que fue creada por un schema anterior pero no se usa
drop table if exists public.bloques cascade;

-- Políticas previas (para que el script sea idempotente)
drop policy if exists "bloques_lectura_publica"       on public.bloques;
drop policy if exists "sesiones_lectura_publica"      on public.sesiones;
drop policy if exists "usuarios_ver_propio"            on public.usuarios;
drop policy if exists "usuarios_insertar_propio"       on public.usuarios;
drop policy if exists "usuarios_actualizar_propio"     on public.usuarios;
drop policy if exists "reservaciones_ver_propias"      on public.reservaciones;
drop policy if exists "reservaciones_crear_propias"    on public.reservaciones;


-- =============================================================================
-- 1. EXTENSIONES
-- =============================================================================

create extension if not exists "pgcrypto";


-- =============================================================================
-- 2. TABLA: sesiones
-- Si ya existe, solo agrega las columnas faltantes.
-- El campo `bloque` es un entero (1, 2, 3...) que agrupa sesiones paralelas.
-- =============================================================================

create table if not exists public.sesiones (
  id          uuid    primary key default gen_random_uuid(),
  titulo      text    not null,
  ponente     text    not null,
  descripcion text,
  hora_inicio text    not null,
  hora_fin    text    not null,
  lugar       text    not null,
  bloque      integer not null,
  created_at  timestamp not null default now()
);

-- Agregar capacidad si no existe (safe para tablas ya creadas)
alter table public.sesiones
  add column if not exists capacidad integer not null default 100;

create index if not exists sesiones_bloque_idx on public.sesiones(bloque);

comment on table public.sesiones is
  'Charlas y talleres del congreso. bloque (int) agrupa sesiones paralelas del mismo horario.';
comment on column public.sesiones.bloque is
  'Número de bloque horario. Sesiones con el mismo bloque ocurren en paralelo.';


-- =============================================================================
-- 3. TABLA: usuarios (asistentes)
-- Vinculada a auth.users para RLS con auth.uid().
-- =============================================================================

create table if not exists public.usuarios (
  id          uuid      primary key references auth.users(id) on delete cascade,
  nombre      text      not null,
  email       text      not null unique,
  institucion text,
  created_at  timestamp not null default now()
);

comment on table public.usuarios is
  'Asistentes registrados. id = auth.users.id — necesario para que RLS funcione con auth.uid().';


-- =============================================================================
-- 4. TABLA: reservaciones
-- Vincula un usuario con una sesión específica.
-- La restricción unique(usuario_id, bloque) impide que el mismo usuario
-- reserve dos sesiones del mismo bloque horario.
-- =============================================================================

create table if not exists public.reservaciones (
  id              uuid      primary key default gen_random_uuid(),
  usuario_id      uuid      not null references auth.users(id),
  sesion_id       uuid      not null references public.sesiones(id),
  nombre_usuario  text,
  email_usuario   text,
  created_at      timestamp not null default now()
);

-- Agregar columnas de control que pueden no existir en el schema original
alter table public.reservaciones
  add column if not exists bloque     integer,
  add column if not exists asistio    boolean not null default false,
  add column if not exists asistio_at timestamp;

-- Poblar bloque en filas existentes que no lo tengan
update public.reservaciones r
set    bloque = s.bloque
from   public.sesiones s
where  r.sesion_id = s.id
  and  r.bloque is null;

-- Poner NOT NULL solo cuando no queden filas con NULL
do $$
begin
  if not exists (select 1 from public.reservaciones where bloque is null) then
    begin
      alter table public.reservaciones alter column bloque set not null;
    exception when others then
      null; -- ya es not null, ignorar
    end;
  end if;
end $$;

-- Regla core: una reservación por bloque por usuario (enforced en DB)
alter table public.reservaciones
  drop constraint if exists reservaciones_una_por_bloque;
alter table public.reservaciones
  add  constraint reservaciones_una_por_bloque
  unique (usuario_id, bloque);

-- Si asistio = true entonces asistio_at debe tener valor
alter table public.reservaciones
  drop constraint if exists reservaciones_asistencia_coherente;
alter table public.reservaciones
  add  constraint reservaciones_asistencia_coherente
  check (asistio = false or asistio_at is not null);

create index if not exists reservaciones_usuario_id_idx on public.reservaciones(usuario_id);
create index if not exists reservaciones_sesion_id_idx  on public.reservaciones(sesion_id);
create index if not exists reservaciones_bloque_idx     on public.reservaciones(bloque);

comment on table public.reservaciones is
  'Reservas de sesiones. unique(usuario_id, bloque) impide doble reserva en el mismo horario.';


-- =============================================================================
-- 5. VISTA: sesiones con estado de capacidad en tiempo real
-- Usar esta vista en la agenda en lugar de la tabla sesiones directamente.
-- =============================================================================

create or replace view public.sesiones_con_capacidad
  with (security_invoker = true)
as
select
  s.*,
  count(r.id)::integer                 as reservaciones_count,
  (s.capacidad - count(r.id))::integer as lugares_disponibles,
  (count(r.id) >= s.capacidad)         as llena
from   public.sesiones s
left   join public.reservaciones r on r.sesion_id = s.id
group  by s.id;

comment on view public.sesiones_con_capacidad is
  'Sesiones con cupos disponibles en tiempo real. Úsala en la agenda en lugar de sesiones.';


-- =============================================================================
-- 6. TRIGGER: bloquear reservaciones cuando la sesión está llena
-- Previene race conditions cuando dos usuarios reservan el último cupo.
-- Lanza error P0001 que el API route maneja y devuelve 409.
-- =============================================================================

create or replace function public.validar_capacidad_sesion()
returns trigger
language plpgsql
security definer
as $$
declare
  v_cap  integer;
  v_used integer;
begin
  select capacidad into v_cap  from public.sesiones       where id = new.sesion_id;
  select count(*)  into v_used from public.reservaciones  where sesion_id = new.sesion_id;

  if v_used >= v_cap then
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
  for each row execute function public.validar_capacidad_sesion();


-- =============================================================================
-- 7. TRIGGER: crear perfil en public.usuarios al hacer signUp
-- Actúa como fallback: si el cliente no inserta el perfil, el trigger lo crea
-- usando los metadatos que se pasan en supabase.auth.signUp({ options: { data: { nombre, institucion } } })
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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
  for each row execute function public.handle_new_user();


-- =============================================================================
-- 8. ROW LEVEL SECURITY
-- service_role (usado en API routes del servidor) SIEMPRE bypasea RLS.
-- anon = usuario no logueado | authenticated = usuario logueado
-- =============================================================================

alter table public.sesiones      enable row level security;
alter table public.usuarios      enable row level security;
alter table public.reservaciones enable row level security;

-- ── SESIONES: lectura pública ─────────────────────────────────────────────────
create policy "sesiones_lectura_publica"
  on public.sesiones for select
  to anon, authenticated
  using (true);

-- ── USUARIOS: cada usuario accede solo a su propio registro ──────────────────
create policy "usuarios_ver_propio"
  on public.usuarios for select
  to authenticated
  using (id = auth.uid());

create policy "usuarios_insertar_propio"
  on public.usuarios for insert
  to authenticated
  with check (id = auth.uid());

create policy "usuarios_actualizar_propio"
  on public.usuarios for update
  to authenticated
  using    (id = auth.uid())
  with check (id = auth.uid());

-- ── RESERVACIONES: cada usuario ve y crea solo las suyas ─────────────────────
-- No hay UPDATE ni DELETE para authenticated:
--   - La asistencia la marca el staff vía /api/scan (service_role)
--   - Cancelar reservaciones: agregar policy DELETE si se requiere

create policy "reservaciones_ver_propias"
  on public.reservaciones for select
  to authenticated
  using (usuario_id = auth.uid());

create policy "reservaciones_crear_propias"
  on public.reservaciones for insert
  to authenticated
  with check (usuario_id = auth.uid());


-- =============================================================================
-- 9. DATOS DE PRUEBA
-- Las 6 sesiones originales del proyecto con bloque (int)
-- Descomentar si se necesita reinsertar (no duplica si ya existen por UUID)
-- =============================================================================

/*
insert into public.sesiones (titulo, ponente, descripcion, hora_inicio, hora_fin, lugar, bloque, capacidad) values
  ('Inteligencia Artificial en la Medicina',  'Dr. Carlos López',   'Exploración del uso de IA en diagnósticos médicos',    '09:00', '10:00', 'Auditorio A', 1, 80),
  ('Machine Learning para Principiantes',      'Dra. Ana Martínez',  'Introducción práctica al aprendizaje automático',      '09:00', '10:00', 'Sala 101',    1, 40),
  ('Ciberseguridad en 2026',                  'Ing. Roberto Silva', 'Tendencias actuales en seguridad informática',         '09:00', '10:00', 'Sala 102',    1, 30),
  ('Desarrollo de Apps Móviles',              'Dra. Laura García',  'Creación de aplicaciones para iOS y Android',          '10:30', '11:30', 'Auditorio A', 2, 80),
  ('Cloud Computing Avanzado',                'Dr. Miguel Torres',  'Arquitecturas modernas en la nube',                    '10:30', '11:30', 'Sala 101',    2, 40),
  ('Blockchain y Web3',                       'Ing. Sofia Ramírez', 'El futuro de las aplicaciones descentralizadas',       '10:30', '11:30', 'Sala 102',    2, 30);
*/


-- =============================================================================
-- VERIFICACIÓN — ejecutar estas queries para confirmar que todo quedó bien
-- =============================================================================

/*
-- Columnas de reservaciones:
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'reservaciones'
order by ordinal_position;

-- RLS habilitado:
select tablename, rowsecurity
from pg_tables
where schemaname = 'public';

-- Políticas activas:
select tablename, policyname, cmd, roles::text
from pg_policies
where schemaname = 'public'
order by tablename;

-- Triggers activos:
select trigger_name, event_object_table, action_timing, event_manipulation
from information_schema.triggers
where trigger_schema = 'public' or event_object_schema = 'public'
order by event_object_table;

-- Vista funcionando:
select id, titulo, bloque, capacidad, reservaciones_count, lugares_disponibles, llena
from public.sesiones_con_capacidad
order by bloque;
*/


-- =============================================================================
-- RESUMEN DE PERMISOS
-- ┌──────────────────┬──────────┬───────────────┬─────────────────────────────┐
-- │ Tabla             │ anon     │ authenticated  │ service_role (API routes)  │
-- ├──────────────────┼──────────┼───────────────┼─────────────────────────────┤
-- │ sesiones          │ SELECT   │ SELECT        │ ALL (admin)                 │
-- │ usuarios          │ —        │ solo el propio│ ALL                         │
-- │ reservaciones     │ —        │ solo las suyas│ ALL (marca asistencia)      │
-- └──────────────────┴──────────┴───────────────┴─────────────────────────────┘
-- =============================================================================
