# Catálogo de reglas de consistencia — DespliegaUML

> Generado automáticamente desde `app/src/reglas.js`.
> No editar a mano: editar las reglas y volver a ejecutar la generación.

| Regla | Nombre | Severidad máxima | Fundamento |
| :- | :- | :- | :- |
| **R-01** | Unicidad de identificadores | `— (sin hallazgos)` | Un id duplicado hace ambigua cualquier referencia posterior. |
| **R-02** | Nombre obligatorio en todo elemento | `— (sin hallazgos)` | Un modelo sin nombre no es revisable ni trazable. |
| **R-03** | Estereotipos dentro del catálogo UML 2 | `— (sin hallazgos)` | Restringe el vocabulario a los estereotipos definidos por OMG UML 2.x. |
| **R-04** | Los conectores referencian extremos existentes | `— (sin hallazgos)` | Una referencia colgante (apunta a algo que no existe) invalida el modelo en cascada. |
| **R-05** | Simetría provided/required en conectores | `— (sin hallazgos)` | Un conector une una interfaz publicada con una interfaz requerida. |
| **R-06** | Todo puerto required debe estar conectado | `— (sin hallazgos)` | Una dependencia sin resolver indica cableado incompleto. |
| **R-07** | Aviso de interfaz publicada sin requeridores | `— (sin hallazgos)` | Detecta contratos publicados que nadie consume. |
| **R-08** | Interfaz única por componente | `— (sin hallazgos)` | Un componente no puede exponer dos veces el mismo contrato. |
| **R-09** | Las realizaciones apuntan a artefacto y nodo válidos | `— (sin hallazgos)` | Una realización sin artefacto o sin nodo no es desplegable. |
| **R-10** | Todo artefacto se realiza en al menos un nodo | `— (sin hallazgos)` | Un artefacto no desplegado nunca llega al cliente. |
| **R-11** | Todo componente tiene artefacto que lo implemente | `— (sin hallazgos)` | Un componente sin materialización es sólo papel lógico. |
| **R-12** | Jerarquía de nodos acíclica y anfitrión válido | `— (sin hallazgos)` | La jerarquía de anidamiento no puede contener ciclos. |
| **R-13** | Una unidad de ejecución por nodo | `— (sin hallazgos)` | UML 2: un nodo representa una máquina con una unidad de ejecución. |
| **R-14** | Nodos con especificación técnica declarada | `— (sin hallazgos)` | Sin SO/CPU/memoria el plan de despliegue no es ejecutable. |
| **R-15** | Caminos de comunicación válidos | `— (sin hallazgos)` | Extremos existentes, sin bucles, puerto en rango 1-65535. |
| **R-16** | Nodo aislado | `— (sin hallazgos)` | Un nodo sin artefactos ni vecinos no participa del despliegue. |
| **R-17** | Grafo de ensamblaje acíclico | `— (sin hallazgos)` | Una dependencia circular entre componentes impide el despliegue ordenado. |
| **R-18** | El conector empareja la misma interfaz | `— (sin hallazgos)` | La interfaz es el contrato que ambos extremos deben compartir. |
| **R-19** | Interfaz publicada por un único componente | `— (sin hallazgos)` | Diagnóstico de contratos sin contraparte. |

**Regla de decisión:** el plan de despliegue se genera únicamente
cuando el modelo no produce ningún hallazgo de severidad `error`.
