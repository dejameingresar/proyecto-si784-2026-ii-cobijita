# Plan de despliegue — Aplicación web tres niveles

- **Modelo**: v1.0 · generado 2026-10-06T18:12:57.415Z
- **Estado**: LISTO PARA DESPLIEGUE
- **Validación previa**: 0 errores, 0 advertencias, 0 avisos
- **Alcance**: 2 nodos · 3 componentes · 3 artefactos · 2 conectores · 1 caminos

## 1. Topología de nodos

| Nodo | Nombre | Estereotipo | SO | CPU | Memoria | Artefactos | Vecinos |
| :-: | :- | :- | :- | :- | :- | :- | :- |
| N1 | Servidor de aplicación | «executionEnvironment» | Debian 13 | 4 vCPU | 8 GB | A1 A3 | N2:5432 |
| N2 | Servidor de base de datos | «executionEnvironment» | PostgreSQL 17 | 8 vCPU | 32 GB | A2 | N1:5432 |

## 2. Orden de despliegue por nivel

| Nivel | Componente | Tipo | Nodo destino | Artefactos | Depende de |
| :-: | :- | :- | :- | :- | :- |
| 1 | C3 — Base de datos | «database» | N2 | A2 v1.4.0 | — |
| 2 | C2 — Lógica de negocio | «service» | N1 | A1 v2.1.0 | C3 |
| 3 | C1 — Servidor web | «application» | N1 | A3 v1.0.0 | C2 |

## 3. Fases de despliegue

### Preparación

_Congelar el modelo, versionarlo y aprobar el plan de pruebas._


### Fase 1 · Nivel 1

_Despliegue de los componentes de nivel 1._

- [C3] Base de datos (database) → copiar A2 v1.4.0 en el nodo N2

### Fase 2 · Nivel 2

_Despliegue de los componentes de nivel 2._

- [C2] Lógica de negocio (service) → copiar A1 v2.1.0 en el nodo N1

### Fase 3 · Nivel 3

_Despliegue de los componentes de nivel 3._

- [C1] Servidor web (application) → copiar A3 v1.0.0 en el nodo N1

### Verificación y puesta en marcha

_Ejecutar el plan de pruebas sobre el entorno desplegado y abrir servicio._

- Ejecutar los casos de prueba de aceptación del plan de pruebas.
- Verificar que cada interfaz requerida responde en el puerto declarado.
- Registrar la cobertura de reglas R-01..R-19 sobre el modelo final.

## 4. Supuestos pendientes

- Ninguno: el modelo declara toda la información técnica necesaria.

---

_Generado automáticamente por DespliegaUML 1.0 a partir del diagrama de componentes y despliegue validado._