/* Inicio: saldo propio, pendientes por resolver, quién está fuera */
(function () {
  'use strict';
  const { esc, $, $$ } = App;

  function saludo() {
    const h = new Date().getHours();
    return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  }

  function panelSaldo(p, s) {
    const g = s.gestiones.slice(-5).reverse();
    const filas = g.map(x => {
      const usado = x.dias ? Math.round((x.usados / x.dias) * 100) : 0;
      return '<tr><td>Año ' + x.n + '</td><td class="num">' + App.fmtFecha(x.fecha) + '</td><td class="der num">' + App.fmtNum(x.dias) + '</td><td class="der num">' + App.fmtNum(x.usados) + '</td>' +
        '<td class="der num"><b>' + x.restante + '</b></td><td style="min-width:110px"><div class="barra-gestion" title="' + usado + '% usado"><i style="width:' + usado + '%;background:var(--brand)"></i></div>' +
        (x.vencido ? '<span class="small" style="color:var(--crit)">' + x.vencido + ' vencidos</span>' : '') + '</td></tr>';
    }).join('');
    const extra = s.gestiones.length > 5 ? '<p class="small muted" style="margin:8px 0 0">Se muestran las últimas 5 gestiones de ' + s.gestiones.length + '.</p>' : '';
    return '<section class="panel"><h2>Mi saldo de vacaciones</h2><div class="saldo-hero"><div class="cifra">' + App.fmtNum(s.disponible) + '<small>días</small></div>' +
      '<div class="desglose"><div><b>' + s.derecho + '</b><span>generados en total</span></div><div><b>' + (s.aprobados + s.usados_previos) + '</b><span>tomados o aprobados</span></div><div><b>' + s.pendientes + '</b><span>en trámite</span></div>' +
      '<div><b>' + s.vencidos + '</b><span>vencidos</span></div></div></div>' +
      '<p class="muted small" style="margin:12px 0 6px">Antigüedad reconocida: <b>' + App.antig(s.total_meses) + '</b>' + (s.previos_meses ? ' (incluye ' + App.antig(s.previos_meses) + ' de servicio previo)' : '') + '.</p>' +
      (g.length ? '<div class="tabla-wrap" style="margin-top:10px"><table class="tabla"><thead><tr><th>Gestión</th><th>Desde</th><th class="der">Días</th><th class="der">Usados</th><th class="der">Quedan</th><th></th></tr></thead><tbody>' + filas + '</tbody></table></div>' + extra
        : '<div class="aviso info" style="margin-top:10px">' + App.ic('info') + '<span>Todavía no cumple el primer año de servicio, por lo que aún no genera días de vacación.</span></div>') +
      '<div style="margin-top:14px"><button class="btn btn-primary" data-act="nueva">' + App.ic('mas') + 'Solicitar vacaciones</button></div></section>';
  }

  function panelPendientes() {
    const lista = App.S.d.solicitudes.filter(App.puedeDecidir).sort((a, b) => (a.inicio < b.inicio ? -1 : 1));
    if (!App.esGestor()) return '';
    const items = lista.slice(0, 6).map(s => {
      const p = App.persona(s.persona_id);
      return '<li><div class="persona">' + App.avatar(p) + '<div><b>' + esc(App.nombreCompleto(p)) + '</b><small>' + App.fmtRango(s.inicio, s.fin) + ' · ' + App.fmtNum(s.dias) + ' días' + (App.esCumple(s) ? ' · cumpleaños' : '') + '</small></div></div>' +
        '<div class="acciones"><button class="btn btn-sm btn-primary" data-act="aprobar" data-id="' + s.id + '">Aprobar</button><button class="btn btn-sm" data-act="rechazar" data-id="' + s.id + '">Rechazar</button></div></li>';
    }).join('');
    return '<section class="panel"><h2>Por resolver' + (lista.length ? ' <span class="chip">' + lista.length + '</span>' : '') + '</h2>' +
      (items ? '<ul class="lista-simple">' + items + '</ul>' + (lista.length > 6 ? '<p class="small muted" style="margin:8px 0 0">Hay ' + (lista.length - 6) + ' más en <a href="#/solicitudes">Solicitudes</a>.</p>' : '')
        : '<div class="vacio"><b>Todo al día</b>No hay solicitudes esperando su decisión.</div>') + '</section>';
  }

  function panelFuera() {
    const hoy = App.hoy(), fin = App.addDias(hoy, 14);
    const ocup = App.S.d.solicitudes.filter(s => s.estado === 'APROBADA');
    const ahora = ocup.filter(s => s.inicio <= hoy && s.fin >= hoy);
    const prox = ocup.filter(s => s.inicio > hoy && s.inicio <= fin).sort((a, b) => (a.inicio < b.inicio ? -1 : 1));
    const li = (s, txt) => { const p = App.persona(s.persona_id); return '<li><div class="persona">' + App.avatar(p) + '<div><b>' + esc(App.nombreCompleto(p)) + '</b><small>' + esc(App.areaNombre(p.area_id)) + '</small></div></div><span class="small muted">' + txt + '</span></li>'; };
    return '<section class="panel"><h2>Fuera de la oficina</h2><h3 class="small muted" style="margin:0 0 4px;font-family:var(--f-body);font-weight:600">Hoy</h3>' +
      (ahora.length ? '<ul class="lista-simple">' + ahora.map(s => li(s, 'vuelve el ' + App.fmtCorto(App.addDias(s.fin, 1)))).join('') + '</ul>' : '<p class="muted" style="margin:0 0 6px">Nadie con vacación hoy.</p>') +
      '<h3 class="small muted" style="margin:14px 0 4px;font-family:var(--f-body);font-weight:600">Próximos 14 días</h3>' +
      (prox.length ? '<ul class="lista-simple">' + prox.map(s => li(s, 'desde el ' + App.fmtCorto(s.inicio))).join('') + '</ul>' : '<p class="muted" style="margin:0">Sin salidas programadas.</p>') + '</section>';
  }

  function panelCumples() {
    const hoy = App.hoy(), y = +hoy.slice(0, 4), out = [];
    App.S.d.personal.forEach(p => {
      if (p.restringido || !p.fecha_nacimiento || p.activo === 'NO') return;
      const [, m, d] = p.fecha_nacimiento.split('-');
      let f = y + '-' + m + '-' + d;
      if (f < hoy) f = (y + 1) + '-' + m + '-' + d;
      const dif = App.difDias(hoy, f);
      if (dif <= 30) out.push({ p, f, dif });
    });
    out.sort((a, b) => a.dif - b.dif);
    if (!out.length) return '';
    return '<section class="panel"><h2>Cumpleaños del mes</h2><ul class="lista-simple">' + out.slice(0, 6).map(x =>
      '<li><div class="persona">' + App.avatar(x.p) + '<div><b>' + esc(App.nombreCompleto(x.p)) + '</b><small>' + esc(App.areaNombre(x.p.area_id)) + '</small></div></div><span class="small muted">' + (x.dif === 0 ? 'hoy' : App.fmtCorto(x.f)) + '</span></li>').join('') + '</ul></section>';
  }

  function panelMisSolicitudes() {
    const pid = App.S.user.persona_id;
    if (!pid) return '';
    const mias = App.S.d.solicitudes.filter(s => s.persona_id === pid).sort((a, b) => (a.inicio < b.inicio ? 1 : -1)).slice(0, 4);
    return '<section class="panel"><h2>Mis solicitudes</h2>' + (mias.length ? '<ul class="lista-simple">' + mias.map(s =>
      '<li><div><b>' + App.fmtRango(s.inicio, s.fin) + '</b><div class="small muted">' + App.fmtNum(s.dias) + ' días' + (App.esCumple(s) ? ' · cumpleaños' : '') + (s.motivo ? ' · ' + esc(s.motivo) : '') + '</div></div>' + App.badge(s.estado) + '</li>').join('') + '</ul>' :
      '<div class="vacio"><b>Aún no hay solicitudes</b>Cuando pida vacaciones aparecerán aquí con su estado.</div>') + '</section>';
  }

  function panelResumen() {
    const d = App.S.d, act = d.personal.filter(p => p.activo !== 'NO').length, hoy = App.hoy();
    const fuera = d.solicitudes.filter(s => s.estado === 'APROBADA' && s.inicio <= hoy && s.fin >= hoy).length;
    const pend = d.solicitudes.filter(App.esPendiente).length;
    return '<section class="panel"><h2>Resumen de hoy</h2><div class="desglose"><div><b>' + act + '</b><span>personas activas</span></div><div><b>' + fuera + '</b><span>de vacación hoy</span></div><div><b>' + pend + '</b><span>solicitudes en trámite</span></div></div></section>';
  }

  App.registrar('inicio', {
    titulo: 'Inicio',
    render(el) {
      const d = App.S.d, u = App.S.user, yo = App.persona(u.persona_id), s = d.saldos[u.persona_id];
      el.innerHTML = App.cabecera(saludo() + (yo ? ', ' + yo.nombres.split(' ')[0] : ''), App.cap(App.DIAS[App.dow(d.hoy)]) + ' ' + App.fmtLargo(d.hoy) + ' · ' + esc(d.config.institucion)) +
        '<div class="rejilla rej-2" style="align-items:start"><div class="rejilla">' + (s ? panelSaldo(yo, s) : panelResumen()) + panelMisSolicitudes() + '</div>' +
        '<div class="rejilla">' + panelPendientes() + panelFuera() + panelCumples() + '</div></div>';
      el.addEventListener('click', async ev => {
        const b = ev.target.closest('[data-act]');
        if (!b) return;
        if (b.dataset.act === 'nueva') App.nuevaSolicitud();
        else App.decidir(b.dataset.id, b.dataset.act === 'aprobar' ? 'APROBAR' : 'RECHAZAR');
      });
    }
  });
})();
