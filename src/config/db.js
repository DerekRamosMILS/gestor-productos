// Conexión a MongoDB con Mongoose.
const mongoose = require('mongoose');

mongoose.set('strictQuery', true); // ignora filtros con campos que no existen en el esquema

async function conectar(uri) {
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000, // si Atlas no responde en 10 s, falla con un mensaje claro
    maxPoolSize: 10,
  });
  const { host, name } = mongoose.connection;
  return { host, nombre: name };
}

async function desconectar() {
  await mongoose.connection.close();
}

/** 1 = conectada. Se usa en GET /api/salud. */
function estado() {
  return ['desconectada', 'conectada', 'conectando', 'desconectando'][mongoose.connection.readyState] ?? 'desconocido';
}

module.exports = { conectar, desconectar, estado };
