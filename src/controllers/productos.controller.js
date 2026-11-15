// Controlador de productos: todas las operaciones con MongoDB pasan por el modelo Producto de Mongoose.
// Los datos llegan validados (req.consulta, req.body) y, en PUT/DELETE, el producto ya viene cargado y autorizado (req.producto).
const Producto = require('../models/Producto');

const escaparRegex = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Arma el filtro de MongoDB a partir de los parámetros de búsqueda. */
function construirFiltro({ buscar, categoria, minPrecio, maxPrecio, soloDe } = {}) {
  const filtro = {};
  if (categoria) filtro.categoria = categoria;
  if (soloDe) filtro.creadoPor = soloDe;
  if (minPrecio !== undefined || maxPrecio !== undefined) {
    filtro.precio = {};
    if (minPrecio !== undefined) filtro.precio.$gte = minPrecio;
    if (maxPrecio !== undefined) filtro.precio.$lte = maxPrecio;
  }
  if (buscar) {
    const patron = new RegExp(escaparRegex(buscar), 'i');
    filtro.$or = [{ nombre: patron }, { sku: patron }, { descripcion: patron }];
  }
  return filtro;
}

/** GET /api/productos → lista paginada con filtros */
async function listar(req, res) {
  const { pagina, limite, orden } = req.consulta;
  const filtro = construirFiltro(req.consulta);

  const [productos, total] = await Promise.all([
    Producto.find(filtro)
      .sort({ ...orden, _id: 1 })
      .skip((pagina - 1) * limite)
      .limit(limite)
      .populate('creadoPor', 'nombre'),
    Producto.countDocuments(filtro),
  ]);

  res.json({ datos: productos, paginacion: { pagina, limite, total, paginas: Math.max(1, Math.ceil(total / limite)) } });
}

/** GET /api/productos/:id (el producto lo cargó el middleware cargarProducto) */
function obtener(req, res) {
  res.json(req.producto);
}

/** POST /api/productos → 201 */
async function crear(req, res) {
  const producto = await Producto.create({ ...req.body, creadoPor: req.usuario._id });
  await producto.populate('creadoPor', 'nombre correo');
  res.status(201).location(`/api/productos/${producto.id}`).json({ mensaje: 'Producto creado.', producto });
}

/** PUT /api/productos/:id → actualiza solo los campos enviados; save() vuelve a aplicar las validaciones del esquema */
async function actualizar(req, res) {
  const { producto } = req;
  producto.set(req.body);
  producto.actualizadoPor = req.usuario._id;
  await producto.save();
  await producto.populate('actualizadoPor', 'nombre');
  res.json({ mensaje: 'Producto actualizado.', producto });
}

/** DELETE /api/productos/:id */
async function eliminar(req, res) {
  await req.producto.deleteOne();
  res.json({ mensaje: `Producto ${req.producto.sku} eliminado.`, producto: req.producto });
}

/** GET /api/productos/resumen → totales del inventario con el framework de agregación de MongoDB */
async function resumen(req, res) {
  const [general = {}] = await Producto.aggregate([
    {
      $group: {
        _id: null,
        productos: { $sum: 1 },
        unidades: { $sum: '$stock' },
        valorInventario: { $sum: { $multiply: ['$precio', '$stock'] } },
        bajoStock: { $sum: { $cond: [{ $lte: ['$stock', 5] }, 1, 0] } },
      },
    },
  ]);
  const porCategoria = await Producto.aggregate([
    { $group: { _id: '$categoria', productos: { $sum: 1 }, unidades: { $sum: '$stock' } } },
    { $sort: { productos: -1, _id: 1 } },
    { $project: { _id: 0, categoria: '$_id', productos: 1, unidades: 1 } },
  ]);
  res.json({
    productos: general.productos ?? 0,
    unidades: general.unidades ?? 0,
    valorInventario: Math.round((general.valorInventario ?? 0) * 100) / 100,
    bajoStock: general.bajoStock ?? 0,
    porCategoria,
  });
}

/** GET /api/productos/categorias */
function categorias(req, res) {
  res.json(Producto.CATEGORIAS);
}

module.exports = { listar, obtener, crear, actualizar, eliminar, resumen, categorias, construirFiltro };
