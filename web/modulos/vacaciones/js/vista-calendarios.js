/* Calendario anual (12 meses) y calendario mensual (nombres por día) */
(function () {
  'use strict';
  const { esc, $, $$ } = App;
  const S = App.S;
  const DIAS_CORTO = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  const DIAS_3 = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  function grupoDe(p) { return S.f.agrupar === 'categoria' ? p.categoria_id : p.area_id; }
  function idxGrupo(p) {
    const lista = S.f.agrupar === 'categoria' ? S.d.categorias : S.d.areas;
    const i = lista.findIndex(x => x.id === grupoDe(p));
    return i < 0 ? 99 : i;
  }
  const colorDe = p => App.colorGrupo(S.f.agrupar === 'categoria' ? 'categoria' : 'area', grupoDe(p));
  const nombreGrupoDe = p => App.nombreGrupo(S.f.agrupar === 'categoria' ? 'categoria' : 'area', grupoDe(p));

  function leyenda() {
    const lista = S.f.agrupar === 'categoria' ? S.d.categorias : S.d.areas;
    const filtradas = lista.filter(x => (S.f.agrupar === 'categoria' ? !S.f.cat || S.f.cat === x.id : !S.f.area || S.f.area === x.id));
    let h = '<div class="leyenda" aria-label="Leyenda de colores">' + filtradas.slice(0, 8).map((x, i) => '<span><i class="punto" style="background:' + App.colorGrupo(S.f.agrupar === 'categoria' ? 'categoria' : 'area', x.id) + '"></i>' + esc(x.nombre) + '</span>').join('');
    if (filtradas.length > 8) h += '<span><i class="punto" style="background:var(--g0)"></i>Otros (' + (filtradas.length - 8) + ')</span>';
    h += '<span><i class="muestra-pend pend"></i>Pendiente de aprobación</span><span><i class="punto medio-ley"></i>½ Medio día</span><span><i class="punto" style="background:var(--holiday);outline:1px solid var(--warn)"></i>Feriado</span></div>';
    return h;
  }

  function barraFiltros(conAgrupar) {
    return '<div class="filtros no-imprimir">' + App.filtrosComunes() +
      (conAgrupar ? '<label class="campo">Colorear por<select data-f="agrupar"><option value="area"' + (S.f.agrupar === 'area' ? ' selected' : '') + '>Área</option><option value="categoria"' + (S.f.agrupar === 'categoria' ? ' selected' : '') + '>Categoría</option></select></label>' : '') +
      '<label class="chk" style="padding-bottom:8px"><input type="checkbox" data-f="pend"' + (S.f.pend ? ' checked' : '') + '>Incluir pendientes</label></div>';
  }
  const filtroOcup = () => ({ area: S.f.area, cat: S.f.cat, soloAprobadas: !S.f.pend });

  function tipDia(iso, lista, fer) {
    const p = iso.split('-');
    const g = {};
    lista.forEach(x => { const k = nombreGrupoDe(x.p); (g[k] = g[k] || { color: colorDe(x.p), idx: idxGrupo(x.p), n: [] }).n.push(App.nombreCorto(x.p) + (App.esCumple(x.s) ? ' (cumpleaños)' : '') + (App.esMedio(x.s, iso) ? ' ½' : '') + (App.esPendiente(x.s) ? ' (pend.)' : '')); });
    let h = '<b>' + App.DIAS[App.dow(iso)] + ' ' + (+p[2]) + ' de ' + App.MESES[+p[1] - 1] + '</b>';
    if (fer) h += '<div>Feriado: ' + esc(fer) + '</div>';
    h += lista.length ? '<div>' + lista.length + (lista.length === 1 ? ' persona de vacación' : ' personas de vacación') + '</div>' : '<div>Sin vacaciones programadas</div>';
    Object.keys(g).sort((a, b) => g[a].idx - g[b].idx).forEach(k => {
      const n = g[k].n;
      h += '<div class="g"><i style="background:' + g[k].color + '"></i><b style="display:inline">' + esc(k) + '</b>: ' + esc(n.slice(0, 10).join(', ')) + (n.length > 10 ? ' y ' + (n.length - 10) + ' más' : '') + '</div>';
    });
    return h;
  }

  /* ---------------- anual ---------------- */
  function mesMini(y, m, ocup, fer, hoy) {
    const total = App.diasMes(y, m), primero = App.dow(App.iso(y, m, 1));
    let celdas = '', pico = 0;
    for (let i = 0; i < primero; i++) celdas += '<div class="dia-mini vacio"></div>';
    for (let d = 1; d <= total; d++) {
      const iso = App.iso(y, m, d), lista = (ocup[iso] || []).slice().sort((a, b) => idxGrupo(a.p) - idxGrupo(b.p) || (App.esPendiente(a.s) ? 1 : 0) - (App.esPendiente(b.s) ? 1 : 0));
      pico = Math.max(pico, lista.length);
      const w = App.dow(iso);
      const cls = ['dia-mini', w >= 5 ? 'fin' : '', fer[iso] ? 'fer' : '', iso === hoy ? 'hoy' : '', lista.length ? 'con' : ''].join(' ');
      const maxSeg = 6;
      const tira = lista.length ? '<div class="tira">' + lista.slice(0, maxSeg).map(x => '<i class="' + (App.esPendiente(x.s) ? 'pend' : '') + (App.esMedio(x.s, iso) ? ' medio' : '') + '" style="background:' + colorDe(x.p) + '"></i>').join('') + (lista.length > maxSeg ? '<i class="mas">+' + (lista.length - maxSeg) + '</i>' : '') + '</div>' : '';
      celdas += '<div class="' + cls + '" data-d="' + iso + '" role="gridcell" aria-label="' + d + ' de ' + App.MESES[m - 1] + (lista.length ? ', ' + lista.length + ' de vacación' : '') + '"><span class="n">' + d + '</span>' + tira + '</div>';
    }
    return '<section class="mes-mini" aria-label="' + App.MESES[m - 1] + '"><h3><a data-mes="' + m + '" title="Ver el mes en detalle">' + App.cap(App.MESES[m - 1]) + '</a><small>' + (pico ? 'máx. ' + pico + ' a la vez' : '') + '</small></h3>' +
      '<div class="sem-cab" aria-hidden="true">' + DIAS_CORTO.map(x => '<span>' + x + '</span>').join('') + '</div><div class="sem-dias" role="grid">' + celdas + '</div></section>';
  }

  App.registrar('anual', {
    titulo: 'Calendario anual',
    render(el) {
      const f = S.f;
      el.innerHTML = App.cabecera('Calendario anual', 'Vacaciones programadas de todo el año, mes por mes.',
        '<button class="btn btn-icon" id="a-prev" aria-label="Año anterior">' + App.ic('izq') + '</button><b id="a-anio" style="font-family:var(--f-display);font-size:1.3rem;min-width:58px;text-align:center">' + f.anio + '</b><button class="btn btn-icon" id="a-next" aria-label="Año siguiente">' + App.ic('der') + '</button>' +
        '<div class="segmentos" role="group" aria-label="Disposición"><button data-cols="3" aria-pressed="' + (f.cols === 3) + '">3 × 4</button><button data-cols="4" aria-pressed="' + (f.cols === 4) + '">4 × 3</button></div>' +
        '<button class="btn" id="a-imp">' + App.ic('imprimir') + 'Imprimir</button>') + barraFiltros(true) + '<div id="a-cont"></div>';
      const dibujar = () => {
        const ocup = App.ocupacion(Object.assign({ anio: f.anio }, filtroOcup())), fer = App.feriadoMapa(), hoy = App.hoy();
        const c = $('#a-cont', el);
        c.innerHTML = '<div class="anual" style="--cols:' + f.cols + '">' + Array.from({ length: 12 }, (_, i) => mesMini(f.anio, i + 1, ocup, fer, hoy)).join('') + '</div>' + leyenda();
        c._ocup = ocup; c._fer = fer;
        $('#a-anio', el).textContent = f.anio;
      };
      App.enlazarFiltros(el, dibujar);
      $('#a-prev', el).onclick = () => { f.anio--; dibujar(); };
      $('#a-next', el).onclick = () => { f.anio++; dibujar(); };
      $('#a-imp', el).onclick = () => window.print();
      $$('[data-cols]', el).forEach(b => b.onclick = () => { f.cols = +b.dataset.cols; $$('[data-cols]', el).forEach(x => x.setAttribute('aria-pressed', x === b)); dibujar(); });
      el.onmousemove = ev => {
        const d = ev.target.closest('.dia-mini[data-d]');
        if (!d) { App.tip.ocultar(); return; }
        const c = $('#a-cont', el);
        App.tip.mostrar(tipDia(d.dataset.d, c._ocup[d.dataset.d] || [], c._fer[d.dataset.d]), ev);
      };
      el.onmouseleave = () => App.tip.ocultar();
      el.onclick = ev => {
        const a = ev.target.closest('[data-mes]'), d = ev.target.closest('.dia-mini.con');
        const m = a ? +a.dataset.mes : d ? +d.dataset.d.slice(5, 7) : 0;
        if (m) { f.mes = m; if (d) f.anio = +d.dataset.d.slice(0, 4); App.tip.ocultar(); App.ir('mensual'); }
      };
      dibujar();
    }
  });

  /* ---------------- mensual ---------------- */
  App.registrar('mensual', {
    titulo: 'Calendario mensual',
    render(el) {
      const f = S.f;
      el.innerHTML = App.cabecera('Calendario mensual', 'Quiénes están de vacación cada día.',
        '<button class="btn btn-icon" id="m-prev" aria-label="Mes anterior">' + App.ic('izq') + '</button><b id="m-titulo" style="font-family:var(--f-display);font-size:1.3rem;min-width:170px;text-align:center"></b><button class="btn btn-icon" id="m-next" aria-label="Mes siguiente">' + App.ic('der') + '</button>' +
        '<button class="btn" id="m-hoy">Hoy</button><button class="btn" id="m-imp">' + App.ic('imprimir') + 'Imprimir</button>') + barraFiltros(true) + '<div id="m-cont"></div>';
      const mover = n => { f.mes += n; if (f.mes < 1) { f.mes = 12; f.anio--; } if (f.mes > 12) { f.mes = 1; f.anio++; } dibujar(); };
      const dibujar = () => {
        const y = f.anio, m = f.mes, hoy = App.hoy(), fer = App.feriadoMapa();
        const ocup = App.ocupacion(filtroOcup());
        $('#m-titulo', el).textContent = App.cap(App.MESES[m - 1]) + ' ' + y;
        const total = App.diasMes(y, m), primero = App.dow(App.iso(y, m, 1));
        const inicioGrid = App.addDias(App.iso(y, m, 1), -primero);
        const semanas = Math.ceil((primero + total) / 7);
        let celdas = '', personas = {}, diasPersona = 0, pico = 0, picoDia = '';
        for (let i = 0; i < semanas * 7; i++) {
          const iso = App.addDias(inicioGrid, i), fuera = iso.slice(5, 7) !== (m < 10 ? '0' : '') + m, w = App.dow(iso);
          const lista = fuera ? [] : (ocup[iso] || []).slice().sort((a, b) => idxGrupo(a.p) - idxGrupo(b.p) || a.p.apellidos.localeCompare(b.p.apellidos, 'es'));
          if (!fuera) { lista.forEach(x => { personas[x.p.id] = 1; }); diasPersona += lista.reduce((a, x) => a + (App.esMedio(x.s, iso) ? 0.5 : 1), 0); if (lista.length > pico) { pico = lista.length; picoDia = iso; } }
          const vacioMob = fuera || (!lista.length && !fer[iso]);
          const nombres = lista.map(x => '<div class="nom' + (App.esPendiente(x.s) ? ' pend' : '') + (App.esMedio(x.s, iso) ? ' medio' : '') + '" style="--c:' + colorDe(x.p) + '" data-sid="' + x.s.id + '" title="' + esc(App.nombreCompleto(x.p) + ' · ' + App.areaNombre(x.p.area_id) + ' · ' + (App.esCumple(x.s) ? 'cumpleaños · ' : '') + (App.esMedio(x.s, iso) ? 'medio día · ' : '') + (App.esPendiente(x.s) ? 'pendiente' : 'aprobada')) + '"><span>' + esc(App.nombreCorto(x.p)) + (App.esCumple(x.s) ? ' <em>cumpl.</em>' : '') + (App.esMedio(x.s, iso) ? ' <em>½</em>' : '') + '</span></div>').join('');
          celdas += '<div class="dia' + (fuera ? ' fuera' : '') + (w >= 5 ? ' fin' : '') + (fer[iso] ? ' fer' : '') + (iso === hoy ? ' hoy' : '') + (vacioMob ? ' vacio-mob' : '') + '" role="gridcell"><div class="dia-cab"><span class="dia-num">' + (+iso.slice(8)) + '</span>' +
            '<span class="dia-mob">' + DIAS_3[w] + '</span>' + (fer[iso] && !fuera ? '<span class="dia-fer">' + esc(fer[iso]) + '</span>' : '') + (lista.length > 1 ? '<span class="dia-cuenta">' + lista.length + ' pers.</span>' : '') + '</div>' + (nombres ? '<div class="nombres">' + nombres + '</div>' : '') + '</div>';
        }
        $('#m-cont', el).innerHTML = '<div class="resumen-mes"><span><b>' + Object.keys(personas).length + '</b> personas con vacación en el mes</span><span><b>' + App.fmtNum(diasPersona) + '</b> días de ausencia en total</span>' +
          (pico ? '<span>Pico: <b>' + pico + '</b> a la vez el ' + App.fmtCorto(picoDia) + '</span>' : '') + '</div>' +
          '<div class="mensual"><div class="mes-cab" aria-hidden="true">' + DIAS_3.map(x => '<span>' + x + '</span>').join('') + '</div><div class="mes-grid" role="grid">' + celdas + '</div></div>' + leyenda();
      };
      App.enlazarFiltros(el, dibujar);
      $('#m-prev', el).onclick = () => mover(-1);
      $('#m-next', el).onclick = () => mover(1);
      $('#m-hoy', el).onclick = () => { f.anio = +App.hoy().slice(0, 4); f.mes = +App.hoy().slice(5, 7); dibujar(); };
      $('#m-imp', el).onclick = () => window.print();
      el.onclick = ev => { const n = ev.target.closest('.nom[data-sid]'); if (n && App.detalleSolicitud) App.detalleSolicitud(n.dataset.sid); };
      dibujar();
    }
  });
})();
