// ============================================================
// ADMIN.JS — Gestión de auxiliares y configuración
// Sistema Espejo Operativo · Ransa / CBC
// ============================================================

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Helpers ──────────────────────────────────────────────

function showMsg(id, msg, autoHide = true) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.classList.remove('hidden');
  if (autoHide) setTimeout(() => el.classList.add('hidden'), 4000);
}

function hideMsg(id) {
  document.getElementById(id).classList.add('hidden');
}

// ── Load auxiliares ──────────────────────────────────────

async function loadAuxiliares() {
  const { data, error } = await db
    .from('auxiliares')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) { console.error(error); return; }
  renderAuxiliares(data || []);
}

function renderAuxiliares(list) {
  const tbody = document.getElementById('aux-tbody');
  tbody.innerHTML = '';

  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">No hay auxiliares registrados</td></tr>';
    return;
  }

  list.forEach(aux => {
    const tr = document.createElement('tr');
    const fecha = aux.fecha_ingreso
      ? new Date(aux.fecha_ingreso).toLocaleDateString('es-PE')
      : '—';

    let telefonoHtml = '—';
    if (aux.telefono) {
      const waNumber = aux.telefono.replace(/\D/g, '');
      telefonoHtml = `
        <div style="display:flex;align-items:center;gap:0.5rem">
          ${aux.telefono}
          <a href="https://wa.me/51${waNumber}" target="_blank" style="color:#25D366;" title="WhatsApp">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          </a>
        </div>`;
    }

    tr.innerHTML = `
      <td><strong>${aux.dni}</strong></td>
      <td>${aux.nombre_completo}</td>
      <td>${aux.puesto || '—'}</td>
      <td>${telefonoHtml}</td>
      <td>
        <label class="toggle">
          <input type="checkbox" ${aux.activo ? 'checked' : ''}
                 onchange="toggleActivo('${aux.id}', this.checked)">
          <span class="slider"></span>
        </label>
      </td>
      <td>${fecha}</td>`;
    tbody.appendChild(tr);
  });
}

// ── Add auxiliar ─────────────────────────────────────────

async function addAuxiliar() {
  hideMsg('add-error');
  hideMsg('add-success');

  const dni = document.getElementById('new-dni').value.trim();
  const nombre = document.getElementById('new-nombre').value.trim();
  const puesto = document.getElementById('new-puesto').value.trim();
  const zona = document.getElementById('new-zona').value.trim();
  const cuenta = document.getElementById('new-cuenta').value.trim();
  const direccion = document.getElementById('new-direccion').value.trim();
  const telefono = document.getElementById('new-telefono').value.trim();
  const contacto = document.getElementById('new-contacto').value.trim();
  const telemerg = document.getElementById('new-telemerg').value.trim();

  if (!/^\d{8}$/.test(dni)) {
    showMsg('add-error', 'DNI debe tener exactamente 8 dígitos');
    return;
  }
  if (!nombre) {
    showMsg('add-error', 'El nombre es obligatorio');
    return;
  }

  const btn = document.getElementById('btn-add');
  btn.disabled = true;
  btn.textContent = 'Guardando…';

  const { error } = await db.from('auxiliares').insert({
    dni,
    nombre_completo: nombre,
    puesto: puesto || null,
    zona_operacion: zona || null,
    cuenta_bancaria: cuenta || null,
    direccion: direccion || null,
    telefono: telefono || null,
    contacto_emergencia: contacto || null,
    telefono_emergencia: telemerg || null,
    fecha_ingreso: new Date().toISOString().split('T')[0]
  });

  btn.disabled = false;
  btn.textContent = '+ Agregar';

  if (error) {
    if (error.code === '23505') {
      showMsg('add-error', 'Ya existe un auxiliar con ese DNI');
    } else {
      showMsg('add-error', 'Error al guardar: ' + error.message);
    }
    return;
  }

  showMsg('add-success', `✅ Auxiliar ${nombre} agregado correctamente`);
  ['dni','nombre','puesto','zona','cuenta','direccion','telefono','contacto','telemerg'].forEach(id => {
    document.getElementById('new-' + id).value = '';
  });
  loadAuxiliares();
}

// ── Toggle activo ────────────────────────────────────────

async function toggleActivo(id, activo) {
  const { error } = await db
    .from('auxiliares')
    .update({ activo })
    .eq('id', id);

  if (error) {
    console.error(error);
    alert('Error al actualizar estado');
    loadAuxiliares();
  }
}

// ── Config ───────────────────────────────────────────────

async function loadConfig() {
  const { data, error } = await db.from('config').select('*');
  if (error) { console.error(error); return; }
  renderConfig(data || []);
}

function renderConfig(items) {
  const grid = document.getElementById('config-grid');
  grid.innerHTML = '';

  const icons = {
    pago_dia_base: '💰',
    incentivo_nocturno_monto: '🌙',
    hora_corte_nocturno: '🕐'
  };

  items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'config-item';
    const icon = icons[item.clave] || '⚙️';
    const inputType = item.clave === 'hora_corte_nocturno' ? 'time' : 'text';

    div.innerHTML = `
      <label>${icon} ${item.clave}</label>
      <input type="${inputType}" id="config-${item.clave}" value="${item.valor}">
      <div class="desc">${item.descripcion || ''}</div>`;
    grid.appendChild(div);
  });
}

async function saveConfig() {
  const btn = document.getElementById('btn-save-config');
  btn.disabled = true;
  btn.textContent = 'Guardando…';
  hideMsg('config-success');

  const inputs = document.querySelectorAll('[id^="config-"]');
  const updates = [];

  inputs.forEach(input => {
    const clave = input.id.replace('config-', '');
    updates.push(
      db.from('config').update({ valor: input.value }).eq('clave', clave)
    );
  });

  await Promise.all(updates);

  btn.disabled = false;
  btn.textContent = '💾 Guardar configuración';
  showMsg('config-success', '✅ Configuración guardada correctamente');
}

// ── Init ─────────────────────────────────────────────────

async function init() {
  await Promise.all([loadAuxiliares(), loadConfig()]);
}

init();
