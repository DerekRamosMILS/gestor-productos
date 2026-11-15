// Pruebas unitarias de los middlewares de autenticación y autorización (modelos simulados, sin base de datos).
jest.mock('../../../src/models/Sesion');
jest.mock('../../../src/models/Usuario');

const jwt = require('jsonwebtoken');
const config = require('../../../src/config/env');
const Sesion = require('../../../src/models/Sesion');
const Usuario = require('../../../src/models/Usuario');
const { verificarToken, permitirRoles, soloDuenoOAdmin } = require('../../../src/middleware/auth');

const firmar = (datos = {}, opciones = {}) => jwt.sign({ nombre: 'Ana', rol: 'usuario', ...datos }, config.jwt.secreto, {
  subject: '64b7f0c2a1b2c3d4e5f60718', jwtid: 'sesion-1', expiresIn: '1h', issuer: config.jwt.emisor, ...opciones,
});
const solicitud = ({ token, cookie } = {}) => ({
  get: (h) => (h === 'Authorization' && token ? `Bearer ${token}` : undefined),
  cookies: cookie ? { token: cookie } : {},
});

describe('verificarToken', () => {
  const usuario = { _id: '64b7f0c2a1b2c3d4e5f60718', correo: 'ana@correo.com', rol: 'usuario' };

  test('sin token responde 401', async () => {
    const next = jest.fn();
    await verificarToken(solicitud(), {}, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ estado: 401 }));
  });

  test('token con firma alterada responde 401 "El token no es válido"', async () => {
    const next = jest.fn();
    await verificarToken(solicitud({ token: `${firmar()}x` }), {}, next);
    expect(next.mock.calls[0][0]).toMatchObject({ estado: 401, message: 'El token no es válido.' });
  });

  test('token expirado responde 401 con mensaje de sesión expirada', async () => {
    const next = jest.fn();
    const vencido = firmar({}, { expiresIn: -10 });
    await verificarToken(solicitud({ token: vencido }), {}, next);
    expect(next.mock.calls[0][0].message).toMatch(/expiró/);
  });

  test('token de otro emisor se rechaza', async () => {
    const next = jest.fn();
    await verificarToken(solicitud({ token: firmar({}, { issuer: 'otro-sistema' }) }), {}, next);
    expect(next.mock.calls[0][0].estado).toBe(401);
  });

  test('si la sesión se cerró en MongoDB responde 401 aunque el token sea válido', async () => {
    Sesion.exists.mockResolvedValue(null);
    Usuario.findById.mockResolvedValue(usuario);
    const next = jest.fn();
    await verificarToken(solicitud({ token: firmar() }), {}, next);
    expect(next.mock.calls[0][0].message).toMatch(/sesión ya se cerró/);
  });

  test('token válido desde el encabezado: deja req.usuario y req.sesion', async () => {
    Sesion.exists.mockResolvedValue({ _id: 'x' });
    Usuario.findById.mockResolvedValue(usuario);
    const req = solicitud({ token: firmar() });
    const next = jest.fn();
    await verificarToken(req, {}, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.usuario).toBe(usuario);
    expect(req.sesion.jti).toBe('sesion-1');
    expect(Sesion.exists).toHaveBeenCalledWith({ jti: 'sesion-1', usuario: usuario._id });
  });

  test('también acepta el token desde la cookie httpOnly', async () => {
    Sesion.exists.mockResolvedValue({ _id: 'x' });
    Usuario.findById.mockResolvedValue(usuario);
    const next = jest.fn();
    await verificarToken(solicitud({ cookie: firmar() }), {}, next);
    expect(next).toHaveBeenCalledWith();
  });

  test('si el usuario fue borrado responde 401', async () => {
    Sesion.exists.mockResolvedValue({ _id: 'x' });
    Usuario.findById.mockResolvedValue(null);
    const next = jest.fn();
    await verificarToken(solicitud({ token: firmar() }), {}, next);
    expect(next.mock.calls[0][0].estado).toBe(401);
  });
});

describe('permitirRoles', () => {
  test('deja pasar al rol permitido', () => {
    const next = jest.fn();
    permitirRoles('admin')({ usuario: { rol: 'admin' } }, {}, next);
    expect(next).toHaveBeenCalledWith();
  });

  test('bloquea con 403 a otro rol', () => {
    const next = jest.fn();
    permitirRoles('admin')({ usuario: { rol: 'usuario' } }, {}, next);
    expect(next.mock.calls[0][0].estado).toBe(403);
  });

  test('sin usuario autenticado responde 401', () => {
    const next = jest.fn();
    permitirRoles('admin')({}, {}, next);
    expect(next.mock.calls[0][0].estado).toBe(401);
  });
});

describe('soloDuenoOAdmin', () => {
  const producto = { creadoPor: { _id: 'u1', nombre: 'Ana' } };

  test('el creador puede modificar', () => {
    const next = jest.fn();
    soloDuenoOAdmin({ producto, usuario: { _id: 'u1', rol: 'usuario' } }, {}, next);
    expect(next).toHaveBeenCalledWith();
  });

  test('un administrador puede modificar productos de otros', () => {
    const next = jest.fn();
    soloDuenoOAdmin({ producto, usuario: { _id: 'u9', rol: 'admin' } }, {}, next);
    expect(next).toHaveBeenCalledWith();
  });

  test('otro usuario recibe 403', () => {
    const next = jest.fn();
    soloDuenoOAdmin({ producto, usuario: { _id: 'u2', rol: 'usuario' } }, {}, next);
    expect(next.mock.calls[0][0].estado).toBe(403);
  });

  test('funciona también si creadoPor no está poblado (solo el ObjectId)', () => {
    const next = jest.fn();
    soloDuenoOAdmin({ producto: { creadoPor: 'u1' }, usuario: { _id: 'u1', rol: 'usuario' } }, {}, next);
    expect(next).toHaveBeenCalledWith();
  });
});
