// ============================================================
// DASHBOARD.JS — Panel del supervisor (Realtime)
// Sistema Espejo Operativo · Ransa / CBC
// ============================================================

const adminPass = prompt("🔒 Área restringida. Ingrese contraseña de Administrador:");
if (adminPass !== "Logistica2024") {
  document.body.innerHTML = "<h2 style='text-align:center;margin-top:50px;color:red;font-family:sans-serif'>⛔ Acceso Denegado</h2>";
  throw new Error("Acceso denegado");
}

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let configData = {};
let weekData = [];
let fleetTimers = {};

// ── Helpers ──────────────────────────────────────────────

function getTodayISO() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;
}

function formatTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString('es-PE', { hour:'2-digit', minute:'2-digit' });
}

function formatDuration(checkin, checkout) {
  const start = new Date(checkin).getTime();
  const end = checkout ? new Date(checkout).getTime() : Date.now();
  const diff = end - start;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `${h}h ${String(m).padStart(2,'0')}m`;
}

function isAfterCorte(ts) {
  if (!ts || !configData.hora_corte_nocturno) return false;
  const d = new Date(ts);
  const [ch, cm] = configData.hora_corte_nocturno.split(':').map(Number);
  const corte = new Date(d);
  corte.setHours(ch, cm, 0, 0);
  return d >= corte;
}

function getMonday(d) {
  const dt = new Date(d);
  const day = dt.getDay();
  const diff = dt.getDate() - day + (day === 0 ? -6 : 1);
  dt.setDate(diff);
  return dt.toISOString().split('T')[0];
}

function getSunday(mondayStr) {
  const dt = new Date(mondayStr);
  dt.setDate(dt.getDate() + 6);
  return dt.toISOString().split('T')[0];
}

// ── Load config ──────────────────────────────────────────

async function loadConfig() {
  const { data } = await db.from('config').select('*');
  if (data) data.forEach(r => { configData[r.clave] = r.valor; });
}

// ── Metrics + Fleet table ────────────────────────────────

