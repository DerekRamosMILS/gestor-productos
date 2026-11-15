// tests/unit/productos.controller.test.js
jest.mock('../../../src/models/Producto', () => ({
  find: jest.fn(),
  countDocuments: jest.fn(),
  create: jest.fn(),
  aggregate: jest.fn(),
  CATEGORIAS: ['Electrónica', 'Hogar', 'Oficina', 'Ropa', 'Alimentos', 'Deportes', 'Otros'],
}));

const Producto = require('../../../src/models/Producto');
const {
  listar,
  obtener,
  crear,
  actualizar,
  eliminar,
  resumen,
  categorias,
} = require('../../../src/controllers/productos.controller');

function respuestaSimulada() {
  const res = {};
  res.status = jest.fn(() => res);
  res.location = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

function consultaSimulada(resultado) {
  const consulta = {};

  for (const metodo of ['sort', 'skip', 'limit', 'populate']) {
    consulta[metodo] = jest.fn(() => consulta);
  }

  consulta.then = jest.fn((resolver, rechazar) => Promise.resolve(resultado).then(resolver, rechazar));

  return consulta;
}

describe('controlador de productos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listar', () => {
    test('aplica filtros, búsqueda y paginación', async () => {
      const productos = [{ _id: 'p1', nombre: 'Laptop' }];
      const consulta = consultaSimulada(productos);

      Producto.find.mockReturnValue(consulta);
      Producto.countDocuments.mockResolvedValue(7);

      const req = {
        consulta: {
          pagina: 2,
          limite: 3,
          orden: { precio: -1 },
          buscar: 'lap.top',
          categoria: 'Electrónica',
          minPrecio: 100,
          maxPrecio: 2000,
          soloDe: 'usuario-1',
        },
      };
      const res = respuestaSimulada();

      await listar(req, res);

      expect(Producto.find).toHaveBeenCalledTimes(1);

      const filtro = Producto.find.mock.calls[0][0];

      expect(filtro.categoria).toBe('Electrónica');
      expect(filtro.creadoPor).toBe('usuario-1');
      expect(filtro.precio).toEqual({ $gte: 100, $lte: 2000 });
      expect(filtro.$or).toHaveLength(3);
      expect(filtro.$or.map((condicion) => Object.values(condicion)[0])).toEqual([
        expect.any(RegExp),
        expect.any(RegExp),
        expect.any(RegExp),
      ]);

      const patron = filtro.$or[0].nombre;
      expect(patron).toEqual(/lap\.top/i);

      expect(consulta.sort).toHaveBeenCalledWith({ precio: -1, _id: 1 });
      expect(consulta.skip).toHaveBeenCalledWith(3);
      expect(consulta.limit).toHaveBeenCalledWith(3);
      expect(consulta.populate).toHaveBeenCalledWith('creadoPor', 'nombre');

      expect(Producto.countDocuments).toHaveBeenCalledWith(filtro);
      expect(res.json).toHaveBeenCalledWith({
        datos: productos,
        paginacion: {
          pagina: 2,
          limite: 3,
          total: 7,
          paginas: 3,
        },
      });
    });

    test('calcula al menos una página cuando no existen resultados', async () => {
      const consulta = consultaSimulada([]);

      Producto.find.mockReturnValue(consulta);
      Producto.countDocuments.mockResolvedValue(0);

      const req = {
        consulta: {
          pagina: 1,
          limite: 10,
          orden: {},
        },
      };
      const res = respuestaSimulada();

      await listar(req, res);

      expect(Producto.find).toHaveBeenCalledWith({});
      expect(Producto.countDocuments).toHaveBeenCalledWith({});
      expect(res.json).toHaveBeenCalledWith({
        datos: [],
        paginacion: {
          pagina: 1,
          limite: 10,
          total: 0,
          paginas: 1,
        },
      });
    });
  });

  describe('obtener', () => {
    test('responde con el producto cargado en req.producto', () => {
      const producto = { _id: 'p1', nombre: 'Teclado' };
      const req = { producto };
      const res = respuestaSimulada();

      obtener(req, res);

      expect(res.json).toHaveBeenCalledWith(producto);
    });
  });

  describe('crear', () => {
    test('crea el producto, responde 201 y establece Location', async () => {
      const producto = {
        id: 'producto-123',
        nombre: 'Monitor',
        populate: jest.fn().mockResolvedValue(undefined),
      };

      Producto.create.mockResolvedValue(producto);

      const req = {
        body: {
          nombre: 'Monitor',
          sku: 'MON-001',
          precio: 250,
          stock: 5,
          categoria: 'Oficina',
        },
        usuario: {
          _id: 'usuario-123',
        },
      };
      const res = respuestaSimulada();

      await crear(req, res);

      expect(Producto.create).toHaveBeenCalledWith({
        ...req.body,
        creadoPor: 'usuario-123',
      });
      expect(producto.populate).toHaveBeenCalledWith('creadoPor', 'nombre correo');
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.location).toHaveBeenCalledWith('/api/productos/producto-123');
      expect(res.json).toHaveBeenCalledWith({
        mensaje: 'Producto creado.',
        producto,
      });
    });
  });

  describe('actualizar', () => {
    test('actualiza los campos enviados y responde con el producto', async () => {
      const producto = {
        sku: 'MON-001',
        set: jest.fn(),
        save: jest.fn().mockResolvedValue(undefined),
        populate: jest.fn().mockResolvedValue(undefined),
      };

      const req = {
        producto,
        body: {
          precio: 300,
          stock: 8,
        },
        usuario: {
          _id: 'usuario-456',
        },
      };
      const res = respuestaSimulada();

      await actualizar(req, res);

      expect(producto.set).toHaveBeenCalledWith(req.body);
      expect(producto.actualizadoPor).toBe('usuario-456');
      expect(producto.save).toHaveBeenCalledTimes(1);
      expect(producto.populate).toHaveBeenCalledWith('actualizadoPor', 'nombre');
      expect(res.json).toHaveBeenCalledWith({
        mensaje: 'Producto actualizado.',
        producto,
      });
    });
  });

  describe('eliminar', () => {
    test('elimina el producto y responde con el mensaje correspondiente', async () => {
      const producto = {
        sku: 'MON-001',
        deleteOne: jest.fn().mockResolvedValue(undefined),
      };
      const req = { producto };
      const res = respuestaSimulada();

      await eliminar(req, res);

      expect(producto.deleteOne).toHaveBeenCalledTimes(1);
      expect(res.json).toHaveBeenCalledWith({
        mensaje: 'Producto MON-001 eliminado.',
        producto,
      });
    });
  });

  describe('resumen', () => {
    test('responde el resumen general y el desglose por categoría', async () => {
      const general = {
        productos: 12,
        unidades: 37,
        valorInventario: 1234.567,
        bajoStock: 4,
      };
      const porCategoria = [
        { categoria: 'Oficina', productos: 7, unidades: 20 },
        { categoria: 'Hogar', productos: 5, unidades: 17 },
      ];

      Producto.aggregate
        .mockResolvedValueOnce([general])
        .mockResolvedValueOnce(porCategoria);

      const res = respuestaSimulada();

      await resumen({}, res);

      expect(Producto.aggregate).toHaveBeenCalledTimes(2);
      expect(Producto.aggregate.mock.calls[0][0]).toEqual([
        {
          $group: {
            _id: null,
            productos: { $sum: 1 },
            unidades: { $sum: '$stock' },
            valorInventario: {
              $sum: { $multiply: ['$precio', '$stock'] },
            },
            bajoStock: {
              $sum: {
                $cond: [{ $lte: ['$stock', 5] }, 1, 0],
              },
            },
          },
        },
      ]);
      expect(res.json).toHaveBeenCalledWith({
        productos: 12,
        unidades: 37,
        valorInventario: 1234.57,
        bajoStock: 4,
        porCategoria,
      });
    });

    test('usa valores predeterminados cuando no existen datos generales', async () => {
      Producto.aggregate
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const res = respuestaSimulada();

      await resumen({}, res);

      expect(res.json).toHaveBeenCalledWith({
        productos: 0,
        unidades: 0,
        valorInventario: 0,
        bajoStock: 0,
        porCategoria: [],
      });
    });
  });

  describe('categorias', () => {
    test('responde las categorías definidas por el modelo', () => {
      const res = respuestaSimulada();

      categorias({}, res);

      expect(res.json).toHaveBeenCalledWith(Producto.CATEGORIAS);
    });
  });
});
