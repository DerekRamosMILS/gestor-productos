# Pruebas generadas con IA y ajustes manuales

La actividad pide que las pruebas iniciales se generen con una herramienta de IA y después se ajusten a mano. Aquí está el proceso.

## 1. Generación con GitHub Copilot

- **Herramienta:** GitHub Copilot Chat en github.com/copilot, con acceso de solo lectura al repositorio.
- **Prompt 1:** pruebas unitarias con Jest para `src/controllers/productos.controller.js`. El modelo `Producto` va simulado con `jest.mock` y `req`/`res` también son simulados. Debe cubrir listar, obtener, crear, actualizar, eliminar, resumen y categorías.
- **Prompt 2:** lo mismo para `src/controllers/auth.controller.js`, con `Usuario`, `Sesion` y `jsonwebtoken` simulados. Debe cubrir registro, inicio de sesión, perfil y cierre de sesión.
- Antes de escribir, Copilot leyó el controlador, el modelo, los middlewares y las pruebas existentes para seguir las convenciones del proyecto.

La salida original, sin cambios, está en `docs/copilot/`:

| Archivo original de Copilot | Pruebas | Resultado al ejecutarlo tal cual |
|---|---|---|
| `productos.controller.test.copilot.js` | 9 | 9 pasan |
| `auth.controller.test.copilot.js` | 7 | 7 pasan |

## 2. Revisión: qué estaba bien y qué faltaba

Que todas pasaran no significaba que probaran lo importante. Revisé cada prueba contra el código y los requerimientos.

**Lo que Copilot hizo bien:**
- Simuló las consultas encadenadas de Mongoose (`find().sort().skip().limit().populate()`).
- Probó la paginación con resultados vacíos.
- En el login comprobó que, aunque el correo no exista, se compare contra un hash de relleno. Esa protección evita que, midiendo el tiempo de respuesta, se descubra qué correos están registrados.

**Lo que tuve que corregir o agregar:**

| # | Archivo | Problema en la versión de Copilot | Ajuste manual |
|---|---|---|---|
| P1 | productos | Redefinía `respuestaSimulada()` y `consultaSimulada()`, que ya existen en `tests/helpers/`. Tenía un `beforeEach(jest.clearAllMocks)` redundante con `clearMocks: true`. | Se usan los helpers del proyecto y se quitó el código duplicado. |
| P2 | productos | No probaba `construirFiltro`, que está exportada. | 4 pruebas nuevas: filtro vacío, un solo límite de precio, precio 0 y escape de caracteres especiales. |
| P3 | productos | Solo verificaba que se escapara el punto. | Se prueba la búsqueda `(a+)*$[x]`: se trata como texto literal y nunca como expresión regular, lo que evita patrones costosos (ReDoS). |
| P4 | productos | Verificaba que hubiera "tres RegExp", sin decir en qué campos. | Se comprueba que la búsqueda es en `nombre`, `sku` y `descripcion`, que no distingue mayúsculas y que el punto es literal. |
| P5 | productos | No probaba fallas de MongoDB. | Si la base falla, el error se propaga (Express 5 lo manda al manejador central) y el controlador no responde nada por su cuenta. |
| P6 | productos | No verificaba de dónde sale el dueño del producto. | `creadoPor` siempre viene de la sesión, aunque el cuerpo intente mandar otro. |
| P7 | productos | Sin caso de SKU duplicado. | El error 11000 se propaga y nunca se responde 201. |
| P8 | productos | No comprobaba el orden de las operaciones al actualizar. | Primero `set()` y después `save()`, que es donde Mongoose valida. |
| P9 | productos | Sin caso de validación fallida. | Si `save()` rechaza (precio negativo), no se hace `populate` ni se responde 200. |
| A1 | auth | Simulaba `jsonwebtoken`: el "token" era el texto fijo `'token-firmado'`, así que nunca se probaba que fuera válido. | Se usa la librería real y el token se verifica con `jwt.verify` (secreto, HS256, emisor `gestor-productos`, duración de 2 h, sin datos sensibles). |
| A2 | auth | Mismo código duplicado que P1. | Se usan los helpers compartidos. |
| A3 | auth | No verificaba el orden en el registro. | La contraseña se cifra antes de `save()`. |
| A4 | auth | Aceptaba cualquier texto como `jti`. | El `jti` de la sesión guardada debe ser el mismo del token. Sin esa igualdad, el logout no invalidaría el token. |
| A5 | auth | — | Dos inicios de sesión generan `jti` distintos. |
| A6 | auth | — | El User-Agent se recorta a 200 caracteres y una petición sin IP ni User-Agent no truena. |
| A7 | auth | Solo probaba la cookie con `secure: false`. | Prueba aislada con `NODE_ENV=production`: la cookie sale `Secure`, `HttpOnly` y `SameSite=Strict`. |
| A8 | auth | No probaba un logout fallido. | Si no se puede borrar la sesión, no se limpia la cookie ni se confirma el cierre. |

