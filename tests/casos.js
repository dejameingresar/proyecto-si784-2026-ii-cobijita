/* =====================================================================
   DespliegaUML · app/tests/casos.js
   Suite de pruebas unitarias del modelo, del motor de reglas (R-01..R-19)
   y del generador de plan de despliegue.
   Ejecutar:  node app/tests/casos.js [filtro]
   ===================================================================== */
(function () {
  'use strict';
  var fs = require('fs');
  var path = require('path');
  var vm = require('vm');

  var SRC = path.join(__dirname, '..', 'src');
  ['modelo.js', 'reglas.js', 'plan.js', 'pruebas.js', 'puml.js'].forEach(function (f) {
    vm.runInThisContext(fs.readFileSync(path.join(SRC, f), 'utf8'), { filename: f });
  });

  var DPL = globalThis.DPL;
  var M = DPL.Modelo;
  var t = DPL.pruebas.corredor();
  var describe = t.describe, it = t.it, expect = t.expect;
  var F = DPL.pruebas.fabrica();

  DPL.SEC = 1789000000; /* reloj congelado para salidas deterministas */

  function reglasDe(res, id) {
    return res.hallazgos.filter(function (h) { return h.regla === id; });
  }
  function severidades(res, id) {
    return reglasDe(res, id).map(function (h) { return h.severidad; });
  }
  function eliminarPorRegla(m, id) { /* utilidades para construir modelos válidos */
    return m;
  }

  /* ================================================================
     MODELO DE DOMINIO
     ================================================================ */
  describe('Modelo de dominio', function () {
    it('T-01 crea un modelo vacío con todas las colecciones', function () {
      var m = M.nuevo();
      expect(m.componentes).toHaveLength(0);
      expect(m.conectores).toHaveLength(0);
      expect(m.nodos).toHaveLength(0);
      expect(m.artefactos).toHaveLength(0);
      expect(m.realizaciones).toHaveLength(0);
      expect(m.caminos).toHaveLength(0);
    });

    it('T-02 genera identificadores correlativos por tipo', function () {
      var m = M.nuevo();
      expect(M.agregarComponente(m, { nombre: 'A' }).id).toBe('C1');
      expect(M.agregarComponente(m, { nombre: 'B' }).id).toBe('C2');
      expect(M.agregarNodo(m, { nombre: 'N' }).id).toBe('N1');
      expect(M.agregarArtefacto(m, { nombre: 'A1' }).id).toBe('A1');
      expect(M.agregarRealizacion(m, { artefacto: 'A1', nodo: 'N1' }).id).toBe('R1');
    });

    it('T-03 acepta identificadores explícitos sin romper la secuencia', function () {
      var m = M.nuevo();
      M.agregarComponente(m, { id: 'CX', nombre: 'A' });
      expect(M.agregarComponente(m, { nombre: 'B' }).id).toBe('C1');
    });

    it('T-04 numera los caminos con prefijo propio (CP) para no chocar con componentes', function () {
      var m = M.nuevo();
      M.agregarComponente(m, { nombre: 'A' });
      expect(M.agregarCamino(m, { a: 'C1', b: 'C1' }).id).toBe('CP1');
    });

    it('T-05 registra puertos con dirección por defecto provided', function () {
      var m = M.nuevo();
      var c = M.agregarComponente(m, { nombre: 'A' });
      var p = M.agregarPuerto(c, { nombre: 'x', interfaz: 'IX' });
      expect(p.direccion).toBe('provided');
      expect(c.puertos).toHaveLength(1);
    });

    it('T-06 indexa los puertos por componente y por interfaz', function () {
      var m = F.minimoValido();
      var ix = M.indexar(m);
      expect(ix.puertoPorId['C2/p1']).toBeTruthy('puerto C2/p1 indexado');
      expect(ix.puertoPorInterfaz['IServicio']).toHaveLength(2);
    });

    it('T-07 elimina en cascada los conectores de un componente borrado', function () {
      var m = F.minimoValido();
      var ctrl = m.componentes[1];
      expect(M.eliminarEnCascada(m, 'componente', ctrl.id)).toBeTruthy();
      expect(m.conectores).toHaveLength(0);
      expect(m.componentes).toHaveLength(1);
    });

    it('T-08 elimina en cascada las realizaciones de un artefacto borrado', function () {
      var m = F.minimoValido();
      M.eliminarEnCascada(m, 'artefacto', m.artefactos[0].id);
      expect(m.realizaciones).toHaveLength(0);
    });

    it('T-09 al borrar un nodo libera sus hijos, caminos y realizaciones', function () {
      var m = F.webTresNiveles();
      var srv = m.nodos[0];
      var survivors = m.realizaciones.filter(function (r) { return r.nodo !== srv.id; }).length;
      M.eliminarEnCascada(m, 'nodo', srv.id);
      expect(m.caminos).toHaveLength(0, 'los caminos que tocan el nodo se eliminan');
      expect(m.realizaciones).toHaveLength(survivors, 'sólo se eliminan las realizaciones del nodo');
      expect(m.nodos).toHaveLength(1, 'el nodo eliminado ya no está');
    });

    it('T-10 normaliza modelos que llegan sin colecciones completas', function () {
      var m = M.normalizar({ componentes: [{ id: 'C1', nombre: 'A' }] });
      expect(m.nodos).toHaveLength(0);
      expect(m.componentes[0].puertos).toHaveLength(0);
    });

    it('T-11 clona sin compartir estructura', function () {
      var m = F.minimoValido();
      var c = M.clonar(m);
      c.componentes[0].nombre = 'otro';
      expect(m.componentes[0].nombre).toBe('Interfaz de usuario');
    });
  });

  /* ================================================================
     MOTOR DE REGLAS · CASOS POSITIVOS
     ================================================================ */
  describe('Motor de reglas · modelos válidos', function () {
    it('T-12 acepta el modelo mínimo de referencia sin errores', function () {
      var res = DPL.validar(F.minimoValido());
      expect(res.resumen.error).toBe(0, 'errores: ' + JSON.stringify(res.hallazgos.filter(h => h.severidad === 'error')));
      expect(res.valido).toBeTruthy();
    });

    it('T-13 acepta la aplicación web de tres niveles sin errores', function () {
      var res = DPL.validar(F.webTresNiveles());
      expect(res.resumen.error).toBe(0, 'errores: ' + JSON.stringify(reglasDe(res, 'R-05').concat(reglasDe(res, 'R-10'))));
      expect(res.valido).toBeTruthy();
    });

    it('T-14 marca el modelo como válido con cero errores aunque haya avisos', function () {
      var res = DPL.validar(F.webTresNiveles());
      expect(res.valido).toBeTruthy();
      expect(res.resumen.warning + res.resumen.info).toBeGreaterThan(-1);
    });

    it('T-15 ordena los hallazgos por severidad descendente', function () {
      var m = F.webTresNiveles();
      m.componentes[0].nombre = '';          /* R-02 error */
      m.componentes[0].estereotipo = 'x';   /* R-03 error */
      m.nodos[0].cpu = '';                   /* R-14 info  */
      M.agregarNodo(m, { nombre: 'aislado' }); /* R-16 warning */
      var res = DPL.validar(m);
      var peso = { error: 0, warning: 1, info: 2 };
      expect(res.hallazgos.length).toBeGreaterThan(3);
      for (var i = 1; i < res.hallazgos.length; i++) {
        expect(peso[res.hallazgos[i - 1].severidad] <= peso[res.hallazgos[i].severidad]).toBeTruthy();
      }
    });

    it('T-16 informa cuántas reglas se evaluaron', function () {
      var res = DPL.validar(F.minimoValido());
      expect(res.reglasEvaluadas).toBe(DPL.REGLAS.length);
      expect(res.reglasEvaluadas).toBe(19);
    });
  });

  /* ================================================================
     MOTOR DE REGLAS · CASOS NEGATIVOS (una regla por comportamiento)
     ================================================================ */
  describe('Motor de reglas · detección de defectos', function () {
    it('T-17 R-01 detecta identificadores duplicados', function () {
      var m = F.minimoValido();
      m.componentes.push({ id: 'C1', nombre: 'duplicado', estereotipo: 'service', puertos: [], x: 0, y: 0 });
      var res = DPL.validar(m);
      expect(reglasDe(res, 'R-01')).toHaveLength(1);
      expect(reglasDe(res, 'R-01')[0].severidad).toBe('error');
    });

    it('T-18 R-02 detecta elementos sin nombre', function () {
      var m = F.minimoValido();
      m.componentes[0].nombre = '   ';
      var res = DPL.validar(m);
      expect(reglasDe(res, 'R-02')).toHaveLength(1);
    });

    it('T-19 R-03 rechaza estereotipos fuera del catálogo UML', function () {
      var m = F.minimoValido();
      m.componentes[0].estereotipo = 'microservicio';
      m.nodos[0].estereotipo = 'servidor';
      m.artefactos[0].tipo = 'binario';
      var res = DPL.validar(m);
      expect(reglasDe(res, 'R-03')).toHaveLength(3);
    });

    it('T-20 R-03 acepta todos los estereotipos del catálogo', function () {
      var m = F.minimoValido();
      DPL.STEREOTIPOS_COMPONENTE.forEach(function (e, i) { m.componentes[0].estereotipo = e; expect(reglasDe(DPL.validar(m), 'R-03')).toHaveLength(0, e); });
    });

    it('T-21 R-04 detecta conector con componente inexistente', function () {
      var m = F.minimoValido();
      m.conectores[0].desde.componente = 'C99';
      var res = DPL.validar(m);
      expect(reglasDe(res, 'R-04').length).toBeGreaterThan(0);
    });

    it('T-22 R-04 detecta conector con puerto inexistente', function () {
      var m = F.minimoValido();
      m.conectores[0].hacia.puerto = 'p9';
      var res = DPL.validar(m);
      expect(reglasDe(res, 'R-04').length).toBeGreaterThan(0);
    });

    it('T-23 R-04 detecta conector sin un extremo definido', function () {
      var m = F.minimoValido();
      m.conectores[0].desde = null;
      var res = DPL.validar(m);
      expect(reglasDe(res, 'R-04')[0].mensaje).toContain('sin extremo');
    });

    it('T-24 R-05 rechaza provided emparejado con provided', function () {
      var m = F.minimoValido();
      m.componentes[0].puertos[0].direccion = 'provided';
      var res = DPL.validar(m);
      expect(reglasDe(res, 'R-05')).toHaveLength(1);
    });

    it('T-25 R-05 no reporta nada si el conector es simétrico', function () {
      var res = DPL.validar(F.minimoValido());
      expect(reglasDe(res, 'R-05')).toHaveLength(0);
    });

    it('T-26 R-06 avisa de puerto requerido sin conectar', function () {
      var m = F.minimoValido();
      M.agregarPuerto(m.componentes[0], { id: 'p2', nombre: 'extra', direccion: 'required', interfaz: 'IOtro' });
      var res = DPL.validar(m);
      expect(reglasDe(res, 'R-06')).toHaveLength(1);
      expect(reglasDe(res, 'R-06')[0].severidad).toBe('warning');
    });

    it('T-27 R-07 avisa de interfaz publicada sin requeridores', function () {
      var m = F.minimoValido();
      M.agregarPuerto(m.componentes[1], { id: 'p9', nombre: 'huerfana', direccion: 'provided', interfaz: 'IHuerfana' });
      var res = DPL.validar(m);
      expect(reglasDe(res, 'R-07').length).toBeGreaterThan(0);
    });

    it('T-28 R-08 detecta la misma interfaz publicada dos veces en un componente', function () {
      var m = F.minimoValido();
      M.agregarPuerto(m.componentes[1], { id: 'p2', nombre: 'dup', direccion: 'provided', interfaz: 'IServicio' });
      var res = DPL.validar(m);
      expect(reglasDe(res, 'R-08')).toHaveLength(1);
    });

    it('T-29 R-09 detecta realización sin artefacto o sin nodo', function () {
      var m = F.minimoValido();
      m.realizaciones[0].artefacto = 'A99';
      m.realizaciones[0].nodo = null;
      var res = DPL.validar(m);
      expect(reglasDe(res, 'R-09')).toHaveLength(2);
    });

    it('T-30 R-10 detecta artefacto no desplegado en ningún nodo', function () {
      var m = F.minimoValido();
      M.agregarArtefacto(m, { nombre: 'huerfano.jar', tipo: 'executable', componente: m.componentes[1].id });
      var res = DPL.validar(m);
      expect(reglasDe(res, 'R-10')).toHaveLength(1);
    });

    it('T-31 R-10 no reporta artefactos correctamente desplegados', function () {
      expect(reglasDe(DPL.validar(F.minimoValido()), 'R-10')).toHaveLength(0);
    });

    it('T-32 R-11 avisa de componente sin artefacto que lo implemente', function () {
      var m = F.minimoValido();
      m.artefactos[0].componente = null;
      var res = DPL.validar(m);
      expect(reglasDe(res, 'R-11').length).toBeGreaterThan(0);
    });

    it('T-33 R-12 detecta anfitrión inexistente y auto-anidamiento', function () {
      var m = F.minimoValido();
      m.nodos[0].anfitrion = 'N99';
      M.agregarNodo(m, { nombre: 'anidado', anfitrion: m.nodos[0].id });
      m.nodos[1].anfitrion = m.nodos[1].id;
      var res = DPL.validar(m);
      expect(reglasDe(res, 'R-12').length).toBeGreaterThanOrEqual(2);
    });

    it('T-34 R-12 detecta ciclo de jerarquía entre nodos', function () {
      var m = F.minimoValido();
      var n1 = M.agregarNodo(m, { nombre: 'A', anfitrion: null });
      var n2 = M.agregarNodo(m, { nombre: 'B', anfitrion: n1.id });
      n1.anfitrion = n2.id;
      var res = DPL.validar(m);
      expect(reglasDe(res, 'R-12').length).toBeGreaterThan(0);
    });

    it('T-35 R-13 avisa cuando un nodo de ejecución aloja varios ejecutables', function () {
      var m = F.minimoValido();
      var a2 = M.agregarArtefacto(m, { nombre: 'segundo.jar', tipo: 'executable', componente: m.componentes[1].id });
      M.agregarRealizacion(m, { artefacto: a2.id, nodo: m.nodos[0].id });
      var res = DPL.validar(m);
      expect(reglasDe(res, 'R-13')).toHaveLength(1);
    });

    it('T-36 R-14 informa la especificación técnica ausente', function () {
      var m = F.minimoValido();
      m.nodos[0].cpu = '';
      m.nodos[0].memoria = '';
      var res = DPL.validar(m);
      expect(reglasDe(res, 'R-14')[0].mensaje).toContain('memoria');
    });

    it('T-37 R-14 no exige especificación a las regiones cloud', function () {
      var m = F.minimoValido();
      m.nodos[0].estereotipo = 'cloudRegion';
      m.nodos[0].cpu = ''; m.nodos[0].memoria = ''; m.nodos[0].sistemaOperativo = '';
      expect(reglasDe(DPL.validar(m), 'R-14')).toHaveLength(0);
    });

    it('T-38 R-15 detecta caminos con extremos inexistentes, bucles y puertos inválidos', function () {
      var m = F.minimoValido();
      M.agregarCamino(m, { a: 'N9', b: m.nodos[0].id, protocolo: 'TCP', puerto: 80 });
      M.agregarCamino(m, { a: m.nodos[0].id, b: m.nodos[0].id, protocolo: 'TCP', puerto: 8080 });
      M.agregarCamino(m, { a: m.nodos[0].id, b: m.nodos[0].id, protocolo: 'TCP', puerto: 70000 });
      var res = DPL.validar(m);
      expect(reglasDe(res, 'R-15').length).toBeGreaterThanOrEqual(4);
    });

    it('T-39 R-15 avisa de caminos duplicados y sin puerto', function () {
      var m = F.webTresNiveles();
      M.agregarCamino(m, { a: m.nodos[1].id, b: m.nodos[0].id, protocolo: 'TCP', puerto: 5432 });
      M.agregarCamino(m, { a: m.nodos[0].id, b: m.nodos[1].id, protocolo: 'HTTP', puerto: '' });
      var res = DPL.validar(m);
      expect(reglasDe(res, 'R-15').length).toBeGreaterThanOrEqual(2);
    });

    it('T-40 R-16 avisa de nodo aislado', function () {
      var m = F.minimoValido();
      M.agregarNodo(m, { nombre: 'aislado', sistemaOperativo: 'X', cpu: '1', memoria: '1 GB' });
      var res = DPL.validar(m);
      expect(reglasDe(res, 'R-16')).toHaveLength(1);
    });

    it('T-41 R-17 detecta ciclos en el grafo de ensamblaje de componentes', function () {
      var m = F.minimoValido();
      M.agregarConector(m, { desde: { componente: m.componentes[0].id }, hacia: { componente: m.componentes[1].id } });
      var res = DPL.validar(m);
      expect(reglasDe(res, 'R-17').length).toBeGreaterThan(0);
    });

    it('T-42 R-17 no reporta ciclos en un grafo acíclico', function () {
      expect(reglasDe(DPL.validar(F.webTresNiveles()), 'R-17')).toHaveLength(0);
    });

    it('T-43 R-18 detecta conectores que emparejan interfaces distintas', function () {
      var m = F.minimoValido();
      m.componentes[0].puertos[0].interfaz = 'IOtra';
      var res = DPL.validar(m);
      expect(reglasDe(res, 'R-18')).toHaveLength(1);
    });

    it('T-44 R-19 informa interfaces sin par proveedor-requeridor', function () {
      var m = F.minimoValido();
      M.agregarPuerto(m.componentes[0], { id: 'p5', nombre: 'sola', direccion: 'provided', interfaz: 'ISola' });
      var res = DPL.validar(m);
      expect(reglasDe(res, 'R-19').length).toBeGreaterThan(0);
    });

    it('T-45 no reporta hallazgos para una colección vacía salvo los esperados', function () {
      var res = DPL.validar(M.nuevo());
      expect(res.valido).toBeTruthy();
      expect(res.resumen.error).toBe(0);
    });

    it('T-46 captura la excepción de una regla sin abortar la validación', function () {
      var original = DPL.REGLAS[0].fn;
      DPL.REGLAS[0].fn = function () { throw new Error('fallo simulado'); };
      var res = DPL.validar(F.minimoValido());
      DPL.REGLAS[0].fn = original;
      expect(reglasDe(res, 'R-01')[0].mensaje).toContain('fallo simulado');
    });
  });

  /* ================================================================
     GENERADOR DE PLAN DE DESPLIEGUE
     ================================================================ */
  describe('Generador de plan de despliegue', function () {
    it('T-47 genera el plan a partir de un modelo válido', function () {
      var plan = DPL.generarPlan(F.minimoValido());
      expect(plan.fase).toBe('LISTO PARA DESPLIEGUE');
      expect(plan.nodos).toHaveLength(1);
      expect(plan.componentes).toHaveLength(2);
    });

    it('T-48 bloquea el plan si el modelo tiene errores', function () {
      var m = F.minimoValido();
      m.componentes[0].estereotipo = 'inventado';
      var plan = DPL.generarPlan(m);
      expect(plan.fase).toBe('BLOQUEADO');
      expect(plan.baseValidada).toBeFalsy();
    });

    it('T-49 ordena los componentes por nivel de dependencia', function () {
      var plan = DPL.generarPlan(F.webTresNiveles());
      var porId = {};
      plan.componentes.forEach(function (c) { porId[c.id] = c.nivel; });
      /* cadena: C3 base de datos -> C2 lógica de negocio -> C1 servidor web */
      expect(porId['C1']).toBe(3, 'el servidor web depende de la lógica de negocio, que depende de la BD');
      expect(porId['C2']).toBe(2, 'la lógica de negocio depende de la base de datos');
      expect(porId['C3']).toBe(1, 'la base de datos no depende de nadie');
      expect(plan.componentes[0].id).toBe('C3', 'el plan empieza por lo que no tiene dependencias');
      expect(plan.componentes[plan.componentes.length - 1].id).toBe('C1', 'el plan termina en el consumidor final');
    });

    it('T-50 detecta ciclos al calcular el orden topológico', function () {
      var m = F.minimoValido();
      M.agregarConector(m, { desde: { componente: m.componentes[0].id }, hacia: { componente: m.componentes[1].id } });
      var top = DPL.planDeDespliegue.ordenTopologico(m);
      expect(top.ciclo.length).toBeGreaterThan(0);
    });

    it('T-51 incluye la ficha técnica de cada nodo', function () {
      var plan = DPL.generarPlan(F.webTresNiveles());
      var app = plan.nodos.filter(function (n) { return n.nombre === 'Servidor de aplicación'; })[0];
      expect(app.sistemaOperativo).toBe('Debian 13');
      expect(app.artefactos.length).toBeGreaterThan(0);
    });

    it('T-52 registra supuestos cuando falta la especificación técnica', function () {
      var m = F.minimoValido();
      m.nodos[0].cpu = '';
      var plan = DPL.generarPlan(m);
      expect(plan.supuestos.length).toBeGreaterThan(0);
    });

    it('T-53 crea una fase por nivel de despliegue más verificación', function () {
      var plan = DPL.generarPlan(F.webTresNiveles());
      expect(plan.fases.length).toBeGreaterThanOrEqual(4);
      expect(plan.fases[plan.fases.length - 1].nombre).toContain('Verificación');
    });

    it('T-54 cubre todos los nodos y artefactos del modelo en el plan', function () {
      var m = F.webTresNiveles();
      var plan = DPL.generarPlan(m);
      expect(plan.resumen.nodos).toBe(m.nodos.length);
      expect(plan.resumen.artefactos).toBe(m.artefactos.length);
      expect(plan.resumen.artefactosDesplegados).toBe(m.artefactos.length);
    });

    it('T-55 renderiza el plan en Markdown con todas las secciones', function () {
      var md = DPL.planDeDespliegue.aMarkdown(DPL.generarPlan(F.webTresNiveles()));
      ['# Plan de despliegue', '## 1. Topología de nodos', '## 2. Orden de despliegue por nivel',
        '## 3. Fases de despliegue', '## 4. Supuestos pendientes'].forEach(function (s) {
          expect(md).toContain(s);
        });
    });

    it('T-56 usa una marca de tiempo inyectada para salidas deterministas', function () {
      var plan = DPL.generarPlan(F.minimoValido());
      expect(plan.generado).toBe(new Date(DPL.SEC * 1000).toISOString(), 'el plan respeta el reloj congelado');
      expect(plan.generado).toBe('2026-09-10T00:26:40.000Z');
    });

    it('T-57 con el reloj real (SEC=0) la marca es la hora actual, no el epoch', function () {
      DPL.SEC = 0;
      var antes = Date.now();
      var plan = DPL.generarPlan(F.minimoValido());
      DPL.SEC = 1789000000;
      var marca = Date.parse(plan.generado);
      expect(marca >= antes - 2000).toBeTruthy('no debe caer en 1970');
      expect(marca <= Date.now() + 2000).toBeTruthy('no debe estar en el futuro');
    });
  });

  /* ================================================================
     PERSISTENCIA / EXPORTACIÓN
     ================================================================ */
  describe('Persistencia del modelo', function () {
    it('T-58 el modelo sobrevive a un ciclo de serialización JSON', function () {
      var m = F.webTresNiveles();
      var r = DPL.validar(JSON.parse(JSON.stringify(m)));
      expect(r.resumen.error).toBe(0);
    });

    it('T-59 el plan generado es serializable', function () {
      var plan = DPL.generarPlan(F.webTresNiveles());
      var s = JSON.stringify(plan);
      expect(s.length).toBeGreaterThan(100);
      expect(JSON.parse(s).componentes.length).toBe(plan.componentes.length);
    });
  });

  /* ================================================================
     INTEROPERABILIDAD PLANTUML
     ================================================================ */
  describe('Interoperabilidad con PlantUML', function () {
    it('T-60 exporta las dos vistas en un .puml válido', function () {
      var puml = DPL.puml.exportar(F.webTresNiveles());
      expect(puml).toContain('@startuml');
      expect(puml).toContain('@enduml');
      expect(puml).toContain('"Diagrama de componentes"');
      expect(puml).toContain('"Diagrama de despliegue"');
      expect(puml).toContain('component "Servidor web" as C1 <<application>>');
    });

    it('T-61 reimporta su propia exportación sin perder componentes ni nodos', function () {
      var original = F.webTresNiveles();
      var r = DPL.puml.importar(DPL.puml.exportar(original));
      expect(r.modelo.componentes).toHaveLength(original.componentes.length);
      expect(r.modelo.nodos).toHaveLength(original.nodos.length);
      expect(r.modelo.conectores.length).toBe(original.conectores.length);
      expect(r.modelo.artefactos).toHaveLength(original.artefactos.length);
      expect(r.modelo.realizaciones).toHaveLength(original.realizaciones.length);
      expect(r.modelo.caminos).toHaveLength(original.caminos.length);
      expect(r.errores).toHaveLength(0);
    });

    it('T-62 el round-trip preserva la ficha técnica de nodos y artefactos', function () {
      var original = F.webTresNiveles();
      var m = DPL.puml.importar(DPL.puml.exportar(original)).modelo;
      var n1 = M.buscarNodo(m, 'N1');
      expect(n1.sistemaOperativo).toBe('Debian 13');
      expect(n1.cpu).toBe('4 vCPU');
      expect(n1.memoria).toBe('8 GB');
      var a1 = M.buscarArtefacto(m, 'A1');
      expect(a1.archivo).toBe('dist/app.jar');
      expect(a1.version).toBe('2.1.0');
      expect(a1.componente).toBe('C2');
    });

    it('T-63 el modelo reimportado sigue siendo válido', function () {
      var m = DPL.puml.importar(DPL.puml.exportar(F.webTresNiveles())).modelo;
      var res = DPL.validar(m);
      expect(res.reglasEvaluadas).toBe(19);
      expect(res.resumen.error).toBe(0, 'el round-trip no debe introducir errores: ' +
        JSON.stringify(res.hallazgos.filter(function (h) { return h.severidad === 'error'; })));
      expect(res.valido).toBeTruthy();
    });

    it('T-64 conserva los identificadores de puerto en el round-trip', function () {
      var m = DPL.puml.importar(DPL.puml.exportar(F.webTresNiveles())).modelo;
      var c2 = M.buscarComponente(m, 'C2');
      expect(c2.puertos).toHaveLength(2);
      expect(c2.puertos[0].id).toBe('p1');
      expect(c2.puertos[0].direccion).toBe('provided');
      expect(c2.puertos[1].id).toBe('p2');
      expect(c2.puertos[1].direccion).toBe('required');
    });
  });

  /* ================================================================
     Salida
     ================================================================ */
  var filtro = process.argv[2];
  var res = t.ejecutar(filtro);
  console.log('');
  console.log('  DespliegaUML · suite de pruebas unitarias');
  console.log('  ' + '-'.repeat(56));
  t.suites.forEach(function (s) {
    console.log('  ' + s.nombre);
  });
  console.log('  ' + '-'.repeat(56));
  if (res.fallidos) {
    console.log('\n  FALLOS:');
    res.fallos.forEach(function (f) {
      console.log('   ✗ [' + f.suite + '] ' + f.caso);
      console.log('     ' + f.error);
    });
  }
  console.log('');
  console.log('  Casos: ' + res.total + ' · exitosos: ' + res.exitosos +
    ' · fallidos: ' + res.fallidos + ' · cobertura: ' + res.coberturaPct + '% · ' + res.duracionMs + ' ms');
  console.log('  Reglas de consistencia cubiertas: ' + DPL.REGLAS.length + ' (R-01..R-19)');
  console.log('');
  process.exit(res.fallidos ? 1 : 0);
})();
