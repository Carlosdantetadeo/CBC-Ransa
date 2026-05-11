// ============================================================
// AUXILIAR.JS — Lógica de la interfaz del trabajador
// Sistema Espejo Operativo · Ransa / CBC
// ============================================================

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// State
let currentAuxiliar = null;
let currentAsistencia = null;
let timerInterval = null;
let configData = {};

// DOM references
const stateA = document.getElementById('state-a');
const stateB = document.getElementById('state-b');
const stateC = document.getElementById('state-c');
const stateD = document.getElementById('state-d');
const modal  = document.getElementById('modal-finalizar');

// ── Helpers ──────────────────────────────────────────────

function showState(state) {
  [stateA, stateB, stateC, stateD].forEach(s => s.classList.add('hidden'));
  state.classList.remove('hidden');
}

function showError(elId, msg) {
  const el = document.getElementById(elId);
  el.textContent = msg;
  el.classList.remove('hidden');
}

function hideError(elId) {
  document.getElementById(elId).classList.add('hidden');
}

function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (loading) {
    btn.disabled = true;
    btn._originalHTML = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span> Procesando…';
  } else {
    btn.disabled = false;
    btn.innerHTML = btn._originalHTML || btn.innerHTML;
  }
}

function formatTime(date) {
  return new Date(date).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('es-PE', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}

function getTodayISO() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ── Load config from DB ──────────────────────────────────

async function loadConfig() {
  const { data, error } = await db.from('config').select('*');
  if (error) { console.error('Config error:', error); return; }
  data.forEach(row => { configData[row.clave] = row.valor; });
}

// ── ESTADO A: Login by DNI ───────────────────────────────

async function handleLogin() {
  hideError('error-dni');
  const dniInput = document.getElementById('input-dni');
  const dni = dniInput.value.trim();

  if (!/^\d{8}$/.test(dni)) {
    showError('error-dni', 'Ingresa un DNI válido de 8 dígitos');
    return;
  }

  setLoading('btn-ingresar', true);

  try {
    // Lookup auxiliar
    const { data: aux, error: auxErr } = await db
      .from('auxiliares')
      .select('*')
      .eq('dni', dni)
      .single();

    if (auxErr || !aux) {
      showError('error-dni', 'DNI no registrado, consulta a tu supervisor');
      setLoading('btn-ingresar', false);
      return;
    }

    if (!aux.activo) {
      showError('error-dni', 'Cuenta inactiva — contacta a tu supervisor');
      setLoading('btn-ingresar', false);
      return;
    }

    currentAuxiliar = aux;

    // Check if already has checkin today without checkout
    const { data: existing } = await db
      .from('asistencia')
      .select('*')
      .eq('auxiliar_id', aux.id)
      .eq('fecha', getTodayISO())
      .is('hora_checkout', null)
      .maybeSingle();

    if (existing) {
      currentAsistencia = existing;
      enterStateC();
    } else {
      // Check if already completed today
      const { data: completed } = await db
        .from('asistencia')
        .select('*')
        .eq('auxiliar_id', aux.id)
        .eq('fecha', getTodayISO())
        .not('hora_checkout', 'is', null)
        .maybeSingle();

      if (completed) {
        currentAsistencia = completed;
        showResumen(completed);
      } else {
        enterStateB();
      }
    }
  } catch (e) {
    showError('error-dni', 'Error: ' + (e.message || 'Sin conexión'));
    console.error(e);
  }

  setLoading('btn-ingresar', false);
}

// Allow Enter key on DNI input
document.getElementById('input-dni').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleLogin();
});

// ── ESTADO B: Check-in ───────────────────────────────────

function enterStateB() {
  document.getElementById('checkin-nombre').textContent = currentAuxiliar.nombre_completo;
  document.getElementById('checkin-fecha').textContent = formatDate(new Date());
  showState(stateB);
  document.getElementById('input-ruta').focus();
}

async function handleCheckin() {
  hideError('error-ruta');
  const rutaInput = document.getElementById('input-ruta');
  const ruta = rutaInput.value.trim();

  if (!ruta) {
    showError('error-ruta', 'Ingresa el código de ruta asignado');
    return;
  }

  setLoading('btn-checkin', true);

  try {
    const montoDia = parseFloat(configData.pago_dia_base || '65.00');
    const now = new Date().toISOString();

    const { data, error } = await db
      .from('asistencia')
      .insert({
        auxiliar_id: currentAuxiliar.id,
        fecha: getTodayISO(),
        hora_checkin: now,
        codigo_ruta: ruta,
        monto_dia: montoDia
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        showError('error-ruta', 'Ya tienes un registro para hoy');
      } else {
        showError('error-ruta', 'Error al registrar. Intenta de nuevo.');
        console.error(error);
      }
      setLoading('btn-checkin', false);
      return;
    }

    currentAsistencia = data;
    enterStateC();
  } catch (e) {
    showError('error-ruta', 'Error de conexión. Intenta de nuevo.');
    console.error(e);
  }

  setLoading('btn-checkin', false);
}

