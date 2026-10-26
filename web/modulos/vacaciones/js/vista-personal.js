/* Registro de personal: tarjetas, ficha con fotografía y datos de ingreso */
(function () {
  'use strict';
  const { esc, $, $$ } = App;
  const S = App.S;

  /* ---------- fotografía: se reduce en el navegador para que quepa en una celda de Sheets ---------- */
  function reducirFoto(archivo) {
    return new Promise((ok, mal) => {
      if (!/^image\//.test(archivo.type)) return mal(new Error('El archivo no es una imagen.'));
      const rd = new FileReader();
      rd.onerror = () => mal(new Error('No se pudo leer la imagen.'));
      rd.onload = () => {
        const img = new Image();
        img.onerror = () => mal(new Error('No se pudo abrir la imagen.'));
        img.onload = () => {
          const lado = Math.min(img.width, img.height), sx = (img.width - lado) / 2, sy = (img.height - lado) / 2;
          for (const tam of [180, 150, 120, 96]) {
            const c = document.createElement('canvas'); c.width = c.height = tam;
            const g = c.getContext('2d'); g.drawImage(img, sx, sy, lado, lado, 0, 0, tam, tam);
            for (const q of [0.78, 0.65, 0.5]) { const u = c.toDataURL('image/jpeg', q); if (u.length <= 44000) return ok(u); }
          }
          mal(new Error('No se pudo reducir la imagen lo suficiente.'));
        };
        img.src = rd.result;
      };
      rd.readAsDataURL(archivo);
    });
  }

  /* ---------- ficha ---------- */
  function filaInfo(k, v) { return v ? '<tr><td class="muted" style="width:170px">' + k + '</td><td>' + v + '</td></tr>' : ''; }

  function tablaSaldo(p) {
    const s = S.d.saldos[p.id];
    if (!s) return '';
    return '<div class="aviso info" style="margin:12px 0">' + App.ic('info') + '<span>Antigüedad reconocida: <b>' + App.antig(s.total_meses) + '</b>. Le corresponden <b>' + App.fmtNum(s.derecho) + '</b> días generados, tiene <b>' + App.fmtNum(s.disponible) + '</b> disponibles' + (s.vencidos ? ' y <b>' + s.vencidos + '</b> vencidos' : '') + '.</span></div>';
  }

  function verFicha(p) {
    const s = S.d.saldos[p.id];
    const html = '<div class="persona" style="margin-bottom:12px">' + App.avatar(p, true) + '<div><b style="font-size:1.15rem">' + esc(App.nombreCompleto(p)) + '</b><small>' + esc(p.cargo || '') + '</small>' + (p.activo === 'NO' ? '<span class="badge anulada">Inactivo</span>' : '') + '</div></div>' +
      '<div class="tabla-wrap"><table class="tabla"><tbody>' + filaInfo('Código', esc(p.codigo)) + filaInfo('Área', esc(App.areaNombre(p.area_id))) + filaInfo('Categoría', esc(App.catNombre(p.categoria_id))) +
      (p.restringido ? '' : filaInfo('Fecha de ingreso', App.fmtFecha(p.fecha_ingreso)) + filaInfo('Fecha de nacimiento', App.fmtFecha(p.fecha_nacimiento)) + filaInfo('Correo', esc(p.email)) + filaInfo('Teléfono', esc(p.telefono))) + '</tbody></table></div>' + (p.restringido ? '' : tablaSaldo(p));
    App.dialogo({ titulo: 'Ficha de personal', html, botones: [{ txt: 'Cerrar', valor: null }].concat(!p.restringido && p.activo !== 'NO' && App.puedeSolicitar() ? [{ txt: 'Solicitar vacaciones', clase: 'btn-primary', onClick: c => { c(); App.nuevaSolicitud(p.id); } }] : []), alAbrir: () => App.pintarFotos() });
  }

  function editar(p) {
    const nuevo = !p;
    p = p || { nombres: '', apellidos: '', ci: '', fecha_nacimiento: '', fecha_ingreso: '', cargo: '', area_id: S.f.area || (S.d.areas[0] || {}).id, categoria_id: S.f.cat || (S.d.categorias[0] || {}).id, email: '', telefono: '', previos_anios: 0, previos_meses: 0, previos_dias: 0, contar_previos: 'NO', usados_previos: 0, activo: 'SI' };
    const modo = S.d.config.modo_previos;
    let foto;               // undefined = sin cambios, '' = quitar, 'data:' = nueva
    const v = k => esc(p[k] === undefined || p[k] === null ? '' : p[k]);
    const previos = modo === 'NUNCA' ? '' :
      '<fieldset style="grid-column:1/-1;border:1px solid var(--line);border-radius:8px;padding:12px 14px;margin:0"><legend class="small muted" style="padding:0 6px">Servicio previo en otras instituciones</legend><div class="formulario" style="grid-template-columns:repeat(3,1fr)">' +
      '<label class="campo">Años<input type="number" min="0" step="1" id="pe-pa" value="' + v('previos_anios') + '"></label><label class="campo">Meses<input type="number" min="0" max="11" step="1" id="pe-pm" value="' + v('previos_meses') + '"></label><label class="campo">Días<input type="number" min="0" max="29" step="1" id="pe-pd" value="' + v('previos_dias') + '"></label>' +
      (modo === 'POR_PERSONA' ? '<label class="chk ancho"><input type="checkbox" id="pe-cp"' + (p.contar_previos === 'SI' ? ' checked' : '') + '>Contar este servicio previo para calcular sus vacaciones</label>' : '<p class="small muted ancho" style="margin:0">La institución suma siempre el servicio previo registrado (ver Configuración).</p>') + '</div></fieldset>';
    const html = '<div class="foto-edit" style="margin-bottom:14px">' + App.avatar(Object.assign({}, p, { id: p.id || 'nuevo' }), true) + '<div style="display:grid;gap:6px"><div class="acciones"><label class="btn btn-sm" style="cursor:pointer">' + App.ic('camara') + 'Elegir fotografía<input type="file" id="pe-foto" accept="image/*" hidden></label><button type="button" class="btn btn-sm btn-ghost" id="pe-quitar">Quitar</button></div><span class="small muted">Se ajusta automáticamente a un cuadrado pequeño.</span></div></div>' +
      '<div class="formulario"><label class="campo">Nombres *<input type="text" id="pe-nom" value="' + v('nombres') + '" autocomplete="off"></label><label class="campo">Apellidos *<input type="text" id="pe-ape" value="' + v('apellidos') + '" autocomplete="off"></label>' +
      '<label class="campo">Carnet de identidad<input type="text" id="pe-ci" value="' + v('ci') + '"></label><label class="campo">Fecha de nacimiento<input type="date" id="pe-nac" value="' + v('fecha_nacimiento') + '"></label>' +
      '<label class="campo">Fecha de ingreso a la entidad *<input type="date" id="pe-ing" value="' + v('fecha_ingreso') + '"></label><label class="campo">Cargo<input type="text" id="pe-cargo" value="' + v('cargo') + '"></label>' +
      '<label class="campo">Área *<select id="pe-area">' + App.opciones(S.d.areas, p.area_id) + '</select></label><label class="campo">Categoría *<select id="pe-cat">' + App.opciones(S.d.categorias, p.categoria_id) + '</select></label>' +
      '<label class="campo">Correo electrónico<input type="email" id="pe-mail" value="' + v('email') + '"></label><label class="campo">Teléfono<input type="tel" id="pe-tel" value="' + v('telefono') + '"></label>' + previos +
      '<label class="campo ancho">Días ya tomados antes de usar este sistema<input type="number" min="0" step="1" id="pe-usados" value="' + v('usados_previos') + '"><span class="ayuda">Úselo al cargar personal existente: se descuentan del saldo actual.</span></label>' +
      '<label class="chk ancho"><input type="checkbox" id="pe-act"' + (p.activo !== 'NO' ? ' checked' : '') + '>Personal activo</label></div>' + (nuevo ? '' : tablaSaldo(p));
    return App.dialogo({
      titulo: nuevo ? 'Nueva persona' : 'Editar ficha', html, ancho: true,
      botones: [].concat(nuevo ? [] : [{ txt: 'Eliminar', clase: 'btn-danger', onClick: async cerrar => {
        if (!(await App.confirmar('¿Eliminar a ' + App.nombreCompleto(p) + '? Si tiene solicitudes registradas solo se marcará como inactiva.', { si: 'Eliminar', peligro: true }))) return false;
        const r = await App.conCarga(() => App.api('personal_borrar', { id: p.id }));
        App.toast(r.desactivada ? 'Tenía historial: se marcó como inactiva.' : 'Persona eliminada.'); cerrar(true); App.recargar();
      } }], [{ txt: 'Cancelar', valor: null }, { txt: 'Guardar', clase: 'btn-primary', onClick: async (cerrar, dlg) => {
        const g = id => $('#' + id, dlg);
        const persona = { id: p.id, nombres: g('pe-nom').value, apellidos: g('pe-ape').value, ci: g('pe-ci').value, fecha_nacimiento: g('pe-nac').value, fecha_ingreso: g('pe-ing').value, cargo: g('pe-cargo').value,
          area_id: g('pe-area').value, categoria_id: g('pe-cat').value, email: g('pe-mail').value, telefono: g('pe-tel').value, usados_previos: g('pe-usados').value, activo: g('pe-act').checked ? 'SI' : 'NO',
          previos_anios: g('pe-pa') ? g('pe-pa').value : p.previos_anios, previos_meses: g('pe-pm') ? g('pe-pm').value : p.previos_meses, previos_dias: g('pe-pd') ? g('pe-pd').value : p.previos_dias,
          contar_previos: g('pe-cp') ? (g('pe-cp').checked ? 'SI' : 'NO') : p.contar_previos };
        const r = await App.conCarga(() => App.api('personal_guardar', { persona }));
        if (foto !== undefined) await App.conCarga(() => App.api('foto_guardar', { persona_id: r.id, data: foto }));
        App.toast(nuevo ? 'Persona registrada con el código ' + r.codigo + '.' : 'Cambios guardados.'); cerrar(true); App.recargar();
      } }]),
      alAbrir: dlg => {
        const av = () => $('.avatar', dlg);
        const poner = u => { const a = av(); a.innerHTML = u ? '<img alt="" src="' + u + '">' : esc(App.iniciales({ nombres: $('#pe-nom', dlg).value || '?', apellidos: $('#pe-ape', dlg).value || '?' })); a.style.background = u ? 'var(--surface-2)' : ''; };
        $('#pe-foto', dlg).addEventListener('change', async e => {
          const f = e.target.files[0]; if (!f) return;
          try { foto = await reducirFoto(f); poner(foto); } catch (err) { App.errorEn(dlg, err); }
          e.target.value = '';
        });
        $('#pe-quitar', dlg).addEventListener('click', () => { foto = ''; poner(''); });
      }
    });
  }
  App.fichaPersona = editar;

  /* ---------- vista ---------- */
  App.registrar('personal', {
    titulo: 'Personal',
    render(el) {
      const admin = App.puede('personal_editar');
      const f = { texto: '', estado: 'activos' };
      el.innerHTML = App.cabecera('Personal', 'Registro del personal con fecha de ingreso, fotografía y datos de contacto.',
        (admin ? '<button class="btn btn-primary" id="pe-nuevo">' + App.ic('mas') + 'Nueva persona</button><button class="btn" id="pe-csv">Exportar a Excel (CSV)</button>' : '')) +
        '<div class="filtros"><label class="campo" style="min-width:220px">Buscar<input type="search" id="pe-q" placeholder="Nombre, cargo o código"></label>' + App.filtrosComunes() +
        '<label class="campo">Estado<select id="pe-est"><option value="activos">Activos</option><option value="inactivos">Inactivos</option><option value="todos">Todos</option></select></label></div><div id="pe-lista"></div>';
      const dibujar = () => {
        let rows = S.d.personal.slice();
        if (S.f.area) rows = rows.filter(p => p.area_id === S.f.area);
        if (S.f.cat) rows = rows.filter(p => p.categoria_id === S.f.cat);
        if (f.estado === 'activos') rows = rows.filter(p => p.activo !== 'NO'); else if (f.estado === 'inactivos') rows = rows.filter(p => p.activo === 'NO');
        if (f.texto) { const t = f.texto.toLowerCase(); rows = rows.filter(p => (App.nombreCompleto(p) + ' ' + (p.cargo || '') + ' ' + p.codigo).toLowerCase().includes(t)); }
        rows.sort((a, b) => a.apellidos.localeCompare(b.apellidos, 'es'));
        el._filas = rows;
        if (!rows.length) { $('#pe-lista', el).innerHTML = '<div class="panel vacio"><b>' + (S.d.personal.length ? 'Nadie coincide con los filtros' : 'Todavía no hay personal registrado') + '</b>' + (admin && !S.d.personal.length ? 'Use «Nueva persona» para registrar al primero.' : 'Cambie los filtros para ver más resultados.') + '</div>'; return; }
        $('#pe-lista', el).innerHTML = '<div class="rejilla rej-auto">' + rows.map(p => {
          const s = S.d.saldos[p.id], meses = s ? s.antiguedad_meses : null;
          return '<button class="tarjeta-persona' + (p.activo === 'NO' ? ' inactiva' : '') + '" data-id="' + p.id + '">' + App.avatar(p, true) + '<div style="min-width:0"><h3>' + esc(App.nombreCompleto(p)) + '</h3><div class="muted small">' + esc(p.cargo || '') + '</div>' +
            '<div class="meta"><span><i class="punto" style="background:' + App.colorGrupo('area', p.area_id) + ';margin-right:6px"></i>' + esc(App.areaNombre(p.area_id)) + ' · ' + esc(App.catNombre(p.categoria_id)) + '</span>' +
            (p.restringido ? '' : '<span>Ingreso: ' + App.fmtFecha(p.fecha_ingreso) + (meses !== null ? ' (' + App.antig(meses) + ')' : '') + '</span>') +
            (s ? '<span><span class="chip">' + App.fmtNum(s.disponible) + ' días disponibles</span></span>' : '') + '</div></div></button>';
        }).join('') + '</div>';
        App.pintarFotos();
      };
      App.enlazarFiltros(el, dibujar);
      $('#pe-q', el).oninput = e => { f.texto = e.target.value.trim(); dibujar(); };
      $('#pe-est', el).onchange = e => { f.estado = e.target.value; dibujar(); };
      el.onclick = ev => {
        if (ev.target.closest('#pe-nuevo')) { editar(null); return; }
        if (ev.target.closest('#pe-csv')) {
          App.exportarCSV('personal.csv', [['Código', 'Apellidos', 'Nombres', 'CI', 'Nacimiento', 'Ingreso', 'Cargo', 'Área', 'Categoría', 'Correo', 'Teléfono', 'Antigüedad (meses)', 'Días disponibles', 'Activo']].concat(el._filas.map(p => { const s = S.d.saldos[p.id] || {}; return [p.codigo, p.apellidos, p.nombres, p.ci, p.fecha_nacimiento, p.fecha_ingreso, p.cargo, App.areaNombre(p.area_id), App.catNombre(p.categoria_id), p.email, p.telefono, s.antiguedad_meses, s.disponible, p.activo]; })));
          return;
        }
        const t = ev.target.closest('.tarjeta-persona');
        if (!t) return;
        const p = App.persona(t.dataset.id);
        if (admin) editar(p); else verFicha(p);
      };
      dibujar();
    }
  });
})();
