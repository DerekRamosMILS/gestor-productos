// Colección "productos". Cada producto guarda quién lo creó y quién lo modificó por última vez (referencias a usuarios).
const mongoose = require('mongoose');

const CATEGORIAS = ['Electrónica', 'Hogar', 'Oficina', 'Ropa', 'Alimentos', 'Deportes', 'Otros'];

const productoSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: [true, 'El nombre es obligatorio.'],
      trim: true,
      minlength: [2, 'El nombre debe tener al menos 2 caracteres.'],
      maxlength: [80, 'El nombre debe tener máximo 80 caracteres.'],
    },
    sku: {
      type: String,
      required: [true, 'El SKU es obligatorio.'],
      unique: true,
      uppercase: true,
      trim: true,
      match: [/^[A-Z0-9-]{3,20}$/, 'El SKU solo admite letras, números y guiones (3 a 20 caracteres).'],
    },
    descripcion: { type: String, trim: true, maxlength: [500, 'La descripción debe tener máximo 500 caracteres.'], default: '' },
    precio: {
      type: Number,
      required: [true, 'El precio es obligatorio.'],
      min: [0, 'El precio no puede ser negativo.'],
      max: [9999999, 'El precio es demasiado alto.'],
      set: (valor) => (typeof valor === 'number' ? Math.round(valor * 100) / 100 : valor), // 2 decimales
    },
    stock: {
      type: Number,
      required: [true, 'El stock es obligatorio.'],
      min: [0, 'El stock no puede ser negativo.'],
      validate: { validator: Number.isInteger, message: 'El stock debe ser un número entero.' },
    },
    categoria: {
      type: String,
      required: [true, 'La categoría es obligatoria.'],
      enum: { values: CATEGORIAS, message: `La categoría debe ser una de: ${CATEGORIAS.join(', ')}.` },
    },
    creadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
    actualizadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
  },
  { timestamps: { createdAt: 'creadoEn', updatedAt: 'actualizadoEn' }, versionKey: false },
);

// Índices para los filtros más usados del listado
productoSchema.index({ categoria: 1, nombre: 1 });
productoSchema.index({ creadoPor: 1 });

productoSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret._id;
    return ret;
  },
});

const Producto = mongoose.models.Producto || mongoose.model('Producto', productoSchema, 'productos');

module.exports = Producto;
module.exports.CATEGORIAS = CATEGORIAS;
