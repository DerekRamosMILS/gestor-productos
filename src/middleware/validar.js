// Middlewares de validación de solicitudes. Revisan forma y campos permitidos antes de llegar al controlador;
// las reglas de cada valor (mínimos, máximos, formatos) las aplica el esquema de Mongoose al guardar.
const mongoose = require('mongoose');
const Producto = require('../models/Producto');
const ErrorApi = require('../utils/ErrorApi');

const esObjeto = (valor) => typeof valor === 'object' && valor !== null && !Array.isArray(valor);
const CAMPOS_PRODUCTO = ['nombre', 'sku', 'descripcion', 'precio', 'stock', 'categoria'];
const ORDENES = { recientes: { creadoEn: -1 }, nombre: { nombre: 1 }, 'precio-asc': { precio: 1 }, 'precio-desc': { precio: -1 }, stock: { stock: 1 } };

/** El id de la URL debe ser un ObjectId de MongoDB (24 caracteres hexadecimales). */
function validarObjectId(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return next(ErrorApi.solicitudInvalida(`El id "${req.params.id}" no es un identificador válido de MongoDB.`));
  }
  return next();
}

/**
 * Acepta solo los campos permitidos (evita que el cliente envíe creadoPor, rol, _id, etc.).
 * Con { almenosUno: true } exige al menos un campo (actualizaciones parciales).
 */
function soloCampos(permitidos, { almenosUno = false } = {}) {
  return (req, res, next) => {
    if (!esObjeto(req.body)) {
      return next(ErrorApi.solicitudInvalida('El cuerpo debe ser un objeto JSON. Envía el encabezado Content-Type: application/json.'));
    }
    const extra = Object.keys(req.body).filter((campo) => !permitidos.includes(campo));
    if (extra.length) {
      return next(ErrorApi.solicitudInvalida('La solicitud tiene campos no permitidos.', { campos: `No se aceptan: ${extra.join(', ')}. Campos válidos: ${permitidos.join(', ')}.` }));
    }
    if (almenosUno && Object.keys(req.body).length === 0) {
      return next(ErrorApi.solicitudInvalida(`Envía al menos un campo para actualizar: ${permitidos.join(', ')}.`));
    }
    return next();
  };
}

const validarProductoNuevo = soloCampos(CAMPOS_PRODUCTO);
const validarCambiosProducto = soloCampos(CAMPOS_PRODUCTO, { almenosUno: true });

/** Filtros, orden y paginación de GET /api/productos. Deja el resultado limpio en req.consulta. */
function validarConsulta(req, res, next) {
  const { buscar, categoria, minPrecio, maxPrecio, orden = 'recientes', pagina = '1', limite = '10', mios } = req.query;
  const errores = {};
  const consulta = { orden: ORDENES[orden], pagina: Number(pagina), limite: Number(limite) };

  if (buscar !== undefined) {
    if (typeof buscar !== 'string' || buscar.trim().length > 50) errores.buscar = 'La búsqueda debe tener máximo 50 caracteres.';
    else if (buscar.trim()) consulta.buscar = buscar.trim();
  }
  if (categoria !== undefined && categoria !== '') {
    if (!Producto.CATEGORIAS.includes(categoria)) errores.categoria = `Usa una de estas categorías: ${Producto.CATEGORIAS.join(', ')}.`;
    else consulta.categoria = categoria;
  }
  for (const [clave, valor] of [['minPrecio', minPrecio], ['maxPrecio', maxPrecio]]) {
    if (valor === undefined || valor === '') continue;
    const numero = Number(valor);
    if (!Number.isFinite(numero) || numero < 0) errores[clave] = `${clave} debe ser un número mayor o igual a 0.`;
    else consulta[clave] = numero;
  }
  if (consulta.minPrecio !== undefined && consulta.maxPrecio !== undefined && consulta.minPrecio > consulta.maxPrecio) {
    errores.maxPrecio = 'maxPrecio debe ser mayor o igual que minPrecio.';
  }
  if (!consulta.orden) errores.orden = `Usa uno de estos órdenes: ${Object.keys(ORDENES).join(', ')}.`;
  if (!Number.isInteger(consulta.pagina) || consulta.pagina < 1) errores.pagina = 'pagina debe ser un entero mayor o igual a 1.';
  if (!Number.isInteger(consulta.limite) || consulta.limite < 1 || consulta.limite > 50) errores.limite = 'limite debe ser un entero entre 1 y 50.';
  if (mios !== undefined) {
    if (mios === 'true') consulta.soloDe = req.usuario._id;
    else if (mios !== 'false') errores.mios = 'Usa mios=true para ver solo tus productos.';
  }

  if (Object.keys(errores).length) return next(ErrorApi.solicitudInvalida('Los filtros no son válidos.', errores));
  req.consulta = consulta;
  return next();
}

function validarRegistro(req, res, next) {
  if (!esObjeto(req.body)) return next(ErrorApi.solicitudInvalida('El cuerpo debe ser un objeto JSON.'));
  const { nombre, correo, password } = req.body;
  const errores = {};
  if (typeof nombre !== 'string' || nombre.trim().length < 2 || nombre.trim().length > 60) errores.nombre = 'Escribe un nombre de 2 a 60 caracteres.';
  if (typeof correo !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo.trim())) errores.correo = 'Escribe un correo válido.';
  if (typeof password !== 'string' || password.length < 8 || password.length > 72) errores.password = 'La contraseña debe tener entre 8 y 72 caracteres.';
  else if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) errores.password = 'La contraseña debe combinar letras y números.';
  const extra = Object.keys(req.body).filter((c) => !['nombre', 'correo', 'password'].includes(c));
  if (extra.length) errores.campos = `No se aceptan: ${extra.join(', ')}.`;
  if (Object.keys(errores).length) return next(ErrorApi.solicitudInvalida('Revisa los datos del registro.', errores));
  return next();
}

function validarLogin(req, res, next) {
  if (!esObjeto(req.body)) return next(ErrorApi.solicitudInvalida('El cuerpo debe ser un objeto JSON.'));
  const { correo, password } = req.body;
  const errores = {};
  if (typeof correo !== 'string' || !correo.trim()) errores.correo = 'Escribe tu correo.';
  if (typeof password !== 'string' || !password) errores.password = 'Escribe tu contraseña.';
  if (Object.keys(errores).length) return next(ErrorApi.solicitudInvalida('Faltan datos para iniciar sesión.', errores));
  return next();
}

module.exports = {
  validarObjectId, soloCampos, validarProductoNuevo, validarCambiosProducto, validarConsulta, validarRegistro, validarLogin,
  CAMPOS_PRODUCTO, ORDENES,
};
