// Pruebas unitarias del manejador central de errores.
const mongoose = require('mongoose');
const Producto = require('../../../src/models/Producto');
const ErrorApi = require('../../../src/utils/ErrorApi');
const { manejadorErrores, rutaNoEncontrada } = require('../../../src/middleware/errores');
const { respuestaSimulada } = require('../../helpers/simulaciones');

const responder = (error) => {
  const res = respuestaSimulada();
  manejadorErrores(error, { method: 'GET', originalUrl: '/api/x' }, res, jest.fn());
  return { estado: res.status.mock.calls[0][0], cuerpo: res.json.mock.calls[0][0], res };
};

test('ErrorApi conserva su código y mensaje', () => {
  const { estado, cuerpo } = responder(ErrorApi.prohibido('No puedes.'));
  expect(estado).toBe(403);
  expect(cuerpo).toEqual({ error: { estado: 403, mensaje: 'No puedes.' } });
});

test('un 401 agrega el encabezado WWW-Authenticate', () => {
  const { res } = responder(ErrorApi.noAutenticado());
  expect(res.set).toHaveBeenCalledWith('WWW-Authenticate', 'Bearer');
});

test('ValidationError de Mongoose → 400 con un detalle por campo', async () => {
  const error = await new Producto({ nombre: 'X', sku: 'a b', precio: -1, stock: 1.5, categoria: 'Juguetes' }).validate().catch((e) => e);
  const { estado, cuerpo } = responder(error);
  expect(estado).toBe(400);
  expect(Object.keys(cuerpo.error.detalles)).toEqual(expect.arrayContaining(['nombre', 'sku', 'precio', 'stock', 'categoria', 'creadoPor']));
});

test('CastError (tipo incorrecto) → 400', () => {
  const error = new mongoose.Error.CastError('Number', 'abc', 'precio');
  expect(responder(error).estado).toBe(400);
});

test('clave duplicada de MongoDB (11000) → 409 con mensaje claro', () => {
  const { estado, cuerpo } = responder({ code: 11000, keyValue: { sku: 'OF-1' } });
  expect(estado).toBe(409);
  expect(cuerpo.error.mensaje).toBe('Ya existe un producto con el SKU OF-1.');
});

test('JSON mal formado → 400', () => {
  expect(responder({ type: 'entity.parse.failed' }).estado).toBe(400);
});

test('error inesperado → 500 sin exponer detalles internos', () => {
  const espia = jest.spyOn(console, 'error').mockImplementation(() => {});
  const { estado, cuerpo } = responder(new Error('ECONNRESET en /ruta/interna'));
  expect(estado).toBe(500);
  expect(JSON.stringify(cuerpo)).not.toMatch(/ECONNRESET/);
  expect(espia).toHaveBeenCalled();
});

test('rutaNoEncontrada genera un 404 con la ruta', () => {
  const next = jest.fn();
  rutaNoEncontrada({ method: 'GET', originalUrl: '/api/nada' }, {}, next);
  expect(next.mock.calls[0][0]).toMatchObject({ estado: 404, message: 'La ruta GET /api/nada no existe.' });
});
