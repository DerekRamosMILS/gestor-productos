// Colección "sesiones": una por cada inicio de sesión.
// El token JWT lleva el id de la sesión (jti). Si la sesión ya no existe (cerró sesión o expiró), el token deja de servir.
const mongoose = require('mongoose');

const sesionSchema = new mongoose.Schema(
  {
    usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
    jti: { type: String, required: true, unique: true },
    expiraEn: { type: Date, required: true },
    ip: { type: String, default: '' },
    agente: { type: String, default: '', maxlength: 200 },
  },
  { timestamps: { createdAt: 'creadaEn', updatedAt: false }, versionKey: false },
);

// Índice TTL: MongoDB borra solo cada sesión cuando llega su fecha de expiración
sesionSchema.index({ expiraEn: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.models.Sesion || mongoose.model('Sesion', sesionSchema, 'sesiones');
