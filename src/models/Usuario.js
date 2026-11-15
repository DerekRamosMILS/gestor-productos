// Colección "usuarios". La contraseña se guarda solo como hash de bcrypt y nunca se devuelve en las consultas.
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const config = require('../config/env');

const usuarioSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: [true, 'El nombre es obligatorio.'],
      trim: true,
      minlength: [2, 'El nombre debe tener al menos 2 caracteres.'],
      maxlength: [60, 'El nombre debe tener máximo 60 caracteres.'],
    },
    correo: {
      type: String,
      required: [true, 'El correo es obligatorio.'],
      unique: true, // índice único: dos cuentas no pueden compartir correo
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, 'El correo no tiene un formato válido.'],
    },
    passwordHash: { type: String, required: true, select: false },
    rol: { type: String, enum: ['usuario', 'admin'], default: 'usuario' },
  },
  { timestamps: { createdAt: 'creadoEn', updatedAt: 'actualizadoEn' }, versionKey: false },
);

/** Guarda el hash de una contraseña en texto plano (bcrypt agrega una sal aleatoria). */
usuarioSchema.methods.definirPassword = async function definirPassword(password) {
  this.passwordHash = await bcrypt.hash(password, config.bcryptRondas);
};

usuarioSchema.methods.compararPassword = function compararPassword(password) {
  return bcrypt.compare(password, this.passwordHash);
};

/** Datos seguros para enviar al cliente. */
usuarioSchema.methods.aPublico = function aPublico() {
  return { id: this.id, nombre: this.nombre, correo: this.correo, rol: this.rol, creadoEn: this.creadoEn };
};

module.exports = mongoose.models.Usuario || mongoose.model('Usuario', usuarioSchema, 'usuarios');
