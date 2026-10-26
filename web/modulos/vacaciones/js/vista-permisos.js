/* Permisos por rol: matriz acceso × rol con casillas. Solo para quien tenga "permisos_editar". */
(function () {
  'use strict';
  const { esc, $, $$ } = App;
  const S = App.S;
  const ROLES = [['ADMIN', 'Administrador'], ['JEFE', 'Jefe de área'], ['PERSONAL', 'Personal'], ['PROPIETARIO', 'Propietario']];

  App.registrar('permisos', {
    titulo: 'Permisos por rol',
    render(el) {
      const original = S.d.permisos_matriz, catalogo = S.d.permisos_catalogo;
      const m = JSON.parse(JSON.stringify(original));
      const modulos = [];
      catalogo.forEach(p => { if (modulos.indexOf(p.modulo) < 0) modulos.push(p.modulo); });

      const filas = modulos.map(mod => '<tr><th colspan="5" style="background:var(--surface-2)">' + esc(mod) + '</th></tr>' +
        catalogo.filter(p => p.modulo === mod).map(p => '<tr><td><b>' + esc(p.etiqueta) + '</b>' + (p.ayuda ? '<small class="muted" style="display:block">' + esc(p.ayuda) + '</small>' : '') + '</td>' +
          ROLES.map(r => '<td style="text-align:center"><input type="checkbox" data-r="' + r[0] + '" data-k="' + p.clave + '"' + (m[r[0]][p.clave] ? ' checked' : '') +
            (r[0] === 'ADMIN' || p.fijo_admin ? ' disabled' : '') + ' aria-label="' + esc(p.etiqueta + ' — ' + r[1]) + '"></td>').join('') + '</tr>').join('')).join('');

      el.innerHTML = App.cabecera('Permisos por rol', 'Marque qué puede hacer cada rol. Los cambios se aplican de inmediato en el servidor.',
        '<button class="btn" id="pm-descartar" disabled>Descartar</button><button class="btn btn-primary" id="pm-guardar" disabled>Guardar</button>') +
        '<div class="aviso info" style="margin-bottom:14px">' + App.ic('info') + '<span>El administrador siempre conserva todos los accesos. Gestionar usuarios y esta matriz solo pueden ser del administrador.</span></div>' +
        '<div class="tabla-wrap"><table class="tabla"><thead><tr><th>Acceso</th>' + ROLES.map(r => '<th style="text-align:center">' + r[1] + '</th>').join('') + '</tr></thead><tbody>' + filas + '</tbody></table></div>';

      const cambios = () => ROLES.reduce((n, r) => n + Object.keys(m[r[0]]).filter(k => m[r[0]][k] !== original[r[0]][k]).length, 0);
      const refrescar = () => {
        const n = cambios();
        $('#pm-guardar', el).disabled = !n; $('#pm-descartar', el).disabled = !n;
        $('#pm-guardar', el).textContent = n ? 'Guardar ' + n + (n === 1 ? ' cambio' : ' cambios') : 'Guardar';
      };
      el.addEventListener('change', ev => {
        const c = ev.target.closest('input[data-k]');
        if (c) { m[c.dataset.r][c.dataset.k] = c.checked; refrescar(); }
      });
      $('#pm-descartar', el).addEventListener('click', () => App.pintarVista());
      $('#pm-guardar', el).addEventListener('click', async () => {
        try {
          await App.conCarga(() => App.api('permisos_guardar', { matriz: m }));
          App.toast('Permisos actualizados. Rigen desde la próxima acción de cada usuario.');
          App.recargar();
        } catch (e) { App.toast(e.message, 'error'); }
      });
    }
  });
})();
