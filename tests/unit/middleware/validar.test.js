// Pruebas unitarias de los middlewares de validación.
const {
  validarObjectId, validarProductoNuevo, validarCambiosProducto, validarConsulta, validarRegistro, validarLogin,
} = require('../../../src/middleware/validar');

const ejecutar = (middleware, req) => {
  const next = jest.fn();
  middleware(req, {}, next);
  return next.mock.calls[0][0];
};

describe('validarObjectId', () => {
  test('acepta un ObjectId de 24 caracteres', () => {
    expect(ejecutar(validarObjectId, { params: { id: '64b7f0c2a1b2c3d4e5f60718' } })).toBeUndefined();
  });
  test('rechaza un id inválido con 400', () => {
    expect(ejecutar(validarObjectId, { params: { id: '123' } })).toMatchObject({ estado: 400 });
  });
});

describe('validarProductoNuevo / validarCambiosProducto', () => {
  test('acepta los campos permitidos', () => {
    expect(ejecutar(validarProductoNuevo, { body: { nombre: 'Mouse', sku: 'OF-1', precio: 10, stock: 2, categoria: 'Oficina' } })).toBeUndefined();
  });
  test('rechaza campos no permitidos como creadoPor (asignación masiva)', () => {
    const error = ejecutar(validarProductoNuevo, { body: { nombre: 'X', creadoPor: 'otro' } });
    expect(error.estado).toBe(400);
    expect(error.detalles.campos).toMatch(/creadoPor/);
  });
  test('rechaza un cuerpo que no es objeto', () => {
    expect(ejecutar(validarProductoNuevo, { body: [1, 2] }).estado).toBe(400);
  });
  test('en una actualización exige al menos un campo', () => {
    expect(ejecutar(validarCambiosProducto, { body: {} }).estado).toBe(400);
    expect(ejecutar(validarCambiosProducto, { body: { stock: 4 } })).toBeUndefined();
  });
});

describe('validarConsulta', () => {
  test('aplica valores por defecto', () => {
    const req = { query: {}, usuario: { _id: 'u1' } };
    expect(ejecutar(validarConsulta, req)).toBeUndefined();
    expect(req.consulta).toEqual({ orden: { creadoEn: -1 }, pagina: 1, limite: 10 });
  });
  test('convierte filtros válidos', () => {
    const req = { query: { buscar: ' mouse ', categoria: 'Oficina', minPrecio: '10', maxPrecio: '99.5', orden: 'precio-asc', pagina: '2', limite: '5', mios: 'true' }, usuario: { _id: 'u1' } };
    expect(ejecutar(validarConsulta, req)).toBeUndefined();
    expect(req.consulta).toMatchObject({ buscar: 'mouse', categoria: 'Oficina', minPrecio: 10, maxPrecio: 99.5, pagina: 2, limite: 5, soloDe: 'u1' });
  });
  test('reporta cada filtro inválido en detalles', () => {
    const error = ejecutar(validarConsulta, { query: { categoria: 'Juguetes', orden: 'x', pagina: '0', limite: '500', minPrecio: '-1' }, usuario: {} });
    expect(error.estado).toBe(400);
    expect(Object.keys(error.detalles)).toEqual(expect.arrayContaining(['categoria', 'orden', 'pagina', 'limite', 'minPrecio']));
  });
  test('minPrecio no puede ser mayor que maxPrecio', () => {
    const error = ejecutar(validarConsulta, { query: { minPrecio: '50', maxPrecio: '10' }, usuario: {} });
    expect(error.detalles.maxPrecio).toBeDefined();
  });
});

describe('validarRegistro y validarLogin', () => {
  test('registro válido', () => {
    expect(ejecutar(validarRegistro, { body: { nombre: 'Ana', correo: 'ana@correo.com', password: 'Segura123' } })).toBeUndefined();
  });
  test('contraseña sin números se rechaza', () => {
    expect(ejecutar(validarRegistro, { body: { nombre: 'Ana', correo: 'ana@correo.com', password: 'soloLetras' } }).detalles.password).toMatch(/letras y números/);
  });
  test('no se puede enviar el rol en el registro', () => {
    expect(ejecutar(validarRegistro, { body: { nombre: 'Ana', correo: 'ana@correo.com', password: 'Segura123', rol: 'admin' } }).detalles.campos).toMatch(/rol/);
  });
  test('login sin contraseña responde 400', () => {
    expect(ejecutar(validarLogin, { body: { correo: 'ana@correo.com' } }).estado).toBe(400);
  });
});
