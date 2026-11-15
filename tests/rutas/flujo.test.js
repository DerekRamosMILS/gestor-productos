// Prueba de extremo a extremo con MongoDB real: registro → login → CRUD → logout.
// Valida que middlewares, controladores y Mongoose funcionen juntos.
const request = require('supertest');
const { crearApp } = require('../../src/app');
const { conectarBD, desconectarBD } = require('../helpers/bd');

const app = crearApp();
const ana = { nombre: 'Ana López', correo: 'ana@correo.com', password: 'Segura123' };

beforeAll(conectarBD);
afterAll(desconectarBD);

test('flujo completo de un usuario', async () => {
  const agente = request.agent(app); // conserva la cookie de sesión como un navegador

  await agente.post('/api/auth/registro').send(ana).expect(201);
  const login = await agente.post('/api/auth/login').send({ correo: ana.correo, password: ana.password }).expect(200);
  expect(login.headers['set-cookie'][0]).toMatch(/token=.*HttpOnly.*SameSite=Strict/i);

  const creado = await agente.post('/api/productos')
    .send({ nombre: 'Teclado mecánico', sku: 'elec-100', precio: 899.999, stock: 12, categoria: 'Electrónica' })
    .expect(201);
  expect(creado.body.producto).toMatchObject({ sku: 'ELEC-100', precio: 900, creadoPor: { nombre: 'Ana López' } });
  const { id } = creado.body.producto;

  const lista = await agente.get('/api/productos?buscar=teclado').expect(200);
  expect(lista.body.paginacion.total).toBe(1);

  const editado = await agente.put(`/api/productos/${id}`).send({ stock: 3 }).expect(200);
  expect(editado.body.producto.stock).toBe(3);

  const resumen = await agente.get('/api/productos/resumen').expect(200);
  expect(resumen.body).toMatchObject({ productos: 1, unidades: 3, valorInventario: 2700, bajoStock: 1 });

  await agente.delete(`/api/productos/${id}`).expect(200);
  await agente.get(`/api/productos/${id}`).expect(404);

  await agente.post('/api/auth/logout').expect(200);
  // El token de esa sesión ya no sirve aunque no haya expirado
  await request(app).get('/api/productos').set('Authorization', `Bearer ${login.body.token}`).expect(401);
});
