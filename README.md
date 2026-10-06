# DespliegaUML

Aplicación web para modelar el **diagrama de componentes** y el **diagrama de
despliegue** de un sistema de software, validar su consistencia con un motor de
**19 reglas** y generar automáticamente el **plan de despliegue**.

Sin dependencias, sin paso de compilación: se abre `index.html` con doble clic.

---

## 1. Cómo ejecutarla

```bash
# Opción 1: doble clic sobre app/index.html
# Opción 2, desde la terminal:
xdg-open app/index.html
```

La aplicación guarda el modelo en el `localStorage` del navegador, así que el
trabajo se conserva al cerrar y volver a abrir.

### Enlaces directos a cada panel

| URL | Qué abre |
| :- | :- |
| `app/index.html` | Diagrama de componentes |
| `app/index.html?vista=despliegue` | Diagrama de despliegue |
| `app/index.html?vista=reglas` | Catálogo de las 19 reglas |
| `app/index.html?vista=plan` | Plan de despliegue |
| `app/index.html?modal=plan` | Plan de despliegue en ventana emergente |

## 2. Cómo se usa

1. **Crear el diagrama de componentes.** Con la herramienta «+ Componente» se
   hace clic en el lienzo. En el inspector se le pone nombre y estereotipo
   (`application`, `service`, `library`, `interface`, `database`, `external`).
2. **Declarar los puertos.** Cada puerto es una interfaz que el componente
   publica (`provided`, cuadrado lleno a la derecha) o que requiere
   (`required`, cuadrado hueco a la izquierda). El nombre de la interfaz es lo
   que empareja un `provided` con un `required`.
3. **Conectar.** La herramienta «→ Conector» pide primero el componente que
   publica la interfaz y después el que la requiere.
4. **Pasar al despliegue.** Pestaña «Diagrama de despliegue»: se crean nodos
   (`executionEnvironment`, `device`, `container`, `cloudRegion`) y se les
   asigna SO, CPU y memoria. Los artefactos se crean aparte y se *realizan*
   dentro de un nodo.
5. **Validar.** El panel lateral reevalúa las 19 reglas en cada cambio y marca
   en rojo lo que incumple.
6. **Generar el plan.** Con 0 errores, el botón «Generar plan de despliegue»
   produce el plan completo, que se puede copiar o descargar en Markdown.

El botón «Auto-organizar» reacomoda el diagrama por niveles de dependencia.

## 3. Las 19 reglas de consistencia

| # | Regla | Severidad | Qué detecta |
| :- | :- | :- | :- |
| R-01 | Unicidad de identificadores | error | Un `id` repetido hace ambigua cualquier referencia |
| R-02 | Nombre obligatorio | error | Elementos sin nombre, no revisables ni trazables |
| R-03 | Estereotipos del catálogo UML 2 | error | Vocabulario fuera de los estereotipos de OMG UML 2.x |
| R-04 | Extremos de conector existentes | error | Conectores que apuntan a componentes o puertos inexistentes |
| R-05 | Simetría provided/required | error | Un conector que no une una interfaz publicada con una requerida |
| R-06 | Puerto required conectado | warning | Dependencia declarada pero no cableada |
| R-07 | Interfaz publicada sin requeridores | info | Contrato que nadie consume |
| R-08 | Interfaz única por componente | error | Un componente que publica dos veces el mismo contrato |
| R-09 | Realización válida | error | Realización sin artefacto o sin nodo de despliegue |
| R-10 | Artefacto desplegado | error | Artefacto que no se realiza en ningún nodo |
| R-11 | Componente materializado | warning | Componente sin artefacto que lo implemente |
| R-12 | Jerarquía de nodos acíclica | error | Anfitrión inexistente, auto-anidamiento o ciclo |
| R-13 | Una unidad de ejecución por nodo | warning | Varios ejecutables en un mismo nodo |
| R-14 | Especificación técnica declarada | info | Nodo sin SO, CPU o memoria |
| R-15 | Caminos válidos | error / warning | Extremos inexistentes, bucles, puerto fuera de 1-65535, duplicados |
| R-16 | Nodo no aislado | warning | Nodo sin artefactos y sin vecinos |
| R-17 | Grafo de ensamblaje acíclico | error | Ciclo de dependencias entre componentes |
| R-18 | Misma interfaz en el conector | error | Conector que empareja contratos distintos |
| R-19 | Interfaz con par | info | Interfaz publicada por un único componente |

**Regla de decisión:** 0 errores ⇒ el plan de despliegue puede generarse.
Con al menos un error el plan queda marcado como `BLOQUEADO`.

## 4. Pruebas

```bash
node app/tests/casos.js          # las 64 pruebas
node app/tests/casos.js R-17     # sólo las que mencionan R-17
```

Los casos llevan identificador `T-nn` y la trazabilidad completa regla → caso
está en `calidad/Plan-de-Pruebas.md`.

## 5. Estructura

```
app/
├── index.html              interfaz (4 paneles)
├── css/estilos.css
├── src/
│   ├── modelo.js           modelo de dominio (componentes, puertos, nodos,
│   │                       artefactos, realizaciones, caminos)
│   ├── reglas.js           catálogo de las 19 reglas + motor de validación
│   ├── plan.js             orden topológico, niveles, fases, render Markdown
│   ├── puml.js             exportación e importación PlantUML
│   ├── vista.js            render de los dos diagramas en SVG
│   ├── almacen.js          localStorage, descarga de archivos
│   ├── pruebas.js          micro-corredor de pruebas y fábricas de modelos
│   └── app.js              controlador de la interfaz
├── tests/casos.js          suite de 64 pruebas unitarias e integración
└── ejemplos/               modelo de ejemplo en JSON, .puml y plan en .md
```

`modelo.js`, `reglas.js`, `plan.js`, `puml.js` y `pruebas.js` no dependen del
navegador: se cargan también en Node, que es lo que permite probar el motor sin
arrancar la interfaz.

## 6. Interoperabilidad

- **JSON** — exportación e importación completas del modelo.
- **PlantUML (`.puml`)** — exportación de las dos vistas y reimportación sin
  pérdida: identificadores, puertos, ficha técnica de nodos y rutas de
  artefacto. El archivo generado se puede pegar en
  [plantuml.com/plantuml/plantuml](https://www.plantuml.com/plantuml/uml) para
  obtener la imagen oficial de UML.

## 7. Limitaciones conocidas

- El parser de PlantUML cubre el subconjunto que genera la propia herramienta; un
  `.puml` escrito a mano con sintaxis más rica se importa parcialmente.
- No hay deshacer/rehacer: la protección es el autoguardado y la exportación
  frecuente a JSON.
- El editor de texto de los campos es texto plano: no valida mientras se escribe,
  la validación corre al cambiar el foco.
