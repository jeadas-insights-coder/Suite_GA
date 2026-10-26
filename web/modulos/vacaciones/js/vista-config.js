/* Reglas vigentes (todos) y Configuración (administrador) */
(function () {
  'use strict';
  const { esc, $, $$ } = App;
  const S = App.S;
  const REGIMEN = { LGT: 'Ley General del Trabajo', SECTOR_PUBLICO: 'Sector público (años de servicio)' };
  const ROL = { ADMIN: 'Administrador', JEFE: 'Jefe de área', PERSONAL: 'Personal', PROPIETARIO: 'Propietario' };

  function grupoTxt(r) {
    const p = [];
    if (r.area_id) p.push('el área ' + App.areaNombre(r.area_id));
    if (r.categoria_id) p.push('la categoría ' + App.catNombre(r.categoria_id));
    return p.length ? p.join(' y ') : 'todo el personal';
  }
  function parametros(r) { try { return JSON.parse(r.parametros || '{}'); } catch (e) { return {}; } }
  App.describirRegla = function (r) {
    const p = parametros(r), g = grupoTxt(r), meses = String(p.meses || '').split(/[ ,;]+/).map(Number).filter(Boolean).map(m => App.MESES[m - 1]).join(', ');
    switch (r.tipo) {
      case 'MESES_VEDADOS': return 'No se pueden pedir vacaciones en ' + meses + ' (' + g + ').';
      case 'FECHAS_VEDADAS': return 'Periodo vedado del ' + App.fmtFecha(p.desde) + ' al ' + App.fmtFecha(p.hasta) + ' (' + g + ').';
      case 'CUPO_DIA': return 'Como máximo ' + p.max + (+p.max === 1 ? ' persona' : ' personas') + ' de ' + g + ' pueden estar de vacación el mismo día.';
      case 'CUPO_PORCENTAJE': return 'No puede estar ausente más del ' + p.max_pct + '% de ' + g + ' el mismo día.';
      case 'FERIADO_ADYACENTE': return 'Vacaciones pegadas a un feriado: máximo ' + p.max_veces + ' veces por año (' + g + ').';
      case 'MIN_ANTICIPACION': return 'Se debe solicitar con al menos ' + p.dias + ' días de anticipación (' + g + ').';
      case 'MAX_DIAS_SOLICITUD': return 'Cada solicitud puede tener como máximo ' + p.max + ' días (' + g + ').';
      case 'MIN_DIAS_SOLICITUD': return 'Cada solicitud debe tener al menos ' + p.min + ' días (' + g + ').';
      case 'MAX_SOLICITUDES_ANIO': return 'Máximo ' + p.max + ' solicitudes por persona al año (' + g + ').';
      default: return r.nombre + ' (regla personalizada, ' + g + ').';
    }
  };
  const tipoNombre = t => { const x = S.d.tipos_regla.find(y => y.tipo === t); return x ? x.nombre : t; };

  function tablaEscala(reg) {
    const filas = S.d.escalas.filter(e => e.regimen === reg).sort((a, b) => a.desde_anios - b.desde_anios);
    return filas.map(e => '<tr><td>' + (e.hasta_anios === '' ? 'Más de ' + e.desde_anios + ' años' : 'De ' + e.desde_anios + ' a menos de ' + e.hasta_anios + ' años') + '</td><td class="der num"><b>' + e.dias + '</b> días</td></tr>').join('');
  }

  /* ---------- Reglas vigentes (todos los roles) ---------- */
  App.registrar('reglas', {
    titulo: 'Reglas vigentes',
    render(el) {
      const c = S.d.config, activas = S.d.reglas.filter(r => r.activa === 'SI');
      const modoTxt = { NUNCA: 'Solo cuenta la antigüedad en esta entidad.', SIEMPRE: 'Se suma el servicio previo registrado.', POR_PERSONA: 'Se suma el servicio previo cuando quien registra lo indica en la ficha.' }[c.modo_previos];
      el.innerHTML = App.cabecera('Reglas vigentes', 'Cómo se calculan las vacaciones y qué se tiene en cuenta al pedirlas.', App.puedeAlguno(['config_editar', 'catalogo_editar', 'reglas_editar']) ? '<a class="btn" href="#/config">' + App.ic('config') + 'Cambiar en Configuración</a>' : '') +
        '<div class="rejilla rej-2" style="align-items:start"><section class="panel"><h2>Días de vacación por antigüedad</h2><p class="muted">Régimen: <b>' + REGIMEN[c.regimen] + '</b>. ' + modoTxt + '</p>' +
        '<div class="tabla-wrap"><table class="tabla"><tbody>' + tablaEscala(c.regimen) + '</tbody></table></div>' +
        '<p class="small muted" style="margin:12px 0 0">Los días se cuentan como ' + (c.tipo_dias === 'CORRIDOS' ? 'días corridos' : 'días hábiles' + (c.contar_sabado === 'SI' ? ' (de lunes a sábado)' : ' (de lunes a viernes)') + (c.excluir_feriados === 'SI' ? ', sin contar feriados' : '')) + '. ' +
        (+c.max_gestiones_acumulables ? 'Se pueden acumular hasta ' + c.max_gestiones_acumulables + ' gestiones; los días más antiguos se pierden.' : 'No hay límite de gestiones acumulables.') + '</p></section>' +
        '<section class="panel"><h2>Reglas al solicitar</h2>' + (activas.length ? '<ul class="lista-simple">' + activas.map(r => '<li><div><b>' + esc(r.nombre) + '</b><div class="muted small">' + esc(App.describirRegla(r)) + '</div></div>' + (r.severidad === 'ADVIERTE' ? '<span class="badge pendiente">Solo avisa</span>' : '') + '</li>').join('') + '</ul>' :
          '<div class="vacio"><b>Sin reglas activas</b>Cualquier fecha con saldo disponible es válida.</div>') +
        '<p class="small muted" style="margin:12px 0 0">Flujo de aprobación: ' + ({ 'JEFE+ADMIN': 'jefe de área y luego administración', JEFE: 'jefe de área', ADMIN: 'administración' }[c.flujo_aprobacion]) + '.</p></section></div>';
    }
  });

  /* ---------- Configuración ---------- */
  let pestana = 'general', anioFer = null;

  function campoConfig(def, valor) {
    const id = 'cfg-' + def.k;
    if (def.tipo === 'select') return '<label class="campo">' + esc(def.etiqueta) + '<select id="' + id + '">' + def.opciones.map(o => '<option value="' + o[0] + '"' + (o[0] === valor ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select>' + (def.ayuda ? '<span class="ayuda">' + esc(def.ayuda) + '</span>' : '') + '</label>';
    return '<label class="campo">' + esc(def.etiqueta) + '<input type="' + (def.tipo === 'number' ? 'number' : 'text') + '" id="' + id + '" value="' + esc(valor) + '"' + (def.tipo === 'number' ? ' min="0" step="1"' : '') + '>' + (def.ayuda ? '<span class="ayuda">' + esc(def.ayuda) + '</span>' : '') + '</label>';
  }

  const guardarCat = (hoja, fila) => App.conCarga(() => App.api('catalogo_guardar', { hoja, fila }));
  const borrarCat = (hoja, id) => App.conCarga(() => App.api('catalogo_borrar', { hoja, id }));

  function pestGeneral(c) {
    c.innerHTML = '<section class="panel"><h2>Parámetros generales</h2><p class="muted">Estas decisiones se aplican a toda la institución y cambian el cálculo de vacaciones desde el momento de guardar.</p><div class="formulario">' +
      S.d.config_def.map(def => campoConfig(def, S.d.config[def.k])).join('') + '</div><div style="margin-top:16px"><button class="btn btn-primary" id="cfg-guardar">Guardar parámetros</button></div></section>';
    $('#cfg-guardar', c).onclick = async () => {
      const valores = {}; S.d.config_def.forEach(def => { valores[def.k] = $('#cfg-' + def.k, c).value; });
      try { await App.conCarga(() => App.api('config_guardar', { valores })); App.toast('Parámetros guardados.'); App.recargar(); } catch (e) { App.toast(e.message, 'error'); }
    };
  }

  function dlgEscala(e, reg) {
    e = e || { regimen: reg, desde_anios: '', hasta_anios: '', dias: '' };
    return App.dialogo({
      titulo: e.id ? 'Editar tramo' : 'Nuevo tramo · ' + REGIMEN[reg],
      html: '<div class="formulario"><label class="campo">Desde (años cumplidos)<input type="number" id="es-d" min="0" step="1" value="' + esc(e.desde_anios) + '"></label><label class="campo">Hasta (menos de…)<input type="number" id="es-h" min="1" step="1" value="' + esc(e.hasta_anios) + '"><span class="ayuda">Déjelo vacío si no tiene límite.</span></label><label class="campo ancho">Días de vacación por gestión<input type="number" id="es-n" min="0" step="1" value="' + esc(e.dias) + '"></label></div>',
      botones: [{ txt: 'Cancelar', valor: null }, { txt: 'Guardar', clase: 'btn-primary', onClick: async (cerrar, dlg) => { await guardarCat('Escalas', { id: e.id, regimen: e.regimen, desde_anios: $('#es-d', dlg).value, hasta_anios: $('#es-h', dlg).value, dias: $('#es-n', dlg).value }); App.toast('Tramo guardado.'); cerrar(true); App.recargar(); } }]
    });
  }

  function pestEscalas(c) {
    c.innerHTML = '<div class="aviso info" style="margin-bottom:16px">' + App.ic('info') + '<span>Los valores iniciales son referenciales. Verifique con su normativa vigente y ajuste los tramos si corresponde. Solo se aplica la escala del régimen elegido en «General».</span></div><div class="rejilla rej-2" style="align-items:start">' +
      Object.keys(REGIMEN).map(reg => '<section class="panel"><h3>' + REGIMEN[reg] + (S.d.config.regimen === reg ? ' <span class="chip">En uso</span>' : '') + '</h3><div class="tabla-wrap"><table class="tabla"><thead><tr><th>Antigüedad</th><th class="der">Días</th><th></th></tr></thead><tbody>' +
        S.d.escalas.filter(e => e.regimen === reg).sort((a, b) => a.desde_anios - b.desde_anios).map(e => '<tr><td>' + (e.hasta_anios === '' ? 'Más de ' + e.desde_anios + ' años' : 'De ' + e.desde_anios + ' a menos de ' + e.hasta_anios + ' años') + '</td><td class="der num"><b>' + e.dias + '</b></td><td class="acc"><button class="btn btn-sm btn-ghost" data-ed="' + e.id + '" aria-label="Editar">' + App.ic('editar') + '</button><button class="btn btn-sm btn-ghost" data-del="' + e.id + '" aria-label="Eliminar">' + App.ic('papelera') + '</button></td></tr>').join('') +
        '</tbody></table></div><div style="margin-top:12px"><button class="btn btn-sm" data-nuevo="' + reg + '">' + App.ic('mas') + 'Agregar tramo</button></div></section>').join('') + '</div>';
    c.onclick = async ev => {
      const n = ev.target.closest('[data-nuevo]'), ed = ev.target.closest('[data-ed]'), del = ev.target.closest('[data-del]');
      if (n) dlgEscala(null, n.dataset.nuevo);
      else if (ed) { const e = S.d.escalas.find(x => x.id === ed.dataset.ed); dlgEscala(e, e.regimen); }
      else if (del && await App.confirmar('¿Eliminar este tramo?', { si: 'Eliminar', peligro: true })) { try { await borrarCat('Escalas', del.dataset.del); App.recargar(); } catch (e) { App.toast(e.message, 'error'); } }
    };
  }

  /* ----- reglas ----- */
  function dlgRegla(r) {
    const nueva = !r;
    r = r || { nombre: '', tipo: S.d.tipos_regla[0].tipo, activa: 'SI', area_id: '', categoria_id: '', parametros: '{}', severidad: 'BLOQUEA', mensaje: '' };
    const params = parametros(r);
    const camposTipo = tipo => {
      const t = S.d.tipos_regla.find(x => x.tipo === tipo);
      return '<p class="muted small ancho" style="margin:0">' + esc(t.descripcion) + '</p>' + t.params.map(pd => {
        const val = params[pd.k] !== undefined && tipo === r.tipo ? params[pd.k] : (pd.def !== undefined ? pd.def : '');
        const ayuda = pd.ayuda ? '<span class="ayuda">' + esc(pd.ayuda) + '</span>' : '';
        if (pd.tipo === 'expr') return '<label class="campo ancho">' + esc(pd.etiqueta) + '<textarea id="rg-p-' + pd.k + '" spellcheck="false" style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.88rem">' + esc(val) + '</textarea>' + ayuda + '</label>';
        return '<label class="campo' + (pd.tipo === 'text' ? ' ancho' : '') + '">' + esc(pd.etiqueta) + '<input type="' + (pd.tipo === 'number' ? 'number' : pd.tipo === 'date' ? 'date' : 'text') + '" id="rg-p-' + pd.k + '" value="' + esc(val) + '">' + ayuda + '</label>';
      }).join('');
    };
    const html = '<div class="formulario"><label class="campo ancho">Tipo de regla<select id="rg-tipo"' + (nueva ? '' : ' disabled') + '>' + S.d.tipos_regla.map(t => '<option value="' + t.tipo + '"' + (t.tipo === r.tipo ? ' selected' : '') + '>' + esc(t.nombre) + '</option>').join('') + '</select></label>' +
      '<label class="campo ancho">Nombre de la regla<input type="text" id="rg-nombre" value="' + esc(r.nombre) + '" placeholder="Por ejemplo: Máximo 2 supervisores por día"></label>' +
      '<label class="campo">Se aplica al área<select id="rg-area">' + App.opciones(S.d.areas, r.area_id, 'Todas las áreas') + '</select></label><label class="campo">Se aplica a la categoría<select id="rg-cat">' + App.opciones(S.d.categorias, r.categoria_id, 'Todas las categorías') + '</select></label>' +
      '<div id="rg-params" class="formulario ancho" style="padding:0">' + camposTipo(r.tipo) + '</div>' +
      '<label class="campo">Si no se cumple<select id="rg-sev"><option value="BLOQUEA"' + (r.severidad !== 'ADVIERTE' ? ' selected' : '') + '>Bloquea la solicitud</option><option value="ADVIERTE"' + (r.severidad === 'ADVIERTE' ? ' selected' : '') + '>Solo muestra un aviso</option></select></label>' +
      '<label class="chk" style="align-self:end;padding-bottom:8px"><input type="checkbox" id="rg-act"' + (r.activa !== 'NO' ? ' checked' : '') + '>Regla activa</label>' +
      '<label class="campo ancho">Mensaje propio (opcional)<input type="text" id="rg-msg" value="' + esc(r.mensaje) + '" placeholder="Si lo deja vacío se usa un mensaje automático"></label></div>';
    return App.dialogo({
      titulo: nueva ? 'Nueva regla' : 'Editar regla', html, ancho: true,
      botones: [{ txt: 'Cancelar', valor: null }, { txt: 'Guardar regla', clase: 'btn-primary', onClick: async (cerrar, dlg) => {
        const tipo = $('#rg-tipo', dlg).value, def = S.d.tipos_regla.find(x => x.tipo === tipo), ps = {};
        def.params.forEach(pd => { ps[pd.k] = $('#rg-p-' + pd.k, dlg).value; });
        await guardarCat('Reglas', { id: r.id, nombre: $('#rg-nombre', dlg).value, tipo, activa: $('#rg-act', dlg).checked ? 'SI' : 'NO', area_id: $('#rg-area', dlg).value, categoria_id: $('#rg-cat', dlg).value, parametros: ps, severidad: $('#rg-sev', dlg).value, mensaje: $('#rg-msg', dlg).value });
        App.toast('Regla guardada.'); cerrar(true); App.recargar();
      } }],
      alAbrir: dlg => { $('#rg-tipo', dlg).addEventListener('change', e => { $('#rg-params', dlg).innerHTML = camposTipo(e.target.value); }); }
    });
  }

  function pestReglas(c) {
    c.innerHTML = '<div class="acciones" style="margin-bottom:14px"><button class="btn btn-primary" id="rg-nueva">' + App.ic('mas') + 'Nueva regla</button></div>' +
      (S.d.reglas.length ? '<div class="rejilla">' + S.d.reglas.map(r => '<section class="panel" style="display:grid;grid-template-columns:auto 1fr auto;gap:14px;align-items:center;' + (r.activa === 'NO' ? 'opacity:.62' : '') + '"><label class="chk" title="Activar o desactivar"><input type="checkbox" data-act="' + r.id + '"' + (r.activa === 'SI' ? ' checked' : '') + ' aria-label="Regla activa"></label>' +
        '<div><b>' + esc(r.nombre) + '</b> <span class="badge">' + esc(tipoNombre(r.tipo)) + '</span>' + (r.severidad === 'ADVIERTE' ? ' <span class="badge pendiente">Solo avisa</span>' : '') + '<div class="muted small">' + esc(App.describirRegla(r)) + '</div></div>' +
        '<div class="acciones"><button class="btn btn-sm btn-ghost" data-ed="' + r.id + '" aria-label="Editar">' + App.ic('editar') + '</button><button class="btn btn-sm btn-ghost" data-del="' + r.id + '" aria-label="Eliminar">' + App.ic('papelera') + '</button></div></section>').join('') + '</div>' :
        '<div class="panel vacio"><b>Aún no hay reglas</b>Cree la primera con «Nueva regla».</div>');
    c.onclick = async ev => {
      if (ev.target.closest('#rg-nueva')) return dlgRegla(null);
      const ed = ev.target.closest('[data-ed]'), del = ev.target.closest('[data-del]'), act = ev.target.closest('[data-act]');
      if (ed) dlgRegla(S.d.reglas.find(x => x.id === ed.dataset.ed));
      else if (del) { if (await App.confirmar('¿Eliminar esta regla?', { si: 'Eliminar', peligro: true })) { try { await borrarCat('Reglas', del.dataset.del); App.recargar(); } catch (e) { App.toast(e.message, 'error'); } } }
      else if (act && ev.target.tagName === 'INPUT') {
        const r = S.d.reglas.find(x => x.id === act.dataset.act);
        try { await guardarCat('Reglas', Object.assign({}, r, { activa: ev.target.checked ? 'SI' : 'NO', parametros: parametros(r) })); App.toast(ev.target.checked ? 'Regla activada.' : 'Regla desactivada.'); App.recargar(); } catch (e) { ev.target.checked = !ev.target.checked; App.toast(e.message, 'error'); }
      }
    };
  }

  /* ----- feriados ----- */
  function dlgFeriado(f) {
    f = f || { fecha: '', nombre: '' };
    return App.dialogo({ titulo: f.id ? 'Editar feriado' : 'Nuevo feriado', html: '<div class="formulario"><label class="campo">Fecha<input type="date" id="fe-f" value="' + esc(f.fecha) + '"></label><label class="campo">Nombre<input type="text" id="fe-n" value="' + esc(f.nombre) + '"></label></div>',
      botones: [{ txt: 'Cancelar', valor: null }, { txt: 'Guardar', clase: 'btn-primary', onClick: async (cerrar, dlg) => { await guardarCat('Feriados', { id: f.id, fecha: $('#fe-f', dlg).value, nombre: $('#fe-n', dlg).value }); App.toast('Feriado guardado.'); cerrar(true); App.recargar(); } }] });
  }
  function pestFeriados(c) {
    const anios = Array.from(new Set(S.d.feriados.map(f => f.fecha.slice(0, 4)).concat([App.hoy().slice(0, 4)]))).sort();
    if (!anioFer || anios.indexOf(anioFer) < 0) anioFer = App.hoy().slice(0, 4);
    const lista = S.d.feriados.filter(f => f.fecha.slice(0, 4) === anioFer).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
    c.innerHTML = '<div class="acciones" style="margin-bottom:14px"><label class="campo" style="min-width:110px"><span class="sr">Año</span><select id="fe-anio">' + anios.map(a => '<option' + (a === anioFer ? ' selected' : '') + '>' + a + '</option>').join('') + '</select></label>' +
      '<button class="btn btn-primary" id="fe-nuevo">' + App.ic('mas') + 'Agregar feriado</button><button class="btn" id="fe-copiar">Copiar al año ' + (+anioFer + 1) + '</button></div>' +
      (lista.length ? '<div class="tabla-wrap"><table class="tabla"><thead><tr><th>Fecha</th><th>Día</th><th>Feriado</th><th></th></tr></thead><tbody>' + lista.map(f => '<tr><td class="num">' + App.fmtFecha(f.fecha) + '</td><td>' + App.DIAS[App.dow(f.fecha)] + '</td><td>' + esc(f.nombre) + '</td><td class="acc"><button class="btn btn-sm btn-ghost" data-ed="' + f.id + '" aria-label="Editar">' + App.ic('editar') + '</button><button class="btn btn-sm btn-ghost" data-del="' + f.id + '" aria-label="Eliminar">' + App.ic('papelera') + '</button></td></tr>').join('') + '</tbody></table></div>' : '<div class="panel vacio"><b>Sin feriados en ' + anioFer + '</b>Agréguelos uno por uno o cópielos desde otro año.</div>');
    $('#fe-anio', c).onchange = e => { anioFer = e.target.value; pestFeriados(c); };
    c.onclick = async ev => {
      if (ev.target.closest('#fe-nuevo')) return dlgFeriado(null);
      if (ev.target.closest('#fe-copiar')) {
        const sig = String(+anioFer + 1), existentes = new Set(S.d.feriados.map(f => f.fecha));
        const nuevos = lista.map(f => ({ fecha: sig + f.fecha.slice(4), nombre: f.nombre })).filter(f => !existentes.has(f.fecha) && !(f.fecha.slice(5) === '02-29'));
        if (!nuevos.length) return App.toast('El año ' + sig + ' ya tiene todos esos feriados.');
        if (!(await App.confirmar('Se copiarán ' + nuevos.length + ' feriados a ' + sig + ' con la misma fecha. Después revise los que cambian cada año (Carnaval, Viernes Santo, Corpus Christi).', { si: 'Copiar' }))) return;
        try { await App.cargando(true); for (const f of nuevos) await App.api('catalogo_guardar', { hoja: 'Feriados', fila: f }); } catch (e) { App.toast(e.message, 'error'); } finally { App.cargando(false); }
        anioFer = sig; App.toast('Feriados copiados.'); App.recargar(); return;
      }
      const ed = ev.target.closest('[data-ed]'), del = ev.target.closest('[data-del]');
      if (ed) dlgFeriado(S.d.feriados.find(x => x.id === ed.dataset.ed));
      else if (del && await App.confirmar('¿Eliminar este feriado?', { si: 'Eliminar', peligro: true })) { try { await borrarCat('Feriados', del.dataset.del); App.recargar(); } catch (e) { App.toast(e.message, 'error'); } }
    };
  }

  /* ----- áreas y categorías ----- */
  function dlgNombre(hoja, item, titulo) {
    return App.dialogo({ titulo, html: '<label class="campo">Nombre<input type="text" id="nm-n" value="' + esc(item ? item.nombre : '') + '" maxlength="60"></label>',
      botones: [{ txt: 'Cancelar', valor: null }, { txt: 'Guardar', clase: 'btn-primary', onClick: async (cerrar, dlg) => { await guardarCat(hoja, { id: item && item.id, nombre: $('#nm-n', dlg).value }); App.toast('Guardado.'); cerrar(true); App.recargar(); } }], alAbrir: d => $('#nm-n', d).focus() });
  }
  function pestGrupos(c) {
    const bloque = (hoja, tit, lista, tipo) => '<section class="panel"><h3>' + tit + '</h3><ul class="lista-simple">' + lista.map(x => '<li><span><i class="punto" style="background:' + App.colorGrupo(tipo, x.id) + ';margin-right:8px"></i>' + esc(x.nombre) + '</span><span><button class="btn btn-sm btn-ghost" data-h="' + hoja + '" data-ed="' + x.id + '" aria-label="Renombrar">' + App.ic('editar') + '</button><button class="btn btn-sm btn-ghost" data-h="' + hoja + '" data-del="' + x.id + '" aria-label="Eliminar">' + App.ic('papelera') + '</button></span></li>').join('') + '</ul><div style="margin-top:10px"><button class="btn btn-sm" data-h="' + hoja + '" data-nuevo="1">' + App.ic('mas') + 'Agregar</button></div></section>';
    c.innerHTML = '<p class="muted small">Los primeros 8 elementos de cada lista tienen su propio color en los calendarios; los demás se muestran en gris.</p><div class="rejilla rej-2" style="align-items:start">' + bloque('Areas', 'Áreas', S.d.areas, 'area') + bloque('Categorias', 'Categorías', S.d.categorias, 'categoria') + '</div>';
    c.onclick = async ev => {
      const b = ev.target.closest('[data-h]'); if (!b) return;
      const hoja = b.dataset.h, lista = hoja === 'Areas' ? S.d.areas : S.d.categorias, uno = hoja === 'Areas' ? 'área' : 'categoría';
      if (b.dataset.nuevo) dlgNombre(hoja, null, 'Nueva ' + uno);
      else if (b.dataset.ed) dlgNombre(hoja, lista.find(x => x.id === b.dataset.ed), 'Renombrar ' + uno);
      else if (b.dataset.del && await App.confirmar('¿Eliminar esta ' + uno + '?', { si: 'Eliminar', peligro: true })) { try { await borrarCat(hoja, b.dataset.del); App.recargar(); } catch (e) { App.toast(e.message, 'error'); } }
    };
  }

  /* ----- usuarios (perfiles dentro del módulo; las personas se gestionan en la Suite) ----- */
  function dlgUsuario(u) {
    const acargo = String(u.areas_a_cargo || '').split(/[ ,;]+/).filter(Boolean);
    const personas = S.d.personal.filter(p => p.activo !== 'NO').slice().sort((a, b) => a.apellidos.localeCompare(b.apellidos, 'es'));
    const html = '<div class="formulario"><div class="ancho"><b>' + esc(u.nombre || u.usuario) + '</b> <span class="muted small">' + esc(u.usuario) + '</span></div><label class="campo">Rol<select id="us-r">' + Object.keys(ROL).map(k => '<option value="' + k + '"' + (k === u.rol ? ' selected' : '') + '>' + ROL[k] + '</option>').join('') + '</select></label>' +
      '<label class="campo ancho">Persona del registro<select id="us-p"><option value="">Ninguna (ej. propietario)</option>' + personas.map(p => '<option value="' + p.id + '"' + (p.id === u.persona_id ? ' selected' : '') + '>' + esc(p.apellidos + ', ' + p.nombres) + '</option>').join('') + '</select><span class="ayuda">Quien solicita vacaciones o es jefe debe estar vinculado a su ficha.</span></label>' +
      '<fieldset id="us-areas-w" class="ancho" style="border:1px solid var(--line);border-radius:8px;margin:0;padding:10px 14px"><legend class="small muted" style="padding:0 6px">Áreas a cargo (solo jefes)</legend>' + S.d.areas.map(a => '<label class="chk" style="margin:4px 0"><input type="checkbox" class="us-a" value="' + a.id + '"' + (acargo.indexOf(a.id) >= 0 ? ' checked' : '') + '>' + esc(a.nombre) + '</label>').join('') + '</fieldset></div>';
    return App.dialogo({ titulo: 'Perfil en Vacaciones', html,
      botones: [{ txt: 'Cancelar', valor: null }, { txt: 'Guardar', clase: 'btn-primary', onClick: async (cerrar, dlg) => {
        const rol = $('#us-r', dlg).value;
        await App.conCarga(() => App.api('usuario_guardar', { id: u.id, rol, persona_id: $('#us-p', dlg).value, areas_a_cargo: rol === 'JEFE' ? $$('.us-a:checked', dlg).map(x => x.value).join(',') : '' }));
        App.toast('Perfil guardado.'); cerrar(true); App.recargar();
      } }],
      alAbrir: dlg => { const mostrar = () => { $('#us-areas-w', dlg).hidden = $('#us-r', dlg).value !== 'JEFE'; }; $('#us-r', dlg).addEventListener('change', mostrar); mostrar(); } });
  }
  function pestUsuarios(c) {
    c.innerHTML = '<div class="aviso info" style="margin-bottom:14px">' + App.ic('info') + '<span>Las personas, sus contraseñas y el acceso a este módulo se gestionan en la Suite (Configuración → Usuarios). Aquí se define el rol, la ficha vinculada y las áreas a cargo.</span></div><div class="tabla-wrap"><table class="tabla"><thead><tr><th>Usuario</th><th>Rol</th><th>Persona vinculada</th><th>Áreas a cargo</th><th>Estado</th><th></th></tr></thead><tbody>' +
      S.d.usuarios.map(u => { const p = App.persona(u.persona_id); return '<tr><td><b>' + esc(u.usuario) + '</b></td><td>' + ROL[u.rol] + '</td><td>' + (p ? esc(App.nombreCompleto(p)) : '<span class="muted">—</span>') + '</td><td class="small">' + (u.areas_a_cargo ? esc(u.areas_a_cargo.split(',').map(App.areaNombre).join(', ')) : '<span class="muted">—</span>') + '</td><td>' + (u.activo === 'NO' ? '<span class="badge anulada">Inactivo</span>' : '<span class="badge aprobada">' + App.ic('check') + 'Activo</span>') + '</td>' +
        '<td class="acc"><button class="btn btn-sm btn-ghost" data-ed="' + u.id + '" aria-label="Editar">' + App.ic('editar') + '</button></td></tr>'; }).join('') + '</tbody></table></div>';
    c.onclick = ev => { const ed = ev.target.closest('[data-ed]'); if (ed) dlgUsuario(S.d.usuarios.find(x => x.id === ed.dataset.ed)); };
  }
  const TODAS = [['general', 'General', pestGeneral, 'config_editar'], ['escalas', 'Días por antigüedad', pestEscalas, 'catalogo_editar'], ['reglas', 'Reglas', pestReglas, 'reglas_editar'], ['feriados', 'Feriados', pestFeriados, 'catalogo_editar'], ['grupos', 'Áreas y categorías', pestGrupos, 'catalogo_editar'], ['usuarios', 'Usuarios', pestUsuarios, 'usuarios_editar']];

  App.registrar('config', {
    titulo: 'Configuración',
    render(el) {
      const PESTANAS = TODAS.filter(p => App.puede(p[3]));
      if (!PESTANAS.some(p => p[0] === pestana)) pestana = PESTANAS[0][0];
      el.innerHTML = App.cabecera('Configuración', 'Parámetros, reglas y catálogos de la institución.') + '<div class="tabs" role="tablist">' + PESTANAS.map(p => '<button role="tab" data-p="' + p[0] + '" aria-selected="' + (p[0] === pestana) + '">' + p[1] + '</button>').join('') + '</div><div id="cfg-cont"></div>';
      const pintar = () => { const c = $('#cfg-cont', el); c.onclick = null; PESTANAS.find(p => p[0] === pestana)[2](c); };
      el.onclick = ev => { const b = ev.target.closest('.tabs [data-p]'); if (b) { pestana = b.dataset.p; $$('.tabs [data-p]', el).forEach(x => x.setAttribute('aria-selected', x === b)); pintar(); } };
      pintar();
    }
  });
})();
