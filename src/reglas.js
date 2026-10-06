/* =====================================================================
   DespliegaUML · src/reglas.js
   Motor de validación de reglas de consistencia sobre el modelo.
   Cada regla tiene: id, nombre, severidad por defecto, categoría,
   trazabilidad al estándar/razón, y una función ver(modelo, ix) -> hallazgos.
   Sin dependencias.
   ===================================================================== */
(function (root) {
  'use strict';
  var DPL = (root.DPL = root.DPL || {});
  var M = DPL.Modelo;

  DPL.SEVERIDADES = { error: 3, warning: 2, info: 1 };

  function hallazgo(id, severidad, mensaje, donde, extra) {
    var h = { regla: id, severidad: severidad, mensaje: mensaje, donde: donde || '' };
    if (extra) Object.keys(extra).forEach(function (k) { h[k] = extra[k]; });
    return h;
  }

  function nombreDe(ix, tipo, id) {
    var e = ix[tipo] ? ix[tipo][id] : null;
    return e ? e.nombre || e.id : id;
  }

  /* ================================================================
     R-01 · Unicidad de identificadores
     ================================================================ */
  function r01(modelo, ix) {
    var out = [], vistos = {};
    ['componentes', 'nodos', 'artefactos', 'conectores', 'caminos', 'realizaciones'].forEach(function (col) {
      modelo[col].forEach(function (e) {
        var clave = col + '#' + e.id;
        if (vistos[clave]) {
          out.push(hallazgo('R-01', 'error',
            'Identificador duplicado: "' + e.id + '" ya existe en ' + vistos[clave] + '.',
            col, { elemento: e.id, tipoElemento: col }));
        } else {
          vistos[clave] = col;
        }
      });
    });
    return out;
  }

  /* ================================================================
     R-02 · Nombre obligatorio
     ================================================================ */
  function r02(modelo, ix) {
    var out = [];
    ['componentes', 'nodos', 'artefactos'].forEach(function (col) {
      modelo[col].forEach(function (e) {
        if (!e.nombre || !String(e.nombre).trim()) {
          out.push(hallazgo('R-02', 'error', 'Elemento ' + e.id + ' sin nombre.', col, { elemento: e.id }));
        }
      });
    });
    return out;
  }

  /* ================================================================
     R-03 · Estereotipos del catálogo UML 2
     ================================================================ */
  function r03(modelo, ix) {
    var out = [];
    modelo.componentes.forEach(function (c) {
      if (DPL.STEREOTIPOS_COMPONENTE.indexOf(c.estereotipo) < 0) {
        out.push(hallazgo('R-03', 'error',
          'Componente "' + c.id + '" con estereotipo "' + c.estereotipo + '" fuera de catálogo. Admitidos: ' +
          DPL.STEREOTIPOS_COMPONENTE.join(', ') + '.', 'componentes', { elemento: c.id }));
      }
    });
    modelo.nodos.forEach(function (n) {
      if (DPL.STEREOTIPOS_NODO.indexOf(n.estereotipo) < 0) {
        out.push(hallazgo('R-03', 'error',
          'Nodo "' + n.id + '" con estereotipo "' + n.estereotipo + '" fuera de catálogo. Admitidos: ' +
          DPL.STEREOTIPOS_NODO.join(', ') + '.', 'nodos', { elemento: n.id }));
      }
    });
    modelo.artefactos.forEach(function (a) {
      if (DPL.TIPOS_ARTIFACTO.indexOf(a.tipo) < 0) {
        out.push(hallazgo('R-03', 'error',
          'Artefacto "' + a.id + '" con tipo "' + a.tipo + '" no admitido. Admitidos: ' +
          DPL.TIPOS_ARTIFACTO.join(', ') + '.', 'artefactos', { elemento: a.id }));
      }
    });
    return out;
  }

  /* ================================================================
     R-04 · Conectores: extremos existentes y puertos reales
     ================================================================ */
  function r04(modelo, ix) {
    var out = [];
    modelo.conectores.forEach(function (k) {
      [['desde', 'proveedor'], ['hacia', 'requeridor']].forEach(function (par) {
        var lado = par[0], rol = par[1];
        var ref = k[lado];
        if (!ref || !ref.componente) {
          out.push(hallazgo('R-04', 'error',
            'Conector ' + k.id + ' sin extremo ' + rol + ' definido.', 'conectores', { elemento: k.id }));
          return;
        }
        if (!ix.componentes[ref.componente]) {
          out.push(hallazgo('R-04', 'error',
            'Conector ' + k.id + ' referencia al componente inexistente "' + ref.componente + '".',
            'conectores', { elemento: k.id, referencia: ref.componente }));
          return;
        }
        if (ref.puerto && !ix.puertoPorId[ref.componente + '/' + ref.puerto]) {
          out.push(hallazgo('R-04', 'error',
            'Conector ' + k.id + ' referencia al puerto inexistente "' + ref.componente + '/' + ref.puerto + '".',
            'conectores', { elemento: k.id, referencia: ref.componente + '/' + ref.puerto }));
        }
      });
    });
    return out;
  }

  /* ================================================================
     R-05 · Simetría de contrato en el conector
     Un "required" sólo puede emparejarse con un "provided"
     ================================================================ */
  function r05(modelo, ix) {
    var out = [];
    modelo.conectores.forEach(function (k) {
      var d = ix.puertoPorId[k.desde && (k.desde.componente + '/' + k.desde.puerto)];
      var h = ix.puertoPorId[k.hacia && (k.hacia.componente + '/' + k.hacia.puerto)];
      if (!d || !h) return; /* R-04 ya reportó el problema */
      if (d.puerto.direccion !== 'provided' || h.puerto.direccion !== 'required') {
        out.push(hallazgo('R-05', 'error',
          'Conector ' + k.id + ' inválido: el extremo desde debe ser "provided" (' +
          d.componente.id + '/' + d.puerto.id + ') y el extremo hacia debe ser "required" (' +
          h.componente.id + '/' + h.puerto.id + ').',
          'conectores', { elemento: k.id, elementoDetalle: d.componente.id + ' -> ' + h.componente.id }));
      }
    });
    return out;
  }

  /* ================================================================
     R-06 · Puertos required sin conectar (cableado incompleto)
     ================================================================ */
  function r06(modelo, ix) {
    var out = [];
    modelo.componentes.forEach(function (c) {
      c.puertos.forEach(function (p) {
        if (p.direccion !== 'required') return;
        var conectado = modelo.conectores.some(function (k) {
          return k.hacia && k.hacia.componente === c.id && k.hacia.puerto === p.id;
        });
        if (!conectado) {
          out.push(hallazgo('R-06', 'warning',
            'Puerto requerido "' + c.id + '/' + p.id + ' (' + p.nombre + ')" no está conectado a ningún ' +
            'componente que lo provea.', 'componentes', { elemento: c.id + '/' + p.id }));
        }
      });
    });
    return out;
  }

  /* ================================================================
     R-07 · Puertos provided sin consumir (interfaz muerta)
     ================================================================ */
  function r07(modelo, ix) {
    var out = [];
    modelo.componentes.forEach(function (c) {
      c.puertos.forEach(function (p) {
        if (p.direccion !== 'provided') return;
        var usado = modelo.conectores.some(function (k) {
          return k.desde && k.desde.componente === c.id && k.desde.puerto === p.id;
        });
        if (!usado) {
          out.push(hallazgo('R-07', 'info',
            'Interfaz publicada "' + c.id + '/' + p.id + ' (' + p.nombre + ')" sin requeridores.',
            'componentes', { elemento: c.id + '/' + p.id }));
        }
      });
    });
    return out;
  }

  /* ================================================================
     R-08 · Interfaz duplicada en un mismo componente
     ================================================================ */
  function r08(modelo, ix) {
    var out = [];
    modelo.componentes.forEach(function (c) {
      var vistas = {};
      c.puertos.forEach(function (p) {
        vistas[p.interfaz] = (vistas[p.interfaz] || 0) + 1;
      });
      Object.keys(vistas).forEach(function (iface) {
        if (vistas[iface] > 1) {
          out.push(hallazgo('R-08', 'error',
            'El componente "' + c.id + '" publica la interfaz "' + iface + '" ' + vistas[iface] + ' veces.',
            'componentes', { elemento: c.id, referencia: iface }));
        }
      });
    });
    return out;
  }

  /* ================================================================
     R-09 · Realizaciones: artefacto y nodo existentes
     ================================================================ */
  function r09(modelo, ix) {
    var out = [];
    modelo.realizaciones.forEach(function (r) {
      if (!r.artefacto || !ix.artefactos[r.artefacto]) {
        out.push(hallazgo('R-09', 'error',
          'Realización ' + r.id + ' referencia un artefacto inexistente ("' + (r.artefacto || 'sin definir') + '").',
          'realizaciones', { elemento: r.id, referencia: r.artefacto }));
      }
      if (!r.nodo || !ix.nodos[r.nodo]) {
        out.push(hallazgo('R-09', 'error',
          'Realización ' + r.id + ' no indica un nodo de despliegue válido ("' + (r.nodo || 'sin definir') + '").',
          'realizaciones', { elemento: r.id, referencia: r.nodo }));
      }
    });
    return out;
  }

  /* ================================================================
     R-10 · Artefacto no desplegado
     ================================================================ */
  function r10(modelo, ix) {
    var out = [];
    modelo.artefactos.forEach(function (a) {
      var desplegado = Object.keys(ix.artefactosPorNodo || {}).some(function (nodo) {
        return ix.artefactosPorNodo[nodo].some(function (r) { return r.artefacto === a.id; });
      });
      if (!desplegado) {
        out.push(hallazgo('R-10', 'error',
          'El artefacto "' + a.id + ' (' + a.nombre + ' v' + a.version + ')" no se realiza en ningún nodo de despliegue.',
          'artefactos', { elemento: a.id }));
      }
    });
    return out;
  }

  /* ================================================================
     R-11 · Componente sin artefacto que lo materialice
     ================================================================ */
  function r11(modelo, ix) {
    var out = [];
    modelo.componentes.forEach(function (c) {
      var tiene = modelo.artefactos.some(function (a) { return a.componente === c.id; });
      if (!tiene) {
        out.push(hallazgo('R-11', 'warning',
          'El componente "' + c.id + ' (' + c.nombre + ')" no tiene artefacto asociado que lo implemente.',
          'componentes', { elemento: c.id }));
      }
    });
    return out;
  }

  /* ================================================================
     R-12 · Nodo anfitrión válido y jerarquía sin ciclos
     ================================================================ */
  function r12(modelo, ix) {
    var out = [];
    modelo.nodos.forEach(function (n) {
      if (n.anfitrion && !ix.nodos[n.anfitrion]) {
        out.push(hallazgo('R-12', 'error',
          'El nodo "' + n.id + '" declara un anfitrión inexistente ("' + n.anfitrion + '").',
          'nodos', { elemento: n.id, referencia: n.anfitrion }));
      }
      if (n.anfitrion === n.id) {
        out.push(hallazgo('R-12', 'error',
          'El nodo "' + n.id + '" se hospeda a sí mismo.', 'nodos', { elemento: n.id }));
      }
    });
    /* detección de ciclos de jerarquía */
    modelo.nodos.forEach(function (n) {
      var visto = {}, actual = n, pasos = 0;
      while (actual && actual.anfitrion) {
        if (visto[actual.id]) {
          out.push(hallazgo('R-12', 'error',
            'Ciclo en la jerarquía de nodos que pasa por "' + n.id + '".', 'nodos', { elemento: n.id }));
          break;
        }
        visto[actual.id] = true;
        actual = ix.nodos[actual.anfitrion];
        if (++pasos > modelo.nodos.length + 1) {
          out.push(hallazgo('R-12', 'error',
            'Ciclo en la jerarquía de nodos que pasa por "' + n.id + '".', 'nodos', { elemento: n.id }));
          break;
        }
      }
    });
    return out;
  }

  /* ================================================================
     R-13 · Una sola unidad de ejecución por nodo
     (UML 2: un nodo representa una máquina y su contenido es indivisible)
     ================================================================ */
  function r13(modelo, ix) {
    var out = [];
    modelo.nodos.forEach(function (n) {
      if (n.estereotipo !== 'executionEnvironment') return;
      var arts = (ix.artefactosPorNodo[n.id] || [])
        .map(function (r) { return ix.artefactos[r.artefacto]; })
        .filter(Boolean)
        .filter(function (a) { return a.tipo === 'executable'; });
      if (arts.length > 1) {
        out.push(hallazgo('R-13', 'warning',
          'El nodo de ejecución "' + n.id + ' (' + n.nombre + ')" aloja ' + arts.length +
          ' artefactos ejecutables (' + arts.map(function (a) { return a.id; }).join(', ') +
          '); UML 2 recomienda un nodo por unidad de ejecución.',
          'nodos', { elemento: n.id }));
      }
    });
    return out;
  }

  /* ================================================================
     R-14 · Nodo hoja sin especificación técnica
     ================================================================ */
  function r14(modelo, ix) {
    var out = [];
    modelo.nodos.forEach(function (n) {
      if (n.estereotipo === 'cloudRegion') return;
      var falta = [];
      if (!n.sistemaOperativo) falta.push('sistema operativo');
      if (!n.cpu) falta.push('CPU');
      if (!n.memoria) falta.push('memoria');
      if (falta.length) {
        out.push(hallazgo('R-14', 'info',
          'El nodo "' + n.id + ' (' + n.nombre + ')" no declara: ' + falta.join(', ') +
          '. El plan de despliegue lo registrará como supuesto.',
          'nodos', { elemento: n.id }));
      }
    });
    return out;
  }

  /* ================================================================
     R-15 · Caminos de comunicación
     ================================================================ */
  function r15(modelo, ix) {
    var out = [];
    modelo.caminos.forEach(function (c) {
      if (!c.a || !ix.nodos[c.a]) {
        out.push(hallazgo('R-15', 'error',
          'Camino ' + c.id + ' con origen inválido ("' + (c.a || 'sin definir') + '").',
          'caminos', { elemento: c.id, referencia: c.a }));
      }
      if (!c.b || !ix.nodos[c.b]) {
        out.push(hallazgo('R-15', 'error',
          'Camino ' + c.id + ' con destino inválido ("' + (c.b || 'sin definir') + '").',
          'caminos', { elemento: c.id, referencia: c.b }));
      }
      if (c.a && c.a === c.b) {
        out.push(hallazgo('R-15', 'error',
          'Camino ' + c.id + ' conecta el nodo consigo mismo.', 'caminos', { elemento: c.id }));
      }
      if (c.puerto === '' || c.puerto === null || c.puerto === undefined) {
        out.push(hallazgo('R-15', 'warning',
          'Camino ' + c.id + ' sin puerto declarado.', 'caminos', { elemento: c.id }));
      } else {
        var p = parseInt(c.puerto, 10);
        if (isNaN(p) || p < 1 || p > 65535) {
          out.push(hallazgo('R-15', 'error',
            'Camino ' + c.id + ' con puerto "' + c.puerto + '" fuera del rango 1-65535.',
            'caminos', { elemento: c.id }));
        }
      }
    });
    /* duplicados de camino */
    var vistos = {};
    modelo.caminos.forEach(function (c) {
      var par = [c.a, c.b].sort().join('|') + '|' + c.protocolo + '|' + c.puerto;
      if (vistos[par]) {
        out.push(hallazgo('R-15', 'warning',
          'Camino ' + c.id + ' duplica el tramo ya definido por ' + vistos[par] + '.',
          'caminos', { elemento: c.id }));
      } else {
        vistos[par] = c.id;
      }
    });
    return out;
  }

  /* ================================================================
     R-16 · Nodo de despliegue aislado (no participa de la arquitectura)
     ================================================================ */
  function r16(modelo, ix) {
    var out = [];
    modelo.nodos.forEach(function (n) {
      var tieneArtefactos = (ix.artefactosPorNodo[n.id] || []).length > 0;
      var tieneVecinos = modelo.caminos.some(function (c) { return c.a === n.id || c.b === n.id; });
      if (!tieneArtefactos && !tieneVecinos && modelo.nodos.length > 1) {
        out.push(hallazgo('R-16', 'warning',
          'El nodo "' + n.id + ' (' + n.nombre + ')" no aloja artefactos ni conecta con otro nodo.',
          'nodos', { elemento: n.id }));
      }
    });
    return out;
  }

  /* ================================================================
     R-17 · Sin ciclos en el ensamblaje de componentes
     ================================================================ */
  function r17(modelo, ix) {
    var out = [];
    var adj = {};
    modelo.componentes.forEach(function (c) { adj[c.id] = []; });
    modelo.conectores.forEach(function (k) {
      if (k.desde && k.hacia && adj[k.desde.componente] && adj[k.hacia.componente]) {
        adj[k.desde.componente].push(k.hacia.componente);
      }
    });

    var estado = {};       /* 0 = sin visitar, 1 = en pila, 2 = terminado */
    var ciclos = [];       /* pares "u -> v" ya confirmados como ciclo */
    function dfs(u) {
      estado[u] = 1;
      adj[u].forEach(function (v) {
        if (estado[v] === 1) {
          var par = u + ' -> ' + v;
          if (ciclos.indexOf(par) < 0) ciclos.push(par);
        } else if (!estado[v]) {
          dfs(v);
        }
      });
      estado[u] = 2;
    }
    modelo.componentes.forEach(function (c) { if (!estado[c.id]) dfs(c.id); });

    ciclos.forEach(function (par) {
      out.push(hallazgo('R-17', 'error',
        'Ciclo de ensamblaje entre componentes: ' + par + '. El grafo de componentes debe ser acíclico.',
        'conectores', { elemento: par }));
    });
    return out;
  }

  /* ================================================================
     R-18 · Cobertura de puertos publicados por la interfaz
     ================================================================ */
  function r18(modelo, ix) {
    var out = [];
    modelo.conectores.forEach(function (k) {
      var d = ix.puertoPorId[k.desde && (k.desde.componente + '/' + k.desde.puerto)];
      var h = ix.puertoPorId[k.hacia && (k.hacia.componente + '/' + k.hacia.puerto)];
      if (!d || !h) return;
      if (d.puerto.interfaz !== h.puerto.interfaz) {
        out.push(hallazgo('R-18', 'error',
          'El conector ' + k.id + ' empareja interfaces distintas: "' + d.puerto.interfaz + '" (' +
          d.componente.id + ') contra "' + h.puerto.interfaz + '" (' + h.componente.id + ').',
          'conectores', { elemento: k.id }));
      }
    });
    return out;
  }

  /* ================================================================
     R-19 · Nombre de interfaz duplicado entre componentes (traza)
     informational: sólo avisa si el mismo nombre de interfaz aparece
     con firmas distintas, porque UML no lo prohíbe.
     ================================================================ */
  function r19(modelo, ix) {
    var out = [];
    var porInterfaz = ix.puertoPorInterfaz || {};
    Object.keys(porInterfaz).forEach(function (iface) {
      var comps = {};
      porInterfaz[iface].forEach(function (e) { comps[e.componente.id] = true; });
      var lista = Object.keys(comps);
      if (lista.length === 1) {
        out.push(hallazgo('R-19', 'info',
          'La interfaz "' + iface + '" sólo la implementa/pide el componente ' + lista[0] +
          ': no hay un par proveedor-requeridor para ella.', 'componentes', { referencia: iface }));
      }
    });
    return out;
  }

  /* ================================================================
     Catálogo de reglas
     ================================================================ */
  DPL.REGLAS = [
    { id: 'R-01', nombre: 'Unicidad de identificadores', fn: r01, razon: 'Un id duplicado hace ambigua cualquier referencia posterior.' },
    { id: 'R-02', nombre: 'Nombre obligatorio en todo elemento', fn: r02, razon: 'Un modelo sin nombre no es revisable ni trazable.' },
    { id: 'R-03', nombre: 'Estereotipos dentro del catálogo UML 2', fn: r03, razon: 'Restringe el vocabulario a los estereotipos definidos por OMG UML 2.x.' },
    { id: 'R-04', nombre: 'Los conectores referencian extremos existentes', fn: r04, razon: 'Una referencia colgante (apunta a algo que no existe) invalida el modelo en cascada.' },
    { id: 'R-05', nombre: 'Simetría provided/required en conectores', fn: r05, razon: 'Un conector une una interfaz publicada con una interfaz requerida.' },
    { id: 'R-06', nombre: 'Todo puerto required debe estar conectado', fn: r06, razon: 'Una dependencia sin resolver indica cableado incompleto.' },
    { id: 'R-07', nombre: 'Aviso de interfaz publicada sin requeridores', fn: r07, razon: 'Detecta contratos publicados que nadie consume.' },
    { id: 'R-08', nombre: 'Interfaz única por componente', fn: r08, razon: 'Un componente no puede exponer dos veces el mismo contrato.' },
    { id: 'R-09', nombre: 'Las realizaciones apuntan a artefacto y nodo válidos', fn: r09, razon: 'Una realización sin artefacto o sin nodo no es desplegable.' },
    { id: 'R-10', nombre: 'Todo artefacto se realiza en al menos un nodo', fn: r10, razon: 'Un artefacto no desplegado nunca llega al cliente.' },
    { id: 'R-11', nombre: 'Todo componente tiene artefacto que lo implemente', fn: r11, razon: 'Un componente sin materialización es sólo papel lógico.' },
    { id: 'R-12', nombre: 'Jerarquía de nodos acíclica y anfitrión válido', fn: r12, razon: 'La jerarquía de anidamiento no puede contener ciclos.' },
    { id: 'R-13', nombre: 'Una unidad de ejecución por nodo', fn: r13, razon: 'UML 2: un nodo representa una máquina con una unidad de ejecución.' },
    { id: 'R-14', nombre: 'Nodos con especificación técnica declarada', fn: r14, razon: 'Sin SO/CPU/memoria el plan de despliegue no es ejecutable.' },
    { id: 'R-15', nombre: 'Caminos de comunicación válidos', fn: r15, razon: 'Extremos existentes, sin bucles, puerto en rango 1-65535.' },
    { id: 'R-16', nombre: 'Nodo aislado', fn: r16, razon: 'Un nodo sin artefactos ni vecinos no participa del despliegue.' },
    { id: 'R-17', nombre: 'Grafo de ensamblaje acíclico', fn: r17, razon: 'Una dependencia circular entre componentes impide el despliegue ordenado.' },
    { id: 'R-18', nombre: 'El conector empareja la misma interfaz', fn: r18, razon: 'La interfaz es el contrato que ambos extremos deben compartir.' },
    { id: 'R-19', nombre: 'Interfaz publicada por un único componente', fn: r19, razon: 'Diagnóstico de contratos sin contraparte.' }
  ];

  DPL.REGLA_POR_ID = {};
  DPL.REGLAS.forEach(function (r) { DPL.REGLA_POR_ID[r.id] = r; });

  /* ================================================================
     Ejecución del catálogo
     ================================================================ */
  function validar(modelo) {
    modelo = M.normalizar(modelo);
    var ix = M.indexar(modelo);
    var t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    var hallazgos = [];
    DPL.REGLAS.forEach(function (r) {
      var res;
      try {
        res = r.fn(modelo, ix) || [];
      } catch (e) {
        res = [hallazgo(r.id, 'error', 'La regla no pudo ejecutarse: ' + e.message, '')];
      }
      hallazgos = hallazgos.concat(res);
    });
    var t1 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    var resumen = { error: 0, warning: 0, info: 0 };
    hallazgos.forEach(function (h) { resumen[h.severidad] = (resumen[h.severidad] || 0) + 1; });
    hallazgos.sort(function (a, b) {
      var d = DPL.SEVERIDADES[b.severidad] - DPL.SEVERIDADES[a.severidad];
      return d !== 0 ? d : (a.regla < b.regla ? -1 : 1);
    });
    return {
      hallazgos: hallazgos,
      resumen: resumen,
      valido: resumen.error === 0,
      duracionMs: Math.round((t1 - t0) * 1000) / 1000,
      reglasEvaluadas: DPL.REGLAS.length,
      timestamp: DPL.ahoraIso()
    };
  }

  DPL.validar = validar;
  DPL.motorDeReglas = { ejecutar: validar, catálogo: DPL.REGLAS, hallazgo: hallazgo };
})(typeof globalThis !== 'undefined' ? globalThis : this);
