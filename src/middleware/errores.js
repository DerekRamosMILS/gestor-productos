// Manejo central de errores: traduce cada error a su código HTTP y a un JSON con el mismo formato:
// { "error": { "estado": 400, "mensaje": "...", "detalles": { ... } } }
const mongoose = require('mongoose');
const ErrorApi = require('../utils/ErrorApi');

/** Rutas de la API que no existen → 404. */
function rutaNoEncontrada(req, res, next) {
  next(ErrorApi.noEncontrado(`La ruta ${req.method} ${req.originalUrl} no existe.`));
}

/** Convierte errores de Mongoose, de MongoDB y de body-parser en errores con su código HTTP. */
function normalizar(err) {
  if (err instanceof ErrorApi) return err;

  if (err.type === 'entity.parse.failed') {
    return ErrorApi.solicitudInvalida('El cuerpo no es un JSON válido. Revisa comillas, comas y llaves.');
  }
  if (err.type === 'entity.too.large') {
    return new ErrorApi(413, 'El cuerpo de la solicitud es demasiado grande (máximo 20 kb).');
  }
  if (err instanceof mongoose.Error.ValidationError) {
    const detalles = Object.fromEntries(Object.entries(err.errors).map(([campo, e]) => [
      campo,
      e instanceof mongoose.Error.CastError ? `El valor "${e.value}" no es válido para ${campo}.` : e.message,
    ]));
    return ErrorApi.solicitudInvalida('Los datos no son válidos.', detalles);
  }
  if (err instanceof mongoose.Error.CastError) {
    return ErrorApi.solicitudInvalida(`El valor "${err.value}" no es válido para ${err.path}.`);
  }
  if (err.code === 11000) {
    // Índice único duplicado (sku de producto o correo de usuario)
    const [campo, valor] = Object.entries(err.keyValue ?? {})[0] ?? ['campo', ''];
    const mensajes = { sku: `Ya existe un producto con el SKU ${valor}.`, correo: 'Ya existe una cuenta con ese correo.' };
    return ErrorApi.conflicto(mensajes[campo] ?? `Ya existe un registro con ${campo} = ${valor}.`);
  }
  return null;
}

// eslint-disable-next-line no-unused-vars
function manejadorErrores(err, req, res, next) {
  let error = normalizar(err);
  if (!error) {
    // Error inesperado: se registra completo en la consola, pero al cliente no se le muestran detalles internos
    console.error(`✖ Error 500 en ${req.method} ${req.originalUrl}:`, err);
    error = new ErrorApi(500, 'Ocurrió un error interno en el servidor. Intenta de nuevo más tarde.');
  }
  if (error.estado === 401) res.set('WWW-Authenticate', 'Bearer');
  return res.status(error.estado).json({
    error: { estado: error.estado, mensaje: error.message, ...(error.detalles && { detalles: error.detalles }) },
  });
}

module.exports = { rutaNoEncontrada, manejadorErrores, normalizar };
