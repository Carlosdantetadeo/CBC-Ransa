-- ============================================================
-- SISTEMA ESPEJO OPERATIVO — Supabase Schema
-- Outsourcing Logístico Ransa / CBC
-- ============================================================

-- 1. Tabla de Auxiliares de Reparto
CREATE TABLE IF NOT EXISTS auxiliares (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dni           varchar(8)   UNIQUE NOT NULL,
  nombre_completo varchar(100) NOT NULL,
  telefono      varchar(12),
  cuenta_bancaria varchar(50),
  zona_operacion varchar(100),
  direccion     text,
  contacto_emergencia varchar(100),
  telefono_emergencia varchar(15),
  puesto        varchar(100),
  activo        boolean      DEFAULT true,
  fecha_ingreso date,
  created_at    timestamptz  DEFAULT now()
);

-- Índices para auxiliares
CREATE INDEX IF NOT EXISTS idx_auxiliares_dni ON auxiliares (dni);
CREATE INDEX IF NOT EXISTS idx_auxiliares_activo ON auxiliares (activo);

-- 2. Tabla de Asistencia (registro diario de jornada)
CREATE TABLE IF NOT EXISTS asistencia (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auxiliar_id              uuid NOT NULL REFERENCES auxiliares(id) ON DELETE CASCADE,
  fecha                    date NOT NULL,
  hora_checkin             timestamptz NOT NULL,
  hora_checkout            timestamptz,          -- null = aún en ruta
  codigo_ruta              varchar(20),           -- código asignado por Ransa
  ruta_cumplida            boolean,               -- null hasta checkout
  horas_trabajadas         numeric(4,2),          -- calculado al hacer checkout
  flag_incentivo_nocturno  boolean DEFAULT false,  -- true si checkout > hora corte
  monto_dia                numeric(6,2) DEFAULT 65.00,
  monto_incentivo          numeric(6,2) DEFAULT 0,
  observaciones            text,
  created_at               timestamptz DEFAULT now(),
  -- Evitar doble checkin el mismo día para el mismo auxiliar
  CONSTRAINT uq_auxiliar_fecha UNIQUE (auxiliar_id, fecha)
);

-- Índices para asistencia
CREATE INDEX IF NOT EXISTS idx_asistencia_fecha ON asistencia (fecha);
CREATE INDEX IF NOT EXISTS idx_asistencia_auxiliar ON asistencia (auxiliar_id);
CREATE INDEX IF NOT EXISTS idx_asistencia_auxiliar_fecha ON asistencia (auxiliar_id, fecha);
CREATE INDEX IF NOT EXISTS idx_asistencia_checkout_null ON asistencia (fecha) WHERE hora_checkout IS NULL;

-- 3. Tabla de Configuración (clave-valor)
CREATE TABLE IF NOT EXISTS config (
  clave       varchar(50) PRIMARY KEY,
  valor       text NOT NULL,
  descripcion text
);

-- Datos iniciales de configuración
INSERT INTO config (clave, valor, descripcion) VALUES
  ('pago_dia_base',            '65.00', 'Pago fijo por día trabajado en soles'),
  ('incentivo_nocturno_monto', '0.00',  'Monto adicional si checkout > hora corte nocturno'),
  ('hora_corte_nocturno',      '22:00', 'Hora desde la que aplica incentivo nocturno (HH:MM)')
ON CONFLICT (clave) DO NOTHING;

-- 4. Habilitar Realtime en la tabla asistencia
-- (Ejecutar desde el SQL Editor de Supabase)
ALTER PUBLICATION supabase_realtime ADD TABLE asistencia;

-- 5. Vista auxiliar para consolidado semanal (opcional, útil para queries)
CREATE OR REPLACE VIEW v_consolidado_semanal AS
SELECT
  a.auxiliar_id,
  aux.nombre_completo,
  aux.dni,
  aux.puesto,
  MIN(a.fecha) AS fecha_inicio,
  MAX(a.fecha) AS fecha_fin,
  COUNT(*)::int AS dias_trabajados,
  COUNT(*) FILTER (WHERE a.ruta_cumplida = true)::int AS rutas_cumplidas,
  COUNT(*) FILTER (WHERE a.ruta_cumplida = false)::int AS rutas_no_cumplidas,
  SUM(COALESCE(a.monto_dia, 0))::numeric(8,2) AS total_monto_dia,
  SUM(COALESCE(a.monto_incentivo, 0))::numeric(8,2) AS total_incentivos,
  (SUM(COALESCE(a.monto_dia, 0)) + SUM(COALESCE(a.monto_incentivo, 0)))::numeric(8,2) AS total_pagar
FROM asistencia a
JOIN auxiliares aux ON aux.id = a.auxiliar_id
WHERE a.hora_checkout IS NOT NULL
GROUP BY a.auxiliar_id, aux.nombre_completo, aux.dni;
