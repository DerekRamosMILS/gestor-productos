# Requerimientos del Gestor de Productos

## Requerimientos funcionales

| ID | Requerimiento | Criterio de aceptación |
|---|---|---|
| RF-01 | Registro de usuarios | Con nombre, correo único y contraseña de 8 a 72 caracteres con letras y números. Responde 201; un correo repetido responde 409. |
| RF-02 | Inicio de sesión | Con correo y contraseña correctos emite un JWT de 2 horas en una cookie httpOnly y en la respuesta. Datos incorrectos responden 401 con el mismo mensaje. |
| RF-03 | Cierre de sesión | Borra la sesión en MongoDB y la cookie; el mismo token responde 401 después. |
| RF-04 | Perfil | Un usuario autenticado consulta su nombre, correo, rol y la expiración de su sesión. |
| RF-05 | Protección de rutas | Todas las rutas de productos y la página del panel exigen sesión; sin ella la API responde 401 y la página redirige al login. |
| RF-06 | Crear producto | Nombre, SKU único, descripción opcional, precio ≥ 0, stock entero ≥ 0 y categoría válida. Responde 201 y registra quién lo creó. |
| RF-07 | Listar productos | Búsqueda por nombre, SKU o descripción; filtro por categoría y rango de precio; orden; paginación (máx. 50); opción "solo míos". |
| RF-08 | Ver producto | Devuelve el producto con el nombre de quien lo creó y lo modificó; un id inexistente responde 404. |
| RF-09 | Modificar producto | Actualiza uno o más campos; solo el creador o un administrador (403 para los demás). |
| RF-10 | Eliminar producto | Con confirmación en la interfaz; solo el creador o un administrador. |
| RF-11 | Resumen del inventario | Total de productos, unidades, valor del inventario y productos con 5 piezas o menos. |
| RF-12 | Roles | `usuario` y `admin`. El administrador modifica cualquier producto y consulta la lista de usuarios. |
| RF-13 | Vistas HTML | Página de login y registro, panel de productos con formulario en diálogo y página 404. |
| RF-14 | Mensajes de error | Toda falla responde con su código HTTP y un JSON `{ error: { estado, mensaje, detalles } }`. |
| RF-15 | Administrador inicial | Se crea al arrancar si se definen `ADMIN_CORREO` y `ADMIN_PASSWORD`. |

## Requerimientos no funcionales

| ID | Categoría | Requerimiento |
|---|---|---|
| RNF-01 | Seguridad | Contraseñas con bcrypt (10 rondas); el hash nunca se devuelve al cliente. |
| RNF-02 | Seguridad | JWT HS256 con secreto de 32+ caracteres en variable de entorno; cookie httpOnly, SameSite=Strict y Secure en producción. |
| RNF-03 | Seguridad | Máximo 5 intentos fallidos de login por IP cada 15 minutos (429). |
| RNF-04 | Seguridad | Encabezados de seguridad con helmet y política de contenido (CSP) sin scripts en línea. |
| RNF-05 | Seguridad | Validación de entradas y lista blanca de campos para evitar asignación masiva (creadoPor, rol). |
| RNF-06 | Seguridad | Ninguna credencial en el código: `.env` en local, variables en Render y secretos en GitHub. |
| RNF-07 | Rendimiento | Índices en `sku` (único), `categoria + nombre`, `creadoPor` y `sesiones.jti`; respuestas paginadas. |
| RNF-08 | Disponibilidad | Endpoint `/api/salud` para el health check de Render y del pipeline; cierre ordenado con SIGTERM. |
| RNF-09 | Mantenibilidad | Arquitectura por capas: rutas → middlewares → controladores → modelos de Mongoose. |
| RNF-10 | Calidad | Pruebas automatizadas con Jest (unitarias y de rutas) que se ejecutan en cada push. |
| RNF-11 | Despliegue | Despliegue continuo: solo se publica en Render si todas las pruebas pasan. |
| RNF-12 | Usabilidad | Interfaz en español, adaptable desde 360 px, con etiquetas accesibles y mensajes por campo. |
| RNF-13 | Compatibilidad | Node.js 22 y 24; navegadores modernos (Chrome, Safari, Edge, Firefox). |
| RNF-14 | Trazabilidad | Bitácora de cada solicitud de la API (método, ruta, código, tiempo y usuario). |