document.getElementById('input-ruta').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleCheckin();
});

// ── ESTADO C: En ruta (timer) ────────────────────────────

function enterStateC() {
  document.getElementById('enruta-nombre').textContent = currentAuxiliar.nombre_completo;
  document.getElementById('enruta-ruta').textContent = currentAsistencia.codigo_ruta;
  document.getElementById('enruta-hora-inicio').textContent = formatTime(currentAsistencia.hora_checkin);

  showState(stateC);
}

// ── Finalizar ruta ───────────────────────────────────────

function showFinalizarModal() {
  modal.classList.remove('hidden');
}

function closeModal() {
  modal.classList.add('hidden');
}

async function handleCheckout(rutaCumplida) {
  closeModal();
  setLoading('btn-finalizar', true);

  try {
    const now = new Date();
    const checkin = new Date(currentAsistencia.hora_checkin);
    const horasTrabajadas = ((now - checkin) / 3600000).toFixed(2);

    // Evaluate incentivo nocturno
    const horaCorte = configData.hora_corte_nocturno || '22:00';
    const [ch, cm] = horaCorte.split(':').map(Number);
    const corteToday = new Date(now);
    corteToday.setHours(ch, cm, 0, 0);

    const esNocturno = now >= corteToday;
    const montoIncentivo = esNocturno
      ? parseFloat(configData.incentivo_nocturno_monto || '0')
      : 0;

    const { data, error } = await db
      .from('asistencia')
      .update({
        hora_checkout: now.toISOString(),
        ruta_cumplida: rutaCumplida,
        horas_trabajadas: parseFloat(horasTrabajadas),
        flag_incentivo_nocturno: esNocturno,
        monto_incentivo: montoIncentivo
      })
      .eq('id', currentAsistencia.id)
      .select()
      .single();

    if (error) {
      console.error('Checkout error:', error);
      alert('Error al finalizar. Intenta de nuevo.');
      setLoading('btn-finalizar', false);
      return;
    }

    if (timerInterval) clearInterval(timerInterval);
    currentAsistencia = data;
    showResumen(data);
  } catch (e) {
    console.error(e);
    alert('Error de conexión.');
  }

  setLoading('btn-finalizar', false);
}

function showResumen(asistencia) {
  const resumenEl = document.getElementById('resumen-final');
  const cumplida = asistencia.ruta_cumplida;
  // Format the date properly adding timezone offset to prevent shifting day
  const dateParts = asistencia.fecha.split('-');
  const fechaObj = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
  const fechaStr = fechaObj.toLocaleDateString('es-PE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  resumenEl.innerHTML = `
    <div class="summary-row">
      <span class="label">Fecha</span>
      <span class="value" style="text-transform: capitalize;">${fechaStr}</span>
    </div>
    <div class="summary-row">
      <span class="label">Ruta</span>
      <span class="value">${asistencia.codigo_ruta}</span>
    </div>
    <div class="summary-row">
      <span class="label">Ruta cumplida</span>
      <span class="value">${cumplida ? '✅ Sí' : '❌ No'}</span>
    </div>
    <hr style="border-color:var(--border-color);margin:.75rem 0">
    <div class="summary-row" style="font-size:1.05rem">
      <span class="label" style="font-weight:700">Pago del día</span>
      <span class="value" style="color:var(--color-success)">S/ ${parseFloat(asistencia.monto_dia || 0).toFixed(2)}</span>
    </div>
  `;

  showState(stateD);
}

// ── Logout / Reset ───────────────────────────────────────

function handleLogout() {
  currentAuxiliar = null;
  currentAsistencia = null;
  if (timerInterval) clearInterval(timerInterval);
  document.getElementById('input-dni').value = '';
  document.getElementById('input-ruta').value = '';
  hideError('error-dni');
  hideError('error-ruta');
  showState(stateA);
  document.getElementById('input-dni').focus();
}

// ── Init ─────────────────────────────────────────────────

async function init() {
  await loadConfig();
  document.getElementById('input-dni').focus();
}

init();
