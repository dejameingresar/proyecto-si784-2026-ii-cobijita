# Despliegue de DespliegaUML

La aplicación se publica automáticamente en GitHub Pages desde el pipeline
`.github/workflows/ci-cd.yml`. Este documento explica cómo funciona y qué queda
por hacer si la publicación no llega a completarse.

## 1. Qué hace el pipeline

Cada `push` a la rama `main` dispara cuatro etapas, en este orden:

| Etapa | Qué hace | Si falla |
| :- | :- | :- |
| **Suite de pruebas** | Ejecuta los 64 casos de prueba y verifica que el modelo de ejemplo cumpla las 19 reglas. | **Detiene todo.** No se genera documentación ni se publica nada. |
| **Documentación** | Regenera los `.puml`, el plan de despliegue, el catálogo de reglas, el manual técnico y el informe de calidad; renderiza los diagramas a SVG con PlantUML. | Detiene la publicación. |
| **Publicación** | Construye el directorio del sitio y lo sube a GitHub Pages. | El sitio anterior se mantiene. |
| **Resumen** | Muestra el resultado en la página de la ejecución. | — |

El orden importa: si una prueba falla, no se publica, de modo que nunca se
sirve una versión cuyos diagramas o su plan de despliegue no coinciden con el
código.

## 2. Estructura del sitio publicado

```
/                     portada con enlaces
/index-app.html       la aplicación, con sus carpetas src/ y css/
/app/                 copia de la aplicación con sus pruebas y ejemplos
/doc/                 diagramas SVG, plan de despliegue, manual técnico,
                      catálogo de reglas e informe de calidad
/informes/            informes del proyecto en .docx
```

La aplicación se replica en la raíz y en `app/` porque sus rutas relativas
(`css/`, `src/`) son absolutas respecto a su `index.html`: publicar el archivo
suelto rompería la carga de estilos y módulos.

## 3. Estado actual de la publicación

El pipeline se ejecuta correctamente de principio a fin: las tres primeras
etapas terminan en verde, el artefacto se genera y el propio pipeline lo
advierte en el registro. La **URL pública devuelve 404**, y la causa está fuera
del repositorio:

> El entorno `github-pages` de este repositorio tiene activada la política
> `custom_branch_policies` (ramas personalizadas) y **no incluye la rama
> `main`**. GitHub crea el despliegue, lo deja en cola y nunca lo publica.
> Crear la política requiere permiso de administrador en la organización
> `UPT-FAING-EPIS`.

## 4. Cómo desbloquearlo

Un clic en el repositorio, con una cuenta que sea administradora de la
organización:

1. Abre **Settings → Environments**.
2. En `github-pages`, pulsa **Edit**.
3. En **Deployment branches**, cambia la opción a **All branches**
   (o deja *Selected branches* y añade `main`).
4. Guarda.

Los nombres exactos pueden variar según la versión de la interfaz, pero el
camino es **Settings → Environments → github-pages → Deployment branches**.

Inmediatamente después, dispara una ejecución manual para que se publique sin
esperar al siguiente `push`:

**Actions → DespliegaUML CI/CD → Run workflow**.

La URL, una vez activa, es:

<https://upt-faing-epis.github.io/proyecto-si784-2026-ii-cobijita/>

## 5. Comprobación automática

El pipeline comprueba por sí mismo que el sitio responde, e informa en el
registro de la ejecución si el artefacto se publicó pero la URL todavía no
sirve el contenido. Así, un despliegue en cola no se confunde con uno publicado.

## 6. Alternativa sin permisos de administrador

Si no hay acceso a la configuración de la organización, la aplicación puede
publicarse en cualquier servicio de hosting estático arrastrando el contenido
del repositorio:

- **Cloudflare Pages** — conectar el repositorio y dejar el directorio en `/`.
- **Netlify** — mismo procedimiento, arrastrando el repositorio.
- **GitHub Pages desde otra cuenta** — la misma cuenta personal, sin la
  restricción de la organización.

En los tres casos la aplicación funciona sin cambios: es HTML, CSS y JavaScript
sin dependencias ni paso de compilación.

## 7. Regenerar la documentación en local

```bash
node app/tests/casos.js              # las 64 pruebas
node tools/generar-documentacion.js   # diagramas, plan, manual e informe
```

Para renderizar los diagramas a SVG se necesita PlantUML y Graphviz:

```bash
sudo apt-get install -y graphviz plantuml
plantuml -tsvg doc/diagrama-componentes.puml doc/diagrama-despliegue.puml
```

## 8. Verificar los informes del proyecto

```bash
python3 tools/build_fd03_fd04.py      # genera FD03 (SRS) y FD04 (SAD)
```

Ambos informes se construyen leyendo el catálogo de reglas y el modelo de
ejemplo desde el código, de modo que la documentación no se desincroniza de lo
que la aplicación realmente hace.
