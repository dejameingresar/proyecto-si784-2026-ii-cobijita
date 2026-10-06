/* =====================================================================
   DespliegaUML · src/puml.js
   Interoperabilidad con PlantUML: exportar el modelo a .puml y volver a
   leerlo. El subconjunto soportado cubre component, interface, database,
   node, cloud y artifact, que es lo que necesitan las dos vistas.
   Sin dependencias.
   ===================================================================== */
(function (root) {
  'use strict';
  var DPL = (root.DPL = root.DPL || {});
  var M = DPL.Modelo;

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/"/g, "'")
      .replace(/[\r\n]+/g, ' ')
      .trim();
  }

  /* ================================================================
     Exportar
     ================================================================ */
  function aPlantUml(modelo) {
    var L = [];
    L.push('@startuml ' + (esc(modelo.nombre).replace(/\s+/g, '_') || 'modelo'));
    L.push('skinparam componentStyle rectangle');
    L.push('title ' + esc(modelo.nombre) + ' v' + esc(modelo.version));
    L.push("' @meta proyecto = " + esc(modelo.nombre) + " | version = " + esc(modelo.version));
    L.push('');

    /* --- Vista de componentes --- */
    L.push('package "Diagrama de componentes" {');
    modelo.componentes.forEach(function (c) {
      var clase = c.estereotipo === 'interface' ? 'interface' : c.estereotipo === 'database' ? 'database' : 'component';
      L.push('  ' + clase + ' "' + esc(c.nombre) + '" as ' + c.id + ' <<' + c.estereotipo + '>> {');
      c.puertos.forEach(function (p) {
        /* el id del puerto viaja delante del nombre para que el parser lo recupere */
        L.push('    ' + (p.direccion === 'provided' ? '--' : '..') + ' "' +
          p.id + ' ' + esc(p.nombre) + '" : ' + esc(p.interfaz));
      });
      L.push('  }');
    });
    modelo.conectores.forEach(function (k) {
      var d = k.desde || {}, h = k.hacia || {};
      L.push('  ' + d.componente + ' "' + esc(d.puerto || '') + '" --> ' + h.componente + ' "' + esc(h.puerto || '') + '" : ' + esc(k.contrato));
    });
    L.push('}');
    L.push('');

    /* --- Vista de despliegue --- */
    L.push('package "Diagrama de despliegue" {');
    modelo.nodos.forEach(function (n) {
      var marca = n.estereotipo === 'cloudRegion' ? 'cloud' : 'node';
      L.push('  ' + marca + ' "' + esc(n.nombre) + '" as ' + n.id + ' <<' + n.estereotipo + '>> {');
      var spec = ['so=' + n.sistemaOperativo, 'cpu=' + n.cpu, 'mem=' + n.memoria]
        .filter(function (s) { return s.indexOf('=') > 0; }).join(' ; ');
      if (spec) L.push("' @spec " + n.id + ' ' + esc(spec));
      modelo.realizaciones.filter(function (r) { return r.nodo === n.id; }).forEach(function (r) {
        var a = M.buscarArtefacto(modelo, r.artefacto);
        if (!a) return;
        L.push('    artifact "' + esc(a.nombre) + '" as ' + a.id + ' <<' + a.tipo + '>>');
        L.push("' @file " + a.id + ' ' + esc(a.archivo || '') + ' ; version=' + esc(a.version || '1.0.0'));
      });
      L.push('  }');
    });
    modelo.realizaciones.forEach(function (r) {
      var a = M.buscarArtefacto(modelo, r.artefacto);
      if (a && a.componente) L.push('  ' + a.id + ' ..> ' + a.componente + ' : realiza');
    });
    modelo.caminos.forEach(function (c) {
      L.push('  ' + c.a + ' --> ' + c.b + ' : ' + esc(c.protocolo) + (c.puerto ? '/' + c.puerto : ''));
    });
    L.push('}');
    L.push('');
    L.push('@enduml');
    return L.join('\n');
  }

  /* ================================================================
     Importar (parser tolerante del subconjunto generado arriba)
     ================================================================ */
  function desdePlantUml(texto) {
    var m = M.nuevo();
    var vista = '';
    var pila = [];          /* ids de bloques abiertos */
    var nodoDeArtefacto = {}; /* artefacto -> id del nodo que lo contiene */
    var errores = [];

    texto.split(/\r?\n/).forEach(function (linea, i) {
      var l = linea.trim();
      if (!l || l.startsWith('@') || l.startsWith('skinparam') || l.startsWith('title')) return;
      var nL = i + 1;

      /* metadatos que el propio exportador escribe como comentarios */
      if (l.charAt(0) === "'") {
        var cuerpo = l.replace(/^'+\s*/, '');
        var ms = cuerpo.match(/^@meta\s+proyecto\s*=\s*(.+?)\s*\|\s*version\s*=\s*(.+)$/);
        if (ms) { m.nombre = ms[1].trim(); m.version = ms[2].trim(); return; }
        var msp = cuerpo.match(/^@spec\s+(\w+)\s+(.+)$/);
        if (msp) {
          var nodo = M.buscarNodo(m, msp[1]);
          if (nodo) {
            msp[2].split(';').forEach(function (par) {
              var kv = par.split('=');
              if (kv.length < 2) return;
              var k = kv[0].trim(), v = kv.slice(1).join('=').trim();
              if (k === 'so') nodo.sistemaOperativo = v;
              if (k === 'cpu') nodo.cpu = v;
              if (k === 'mem') nodo.memoria = v;
            });
          }
          return;
        }
        var mf = cuerpo.match(/^@file\s+(\w+)\s+(.+)$/);
        if (mf) {
          var art = M.buscarArtefacto(m, mf[1]);
          if (art) {
            mf[2].split(';').forEach(function (par) {
              var kv = par.split('=');
              if (kv.length === 1) {
                /* primer segmento sin "=" = la ruta del archivo */
                if (kv[0].trim()) art.archivo = kv[0].trim();
                return;
              }
              var k = kv[0].trim(), v = kv.slice(1).join('=').trim();
              if (k === 'version') art.version = v;
            });
          }
          return;
        }
        return; /* comentario normal */
      }

      var pm = l.match(/^(package|node|cloud|component|interface|artifact|database|rectangle)\s+"([^"]*)"(?:\s+as\s+(\w+))?(?:\s*<<([^>]*)>>)?\s*\{?$/);
      if (pm) {
        var tipo = pm[1], nombre = pm[2], id = pm[3], estereo = pm[4];
        if (tipo === 'package') { vista = nombre.toLowerCase().indexOf('despliegue') >= 0 ? 'despliegue' : 'componentes'; pila.push('pkg'); return; }
        if (vista === 'despliegue' || tipo === 'node' || tipo === 'cloud' || tipo === 'artifact') {
          if (tipo === 'artifact') {
            var art = M.agregarArtefacto(m, { nombre: nombre, tipo: estereo || 'executable', version: '1.0.0' });
            if (id) art.id = id;
            /* el nodo contenedor es el bloque abierto más interno que sea un nodo */
            for (var pi = pila.length - 1; pi >= 0; pi--) {
              if (M.buscarNodo(m, pila[pi])) { nodoDeArtefacto[art.id] = pila[pi]; break; }
            }
            return;
          }
          var nodo = M.agregarNodo(m, {
            nombre: nombre,
            estereotipo: tipo === 'cloud' ? 'cloudRegion' : (estereo || 'executionEnvironment')
          });
          if (id) nodo.id = id;
          if (/\{\s*$/.test(l)) pila.push(nodo.id);
          return;
        }
        if (tipo === 'component' || tipo === 'interface' || tipo === 'database') {
          var c = M.agregarComponente(m, {
            nombre: nombre,
            estereotipo: tipo === 'interface' ? 'interface' : (tipo === 'database' ? 'database' : (estereo || 'service'))
          });
          if (id) c.id = id;
          if (/\{\s*$/.test(l)) pila.push(c.id);
          return;
        }
        return;
      }

      if (l === '}') { pila.pop(); return; }

      /* puertos:  -- "id nombre" : Interfaz   |   .. "id nombre" : Interfaz */
      var mp = l.match(/^(\.\.|--)\s+"([^"]*)"\s*:\s*(.+)$/);
      if (mp && pila.length) {
        var padre = M.buscarComponente(m, pila[pila.length - 1]);
        if (padre) {
          /* el exportador escribe "id nombre"; si no hay id, se genera */
          var bruto = mp[2].trim();
          var corte = bruto.search(/\s/);
          var pid = corte > 0 ? bruto.slice(0, corte) : null;
          var pnombre = corte > 0 ? bruto.slice(corte + 1) : bruto;
          if (!pid || !/^p\w+$/i.test(pid)) { pnombre = bruto; pid = 'p' + (padre.puertos.length + 1); }
          M.agregarPuerto(padre, {
            id: pid, nombre: pnombre, interfaz: mp[3].trim(),
            /* convención PlantUML: -- puerto proporcionado, .. puerto requerido */
            direccion: mp[1] === '--' ? 'provided' : 'required'
          });
        }
        return;
      }

      /* conectores:  C1 "p1" --> C2 "p2" : contrato */
      var mc = l.match(/^(\w+)\s+"([^"]*)"\s*(-->|<|-->|-\.->)\s*(\w+)\s+"([^"]*)"\s*(?::\s*(.+))?$/);
      if (mc) {
        M.agregarConector(m, {
          desde: { componente: mc[1], puerto: mc[2] || null },
          hacia: { componente: mc[4], puerto: mc[5] || null },
          contrato: (mc[7] || 'uses').trim()
        });
        return;
      }

      /* realización:  A1 ..> C2 : realiza  (el nodo viene del bloque que contenía el artefacto) */
      var mr = l.match(/^(\w+)\s+\.\.>\s*(\w+)\s*:\s*(\w+)$/);
      if (mr) {
        var art = M.buscarArtefacto(m, mr[1]);
        if (!art) {
          art = M.agregarArtefacto(m, { nombre: mr[1], tipo: 'executable', version: '1.0.0' });
          art.id = mr[1];
          errores.push('línea ' + nL + ': el artefacto ' + mr[1] + ' no estaba declarado; se crea.');
        }
        var nodoDestino = nodoDeArtefacto[art.id];
        if (nodoDestino) {
          M.agregarRealizacion(m, { artefacto: art.id, nodo: nodoDestino });
        } else {
          /* .puml escritos a mano: se asocia al último nodo declarado si existe */
          var ultimo = m.nodos.length ? m.nodos[m.nodos.length - 1].id : null;
          if (ultimo) M.agregarRealizacion(m, { artefacto: art.id, nodo: ultimo });
          else errores.push('línea ' + nL + ': realización sin nodo de despliegue — ' + mr[0]);
        }
        if (M.buscarComponente(m, mr[2])) art.componente = mr[2];
        return;
      }

      /* camino entre nodos:  N1 --> N2 : TCP/5432 */
      var mca = l.match(/^(\w+)\s+-->\s*(\w+)\s*:\s*([A-Za-z]+)(?:\/(\S+))?$/);
      if (mca) {
        M.agregarCamino(m, { a: mca[1], b: mca[2], protocolo: mca[3].toUpperCase(), puerto: mca[4] ? parseInt(mca[4], 10) : '' });
        return;
      }

      if (l === '}') return;
    });

    m.nombre = m.nombre || 'Modelo importado';
    return { modelo: M.normalizar(m), errores: errores };
  }

  DPL.puml = { exportar: aPlantUml, importar: desdePlantUml, aPlantUml: aPlantUml, desdePlantUml: desdePlantUml };
})(typeof globalThis !== 'undefined' ? globalThis : this);
