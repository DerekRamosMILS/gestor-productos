// Variables de entorno validadas en un solo lugar.
// En local se cargan desde .env (node --env-file-if-exists=.env); en Render se configuran en el panel.
const crypto = require('node:crypto');

const entorno = process.env.NODE_ENV || 'development';
const esProduccion = entorno === 'production';
const esPrueba = entorno === 'test';

function requerida(nombre) {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta la variable de entorno ${nombre}. Revisa tu archivo .env (usa .env.example como guía).`);
  return valor;
}

let secretoJwt = process.env.JWT_SECRET;
if (!secretoJwt || secretoJwt.length < 32) {
  if (esProduccion) throw new Error('JWT_SECRET debe tener al menos 32 caracteres en producción.');
  // En desarrollo y pruebas no se detiene el servidor: se usa un secreto temporal
  secretoJwt = crypto.randomBytes(48).toString('hex');
  if (!esPrueba) console.warn('⚠ JWT_SECRET no está definido: se usará uno temporal y las sesiones se perderán al reiniciar.');
}

const config = Object.freeze({
  entorno,
  esProduccion,
  esPrueba,
  puerto: Number(process.env.PORT) || 3000,
  // En pruebas la conexión la abre el propio test, por eso aquí no es obligatoria
  mongoUri: esPrueba ? process.env.MONGODB_URI : requerida('MONGODB_URI'),
  jwt: Object.freeze({
    secreto: secretoJwt,
    expiraEn: process.env.JWT_EXPIRES_IN || '2h',
    emisor: 'gestor-productos',
  }),
  bcryptRondas: esPrueba ? 4 : 10,
  admin: Object.freeze({
    nombre: process.env.ADMIN_NOMBRE || 'Administrador',
    correo: process.env.ADMIN_CORREO,
    password: process.env.ADMIN_PASSWORD,
  }),
  // Render expone el commit desplegado; el pipeline lo usa para confirmar que la versión nueva ya está en línea
  version: process.env.RENDER_GIT_COMMIT || process.env.GITHUB_SHA || 'local',
});

module.exports = config;
