/* =====================================================================
   DespliegaUML · src/almacen.js
   Persistencia del modelo en localStorage + exportación/importación
   de archivos JSON y PlantUML (.puml).
   Sin dependencias.
   ===================================================================== */
(function (root) {
  'use strict';
  var DPL = (root.DPL = root.DPL || {});
  var M = DPL.Modelo;
  var CLAVE = 'despliegauml.modelo.v1';

  function guardar(modelo) {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(modelo));
      return true;
    } catch (e) { return false; }
  }

  function cargar() {
    try {
      var crudo = localStorage.getItem(CLAVE);
      if (!crudo) return null;
      return M.normalizar(JSON.parse(crudo));
    } catch (e) { return null; }
  }

  function borrar() {
    try { localStorage.removeItem(CLAVE); } catch (e) { /* nada */ }
  }

  function descargar(nombreArchivo, texto, mime) {
    var blob = new Blob([texto], { type: mime || 'application/octet-stream' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function nombreLimpio(s) {
    return String(s || 'modelo').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'modelo';
  }

  DPL.almacen = { guardar: guardar, cargar: cargar, borrar: borrar, descargar: descargar, nombreLimpio: nombreLimpio, CLAVE: CLAVE };
})(typeof globalThis !== 'undefined' ? globalThis : this);
