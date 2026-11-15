// Error con código HTTP. Se lanza en controladores y middlewares; el manejador central lo convierte en JSON.
class ErrorApi extends Error {
  constructor(estado, mensaje, detalles) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.estado = estado;
    this.detalles = detalles;
  }

  static solicitudInvalida(mensaje, detalles) { return new ErrorApi(400, mensaje, detalles); }

  static noAutenticado(mensaje = 'Necesitas iniciar sesión.') { return new ErrorApi(401, mensaje); }

  static prohibido(mensaje = 'No tienes permiso para esta acción.') { return new ErrorApi(403, mensaje); }

  static noEncontrado(mensaje = 'No se encontró el recurso.') { return new ErrorApi(404, mensaje); }

  static conflicto(mensaje) { return new ErrorApi(409, mensaje); }
}

module.exports = ErrorApi;
