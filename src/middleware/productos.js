// Carga el producto de la URL una sola vez y lo deja en req.producto para los siguientes pasos
// (autorización y controlador). Si no existe responde 404.
const Producto = require('../models/Producto');
const ErrorApi = require('../utils/ErrorApi');

async function cargarProducto(req, res, next) {
  try {
    const producto = await Producto.findById(req.params.id)
      .populate('creadoPor', 'nombre correo')
      .populate('actualizadoPor', 'nombre');
    if (!producto) throw ErrorApi.noEncontrado(`No existe un producto con id ${req.params.id}.`);
    req.producto = producto;
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = { cargarProducto };