Cada ajuste está marcado con un comentario `AJUSTE n` en `tests/unit/controllers/`.

**Error mío durante el ajuste:** en A6 la primera versión falló porque pasé `undefined` a una función con valores por defecto, y JavaScript usó los valores por defecto. Lo corregí construyendo la petición a mano. Era un error de la prueba, no de la aplicación.

## 3. Pruebas escritas a mano (sin IA)

- `tests/rutas/flujo.test.js` cubre el flujo completo contra MongoDB real: registro, login, CRUD, resumen y logout. Después del logout, el mismo token recibe 401.
- `tests/rutas/autorizacion.test.js` cubre:
  - 401 sin token o con un token alterado.
  - Redirección de `/productos` a `/login`.
  - 403 cuando otro usuario edita o borra un producto ajeno, mientras el administrador sí puede.
  - `/api/usuarios` solo para el administrador.
  - Errores 400, 404 y 409.
- `tests/unit/middleware/` cubre los middlewares de JWT, validación y errores.

## 4. Problema real encontrado en CI

Las pruebas de rutas pasaban la lógica, pero en GitHub Actions fallaban al conectar con:

```
MongooseServerSelectionError: Missing required sub-document 'driver' in the client metadata document
```

**Diagnóstico:**
1. Capturé el primer mensaje que el driver manda al servidor, con un servidor TCP falso dentro de Jest.
2. Fuera de Jest, el saludo inicial (`hello`) incluye `client.driver`. Dentro de Jest, `client` llegaba vacío.
3. La causa: el driver de MongoDB 7.8 carga el módulo `os` con `import()` dinámico, y ese `import()` falla dentro de la VM de Jest. El driver oculta el error y manda los metadatos vacíos. MongoDB 8 los rechaza.

**Solución:** en `tests/helpers/bd.js` se pasa `runtimeAdapters: { os }` al conectar. En producción no hace falta, porque Node se ejecuta normal.

## 5. Resultado

| Ejecución | Pruebas | Cobertura de líneas |
|---|---|---|
| Copilot sin ajustar (solo controladores) | 16 | — |
| Suite final en GitHub Actions (Node 22 y 24, MongoDB 8) | **81 / 81** | **93 %** |

Controladores: `auth.controller.js` 100 % y `productos.controller.js` 100 % de líneas.

## 6. Error encontrado al probar en producción

Con la app ya desplegada en Render, al iniciar sesión con una cuenta de usuario y crear un producto, el panel marcaba como "no permitido" el botón de editar **del propio producto**. La API sí lo permitía; el problema estaba entre ambas capas:

- El panel decide quién es el dueño comparando `producto.creadoPor.id` con el `id` del usuario de la sesión.
- `populate('creadoPor', 'nombre')` devolvía el usuario como `{ _id, nombre }`, sin `id`, porque el modelo `Usuario` no tenía la transformación `toJSON` que sí tenía `Producto`.

**Corrección:** `Usuario` ahora se serializa igual que `Producto` (`id` virtual, sin `_id` ni `passwordHash`). Se agregó una prueba de regresión en `tests/rutas/flujo.test.js` que verifica que `creadoPor` llega como `{ id, nombre }`.

Las pruebas unitarias no lo detectaron porque simulan los modelos; la prueba de rutas revisaba solo `creadoPor.nombre`. Es un buen ejemplo de por qué conviene combinar pruebas automáticas con pruebas manuales sobre la aplicación real.
