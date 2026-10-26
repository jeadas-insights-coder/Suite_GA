/* Análisis de la programación de vacaciones */
(function () {
  'use strict';
  const { esc, $, $$ } = App;
  const S = App.S;
  const MES3 = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  function datos() {
    const f = S.f, d = S.d, y = f.anio;
    const enFiltro = p => (!f.area || p.area_id === f.area) && (!f.cat || p.categoria_id === f.cat);
    const personas = d.personal.filter(p => p.activo !== 'NO' && enFiltro(p));
    const sols = d.solicitudes.filter(s => App.ocupa(s) && (f.pend || s.estado === 'APROBADA') && enFiltro(App.persona(s.persona_id) || {}) && App.persona(s.persona_id) && App.persona(s.persona_id).activo !== 'NO');
    const ocup = {};
    let diasAprob = 0, diasPend = 0;
    const porMesArea = {}, porCat = {}, areaMes = {}, personasCon = {};
    sols.forEach(s => {
      const p = App.persona(s.persona_id);
      (s.fechas || []).forEach(fe => {
        if (fe.slice(0, 4) !== String(y)) return;
        (ocup[fe] = ocup[fe] || []).push(s);
        const m = +fe.slice(5, 7) - 1, peso = App.esMedio(s, fe) ? 0.5 : 1;
        if (App.esCumple(s)) return; // el permiso de cumpleaños no se cuenta como vacación
        (porMesArea[p.area_id] = porMesArea[p.area_id] || Array(12).fill(0))[m] += peso;
        porCat[p.categoria_id] = (porCat[p.categoria_id] || 0) + peso;
        personasCon[p.id] = 1;
        if (s.estado === 'APROBADA') diasAprob += peso; else diasPend += peso;
      });
    });
    let pico = 0, picoDia = '';
    Object.keys(ocup).forEach(k => { if (ocup[k].length > pico) { pico = ocup[k].length; picoDia = k; } });
    return { personas, sols, ocup, diasAprob, diasPend, porMesArea, porCat, personasCon, pico, picoDia, enFiltro };
  }

  function vencimiento(p, s) {
    const M = Number(S.d.config.max_gestiones_acumulables) || 0;
    if (!M) return null;
    const g = s.gestiones.find(x => x.restante > 0);
    if (!g) return null;
    const idxVig = s.gestiones.length - M;
    if (g.n <= idxVig) return null;
    return { dias: g.restante, fecha: addMeses(p.fecha_ingreso, 12 * (g.n + M)) };
  }
  function addMeses(s, n) {
    const p = s.split('-').map(Number), t = p[0] * 12 + p[1] - 1 + n, y = Math.floor(t / 12), m = t % 12, ult = App.diasMes(y, m + 1);
    return App.iso(y, m + 1, Math.min(p[2], ult));
  }

  function dibujar(el) {
    const f = S.f, d = S.d, D = datos(), y = f.anio;
    const sinDatos = !D.personas.length;
    const kpi = (n, t) => '<div class="kpi"><b>' + n + '</b><span>' + t + '</span></div>';
    const conProg = D.personas.filter(p => D.personasCon[p.id]).length;
    const saldos = D.personas.map(p => ({ p, s: d.saldos[p.id] })).filter(x => x.s);
    const prom = saldos.length ? Math.round(saldos.reduce((a, x) => a + Math.max(0, x.s.disponible), 0) / saldos.length * 10) / 10 : null;
    const pendientes = d.solicitudes.filter(s => App.esPendiente(s) && D.enFiltro(App.persona(s.persona_id) || {})).length;
    let h = '<div class="kpis">' + kpi(D.personas.length, 'personas activas') + kpi(conProg + ' <span style="font-size:1rem;color:var(--ink-3)">(' + (D.personas.length ? Math.round(conProg / D.personas.length * 100) : 0) + '%)</span>', 'con vacaciones programadas en ' + y) +
      kpi(App.fmtNum(D.diasAprob + D.diasPend), 'días de vacación programados (' + App.fmtNum(D.diasPend) + ' sin aprobar)') + kpi(D.pico ? D.pico + ' <span style="font-size:1rem;color:var(--ink-3)">' + App.fmtCorto(D.picoDia) + '</span>' : '0', 'máximo de personas ausentes a la vez') +
      kpi(prom === null ? '—' : prom, 'saldo promedio por persona (días)') + kpi(pendientes, 'solicitudes por resolver') + '</div>';
    if (sinDatos) return h + '<div class="panel vacio"><b>No hay personal para analizar</b>Registre personal o cambie los filtros.</div>';

    /* 1. días por mes y área (apilado) */
    const areas = d.areas.filter(a => D.porMesArea[a.id]);
    const series = areas.slice(0, 7).map(a => ({ nombre: a.nombre, color: App.colorGrupo('area', a.id), valores: D.porMesArea[a.id] }));
    if (areas.length > 7) {
      const otras = Array(12).fill(0); areas.slice(7).forEach(a => D.porMesArea[a.id].forEach((v, i) => { otras[i] += v; }));
      series.push({ nombre: 'Otras áreas', color: 'var(--g0)', valores: otras });
    }
    if (!series.length) series.push({ nombre: 'Sin programación', color: 'var(--g1)', valores: Array(12).fill(0) });
    const g1 = G().tarjeta({ titulo: 'Días de vacación por mes', desc: 'Total de días programados cada mes, según el área.', leyenda: series.length > 1 ? G().leyenda(series) : '',
      svg: G().barras({ categorias: MES3, series, apilado: true, unidad: ' días', aria: 'Días de vacación por mes y área' }), tabla: G().tabla(MES3, series) });

    /* 2. ausentes por día hábil */
    const vals = [], tips = [], marcas = [];
    let mesPrev = 0;
    for (let m = 1; m <= 12; m++) for (let dd = 1; dd <= App.diasMes(y, m); dd++) {
      const iso = App.iso(y, m, dd);
      if (App.dow(iso) > 4) continue;
      if (m !== mesPrev) { marcas.push({ i: vals.length, txt: MES3[m - 1] }); mesPrev = m; }
      vals.push((D.ocup[iso] || []).length); tips.push(App.DIAS[App.dow(iso)] + ' ' + App.fmtFecha(iso));
    }
    const g2 = G().tarjeta({ titulo: 'Personas ausentes por día', desc: 'Cuántas personas están de vacación cada día hábil. Sirve para ver los meses con más riesgo de falta de personal.',
      svg: G().linea({ valores: vals, etiquetas: tips, marcas, color: 'var(--g1)', aria: 'Personas ausentes por día hábil' }).replace('class="zona"', 'class="zona" data-unidad="personas"') });

    /* 3. por categoría */
    const cats = d.categorias.filter(c => D.porCat[c.id]).sort((a, b) => D.porCat[b.id] - D.porCat[a.id]);
    const g3 = G().tarjeta({ titulo: 'Días programados por categoría', desc: 'Dónde se concentran las vacaciones.',
      svg: cats.length ? G().barrasH({ categorias: cats.map(c => c.nombre), valores: cats.map(c => D.porCat[c.id]), color: 'var(--g1)', unidad: ' días', aria: 'Días por categoría' }) : '<div class="vacio">Sin vacaciones programadas en ' + y + '.</div>',
      tabla: G().tabla(cats.map(c => c.nombre), [{ nombre: 'Días', valores: cats.map(c => D.porCat[c.id]) }]) });

    /* 4. antigüedad */
    const tramos = [['Menos de 1 año', 0, 12], ['1 a 5 años', 12, 60], ['5 a 10 años', 60, 120], ['10 años o más', 120, 1e9]];
    const cuenta = tramos.map(t => saldos.filter(x => x.s.total_meses >= t[1] && x.s.total_meses < t[2]).length);
    const g4 = G().tarjeta({ titulo: 'Personal según antigüedad', desc: 'Antigüedad reconocida para calcular vacaciones.',
      svg: G().barras({ categorias: ['< 1 año', '1 a 5', '5 a 10', '10 o más'], series: [{ nombre: 'Personas', color: 'var(--g3)', valores: cuenta }], unidad: ' personas', alto: 220, aria: 'Personal por tramo de antigüedad' }),
      tabla: G().tabla(tramos.map(t => t[0]), [{ nombre: 'Personas', valores: cuenta }]) });

    /* 5. mapa de calor área x mes */
    const filasA = d.areas.filter(a => (!f.area || a.id === f.area));
    const matriz = filasA.map(a => D.porMesArea[a.id] || Array(12).fill(0));
    const g5 = '<section class="panel grafico"><h3>Días de vacación por área y mes</h3><div class="desc">Cuanto más oscuro el recuadro, más días programados.</div>' + G().calor({ filas: filasA.map(a => a.nombre), columnas: MES3, matriz, color: 'var(--g1)' }) + '</section>';

    /* 6. saldo alto / en riesgo */
    const riesgo = saldos.map(x => ({ p: x.p, s: x.s, v: vencimiento(x.p, x.s), prog: D.personasCon[x.p.id] ? 1 : 0 }))
      .filter(x => x.s.disponible >= 10 || (x.v && x.v.dias > 0))
      .sort((a, b) => (a.v && b.v ? (a.v.fecha < b.v.fecha ? -1 : 1) : a.v ? -1 : b.v ? 1 : b.s.disponible - a.s.disponible)).slice(0, 10);
    const g6 = '<section class="panel"><h3 style="margin-bottom:2px">Saldos por usar</h3><div class="desc muted small" style="margin-bottom:10px">Personas con muchos días acumulados. Si la institución limita las gestiones acumulables, se indica cuándo se pierden.</div>' +
      (riesgo.length ? '<div class="tabla-wrap"><table class="tabla"><thead><tr><th>Persona</th><th class="der">Disponible</th><th>Se pierden</th><th>Programado en ' + y + '</th></tr></thead><tbody>' + riesgo.map(x => '<tr><td><div class="persona">' + App.avatar(x.p) + '<div><b>' + esc(App.nombreCompleto(x.p)) + '</b><small>' + esc(App.areaNombre(x.p.area_id)) + '</small></div></div></td>' +
        '<td class="der num"><b>' + Math.max(0, x.s.disponible) + '</b></td><td>' + (x.v ? '<span class="badge pendiente">' + App.ic('reloj') + x.v.dias + ' días el ' + App.fmtFecha(x.v.fecha) + '</span>' : '<span class="muted small">—</span>') + '</td><td>' + (x.prog ? 'Sí' : '<span class="muted">No</span>') + '</td></tr>').join('') + '</tbody></table></div>'
        : '<div class="vacio"><b>Sin saldos preocupantes</b>Nadie tiene 10 días o más por usar.</div>') + '</section>';

    return h + '<div id="an-g" class="rejilla"><div class="rejilla rej-2" style="align-items:start">' + g1 + g2 + '</div><div class="rejilla rej-2" style="align-items:start">' + g3 + g4 + '</div>' + g5 + g6 + '</div>';
  }
  const G = () => window.Graficos;

  App.registrar('analisis', {
    titulo: 'Análisis',
    render(el) {
      const f = S.f, anios = [];
      const hoyY = +App.hoy().slice(0, 4);
      for (let a = hoyY - 2; a <= hoyY + 2; a++) anios.push(a);
      if (anios.indexOf(f.anio) < 0) anios.push(f.anio);
      el.innerHTML = App.cabecera('Análisis de la programación', 'Cómo se distribuyen las vacaciones y dónde conviene actuar.', '<button class="btn" id="an-imp">' + App.ic('imprimir') + 'Imprimir</button>') +
        '<div class="filtros"><label class="campo" style="min-width:110px">Año<select data-f="anio">' + anios.sort().map(a => '<option' + (a === f.anio ? ' selected' : '') + '>' + a + '</option>').join('') + '</select></label>' + App.filtrosComunes() +
        '<label class="chk" style="padding-bottom:8px"><input type="checkbox" data-f="pend"' + (f.pend ? ' checked' : '') + '>Incluir pendientes</label></div><div id="an-cont"></div>';
      const redibujar = () => { S.f.anio = +S.f.anio; $('#an-cont', el).innerHTML = dibujar(el); const g = $('#an-g', el); if (g) G().enlazar(g); App.pintarFotos(); };
      App.enlazarFiltros(el, redibujar);
      $('#an-imp', el).onclick = () => window.print();
      redibujar();
    }
  });
})();
