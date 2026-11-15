// Pruebas unitarias del controlador de autenticación (Usuario, Sesion y bcrypt simulados; sin base de datos).
// Versión inicial generada con GitHub Copilot (docs/copilot/auth.controller.test.copilot.js)
// y ajustada a mano; cada cambio está marcado con "AJUSTE" y explicado en docs/pruebas-ia.md.
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

// AJUSTE 1: Copilot simulaba también jsonwebtoken (sign y decode devolvían valores fijos), así que la prueba
// nunca comprobaba que el token fuera válido. Ahora se usa la librería real y el token se verifica con jwt.verify.
// bcrypt sí se sigue simulando para controlar si la contraseña "coincide" sin calcular hashes reales.
jest.mock('bcryptjs', () => ({
  hashSync: jest.fn(() => 'hash-relleno'),
  compare: jest.fn(),
}));

const jwt = require('jsonwebtoken');
const Usuario = require('../../../src/models/Usuario');
const Sesion = require('../../../src/models/Sesion');
const bcrypt = require('bcryptjs');
const config = require('../../../src/config/env');

const {
  registrar,
  iniciarSesion,
  perfil,
  cerrarSesion,
} = require('../../../src/controllers/auth.controller');
// AJUSTE 2: se usan los simuladores compartidos del proyecto en lugar de copias locales,
// y se quitó beforeEach(jest.clearAllMocks) porque jest.config.js ya limpia los mocks.
const { respuestaSimulada, consultaSimulada } = require('../../helpers/simulaciones');

/** Usuario de prueba como lo devolvería Mongoose. */
function usuarioDePrueba(datos = {}) {
  return {
    _id: 'object-id-usuario-1',
    id: 'usuario-1',
    nombre: 'Ana Pérez',
    correo: 'ana@example.com',
    rol: 'usuario',
    passwordHash: 'hash-de-la-contrasena',
    aPublico: jest.fn(() => ({ id: 'usuario-1', nombre: 'Ana Pérez', correo: 'ana@example.com', rol: 'usuario' })),
    ...datos,
  };
}

/** Petición de login con encabezados simulados. */
function peticionLogin({ agente = 'Jest Test Browser', ip = '192.168.1.20' } = {}) {
  return {
    body: { correo: '  ANA@EXAMPLE.COM ', password: 'secreto-123' },
    ip,
    get: jest.fn((nombre) => (nombre === 'User-Agent' ? agente : undefined)),
  };
}

