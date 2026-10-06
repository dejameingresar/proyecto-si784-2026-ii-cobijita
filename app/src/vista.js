/* =====================================================================
   DespliegaUML · src/vista.js
   Render del diagrama de componentes y del diagrama de despliegue en SVG.
   Sin dependencias.
   ===================================================================== */
(function (root) {
  'use strict';
  var DPL = (root.DPL = root.DPL || {});
  var M = DPL.Modelo;

  var NS = 'http://www.w3.org/2000/svg';
  var ESTILO_NODO = {
    device: { w: 110, h: 84, rx: 10, etiqueta: '▭' },
    executionEnvironment: { w: 190, h: 120, rx: 8, etiqueta: '▢' },
    deploymentUnit: { w: 150, h: 96, rx: 6, etiqueta: '▣' },
    container: { w: 230, h: 140, rx: 12, etiqueta: '▤' },
    cloudRegion: { w: 260, h: 170, rx: 20, etiqueta: '☁' }
  };
  var ESTILO_COMPONENTE = {
    application: { w: 168, h: 104, etiqueta: '▣' },
    service: { w: 168, h: 104, etiqueta: '▢' },
    library: { w: 168, h: 104, etiqueta: '▤' },
    interface: { w: 168, h: 104, etiqueta: '◯' },
    database: { w: 168, h: 104, etiqueta: '▤' },
    external: { w: 168, h: 104, etiqueta: '▭' }
  };
  var ESTILO_ARTEFACTO = {
    executable: { etiqueta: '▣' },
    library: { etiqueta: '▤' },
    data: { etiqueta: '▤' },
    document: { etiqueta: '▧' }
  };

  function el(nombre, attrs, texto) {
    var e = document.createElementNS(NS, nombre);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (texto !== undefined && texto !== null) e.textContent = texto;
    return e;
  }

  function limpiar(svg) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
  }

  function puntoMedio(a, b) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  function bordeNodo(est, centro, hacia) {
    /* caja rectangular: devuelve el punto del borde en la dirección 'hacia' */
    var dx = hacia.x - centro.x, dy = hacia.y - centro.y;
    if (dx === 0 && dy === 0) return { x: centro.x, y: centro.y };
    var hx = est.w / 2 + 8, hy = est.h / 2 + 8;
    var escala = Math.min(hx / (Math.abs(dx) || 1e-6), hy / (Math.abs(dy) || 1e-6));
    return { x: centro.x + dx * escala, y: centro.y + dy * escala };
  }

  /* ================================================================
     DIAGRAMA DE COMPONENTES
     ================================================================ */
  function dibujarComponentes(svg, modelo, opciones) {
    opciones = opciones || {};
    var ix = M.indexar(modelo);
    limpiar(svg);
    svg.setAttribute('viewBox', '0 0 ' + (opciones.ancho || 900) + ' ' + (opciones.alto || 560));

    /* las conexiones se dibujan primero para que queden detrás de los componentes */
    modelo.conectores.forEach(function (k) {
      var dc = ix.componentes[k.desde && k.desde.componente];
      var hc = ix.componentes[k.hacia && k.hacia.componente];
      if (!dc || !hc) return;
      var ce = ESTILO_COMPONENTE[dc.estereotipo] || ESTILO_COMPONENTE.service;
      var he = ESTILO_COMPONENTE[hc.estereotipo] || ESTILO_COMPONENTE.service;
      var centroD = { x: dc.x, y: dc.y }, centroH = { x: hc.x, y: hc.y };
      var p1 = bordeNodo(ce, centroD, centroH);
      var p2 = bordeNodo(he, centroH, centroD);
      var mala = opciones.invalidos && opciones.invalidos.conectores && opciones.invalidos.conectores.indexOf(k.id) >= 0;
      svg.appendChild(el('line', {
        x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y,
        stroke: mala ? '#dc2626' : '#64748b',
        'stroke-width': mala ? 2.5 : 1.6,
        'stroke-dasharray': k.contrato === 'uses' ? '6 4' : 'none',
        'marker-end': 'url(#punta-componente)'
      }));
      if (k.etiqueta) {
        var m = puntoMedio(p1, p2);
        svg.appendChild(el('text', {
          x: m.x, y: m.y + 4, 'text-anchor': 'middle',
          'font-size': 10.5, fill: '#475569'
        }, k.etiqueta ? k.etiqueta + ' «' + dc.estereotipo + '»→«' + hc.estereotipo + '»' : ''));
      }
    });

    modelo.componentes.forEach(function (c) {
      var est = ESTILO_COMPONENTE[c.estereotipo] || ESTILO_COMPONENTE.service;
      var g = el('g', { transform: 'translate(' + c.x + ',' + c.y + ')' });
      var mala = opciones.invalidos && opciones.invalidos.componentes && opciones.invalidos.componentes.indexOf(c.id) >= 0;

      g.appendChild(el('rect', {
        x: -est.w / 2, y: -est.h / 2, width: est.w, height: est.h,
        rx: 6, fill: '#f8fafc', stroke: mala ? '#dc2626' : '#0f172a',
        'stroke-width': mala ? 2.5 : 1.8
      }));
      /* y la línea de cabecera divide el nombre (UML 2, figura 12) del estereotipo */
      g.appendChild(el('line', {
        x1: -est.w / 2, y1: -est.h / 2 + 26, x2: est.w / 2, y2: -est.h / 2 + 26,
        stroke: mala ? '#dc2626' : '#0f172a', 'stroke-width': 1.2
      }));
      g.appendChild(el('text', { x: 0, y: -est.h / 2 + 19, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 600, fill: '#0f172a' }, c.nombre || '(sin nombre)'));
      g.appendChild(el('text', { x: 0, y: -est.h / 2 + 35, 'text-anchor': 'middle', 'font-size': 10.5, fill: '#64748b' }, '«' + c.estereotipo + '»'));
      g.appendChild(el('text', { x: -est.w / 2 + 6, y: -est.h / 2 - 6, 'font-size': 10, fill: '#94a3b8' }, c.id));

      /* puertos: provided a la derecha (cuadrado lleno), required a la izquierda (hueco) */
      var separacion = Math.min(18, Math.max(13, (est.h - 56) / Math.max(c.puertos.length, 1)));
      c.puertos.forEach(function (p, i) {
        var y = -est.h / 2 + 52 + separacion * i + 6;
        var x = p.direccion === 'provided' ? est.w / 2 : -est.w / 2;
        var simbolo = p.direccion === 'provided'
          ? el('rect', { x: x - 5, y: y - 5, width: 10, height: 10, fill: '#0f172a' })
          : el('rect', { x: x - 5, y: y - 5, width: 10, height: 10, fill: '#f8fafc', stroke: '#0f172a', 'stroke-width': 1.8 });
        simbolo.setAttribute('data-puerto', c.id + '/' + p.id);
        simbolo.setAttribute('data-lado', p.direccion);
        simbolo.style.cursor = 'pointer';
        g.appendChild(simbolo);
        g.appendChild(el('text', {
          x: p.direccion === 'provided' ? x - 11 : x + 11,
          y: y + 4, 'text-anchor': p.direccion === 'provided' ? 'end' : 'start',
          'font-size': 10, fill: '#334155'
        }, p.nombre));
      });
      svg.appendChild(g);
    });

    var defs = el('defs');
    var marker = el('marker', {
      id: 'punta-componente', viewBox: '0 0 10 10', refX: 9, refY: 5,
      markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse'
    });
    marker.appendChild(el('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: '#64748b' }));
    defs.appendChild(marker);
    svg.appendChild(defs);
  }

  /* ================================================================
     DIAGRAMA DE DESPLIEGUE
     ================================================================ */
  function dibujarDespliegue(svg, modelo, opciones) {
    opciones = opciones || {};
    var ix = M.indexar(modelo);
    limpiar(svg);
    svg.setAttribute('viewBox', '0 0 ' + (opciones.ancho || 900) + ' ' + (opciones.alto || 560));

    /* caminos primero */
    modelo.caminos.forEach(function (c) {
      var na = ix.nodos[c.a], nb = ix.nodos[c.b];
      if (!na || !nb) return;
      var ea = ESTILO_NODO[na.estereotipo] || ESTILO_NODO.executionEnvironment;
      var eb = ESTILO_NODO[nb.estereotipo] || ESTILO_NODO.executionEnvironment;
      var p1 = bordeNodo(ea, { x: na.x, y: na.y }, { x: nb.x, y: nb.y });
      var p2 = bordeNodo(eb, { x: nb.x, y: nb.y }, { x: na.x, y: na.y });
      var mala = opciones.invalidos && opciones.invalidos.caminos && opciones.invalidos.caminos.indexOf(c.id) >= 0;
      svg.appendChild(el('line', {
        x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y,
        stroke: mala ? '#dc2626' : '#0891b2',
        'stroke-width': mala ? 2.5 : 1.8,
        'stroke-dasharray': c.protocolo === 'HTTP' || c.protocolo === 'HTTPS' ? 'none' : '5 5'
      }));
      var m = puntoMedio(p1, p2);
      svg.appendChild(el('text', {
        x: m.x, y: m.y - 6, 'text-anchor': 'middle', 'font-size': 11,
        fill: '#0e7490'
      }, c.protocolo + (c.puerto ? ':' + c.puerto : ':¿?')));
    });

    /* nodos, de los más externos a los más internos */
    var orden = modelo.nodos.slice().sort(function (a, b) {
      var ea = ESTILO_NODO[a.estereotipo] || ESTILO_NODO.executionEnvironment;
      var eb = ESTILO_NODO[b.estereotipo] || ESTILO_NODO.executionEnvironment;
      return eb.w * eb.h - ea.w * ea.h;
    });
    orden.forEach(function (n) {
      var est = ESTILO_NODO[n.estereotipo] || ESTILO_NODO.executionEnvironment;
      var g = el('g', { transform: 'translate(' + n.x + ',' + n.y + ')' });
      var mala = opciones.invalidos && opciones.invalidos.nodos && opciones.invalidos.nodos.indexOf(n.id) >= 0;
      g.appendChild(el('rect', {
        x: -est.w / 2, y: -est.h / 2, width: est.w, height: est.h, rx: est.rx,
        fill: n.estereotipo === 'cloudRegion' ? '#eff6ff' : '#f0fdfa',
        stroke: mala ? '#dc2626' : '#0f766e',
        'stroke-width': mala ? 2.5 : 1.8,
        'stroke-dasharray': n.estereotipo === 'container' || n.estereotipo === 'cloudRegion' ? '8 4' : 'none'
      }));
      g.appendChild(el('text', { x: 0, y: -est.h / 2 + 18, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 600, fill: '#0f172a' },
        est.etiqueta + ' ' + (n.nombre || '(sin nombre)')));
      g.appendChild(el('text', { x: 0, y: -est.h / 2 + 34, 'text-anchor': 'middle', 'font-size': 10, fill: '#0f766e' }, '«' + n.estereotipo + '»'));
      g.appendChild(el('text', { x: -est.w / 2 + 6, y: -est.h / 2 - 6, 'font-size': 10, fill: '#94a3b8' }, n.id));
      var spec = [n.sistemaOperativo, n.cpu, n.memoria].filter(Boolean).join(' · ');
      if (spec) g.appendChild(el('text', { x: 0, y: est.h / 2 - 8, 'text-anchor': 'middle', 'font-size': 10, fill: '#475569' }, spec));

      /* artefactos realizados, con el componente que cada uno materializa */
      (ix.artefactosPorNodo[n.id] || []).forEach(function (r, i) {
        var a = ix.artefactos[r.artefacto];
        if (!a) return;
        var y = -est.h / 2 + 52 + i * 22;
        if (y > est.h / 2 - 24) y = est.h / 2 - 24;
        var ea2 = ESTILO_ARTEFACTO[a.tipo] || ESTILO_ARTEFACTO.executable;
        g.appendChild(el('text', { x: -est.w / 2 + 14, y: y, 'font-size': 11, fill: '#0f172a' },
          ea2.etiqueta + ' ' + a.id + ' ' + a.nombre + ' v' + a.version));
        if (a.componente) {
          g.appendChild(el('text', { x: est.w / 2 - 12, y: y, 'text-anchor': 'end',
            'font-size': 10, fill: '#7c3aed' }, '→ ' + a.componente));
        }
      });
      svg.appendChild(g);
    });
  }

  DPL.vista = {
    dibujarComponentes: dibujarComponentes,
    dibujarDespliegue: dibujarDespliegue,
    limpiar: limpiar,
    ESTILO_NODO: ESTILO_NODO,
    ESTILO_COMPONENTE: ESTILO_COMPONENTE
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
