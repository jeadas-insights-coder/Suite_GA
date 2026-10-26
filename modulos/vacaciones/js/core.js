/* Núcleo: estado, API, utilidades, navegación, diálogos */
(function () {
  'use strict';
  const App = window.App = { S: { user: null, d: null, fotos: {}, pm: {}, f: {} }, vistas: {} };
  const S = App.S;

  /* ---------- utilidades básicas ---------- */
  const esc = App.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  App.$ = (s, r) => (r || document).querySelector(s);
  App.$$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  App.MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  App.DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
  App.cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } };
  const leerLS = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };

  /* ---------- fechas (texto ISO aaaa-mm-dd) ---------- */
  const pad = n => (n < 10 ? '0' : '') + n;
  const utc = s => { const p = s.split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); };
  const deUtc = t => { const d = new Date(t); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); };
  App.addDias = (s, n) => deUtc(utc(s) + n * 86400000);
  App.difDias = (a, b) => Math.round((utc(b) - utc(a)) / 86400000);
  App.dow = s => (new Date(utc(s)).getUTCDay() + 6) % 7;            // 0 = lunes
  App.iso = (y, m, d) => y + '-' + pad(m) + '-' + pad(d);
  App.diasMes = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
  App.fmtFecha = s => (s ? s.split('-').reverse().join('/') : '');
  App.fmtCorto = s => { const p = s.split('-'); return +p[2] + ' ' + App.MESES[+p[1] - 1].slice(0, 3); };
  App.fmtLargo = s => { const p = s.split('-'); return +p[2] + ' de ' + App.MESES[+p[1] - 1] + ' de ' + p[0]; };
  App.fmtRango = (a, b) => (a === b ? App.fmtFecha(a) : App.fmtFecha(a) + ' al ' + App.fmtFecha(b));
  App.antig = m => { const a = Math.floor(m / 12), r = m % 12; return (a ? a + (a === 1 ? ' año' : ' años') : '') + (a && r ? ' y ' : '') + (r || !a ? r + (r === 1 ? ' mes' : ' meses') : ''); };
  App.hoy = () => (S.d ? S.d.hoy : deUtc(Date.now()));

  /* ---------- iconos ---------- */
  const IC = {
    inicio: '<path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10"/>',
    anual: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4M7 13h2M11 13h2M15 13h2M7 17h2M11 17h2"/>',
    mensual: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/><path d="M8 14h8" stroke-width="3"/>',
    solicitudes: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>',
    personal: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 4.7a3.4 3.4 0 010 6.6M18 14.8c2 .7 3.2 2.4 3.5 5.2"/>',
    analisis: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    reglas: '<path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    permisos: '<path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    config: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 010-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 014 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    alerta: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h0"/>',
    reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    mas: '<path d="M12 5v14M5 12h14"/>',
    editar: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    papelera: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    imprimir: '<path d="M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z"/>',
    salir: '<path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    tema: '<path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z"/>',
    izq: '<path d="M15 5l-7 7 7 7"/>', der: '<path d="M9 5l7 7-7 7"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h0"/>',
    camara: '<path d="M4 8h3l2-3h6l2 3h3v12H4z"/><circle cx="12" cy="13.5" r="3.5"/>',
    tabla: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16"/>'
  };
  App.ic = (n, extra) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' + (extra || '') + '>' + (IC[n] || '') + '</svg>';

  /* ---------- API ---------- */
  App.api = async function (accion, datos) {
    let j;
    try { j = await JDI.api({ accion, datos: datos || {} }); }
    catch (e) { throw Object.assign(new Error(e.message || 'No se pudo conectar con el servidor.'), { codigo: e.code || 'RED' }); }
    if (!j || !j.ok) throw Object.assign(new Error((j && j.error) || 'Error'), { codigo: j && j.codigo, extra: j && j.extra });
    return j.datos;
  };

  /* ---------- avisos, carga, diálogos ---------- */
  App.toast = (msg, tipo) => {
    const el = document.createElement('div');
    el.className = 'toast ' + (tipo || '');
    el.innerHTML = App.ic(tipo === 'error' ? 'alerta' : 'check', ' width="18" height="18" style="flex:none;margin-top:1px"') + '<span>' + esc(msg) + '</span>';
    App.$('#toasts').appendChild(el);
    setTimeout(() => el.remove(), tipo === 'error' ? 7000 : 3800);
  };
  let nCarga = 0;
  App.cargando = on => {
    nCarga += on ? 1 : -1;
    let el = App.$('.cargando');
    if (nCarga > 0 && !el) { el = document.createElement('div'); el.className = 'cargando'; el.innerHTML = '<i></i>'; el.setAttribute('role', 'progressbar'); el.setAttribute('aria-label', 'Cargando'); document.body.appendChild(el); }
    if (nCarga <= 0) { nCarga = 0; if (el) el.remove(); }
  };
  App.conCarga = async fn => { App.cargando(true); try { return await fn(); } finally { App.cargando(false); } };

  /** Diálogo: opciones {titulo, html, botones:[{txt, clase, valor, mantener, onClick(cerrar, dlg)}], ancho, alAbrir(dlg)} */
  App.dialogo = function (o) {
    return new Promise(resolve => {
      const dlg = document.createElement('dialog');
      if (o.ancho) dlg.className = 'ancho';
      dlg.innerHTML = '<div class="dlg"><header><h2>' + esc(o.titulo || '') + '</h2><button type="button" class="btn btn-ghost btn-icon btn-sm" data-cerrar aria-label="Cerrar">' + App.ic('x') + '</button></header><div class="cuerpo">' + (o.html || '') + '</div><footer></footer></div>';
      const pie = App.$('footer', dlg);
      let cerrado = false;
      const cerrar = v => { if (cerrado) return; cerrado = true; dlg.close(); dlg.remove(); resolve(v); };
      (o.botones || []).forEach(b => {
        const bt = document.createElement('button');
        bt.type = 'button'; bt.className = 'btn ' + (b.clase || ''); bt.textContent = b.txt;
        bt.addEventListener('click', async () => {
          if (b.onClick) {
            bt.disabled = true;
            try { const r = await b.onClick(cerrar, dlg, bt); if (r === false) { bt.disabled = false; return; } } catch (e) { bt.disabled = false; App.errorEn(dlg, e); return; }
            bt.disabled = false;
          } else cerrar(b.valor);
        });
        pie.appendChild(bt);
      });
      if (!(o.botones || []).length) pie.remove();
      App.$('[data-cerrar]', dlg).addEventListener('click', () => cerrar(undefined));
      dlg.addEventListener('cancel', e => { e.preventDefault(); cerrar(undefined); });
      document.body.appendChild(dlg);
      dlg.showModal();
      if (o.alAbrir) o.alAbrir(dlg, cerrar);
    });
  };
  /** Muestra un error dentro de un diálogo (o toast si no hay). */
  App.errorEn = (dlg, e) => {
    let caja = dlg && App.$('.errores-dlg', dlg);
    if (dlg && !caja) { caja = document.createElement('div'); caja.className = 'avisos errores-dlg'; caja.setAttribute('role', 'alert'); caja.style.marginTop = '12px'; App.$('.cuerpo', dlg).appendChild(caja); }
    if (!caja) return App.toast(e.message, 'error');
    const lista = Array.isArray(e.extra) && e.extra.length ? e.extra : [{ mensaje: e.message, severidad: 'BLOQUEA' }];
    caja.innerHTML = lista.map(x => '<div class="aviso ' + (x.severidad === 'ADVIERTE' ? 'warn' : 'error') + '">' + App.ic('alerta') + '<span>' + esc(x.mensaje) + '</span></div>').join('');
    caja.scrollIntoView({ block: 'nearest' });
  };
  App.confirmar = (texto, o) => { o = o || {}; return App.dialogo({ titulo: o.titulo || 'Confirmar', html: '<p>' + esc(texto) + '</p>', botones: [{ txt: 'Cancelar', valor: false }, { txt: o.si || 'Confirmar', clase: o.peligro ? 'btn-danger' : 'btn-primary', valor: true }] }).then(v => !!v); };
  App.pedirTexto = (titulo, etiqueta, si) => App.dialogo({
    titulo, html: '<label class="campo">' + esc(etiqueta) + '<textarea id="pt-texto" maxlength="300"></textarea></label>',
    botones: [{ txt: 'Cancelar', valor: null }, { txt: si || 'Aceptar', clase: 'btn-primary', onClick: (cerrar, dlg) => { const v = App.$('#pt-texto', dlg).value.trim(); if (!v) { App.errorEn(dlg, new Error('Escriba un texto.')); return false; } cerrar(v); } }],
    alAbrir: d => App.$('#pt-texto', d).focus()
  });

  /* ---------- tooltip ---------- */
  App.tip = {
    el: null,
    mostrar(html, ev) {
      const t = this.el || (this.el = App.$('#tip'));
      t.innerHTML = html; t.hidden = false;
      const w = t.offsetWidth, h = t.offsetHeight;
      let x = ev.clientX + 14, y = ev.clientY + 14;
      if (x + w > innerWidth - 8) x = ev.clientX - w - 14;
      if (y + h > innerHeight - 8) y = ev.clientY - h - 14;
      t.style.left = Math.max(8, x) + 'px'; t.style.top = Math.max(8, y) + 'px';
    },
    ocultar() { (this.el || (this.el = App.$('#tip'))).hidden = true; }
  };

  /* ---------- datos derivados ---------- */
  const rol = () => (S.user ? S.user.rol : '');
  App.esAdmin = () => rol() === 'ADMIN';
  App.esJefe = () => rol() === 'JEFE';
  /** Permisos que el administrador concede a cada rol (el servidor los hace cumplir; aquí solo se ocultan botones). */
  App.puede = k => !!S.user && (S.user.permisos || []).indexOf(k) >= 0;
  App.puedeAlguno = lista => lista.some(App.puede);
  App.esGestor = () => App.puede('solicitud_aprobar_final') || App.puede('solicitud_aprobar_equipo');
  App.veTodasLasSolicitudes = () => App.esGestor() || App.puede('ver_personal_todos') || App.puede('ver_personal_area');
  App.persona = id => S.pm[id];
  App.areaNombre = id => { const a = S.d.areas.find(x => x.id === id); return a ? a.nombre : '—'; };
  App.catNombre = id => { const a = S.d.categorias.find(x => x.id === id); return a ? a.nombre : '—'; };
  App.nombreCompleto = p => p ? p.nombres + ' ' + p.apellidos : '';
  App.nombreCorto = p => p ? p.apellidos.split(' ')[0] + ' ' + p.nombres.split(' ')[0].charAt(0) + '.' : '';
  App.iniciales = p => p ? (p.nombres.charAt(0) + p.apellidos.charAt(0)).toUpperCase() : '?';
  App.colorGrupo = (tipo, id) => {
    const lista = tipo === 'categoria' ? S.d.categorias : S.d.areas;
    const i = lista.findIndex(x => x.id === id);
    return i >= 0 && i < 8 ? 'var(--g' + (i + 1) + ')' : 'var(--g0)';
  };
  const colorAvatar = id => { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return 'var(--g' + (h % 8 + 1) + ')'; };
  App.avatar = (p, grande) => {
    if (!p) return '';
    return '<span class="avatar' + (grande ? ' g' : '') + '" data-pid="' + esc(p.id) + '" style="background:' + colorAvatar(p.id) + '" aria-hidden="true">' + esc(App.iniciales(p)) + '</span>';
  };
  App.pintarFotos = () => {
    App.$$('.avatar[data-pid]').forEach(el => {
      const f = S.fotos[el.dataset.pid];
      if (f && !el.querySelector('img')) { el.innerHTML = '<img alt="" src="' + f + '">'; el.style.background = 'var(--surface-2)'; }
    });
  };
  const ESTADO = {
    APROBADA: { txt: 'Aprobada', cls: 'aprobada', ic: 'check' },
    PENDIENTE_JEFE: { txt: 'Pendiente del jefe', cls: 'pendiente', ic: 'reloj' },
    PENDIENTE_ADMIN: { txt: 'Pendiente de administración', cls: 'pendiente', ic: 'reloj' },
    RECHAZADA: { txt: 'Rechazada', cls: 'rechazada', ic: 'x' },
    ANULADA: { txt: 'Anulada', cls: 'anulada', ic: 'x' }
  };
  App.ESTADO = ESTADO;
  App.fmtNum = n => String(Math.round(Number(n) * 10) / 10).replace('.', ',');
  App.esMedio = (s, f) => (s.medios || []).indexOf(f) >= 0;
  App.esCumple = s => s.tipo === 'CUMPLEANOS';
  App.tipoTxt = s => (App.esCumple(s) ? 'Día de cumpleaños' : 'Vacaciones');
  App.badge = e => { const x = ESTADO[e] || { txt: e, cls: '', ic: 'info' }; return '<span class="badge ' + x.cls + '">' + App.ic(x.ic) + x.txt + '</span>'; };
  App.esPendiente = s => s.estado === 'PENDIENTE_JEFE' || s.estado === 'PENDIENTE_ADMIN';
  App.ocupa = s => s.estado === 'APROBADA' || App.esPendiente(s);
  App.areasACargo = () => (S.d.areas_a_cargo || []);
  App.puedeDecidir = s => {
    if (!App.esPendiente(s)) return false;
    if (App.puede('solicitud_aprobar_final')) return true;
    const p = App.persona(s.persona_id);
    return App.puede('solicitud_aprobar_equipo') && s.estado === 'PENDIENTE_JEFE' && p && App.areasACargo().indexOf(p.area_id) >= 0 && p.id !== S.user.persona_id;
  };
  App.puedeAnular = s => {
    if (s.estado === 'ANULADA' || s.estado === 'RECHAZADA') return false;
    if (App.puede('solicitud_anular_todos')) return true;
    if (s.persona_id === S.user.persona_id && App.puede('solicitud_anular_propia')) return s.estado !== 'APROBADA' || s.inicio > App.hoy();
    const p = App.persona(s.persona_id);
    return App.puede('solicitud_anular_equipo') && s.estado !== 'APROBADA' && !!p && App.areasACargo().indexOf(p.area_id) >= 0 && s.creada_por === S.user.usuario;
  };
  App.antiguedadDe = p => { const s = S.d.saldos[p.id]; return s ? s.antiguedad_meses : null; };

  /** Mapa fecha → [{s, p}] de las solicitudes filtradas. */
  App.ocupacion = function (filtro) {
    filtro = filtro || {};
    const mapa = {};
    S.d.solicitudes.forEach(s => {
      if (!App.ocupa(s)) return;
      if (filtro.soloAprobadas && s.estado !== 'APROBADA') return;
      const p = S.pm[s.persona_id];
      if (!p) return;
      if (filtro.area && p.area_id !== filtro.area) return;
      if (filtro.cat && p.categoria_id !== filtro.cat) return;
      (s.fechas || []).forEach(f => { if (!filtro.anio || f.slice(0, 4) === String(filtro.anio)) (mapa[f] = mapa[f] || []).push({ s, p }); });
    });
    return mapa;
  };
  App.feriadoMapa = () => { const m = {}; S.d.feriados.forEach(f => { m[f.fecha] = f.nombre; }); return m; };

  /* ---------- sesión ---------- */
  App.salir = () => JDI.irAInicio();

  App.cargar = async function () {
    S.d = await App.api('inicial');
    S.user = S.d.usuario;
    S.pm = {}; S.d.personal.forEach(p => { S.pm[p.id] = p; });
    App.api('fotos').then(f => { S.fotos = f; App.pintarFotos(); }).catch(() => { /* las fotos son opcionales */ });
  };
  App.recargar = async function () { await App.conCarga(App.cargar); pintarVista(); };

  function marcaSvg() { return '<svg width="34" height="34" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="var(--jdi-primary,#3b82f6)"/><rect x="6" y="9" width="20" height="16" rx="3" fill="none" stroke="#fff" stroke-width="2"/><path d="M6 14h20M11 6v5M21 6v5" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>'; }

  /* ---------- estructura de la aplicación ---------- */
  const MENU = [
    { id: 'inicio', txt: 'Inicio', grupo: '' },
    { id: 'anual', txt: 'Calendario anual', grupo: 'Programación', perm: ['ver_calendarios'] },
    { id: 'mensual', txt: 'Calendario mensual', grupo: 'Programación', perm: ['ver_calendarios'] },
    { id: 'solicitudes', txt: 'Solicitudes', grupo: 'Programación' },
    { id: 'personal', txt: 'Personal', grupo: 'Gestión' },
    { id: 'analisis', txt: 'Análisis', grupo: 'Gestión', perm: ['ver_analisis'] },
    { id: 'reglas', txt: 'Reglas vigentes', grupo: 'Gestión' },
    { id: 'config', txt: 'Configuración', grupo: 'Administración', perm: ['config_editar', 'catalogo_editar', 'reglas_editar', 'usuarios_editar'] },
    { id: 'permisos', txt: 'Permisos por rol', grupo: 'Administración', perm: ['permisos_editar'] }
  ];
  const menuVisible = x => !x.perm || App.puedeAlguno(x.perm);
  App.registrar = (id, v) => { App.vistas[id] = v; };

  function mostrarApp() {
    const m = MENU.filter(menuVisible);
    let grupo = null, items = '';
    m.forEach(x => {
      if (x.grupo && x.grupo !== grupo) { items += '<div class="grupo">' + x.grupo + '</div>'; }
      grupo = x.grupo;
      items += '<a class="item" href="#/' + x.id + '" data-v="' + x.id + '">' + App.ic(x.id) + x.txt + '</a>';
    });
    const rolTxt = { ADMIN: 'Administrador', JEFE: 'Jefe de área', PERSONAL: 'Personal', PROPIETARIO: 'Propietario' }[S.user.rol];
    const yo = App.persona(S.user.persona_id);
    App.$('#raiz').innerHTML = '<div class="app"><div class="topbar"><button id="b-menu" aria-label="Abrir menú" aria-expanded="false">' + App.ic('menu', ' width="24" height="24"') + '</button><b>' + esc(S.d.config.institucion) + '</b></div>' +
      '<nav class="nav" id="nav" aria-label="Principal"><div class="marca">' + marcaSvg() + '<div><b>Vacaciones</b><span>' + esc(JDI.empresa.nombre || S.d.config.institucion) + '</span></div></div>' + items +
      '<div class="espacio"></div><div class="usuario"><b>' + esc(yo ? App.nombreCompleto(yo) : S.user.usuario) + '</b><span class="muted" style="color:inherit;opacity:.7">' + rolTxt + '</span><div style="margin-top:6px"><button id="b-tema">Tema</button><button id="b-salir">Inicio Suite</button></div></div></nav>' +
      '<main class="main" id="vista" tabindex="-1"></main></div>';
    App.$('#b-salir').addEventListener('click', App.salir);
    App.$('#b-tema').addEventListener('click', () => {
      const oscuro = getComputedStyle(document.documentElement).colorScheme === 'dark';
      const nuevo = oscuro ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', nuevo); guardar('jdi.vacaciones.tema', nuevo); pintarVista();
    });
    const nav = App.$('#nav'), bm = App.$('#b-menu');
    bm.addEventListener('click', () => { const ab = nav.classList.toggle('abierto'); bm.setAttribute('aria-expanded', ab); });
    nav.addEventListener('click', e => { if (e.target.closest('a.item')) nav.classList.remove('abierto'); });
    if (!location.hash) location.hash = '#/inicio';
    pintarVista();
  }

  function pintarVista() {
    if (!S.d) return;
    let id = (location.hash || '#/inicio').replace('#/', '').split('?')[0];
    const item = MENU.find(x => x.id === id);
    if (!App.vistas[id] || (item && !menuVisible(item))) id = 'inicio';
    App.$$('.nav a.item').forEach(a => a.setAttribute('aria-current', a.dataset.v === id ? 'page' : 'false'));
    let el = App.$('#vista');
    const fresco = el.cloneNode(false);          // descarta los escuchadores de la vista anterior
    el.replaceWith(fresco); el = fresco;
    try { App.vistas[id].render(el); }
    catch (e) { console.error(e); el.innerHTML = '<div class="aviso error">' + App.ic('alerta') + '<span>No se pudo mostrar esta pantalla: ' + esc(e.message) + '</span></div>'; }
    App.pintarFotos();
    document.title = App.vistas[id].titulo + ' · Vacaciones';
  }
  App.pintarVista = pintarVista;
  App.ir = id => { if (location.hash === '#/' + id) pintarVista(); else location.hash = '#/' + id; };
  window.addEventListener('hashchange', () => { if (S.d) { pintarVista(); window.scrollTo(0, 0); } });

  /* Utilidades para vistas */
  App.cabecera = (titulo, sub, acciones) => '<div class="cabecera"><div><h1>' + esc(titulo) + '</h1>' + (sub ? '<div class="sub">' + sub + '</div>' : '') + '</div><div class="acciones">' + (acciones || '') + '</div></div>';
  App.opciones = (lista, sel, vacio) => (vacio !== undefined ? '<option value="">' + esc(vacio) + '</option>' : '') + lista.map(x => '<option value="' + esc(x.id) + '"' + (x.id === sel ? ' selected' : '') + '>' + esc(x.nombre) + '</option>').join('');
  App.filtrosComunes = () => {
    const f = S.f;
    return '<label class="campo">Área<select data-f="area">' + App.opciones(S.d.areas, f.area, 'Todas las áreas') + '</select></label>' +
      '<label class="campo">Categoría<select data-f="cat">' + App.opciones(S.d.categorias, f.cat, 'Todas las categorías') + '</select></label>';
  };
  /** Conecta selects/checks con data-f a S.f y vuelve a pintar. */
  App.enlazarFiltros = (el, alCambiar) => {
    App.$$('[data-f]', el).forEach(c => c.addEventListener('change', () => { S.f[c.dataset.f] = c.type === 'checkbox' ? c.checked : c.value; alCambiar(); }));
  };
  App.nombreGrupo = (tipo, id) => (tipo === 'categoria' ? App.catNombre(id) : App.areaNombre(id));
  App.exportarCSV = (nombre, filas) => {
    const csv = '﻿' + filas.map(r => r.map(c => '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"').join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
  };

  App.iniciar = async function () {
    S.f = { anio: new Date().getFullYear(), mes: new Date().getMonth() + 1, area: '', cat: '', pend: true, agrupar: 'area', cols: 3 };
    try { await App.conCarga(App.cargar); mostrarApp(); }
    catch (e) { App.$('#raiz').innerHTML = '<div style="padding:40px;max-width:560px;margin:auto"><div class="aviso error">' + App.ic('alerta') + '<span>' + esc(e.message) + '</span></div></div>'; }
  };
  const cargarAnterior = App.cargar;
  App.cargar = async function () {
    await cargarAnterior();
    if (!S.f.init) { S.f.anio = +S.d.hoy.slice(0, 4); S.f.mes = +S.d.hoy.slice(5, 7); S.f.init = true; }
  };
})();
