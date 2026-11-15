// Rutas de productos: /api/productos. Todas requieren sesión iniciada (JWT).
// Cada ruta encadena middlewares: validación → carga del producto → autorización → controlador.
const { Router } = require('express');
const ctrl = require('../controllers/productos.controller');
const { verificarToken, soloDuenoOAdmin } = require('../middleware/auth');
const { validarObjectId, validarConsulta, validarProductoNuevo, validarCambiosProducto } = require('../middleware/validar');
const { cargarProducto } = require('../middleware/productos');

const router = Router();

router.use(verificarToken); // protege todas las rutas de este archivo

router.get('/resumen', ctrl.resumen);
router.get('/categorias', ctrl.categorias);
router.get('/', validarConsulta, ctrl.listar);
router.post('/', validarProductoNuevo, ctrl.crear);
router.get('/:id', validarObjectId, cargarProducto, ctrl.obtener);
router.put('/:id', validarObjectId, cargarProducto, soloDuenoOAdmin, validarCambiosProducto, ctrl.actualizar);
router.delete('/:id', validarObjectId, cargarProducto, soloDuenoOAdmin, ctrl.eliminar);

module.exports = router;
