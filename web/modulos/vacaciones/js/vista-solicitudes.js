/* Solicitudes de vacaciones: lista, nueva solicitud con validación en vivo, aprobación */
(function () {
  'use strict';
  const { esc, $, $$ } = App;
  const S = App.S;
  let tab = null;

  const personasQuePuedoGestionar = () => {
    const act = S.d.personal.filter(p => p.activo !== 'NO');
    if (App.puede('solicitud_crear_todos')) return act;
    return act.filter(p => (p.id === S.user.persona_id && App.puede('solicitud_crear_propia')) ||
      (App.puede('solicitud_crear_equipo') && App.areasACargo().indexOf(p.area_id) >= 0));
  };
  App.puedeSolicitar = () => personasQuePuedoGestionar().length > 0;

  const esCumple = dlg => { const t = $('#ns-tipo', dlg); return !!t && t.value === 'CUMPLEANOS'; };
  const extra = dlg => {
    const o = { tipo: esCumple(dlg) ? 'CUMPLEANOS' : 'VACACION' };
    const mi = $('#ns-mi', dlg), mf = $('#ns-mf', dlg);
    o.medio_inicio = mi && mi.checked && !mi.closest('[hidden]') ? 'SI' : 'NO';
    o.medio_fin = mf && mf.checked && !mf.closest('[hidden]') ? 'SI' : 'NO';
    return o;
  };

  /* ---------- nueva solicitud ---------- */
  App.nuevaSolicitud = function (personaId, inicio, fin) {
    const gestionables = personasQuePuedoGestionar();
    if (!gestionables.length) { App.toast('Su usuario no está vinculado a una persona del registro. Pida al administrador que lo vincule.', 'error'); return; }
    const sel = personaId || S.user.persona_id || gestionables[0].id;
    const opciones = gestionables.slice().sort((a, b) => a.apellidos.localeCompare(b.apellidos, 'es')).map(p => '<option value="' + p.id + '"' + (p.id === sel ? ' selected' : '') + '>' + esc(p.apellidos + ', ' + p.nombres) + '</option>').join('');
    const exc = App.puede('solicitud_excepcion'), directo = App.puede('solicitud_aprobar_final'), cfg = S.d.config;
    const cumpleOn = cfg.cumpleanos_modo === 'LIBRE' || cfg.cumpleanos_modo === 'DESCUENTA', medioOn = cfg.permitir_medio_dia === 'SI';
    const html = '<div class="formulario"><label class="campo ancho">Persona' + (gestionables.length === 1 ? '<select id="ns-persona" disabled>' + opciones + '</select>' : '<select id="ns-persona">' + opciones + '</select>') + '</label>' +
      (cumpleOn ? '<label class="campo ancho">Tipo de solicitud<select id="ns-tipo"><option value="VACACION">Vacaciones</option><option value="CUMPLEANOS">Día de cumpleaños' + (cfg.cumpleanos_duracion === '0.5' ? ' (medio día)' : '') + '</option></select></label>' : '') +
      '<label class="campo">Desde<input type="date" id="ns-ini" value="' + esc(inicio || '') + '"></label><label class="campo" id="ns-fin-w">Hasta<input type="date" id="ns-fin" value="' + esc(fin || '') + '"></label>' +
      (medioOn ? '<div class="campo ancho medios-caja" id="ns-medios"><label class="chk"><input type="checkbox" id="ns-mi"><span id="ns-mi-t">El primer día es solo medio día</span></label><label class="chk" id="ns-mf-w"><input type="checkbox" id="ns-mf"><span>El último día es solo medio día</span></label></div>' : '') +
      '<label class="campo ancho">Observación (opcional)<textarea id="ns-obs" maxlength="300" placeholder="Por ejemplo: viaje familiar"></textarea></label></div>' +
      '<div id="ns-val" class="avisos" style="margin-top:14px" aria-live="polite"><div class="aviso info">' + App.ic('info') + '<span>Elija las fechas para ver cuántos días se descuentan y si cumple las reglas.</span></div></div>' +
      (exc ? '<label class="chk" id="ns-exc-w" style="margin-top:12px" hidden><input type="checkbox" id="ns-exc"><span>Registrar como <b>excepción</b> a las reglas (queda anotado en el historial)</span></label>' : '');
    let ultima = null, temporizador = null, enviando = false;
    return App.dialogo({
      titulo: cumpleOn || medioOn ? 'Nueva solicitud' : 'Solicitar vacaciones', html,
      botones: [{ txt: 'Cancelar', valor: null }, {
        txt: directo ? 'Registrar' : 'Enviar solicitud', clase: 'btn-primary', onClick: async (cerrar, dlg) => {
          if (enviando) return false;
          enviando = true;
          try {
            const r = await App.conCarga(() => App.api('solicitud_crear', Object.assign({ persona_id: $('#ns-persona', dlg).value, inicio: $('#ns-ini', dlg).value, fin: $('#ns-fin', dlg).value, obs: $('#ns-obs', dlg).value, excepcion: exc && $('#ns-exc', dlg).checked ? 'SI' : 'NO' }, extra(dlg))));
            App.toast(r.estado === 'APROBADA' ? (esCumple(dlg) ? 'Permiso de cumpleaños registrado y aprobado.' : 'Registrado y aprobado.') : 'Solicitud enviada. Quedó pendiente de aprobación.');
            cerrar(true); App.recargar();
          } finally { enviando = false; }
        }
      }],
      alAbrir: dlg => {
        const btn = $('footer .btn-primary', dlg);
        btn.disabled = true;
        const pintar = (v) => {
          ultima = v;
          const caja = $('#ns-val', dlg);
          if (!v) return;
          const bloqueos = v.errores.filter(e => e.severidad === 'BLOQUEA'), duros = bloqueos.filter(e => e.duro);
          let h = '';
          if (v.dias) h += '<div class="aviso ' + (bloqueos.length ? 'warn' : 'ok') + '">' + App.ic(bloqueos.length ? 'alerta' : 'check') + '<span><b>' + App.fmtNum(v.dias) + ' ' + (v.dias === 1 ? 'día' : 'días') + '</b> ' + (v.descuenta ? (v.dias === 1 ? 'descuenta' : 'descuentan') + ' vacación' : 'de permiso por cumpleaños (no descuenta de sus vacaciones)') + (v.saldo ? ' · saldo de vacación a esa fecha: <b>' + App.fmtNum(Math.max(0, v.saldo.disponible)) + '</b>' : '') + '</span></div>';
          h += v.errores.map(e => '<div class="aviso ' + (e.severidad === 'ADVIERTE' ? 'warn' : 'error') + '">' + App.ic('alerta') + '<span>' + esc(e.mensaje) + '</span></div>').join('');
          if (v.dias && !v.errores.length) h += '<div class="aviso ok">' + App.ic('check') + '<span>Cumple todas las reglas vigentes.</span></div>';
          caja.innerHTML = h;
          const w = $('#ns-exc-w', dlg);
          if (w) { w.hidden = !(bloqueos.length && !duros.length); if (w.hidden) $('#ns-exc', dlg).checked = false; }
          actualizarBoton();
        };
        const actualizarBoton = () => {
          const v = ultima, exc = $('#ns-exc', dlg);
          const bloqueos = v ? v.errores.filter(e => e.severidad === 'BLOQUEA') : [];
          btn.disabled = !v || !v.dias || (bloqueos.length > 0 && !(exc && exc.checked));
        };
        const validar = () => {
          clearTimeout(temporizador);
          const ini = $('#ns-ini', dlg).value, fi = $('#ns-fin', dlg).value;
          ultima = null; btn.disabled = true;
          if (!ini || !fi) return;
          temporizador = setTimeout(async () => {
            try { pintar(await App.api('validar', Object.assign({ persona_id: $('#ns-persona', dlg).value, inicio: ini, fin: fi }, extra(dlg)))); }
            catch (e) { $('#ns-val', dlg).innerHTML = '<div class="aviso error">' + App.ic('alerta') + '<span>' + esc(e.message) + '</span></div>'; }
          }, 250);
        };
        const ajustar = () => {
          const cum = esCumple(dlg), ini = $('#ns-ini', dlg).value, fi = $('#ns-fin', dlg).value, unDia = !!ini && ini === fi;
          if (cum) $('#ns-fin', dlg).value = ini;
          $('#ns-fin-w', dlg).hidden = cum;
          const med = $('#ns-medios', dlg);
          if (med) {
            med.hidden = cum;
            $('#ns-mf-w', dlg).hidden = unDia || cum;
            $('#ns-mi-t', dlg).textContent = unDia ? 'Solo medio día' : 'El primer día es solo medio día';
            if (unDia || cum) $('#ns-mf', dlg).checked = false;
            if (cum) $('#ns-mi', dlg).checked = false;
          }
        };
        const sugerirCumple = () => {
          const p = App.persona($('#ns-persona', dlg).value);
          if (!p || !p.fecha_nacimiento || $('#ns-ini', dlg).value) return;
          const hoy = App.hoy(), m = +p.fecha_nacimiento.slice(5, 7), dd = +p.fecha_nacimiento.slice(8, 10);
          let y = +hoy.slice(0, 4), f = App.iso(y, m, Math.min(dd, App.diasMes(y, m)));
          if (f < hoy) { y++; f = App.iso(y, m, Math.min(dd, App.diasMes(y, m))); }
          $('#ns-ini', dlg).value = f;
        };
        ['#ns-persona', '#ns-ini', '#ns-fin', '#ns-mi', '#ns-mf'].forEach(s => { const e = $(s, dlg); if (e) e.addEventListener('change', validar); });
        $('#ns-ini', dlg).addEventListener('change', () => { const f = $('#ns-fin', dlg); if (!f.value || f.value < $('#ns-ini', dlg).value || esCumple(dlg)) f.value = $('#ns-ini', dlg).value; ajustar(); validar(); });
        $('#ns-fin', dlg).addEventListener('change', ajustar);
        const tp = $('#ns-tipo', dlg);
        if (tp) tp.addEventListener('change', () => { if (esCumple(dlg)) sugerirCumple(); ajustar(); validar(); });
        ajustar();
        const exc = $('#ns-exc', dlg); if (exc) exc.addEventListener('change', actualizarBoton);
        if (inicio && fin) validar();
      }
    });
  };

  /* ---------- decidir / anular ---------- */
  App.decidir = async function (id, decision) {
    const s = S.d.solicitudes.find(x => x.id === id);
    if (!s) return;
    const p = App.persona(s.persona_id);
    try {
      if (decision === 'RECHAZAR') {
        const motivo = await App.pedirTexto('Rechazar solicitud de ' + App.nombreCompleto(p), 'Motivo del rechazo (lo verá la persona)', 'Rechazar');
        if (!motivo) return;
        await App.conCarga(() => App.api('solicitud_decidir', { id, decision, motivo }));
        App.toast('Solicitud rechazada.');
      } else {
        const r = await App.conCarga(() => App.api('solicitud_decidir', { id, decision }));
        App.toast(r.estado === 'APROBADA' ? 'Solicitud aprobada.' : 'Aprobada por usted; pasa a administración.');
      }
      App.recargar();
    } catch (e) {
      if (e.codigo === 'VALIDACION' && Array.isArray(e.extra)) {
        const duros = e.extra.some(x => x.duro && x.severidad === 'BLOQUEA');
        const puedeExc = App.puede('solicitud_excepcion') && !duros;
        const ok = await App.dialogo({
          titulo: 'No se puede aprobar tal cual', html: '<div class="avisos">' + e.extra.map(x => '<div class="aviso ' + (x.severidad === 'ADVIERTE' ? 'warn' : 'error') + '">' + App.ic('alerta') + '<span>' + esc(x.mensaje) + '</span></div>').join('') + '</div>' + (puedeExc ? '<p class="muted small" style="margin-top:12px">Como administrador puede aprobarla como excepción; quedará anotado.</p>' : ''),
          botones: [{ txt: 'Cerrar', valor: false }].concat(puedeExc ? [{ txt: 'Aprobar como excepción', clase: 'btn-primary', valor: true }] : [])
        });
        if (ok) { try { await App.conCarga(() => App.api('solicitud_decidir', { id, decision: 'APROBAR', excepcion: 'SI' })); App.toast('Solicitud aprobada como excepción.'); App.recargar(); } catch (e2) { App.toast(e2.message, 'error'); } }
      } else App.toast(e.message, 'error');
    }
  };

  App.anular = async function (id) {
    if (!(await App.confirmar('¿Anular esta solicitud? Los días vuelven al saldo y el cupo queda libre.', { si: 'Anular solicitud', peligro: true }))) return;
    try { await App.conCarga(() => App.api('solicitud_anular', { id })); App.toast('Solicitud anulada.'); App.recargar(); } catch (e) { App.toast(e.message, 'error'); }
  };

  /* ---------- detalle ---------- */
  App.detalleSolicitud = function (id) {
    const s = S.d.solicitudes.find(x => x.id === id);
    if (!s) return;
    const p = App.persona(s.persona_id);
    const fila = (k, v) => v ? '<tr><td class="muted" style="width:150px">' + k + '</td><td>' + v + '</td></tr>' : '';
    const fh = x => (x ? App.fmtFecha(x.slice(0, 10)) : '');
    const html = '<div class="persona" style="margin-bottom:12px">' + App.avatar(p, true) + '<div><b style="font-size:1.1rem">' + esc(App.nombreCompleto(p)) + '</b><small>' + esc(p.cargo || '') + ' · ' + esc(App.areaNombre(p.area_id)) + '</small></div></div>' +
      '<div class="tabla-wrap"><table class="tabla"><tbody>' + fila('Fechas', '<b>' + App.fmtRango(s.inicio, s.fin) + '</b>') + fila('Tipo', App.tipoTxt(s)) + fila(App.esCumple(s) && S.d.config.cumpleanos_modo !== 'DESCUENTA' ? 'Días de permiso' : 'Días que descuentan', App.fmtNum(s.dias) + ((s.medios || []).length ? ' <span class="muted small">(incluye medio día)</span>' : '')) + fila('Estado', App.badge(s.estado)) + fila('Observación', esc(s.obs)) +
      fila('Motivo', esc(s.motivo)) + fila('Registrada', s.creada_por ? esc(s.creada_por) + ' · ' + fh(s.creada_en) : '') + fila('Visto bueno del jefe', s.jefe_por ? esc(s.jefe_por) + ' · ' + fh(s.jefe_en) : '') +
      fila('Resolución final', s.final_por ? esc(s.final_por) + ' · ' + fh(s.final_en) : '') + fila('Excepción', s.excepcion === 'SI' ? '<span class="badge pendiente">' + App.ic('alerta') + 'Aprobada como excepción a las reglas</span>' : '') + '</tbody></table></div>';
    const botones = [{ txt: 'Cerrar', valor: null }];
    if (App.puedeAnular(s)) botones.unshift({ txt: 'Anular', clase: 'btn-danger', onClick: cerrar => { cerrar(); App.anular(s.id); } });
    if (App.puedeDecidir(s)) { botones.push({ txt: 'Rechazar', onClick: cerrar => { cerrar(); App.decidir(s.id, 'RECHAZAR'); } }); botones.push({ txt: 'Aprobar', clase: 'btn-primary', onClick: cerrar => { cerrar(); App.decidir(s.id, 'APROBAR'); } }); }
    App.dialogo({ titulo: App.esCumple(s) ? 'Día de cumpleaños' : 'Solicitud de vacaciones', html, botones, alAbrir: () => App.pintarFotos() });
  };

  /* ---------- vista ---------- */
  App.registrar('solicitudes', {
    titulo: 'Solicitudes',
    render(el) {
      const d = S.d, hayPorResolver = d.solicitudes.some(App.puedeDecidir);
      const gestor = App.esGestor();
      if (tab === null || (!gestor && tab === 'resolver')) tab = gestor && hayPorResolver ? 'resolver' : 'todas';
      const f = { estado: '', texto: '' };
      el.innerHTML = App.cabecera('Solicitudes', gestor ? 'Pida, apruebe o rechace vacaciones.' : 'Sus solicitudes de vacaciones y su estado.',
        (App.puedeSolicitar() ? '<button class="btn btn-primary" id="s-nueva">' + App.ic('mas') + 'Nueva solicitud</button>' : '') + (gestor || App.puede('ver_personal_todos') ? '<button class="btn" id="s-csv">Exportar a Excel (CSV)</button>' : '')) +
        (gestor ? '<div class="tabs" role="tablist"><button role="tab" data-tab="resolver" aria-selected="' + (tab === 'resolver') + '">Por resolver' + (hayPorResolver ? ' (' + d.solicitudes.filter(App.puedeDecidir).length + ')' : '') + '</button><button role="tab" data-tab="todas" aria-selected="' + (tab === 'todas') + '">Todas</button></div>' : '') +
        '<div class="filtros"><label class="campo">Estado<select id="s-estado"><option value="">Todos</option><option value="tramite">En trámite</option><option value="APROBADA">Aprobadas</option><option value="RECHAZADA">Rechazadas</option><option value="ANULADA">Anuladas</option></select></label>' +
        (!App.veTodasLasSolicitudes() ? '' : '<label class="campo">Buscar persona<input type="search" id="s-texto" placeholder="Nombre o apellido"></label>') + '</div><div id="s-lista"></div>';
      const lista = () => {
        let rows = d.solicitudes.slice();
        if (!App.veTodasLasSolicitudes()) rows = rows.filter(s => s.persona_id === S.user.persona_id);
        if (tab === 'resolver') rows = rows.filter(App.puedeDecidir);
        if (f.estado === 'tramite') rows = rows.filter(App.esPendiente); else if (f.estado) rows = rows.filter(s => s.estado === f.estado);
        if (f.texto) { const t = f.texto.toLowerCase(); rows = rows.filter(s => { const p = App.persona(s.persona_id); return p && App.nombreCompleto(p).toLowerCase().includes(t); }); }
        rows.sort((a, b) => (tab === 'resolver' ? (a.inicio < b.inicio ? -1 : 1) : (a.inicio < b.inicio ? 1 : -1)));
        $('#s-lista', el)._filas = rows;
        if (!rows.length) { $('#s-lista', el).innerHTML = '<div class="panel vacio"><b>' + (tab === 'resolver' ? 'Nada por resolver' : 'No hay solicitudes') + '</b>' + (tab === 'resolver' ? 'Las solicitudes que esperen su decisión aparecerán aquí.' : 'Cuando se registren vacaciones aparecerán en esta lista.') + '</div>'; return; }
        $('#s-lista', el).innerHTML = '<div class="tabla-wrap"><table class="tabla"><thead><tr><th>Persona</th><th>Fechas</th><th class="der">Días</th><th>Estado</th><th>Detalle</th><th></th></tr></thead><tbody>' + rows.map(s => {
          const p = App.persona(s.persona_id);
          return '<tr data-id="' + s.id + '" style="cursor:pointer"><td><div class="persona">' + App.avatar(p) + '<div><b>' + esc(App.nombreCompleto(p)) + '</b><small>' + esc(App.areaNombre(p.area_id)) + '</small></div></div></td>' +
            '<td class="num">' + App.fmtRango(s.inicio, s.fin) + (App.esCumple(s) ? ' <span class="badge info">Cumpleaños</span>' : '') + ((s.medios || []).length && !App.esCumple(s) ? ' <span class="muted small">· con medio día</span>' : '') + '</td><td class="der num">' + App.fmtNum(s.dias) + '</td><td>' + App.badge(s.estado) + (s.excepcion === 'SI' ? ' <span class="badge info" title="Aprobada como excepción">Excepción</span>' : '') + '</td>' +
            '<td class="muted small">' + esc(s.motivo || s.obs || '') + '</td><td class="acc">' +
            (App.puedeDecidir(s) ? '<button class="btn btn-sm btn-primary" data-a="aprobar">Aprobar</button> <button class="btn btn-sm" data-a="rechazar">Rechazar</button> ' : '') +
            (App.puedeAnular(s) ? '<button class="btn btn-sm btn-ghost" data-a="anular" title="Anular" aria-label="Anular">' + App.ic('papelera') + '</button>' : '') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
        App.pintarFotos();
      };
      el.onclick = ev => {
        const t = ev.target.closest('[data-tab]');
        if (t) { tab = t.dataset.tab; $$('[data-tab]', el).forEach(b => b.setAttribute('aria-selected', b === t)); lista(); return; }
        if (ev.target.closest('#s-nueva')) { App.nuevaSolicitud(); return; }
        if (ev.target.closest('#s-csv')) {
          const filas = [['Persona', 'Área', 'Categoría', 'Tipo', 'Inicio', 'Fin', 'Días', 'Estado', 'Observación']].concat($('#s-lista', el)._filas.map(s => { const p = App.persona(s.persona_id); return [App.nombreCompleto(p), App.areaNombre(p.area_id), App.catNombre(p.categoria_id), App.tipoTxt(s), s.inicio, s.fin, s.dias, (App.ESTADO[s.estado] || {}).txt, s.obs]; }));
          App.exportarCSV('solicitudes.csv', filas); return;
        }
        const tr = ev.target.closest('tr[data-id]');
        if (!tr) return;
        const a = ev.target.closest('[data-a]');
        if (a) { const id = tr.dataset.id; if (a.dataset.a === 'anular') App.anular(id); else App.decidir(id, a.dataset.a === 'aprobar' ? 'APROBAR' : 'RECHAZAR'); return; }
        App.detalleSolicitud(tr.dataset.id);
      };
      $('#s-estado', el).onchange = e => { f.estado = e.target.value; lista(); };
      const tx = $('#s-texto', el); if (tx) tx.oninput = e => { f.texto = e.target.value.trim(); lista(); };
      lista();
    }
  });
})();
