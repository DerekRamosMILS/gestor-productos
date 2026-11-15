// Pruebas unitarias del controlador de productos (el modelo Producto está simulado: no se usa base de datos).
// Versión inicial generada con GitHub Copilot (docs/copilot/productos.controller.test.copilot.js)
// y ajustada a mano; cada cambio está marcado con "AJUSTE" y explicado en docs/pruebas-ia.md.
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
  construirFiltro,
} = require('../../../src/controllers/productos.controller');
// AJUSTE 1: Copilot redefinía respuestaSimulada() y consultaSimulada() dentro del archivo;
// se usan las del proyecto para no duplicar código. Además se quitó el beforeEach(jest.clearAllMocks)
// porque jest.config.js ya tiene clearMocks: true.
const { respuestaSimulada, consultaSimulada } = require('../../helpers/simulaciones');

describe('controlador de productos', () => {
  // AJUSTE 2: construirFiltro está exportada y Copilot no la probó por separado.
  describe('construirFiltro', () => {
    test('sin parámetros devuelve un filtro vacío (lista todo)', () => {
      expect(construirFiltro()).toEqual({});
    });

    test('con un solo límite de precio no agrega el otro', () => {
      expect(construirFiltro({ minPrecio: 50 })).toEqual({ precio: { $gte: 50 } });
      expect(construirFiltro({ maxPrecio: 80 })).toEqual({ precio: { $lte: 80 } });
    });

    test('con precio 0 sí aplica el filtro (0 no se confunde con "sin valor")', () => {
      expect(construirFiltro({ minPrecio: 0, maxPrecio: 0 })).toEqual({ precio: { $gte: 0, $lte: 0 } });
    });

    // AJUSTE 3: Copilot solo comprobaba que "." se escapara. Se agregó un caso con varios caracteres
    // especiales para demostrar que el texto del usuario no se interpreta como expresión regular
    // (evita búsquedas inesperadas y expresiones costosas).
    test('escapa todos los caracteres especiales de la búsqueda', () => {
      const { $or } = construirFiltro({ buscar: '(a+)*$[x]' });
      const patron = $or[0].nombre;
      expect(patron.source).toBe('\\(a\\+\\)\\*\\$\\[x\\]');
      expect(patron.test('producto (a+)*$[x] raro')).toBe(true);
      expect(patron.test('aaaa')).toBe(false);
    });
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
      // AJUSTE 4: Copilot solo verificaba que hubiera tres RegExp; ahora se comprueba en qué campos se busca.
      expect(filtro.$or.map((condicion) => Object.keys(condicion)[0])).toEqual(['nombre', 'sku', 'descripcion']);

      const patron = filtro.$or[0].nombre;
      expect(patron).toEqual(/lap\.top/i);
      expect(patron.test('LAP.TOP gamer')).toBe(true); // no distingue mayúsculas
      expect(patron.test('laptop')).toBe(false); // el punto es literal

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

    // AJUSTE 5: Copilot no probó qué pasa si MongoDB falla. En Express 5 el error de una función async
    // llega solo al manejador central; el controlador no debe responder nada por su cuenta.
    test('si MongoDB falla, el error se propaga y no se envía respuesta', async () => {
      Producto.find.mockReturnValue(consultaSimulada([]));
      Producto.countDocuments.mockRejectedValue(new Error('conexión perdida'));
      const res = respuestaSimulada();

      await expect(listar({ consulta: { pagina: 1, limite: 10, orden: {} } }, res)).rejects.toThrow('conexión perdida');
      expect(res.json).not.toHaveBeenCalled();
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

    // AJUSTE 6: el dueño siempre es el usuario de la sesión, aunque el cuerpo intente mandar otro creadoPor.
    // (En la app real el middleware soloCampos ya rechaza ese campo; esto es una segunda defensa.)
    test('creadoPor sale de la sesión y no del cuerpo de la petición', async () => {
      Producto.create.mockResolvedValue({ id: 'p9', populate: jest.fn() });
      const req = { body: { nombre: 'Silla', creadoPor: 'otro-usuario' }, usuario: { _id: 'usuario-123' } };

      await crear(req, respuestaSimulada());

      expect(Producto.create.mock.calls[0][0].creadoPor).toBe('usuario-123');
    });

    // AJUSTE 7: SKU repetido. El controlador deja pasar el error 11000 al manejador central (que responde 409).
    test('un SKU duplicado se propaga como error y no responde 201', async () => {
      Producto.create.mockRejectedValue(Object.assign(new Error('E11000 duplicate key'), { code: 11000, keyValue: { sku: 'MON-001' } }));
      const res = respuestaSimulada();

      await expect(crear({ body: { sku: 'MON-001' }, usuario: { _id: 'u1' } }, res)).rejects.toMatchObject({ code: 11000 });
      expect(res.status).not.toHaveBeenCalled();
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
      // AJUSTE 8: el orden importa: primero se aplican los cambios y después se guarda (save valida el esquema).
      expect(producto.set.mock.invocationCallOrder[0]).toBeLessThan(producto.save.mock.invocationCallOrder[0]);
      expect(producto.populate).toHaveBeenCalledWith('actualizadoPor', 'nombre');
      expect(res.json).toHaveBeenCalledWith({
        mensaje: 'Producto actualizado.',
        producto,
      });
    });

    // AJUSTE 9: si la validación de Mongoose falla (por ejemplo, precio negativo) no se responde 200.
    test('si save() rechaza por validación, no responde y propaga el error', async () => {
      const errorValidacion = Object.assign(new Error('Validation failed'), { name: 'ValidationError' });
      const producto = { set: jest.fn(), save: jest.fn().mockRejectedValue(errorValidacion), populate: jest.fn() };
      const res = respuestaSimulada();

      await expect(actualizar({ producto, body: { precio: -5 }, usuario: { _id: 'u1' } }, res)).rejects.toBe(errorValidacion);
      expect(producto.populate).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
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
