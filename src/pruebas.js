/* =====================================================================
   DespliegaUML · src/pruebas.js
   Micro-framework de pruebas sin dependencias (describe/it/expect)
   + catálogos de datos de prueba reutilizables por los casos del plan.
   ===================================================================== */
(function (root) {
  'use strict';
  var DPL = (root.DPL = root.DPL || {});

  function crearCorredor() {
    var suite = [];
    var actual = null;
    var api = {
      suites: suite,
      describe: function (nombre, fn) {
        actual = { nombre: nombre, casos: [] };
        suite.push(actual);
        fn();
        actual = null;
      },
      it: function (nombre, fn) {
        if (!actual) api.describe('(sin grupo)', function () { api.it(nombre, fn); });
        else actual.casos.push({ nombre: nombre, fn: fn });
      },
      expect: function (real) {
        return {
          toBe: function (esperado, msg) {
            if (real !== esperado) {
              throw new Error((msg || 'toBe') + ': esperado ' + JSON.stringify(esperado) + ', obtenido ' + JSON.stringify(real));
            }
          },
          toEqual: function (esperado, msg) {
            var a = JSON.stringify(real), b = JSON.stringify(esperado);
            if (a !== b) throw new Error((msg || 'toEqual') + ': esperado ' + b + ', obtenido ' + a);
          },
          toBeTruthy: function (msg) { if (!real) throw new Error((msg || 'toBeTruthy') + ': valor falso ' + JSON.stringify(real)); },
          toBeFalsy: function (msg) { if (real) throw new Error((msg || 'toBeFalsy') + ': valor verdadero ' + JSON.stringify(real)); },
          toContain: function (sub, msg) {
            if (real == null || real.indexOf(sub) < 0) {
              throw new Error((msg || 'toContain') + ': ' + JSON.stringify(real) + ' no contiene ' + JSON.stringify(sub));
            }
          },
          toHaveLength: function (n, msg) {
            if (!real || real.length !== n) {
              throw new Error((msg || 'toHaveLength') + ': longitud esperada ' + n + ', obtenida ' + (real ? real.length : 'null'));
            }
          },
          toBeGreaterThan: function (n, msg) {
            if (!(real > n)) throw new Error((msg || 'toBeGreaterThan') + ': ' + real + ' no es > ' + n);
          },
          toBeGreaterThanOrEqual: function (n, msg) {
            if (!(real >= n)) throw new Error((msg || 'toBeGreaterThanOrEqual') + ': ' + real + ' no es >= ' + n);
          }
        };
      },
      ejecutar: function (filtro) {
        var total = 0, ok = 0, fallos = [];
        var t0 = Date.now();
        suite.forEach(function (s) {
          s.casos.forEach(function (c) {
            if (filtro && (s.nombre + ' ' + c.nombre).toLowerCase().indexOf(filtro.toLowerCase()) < 0) return;
            total++;
            try {
              c.fn();
              ok++;
            } catch (e) {
              fallos.push({ suite: s.nombre, caso: c.nombre, error: e.message });
            }
          });
        });
        return {
          total: total, exitosos: ok, fallidos: fallos.length, fallos: fallos,
          duracionMs: Date.now() - t0,
          coberturaPct: total ? Math.round((ok / total) * 10000) / 100 : 100
        };
      }
    };
    return api;
  }

  /* ---------------------------------------------------------------
     Constructor de modelos de prueba (datos de entrada)
     --------------------------------------------------------------- */
  function fabrica() {
    var M = DPL.Modelo;
    return {
      vacio: function () {
        return M.nuevo();
      },

      /* Modelo válido mínimo: 1 componente, 1 artefacto, 1 nodo. */
      minimoValido: function () {
        var m = M.nuevo();
        m.nombre = 'Mínimo válido';
        var ui = M.agregarComponente(m, { nombre: 'Interfaz de usuario', estereotipo: 'application' });
        var ctrl = M.agregarComponente(m, { nombre: 'Controlador', estereotipo: 'service' });
        M.agregarPuerto(ui, { id: 'p1', nombre: 'llamadaUI', direccion: 'required', interfaz: 'IServicio' });
        M.agregarPuerto(ctrl, { id: 'p1', nombre: 'servicio', direccion: 'provided', interfaz: 'IServicio' });
        M.agregarConector(m, { desde: { componente: ctrl.id, puerto: 'p1' }, hacia: { componente: ui.id, puerto: 'p1' } });
        var nodo = M.agregarNodo(m, {
          nombre: 'Servidor de aplicación', estereotipo: 'executionEnvironment',
          sistemaOperativo: 'Debian 13', cpu: '4 vCPU', memoria: '8 GB'
        });
        var art = M.agregarArtefacto(m, {
          nombre: 'despliegauML.jar', tipo: 'executable', archivo: 'dist/despliegauML.jar',
          version: '1.0.0', componente: ctrl.id
        });
        M.agregarRealizacion(m, { artefacto: art.id, nodo: nodo.id });
        return m;
      },

      /* Aplicación web de 3 niveles con 2 artefactos y 2 nodos. */
      webTresNiveles: function () {
        var m = M.nuevo();
        m.nombre = 'Aplicación web tres niveles';
        var web = M.agregarComponente(m, { nombre: 'Servidor web', estereotipo: 'application' });
        var app = M.agregarComponente(m, { nombre: 'Lógica de negocio', estereotipo: 'service' });
        var bd = M.agregarComponente(m, { nombre: 'Base de datos', estereotipo: 'database' });
        M.agregarPuerto(web, { id: 'p1', nombre: 'peticion', direccion: 'required', interfaz: 'INegocio' });
        M.agregarPuerto(app, { id: 'p1', nombre: 'operacion', direccion: 'provided', interfaz: 'INegocio' });
        M.agregarPuerto(app, { id: 'p2', nombre: 'consulta', direccion: 'required', interfaz: 'IPersistencia' });
        M.agregarPuerto(bd, { id: 'p1', nombre: 'acceso', direccion: 'provided', interfaz: 'IPersistencia' });
        M.agregarConector(m, { desde: { componente: app.id, puerto: 'p1' }, hacia: { componente: web.id, puerto: 'p1' } });
        M.agregarConector(m, { desde: { componente: bd.id, puerto: 'p1' }, hacia: { componente: app.id, puerto: 'p2' } });

        var srvApp = M.agregarNodo(m, {
          nombre: 'Servidor de aplicación', estereotipo: 'executionEnvironment',
          sistemaOperativo: 'Debian 13', cpu: '4 vCPU', memoria: '8 GB'
        });
        var srvBd = M.agregarNodo(m, {
          nombre: 'Servidor de base de datos', estereotipo: 'executionEnvironment',
          sistemaOperativo: 'PostgreSQL 17', cpu: '8 vCPU', memoria: '32 GB'
        });
        M.agregarCamino(m, { a: srvApp.id, b: srvBd.id, protocolo: 'TCP', puerto: 5432 });

        var jar = M.agregarArtefacto(m, { nombre: 'app.jar', tipo: 'executable', archivo: 'dist/app.jar', version: '2.1.0', componente: app.id });
        var dump = M.agregarArtefacto(m, { nombre: 'app-schema.sql', tipo: 'data', archivo: 'db/schema.sql', version: '1.4.0', componente: bd.id });
        var conf = M.agregarArtefacto(m, { nombre: 'web.conf', tipo: 'document', archivo: 'conf/web.conf', version: '1.0.0', componente: web.id });
        M.agregarRealizacion(m, { artefacto: jar.id, nodo: srvApp.id });
        M.agregarRealizacion(m, { artefacto: dump.id, nodo: srvBd.id });
        M.agregarRealizacion(m, { artefacto: conf.id, nodo: srvApp.id });
        return m;
      }
    };
  }

  DPL.pruebas = { corredor: crearCorredor, fabrica: fabrica };
})(typeof globalThis !== 'undefined' ? globalThis : this);
