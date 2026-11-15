// Controlador de usuarios (solo administradores): lista las cuentas con cuántos productos ha creado cada una.
const Usuario = require('../models/Usuario');

/** GET /api/usuarios */
async function listar(req, res) {
  const usuarios = await Usuario.aggregate([
    { $lookup: { from: 'productos', localField: '_id', foreignField: 'creadoPor', as: 'productos' } },
    { $project: { _id: 0, id: '$_id', nombre: 1, correo: 1, rol: 1, creadoEn: 1, productos: { $size: '$productos' } } },
    { $sort: { creadoEn: 1 } },
  ]);
  res.json({ total: usuarios.length, datos: usuarios });
}

module.exports = { listar };
