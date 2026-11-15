// Base de datos para las pruebas de rutas.
// En GitHub Actions se usa el servicio de MongoDB del pipeline (MONGODB_URI_TEST);
// en una computadora sin esa variable se levanta un MongoDB en memoria con mongodb-memory-server.
const os = require('os');
const mongoose = require('mongoose');

let servidorMemoria = null;

async function conectarBD() {
  let uri = process.env.MONGODB_URI_TEST;
  if (!uri) {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    servidorMemoria = await MongoMemoryServer.create();
    uri = servidorMemoria.getUri();
  }
  // Cada archivo de pruebas usa su propia base para no interferir con los demás.
  // runtimeAdapters: el driver 7.8 carga 'os' con import() dinámico, que falla dentro de la VM de Jest;
  // sin esto el saludo inicial viaja sin metadatos del cliente y MongoDB 8 rechaza la conexión
  // ("Missing required sub-document 'driver'"). En producción (node normal) no hace falta.
  await mongoose.connect(uri, {
    dbName: `pruebas_${process.env.JEST_WORKER_ID}_${Date.now()}`,
    serverSelectionTimeoutMS: 10000,
    runtimeAdapters: { os },
  });
  await Promise.all(Object.values(mongoose.models).map((modelo) => modelo.syncIndexes()));
}

async function limpiarBD() {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
}

async function desconectarBD() {
  if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  if (servidorMemoria) await servidorMemoria.stop();
}

module.exports = { conectarBD, limpiarBD, desconectarBD };
