# Manual técnico — DespliegaUML

> Generado automáticamente. Para editarlo, editar `tools/generar-documentacion.js`.

## 1. Descripción del producto

DespliegaUML es una aplicación web que permite modelar el diagrama de
componentes y el diagrama de despliegue de un sistema de software, validar
la consistencia del modelo mediante un catálogo de 19 reglas y generar automáticamente el plan de despliegue.

No requiere instalación ni compilación: se abre `app/index.html` en
cualquier navegador moderno.

## 2. Arquitectura del sistema

La aplicación separa el modelo de dominio de su representación, de modo
que la lógica de validación es independiente del navegador y puede probarse
en Node.js.

| Módulo | Responsabilidad | Dependencias |
| :- | :- | :- |
| `modelo.js` | Modelo de dominio: componentes, puertos, conectores, nodos, artefactos, realizaciones y caminos. Índices y bajas en cascada. | ninguna |
| `reglas.js` | Catálogo de 19 reglas de consistencia y motor que las evalúa sobre el modelo. | `modelo.js` |
| `plan.js` | Orden topológico, niveles de dependencia, fases de despliegue y render a Markdown. | `modelo.js`, `reglas.js` |
| `puml.js` | Exportación e importación de PlantUML. | `modelo.js` |
| `vista.js` | Render de los dos diagramas en SVG. | `modelo.js` |
| `almacen.js` | Persistencia en `localStorage` y descarga de archivos. | `modelo.js` |
| `app.js` | Controlador de la interfaz: herramientas, inspector, validación en vivo. | todos los anteriores |
| `pruebas.js` | Micro-corredor de pruebas y fábricas de modelos de prueba. | ninguna |

## 3. Modelo de datos

| Colección | Contenido | Identificador |
| :- | :- | :- |
| `componentes` | Componentes UML con sus puertos | `C1, C2, …` |
| `conectores` | Uniones entre un puerto `provided` y uno `required` | `K1, K2, …` |
| `nodos` | Nodos de despliegue con jerarquía y ficha técnica | `N1, N2, …` |
| `artefactos` | Artefactos desplegables | `A1, A2, …` |
| `realizaciones` | Unión artefacto → nodo | `R1, R2, …` |
| `caminos` | Comunicación entre nodos | `CP1, CP2, …` |

## 4. Uso

1. **Diagrama de componentes.** Con «+ Componente» se hace clic en el
   lienzo; en el inspector se asignan nombre y estereotipo. Cada puerto es
   una interfaz que el componente publica (`provided`) o requiere
   (`required`). El nombre de la interfaz empareja ambos extremos.
2. **Conectar.** La herramienta «→ Conector» pide el componente que
   publica la interfaz y luego el que la requiere.
3. **Diagrama de despliegue.** Se crean nodos, se les asigna SO, CPU y
   memoria, y se crean artefactos que se *realizan* dentro de un nodo.
4. **Validar.** El panel lateral reevalúa las 19 reglas en cada cambio y marca en rojo lo que incumple.
5. **Generar el plan.** Con 0 errores, «Generar plan de despliegue»
   produce el plan completo, copiable o descargable en Markdown.

## 5. Catálogo de reglas

El catálogo completo está en [`doc/catalogo-reglas.md`](catalogo-reglas.md).

| Regla | Nombre |
| :- | :- |
| R-01 | Unicidad de identificadores |
| R-02 | Nombre obligatorio en todo elemento |
| R-03 | Estereotipos dentro del catálogo UML 2 |
| R-04 | Los conectores referencian extremos existentes |
| R-05 | Simetría provided/required en conectores |
| R-06 | Todo puerto required debe estar conectado |
| R-07 | Aviso de interfaz publicada sin requeridores |
| R-08 | Interfaz única por componente |
| R-09 | Las realizaciones apuntan a artefacto y nodo válidos |
| R-10 | Todo artefacto se realiza en al menos un nodo |
| R-11 | Todo componente tiene artefacto que lo implemente |
| R-12 | Jerarquía de nodos acíclica y anfitrión válido |
| R-13 | Una unidad de ejecución por nodo |
| R-14 | Nodos con especificación técnica declarada |
| R-15 | Caminos de comunicación válidos |
| R-16 | Nodo aislado |
| R-17 | Grafo de ensamblaje acíclico |
| R-18 | El conector empareja la misma interfaz |
| R-19 | Interfaz publicada por un único componente |

## 6. Pruebas

```bash
node app/tests/casos.js              # suite completa
node app/tests/casos.js R-17         # sólo los casos que mencionan R-17
node tools/generar-documentacion.js   # regenera los artefactos de doc/
```

## 7. Despliegue

La aplicación es estática: se publica tal cual en cualquier servicio de
hosting. La automatización de integración continua está en
`.github/workflows/`, y el despliegue en GitHub Pages se dispara con cada
`push` a la rama `main`.

## 8. Interoperabilidad

- **JSON** — exportación e importación completas del modelo.
- **PlantUML** — exportación de las dos vistas y reimportación sin
  pérdida. Los `.puml` generados se pueden pegar en
  <https://www.plantuml.com/plantuml/uml> para obtener la imagen oficial.
