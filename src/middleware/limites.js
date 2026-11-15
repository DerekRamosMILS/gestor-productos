// Límite de intentos de inicio de sesión para frenar ataques de fuerza bruta (express-rate-limit).
// Solo cuentan los intentos fallidos; un inicio de sesión correcto no suma.
const { rateLimit } = require('express-rate-limit');
const config = require('../config/env');
const ErrorApi = require('../utils/ErrorApi');

const maximo = Number(process.env.LOGIN_MAX_INTENTOS) || (config.esPrueba ? 1000 : 5);

const limitarLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: maximo,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req, res, next) => next(new ErrorApi(429, 'Demasiados intentos fallidos. Intenta de nuevo en 15 minutos.')),
});

module.exports = { limitarLogin };
