# Gestor de Productos · Node.js + Express + MongoDB

[![CI/CD](https://github.com/DerekRamosMILS/gestor-productos/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/DerekRamosMILS/gestor-productos/actions/workflows/ci-cd.yml)

Aplicación web para administrar un inventario de productos. Los usuarios se registran, inician sesión con **JWT** y, ya autenticados, pueden **crear, consultar, modificar y eliminar** productos guardados en **MongoDB Atlas** mediante **Mongoose**. Incluye pruebas automatizadas con **Jest** y un pipeline de **GitHub Actions** que prueba y despliega en **Render**.

Actividad 4 · Desarrollo Full Stack · Universidad Tecmilenio
Derek Joan Ramos del Ángel · AL07195561

- **En línea:** https://gestor-productos-2bxn.onrender.com
- **Local:** http://localhost:3000

## Tecnologías

| Capa | Herramientas |
|---|---|
| Servidor | Node.js 22+, Express 5 |
| Base de datos | MongoDB Atlas, Mongoose 9 (esquemas, validaciones, índices, `populate`, agregaciones) |
| Seguridad | jsonwebtoken (HS256), bcryptjs, cookie httpOnly, helmet, express-rate-limit |
| Vistas | HTML, CSS y JavaScript sin frameworks (`public/`) |
| Pruebas | Jest, supertest, mongodb-memory-server |
| CI/CD y nube | GitHub Actions, Render (servicio web), MongoDB Atlas (M0) |

## Estructura

```
gestor-productos/
├── server.js                    Arranque: conecta con MongoDB, crea el admin inicial y abre el puerto
├── src/
│   ├── app.js                   Express: middlewares, rutas, vistas y manejo de errores
│   ├── config/                  env.js (variables), db.js (conexión Mongoose)
│   ├── models/                  Usuario.js, Producto.js, Sesion.js (esquemas de Mongoose)
│   ├── controllers/             auth, productos, usuarios
│   ├── routes/                  auth.routes, productos.routes, usuarios.routes
│   ├── middleware/              auth (JWT y roles), validar, productos, limites, errores, bitacora
│   └── utils/ErrorApi.js
├── public/                      login.html, productos.html, 404.html, css/, js/, img/
├── tests/
│   ├── unit/                    Controladores y middlewares con modelos simulados (jest.mock)
│   ├── rutas/                   Rutas completas con supertest y MongoDB real
│   └── helpers/
├── .github/workflows/ci-cd.yml  Pipeline: pruebas → despliegue en Render → verificación
├── docs/                        Requerimientos, diagrama ER y pruebas generadas con IA
└── .env.example
```

## Modelo de datos

```
USUARIO 1 ──< crea >── N PRODUCTO          USUARIO 1 ──< abre >── N SESION
```

- **usuarios:** nombre, correo (único), passwordHash (bcrypt), rol (`usuario` | `admin`).
- **productos:** nombre, sku (único), descripción, precio, stock, categoría, creadoPor → usuario, actualizadoPor → usuario.
- **sesiones:** usuario → usuario, jti (único), expiraEn (índice TTL: MongoDB la borra al expirar), ip, agente.

## Cómo ejecutarla en local

Requisitos: Node.js 22.9 o superior y una base en MongoDB Atlas (o un MongoDB local).

```bash
git clone https://github.com/DerekRamosMILS/gestor-productos.git
cd gestor-productos
npm install
cp .env.example .env      # pega tu MONGODB_URI y cambia JWT_SECRET
npm run dev               # http://localhost:3000
```

| Script | Qué hace |
|---|---|
| `npm run dev` | Inicia con `--watch` y lee `.env` |
| `npm start` | Inicia en producción (Render) |
| `npm test` | Todas las pruebas (unitarias y de rutas) |
| `npm run test:unit` | Solo pruebas unitarias (no requieren base de datos) |
| `npm run test:cobertura` | Pruebas con reporte de cobertura |

Las pruebas de rutas usan `MONGODB_URI_TEST` si existe (así corren en GitHub Actions); si no, levantan un MongoDB en memoria con `mongodb-memory-server`.

## API

Todas las respuestas son JSON. Los errores tienen el formato `{ "error": { "estado", "mensaje", "detalles?" } }`.

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/api/salud` | Público | Estado del servidor, de la base y versión desplegada |
| POST | `/api/auth/registro` | Público | Crea una cuenta `{ nombre, correo, password }` |
| POST | `/api/auth/login` | Público (5 fallos / 15 min) | Devuelve el JWT y lo guarda en una cookie httpOnly |
| GET | `/api/auth/perfil` | Sesión | Datos del usuario actual |
| POST | `/api/auth/logout` | Sesión | Cierra la sesión (el token deja de servir) |
| GET | `/api/productos` | Sesión | Lista con `buscar`, `categoria`, `minPrecio`, `maxPrecio`, `orden`, `pagina`, `limite`, `mios` |
| GET | `/api/productos/resumen` | Sesión | Totales del inventario (agregación) |
| GET | `/api/productos/categorias` | Sesión | Categorías válidas |
| GET | `/api/productos/:id` | Sesión | Un producto |
| POST | `/api/productos` | Sesión | Crea un producto |
| PUT | `/api/productos/:id` | Creador o admin | Actualiza uno o más campos |
| DELETE | `/api/productos/:id` | Creador o admin | Elimina un producto |
| GET | `/api/usuarios` | Solo admin | Usuarios y cuántos productos creó cada uno |

El token se envía en la cookie `token` (navegador) o en el encabezado `Authorization: Bearer <token>` (Postman, curl).

## Despliegue y CI/CD

1. **MongoDB Atlas:** clúster M0, usuario de base de datos y acceso de red `0.0.0.0/0` (Render no tiene IP fija).
2. **Render:** servicio web conectado a este repositorio · Build `npm ci --omit=dev` · Start `npm start` · Health check `/api/salud` · Auto-Deploy **desactivado** (despliega el pipeline).
3. **Variables en Render:** `MONGODB_URI`, `JWT_SECRET`, `NODE_ENV=production`, `ADMIN_*`.
4. **GitHub → Settings → Secrets and variables → Actions:**
   - Secreto `RENDER_DEPLOY_HOOK_URL` (Render → Settings → Deploy Hook).
   - Variable `URL_PRODUCCION` = `https://gestor-productos-2bxn.onrender.com`.

En cada push a `main`, `.github/workflows/ci-cd.yml` corre las pruebas en Node 22 y 24 contra un MongoDB 8 real; si pasan, llama al Deploy Hook de Render y espera hasta que `/api/salud` reporte el mismo commit. Si una prueba falla, no se despliega.

---
Proyecto académico.
