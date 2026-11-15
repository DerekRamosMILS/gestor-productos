// Middlewares de autenticación (¿quién eres?) y autorización (¿qué puedes hacer?).
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const Sesion = require('../models/Sesion');
const Usuario = require('../models/Usuario');
const ErrorApi = require('../utils/ErrorApi');

const NOMBRE_COOKIE = 'token';

/** El token puede llegar en el encabezado Authorization (clientes de API) o en una cookie httpOnly (navegador). */
function extraerToken(req) {
  const [esquema, token] = (req.get('Authorization') ?? '').split(' ');
  if (esquema === 'Bearer' && token) return token;
  return req.cookies?.[NOMBRE_COOKIE] ?? null;
}

/**
 * Verifica el JWT y que su sesión siga abierta en MongoDB.
 * Si todo está bien deja el usuario en req.usuario y la sesión en req.sesion; si no, responde 401.
 */
async function verificarToken(req, res, next) {
  try {
    const token = extraerToken(req);
    if (!token) throw ErrorApi.noAutenticado('Falta el token. Inicia sesión o envía el encabezado Authorization: Bearer <token>.');

    let datos;
    try {
      datos = jwt.verify(token, config.jwt.secreto, { algorithms: ['HS256'], issuer: config.jwt.emisor });
    } catch (error) {
      throw ErrorApi.noAutenticado(error.name === 'TokenExpiredError' ? 'La sesión expiró. Inicia sesión de nuevo.' : 'El token no es válido.');
    }

    const [sesionAbierta, usuario] = await Promise.all([
      Sesion.exists({ jti: datos.jti, usuario: datos.sub }),
      Usuario.findById(datos.sub),
    ]);
    if (!sesionAbierta) throw ErrorApi.noAutenticado('Esta sesión ya se cerró. Inicia sesión de nuevo.');
    if (!usuario) throw ErrorApi.noAutenticado('El usuario de este token ya no existe.');

    req.usuario = usuario;
    req.sesion = { jti: datos.jti, expiraEn: new Date(datos.exp * 1000) };
    return next();
  } catch (error) {
    return next(error);
  }
}

/** Permite el paso solo a ciertos roles (por ejemplo permitirRoles('admin')). */
function permitirRoles(...roles) {
  return (req, res, next) => {
    if (!req.usuario) return next(ErrorApi.noAutenticado());
    if (!roles.includes(req.usuario.rol)) return next(ErrorApi.prohibido(`Esta acción requiere el rol: ${roles.join(' o ')}.`));
    return next();
  };
}

/** Un producto solo lo puede modificar o eliminar quien lo creó o un administrador. Requiere cargarProducto antes. */
function soloDuenoOAdmin(req, res, next) {
  const creador = req.producto.creadoPor?._id ?? req.producto.creadoPor;
  const esDueno = String(creador) === String(req.usuario._id);
  if (esDueno || req.usuario.rol === 'admin') return next();
  return next(ErrorApi.prohibido('Solo quien creó el producto o un administrador puede modificarlo o eliminarlo.'));
}

module.exports = { verificarToken, permitirRoles, soloDuenoOAdmin, extraerToken, NOMBRE_COOKIE };
