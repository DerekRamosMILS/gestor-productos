// tests/unit/auth.controller.test.js
jest.mock('../../../src/models/Usuario', () => {
  const Usuario = jest.fn();

  Usuario.exists = jest.fn();
  Usuario.findOne = jest.fn();

  return Usuario;
});

jest.mock('../../../src/models/Sesion', () => ({
  create: jest.fn(),
  deleteOne: jest.fn(),
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  decode: jest.fn(),
}));

jest.mock('bcryptjs', () => ({
  hashSync: jest.fn(() => 'hash-relleno'),
  compare: jest.fn(),
}));

const Usuario = require('../../../src/models/Usuario');
const Sesion = require('../../../src/models/Sesion');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const {
  registrar,
  iniciarSesion,
  perfil,
  cerrarSesion,
} = require('../../../src/controllers/auth.controller');

function respuestaSimulada() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.cookie = jest.fn(() => res);
  res.clearCookie = jest.fn(() => res);
  return res;
}

function consultaSimulada(resultado) {
  const consulta = {};

  consulta.select = jest.fn(() => consulta);
  consulta.then = jest.fn((resolver, rechazar) => Promise.resolve(resultado).then(resolver, rechazar));

  return consulta;
}

describe('controlador de autenticación', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('registrar', () => {
    test('registra una cuenta y responde 201', async () => {
      const datosPublicos = {
        id: 'usuario-1',
        nombre: 'Ana Pérez',
        correo: 'ana@example.com',
        rol: 'usuario',
      };

      const usuario = {
        definirPassword: jest.fn().mockResolvedValue(undefined),
        save: jest.fn().mockResolvedValue(undefined),
        aPublico: jest.fn(() => datosPublicos),
      };

      Usuario.exists.mockResolvedValue(null);
      Usuario.mockImplementation(() => usuario);

      const req = {
        body: {
          nombre: '  Ana Pérez  ',
          correo: '  ANA@EXAMPLE.COM ',
          password: 'secreto-123',
        },
      };
      const res = respuestaSimulada();

      await registrar(req, res);

      expect(Usuario.exists).toHaveBeenCalledWith({
        correo: 'ana@example.com',
      });
      expect(Usuario).toHaveBeenCalledWith({
        nombre: 'Ana Pérez',
        correo: 'ana@example.com',
      });
      expect(usuario.definirPassword).toHaveBeenCalledWith('secreto-123');
      expect(usuario.save).toHaveBeenCalledTimes(1);
      expect(usuario.aPublico).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        mensaje: 'Cuenta creada. Ya puedes iniciar sesión.',
        usuario: datosPublicos,
      });
    });

    test('rechaza el registro cuando el correo ya existe con 409', async () => {
      Usuario.exists.mockResolvedValue({ _id: 'usuario-existente' });

      const req = {
        body: {
          nombre: 'Ana Pérez',
          correo: 'ANA@EXAMPLE.COM',
          password: 'secreto-123',
        },
      };
      const res = respuestaSimulada();

      await expect(registrar(req, res)).rejects.toMatchObject({
        estado: 409,
        message: 'Ya existe una cuenta con ese correo.',
      });

      expect(Usuario.exists).toHaveBeenCalledWith({
        correo: 'ana@example.com',
      });
      expect(Usuario).not.toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe('iniciarSesion', () => {
    test('firma el token, guarda la sesión y establece cookie httpOnly', async () => {
      const datosPublicos = {
        id: 'usuario-1',
        nombre: 'Ana Pérez',
        correo: 'ana@example.com',
        rol: 'usuario',
      };

      const usuario = {
        _id: 'object-id-usuario-1',
        id: 'usuario-1',
        nombre: 'Ana Pérez',
        correo: 'ana@example.com',
        rol: 'usuario',
        passwordHash: 'hash-de-la-contrasena',
        aPublico: jest.fn(() => datosPublicos),
      };

      const fechaExpiracion = 2000000000;
      const token = 'token-firmado';

      Usuario.findOne.mockReturnValue(consultaSimulada(usuario));
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue(token);
      jwt.decode.mockReturnValue({ exp: fechaExpiracion });
      Sesion.create.mockResolvedValue({});

      const req = {
        body: {
          correo: '  ANA@EXAMPLE.COM ',
          password: 'secreto-123',
        },
        ip: '192.168.1.20',
        get: jest.fn((nombre) => {
          if (nombre === 'User-Agent') return 'Jest Test Browser';
          return undefined;
        }),
      };
      const res = respuestaSimulada();

      await iniciarSesion(req, res);

      expect(Usuario.findOne).toHaveBeenCalledWith({
        correo: 'ana@example.com',
      });

      const consulta = Usuario.findOne.mock.results[0].value;
      expect(consulta.select).toHaveBeenCalledWith('+passwordHash');
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'secreto-123',
        'hash-de-la-contrasena',
      );

      expect(jwt.sign).toHaveBeenCalledWith(
        {
          nombre: 'Ana Pérez',
          rol: 'usuario',
        },
        expect.any(String),
        {
          subject: 'usuario-1',
          jwtid: expect.any(String),
          expiresIn: expect.any(String),
          issuer: expect.any(String),
          algorithm: 'HS256',
        },
      );

      const datosSesion = Sesion.create.mock.calls[0][0];

      expect(datosSesion).toEqual({
        usuario: 'object-id-usuario-1',
        jti: expect.any(String),
        expiraEn: new Date(fechaExpiracion * 1000),
        ip: '192.168.1.20',
        agente: 'Jest Test Browser',
      });

      expect(res.cookie).toHaveBeenCalledWith(
        'token',
        token,
        expect.objectContaining({
          httpOnly: true,
          secure: false,
          sameSite: 'strict',
          path: '/',
          expires: new Date(fechaExpiracion * 1000),
        }),
      );

      expect(res.json).toHaveBeenCalledWith({
        mensaje: 'Bienvenido, Ana Pérez.',
        token,
        tipo: 'Bearer',
        expiraEn: new Date(fechaExpiracion * 1000),
        usuario: datosPublicos,
      });
    });

    test('rechaza con 401 cuando el correo no existe', async () => {
      Usuario.findOne.mockReturnValue(consultaSimulada(null));
      bcrypt.compare.mockResolvedValue(false);

      const req = {
        body: {
          correo: 'inexistente@example.com',
          password: 'secreto-123',
        },
      };
      const res = respuestaSimulada();

      await expect(iniciarSesion(req, res)).rejects.toMatchObject({
        estado: 401,
        message: 'Correo o contraseña incorrectos.',
      });

      expect(bcrypt.compare).toHaveBeenCalledWith(
        'secreto-123',
        'hash-relleno',
      );
      expect(jwt.sign).not.toHaveBeenCalled();
      expect(Sesion.create).not.toHaveBeenCalled();
      expect(res.cookie).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    test('rechaza con 401 cuando la contraseña es incorrecta', async () => {
      const usuario = {
        id: 'usuario-1',
        nombre: 'Ana Pérez',
        passwordHash: 'hash-correcto',
      };

      Usuario.findOne.mockReturnValue(consultaSimulada(usuario));
      bcrypt.compare.mockResolvedValue(false);

      const req = {
        body: {
          correo: 'ana@example.com',
          password: 'incorrecta',
        },
      };
      const res = respuestaSimulada();

      await expect(iniciarSesion(req, res)).rejects.toMatchObject({
        estado: 401,
        message: 'Correo o contraseña incorrectos.',
      });

      expect(bcrypt.compare).toHaveBeenCalledWith(
        'incorrecta',
        'hash-correcto',
      );
      expect(jwt.sign).not.toHaveBeenCalled();
      expect(Sesion.create).not.toHaveBeenCalled();
      expect(res.cookie).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe('perfil', () => {
    test('responde con los datos públicos del usuario y la expiración de la sesión', () => {
      const datosPublicos = {
        id: 'usuario-1',
        nombre: 'Ana Pérez',
        correo: 'ana@example.com',
        rol: 'usuario',
      };

      const usuario = {
        aPublico: jest.fn(() => datosPublicos),
      };

      const fechaExpiracion = new Date('2030-01-01T00:00:00.000Z');
      const req = {
        usuario,
        sesion: {
          expiraEn: fechaExpiracion,
        },
      };
      const res = respuestaSimulada();

      perfil(req, res);

      expect(usuario.aPublico).toHaveBeenCalledTimes(1);
      expect(res.json).toHaveBeenCalledWith({
        usuario: datosPublicos,
        sesion: {
          expiraEn: fechaExpiracion,
        },
      });
    });
  });

  describe('cerrarSesion', () => {
    test('elimina la sesión, limpia la cookie y responde correctamente', async () => {
      Sesion.deleteOne.mockResolvedValue({ deletedCount: 1 });

      const req = {
        sesion: {
          jti: 'sesion-123',
        },
      };
      const res = respuestaSimulada();

      await cerrarSesion(req, res);

      expect(Sesion.deleteOne).toHaveBeenCalledWith({
        jti: 'sesion-123',
      });
      expect(res.clearCookie).toHaveBeenCalledWith(
        'token',
        expect.objectContaining({
          httpOnly: true,
          secure: false,
          sameSite: 'strict',
          path: '/',
          expires: undefined,
        }),
      );
      expect(res.json).toHaveBeenCalledWith({
        mensaje: 'Sesión cerrada.',
      });
    });
  });
});
