// Rutas de usuarios: /api/usuarios (solo administradores).
const { Router } = require('express');
const ctrl = require('../controllers/usuarios.controller');
const { verificarToken, permitirRoles } = require('../middleware/auth');

const router = Router();

router.get('/', verificarToken, permitirRoles('admin'), ctrl.listar);

module.exports = router;
