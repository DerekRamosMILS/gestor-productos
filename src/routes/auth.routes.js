// Rutas de autenticación: /api/auth
const { Router } = require('express');
const ctrl = require('../controllers/auth.controller');
const { verificarToken } = require('../middleware/auth');
const { validarRegistro, validarLogin } = require('../middleware/validar');
const { limitarLogin } = require('../middleware/limites');

const router = Router();

router.post('/registro', validarRegistro, ctrl.registrar);       // público
router.post('/login', limitarLogin, validarLogin, ctrl.iniciarSesion); // público, máx. 5 fallos en 15 min
router.get('/perfil', verificarToken, ctrl.perfil);             // requiere sesión
router.post('/logout', verificarToken, ctrl.cerrarSesion);      // requiere sesión

module.exports = router;
