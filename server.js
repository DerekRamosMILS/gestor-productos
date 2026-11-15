// Punto de entrada: conecta con MongoDB, prepara el usuario administrador y abre el puerto.
const config = require('./src/config/env');
const db = require('./src/config/db');
const Usuario = require('./src/models/Usuario');
const { crearApp } = require('./src/app');

/** Crea el administrador inicial si se definieron ADMIN_CORREO y ADMIN_PASSWORD y todavía no existe. */
async function asegurarAdmin() {
  const { nombre, correo, password } = config.admin;
  if (!correo || !password) return null;
  const existente = await Usuario.findOne({ correo: correo.toLowerCase() });
  if (existente) return existente.rol === 'admin' ? 'ya existía' : 'el correo ya existe con rol usuario';
  const admin = new Usuario({ nombre, correo, rol: 'admin' });
  await admin.definirPassword(password);
  await admin.save();
  return 'creado';
}

/** Carga productos de ejemplo una sola vez (colección vacía) cuando SEMBRAR_DATOS=true. */
async function sembrarProductos() {
  if (process.env.SEMBRAR_DATOS !== 'true') return 0;
  const Producto = require('./src/models/Producto');
  if (await Producto.estimatedDocumentCount() > 0) return 0;
  const admin = await Usuario.findOne({ rol: 'admin' });
  if (!admin) return 0;
  const productos = require('./src/datos/productos-demo').map((p) => ({ ...p, creadoPor: admin._id }));
  await Producto.insertMany(productos);
  return productos.length;
}

async function iniciar() {
  const { host, nombre } = await db.conectar(config.mongoUri);
  console.log(`✔ Conectado a MongoDB: ${host} / ${nombre}`);
  await Promise.all([Usuario.syncIndexes(), require('./src/models/Producto').syncIndexes(), require('./src/models/Sesion').syncIndexes()]);
  const admin = await asegurarAdmin();
  if (admin) console.log(`✔ Usuario administrador: ${admin}`);
  const sembrados = await sembrarProductos();
  if (sembrados) console.log(`✔ ${sembrados} productos de ejemplo cargados`);

  const servidor = crearApp().listen(config.puerto, () => {
    console.log(`✔ Gestor de productos en http://localhost:${config.puerto}  [${config.entorno}]`);
  });

  const cerrar = async () => {
    console.log('\nDeteniendo el servidor…');
    servidor.close();
    await db.desconectar();
    process.exit(0);
  };
  process.on('SIGINT', cerrar);
  process.on('SIGTERM', cerrar); // Render envía SIGTERM al desplegar una versión nueva
}

iniciar().catch((error) => {
  console.error(`✖ No se pudo iniciar: ${error.message}`);
  if (/querySrv|ENOTFOUND|ECONNREFUSED|Server selection timed out/i.test(error.message)) {
    console.error('  Revisa MONGODB_URI en .env y que tu IP tenga acceso en MongoDB Atlas (Network Access).');
  }
  if (/bad auth|Authentication failed/i.test(error.message)) {
    console.error('  El usuario o la contraseña de la base de datos en MONGODB_URI no son correctos.');
  }
  process.exit(1);
});