async function loadDashboard() {
  const dateInput = document.getElementById('fleet-date');
  if (!dateInput.value) dateInput.value = getTodayISO();
  const selectedDate = dateInput.value;

  // Update header title
  const dateParts = selectedDate.split('-');
  const dateObj = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
  document.getElementById('fecha-hoy').textContent = dateObj.toLocaleDateString('es-PE', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

  // Get today's attendance with auxiliar names
  const { data: records, error } = await db
    .from('asistencia')
    .select('*, auxiliares(nombre_completo, dni, puesto)')
    .eq('fecha', selectedDate);

  if (error) { console.error(error); return; }

  // Also get auxiliares with no record today
  const { data: allAux } = await db
    .from('auxiliares')
    .select('id, nombre_completo, dni, puesto, activo')
    .eq('activo', true);

  const recordMap = {};
  (records || []).forEach(r => { recordMap[r.auxiliar_id] = r; });

  // Metrics
  const activos = records ? records.length : 0;
  const enRuta = records ? records.filter(r => !r.hora_checkout).length : 0;
  const finalizados = records ? records.filter(r => r.hora_checkout).length : 0;
  const cumplidas = records ? records.filter(r => r.ruta_cumplida === true).length : 0;
  const noCumplidas = records ? records.filter(r => r.ruta_cumplida === false).length : 0;
  const nocturnos = records ? records.filter(r => r.flag_incentivo_nocturno).length : 0;

  document.getElementById('m-cobertura').textContent = `${activos}/${allAux ? allAux.length : 0}`;
  document.getElementById('m-activos').textContent = activos;
  document.getElementById('m-enruta').textContent = enRuta;
  document.getElementById('m-finalizados').textContent = finalizados;
  document.getElementById('m-cumplidas').textContent = `${cumplidas}/${cumplidas + noCumplidas}`;
  document.getElementById('m-nocturnos').textContent = nocturnos;

  // Build fleet rows — combine records + unregistered
  const fleet = [];

  // First: those with records (sorted: en ruta first, then completed)
  if (records) {
    const enRutaRows = records.filter(r => !r.hora_checkout);
    const completedRows = records.filter(r => r.hora_checkout);
    fleet.push(...enRutaRows, ...completedRows);
  }

  // Then: auxiliares without records today
  if (allAux) {
    allAux.forEach(aux => {
      if (!recordMap[aux.id]) {
        fleet.push({
          _noRecord: true,
          auxiliar_id: aux.id,
          auxiliares: { nombre_completo: aux.nombre_completo, dni: aux.dni, puesto: aux.puesto }
        });
      }
    });
  }

  renderFleet(fleet);
}

function renderFleet(fleet) {
  const tbody = document.getElementById('fleet-tbody');
  tbody.innerHTML = '';

  fleet.forEach(row => {
    const tr = document.createElement('tr');
    const nombre = row.auxiliares?.nombre_completo || '—';
    const dni = row.auxiliares?.dni || '—';
    const puesto = row.auxiliares?.puesto || '—';

    if (row._noRecord) {
      tr.innerHTML = `
        <td>${nombre}</td><td>${dni}</td><td>${puesto}</td>
        <td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td>
        <td><span class="badge badge-sin-reg">⚫ Sin registro</span></td>
        <td>—</td>`;
    } else {
      const enRuta = !row.hora_checkout;
      const nocturnoLive = enRuta && isAfterCorte(new Date());

      let badge, cumplida;
      if (enRuta) {
        badge = '<span class="badge badge-en-ruta">🟡 En ruta</span>';
        cumplida = '—';
      } else if (row.ruta_cumplida) {
        badge = '<span class="badge badge-completado">🟢 Completado</span>';
        cumplida = '✅';
      } else {
        badge = '<span class="badge badge-fallido">🔴 No cumplida</span>';
        cumplida = '❌';
      }

      if (nocturnoLive) tr.classList.add('row-nocturno');

      const durId = `dur-${row.id}`;
      const horaCheckout = formatTime(row.hora_checkout);
      const horasTrab = row.horas_trabajadas ? parseFloat(row.horas_trabajadas).toFixed(2) + 'h' : '—';
      const montoDia = row.monto_dia ? 'S/ ' + parseFloat(row.monto_dia).toFixed(2) : '—';

      tr.innerHTML = `
        <td><strong>${nombre}</strong></td>
        <td>${dni}</td>
        <td>${puesto}</td>
        <td>${row.codigo_ruta || '—'}</td>
        <td>${formatTime(row.hora_checkin)}</td>
        <td>${horaCheckout}</td>
        <td>${horasTrab}</td>
        <td>${montoDia}</td>
        <td id="${durId}">${formatDuration(row.hora_checkin, row.hora_checkout)}</td>
        <td>${badge}</td>
        <td>${cumplida}</td>`;

      // Live timer for en-ruta rows
      if (enRuta) {
        if (fleetTimers[row.id]) clearInterval(fleetTimers[row.id]);
        fleetTimers[row.id] = setInterval(() => {
          const el = document.getElementById(durId);
          if (el) el.textContent = formatDuration(row.hora_checkin, null);
        }, 30000);
      }
    }

    tbody.appendChild(tr);
  });
}

// ── Week panel ───────────────────────────────────────────

function toggleWeekPanel() {
  const header = document.getElementById('week-toggle');
  const body = document.getElementById('week-panel');
  header.classList.toggle('open');
  body.classList.toggle('open');
}

async function loadWeekData() {
  const start = document.getElementById('week-start').value;
  const end = document.getElementById('week-end').value;
  if (!start || !end) { alert('Selecciona ambas fechas'); return; }

  const btn = document.getElementById('btn-week');
  btn.disabled = true;
  btn.textContent = 'Cargando…';

  const { data, error } = await db
    .from('asistencia')
    .select('*, auxiliares(nombre_completo, dni, puesto)')
    .gte('fecha', start)
    .lte('fecha', end)
    .not('hora_checkout', 'is', null);

  btn.disabled = false;
  btn.textContent = 'Consultar';

  if (error) { console.error(error); return; }

  // Group by auxiliar
  const map = {};
  (data || []).forEach(r => {
    const id = r.auxiliar_id;
    if (!map[id]) {
      map[id] = {
        nombre: r.auxiliares?.nombre_completo || '—',
        dni: r.auxiliares?.dni || '—',
        puesto: r.auxiliares?.puesto || '—',
        dias: 0,
        cumplidas: 0,
        totalDia: 0,
        totalIncentivo: 0
      };
    }
    map[id].dias++;
    if (r.ruta_cumplida) map[id].cumplidas++;
    map[id].totalDia += parseFloat(r.monto_dia || 0);
    map[id].totalIncentivo += parseFloat(r.monto_incentivo || 0);
  });

  weekData = Object.values(map);
  renderWeek(weekData);
}

function renderWeek(rows) {
  const tbody = document.getElementById('week-tbody');
  tbody.innerHTML = '';

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">Sin registros en este rango</td></tr>';
    return;
  }

  rows.forEach(r => {
    const total = (r.totalDia + r.totalIncentivo).toFixed(2);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${r.nombre}</strong></td>
      <td>${r.dni}</td>
      <td>${r.puesto}</td>
      <td>${r.dias}</td>
      <td>${r.cumplidas}</td>
      <td>S/ ${r.totalIncentivo.toFixed(2)}</td>
      <td><strong>S/ ${total}</strong></td>`;
    tbody.appendChild(tr);
  });
}

// ── Export CSV ────────────────────────────────────────────

function exportCSV() {
  if (!weekData.length) { alert('No hay datos para exportar. Consulta un rango primero.'); return; }

  const headers = ['Auxiliar', 'DNI', 'Dias Trabajados', 'Rutas Cumplidas', 'Total Incentivos', 'Total a Pagar'];
  const rows = weekData.map(r => [
    r.nombre, r.dni, r.dias, r.cumplidas,
    r.totalIncentivo.toFixed(2),
    (r.totalDia + r.totalIncentivo).toFixed(2)
  ]);

  let csv = headers.join(',') + '\n';
  rows.forEach(row => { csv += row.map(v => `"${v}"`).join(',') + '\n'; });

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const s = document.getElementById('week-start').value;
  const e = document.getElementById('week-end').value;
  a.download = `consolidado_${s}_${e}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Realtime subscription ────────────────────────────────

function subscribeRealtime() {
  db.channel('asistencia-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'asistencia' }, () => {
      loadDashboard();
    })
    .subscribe();
}

// ── Init ─────────────────────────────────────────────────

async function init() {
  const today = getTodayISO();
  document.getElementById('fleet-date').value = today;

  // Set default week range (current week)
  const monday = getMonday(new Date());
  const sunday = getSunday(monday);
  document.getElementById('week-start').value = monday;
  document.getElementById('week-end').value = sunday;

  await loadConfig();
  await loadDashboard();
  subscribeRealtime();

  // Refresh durations every minute
  setInterval(loadDashboard, 60000);
}

init();
