// Pruebas de rutas con MongoDB real: autenticación (401), autorización por dueño y por rol (403)
// y respuestas de error de la API (400, 404, 409). Se ejecutan en GitHub Actions contra MongoDB 8.
const request = require('supertest');
const { crearApp } = require('../../src/app');
const Usuario = require('../../src/models/Usuario');
const { conectarBD, desconectarBD } = require('../helpers/bd');

const app = crearApp();
const PASSWORD = 'Segura123';
const producto = { nombre: 'Lámpara de escritorio', sku: 'HOG-900', precio: 350, stock: 8, categoria: 'Hogar' };

/** Inicia sesión y devuelve un agente que conserva la cookie, como un navegador. */
async function sesionDe(correo) {
  const agente = request.agent(app);
  await agente.post('/api/auth/login').send({ correo, password: PASSWORD }).expect(200);
  return agente;
}

let ana; let luis; let admin; let idProducto;

beforeAll(async () => {
  await conectarBD();
  for (const [nombre, correo] of [['Ana López', 'ana@correo.com'], ['Luis Pérez', 'luis@correo.com']]) {
    await request(app).post('/api/auth/registro').send({ nombre, correo, password: PASSWORD }).expect(201);
  }
  // El administrador se crea directo en la base, igual que lo hace server.js al arrancar
  const cuentaAdmin = new Usuario({ nombre: 'Administrador', correo: 'admin@correo.com', rol: 'admin' });
  await cuentaAdmin.definirPassword(PASSWORD);
  await cuentaAdmin.save();

  [ana, luis, admin] = await Promise.all(['ana@correo.com', 'luis@correo.com', 'admin@correo.com'].map(sesionDe));
  const creado = await ana.post('/api/productos').send(producto).expect(201);
  idProducto = creado.body.producto.id;
});
afterAll(desconectarBD);

describe('autenticación', () => {
  test('sin token la API responde 401 con WWW-Authenticate', async () => {
    const res = await request(app).get('/api/productos').expect(401);
    expect(res.headers['www-authenticate']).toBe('Bearer');
    expect(res.body.error.mensaje).toMatch(/inicia sesión|token/i);
  });

  test('un token alterado se rechaza con 401', async () => {
    const { body } = await request(app).post('/api/auth/login').send({ correo: 'ana@correo.com', password: PASSWORD }).expect(200);
    const alterado = `${body.token.slice(0, -2)}xx`;
    await request(app).get('/api/productos').set('Authorization', `Bearer ${alterado}`).expect(401);
  });

  test('la contraseña incorrecta responde 401 con mensaje genérico', async () => {
    const res = await request(app).post('/api/auth/login').send({ correo: 'ana@correo.com', password: 'Otra12345' }).expect(401);
    expect(res.body.error.mensaje).toBe('Correo o contraseña incorrectos.');
  });

  test('el panel /productos redirige al login si no hay sesión', async () => {
    const res = await request(app).get('/productos').expect(302);
    expect(res.headers.location).toBe('/login');
  });

  test('con sesión el panel /productos se entrega sin caché', async () => {
    const res = await ana.get('/productos').expect(200);
    expect(res.headers['cache-control']).toBe('no-store');
  });
});

describe('autorización', () => {
  test('otro usuario puede ver el producto, pero no modificarlo ni eliminarlo (403)', async () => {
    await luis.get(`/api/productos/${idProducto}`).expect(200);
    const editar = await luis.put(`/api/productos/${idProducto}`).send({ precio: 1 }).expect(403);
    expect(editar.body.error.mensaje).toMatch(/Solo quien creó el producto/);
    await luis.delete(`/api/productos/${idProducto}`).expect(403);
  });

  test('un administrador sí puede modificar productos de otros usuarios', async () => {
    const res = await admin.put(`/api/productos/${idProducto}`).send({ stock: 20 }).expect(200);
    expect(res.body.producto).toMatchObject({ stock: 20, actualizadoPor: { nombre: 'Administrador' } });
  });

  test('/api/usuarios es solo para administradores', async () => {
    await ana.get('/api/usuarios').expect(403);
    const res = await admin.get('/api/usuarios').expect(200);
    expect(res.body.total).toBe(3);
    expect(res.body.datos.find((u) => u.correo === 'ana@correo.com').productos).toBe(1);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/);
  });

  test('el filtro mios=true solo devuelve lo que creó el usuario', async () => {
    const deLuis = await luis.get('/api/productos?mios=true').expect(200);
    const deAna = await ana.get('/api/productos?mios=true').expect(200);
    expect(deLuis.body.paginacion.total).toBe(0);
    expect(deAna.body.paginacion.total).toBe(1);
  });
});

describe('errores de la API', () => {
  test('id con formato inválido → 400', async () => {
    await ana.get('/api/productos/no-es-un-id').expect(400);
  });

  test('id válido que no existe → 404', async () => {
    await ana.get('/api/productos/64b7f0c2a1b2c3d4e5f60718').expect(404);
  });

  test('campos no permitidos (como creadoPor) → 400', async () => {
    const res = await luis.post('/api/productos').send({ ...producto, sku: 'HOG-901', creadoPor: 'otro' }).expect(400);
    expect(res.body.error.detalles.campos).toMatch(/creadoPor/);
  });

  test('valores inválidos → 400 con detalle por campo', async () => {
    const res = await luis.post('/api/productos').send({ nombre: 'X', sku: 'a b', precio: -1, stock: 1.5, categoria: 'Juguetes' }).expect(400);
    expect(Object.keys(res.body.error.detalles)).toEqual(expect.arrayContaining(['nombre', 'sku', 'precio', 'stock', 'categoria']));
  });

  test('SKU repetido → 409', async () => {
    const res = await luis.post('/api/productos').send({ ...producto, sku: 'hog-900' }).expect(409);
    expect(res.body.error.mensaje).toBe('Ya existe un producto con el SKU HOG-900.');
  });

  test('correo ya registrado → 409', async () => {
    await request(app).post('/api/auth/registro').send({ nombre: 'Ana Dos', correo: 'ANA@correo.com', password: PASSWORD }).expect(409);
  });
});
