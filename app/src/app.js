/* =====================================================================
   DespliegaUML · src/app.js
   Controlador de la interfaz: herramientas, lienzo SVG, inspector,
   panel de validación, catálogo de reglas y generación del plan.
   Sin dependencias.
   ===================================================================== */
(function () {
  'use strict';
  var DPL = window.DPL;
  var M = DPL.Modelo;
  var A = DPL.almacen;

  var estado = {
    modelo: M.nuevo(),
    vista: 'componentes',
    herramienta: null,   /* 'componente' | 'puerto' | 'conector' | 'nodo' | 'artefacto' | 'realizacion' | 'camino' | 'mover' */
    seleccion: null,      /* {tipo, id} */
    pendiente: null,      /* contexto de una conexión a medio hacer */
    ultimoPlan: null
  };

  var $ = function (sel) { return document.querySelector(sel); };
  var svg = $('#svg');

  /* ================================================================
     Utilidades de interfaz
     ================================================================ */
  function tostador() {
    var cont = document.createElement('div');
    cont.id = 'tostador';
    document.body.appendChild(cont);
    return cont;
  }
  var TOST = tostador();

  function avisar(texto, tipo) {
    var d = document.createElement('div');
    d.className = 'tostador-item ' + (tipo || '');
    d.textContent = texto;
    TOST.appendChild(d);
    setTimeout(function () { d.remove(); }, 3200);
  }

  function opciones(arreglo, seleccionado) {
    return arreglo.map(function (v) {
      return '<option value="' + v + '"' + (v === seleccionado ? ' selected' : '') + '>' + v + '</option>';
    }).join('');
  }

  function idDeTipo(tipo, plural) {
    return estado.modelo[plural].map(function (e) { return e.id; });
  }

  /* ================================================================
     Validación + refresco
     ================================================================ */
  function validar() {
    var res = DPL.validar(estado.modelo);
    var porCola = {};
    ['componentes', 'nodos', 'artefactos', 'conectores', 'caminos'].forEach(function (c) { porCola[c] = []; });
    res.hallazgos.forEach(function (h) {
      if (h.severidad === 'info') return;
      if (h.donde && porCola[h.donde] && h.elemento) porCola[h.donde].push(h.elemento);
    });
    return { res: res, invalidos: porCola };
  }

  function refrescar() {
    var v = validar();
    var esTexto = (estado.vista === 'reglas' || estado.vista === 'plan');
    $('#svg').classList.toggle('oculto', esTexto);
    $('#panel-texto').classList.toggle('oculto', !esTexto);
    $('#pista').classList.toggle('oculto', esTexto);

    if (estado.vista === 'componentes') {
      DPL.vista.dibujarComponentes(svg, estado.modelo, { invalidos: v.invalidos });
    } else if (estado.vista === 'despliegue') {
      DPL.vista.dibujarDespliegue(svg, estado.modelo, { invalidos: v.invalidos });
    } else if (estado.vista === 'reglas') {
      dibujarReglas(v.res);
    } else if (estado.vista === 'plan') {
      mostrarPlan(false);
    }

    dibujarResumen(v.res);
    if (estado.vista === 'componentes' || estado.vista === 'despliegue') dibujarHallazgos(v.res);
    dibujarInspector();
    dibujarHerramientas();
    $('#titulo-vista').textContent = estado.vista === 'componentes'
      ? 'Diagrama de componentes'
      : estado.vista === 'despliegue' ? 'Diagrama de despliegue'
      : estado.vista === 'reglas' ? 'Catálogo de reglas de consistencia'
      : 'Plan de despliegue';
    A.guardar(estado.modelo);
  }

  /* ---------- Resumen e indicadores ---------- */
  function dibujarResumen(res) {
    var r = res.resumen;
    var html = '<div class="insignia error"><b>' + r.error + '</b>errores</div>' +
      '<div class="insignia warning"><b>' + r.warning + '</b>advertencias</div>' +
      '<div class="insignia info"><b>' + r.info + '</b>avisos</div>' +
      '<div class="insignia"><b>' + res.reglasEvaluadas + '</b>reglas</div>';
    $('#resumen-validacion').innerHTML = html;
    $('.veredicto') && ($('.veredicto').remove());
    var v = document.createElement('div');
    v.className = 'veredicto ' + (res.valido ? 'ok' : 'mal');
    v.textContent = res.valido
      ? '✔ Modelo consistente — el plan de despliegue puede generarse.'
      : '✘ Modelo inconsistente — corrige los ' + r.error + ' errores antes de desplegar.';
    $('#resumen-validacion').parentNode.insertBefore(v, $('#lista-hallazgos'));
  }

  function dibujarHallazgos(res) {
    if (!res.hallazgos.length) {
      $('#lista-hallazgos').innerHTML = '<div class="hallazgo info"><span class="et">OK</span>' +
        '<div class="cuerpo">Ninguna regla de consistencia detecta desviaciones.</div></div>';
      return;
    }
    $('#lista-hallazgos').innerHTML = res.hallazgos.map(function (h) {
      return '<div class="hallazgo ' + h.severidad + '" data-dest="' + (h.elemento || '') + '" data-donde="' + h.donde + '">' +
        '<span class="et">' + h.regla + '</span>' +
        '<div class="cuerpo">' + h.mensaje +
        (h.regla ? ' <code>' + (DPL.REGLA_POR_ID[h.regla] ? DPL.REGLA_POR_ID[h.regla].nombre : '') + '</code>' : '') +
        '</div></div>';
    }).join('');
  }

  /* ---------- Catálogo de reglas ---------- */
  function dibujarReglas(res) {
    var conteo = {};
    res.hallazgos.forEach(function (h) {
      if (!conteo[h.regla]) conteo[h.regla] = { error: 0, warning: 0, info: 0 };
      conteo[h.regla][h.severidad]++;
    });
    var tarjetas = DPL.REGLAS.map(function (r) {
      var c = conteo[r.id] || { error: 0, warning: 0, info: 0 };
      var total = c.error + c.warning + c.info;
      var clase = total === 0 ? 'cero' : (c.error ? 'error' : (c.warning ? 'warning' : 'info'));
      return '<div class="regla"><header>' +
        '<span class="cod">' + r.id + '</span>' +
        '<span class="nom">' + r.nombre + '</span>' +
        '<span class="conteo ' + clase + '">' + (total === 0 ? 'sin hallazgos' : total + ' hallazgo' + (total > 1 ? 's' : '')) + '</span>' +
        '</header><div class="razon"><strong>Por qué:</strong> ' + r.razon + '</div></div>';
    }).join('');
    $('#panel-texto').innerHTML =
      '<p class="intro">Cada regla es una restricción de consistencia del modelo. ' +
      'El motor evalúa las <strong>' + DPL.REGLAS.length + '</strong> reglas en cada cambio y marca ' +
      'en rojo los elementos que incumplen. Regla de decisión: <strong>0 errores ⇒ el plan de despliegue ' +
      'puede generarse</strong>; con al menos un error el plan queda bloqueado.</p>' +
      '<div class="rejilla-reglas">' + tarjetas + '</div>';
  }

  /* ================================================================
     Inspector
     ================================================================ */
  function dibujarInspector() {
    var caja = $('#inspector');
    var s = estado.seleccion;
    if (!s) {
      caja.innerHTML = '<p class="vacio">Ningún elemento seleccionado. Elige una herramienta para crear ' +
        'o haz clic en un elemento del diagrama.</p>';
      return;
    }
    if (s.tipo === 'componente') return inspeccionarComponente(s.id);
    if (s.tipo === 'nodo') return inspeccionarNodo(s.id);
    if (s.tipo === 'artefacto') return inspeccionarArtefacto(s.id);
    if (s.tipo === 'conector') return inspeccionarConector(s.id);
    if (s.tipo === 'camino') return inspeccionarCamino(s.id);
    if (s.tipo === 'realizacion') return inspeccionarRealizacion(s.id);
  }

  function botonBorrar(tipo, id) {
    return '<button class="peligro mini" data-accion="borrar" data-tipo="' + tipo + '" data-id="' + id + '">Eliminar</button>';
  }

  function inspeccionarComponente(id) {
    var c = M.buscarComponente(estado.modelo, id);
    if (!c) return;
    var html = '<div class="campo"><label>Identificador</label><input type="text" value="' + c.id + '" disabled></div>' +
      '<div class="campo"><label>Nombre</label><input type="text" data-campo="nombre" value="' + c.nombre + '"></div>' +
      '<div class="campo"><label>Estereotipo (UML 2)</label><select data-campo="estereotipo">' +
      opciones(DPL.STEREOTIPOS_COMPONENTE, c.estereotipo) + '</select></div>' +
      '<div class="campo"><label>Descripción</label><input type="text" data-campo="descripcion" value="' + (c.descripcion || '') + '"></div>';

    html += '<h3 class="sub">Puertos</h3>';
    if (!c.puertos.length) {
      html += '<p class="vacio">Sin puertos. Usa «Añadir puerto» para declarar las interfaces que publica o requiere.</p>';
    } else {
      html += '<table class="mini"><tr><th>ID</th><th>Nombre</th><th>Dir.</th><th>Interfaz</th><th></th></tr>';
      c.puertos.forEach(function (p) {
        html += '<tr><td>' + p.id + '</td><td>' + p.nombre + '</td><td>' +
          (p.direccion === 'provided' ? 'provided ■' : 'required ▫') + '</td><td>' + p.interfaz + '</td>' +
          '<td><button class="peligro mini" data-accion="borrar-puerto" data-id="' + c.id + '" data-pid="' + p.id + '">×</button></td></tr>';
      });
      html += '</table>';
    }
    html += '<div class="fila" style="margin-top:8px">' +
      '<input type="text" id="nuevo-puerto-nombre" placeholder="nombre del puerto">' +
      '<select id="nuevo-puerto-dir">' + opciones(['provided', 'required'], 'required') + '</select>' +
      '<input type="text" id="nuevo-puerto-iface" placeholder="interfaz">' +
      '<button class="mini" data-accion="add-puerto" data-id="' + c.id + '">+</button></div>';

    var arts = estado.modelo.artefactos.filter(function (a) { return a.componente === c.id; });
    html += '<h3 class="sub">Artefactos que lo materializan</h3>';
    html += arts.length
      ? '<ul style="margin:4px 0 0 16px;padding:0;font-size:12px">' + arts.map(function (a) {
          return '<li>' + a.id + ' — ' + a.nombre + ' v' + a.version + ' («' + a.tipo + '»)</li>';
        }).join('') + '</ul>'
      : '<p class="vacio">Ninguno (regla R-11 lo Wealth avisará).</p>';

    html += '<div style="margin-top:14px">' + botonBorrar('componente', c.id) + '</div>';
    $('#inspector').innerHTML = html;
  }

  function inspeccionarNodo(id) {
    var n = M.buscarNodo(estado.modelo, id);
    if (!n) return;
    var anfitriones = [''].concat(estado.modelo.nodos.filter(function (o) { return o.id !== id; })
      .map(function (o) { return o.id + ' (' + o.nombre + ')'; }));
    var html = '<div class="campo"><label>Identificador</label><input type="text" value="' + n.id + '" disabled></div>' +
      '<div class="campo"><label>Nombre</label><input type="text" data-campo="nombre" value="' + n.nombre + '"></div>' +
      '<div class="campo"><label>Estereotipo</label><select data-campo="estereotipo">' +
      opciones(DPL.STEREOTIPOS_NODO, n.estereotipo) + '</select></div>' +
      '<div class="campo"><label>Anfitrión (jerarquía)</label><select data-campo="anfitrion">' +
      opciones(anfitriones, n.anfitrion || '') + '</select></div>' +
      '<div class="campo"><label>Sistema operativo</label><input type="text" data-campo="sistemaOperativo" value="' + (n.sistemaOperativo || '') + '" placeholder="Debian 13"></div>' +
      '<div class="campo"><label>CPU</label><input type="text" data-campo="cpu" value="' + (n.cpu || '') + '" placeholder="4 vCPU"></div>' +
      '<div class="campo"><label>Memoria</label><input type="text" data-campo="memoria" value="' + (n.memoria || '') + '" placeholder="8 GB"></div>';

    var arts = (estado.modelo.realizaciones || []).filter(function (r) { return r.nodo === id; });
    html += '<h3 class="sub">Artefactos alojados</h3>';
    html += arts.length
      ? '<ul style="margin:4px 0 0 16px;padding:0;font-size:12px">' + arts.map(function (r) {
          var a = M.buscarArtefacto(estado.modelo, r.artefacto);
          return '<li>' + (a ? a.id + ' — ' + a.nombre + ' v' + a.version : r.artefacto) + '</li>';
        }).join('') + '</ul>'
      : '<p class="vacio">Ninguno. Usa «Realizar artefacto» para alojar un artefacto aquí.</p>';

    html += '<div style="margin-top:14px">' + botonBorrar('nodo', id) + '</div>';
    $('#inspector').innerHTML = html;
  }

  function inspeccionarArtefacto(id) {
    var a = M.buscarArtefacto(estado.modelo, id);
    if (!a) return;
    var comps = [''].concat(estado.modelo.componentes.map(function (c) { return c.id + ' (' + c.nombre + ')'; }));
    var html = '<div class="campo"><label>Identificador</label><input type="text" value="' + a.id + '" disabled></div>' +
      '<div class="campo"><label>Nombre</label><input type="text" data-campo="nombre" value="' + a.nombre + '"></div>' +
      '<div class="campo"><label>Tipo</label><select data-campo="tipo">' + opciones(DPL.TIPOS_ARTIFACTO, a.tipo) + '</select></div>' +
      '<div class="campo"><label>Ruta del archivo</label><input type="text" data-campo="archivo" value="' + (a.archivo || '') + '" placeholder="dist/app.jar"></div>' +
      '<div class="campo"><label>Versión</label><input type="text" data-campo="version" value="' + a.version + '"></div>' +
      '<div class="campo"><label>Componente que lo realiza</label><select data-campo="componente">' +
      opciones(comps, a.componente || '') + '</select></div>';

    var realized = (estado.modelo.realizaciones || []).filter(function (r) { return r.artefacto === id; });
    html += '<h3 class="sub">Realización en nodos</h3>';
    html += realized.length
      ? '<ul style="margin:4px 0 0 16px;padding:0;font-size:12px">' + realized.map(function (r) {
          var n = M.buscarNodo(estado.modelo, r.nodo);
          return '<li>' + (n ? n.id + ' — ' + n.nombre : r.nodo) + '</li>';
        }).join('') + '</ul>'
      : '<p class="vacio">No se realiza en ningún nodo: la regla R-10 bloqueará el plan.</p>';

    html += '<div style="margin-top:14px">' + botonBorrar('artefacto', id) + '</div>';
    $('#inspector').innerHTML = html;
  }

  function inspeccionarConector(id) {
    var k = M.porId(estado.modelo.conectores, id);
    if (!k) return;
    var d = k.desde || {}, h = k.hacia || {};
    var html = '<div class="campo"><label>Identificador</label><input type="text" value="' + k.id + '" disabled></div>' +
      '<div class="campo"><label>Desde (interfaz publicada)</label><input type="text" value="' +
      d.componente + ' / ' + (d.puerto || '—') + '" disabled></div>' +
      '<div class="campo"><label>Hacia (interfaz requerida)</label><input type="text" value="' +
      h.componente + ' / ' + (h.puerto || '—') + '" disabled></div>' +
      '<div class="campo"><label>Contrato</label><select data-campo="contrato">' +
      opciones(['uses', 'realiza', 'extiende', 'delega'], k.contrato) + '</select></div>' +
      '<div class="campo"><label>Etiqueta</label><input type="text" data-campo="etiqueta" value="' + (k.etiqueta || '') + '"></div>' +
      '<div style="margin-top:14px">' + botonBorrar('conector', id) + '</div>';
    $('#inspector').innerHTML = html;
  }

  function inspeccionarCamino(id) {
    var c = M.porId(estado.modelo.caminos, id);
    if (!c) return;
    var nodos = estado.modelo.nodos.map(function (n) { return n.id + ' (' + n.nombre + ')'; });
    var html = '<div class="campo"><label>Identificador</label><input type="text" value="' + c.id + '" disabled></div>' +
      '<div class="campo"><label>Nodo origen</label><select data-campo="a">' + opciones(nodos, c.a) + '</select></div>' +
      '<div class="campo"><label>Nodo destino</label><select data-campo="b">' + opciones(nodos, c.b) + '</select></div>' +
      '<div class="campo"><label>Protocolo</label><input type="text" data-campo="protocolo" value="' + c.protocolo + '" placeholder="TCP"></div>' +
      '<div class="campo"><label>Puerto</label><input type="number" data-campo="puerto" value="' + (c.puerto || '') + '" min="1" max="65535"></div>' +
      '<div style="margin-top:14px">' + botonBorrar('camino', id) + '</div>';
    $('#inspector').innerHTML = html;
  }

  function inspeccionarRealizacion(id) {
    var r = M.porId(estado.modelo.realizaciones, id);
    if (!r) return;
    var arts = estado.modelo.artefactos.map(function (a) { return a.id + ' (' + a.nombre + ')'; });
    var nodos = estado.modelo.nodos.map(function (n) { return n.id + ' (' + n.nombre + ')'; });
    var html = '<div class="campo"><label>Identificador</label><input type="text" value="' + r.id + '" disabled></div>' +
      '<div class="campo"><label>Artefacto</label><select data-campo="artefacto">' + opciones(arts, r.artefacto) + '</select></div>' +
      '<div class="campo"><label>Nodo</label><select data-campo="nodo">' + opciones(nodos, r.nodo) + '</select></div>' +
      '<div class="campo"><label>Ruta de instalación</label><input type="text" data-campo="ruta" value="' + (r.ruta || '') + '" placeholder="/opt/app"></div>' +
      '<div style="margin-top:14px">' + botonBorrar('realizacion', id) + '</div>';
    $('#inspector').innerHTML = html;
  }

  /* ================================================================
     Herramientas por vista
     ================================================================ */
  function dibujarHerramientas() {
    var h = $('#herramientas');
    if (estado.vista === 'reglas' || estado.vista === 'plan') { h.innerHTML = ''; return; }
    var defs = estado.vista === 'componentes'
      ? [
          ['mover', 'Mover'], ['componente', '+ Componente'], ['puerto', '+ Puerto'],
          ['conector', '→ Conector (provided→required)']
        ]
      : [
          ['mover', 'Mover'], ['nodo', '+ Nodo'], ['artefacto', '+ Artefacto'],
          ['realizacion', '⊕ Realizar artefacto'], ['camino', '⇄ Camino']
        ];
    h.innerHTML = defs.map(function (d) {
      return '<button class="sec' + (estado.herramienta === d[0] ? ' activo' : '') +
        '" data-herr="' + d[0] + '">' + d[1] + '</button>';
    }).join('') +
      '<button class="sec" data-accion="auto-layout">Auto-organizar</button>';
  }

  function pista(texto) { $('#pista').textContent = texto; }

  /* ================================================================
     Interacción con el lienzo
     ================================================================ */
  function coordenada(evt) {
    var r = svg.getBoundingClientRect();
    var vb = (svg.getAttribute('viewBox') || '0 0 900 560').split(/\s+/).map(Number);
    return {
      x: vb[0] + (evt.clientX - r.left) * (vb[2] / r.width),
      y: vb[1] + (evt.clientY - r.top) * (vb[3] / r.height)
    };
  }

  function elementoEn(evt) {
    var nodo = evt.target;
    while (nodo && nodo !== svg) {
      if (nodo.dataset && (nodo.dataset.id || nodo.dataset.puerto)) return nodo;
      var t = nodo.getAttribute && nodo.getAttribute('transform');
      if (t) {
        var m = t.match(/translate\(([-\d.]+),([-\d.]+)\)/);
        if (m) return { __centro: { x: +m[1], y: +m[2] }, __nodo: nodo };
      }
      nodo = nodo.parentNode;
    }
    return null;
  }

  var arrastrando = null;

  svg.addEventListener('mousedown', function (e) {
    var p = coordenada(e);
    var t = e.target;
    var idAttr = t.getAttribute && t.getAttribute('data-id');
    if (idAttr) {
      var tipo = t.getAttribute('data-tipo');
      estado.seleccion = { tipo: tipo, id: idAttr };
      refrescar();
      if (estado.herramienta === 'mover') {
        arrastrando = { tipo: tipo, id: idAttr, dx: 0, dy: 0 };
      }
      return;
    }
    var nodoSvg = elementoEn(e);
    if (nodoSvg && nodoSvg.__centro) {
      var centro = nodoSvg.__centro;
      if (estado.herramienta === 'mover') {
        arrastrando = { centro: true, dx: centro.x - p.x, dy: centro.y - p.y };
        return;
      }
      if (estado.vista === 'componentes') aplicarHerramientaComponente(centro, nodoSvg.__nodo);
      else aplicarHerramientaDespliegue(centro, nodoSvg.__nodo);
    }
  });

  svg.addEventListener('mousemove', function (e) {
    if (!arrastrando) return;
    var p = coordenada(e);
    if (arrastrando.centro) {
      var g = svg.querySelector('g[transform]');
      return;
    }
    var coleccion = estado.modelo[arrastrando.tipo === 'componente' ? 'componentes' :
      arrastrando.tipo === 'nodo' ? 'nodos' : arrastrando.tipo === 'artefacto' ? 'artefactos' : 'conectores'];
    var e2 = M.porId(coleccion, arrastrando.id);
    if (e2) { e2.x = p.x + (arrastrando.dx || 0); e2.y = p.y + (arrastrando.dy || 0); }
    refrescar();
  });

  document.addEventListener('mouseup', function () {
    if (arrastrando) { arrastrando = null; A.guardar(estado.modelo); }
  });

  function aplicarHerramientaComponente(p, nodoSvg) {
    if (estado.herramienta === 'componente') {
      var c = M.agregarComponente(estado.modelo, { nombre: 'Componente nuevo', x: p.x, y: p.y });
      estado.seleccion = { tipo: 'componente', id: c.id };
      estado.herramienta = null;
      avisar('Componente ' + c.id + ' creado. Edítalo en el inspector.', 'bien');
    } else if (estado.herramienta === 'puerto') {
      var id = nodoSvg && nodoSvg.parentNode && nodoSvg.parentNode.querySelector('text');
      var comp = elementoComponenteDesdeSvg(nodoSvg);
      if (comp) {
        var n = comp.puertos.length + 1;
        M.agregarPuerto(comp, { id: 'p' + n, nombre: 'interfaz' + n, direccion: 'required', interfaz: 'I' + comp.id + n });
        avisar('Puerto añadido a ' + comp.id + '.', 'bien');
      }
    } else if (estado.herramienta === 'conector') {
      var comp2 = elementoComponenteDesdeSvg(nodoSvg);
      if (!comp2) return;
      if (!estado.pendiente) {
        estado.pendiente = { id: comp2.id, puerto: primerPuerto(comp2, 'provided') };
        estado.seleccion = { tipo: 'componente', id: comp2.id };
        pista('Ahora haz clic en el componente que requiere la interfaz.');
        avisar('Origen del conector: ' + comp2.id);
      } else if (estado.pendiente.id !== comp2.id) {
        M.agregarConector(estado.modelo, {
          desde: { componente: estado.pendiente.id, puerto: estado.pendiente.puerto },
          hacia: { componente: comp2.id, puerto: primerPuerto(comp2, 'required') }
        });
        estado.pendiente = null;
        estado.herramienta = null;
        avisar('Conector creado.', 'bien');
      } else {
        avisar('El origen y el destino deben ser componentes distintos.', 'mal');
      }
      refrescar();
    } else {
      estado.seleccion = null;
      refrescar();
    }
  }

  function aplicarHerramientaDespliegue(p, nodoSvg) {
    if (estado.herramienta === 'nodo') {
      var n = M.agregarNodo(estado.modelo, { nombre: 'Nodo nuevo', x: p.x, y: p.y });
      estado.seleccion = { tipo: 'nodo', id: n.id };
      estado.herramienta = null;
      avisar('Nodo ' + n.id + ' creado. Completa SO/CPU/memoria en el inspector.', 'bien');
    } else if (estado.herramienta === 'artefacto') {
      var a = M.agregarArtefacto(estado.modelo, { nombre: 'artefacto.bin', tipo: 'executable', x: p.x, y: p.y });
      estado.seleccion = { tipo: 'artefacto', id: a.id };
      estado.herramienta = null;
      avisar('Artefacto ' + a.id + ' creado. Asígnalo a un componente y a un nodo.', 'bien');
    } else if (estado.herramienta === 'realizacion') {
      var nodo = elementoNodoDesdeSvg(nodoSvg);
      if (!nodo) return;
      if (estado.pendiente && estado.pendiente.artefacto) {
        M.agregarRealizacion(estado.modelo, { artefacto: estado.pendiente.artefacto, nodo: nodo.id });
        estado.pendiente = null;
        estado.herramienta = null;
        avisar('Artefacto realizado en ' + nodo.id + '.', 'bien');
        refrescar();
      } else {
        var arts = estado.modelo.artefactos;
        if (!arts.length) { avisar('Primero crea un artefacto.', 'mal'); return; }
        var sel = prompt('¿Qué artefacto se realiza en ' + nodo.id + '?\n' +
          arts.map(function (x) { return x.id + ' — ' + x.nombre; }).join('\n'), arts[0].id);
        var elegido = arts.filter(function (x) { return x.id === sel; })[0];
        if (elegido) {
          M.agregarRealizacion(estado.modelo, { artefacto: elegido.id, nodo: nodo.id });
          avisar('Artefacto realizado en ' + nodo.id + '.', 'bien');
        }
      }
    } else if (estado.herramienta === 'camino') {
      var n3 = elementoNodoDesdeSvg(nodoSvg);
      if (!n3) return;
      if (!estado.pendiente) {
        estado.pendiente = { nodo: n3.id };
        pista('Ahora haz clic en el nodo destino del camino.');
        avisar('Origen del camino: ' + n3.id);
      } else if (estado.pendiente.nodo !== n3.id) {
        var protocolo = prompt('¿Protocolo y puerto del camino ' + estado.pendiente.nodo + ' → ' + n3.id +
          '? (ej. TCP/5432, HTTP/8080)', 'TCP/5432') || 'TCP/5432';
        var partes = protocolo.split('/');
        M.agregarCamino(estado.modelo, {
          a: estado.pendiente.nodo, b: n3.id,
          protocolo: (partes[0] || 'TCP').toUpperCase(),
          puerto: partes[1] ? parseInt(partes[1], 10) : ''
        });
        estado.pendiente = null;
        estado.herramienta = null;
        avisar('Camino creado.', 'bien');
      } else {
        avisar('El camino no puede unir un nodo consigo mismo.', 'mal');
      }
      refrescar();
    } else {
      estado.seleccion = null;
      refrescar();
    }
  }

  function primerPuerto(comp, direccion) {
    for (var i = 0; i < comp.puertos.length; i++) if (comp.puertos[i].direccion === direccion) return comp.puertos[i].id;
    return null;
  }

  /* Localiza el elemento del modelo a partir del <g> del SVG pulsado,
     comparando la posición con las coordenadas almacenadas. */
  function elementoComponenteDesdeSvg(nodoSvg) {
    if (!nodoSvg) return null;
    var g = nodoSvg.tagName === 'g' ? nodoSvg : nodoSvg.closest ? nodoSvg.closest('g') : null;
    var p = centroDe(g);
    if (!p) return null;
    return estado.modelo.componentes.filter(function (c) {
      return Math.abs(c.x - p.x) < 1 && Math.abs(c.y - p.y) < 1;
    })[0] || null;
  }

  function elementoNodoDesdeSvg(nodoSvg) {
    var g = nodoSvg.tagName === 'g' ? nodoSvg : nodoSvg.closest ? nodoSvg.closest('g') : null;
    var p = centroDe(g);
    if (!p) return null;
    return estado.modelo.nodos.filter(function (n) {
      return Math.abs(n.x - p.x) < 1 && Math.abs(n.y - p.y) < 1;
    })[0] || null;
  }

  function centroDe(g) {
    if (!g) return null;
    var t = g.getAttribute('transform') || '';
    var m = t.match(/translate\(([-\d.]+),\s*([-\d.]+)\)/);
    return m ? { x: +m[1], y: +m[2] } : null;
  }

  /* ================================================================
     Inspector: delegación de eventos
     ================================================================ */
  $('#inspector').addEventListener('input', function (e) {
    var campo = e.target.getAttribute('data-campo');
    if (!campo || !estado.seleccion) return;
    var s = estado.seleccion;
    var obj = null;
    if (s.tipo === 'componente') obj = M.buscarComponente(estado.modelo, s.id);
    if (s.tipo === 'nodo') obj = M.buscarNodo(estado.modelo, s.id);
    if (s.tipo === 'artefacto') obj = M.buscarArtefacto(estado.modelo, s.id);
    if (s.tipo === 'conector') obj = M.porId(estado.modelo.conectores, s.id);
    if (s.tipo === 'camino') obj = M.porId(estado.modelo.caminos, s.id);
    if (s.tipo === 'realizacion') obj = M.porId(estado.modelo.realizaciones, s.id);
    if (!obj) return;
    var valor = e.target.type === 'number' ? (e.target.value === '' ? '' : parseInt(e.target.value, 10)) : e.target.value;
    if (campo === 'componente' || campo === 'artefacto' || campo === 'nodo') {
      /* selects con "C1 (nombre)": se queda con el id */
      valor = String(valor).split(' ')[0] || null;
    }
    obj[campo] = valor;
    A.guardar(estado.modelo);
    if (campo === 'estereotipo' || campo === 'componente' || campo === 'nodo' || campo === 'artefacto') refrescar();
    else dibujarResumen(validar().res), dibujarHallazgos(validar().res);
  });

  $('#inspector').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    var accion = b.getAttribute('data-accion');
    if (accion === 'borrar') {
      var tipo = b.getAttribute('data-tipo'), id = b.getAttribute('data-id');
      M.eliminarEnCascada(estado.modelo, tipo, id);
      estado.seleccion = null;
      avisar('Elemento ' + id + ' eliminado.', 'bien');
      refrescar();
    } else if (accion === 'borrar-puerto') {
      var c = M.buscarComponente(estado.modelo, b.getAttribute('data-id'));
      if (c) {
        c.puertos = c.puertos.filter(function (p) { return p.id !== b.getAttribute('data-pid'); });
        refrescar();
      }
    } else if (accion === 'add-puerto') {
      var comp = M.buscarComponente(estado.modelo, b.getAttribute('data-id'));
      var nom = $('#nuevo-puerto-nombre').value.trim() || 'interfaz';
      var dir = $('#nuevo-puerto-dir').value;
      var ifc = $('#nuevo-puerto-iface').value.trim() || nom;
      if (comp) {
        M.agregarPuerto(comp, { id: 'p' + (comp.puertos.length + 1), nombre: nom, direccion: dir, interfaz: ifc });
        refrescar();
      }
    }
  });

  /* ================================================================
     Barra de herramientas y pestañas
     ================================================================ */
  $('#herramientas').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    if (b.getAttribute('data-accion') === 'auto-layout') return autoOrganizar();
    var h = b.getAttribute('data-herr');
    estado.herramienta = h === estado.herramienta ? null : h;
    estado.pendiente = null;
    if (h === 'conector') pista('Haz clic en el componente que publica la interfaz (origen del conector).');
    else if (h === 'camino') pista('Haz clic en el nodo origen del camino.');
    else if (h === 'realizacion') pista('Haz clic en el nodo que alojará el artefacto.');
    else if (h) pista('Haz clic en el lienzo para crear el elemento.');
    else pista('Selecciona una herramienta o haz clic en un elemento para editarlo.');
    refrescar();
  });

  function autoOrganizar() {
    /* componentes en columnas por nivel de dependencia */
    var nivel = DPL.planDeDespliegue.niveles(estado.modelo);
    var porNivel = {};
    estado.modelo.componentes.forEach(function (c) {
      var n = nivel[c.id] || 1;
      (porNivel[n] = porNivel[n] || []).push(c);
    });
    Object.keys(porNivel).sort().forEach(function (n) {
      porNivel[n].forEach(function (c, i) {
        c.x = 140 + (Number(n) - 1) * 230;
        c.y = 110 + i * 110;
      });
    });
    estado.modelo.nodos.forEach(function (n, i) {
      n.x = 200 + (i % 2) * 420;
      n.y = 160 + Math.floor(i / 2) * 220;
    });
    refrescar();
    avisar('Diagrama reorganizado por niveles de dependencia.', 'bien');
  }

  document.querySelectorAll('.pest').forEach(function (b) {
    b.addEventListener('click', function () {
      activarPestana(b.getAttribute('data-vista'));
    });
  });

  function activarPestana(nombre) {
    var b = document.querySelector('.pest[data-vista="' + nombre + '"]');
    if (!b) return false;
    document.querySelectorAll('.pest').forEach(function (x) { x.classList.remove('activa'); });
    b.classList.add('activa');
    estado.vista = nombre;
    refrescar();
    return true;
  }

  /* ================================================================
     Acciones de la barra superior
     ================================================================ */
  $('#nombre-proyecto').addEventListener('input', function (e) {
    estado.modelo.nombre = e.target.value;
    A.guardar(estado.modelo);
  });

  $('#btn-nuevo').addEventListener('click', function () {
    if (!confirm('¿Empezar un modelo vacío? Se perderá elactual (puedes usar Exportar JSON antes).')) return;
    estado.modelo = M.nuevo();
    estado.seleccion = null;
    $('#nombre-proyecto').value = estado.modelo.nombre;
    refrescar();
    avisar('Modelo nuevo creado.');
  });

  $('#btn-ejemplo').addEventListener('click', function () {
    estado.modelo = DPL.pruebas.fabrica().webTresNiveles();
    estado.modelo.nombre = 'Aplicación web tres niveles';
    $('#nombre-proyecto').value = estado.modelo.nombre;
    autoOrganizar();
    avisar('Ejemplo cargado: aplicación web de tres niveles.', 'bien');
  });

  $('#btn-exportar').addEventListener('click', function () {
    A.descargar(DPL.almacen.nombreLimpio(estado.modelo.nombre) + '.json',
      JSON.stringify(estado.modelo, null, 2), 'application/json');
    avisar('Modelo exportado a JSON.', 'bien');
  });

  $('#btn-exportar-puml').addEventListener('click', function () {
    A.descargar(DPL.almacen.nombreLimpio(estado.modelo.nombre) + '.puml',
      DPL.puml.exportar(estado.modelo), 'text/plain');
    avisar('Diagrama exportado a PlantUML.', 'bien');
  });

  $('#btn-importar').addEventListener('click', function () { $('#archivo-entrada').click(); });
  $('#btn-importar-puml').addEventListener('click', function () { $('#archivo-entrada').click(); });

  $('#archivo-entrada').addEventListener('change', function (e) {
    var f = e.target.files[0];
    if (!f) return;
    var lector = new FileReader();
    lector.onload = function () {
      try {
        if (f.name.endsWith('.puml')) {
          var r = DPL.puml.importar(lector.result);
          estado.modelo = r.modelo;
          avisar('PlantUML importado: ' + estado.modelo.componentes.length + ' componentes, ' +
            estado.modelo.nodos.length + ' nodos.' +
            (r.errores.length ? ' (' + r.errores.length + ' líneas no reconocidas)' : ''), 'bien');
        } else {
          estado.modelo = M.normalizar(JSON.parse(lector.result));
          avisar('Modelo JSON importado.', 'bien');
        }
        $('#nombre-proyecto').value = estado.modelo.nombre;
        refrescar();
      } catch (err) {
        avisar('No se pudo importar: ' + err.message, 'mal');
      }
    };
    lector.readAsText(f);
    e.target.value = '';
  });

  /* ================================================================
     Plan de despliegue
     ================================================================ */
  function mostrarPlan(modal) {
    var plan = DPL.generarPlan(estado.modelo);
    estado.ultimoPlan = plan;
    var md = DPL.planDeDespliegue.aMarkdown(plan);
    if (modal) {
      $('#salida-plan').textContent = md;
      $('#modal').classList.remove('oculto');
    } else {
      $('#panel-texto').innerHTML = '<pre>' + md
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/^/gm, '') + '</pre>';
    }
    return plan;
  }

  $('#btn-plan').addEventListener('click', function () { mostrarPlan(true); });
  $('#btn-cerrar-modal').addEventListener('click', function () { $('#modal').classList.add('oculto'); });
  $('#btn-copiar-plan').addEventListener('click', function () {
    var texto = $('#salida-plan').textContent;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(texto).then(function () { avisar('Plan copiado al portapapeles.', 'bien'); });
    } else avisar('El navegador no permite copiar; selecciona el texto manualmente.', 'mal');
  });
  $('#btn-descargar-plan').addEventListener('click', function () {
    A.descargar('plan-de-despliegue-' + DPL.almacen.nombreLimpio(estado.modelo.nombre) + '.md',
      $('#salida-plan').textContent, 'text/markdown');
    avisar('Plan descargado.', 'bien');
  });

  /* ================================================================
     Arranque
     ================================================================ */
  (function iniciar() {
    DPL.SEC = 0;   /* en el navegador se usa la hora real */
    var guardado = A.cargar();
    if (guardado && (guardado.componentes.length || guardado.nodos.length)) {
      estado.modelo = guardado;
      avisar('Modelo restaurado desde este navegador.', 'bien');
    } else {
      estado.modelo = DPL.pruebas.fabrica().webTresNiveles();
      estado.modelo.nombre = 'Aplicación web tres niveles';
    }
    $('#nombre-proyecto').value = estado.modelo.nombre;
    autoOrganizar();
    refrescar();

    /* enlace profundo: index.html?vista=despliegue  ·  &modal=plan */
    var q = new URLSearchParams(location.search);
    if (q.get('nuevo') === '1') { estado.modelo = M.nuevo(); refrescar(); }
    if (q.get('vista') && !activarPestana(q.get('vista'))) avisar('Pestaña desconocida: ' + q.get('vista'), 'mal');
    if (q.get('modal') === 'plan') mostrarPlan(true);
  })();
})();