describe('controlador de autenticación', () => {
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
      // AJUSTE 3: la contraseña se cifra ANTES de guardar; si fuera al revés se guardaría sin hash.
      expect(usuario.definirPassword.mock.invocationCallOrder[0]).toBeLessThan(usuario.save.mock.invocationCallOrder[0]);
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
    test('firma un JWT válido, guarda la sesión con el mismo jti y establece cookie httpOnly', async () => {
      const usuario = usuarioDePrueba();
      Usuario.findOne.mockReturnValue(consultaSimulada(usuario));
      bcrypt.compare.mockResolvedValue(true);
      Sesion.create.mockResolvedValue({});

      const req = peticionLogin();
      const res = respuestaSimulada();

      await iniciarSesion(req, res);

      expect(Usuario.findOne).toHaveBeenCalledWith({ correo: 'ana@example.com' });
      expect(Usuario.findOne.mock.results[0].value.select).toHaveBeenCalledWith('+passwordHash');
      expect(bcrypt.compare).toHaveBeenCalledWith('secreto-123', 'hash-de-la-contrasena');

      // AJUSTE 1 (cont.): el token se verifica de verdad con el secreto, el algoritmo y el emisor del servidor.
      const { token, expiraEn, tipo } = res.json.mock.calls[0][0];
      const datos = jwt.verify(token, config.jwt.secreto, { algorithms: ['HS256'], issuer: 'gestor-productos' });
      expect(datos).toMatchObject({ sub: 'usuario-1', nombre: 'Ana Pérez', rol: 'usuario' });
      expect(datos).not.toHaveProperty('passwordHash'); // el token no lleva datos sensibles
      expect(datos.exp - datos.iat).toBe(2 * 60 * 60); // JWT_EXPIRES_IN = 2h
      expect(tipo).toBe('Bearer');

      // AJUSTE 4: Copilot aceptaba cualquier texto como jti. El jti guardado en la sesión debe ser el MISMO
      // del token: es lo que permite que el logout invalide ese token.
      const datosSesion = Sesion.create.mock.calls[0][0];
      expect(datosSesion).toEqual({
        usuario: 'object-id-usuario-1',
        jti: datos.jti,
        expiraEn: new Date(datos.exp * 1000),
        ip: '192.168.1.20',
        agente: 'Jest Test Browser',
      });
      expect(expiraEn).toEqual(new Date(datos.exp * 1000));

      expect(res.cookie).toHaveBeenCalledWith('token', token, {
        httpOnly: true,
        secure: false, // en pruebas/desarrollo; en producción ver la prueba de abajo
        sameSite: 'strict',
        path: '/',
        expires: new Date(datos.exp * 1000),
      });
    });

    // AJUSTE 5: dos inicios de sesión del mismo usuario generan identificadores distintos (sesiones independientes).
    test('cada inicio de sesión genera un jti diferente', async () => {
      Usuario.findOne.mockImplementation(() => consultaSimulada(usuarioDePrueba()));
      bcrypt.compare.mockResolvedValue(true);

      await iniciarSesion(peticionLogin(), respuestaSimulada());
      await iniciarSesion(peticionLogin(), respuestaSimulada());

      const [primera, segunda] = Sesion.create.mock.calls.map(([sesion]) => sesion.jti);
      expect(primera).not.toBe(segunda);
    });

    // AJUSTE 6: el agente se recorta a 200 caracteres (límite del esquema Sesion) y si no hay encabezados no falla.
    test('recorta el User-Agent a 200 caracteres y tolera petición sin IP ni User-Agent', async () => {
      Usuario.findOne.mockImplementation(() => consultaSimulada(usuarioDePrueba()));
      bcrypt.compare.mockResolvedValue(true);

      await iniciarSesion(peticionLogin({ agente: 'x'.repeat(500) }), respuestaSimulada());
      await iniciarSesion({ body: { correo: 'ana@example.com', password: 'secreto-123' }, get: () => undefined }, respuestaSimulada());

      expect(Sesion.create.mock.calls[0][0].agente).toHaveLength(200);
      expect(Sesion.create.mock.calls[1][0]).toMatchObject({ agente: '', ip: '' });
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

      // Bien detectado por Copilot: aunque el correo no exista se compara contra un hash de relleno,
      // así la respuesta tarda lo mismo y no revela qué correos están registrados.
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'secreto-123',
        'hash-relleno',
      );
      expect(Sesion.create).not.toHaveBeenCalled();
      expect(res.cookie).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    test('rechaza con 401 cuando la contraseña es incorrecta (mismo mensaje que correo inexistente)', async () => {
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
      expect(Sesion.create).not.toHaveBeenCalled();
      expect(res.cookie).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  // AJUSTE 7: Copilot solo probó la cookie en modo de pruebas (secure: false). En producción (Render, HTTPS)
  // la cookie debe marcarse Secure para que nunca viaje sin cifrar.
  describe('en producción', () => {
    const entornoOriginal = { ...process.env };
    afterEach(() => {
      process.env = { ...entornoOriginal };
    });

    test('la cookie de sesión se marca como Secure', async () => {
      process.env.NODE_ENV = 'production';
      process.env.MONGODB_URI = 'mongodb://servidor-de-prueba/gestor';

      let controlador;
      let modelos;
      jest.isolateModules(() => {
        controlador = require('../../../src/controllers/auth.controller');
        modelos = {
          Usuario: require('../../../src/models/Usuario'),
          bcrypt: require('bcryptjs'),
        };
      });
      modelos.Usuario.findOne.mockReturnValue(consultaSimulada(usuarioDePrueba()));
      modelos.bcrypt.compare.mockResolvedValue(true);
      const res = respuestaSimulada();

      await controlador.iniciarSesion(peticionLogin(), res);

      expect(res.cookie.mock.calls[0][2]).toMatchObject({ httpOnly: true, secure: true, sameSite: 'strict' });
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

    // AJUSTE 8: si MongoDB no logra borrar la sesión, no se debe confirmar el cierre (el token seguiría sirviendo).
    test('si no se puede borrar la sesión, no limpia la cookie ni confirma el cierre', async () => {
      Sesion.deleteOne.mockRejectedValue(new Error('MongoDB no disponible'));
      const res = respuestaSimulada();

      await expect(cerrarSesion({ sesion: { jti: 'sesion-123' } }, res)).rejects.toThrow('MongoDB no disponible');
      expect(res.clearCookie).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });
});
