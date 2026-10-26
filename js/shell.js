/* JeaDas.Insights — shell: acceso, panel de módulos, administración del cliente y del SuperAdministrador. */
(function () {
  'use strict';
  var API = (window.JDI_CONFIG && window.JDI_CONFIG.API_URL) || '';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var ST = { token: null, me: null, mod: null, menu: false };
  var store = {
    get: function (k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } }
  };

  /* ---------- módulos: presentación ---------- */
  var MOD = {
    identificadores: { n: 'Identificadores', c: '#22d3ee', d: 'Tomos, secciones y rótulos para identificar cada archivo físico.', i: '<path d="M4 7V5a1 1 0 011-1h2M17 4h2a1 1 0 011 1v2M20 17v2a1 1 0 01-1 1h-2M7 20H5a1 1 0 01-1-1v-2M8 9v6M12 9v6M16 9v6"/>' },
    firmas: { n: 'Cites&Firmas', c: '#a855f7', d: 'Cites automáticos y seguimiento de visto bueno y firma.', i: '<path d="M4 20h4L19 9l-4-4L4 16zM13 7l4 4M14 20h6"/>' },
    vacaciones: { n: 'Vacaciones', c: '#3b82f6', d: 'Saldos, solicitudes y calendario de vacaciones del personal.', i: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4M8 14h8"/>' },
    archivo: { n: 'Archivo', c: '#6366f1', d: 'Correspondencia, archivo físico y digital con trazabilidad.', i: '<path d="M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10"/>' }
  };
  var ORDEN = ['identificadores', 'firmas', 'vacaciones', 'archivo'];

  /* ---------- red ---------- */
  var pend = 0;
  function bar(d) { pend += d; var b = $('#bar'); if (b) b.classList.toggle('on', pend > 0); }
  function post(body) {
    if (!/^https?:|^\//.test(API)) return Promise.reject(Object.assign(new Error('La aplicación no está conectada: defina API_URL en config.js con la URL /exec del Web App.'), { code: 'CONFIG' }));
    bar(1);
    return fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .catch(function () { throw Object.assign(new Error('No se pudo contactar al servidor. Revise su conexión.'), { code: 'RED' }); })
      .then(function (j) { bar(-1); return j; }, function (e) { bar(-1); throw e; });
  }
  function suiteErr(j) {
    var e = new Error(j.error || 'Error'); e.code = j.code || 'ERROR';
    if (e.code === 'SESION') { sesionVencida(); }
    else if (e.code === 'CAMBIO_CLAVE' && ST.me) { pantallaClave(true); }
    return e;
  }
  function api(action, data) {
    return post({ action: action, token: ST.token, data: data || {} }).then(function (j) {
      if (j && j.ok) return j.data;
      throw suiteErr(j || {});
    });
  }
  function modCall(modulo, body) {
    return post({ action: 'mod', modulo: modulo, body: body, token: ST.token }).then(function (j) {
      if (j && j.suiteError) throw suiteErr(j);
      return j;
    });
  }

  /* ---------- utilidades de interfaz ---------- */
  function toast(msg, tipo) {
    var t = document.createElement('div'); t.className = 'toast ' + (tipo || ''); t.textContent = msg;
    $('#toasts').appendChild(t); setTimeout(function () { t.remove(); }, tipo === 'error' ? 7000 : 3800);
  }
  function dlg(o) {
    return new Promise(function (resolve) {
      var d = document.createElement('dialog'); if (o.wide) d.className = 'wide';
      d.innerHTML = '<div class="dh"><h2>' + esc(o.titulo) + '</h2><button class="btn xs" data-x aria-label="Cerrar">✕</button></div><div class="db">' + (o.html || '') + '</div><div class="df"></div>';
      var pie = $('.df', d), done = false;
      function cerrar(v) { if (done) return; done = true; d.close(); d.remove(); resolve(v); }
      var bs = o.botones || [{ t: 'Cerrar' }];
      bs.forEach(function (b) {
        var el = document.createElement('button'); el.className = 'btn ' + (b.cls || ''); el.textContent = b.t; el.type = 'button';
        el.onclick = function () {
          if (!b.run) return cerrar(b.v);
          el.disabled = true;
          Promise.resolve(b.run(d, cerrar)).then(function (r) { if (r === false) el.disabled = false; }, function (e) { el.disabled = false; errEn(d, e); });
        };
        pie.appendChild(el);
      });
      $('[data-x]', d).onclick = function () { cerrar(undefined); };
      d.addEventListener('cancel', function (e) { e.preventDefault(); cerrar(undefined); });
      document.body.appendChild(d); d.showModal();
      if (o.alAbrir) o.alAbrir(d, cerrar);
    });
  }
  function errEn(d, e) {
    var c = $('.err', d); if (!c) { c = document.createElement('div'); c.className = 'err'; c.setAttribute('role', 'alert'); $('.db', d).prepend(c); }
    c.textContent = e.message || String(e); c.scrollIntoView({ block: 'nearest' });
  }
  function valores(r) { var o = {}; r.querySelectorAll('[name]').forEach(function (el) { o[el.name] = el.type === 'checkbox' ? el.checked : el.value; }); return o; }
  function campo(n, l, v, o) {
    o = o || {};
    return '<label class="f"' + (o.full ? ' style="grid-column:1/-1"' : '') + '><span>' + esc(l) + '</span><input type="' + (o.t || 'text') + '" name="' + n + '" value="' + esc(v == null ? '' : v) + '"' + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : '') + (o.max ? ' maxlength="' + o.max + '"' : '') + (o.auto ? ' autocomplete="' + o.auto + '"' : '') + (o.req ? ' required' : '') + '>' + (o.hint ? '<small class="hint">' + esc(o.hint) + '</small>' : '') + '</label>';
  }
  function fecha(s) { return s ? String(s).slice(0, 10).split('-').reverse().join('/') : '—'; }
  function secreto(titulo, usuario, clave) {
    return dlg({ titulo: titulo, html: '<p class="mut" style="margin-bottom:14px">Entregue estos datos a la persona. <b>La contraseña se muestra una sola vez</b>; deberá cambiarla en su primer ingreso.</p><p class="sm mut">Usuario</p><div class="secret" style="margin-bottom:12px">' + esc(usuario) + '</div><p class="sm mut">Contraseña temporal</p><div class="secret">' + esc(clave) + '</div>',
      botones: [{ t: 'Copiar datos', run: function () { try { navigator.clipboard.writeText('Usuario: ' + usuario + '\nContraseña temporal: ' + clave); toast('Datos copiados.', 'ok'); } catch (e) { toast('Seleccione y copie manualmente.'); } return false; } }, { t: 'Entendido', cls: 'pri' }] });
  }
  function iniciales(n) { return String(n || '?').split(/\s+/).slice(0, 2).map(function (x) { return x.charAt(0); }).join('').toUpperCase(); }
  function logoSrc(e) { return e && /^data:image\/(png|jpeg|webp);base64,/.test(e.logo_data || '') ? e.logo_data : ''; }

  /* ---------- marca de la empresa ---------- */
  function aplicarMarca() {
    var e = ST.me && ST.me.empresa, r = document.documentElement.style;
    ['--jdi-primary', '--jdi-secondary'].forEach(function (k) { r.removeProperty(k); });
    if (e && /^#[0-9a-f]{6}$/i.test(e.color_primario || '')) r.setProperty('--jdi-primary', e.color_primario);
    if (e && /^#[0-9a-f]{6}$/i.test(e.color_secundario || '')) r.setProperty('--jdi-secondary', e.color_secundario);
  }
  function refrescarMarca() {
    return api('me').then(function (me) {
      ST.me = me; aplicarMarca();
      try { var f = $('#modview iframe'); if (f && f.contentWindow && f.contentWindow.JDI) f.contentWindow.JDI._brandChanged(); } catch (e) { /* iframe cerrado */ }
      if (!ST.mod) render();
    });
  }

  /* ---------- puente para los módulos ---------- */
  window.__JDI_SHELL = {
    me: function () { return ST.me; },
    modCall: modCall,
    toast: toast,
    irAInicio: function () { abrirInicio(); }
  };

  /* ---------- sesión ---------- */
  function sesionVencida() {
    store.set('jdi.token', null); ST.token = null; ST.me = null; ST.mod = null;
    pantallaLogin('Su sesión venció. Ingrese nuevamente.');
  }
  function salir() {
    var t = ST.token;
    if (t) post({ action: 'logout', token: t }).catch(function () { /* ya vencida */ });
    store.set('jdi.token', null); ST.token = null; ST.me = null; ST.mod = null; ST.menu = false;
    document.documentElement.style.removeProperty('--jdi-primary'); document.documentElement.style.removeProperty('--jdi-secondary');
    document.title = 'JeaDas.Insights'; pantallaLogin('');
  }

  function pantallaLogin(aviso) {
    $('#root').innerHTML = '<section id="login"><form class="logincard" id="flog" autocomplete="on"><h1 class="brand">JeaDas<i>.Insights</i></h1><p class="sub">Ingrese para acceder a sus módulos.</p>' +
      (aviso ? '<div class="err" role="alert">' + esc(aviso) + '</div>' : '') +
      '<label class="f"><span>Usuario</span><input type="text" name="usuario" autocomplete="username" autocapitalize="none" spellcheck="false" required></label>' +
      '<label class="f"><span>Contraseña</span><input type="password" name="clave" autocomplete="current-password" required></label>' +
      '<div id="lerr"></div><button class="btn pri" style="width:100%;margin-top:6px" type="submit">Ingresar</button></form></section>';
    $('[name=usuario]').focus();
    $('#flog').onsubmit = function (ev) {
      ev.preventDefault();
      var v = valores(ev.target), b = $('button', ev.target); b.disabled = true; $('#lerr').innerHTML = '';
      post({ action: 'login', data: { usuario: v.usuario.trim(), clave: v.clave } }).then(function (j) {
        if (!j || !j.ok) throw Object.assign(new Error((j && j.error) || 'No se pudo ingresar.'), { code: j && j.code });
        ST.token = j.data.token; store.set('jdi.token', ST.token); ST.me = j.data.me; aplicarMarca();
        entrar();
      }).catch(function (e) { b.disabled = false; $('#lerr').innerHTML = '<div class="err" role="alert">' + esc(e.message) + '</div>'; });
    };
  }

  function pantallaClave(forzada) {
    $('#root').innerHTML = '<section id="login"><form class="logincard" id="fclave" autocomplete="off"><h1 class="brand">Nueva contraseña</h1><p class="sub">' + (forzada ? 'Su contraseña es temporal. Elija una propia para continuar.' : 'Elija una contraseña nueva.') + '</p>' +
      '<label class="f"><span>Contraseña actual</span><input type="password" name="actual" autocomplete="current-password" required></label>' +
      '<label class="f"><span>Contraseña nueva</span><input type="password" name="nueva" autocomplete="new-password" required><small class="hint">Mínimo 10 caracteres, con letras y números.</small></label>' +
      '<label class="f"><span>Repita la contraseña nueva</span><input type="password" name="rep" autocomplete="new-password" required></label>' +
      '<div id="cerr"></div><div class="row"><button class="btn pri" type="submit">Guardar y continuar</button><button class="btn" type="button" id="csal">' + (forzada ? 'Salir' : 'Cancelar') + '</button></div></form></section>';
    $('[name=actual]').focus();
    $('#csal').onclick = function () { forzada ? salir() : render(); };
    $('#fclave').onsubmit = function (ev) {
      ev.preventDefault(); var v = valores(ev.target), er = $('#cerr'); er.innerHTML = '';
      if (v.nueva !== v.rep) { er.innerHTML = '<div class="err" role="alert">Las contraseñas nuevas no coinciden.</div>'; return; }
      api('cambiarClave', { actual: v.actual, nueva: v.nueva }).then(function () { return api('me'); }).then(function (me) { ST.me = me; aplicarMarca(); toast('Contraseña actualizada.', 'ok'); entrar(); })
        .catch(function (e) { er.innerHTML = '<div class="err" role="alert">' + esc(e.message) + '</div>'; });
    };
  }

  function entrar() {
    if (ST.me.usuario.debe_cambiar) return pantallaClave(true);
    var q = new URLSearchParams(location.search), m = q.get('m');
    if (m && MOD[m] && ST.me.modulos.some(function (x) { return x.id === m && x.disponible; })) return abrirModulo(m);
    abrirInicio();
  }

  /* ---------- navegación ---------- */
  function abrirInicio() { ST.mod = null; ST.menu = false; ST.vista = 'inicio'; document.title = 'JeaDas.Insights'; render(); }
  function abrirAdmin(v) { ST.mod = null; ST.menu = false; ST.vista = v; render(); }
  function abrirModulo(id) {
    ST.mod = id; ST.menu = false; document.title = 'JeaDas.Insights - ' + MOD[id].n; render();
  }
  function armarMarco() {
    var cont = $('#modview'); if (!cont) return;
    cont.innerHTML = '<div class="loading">Cargando ' + esc(MOD[ST.mod].n) + '…</div>';
    var f = document.createElement('iframe'); f.title = 'JeaDas.Insights - ' + MOD[ST.mod].n; f.src = 'modulos/' + ST.mod + '/index.html';
    f.setAttribute('allow', 'clipboard-write'); f.onload = function () { var l = $('.loading', cont); if (l) l.remove(); };
    cont.appendChild(f);
  }

  /* ---------- cabecera ---------- */
  function cabecera() {
    var me = ST.me, e = me.empresa, u = me.usuario, enMod = !!ST.mod;
    var logo = logoSrc(e);
    return '<header class="top"><button class="brand" id="hbrand" aria-label="Ir al inicio">JeaDas<i>.Insights</i></button>' +
      (e ? '<div class="co">' + (logo ? '<img src="' + esc(logo) + '" alt="">' : '') + '<b>' + esc(e.nombre) + '</b></div>' : '') +
      (enMod ? '<span class="pill" style="margin-left:6px">' + esc(MOD[ST.mod].n) + '</span>' : '') +
      '<span class="sp"></span>' + (enMod ? '<button class="btn back" id="hback">← Módulos</button>' : '') +
      '<button class="userbtn" id="hu" aria-haspopup="true" aria-expanded="' + ST.menu + '"><span class="avatar">' + esc(iniciales(u.nombre)) + '</span><span class="nm">' + esc(u.nombre) + '</span></button></header>' +
      (ST.menu ? '<div class="menu" role="menu"><div class="who"><b>' + esc(u.nombre) + '</b><div class="mut sm">' + esc(u.usuario) + ' · ' + (me.esSuper ? 'SuperAdministrador' : me.esAdmin ? 'Administrador del cliente' : 'Usuario') + '</div></div>' +
        '<button data-m="inicio">' + (me.esSuper ? 'Empresas' : 'Mis módulos') + '</button>' + (me.esAdmin ? '<button data-m="admin">Administración de la empresa</button>' : '') +
        '<button data-m="perfil">Mi cuenta</button><button data-m="clave">Cambiar contraseña</button><button data-m="salir">Salir</button></div>' : '');
  }
  function enlazarCabecera() {
    $('#hbrand').onclick = abrirInicio;
    var b = $('#hback'); if (b) b.onclick = abrirInicio;
    $('#hu').onclick = function (ev) { ev.stopPropagation(); ST.menu = !ST.menu; var m = $('.menu'); if (m) { m.remove(); $('#hu').setAttribute('aria-expanded', 'false'); } else { rerenderMenu(); } };
    var mn = $('.menu'); if (mn) mn.onclick = function (ev) { var x = ev.target.closest('[data-m]'); if (!x) return; ST.menu = false; var a = x.dataset.m;
      if (a === 'inicio') abrirInicio(); else if (a === 'admin') abrirAdmin('suscripcion'); else if (a === 'salir') salir(); else if (a === 'clave') pantallaClave(false); else if (a === 'perfil') dlgPerfil(); };
  }
  function rerenderMenu() { var cur = $('header.top'); if (!cur) return; var tmp = document.createElement('div'); tmp.innerHTML = cabecera(); var m = $('.menu', tmp); if (m) { document.body.appendChild(m); m.onclick = function (ev) { var x = ev.target.closest('[data-m]'); if (!x) return; ST.menu = false; m.remove(); var a = x.dataset.m; if (a === 'inicio') abrirInicio(); else if (a === 'admin') abrirAdmin('suscripcion'); else if (a === 'salir') salir(); else if (a === 'clave') pantallaClave(false); else if (a === 'perfil') dlgPerfil(); }; $('#hu').setAttribute('aria-expanded', 'true'); } }
  document.addEventListener('click', function (ev) { var m = $('.menu'); if (m && !ev.target.closest('.menu') && !ev.target.closest('#hu')) { m.remove(); ST.menu = false; var h = $('#hu'); if (h) h.setAttribute('aria-expanded', 'false'); } });

  function dlgPerfil() {
    var u = ST.me.usuario;
    dlg({ titulo: 'Mi cuenta', html: campo('nombre_completo', 'Nombre completo', u.nombre, { req: true, max: 120 }) + campo('email', 'Correo electrónico', u.email || '', { t: 'email', max: 160 }) + '<p class="mut sm">Usuario: <b>' + esc(u.usuario) + '</b> (no se puede cambiar)</p>',
      botones: [{ t: 'Cancelar' }, { t: 'Guardar', cls: 'pri', run: function (d, c) { var v = valores(d); return api('perfil.guardar', v).then(function () { return refrescarMarca(); }).then(function () { toast('Datos actualizados.', 'ok'); c(true); }); } }] });
  }

  /* ---------- render principal ---------- */
  function render() {
    if (!ST.me) return;
    var root = $('#root');
    if (ST.mod) {
      root.innerHTML = '<div id="app">' + cabecera() + '<div id="modview"></div></div>';
      enlazarCabecera(); armarMarco(); return;
    }
    var cuerpo = ST.me.esSuper ? vistaSuper() : ADMT.some(function (x) { return x[0] === ST.vista; }) && ST.me.esAdmin ? '<div id="admbox"></div>' : vistaInicio();
    root.innerHTML = '<div id="app">' + cabecera() + '<main id="main">' + cuerpo + '</main><footer class="foot">' + esc((ST.me.empresa && ST.me.empresa.pie_pagina) || 'JeaDas.Insights') + '</footer></div>';
    enlazarCabecera();
    if (ST.me.esSuper) enlazarSuper();
    else if ($('#admbox')) montarAdmin(); else enlazarInicio();
  }

  /* ---------- inicio del usuario ---------- */
  function vistaInicio() {
    var me = ST.me, nombre = (me.usuario.nombre || '').split(/\s+/)[0];
    var mods = ORDEN.map(function (id) { return me.modulos.filter(function (m) { return m.id === id; })[0]; }).filter(function (m) { return m && m.contratado && m.habilitado; });
    var s = me.suscripcion, av = '';
    if (s && s.estado !== 'activa') av = '<div class="alertbar bad">La suscripción de la empresa está ' + esc(s.estado) + '. ' + (me.esAdmin ? 'Contacte al proveedor para reactivarla.' : 'Contacte a su administrador.') + '</div>';
    else if (s && s.dias_restantes != null && s.dias_restantes <= 15) av = '<div class="alertbar">La suscripción vence ' + (s.dias_restantes <= 0 ? 'hoy' : 'en ' + s.dias_restantes + ' día' + (s.dias_restantes === 1 ? '' : 's')) + ' (' + fecha(s.fin) + ').</div>';
    var cards = mods.map(function (m) {
      var p = MOD[m.id], lock = !m.disponible;
      return '<button class="mcard' + (lock ? ' lock' : '') + '" style="--c:' + p.c + '" data-mod="' + m.id + '"' + (lock ? ' aria-disabled="true"' : '') + '><span class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p.i + '</svg></span>' +
        '<h2><small>JeaDas.Insights</small>' + esc(p.n) + '</h2><p>' + esc(lock ? (m.motivo || 'No disponible') : p.d) + '</p></button>';
    }).join('');
    return '<section class="hello"><h1>Bienvenido de nuevo, ' + esc(nombre) + '</h1><p>' + (mods.length ? 'Elija un módulo para continuar.' : '') + '</p></section>' + av +
      (cards ? '<div class="cards">' + cards + '</div>' : '<div class="empty"><b>Todavía no tiene módulos habilitados.</b><p style="margin-top:6px">' + (me.esAdmin ? 'Habilítelos en Administración de la empresa → Usuarios.' : 'Pida a su administrador que le habilite el acceso.') + '</p></div>');
  }
  function enlazarInicio() {
    var c = $('.cards'); if (c) c.onclick = function (ev) { var b = ev.target.closest('[data-mod]'); if (!b || b.classList.contains('lock')) return; abrirModulo(b.dataset.mod); };
  }

  /* ---------- administración del cliente ---------- */
  var ADMT = [['suscripcion', 'Suscripción'], ['empresa', 'Empresa'], ['usuarios', 'Usuarios'], ['auditoria', 'Auditoría']];
  function montarAdmin() {
    var t = ADMT.some(function (x) { return x[0] === ST.vista; }) ? ST.vista : 'suscripcion';
    $('#admbox').innerHTML = '<section class="hello"><h1>Administración de ' + esc(ST.me.empresa.nombre) + '</h1></section><div class="tabs" role="tablist">' +
      ADMT.map(function (x) { return '<button role="tab" data-t="' + x[0] + '" aria-selected="' + (x[0] === t) + '">' + x[1] + '</button>'; }).join('') + '</div><div id="adm"><p class="mut">Cargando…</p></div>';
    $('.tabs').onclick = function (ev) { var b = ev.target.closest('[data-t]'); if (b) { ST.vista = b.dataset.t; render(); } };
    var f = { suscripcion: admSuscripcion, empresa: admEmpresa, usuarios: admUsuarios, auditoria: admAuditoria }[t];
    f($('#adm')).catch(function (e) { $('#adm').innerHTML = '<div class="err">' + esc(e.message) + '</div>'; });
  }
  function pillEstado(e) { return '<span class="pill ' + (e === 'activa' || e === 'activo' ? 'ok' : e === 'vencida' ? 'warn' : 'bad') + '">' + esc(e) + '</span>'; }

  function admSuscripcion(el) {
    return api('empresa.obtener').then(function (d) {
      var s = d.suscripcion;
      el.innerHTML = '<div class="kpis"><div class="kpi"><span>Estado</span><b>' + pillEstado(s.estado) + '</b></div><div class="kpi"><span>Plan</span><b>' + esc(s.plan || '—') + '</b></div>' +
        '<div class="kpi"><span>Vence</span><b>' + fecha(s.fin) + '</b><span>' + (s.dias_restantes == null ? 'Sin vencimiento' : s.dias_restantes + ' días restantes') + '</span></div>' +
        '<div class="kpi"><span>Usuarios activos</span><b>' + d.usuarios_activos + ' / ' + s.max_usuarios + '</b></div></div>' +
        '<div class="panel"><h3>Módulos contratados</h3><div class="tw"><table><thead><tr><th>Módulo</th><th>Estado</th><th>Vence</th></tr></thead><tbody>' +
        d.modulos.map(function (m) { return '<tr><td><b>' + esc(m.nombre) + '</b><div class="mut sm">' + esc(m.descripcion || '') + '</div></td><td>' + (m.contratado ? pillEstado(m.estado || 'activo') : '<span class="pill">No contratado</span>') + '</td><td>' + (m.vence_en ? fecha(m.vence_en) : '—') + '</td></tr>'; }).join('') + '</tbody></table></div>' +
        '<p class="mut sm" style="margin-top:12px">Para contratar otro módulo, comuníquese con el proveedor. El módulo nuevo tomará la configuración y los usuarios que ya tiene su empresa.</p></div>';
    });
  }

  function admEmpresa(el) {
    return api('empresa.obtener').then(function (d) {
      var e = d.empresa, logo = logoSrc(e);
      el.innerHTML = '<form class="panel" id="femp" autocomplete="off"><h3>Datos de la empresa (compartidos por todos los módulos)</h3>' +
        '<div class="logoedit"><div class="logoprev">' + (logo ? '<img src="' + esc(logo) + '" alt="Logo">' : '<span class="mut sm">Sin logo</span>') + '</div><div><input type="file" id="lgf" accept="image/png,image/jpeg,image/webp" hidden><div class="row"><button class="btn" type="button" id="lgu">Cargar logo</button>' + (logo ? '<button class="btn bad" type="button" id="lgq">Quitar logo</button>' : '') + '</div><small class="hint">PNG, JPG o WebP. Se reduce automáticamente.</small></div></div>' +
        '<div class="grid2">' + campo('nombre', 'Nombre de la empresa', e.nombre, { req: true, max: 160 }) + campo('sigla', 'Sigla', e.sigla, { max: 30, hint: 'Se usa en cites y códigos.' }) +
        campo('lema', 'Lema', e.lema, { max: 160 }) + campo('pie_pagina', 'Pie de página', e.pie_pagina, { max: 200 }) +
        '<label class="f"><span>Color principal</span><input type="color" name="color_primario" value="' + esc(e.color_primario || '#3b82f6') + '"></label><label class="f"><span>Color secundario</span><input type="color" name="color_secundario" value="' + esc(e.color_secundario || '#8b5cf6') + '"></label>' +
        campo('direccion', 'Dirección', e.direccion, { max: 200 }) + campo('telefono', 'Teléfono', e.telefono, { max: 40 }) + campo('email', 'Correo de contacto', e.email, { t: 'email', max: 160 }) + campo('sitio_web', 'Sitio web', e.sitio_web, { max: 200 }) +
        campo('drive_carpeta_id', 'Carpeta de Google Drive para archivos', e.drive_carpeta_id, { full: true, hint: 'Pegue el enlace o el ID de la carpeta. Compártala con ' + (d.cuentaPropietaria || 'la cuenta propietaria de la suite') + ' como Editor.' }) + '</div>' +
        '<div class="row"><button class="btn pri" type="submit">Guardar cambios</button></div></form>';
      $('#femp').onsubmit = function (ev) { ev.preventDefault(); var b = $('button[type=submit]', ev.target); b.disabled = true;
        api('empresa.guardar', valores(ev.target)).then(refrescarMarca).then(function () { toast('Empresa actualizada. Los módulos ya usan estos datos.', 'ok'); render(); }).catch(function (er) { b.disabled = false; toast(er.message, 'error'); }); };
      $('#lgu').onclick = function () { $('#lgf').click(); };
      $('#lgf').onchange = function (ev) { var f = ev.target.files[0]; if (!f) return; reducirLogo(f).then(function (uri) { return api('empresa.logo', { data_url: uri }); }).then(refrescarMarca).then(function () { toast('Logo actualizado.', 'ok'); render(); }).catch(function (er) { toast(er.message, 'error'); }); };
      var q = $('#lgq'); if (q) q.onclick = function () { api('empresa.logo', { quitar: true }).then(refrescarMarca).then(function () { toast('Logo eliminado.', 'ok'); render(); }).catch(function (er) { toast(er.message, 'error'); }); };
    });
  }
  function reducirLogo(file) {
    return new Promise(function (res, rej) {
      if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return rej(new Error('Elija una imagen PNG, JPG o WebP.'));
      var url = URL.createObjectURL(file), img = new Image();
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('No se pudo leer la imagen.')); };
      img.onload = function () {
        URL.revokeObjectURL(url); var max = 360;
        for (var i = 0; i < 8; i++) {
          var k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          var uri = file.type === 'image/png' && i < 4 ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', Math.max(.5, .9 - i * .07));
          if (uri.length <= 190000) return res(uri); max = Math.round(max * .75);
        }
        rej(new Error('No fue posible reducir el logo lo suficiente. Use una imagen más simple.'));
      };
      img.src = url;
    });
  }

  function admUsuarios(el) {
    return api('usuarios.listar').then(function (d) {
      var mods = d.modulos.filter(function (m) { return m.estado === 'activo'; });
      var yo = ST.me.usuario.id;
      el.innerHTML = '<div class="panel"><div class="row between" style="margin-bottom:14px"><h3 style="margin:0">Usuarios <span class="mut sm">(' + d.usuarios.filter(function (u) { return u.activo; }).length + ' activos de ' + d.max_usuarios + ')</span></h3><button class="btn pri" id="unew">Nuevo usuario</button></div>' +
        '<p class="mut sm" style="margin-bottom:14px">Marque los módulos que cada persona puede usar. Los cambios se aplican al instante.</p><div class="tw"><table><thead><tr><th>Persona</th><th>Rol</th>' + mods.map(function (m) { return '<th>' + esc((MOD[m.id] || {}).n || m.nombre) + '</th>'; }).join('') + '<th>Estado</th><th></th></tr></thead><tbody>' +
        d.usuarios.map(function (u) {
          return '<tr><td><b>' + esc(u.nombre_completo) + '</b><div class="mut sm">' + esc(u.usuario) + (u.debe_cambiar ? ' · clave temporal' : '') + '</div></td><td>' + (u.rol_id === 'admin_cliente' ? '<span class="pill ok">Administrador</span>' : '<span class="pill">Usuario</span>') + '</td>' +
            mods.map(function (m) { return '<td><input type="checkbox" class="chkm" data-u="' + u.id + '" data-m="' + m.id + '"' + (u.modulos[m.id] ? ' checked' : '') + (!u.activo ? ' disabled' : '') + ' aria-label="' + esc(u.nombre_completo + ' · ' + m.nombre) + '" style="width:18px;height:18px;accent-color:var(--jdi-primary)"></td>'; }).join('') +
            '<td>' + (u.activo ? '<span class="pill ok">Activo</span>' : '<span class="pill bad">Inactivo</span>') + '</td><td><div class="row" style="flex-wrap:nowrap"><button class="btn xs" data-ed="' + u.id + '">Editar</button><button class="btn xs" data-rs="' + u.id + '">Restablecer clave</button></div></td></tr>';
        }).join('') + '</tbody></table></div></div>';
      $('#unew').onclick = function () { dlgUsuarioNuevo(mods); };
      el.onchange = function (ev) { var c = ev.target.closest('.chkm'); if (!c) return; var o = {}; o[c.dataset.m] = c.checked;
        api('usuarios.modulos', { id: c.dataset.u, modulos: o }).then(function () { toast(c.checked ? 'Acceso habilitado.' : 'Acceso retirado.', 'ok'); }).catch(function (e) { c.checked = !c.checked; toast(e.message, 'error'); }); };
      el.onclick = function (ev) {
        var ed = ev.target.closest('[data-ed]'), rs = ev.target.closest('[data-rs]');
        if (ed) dlgUsuarioEditar(d.usuarios.filter(function (u) { return u.id === ed.dataset.ed; })[0], yo);
        if (rs) { var u = d.usuarios.filter(function (x) { return x.id === rs.dataset.rs; })[0];
          dlg({ titulo: 'Restablecer contraseña', html: '<p>Se generará una contraseña temporal para <b>' + esc(u.nombre_completo) + '</b> y se cerrarán sus sesiones abiertas.</p>', botones: [{ t: 'Cancelar' }, { t: 'Restablecer', cls: 'pri', run: function (dd, c) { return api('usuarios.resetClave', { id: u.id }).then(function (r) { c(true); return secreto('Contraseña temporal', r.usuario, r.clave_temporal); }); } }] }); }
      };
    });
  }
  function dlgUsuarioNuevo(mods) {
    dlg({ titulo: 'Nuevo usuario', html: '<div class="grid2">' + campo('nombre_completo', 'Nombre completo', '', { req: true, max: 120 }) + campo('usuario', 'Usuario para ingresar', '', { req: true, max: 60, hint: '4 a 60 caracteres: letras, números, punto o guion.' }) + campo('email', 'Correo (opcional)', '', { t: 'email', max: 160, full: true }) + '</div>' +
      '<p class="sm" style="font-weight:600;margin:4px 0 8px">Módulos habilitados</p>' + (mods.map(function (m) { return '<label class="chk" style="margin-bottom:8px"><input type="checkbox" name="mod_' + m.id + '"> ' + esc((MOD[m.id] || {}).n || m.nombre) + '</label>'; }).join('') || '<p class="mut sm">La empresa no tiene módulos activos.</p>'),
      botones: [{ t: 'Cancelar' }, { t: 'Crear usuario', cls: 'pri', run: function (d, c) { var v = valores(d), ms = mods.filter(function (m) { return v['mod_' + m.id]; }).map(function (m) { return m.id; });
        return api('usuarios.crear', { nombre_completo: v.nombre_completo.trim(), usuario: v.usuario.trim(), email: v.email.trim(), modulos: ms }).then(function (r) { c(true); render(); return secreto('Usuario creado', r.usuario, r.clave_temporal); }); } }] });
  }
  function dlgUsuarioEditar(u, yo) {
    dlg({ titulo: 'Editar usuario', html: campo('nombre_completo', 'Nombre completo', u.nombre_completo, { req: true, max: 120 }) + campo('email', 'Correo', u.email || '', { t: 'email', max: 160 }) +
      '<label class="f"><span>Rol</span><select name="rol"><option value="usuario"' + (u.rol_id === 'usuario' ? ' selected' : '') + '>Usuario</option><option value="admin_cliente"' + (u.rol_id === 'admin_cliente' ? ' selected' : '') + '>Administrador del cliente</option></select></label>' +
      '<label class="chk"><input type="checkbox" name="activo"' + (u.activo ? ' checked' : '') + (u.id === yo ? ' disabled' : '') + '> Usuario activo</label>',
      botones: [{ t: 'Cancelar' }, { t: 'Guardar', cls: 'pri', run: function (d, c) { var v = valores(d), p = { id: u.id, nombre_completo: v.nombre_completo, email: v.email };
        if (u.id !== yo) p.activo = v.activo;
        return api('usuarios.actualizar', p).then(function () { return v.rol !== u.rol_id ? api('usuarios.rol', { id: u.id, rol: v.rol }) : true; }).then(function () { toast('Usuario actualizado.', 'ok'); c(true); render(); }); } }] });
  }

  function admAuditoria(el) {
    return api('auditoria.listar', { limite: 100 }).then(function (r) {
      el.innerHTML = '<div class="panel"><h3>Últimos movimientos</h3>' + (r.length ? '<div class="tw"><table><thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Detalle</th></tr></thead><tbody>' + r.map(function (a) {
        return '<tr><td class="mono" style="white-space:nowrap">' + esc(String(a.creado_en || '').replace('T', ' ').slice(0, 16)) + '</td><td>' + esc(a.usuario) + '</td><td>' + esc(a.accion) + '</td><td class="mut sm">' + esc(JSON.stringify(a.detalle || {}).slice(0, 140)) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="mut">Sin movimientos registrados.</p>') + '</div>';
    });
  }

  /* ---------- SuperAdministrador ---------- */
  function vistaSuper() { return '<section class="hello"><h1>Bienvenido de nuevo, ' + esc((ST.me.usuario.nombre || '').split(/\s+/)[0]) + '</h1><p>Panel del SuperAdministrador: empresas, módulos y suscripciones.</p></section><div id="sup" style="margin-top:24px"><p class="mut">Cargando…</p></div>'; }
  function enlazarSuper() {
    Promise.all([api('sistema.estadisticas'), api('empresas.listar')]).then(function (r) {
      var s = r[0], es = r[1], el = $('#sup');
      el.innerHTML = '<div class="kpis"><div class="kpi"><span>Empresas</span><b>' + s.empresas + '</b></div><div class="kpi"><span>Activas</span><b>' + s.activas + '</b></div><div class="kpi"><span>Suspendidas</span><b>' + s.suspendidas + '</b></div><div class="kpi"><span>Vencen en 30 días</span><b>' + s.vencen_30_dias + '</b></div><div class="kpi"><span>Usuarios activos</span><b>' + s.usuarios_activos + '</b></div></div>' +
        '<div class="panel"><div class="row between" style="margin-bottom:14px"><h3 style="margin:0">Empresas</h3><button class="btn pri" id="enew">Nueva empresa</button></div>' +
        (es.length ? '<div class="tw"><table><thead><tr><th>Empresa</th><th>Estado</th><th>Módulos</th><th>Usuarios</th><th>Vence</th><th></th></tr></thead><tbody>' + es.map(function (e) {
          return '<tr><td><b>' + esc(e.nombre) + '</b><div class="mut sm">' + esc(e.slug) + '</div></td><td>' + pillEstado(e.suscripcion.estado) + '</td><td><div class="mods">' + e.modulos.map(function (m) { return '<span class="pill ' + (m.estado === 'activo' ? 'ok' : 'bad') + '">' + esc((MOD[m.id] || {}).n || m.id) + '</span>'; }).join('') + '</div></td><td class="mono">' + e.usuarios_activos + ' / ' + e.max_usuarios + '</td><td>' + fecha(e.suscripcion_fin) + '</td><td><button class="btn xs" data-e="' + e.id + '">Gestionar</button></td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="empty">Aún no hay empresas. Cree la primera para empezar.</div>') + '</div>';
      $('#enew').onclick = dlgEmpresaNueva;
      el.onclick = function (ev) { var b = ev.target.closest('[data-e]'); if (b) dlgEmpresa(b.dataset.e); };
    }).catch(function (e) { $('#sup').innerHTML = '<div class="err">' + esc(e.message) + '</div>'; });
  }
  function dlgEmpresaNueva() {
    dlg({ titulo: 'Nueva empresa', wide: true, html: '<h3 style="margin-bottom:10px;font-size:.95rem">Empresa</h3><div class="grid2">' + campo('nombre', 'Nombre', '', { req: true, max: 160 }) + campo('slug', 'Identificador', '', { req: true, max: 40, hint: 'Minúsculas, números y guiones. No se puede cambiar.' }) + campo('sigla', 'Sigla', '', { max: 30 }) + campo('suscripcion_fin', 'Vence la suscripción', '', { t: 'date' }) + campo('max_usuarios', 'Máximo de usuarios', '25', { t: 'number' }) + campo('plan', 'Plan', 'estandar', { max: 40 }) + '</div>' +
      '<h3 style="margin:8px 0 10px;font-size:.95rem">Administrador del cliente</h3><div class="grid2">' + campo('adm_nombre', 'Nombre completo', '', { req: true, max: 120 }) + campo('adm_usuario', 'Usuario', '', { req: true, max: 60 }) + campo('adm_email', 'Correo (opcional)', '', { t: 'email', max: 160, full: true }) + '</div>' +
      '<h3 style="margin:8px 0 10px;font-size:.95rem">Módulos contratados</h3><div class="row" style="gap:6px 24px">' + ORDEN.map(function (id) { return '<label class="chk"><input type="checkbox" name="mod_' + id + '"> ' + esc(MOD[id].n) + '</label>'; }).join('') + '</div>',
      botones: [{ t: 'Cancelar' }, { t: 'Crear empresa', cls: 'pri', run: function (d, c) { var v = valores(d), ms = ORDEN.filter(function (id) { return v['mod_' + id]; });
        return api('empresas.crear', { nombre: v.nombre.trim(), slug: v.slug.trim(), sigla: v.sigla.trim(), suscripcion_fin: v.suscripcion_fin, max_usuarios: v.max_usuarios, plan: v.plan, modulos: ms, admin: { nombre_completo: v.adm_nombre.trim(), usuario: v.adm_usuario.trim(), email: v.adm_email.trim() } })
          .then(function (r) { c(true); if (r.avisos && r.avisos.length) toast(r.avisos.join(' '), 'error'); render(); return secreto('Administrador creado', r.admin.usuario, r.admin.clave_temporal); }); } }] });
  }
  function dlgEmpresa(id) {
    api('empresas.obtener', { id: id }).then(function (e) {
      var html = '<div class="row between" style="margin-bottom:12px"><div>' + pillEstado(e.suscripcion.estado) + ' <span class="mut sm">' + esc(e.slug) + '</span></div></div>' +
        '<form id="fe"><div class="grid2">' + campo('nombre', 'Nombre', e.nombre, { max: 160 }) + campo('sigla', 'Sigla', e.sigla, { max: 30 }) + campo('plan', 'Plan', e.plan, { max: 40 }) + campo('max_usuarios', 'Máximo de usuarios', e.max_usuarios, { t: 'number' }) + campo('suscripcion_inicio', 'Inicio de suscripción', (e.suscripcion_inicio || '').slice(0, 10), { t: 'date' }) + campo('suscripcion_fin', 'Vence', (e.suscripcion_fin || '').slice(0, 10), { t: 'date' }) +
        '<label class="f"><span>Estado</span><select name="estado">' + ['activa', 'suspendida', 'vencida'].map(function (x) { return '<option' + (x === e.estado ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></label></div></form>' +
        '<h3 style="margin:10px 0">Módulos</h3><div class="tw"><table><tbody>' + e.modulos.map(function (m) {
          var btn = !m.contratado ? '<button class="btn xs pri" data-hab="' + m.id + '">Habilitar</button>' : m.estado === 'activo' ? '<button class="btn xs bad" data-sus="' + m.id + '">Suspender</button>' : '<button class="btn xs" data-hab="' + m.id + '">Reactivar</button>';
          return '<tr><td><b>' + esc(m.nombre) + '</b></td><td>' + (m.contratado ? pillEstado(m.estado) : '<span class="pill">No contratado</span>') + '</td><td style="text-align:right">' + btn + '</td></tr>'; }).join('') + '</tbody></table></div>' +
        '<p class="mut sm" style="margin:8px 0 14px">Un módulo nuevo toma la marca, configuración y usuarios que la empresa ya tiene.</p>' +
        '<h3 style="margin:10px 0">Administradores</h3>' + e.usuarios.filter(function (u) { return u.rol_id === 'admin_cliente'; }).map(function (u) { return '<div class="row between" style="margin-bottom:8px"><span><b>' + esc(u.nombre_completo) + '</b> <span class="mut sm">' + esc(u.usuario) + (u.activo ? '' : ' · inactivo') + '</span></span><button class="btn xs" data-ra="' + u.id + '">Restablecer clave</button></div>'; }).join('') +
        '<p class="mut sm" style="margin-top:12px">' + e.usuarios.length + ' usuario(s) en total.</p>';
      dlg({ titulo: e.nombre, wide: true, html: html, botones: [{ t: 'Cerrar' }, { t: 'Guardar datos', cls: 'pri', run: function (d, c) { var v = valores($('#fe', d)); v.id = id; return api('empresas.actualizar', v).then(function () { toast('Empresa actualizada.', 'ok'); c(true); render(); }); } }],
        alAbrir: function (d, c) {
          d.addEventListener('click', function (ev) {
            var h = ev.target.closest('[data-hab]'), s = ev.target.closest('[data-sus]'), ra = ev.target.closest('[data-ra]');
            if (h) api('empresas.modulo', { id: id, modulo: h.dataset.hab, accion: 'habilitar', heredar_usuarios: true }).then(function () { toast('Módulo habilitado con la configuración y usuarios de la empresa.', 'ok'); c(true); render(); dlgEmpresa(id); }).catch(function (er) { errEn(d, er); });
            if (s) api('empresas.modulo', { id: id, modulo: s.dataset.sus, accion: 'suspender' }).then(function () { toast('Módulo suspendido.', 'ok'); c(true); render(); dlgEmpresa(id); }).catch(function (er) { errEn(d, er); });
            if (ra) api('empresas.resetAdmin', { empresa_id: id, usuario_id: ra.dataset.ra }).then(function (r) { return secreto('Contraseña temporal', r.usuario, r.clave_temporal); }).catch(function (er) { errEn(d, er); });
          });
        } });
    }).catch(function (er) { toast(er.message, 'error'); });
  }

  /* ---------- arranque ---------- */
  function iniciar() {
    var t = store.get('jdi.token');
    if (!t) return pantallaLogin('');
    ST.token = t;
    api('me').then(function (me) { ST.me = me; aplicarMarca(); entrar(); }).catch(function (e) { if (e.code !== 'SESION') { store.set('jdi.token', null); ST.token = null; pantallaLogin(e.code === 'CONFIG' || e.code === 'RED' ? e.message : ''); } });
  }
  iniciar();
})();
