/* =====================================================================
   DespliegaUML · src/plan.js
   Generador del plan de despliegue a partir de un modelo validado.
   - Orden topológico de componentes (respeta el grafo acíclico).
   - Fases de despliegue: preparación, infraestructura, despliegue por
     nivel, verificación, puesta en marcha.
   - Salida: objeto estructurado + texto Markdown + comando de despliegue.
   Sin dependencias.
   ===================================================================== */
(function (root) {
  'use strict';
  var DPL = (root.DPL = root.DPL || {});
  var M = DPL.Modelo;

  /* ---------------------------------------------------------------
     Orden topológico de componentes (Kahn)
     --------------------------------------------------------------- */
  function ordenTopologico(modelo) {
    var indeg = {}, adj = {}, todos = [];
    modelo.componentes.forEach(function (c) { indeg[c.id] = 0; adj[c.id] = []; todos.push(c.id); });
    modelo.conectores.forEach(function (k) {
      if (!k.desde || !k.hacia) return;
      if (indeg[k.hacia.componente] === undefined || adj[k.desde.componente] === undefined) return;
      adj[k.desde.componente].push(k.hacia.componente);
      indeg[k.hacia.componente]++;
    });
    var cola = todos.filter(function (id) { return indeg[id] === 0; });
    var orden = [];
    while (cola.length) {
      var u = cola.shift();
      orden.push(u);
      adj[u].forEach(function (v) {
        if (--indeg[v] === 0) cola.push(v);
      });
    }
    var ciclo = todos.filter(function (id) { return orden.indexOf(id) < 0; });
    return { orden: orden, ciclo: ciclo };
  }

  /* ---------------------------------------------------------------
     Nivel de despliegue de cada componente:
       nivel 1 = no depende de nadie (se despliega primero)
       nivel n = su dependencia más profunda es n-1
     --------------------------------------------------------------- */
  function niveles(modelo) {
    var top = ordenTopologico(modelo);
    var nivel = {};
    var deps = {};   /* componente -> lista de componentes de los que depende */
    modelo.componentes.forEach(function (c) { nivel[c.id] = 1; deps[c.id] = []; });
    modelo.conectores.forEach(function (k) {
      if (!k.desde || !k.hacia) return;
      if (deps[k.hacia.componente] === undefined || nivel[k.desde.componente] === undefined) return;
      deps[k.hacia.componente].push(k.desde.componente);
    });
    /* nivel = 1 + max(nivel de las dependencias). En orden topológico las
       dependencias ya están resueltas, así que una sola pasada basta. */
    top.orden.forEach(function (id) {
      var maximo = 0;
      deps[id].forEach(function (d) { maximo = Math.max(maximo, nivel[d] || 0); });
      nivel[id] = maximo + 1;
    });
    return nivel;
  }

  /* ---------------------------------------------------------------
     Nodos ordenados por profundidad de jerarquía
     --------------------------------------------------------------- */
  function nodosPorProfundidad(modelo) {
    var ix = M.indexar(modelo);
    var prof = {};
    modelo.nodos.forEach(function (n) {
      var d = 0, actual = n, guarda = 0;
      while (actual && actual.anfitrion && ix.nodos[actual.anfitrion] && guarda++ < modelo.nodos.length) {
        d++;
        actual = ix.nodos[actual.anfitrion];
      }
      prof[n.id] = d;
    });
    return modelo.nodos.slice().sort(function (a, b) { return prof[a.id] - prof[b.id]; });
  }

  /* ---------------------------------------------------------------
     Construcción del plan
     --------------------------------------------------------------- */
  function generarPlan(modelo, opciones) {
    opciones = opciones || {};
    modelo = M.normalizar(modelo);
    var validacion = opciones.validacion || DPL.validar(modelo);
    var ix = M.indexar(modelo);
    var nivel = niveles(modelo);
    var top = ordenTopologico(modelo);

    var plan = {
      proyecto: modelo.nombre,
      versionModelo: modelo.version,
      generado: DPL.ahoraIso(),
      baseValidada: validacion.valido,
      resumenValidacion: validacion.resumen,
      fase: validacion.valido ? 'LISTO PARA DESPLIEGUE' : 'BLOQUEADO',
      nodos: [],
      componentes: [],
      fases: [],
      supuestos: [],
      resumen: {}
    };

    /* --- Nodos: ficha técnica + artefactos asignados --------------- */
    nodosPorProfundidad(modelo).forEach(function (n) {
      var arts = (ix.artefactosPorNodo[n.id] || []).map(function (r) {
        return ix.artefactos[r.artefacto];
      }).filter(Boolean);
      plan.nodos.push({
        id: n.id,
        nombre: n.nombre,
        estereotipo: n.estereotipo,
        anfitrion: n.anfitrion,
        sistemaOperativo: n.sistemaOperativo || '(sin declarar)',
        cpu: n.cpu || '(sin declarar)',
        memoria: n.memoria || '(sin declarar)',
        artefactos: arts.map(function (a) {
          return { id: a.id, nombre: a.nombre, tipo: a.tipo, archivo: a.archivo, version: a.version };
        }),
        vecinos: modelo.caminos.filter(function (c) { return c.a === n.id || c.b === n.id; })
          .map(function (c) { return { con: c.a === n.id ? c.b : c.a, protocolo: c.protocolo, puerto: c.puerto }; })
      });
      if (n.estereotipo !== 'cloudRegion' && (!n.sistemaOperativo || !n.cpu || !n.memoria)) {
        plan.supuestos.push('Nodo ' + n.id + ' (' + n.nombre + '): definir SO, CPU y memoria antes del corte de producción.');
      }
    });

    /* --- Componentes: nivel de despliegue y nodo destino ---------- */
    modelo.componentes.forEach(function (c) {
      var arts = (ix.artefactosPorComponente[c.id] || []).map(function (r) {
        return { artefacto: ix.artefactos[r.artefacto], nodo: r.nodo };
      }).filter(function (x) { return x.artefacto; });
      plan.componentes.push({
        id: c.id,
        nombre: c.nombre,
        estereotipo: c.estereotipo,
        nivel: nivel[c.id] || 1,
        artefactos: arts.map(function (x) { return x.artefacto.id + ' v' + x.artefacto.version; }),
        nodoDestino: arts.length ? arts[0].nodo : null,
        dependencias: modelo.conectores.filter(function (k) {
          return k.hacia && k.hacia.componente === c.id;
        }).map(function (k) { return k.desde.componente; })
      });
    });
    plan.componentes.sort(function (a, b) {
      return a.nivel - b.nivel || (a.id < b.id ? -1 : 1);
    });

    /* --- Fases ----------------------------------------------------- */
    var maxNivel = plan.componentes.reduce(function (m, c) { return Math.max(m, c.nivel); }, 0);
    plan.fases = [{ numero: 0, nombre: 'Preparación', detalle: 'Congelar el modelo, versionarlo y aprobar el plan de pruebas.', acciones: [] }];

    var nivelActual = 1;
    var faseNum = 1;
    while (nivelActual <= maxNivel) {
      var delNivel = plan.componentes.filter(function (c) { return c.nivel === nivelActual; });
      plan.fases.push({
        numero: faseNum,
        nombre: 'Fase ' + faseNum + ' · Nivel ' + nivelActual,
        detalle: 'Despliegue de los componentes de nivel ' + nivelActual + '.',
        acciones: delNivel.map(function (c) {
          var inst = c.artefactos.length
            ? 'copiar ' + c.artefactos.join(', ') + ' en el nodo ' + (c.nodoDestino || '(por definir)')
            : 'sin artefacto asociado (bloqueado por R-11)';
          return '[' + c.id + '] ' + c.nombre + ' (' + c.estereotipo + ') → ' + inst;
        })
      });
      nivelActual++;
      faseNum++;
    }

    plan.fases.push({
      numero: faseNum,
      nombre: 'Verificación y puesta en marcha',
      detalle: 'Ejecutar el plan de pruebas sobre el entorno desplegado y abrir servicio.',
      acciones: [
        'Ejecutar los casos de prueba de aceptación del plan de pruebas.',
        'Verificar que cada interfaz requerida responde en el puerto declarado.',
        'Registrar la cobertura de reglas R-01..R-19 sobre el modelo final.'
      ]
    });

    /* --- Métricas del plan ---------------------------------------- */
    plan.resumen = {
      nodos: modelo.nodos.length,
      componentes: modelo.componentes.length,
      artefactos: modelo.artefactos.length,
      conectores: modelo.conectores.length,
      caminos: modelo.caminos.length,
      fases: plan.fases.length,
      niveles: maxNivel,
      artefactosDesplegados: plan.nodos.reduce(function (s, n) { return s + n.artefactos.length; }, 0),
      supuestos: plan.supuestos.length
    };
    if (top.ciclo.length) {
      plan.supuestos.push('Existen componentes en ciclo (' + top.ciclo.join(', ') +
        '); el orden de despliegue no está definido para ellos.');
    }

    return plan;
  }

  /* ---------------------------------------------------------------
     Render a Markdown
     --------------------------------------------------------------- */
  function aMarkdown(plan) {
    var L = [];
    L.push('# Plan de despliegue — ' + plan.proyecto);
    L.push('');
    L.push('- **Modelo**: v' + plan.versionModelo + ' · generado ' + plan.generado);
    L.push('- **Estado**: ' + plan.fase);
    L.push('- **Validación previa**: ' + plan.resumenValidacion.error + ' errores, ' +
      plan.resumenValidacion.warning + ' advertencias, ' + plan.resumenValidacion.info + ' avisos');
    L.push('- **Alcance**: ' + plan.resumen.nodos + ' nodos · ' + plan.resumen.componentes +
      ' componentes · ' + plan.resumen.artefactos + ' artefactos · ' +
      plan.resumen.conectores + ' conectores · ' + plan.resumen.caminos + ' caminos');
    L.push('');

    L.push('## 1. Topología de nodos');
    L.push('');
    L.push('| Nodo | Nombre | Estereotipo | SO | CPU | Memoria | Artefactos | Vecinos |');
    L.push('| :-: | :- | :- | :- | :- | :- | :- | :- |');
    plan.nodos.forEach(function (n) {
      L.push('| ' + n.id + ' | ' + n.nombre + ' | «' + n.estereotipo + '» | ' + n.sistemaOperativo +
        ' | ' + n.cpu + ' | ' + n.memoria + ' | ' +
        (n.artefactos.length ? n.artefactos.map(function (a) { return a.id; }).join(' ') : '—') +
        ' | ' + (n.vecinos.length ? n.vecinos.map(function (v) { return v.con + ':' + v.puerto; }).join(' ') : '—') + ' |');
    });
    L.push('');

    L.push('## 2. Orden de despliegue por nivel');
    L.push('');
    L.push('| Nivel | Componente | Tipo | Nodo destino | Artefactos | Depende de |');
    L.push('| :-: | :- | :- | :- | :- | :- |');
    plan.componentes.forEach(function (c) {
      L.push('| ' + c.nivel + ' | ' + c.id + ' — ' + c.nombre + ' | «' + c.estereotipo + '» | ' +
        (c.nodoDestino || '—') + ' | ' + (c.artefactos.length ? c.artefactos.join(', ') : '—') +
        ' | ' + (c.dependencias.length ? c.dependencias.join(', ') : '—') + ' |');
    });
    L.push('');

    L.push('## 3. Fases de despliegue');
    plan.fases.forEach(function (f) {
      L.push('');
      L.push('### ' + f.nombre);
      L.push('');
      L.push('_' + f.detalle + '_');
      L.push('');
      f.acciones.forEach(function (a) { L.push('- ' + a); });
    });
    L.push('');

    L.push('## 4. Supuestos pendientes');
    L.push('');
    if (!plan.supuestos.length) {
      L.push('- Ninguno: el modelo declara toda la información técnica necesaria.');
    } else {
      plan.supuestos.forEach(function (s) { L.push('- ' + s); });
    }
    L.push('');
    L.push('---');
    L.push('');
    L.push('_Generado automáticamente por DespliegaUML ' + plan.versionModelo +
      ' a partir del diagrama de componentes y despliegue validado._');
    return L.join('\n');
  }

  DPL.generarPlan = generarPlan;
  DPL.planDeDespliegue = { generar: generarPlan, aMarkdown: aMarkdown, ordenTopologico: ordenTopologico, niveles: niveles };
})(typeof globalThis !== 'undefined' ? globalThis : this);
