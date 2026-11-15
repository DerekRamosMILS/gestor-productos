// Controlador de autenticación: registro, inicio de sesión, perfil y cierre de sesión.
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const Usuario = require('../models/Usuario');
const Sesion = require('../models/Sesion');
const ErrorApi = require('../utils/ErrorApi');
const { NOMBRE_COOKIE } = require('../middleware/auth');

// Si el correo no existe se compara contra este hash, para que la respuesta tarde lo mismo
// y no se pueda saber qué correos están registrados midiendo el tiempo.
const HASH_RELLENO = bcrypt.hashSync('relleno-para-igualar-tiempos', 4);

function opcionesCookie(expiraEn) {
  return {
    httpOnly: true, // JavaScript del navegador no puede leerla
    secure: config.esProduccion, // en Render solo viaja por HTTPS
    sameSite: 'strict', // no se envía desde otros sitios (protege contra CSRF)
    expires: expiraEn,
    path: '/',
  };
}

/** POST /api/auth/registro { nombre, correo, password } → 201 */
async function registrar(req, res) {
  const correo = req.body.correo.trim().toLowerCase();
  if (await Usuario.exists({ correo })) throw ErrorApi.conflicto('Ya existe una cuenta con ese correo.');

  const usuario = new Usuario({ nombre: req.body.nombre.trim(), correo });
  await usuario.definirPassword(req.body.password);
  await usuario.save();

  res.status(201).json({ mensaje: 'Cuenta creada. Ya puedes iniciar sesión.', usuario: usuario.aPublico() });
}

/** POST /api/auth/login { correo, password } → 200 con el token (también en cookie httpOnly) */
async function iniciarSesion(req, res) {
  const usuario = await Usuario.findOne({ correo: req.body.correo.trim().toLowerCase() }).select('+passwordHash');
  const coincide = await bcrypt.compare(req.body.password, usuario?.passwordHash ?? HASH_RELLENO);
  if (!usuario || !coincide) throw ErrorApi.noAutenticado('Correo o contraseña incorrectos.');

  const jti = crypto.randomUUID();
  const token = jwt.sign({ nombre: usuario.nombre, rol: usuario.rol }, config.jwt.secreto, {
    subject: usuario.id,
    jwtid: jti,
    expiresIn: config.jwt.expiraEn,
    issuer: config.jwt.emisor,
    algorithm: 'HS256',
  });
  const expiraEn = new Date(jwt.decode(token).exp * 1000);

  // La sesión queda registrada en MongoDB; el índice TTL la borra sola al expirar
  await Sesion.create({ usuario: usuario._id, jti, expiraEn, ip: req.ip ?? '', agente: (req.get('User-Agent') ?? '').slice(0, 200) });

  res.cookie(NOMBRE_COOKIE, token, opcionesCookie(expiraEn));
  res.json({ mensaje: `Bienvenido, ${usuario.nombre}.`, token, tipo: 'Bearer', expiraEn, usuario: usuario.aPublico() });
}

/** GET /api/auth/perfil (requiere token) */
function perfil(req, res) {
  res.json({ usuario: req.usuario.aPublico(), sesion: { expiraEn: req.sesion.expiraEn } });
}

/** POST /api/auth/logout (requiere token) → borra la sesión; el mismo token ya no sirve */
async function cerrarSesion(req, res) {
  await Sesion.deleteOne({ jti: req.sesion.jti });
  res.clearCookie(NOMBRE_COOKIE, { ...opcionesCookie(), expires: undefined });
  res.json({ mensaje: 'Sesión cerrada.' });
}

module.exports = { registrar, iniciarSesion, perfil, cerrarSesion, HASH_RELLENO };
