/* Gráficos SVG sin dependencias (barras, barras apiladas, líneas, mapa de calor) */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const G = window.Graficos = {};
  let uid = 0;

  function escalaNice(max) {
    if (max <= 0) return { max: 1, paso: 1 };
    const crudo = max / 4, mag = Math.pow(10, Math.floor(Math.log10(crudo)));
    const norm = crudo / mag, paso = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
    return { max: Math.ceil(max / paso) * paso, paso };
  }
  const f1 = n => Math.round(n * 10) / 10;
  const fmt = n => (Math.abs(n) >= 1000 ? n.toLocaleString('es-BO') : String(f1(n)));

  /** Rectángulo con esquinas redondeadas solo en el extremo de datos. dir: 'arriba' | 'derecha' */
  function barra(x, y, w, h, r, dir, redondear) {
    if (w <= 0 || h <= 0) return '';
    r = redondear ? Math.min(r, w / 2, h) : 0;
    if (!r) return 'M' + x + ',' + y + 'h' + w + 'v' + h + 'h' + (-w) + 'z';
    if (dir === 'arriba') return 'M' + x + ',' + (y + h) + 'V' + (y + r) + 'q0,' + (-r) + ' ' + r + ',' + (-r) + 'h' + (w - 2 * r) + 'q' + r + ',0 ' + r + ',' + r + 'V' + (y + h) + 'z';
    return 'M' + x + ',' + y + 'H' + (x + w - r) + 'q' + r + ',0 ' + r + ',' + r + 'V' + (y + h - r) + 'q0,' + r + ' ' + (-r) + ',' + r + 'H' + x + 'z';
  }

  /** Barras verticales (agrupadas o apiladas). opts: {categorias, series:[{nombre,color,valores}], apilado, alto, unidad} */
  G.barras = function (o) {
    const W = 600, H = o.alto || 260, m = { t: 12, r: 8, b: 30, l: 40 };
    const n = o.categorias.length, ns = o.series.length;
    const totales = o.categorias.map((_, i) => o.apilado ? o.series.reduce((a, s) => a + (s.valores[i] || 0), 0) : Math.max.apply(null, o.series.map(s => s.valores[i] || 0)));
    const esc_ = escalaNice(Math.max.apply(null, totales.concat([1])));
    const pw = W - m.l - m.r, ph = H - m.t - m.b, yv = v => m.t + ph - (v / esc_.max) * ph;
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.aria || 'Gráfico de barras') + '">';
    for (let v = 0; v <= esc_.max + 1e-9; v += esc_.paso) s += '<line class="' + (v === 0 ? 'eje' : 'rej') + '" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + yv(v) + '" y2="' + yv(v) + '"/><text x="' + (m.l - 6) + '" y="' + (yv(v) + 4) + '" text-anchor="end">' + fmt(v) + '</text>';
    const ancho = pw / n, bw = Math.min(o.apilado ? 30 : 22, (ancho * 0.7) / (o.apilado ? 1 : ns));
    o.categorias.forEach((c, i) => {
      const cx = m.l + ancho * i + ancho / 2;
      s += '<text x="' + cx + '" y="' + (H - 10) + '" text-anchor="middle">' + esc(c) + '</text>';
      if (o.apilado) {
        let acum = 0;
        const activas = o.series.map((se, k) => ({ se, k, v: se.valores[i] || 0 })).filter(x => x.v > 0);
        activas.forEach((x, idx) => {
          const y0 = yv(acum + x.v), h = yv(acum) - y0;
          const tip = esc(c + ' · ' + x.se.nombre + ': ' + fmt(x.v) + (o.unidad || ''));
          s += '<path class="sup" data-tip="' + tip + '" style="fill:' + x.se.color + '" d="' + barra(cx - bw / 2, y0, bw, h, 4, 'arriba', idx === activas.length - 1) + '"/>';
          acum += x.v;
        });
      } else {
        const gw = bw * ns + 3 * (ns - 1);
        o.series.forEach((se, k) => {
          const v = se.valores[i] || 0, x = cx - gw / 2 + k * (bw + 3), y0 = yv(v);
          s += '<path data-tip="' + esc(c + ' · ' + se.nombre + ': ' + fmt(v) + (o.unidad || '')) + '" style="fill:' + se.color + '" d="' + barra(x, y0, bw, yv(0) - y0, 4, 'arriba', true) + '"/>';
        });
      }
    });
    return s + '</svg>';
  };

  /** Barras horizontales de una serie. opts: {categorias, valores, color, unidad} */
  G.barrasH = function (o) {
    const fila = 28, W = 600, m = { t: 4, r: 46, b: 22, l: o.margen || 150 }, n = o.categorias.length, H = m.t + m.b + fila * n;
    const esc_ = escalaNice(Math.max.apply(null, o.valores.concat([1])));
    const pw = W - m.l - m.r, xv = v => m.l + (v / esc_.max) * pw;
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.aria || 'Gráfico de barras') + '">';
    for (let v = 0; v <= esc_.max + 1e-9; v += esc_.paso) s += '<line class="' + (v === 0 ? 'eje' : 'rej') + '" x1="' + xv(v) + '" x2="' + xv(v) + '" y1="' + m.t + '" y2="' + (H - m.b) + '"/><text x="' + xv(v) + '" y="' + (H - 6) + '" text-anchor="middle">' + fmt(v) + '</text>';
    o.categorias.forEach((c, i) => {
      const y = m.t + fila * i + 6, h = fila - 12, v = o.valores[i] || 0;
      const nombre = c.length > 24 ? c.slice(0, 23) + '…' : c;
      const col = Array.isArray(o.color) ? o.color[i] : o.color;
      s += '<text x="' + (m.l - 8) + '" y="' + (y + h / 2 + 4) + '" text-anchor="end">' + esc(nombre) + '</text>';
      s += '<path data-tip="' + esc(c + ': ' + fmt(v) + (o.unidad || '')) + '" style="fill:' + col + '" d="' + barra(m.l, y, Math.max(xv(v) - m.l, 0), h, 4, 'derecha', true) + '"/>';
      s += '<text x="' + (xv(v) + 6) + '" y="' + (y + h / 2 + 4) + '" style="fill:var(--ink-2);font-weight:600">' + fmt(v) + '</text>';
    });
    return s + '</svg>';
  };

  /** Línea/área de una serie con cursor. opts: {valores, etiquetas (texto por punto), marcas:[{i,txt}], color, alto, unidad} */
  G.linea = function (o) {
    const W = 600, H = o.alto || 240, m = { t: 12, r: 10, b: 28, l: 36 }, n = o.valores.length, id = 'ln' + (++uid);
    const esc_ = escalaNice(Math.max.apply(null, o.valores.concat([1])));
    const pw = W - m.l - m.r, ph = H - m.t - m.b, xv = i => m.l + (n > 1 ? (i / (n - 1)) * pw : 0), yv = v => m.t + ph - (v / esc_.max) * ph;
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.aria || 'Gráfico de líneas') + '" data-linea="' + id + '">';
    for (let v = 0; v <= esc_.max + 1e-9; v += esc_.paso) s += '<line class="' + (v === 0 ? 'eje' : 'rej') + '" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + yv(v) + '" y2="' + yv(v) + '"/><text x="' + (m.l - 6) + '" y="' + (yv(v) + 4) + '" text-anchor="end">' + fmt(v) + '</text>';
    (o.marcas || []).forEach(k => { s += '<text x="' + xv(k.i) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(k.txt) + '</text>'; });
    let d = '';
    o.valores.forEach((v, i) => { d += (i ? 'L' : 'M') + f1(xv(i)) + ',' + f1(yv(v)); });
    s += '<path d="' + d + 'L' + xv(n - 1) + ',' + yv(0) + 'L' + xv(0) + ',' + yv(0) + 'Z" style="fill:' + o.color + ';opacity:.16"/>';
    s += '<path d="' + d + '" style="fill:none;stroke:' + o.color + ';stroke-width:2;stroke-linejoin:round"/>';
    s += '<g class="cursor" hidden><line class="eje" y1="' + m.t + '" y2="' + (H - m.b) + '" style="stroke:var(--ink-3)"/><circle r="4.5" style="fill:' + o.color + ';stroke:var(--surface);stroke-width:2"/></g>';
    s += '<rect class="zona" x="' + m.l + '" y="' + m.t + '" width="' + pw + '" height="' + ph + '" style="fill:transparent" data-n="' + n + '" data-x0="' + m.l + '" data-pw="' + pw + '" data-h="' + H + '" data-m="' + m.t + ',' + m.b + '" data-max="' + esc_.max + '" data-vals="' + o.valores.join(',') + '" data-tips="' + esc(o.etiquetas.join('|')) + '"/>';
    return s + '</svg>';
  };

  /** Mapa de calor HTML. opts: {filas:[txt], columnas:[txt], matriz:[[n]], color:'var(--g1)'} */
  G.calor = function (o) {
    const max = Math.max.apply(null, [].concat.apply([], o.matriz).concat([1]));
    let h = '<div style="overflow-x:auto"><table class="heat"><thead><tr><th></th>' + o.columnas.map(c => '<th>' + esc(c) + '</th>').join('') + '<th>Total</th></tr></thead><tbody>';
    o.filas.forEach((f, i) => {
      const tot = o.matriz[i].reduce((a, b) => a + b, 0);
      h += '<tr><th class="fila">' + esc(f) + '</th>' + o.matriz[i].map((v, j) => {
        const r = v / max, fondo = v ? 'color-mix(in srgb, ' + o.color + ' ' + Math.round(10 + r * 80) + '%, var(--surface))' : 'var(--surface-2)';
        return '<td style="background:' + fondo + ';color:' + (r > .55 ? '#fff' : 'var(--ink)') + '" data-tip="' + esc(f + ' · ' + o.columnas[j] + ': ' + v + ' días') + '">' + (v || '') + '</td>';
      }).join('') + '<td style="font-weight:700">' + tot + '</td></tr>';
    });
    return h + '</tbody></table></div>';
  };

  G.leyenda = series => '<div class="leyenda">' + series.map(s => '<span><i class="punto" style="background:' + s.color + '"></i>' + esc(s.nombre) + '</span>').join('') + '</div>';

  G.tabla = function (categorias, series, unidad) {
    return '<div class="tabla-wrap"><table class="tabla"><thead><tr><th></th>' + series.map(s => '<th class="der">' + esc(s.nombre) + '</th>').join('') + '</tr></thead><tbody>' +
      categorias.map((c, i) => '<tr><td>' + esc(c) + '</td>' + series.map(s => '<td class="der num">' + fmt(s.valores[i] || 0) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
  };

  /** Tarjeta con título, leyenda, gráfico y botón para ver como tabla. */
  G.tarjeta = function (o) {
    return '<section class="panel grafico"><div class="barra"><div><h3>' + esc(o.titulo) + '</h3>' + (o.desc ? '<div class="desc">' + esc(o.desc) + '</div>' : '') + '</div>' +
      (o.tabla ? '<button class="btn btn-ghost btn-sm" type="button" data-vertabla aria-pressed="false" title="Alternar entre gráfico y tabla">' + (window.App ? App.ic('tabla') : '') + 'Tabla</button>' : '') + '</div>' +
      (o.leyenda || '') + '<div class="vista-grafico">' + o.svg + '</div>' + (o.tabla ? '<div class="tabla-vista" hidden>' + o.tabla + '</div>' : '') + '</section>';
  };

  /** Conecta tooltips y alternancia gráfico/tabla dentro de un contenedor. */
  G.enlazar = function (el) {
    el.addEventListener('mouseover', ev => { const t = ev.target.closest('[data-tip]'); if (t) App.tip.mostrar(esc(t.getAttribute('data-tip')), ev); });
    el.addEventListener('mousemove', ev => {
      const t = ev.target.closest('[data-tip]');
      if (t) { App.tip.mostrar(esc(t.getAttribute('data-tip')), ev); return; }
      const z = ev.target.closest('.zona');
      if (!z) return;
      const svg = z.ownerSVGElement, r = svg.getBoundingClientRect(), W = svg.viewBox.baseVal.width, sc = r.width / W;
      const n = +z.dataset.n, x0 = +z.dataset.x0, pw = +z.dataset.pw, H = +z.dataset.h, mm = z.dataset.m.split(',').map(Number), max = +z.dataset.max;
      const px = (ev.clientX - r.left) / sc;
      const i = Math.max(0, Math.min(n - 1, Math.round(((px - x0) / pw) * (n - 1))));
      const vals = z.dataset.vals.split(',').map(Number), tips = z.dataset.tips.split('|');
      const cx = x0 + (n > 1 ? (i / (n - 1)) * pw : 0), cy = mm[0] + (H - mm[0] - mm[1]) - (vals[i] / max) * (H - mm[0] - mm[1]);
      const cur = svg.querySelector('.cursor');
      cur.hidden = false;
      cur.querySelector('line').setAttribute('x1', cx); cur.querySelector('line').setAttribute('x2', cx);
      cur.querySelector('circle').setAttribute('cx', cx); cur.querySelector('circle').setAttribute('cy', cy);
      App.tip.mostrar('<b>' + esc(tips[i]) + '</b>' + vals[i] + ' ' + (z.dataset.unidad || 'personas'), ev);
    });
    el.addEventListener('mouseout', ev => {
      App.tip.ocultar();
      const z = ev.target.closest && ev.target.closest('.zona');
      if (z) { const c = z.ownerSVGElement.querySelector('.cursor'); if (c) c.hidden = true; }
    });
    el.addEventListener('click', ev => {
      const b = ev.target.closest('[data-vertabla]');
      if (!b) return;
      const card = b.closest('.grafico'), ver = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', ver);
      card.querySelector('.vista-grafico').hidden = ver;
      card.querySelector('.tabla-vista').hidden = !ver;
    });
  };
})();
