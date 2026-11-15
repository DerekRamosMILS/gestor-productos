// Registro de cada solicitud de la API en la consola: hora, método, ruta, código, tiempo y usuario.
const config = require('../config/env');

const color = (texto, codigo) => (process.stdout.isTTY ? `\x1b[${codigo}m${texto}\x1b[0m` : texto);

function bitacora(req, res, next) {
  if (config.esPrueba) return next(); // en las pruebas automáticas no se imprime nada
  const inicio = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - inicio) / 1e6;
    const estado = res.statusCode;
    const tono = estado >= 500 ? 31 : estado >= 400 ? 33 : 32;
    const hora = new Date().toLocaleTimeString('es-MX', { hour12: false, timeZone: 'America/Mexico_City' });
    const quien = req.usuario ? color(` · ${req.usuario.correo}`, 90) : '';
    console.log(`${color(hora, 90)} ${req.method.padEnd(6)} ${req.originalUrl} → ${color(estado, tono)} ${color(`(${ms.toFixed(1)} ms)`, 90)}${quien}`);
  });
  return next();
}

module.exports = bitacora;
