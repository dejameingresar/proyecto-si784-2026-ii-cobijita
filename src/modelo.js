/* =====================================================================
   DespliegaUML · src/model.js
   Modelo de dominio: diagrama de componentes + diagrama de despliegue.
   Sin dependencias. Se carga igual en el navegador (script clásico)
   y en Node (tests) vía vm.runInThisContext.
   ===================================================================== */
(function (root) {
  'use strict';
  var DPL = (root.DPL = root.DPL || {});

  /* --- Catálogos permitidos (UML 2 / ISO 19100-2) --- */
  DPL.STEREOTIPOS_COMPONENTE = ['application', 'service', 'library', 'interface', 'database', 'external'];
  DPL.STEREOTIPOS_NODO = ['device', 'executionEnvironment', 'deploymentUnit', 'container', 'cloudRegion'];
  DPL.TIPOS_ARTIFACTO = ['executable', 'library', 'data', 'document'];
  DPL.DIRECCIONES_PUERTO = ['provided', 'required'];

  DPL.SEC = 0; /* opcional: si es 0 se usa la hora real; si es >0 congela el reloj (pruebas) */

  /* Marca de tiempo ISO. DPL.SEC > 0 congela el reloj para que las salidas
     sean deterministas; en el navegador se usa la hora real. */
  DPL.ahoraIso = function () {
    return new Date(DPL.SEC > 0 ? DPL.SEC * 1000 : Date.now()).toISOString();
  };

  /* --- Fábrica de elementos ------------------------------------------ */
  function nuevoModelo() {
    return {
      nombre: 'Proyecto sin nombre',
      version: '1.0',
      componentes: [],
      conectores: [],
      nodos: [],
      artefactos: [],
      realizaciones: [],
      caminos: [],
      _seq: {}
    };
  }

  function siguienteId(modelo, prefijo) {
    modelo._seq[prefijo] = (modelo._seq[prefijo] || 0) + 1;
    return prefijo + modelo._seq[prefijo];
  }

  /* --- Altas ---------------------------------------------------------- */
  function agregarComponente(modelo, datos) {
    datos = datos || {};
    var c = {
      id: datos.id || siguienteId(modelo, 'C'),
      nombre: datos.nombre === undefined ? 'Componente' : datos.nombre,
      estereotipo: datos.estereotipo || 'service',
      descripcion: datos.descripcion || '',
      puertos: datos.puertos ? clonar(datos.puertos) : [],
      x: datos.x === undefined ? 0 : datos.x,
      y: datos.y === undefined ? 0 : datos.y
    };
    modelo.componentes.push(c);
    return c;
  }

  function agregarPuerto(componente, datos) {
    datos = datos || {};
    var p = {
      id: datos.id || 'P' + (componente.puertos.length + 1),
      nombre: datos.nombre || 'interfaz',
      direccion: datos.direccion === 'required' ? 'required' : 'provided',
      interfaz: datos.interfaz || datos.nombre || 'interfaz'
    };
    componente.puertos.push(p);
    return p;
  }

  function agregarConector(modelo, datos) {
    datos = datos || {};
    var k = {
      id: datos.id || siguienteId(modelo, 'K'),
      desde: datos.desde || null,   /* {componente, puerto} */
      hacia: datos.hacia || null,   /* {componente, puerto} */
      contrato: datos.contrato || 'uses',
      etiqueta: datos.etiqueta || ''
    };
    modelo.conectores.push(k);
    return k;
  }

  function agregarNodo(modelo, datos) {
    datos = datos || {};
    var n = {
      id: datos.id || siguienteId(modelo, 'N'),
      nombre: datos.nombre === undefined ? 'Nodo' : datos.nombre,
      estereotipo: datos.estereotipo || 'executionEnvironment',
      anfitrion: datos.anfitrion || null, /* id del nodo contenedor */
      sistemaOperativo: datos.sistemaOperativo || '',
      cpu: datos.cpu || '',
      memoria: datos.memoria || '',
      x: datos.x === undefined ? 0 : datos.x,
      y: datos.y === undefined ? 0 : datos.y
    };
    modelo.nodos.push(n);
    return n;
  }

  function agregarArtefacto(modelo, datos) {
    datos = datos || {};
    var a = {
      id: datos.id || siguienteId(modelo, 'A'),
      nombre: datos.nombre === undefined ? 'Artefacto' : datos.nombre,
      tipo: datos.tipo || 'executable',
      archivo: datos.archivo || '',
      version: datos.version || '1.0.0',
      componente: datos.componente || null, /* componente que realiza */
      x: datos.x === undefined ? 0 : datos.x,
      y: datos.y === undefined ? 0 : datos.y
    };
    modelo.artefactos.push(a);
    return a;
  }

  function agregarRealizacion(modelo, datos) {
    datos = datos || {};
    var r = {
      id: datos.id || siguienteId(modelo, 'R'),
      artefacto: datos.artefacto || null,
      nodo: datos.nodo || null,
      ruta: datos.ruta || '',
      orden: datos.orden === undefined ? 1 : datos.orden
    };
    modelo.realizaciones.push(r);
    return r;
  }

  function agregarCamino(modelo, datos) {
    datos = datos || {};
    var c = {
      id: datos.id || 'CP' + (modelo.caminos.length + 1),
      a: datos.a || null,   /* id nodo origen  */
      b: datos.b || null,   /* id nodo destino */
      protocolo: datos.protocolo || 'TCP',
      puerto: datos.puerto === undefined ? '' : datos.puerto
    };
    modelo.caminos.push(c);
    return c;
  }

  /* --- Consultas ------------------------------------------------------- */
  function porId(coleccion, id) {
    for (var i = 0; i < coleccion.length; i++) if (coleccion[i].id === id) return coleccion[i];
    return null;
  }

  function buscarComponente(modelo, id) { return porId(modelo.componentes, id); }
  function buscarNodo(modelo, id) { return porId(modelo.nodos, id); }
  function buscarArtefacto(modelo, id) { return porId(modelo.artefactos, id); }
  function buscarPuerto(componente, idPuerto) {
    if (!componente) return null;
    for (var i = 0; i < componente.puertos.length; i++) {
      if (componente.puertos[i].id === idPuerto) return componente.puertos[i];
    }
    return null;
  }

  /* --- Índices para validación (una sola pasada) ---------------------- */
  function indexar(modelo) {
    var ix = {
      componentes: {}, nodos: {}, artefactos: {}, realizaciones: {},
      conectores: {}, caminos: {},
      puertoPorId: {},           /* "C1/P2" -> {componente, puerto} */
      puertoPorInterfaz: {},     /* interfaz -> [{componente, puerto}] */
      artefactosPorNodo: {},
      artefactosPorComponente: {}
    };
    modelo.componentes.forEach(function (c) {
      ix.componentes[c.id] = c;
      c.puertos.forEach(function (p) {
        var clave = c.id + '/' + p.id;
        ix.puertoPorId[clave] = { componente: c, puerto: p };
        (ix.puertoPorInterfaz[p.interfaz] = ix.puertoPorInterfaz[p.interfaz] || []).push({ componente: c, puerto: p });
      });
    });
    modelo.conectores.forEach(function (k) { ix.conectores[k.id] = k; });
    modelo.nodos.forEach(function (n) { ix.nodos[n.id] = n; });
    modelo.artefactos.forEach(function (a) { ix.artefactos[a.id] = a; });
    modelo.realizaciones.forEach(function (r) {
      ix.realizaciones[r.id] = r;
      if (r.nodo) (ix.artefactosPorNodo[r.nodo] = ix.artefactosPorNodo[r.nodo] || []).push(r);
      if (r.artefacto && ix.artefactos[r.artefacto]) {
        var ac = ix.artefactos[r.artefacto].componente;
        if (ac) (ix.artefactosPorComponente[ac] = ix.artefactosPorComponente[ac] || []).push(r);
      }
    });
    modelo.caminos.forEach(function (c) { ix.caminos[c.id] = c; });
    return ix;
  }

  /* --- Bajas ----------------------------------------------------------- */
  function eliminar(modelo, tipo, id) {
    var mapa = {
      componente: 'componentes', conector: 'conectores', nodo: 'nodos',
      artefacto: 'artefactos', realizacion: 'realizaciones', camino: 'caminos'
    };
    var clave = mapa[tipo];
    if (!clave) return false;
    var arr = modelo[clave], i = arr.findIndex(function (e) { return e.id === id; });
    if (i < 0) return false;
    arr.splice(i, 1);
    return true;
  }

  /* Eliminar en cascada: un componente se lleva sus puertos usados por conectores. */
  function eliminarEnCascada(modelo, tipo, id) {
    if (tipo === 'componente') {
      modelo.conectores = modelo.conectores.filter(function (k) {
        return (k.desde && k.desde.componente !== id) && (k.hacia && k.hacia.componente !== id);
      });
    }
    if (tipo === 'artefacto') {
      modelo.realizaciones = modelo.realizaciones.filter(function (r) { return r.artefacto !== id; });
    }
    if (tipo === 'nodo') {
      modelo.realizaciones = modelo.realizaciones.filter(function (r) { return r.nodo !== id; });
      modelo.caminos = modelo.caminos.filter(function (c) { return c.a !== id && c.b !== id; });
      modelo.nodos.forEach(function (n) { if (n.anfitrion === id) n.anfitrion = null; });
    }
    return eliminar(modelo, tipo, id);
  }

  /* --- Integridad mínima al cargar/importar -------------------------- */
  function normalizar(modelo) {
    if (!modelo || typeof modelo !== 'object') return nuevoModelo();
    var base = nuevoModelo();
    Object.keys(base).forEach(function (k) {
      if (modelo[k] === undefined) modelo[k] = base[k];
    });
    modelo.componentes.forEach(function (c) { if (!c.puertos) c.puertos = []; });
    /* ids duplicados: se renumeran los repetidos para que las reglas los detecten
       como id no único sólo cuando el usuario losrodujo a mano. */
    return modelo;
  }

  function clonar(o) { return JSON.parse(JSON.stringify(o)); }

  DPL.Modelo = {
    nuevo: nuevoModelo,
    agregarComponente: agregarComponente,
    agregarPuerto: agregarPuerto,
    agregarConector: agregarConector,
    agregarNodo: agregarNodo,
    agregarArtefacto: agregarArtefacto,
    agregarRealizacion: agregarRealizacion,
    agregarCamino: agregarCamino,
    porId: porId,
    buscarComponente: buscarComponente,
    buscarNodo: buscarNodo,
    buscarArtefacto: buscarArtefacto,
    buscarPuerto: buscarPuerto,
    indexar: indexar,
    eliminar: eliminar,
    eliminarEnCascada: eliminarEnCascada,
    normalizar: normalizar,
    clonar: clonar,
    siguienteId: siguienteId
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
