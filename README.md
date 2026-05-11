# 🪞 Sistema Espejo Operativo

**Outsourcing Logístico Ransa / CBC**

Sistema web para control de asistencia, estado de rutas y pago semanal de Auxiliares de Reparto.

---

## 📋 Arquitectura

| Componente | Tecnología |
|---|---|
| Frontend | HTML / CSS / JS vanilla |
| Backend + DB | Supabase (PostgreSQL + Realtime) |
| Deploy | Railway, Vercel, Netlify o cualquier hosting estático |

## 🗂️ Estructura de archivos

```
├── index.html          → Redirige a /auxiliar
├── auxiliar.html        → Interfaz del trabajador (mobile-first)
├── auxiliar.js          → Lógica de check-in/checkout
├── dashboard.html       → Panel del supervisor (desktop)
├── dashboard.js         → Métricas, flota, consolidado, Realtime
├── admin.html           → Gestión de auxiliares + config
├── admin.js             → CRUD auxiliares, editor de config
├── styles.css           → Design system compartido
├── config.js            → Credenciales Supabase (⚠️ en .gitignore)
├── supabase-schema.sql  → Script SQL para crear tablas
└── README.md
```

---

## 🚀 Setup paso a paso

### 1. Crear proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) y crea una cuenta (gratis).
2. Crea un nuevo proyecto. Anota:
   - **Project URL** (ejemplo: `https://xyzabc.supabase.co`)
   - **Anon public key** (en Settings → API)

### 2. Crear las tablas

1. En tu proyecto de Supabase, ve a **SQL Editor**.
2. Copia todo el contenido de `supabase-schema.sql` y ejecútalo.
3. Verifica que se crearon las tablas: `auxiliares`, `asistencia`, `config`.

### 3. Habilitar Realtime

1. En Supabase, ve a **Database → Replication**.
2. Asegúrate de que la tabla `asistencia` tenga Realtime habilitado.
   (El script SQL ya lo intenta hacer, pero verifica manualmente).

### 4. Desactivar RLS (MVP)

1. Ve a **Authentication → Policies**.
2. Para las tablas `auxiliares`, `asistencia` y `config`, desactiva Row Level Security.
   - O bien, en SQL Editor ejecuta:
   ```sql
   ALTER TABLE auxiliares DISABLE ROW LEVEL SECURITY;
   ALTER TABLE asistencia DISABLE ROW LEVEL SECURITY;
   ALTER TABLE config DISABLE ROW LEVEL SECURITY;
   ```

### 5. Configurar credenciales

Edita el archivo `config.js` con tus datos:

```javascript
const SUPABASE_URL = 'https://tu-proyecto.supabase.co';
const SUPABASE_ANON_KEY = 'tu-anon-key-aqui';
```

> ⚠️ Este archivo está en `.gitignore` — no lo subas a repositorios públicos.

### 6. Deploy en Railway (o alternativas)

#### Opción A: Railway

1. Sube tu código a un repositorio de GitHub.
2. Ve a [railway.app](https://railway.app) y conecta tu repo.
3. Railway detectará que es contenido estático y lo servirá automáticamente.
4. Recuerda que `config.js` debe existir en el deploy (súbelo manualmente o usa variables de entorno).

#### Opción B: Netlify / Vercel

1. Conecta tu repo en Netlify o Vercel.
2. No se necesita build — son archivos estáticos.
3. Asegúrate de que `config.js` esté presente.

#### Opción C: Servidor local

```bash
# Con Python
python -m http.server 8000

# Con Node.js
npx serve .
```

---

## 📱 Páginas

### `/auxiliar` — Interfaz del trabajador
- Mobile-first, optimizado para 3G
- Flujo: DNI → Check-in con ruta → Timer en vivo → Checkout con resultado
- Detección automática de jornada nocturna

### `/dashboard` — Panel del supervisor
- Métricas en tiempo real (Supabase Realtime)
- Tabla de flota con badges de estado
- Consolidado semanal con exportación CSV

### `/admin` — Gestión
- CRUD de auxiliares (agregar, activar/desactivar)
- Editor de configuración (pago base, incentivo nocturno, hora de corte)

---

## ⚙️ Configuración editable desde /admin

| Clave | Valor por defecto | Descripción |
|---|---|---|
| `pago_dia_base` | 65.00 | Pago fijo por día (soles) |
| `incentivo_nocturno_monto` | 0.00 | Monto adicional por jornada nocturna |
| `hora_corte_nocturno` | 22:00 | Hora desde la que aplica incentivo |

---

## 📌 Notas del MVP

- **Sin autenticación** — acceso libre por ahora
- **RLS desactivado** — activar en producción con políticas
- **Variables de pago adicionales** (bonos especiales) reservadas para v2
- El campo `monto_incentivo` es configurable sin tocar código

---

## 📄 Licencia

Proyecto interno — uso privado.
