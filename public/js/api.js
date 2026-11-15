// Cliente de la API compartido por las páginas. La sesión viaja en una cookie httpOnly,
// así que el token nunca se guarda en localStorage ni lo puede leer JavaScript.
(function iniciarApi() {
  class ErrorDeApi extends Error {
    constructor(estado, cuerpo) {
      super(cuerpo?.error?.mensaje || 'No se pudo completar la solicitud.');
      this.estado = estado;
      this.detalles = cuerpo?.error?.detalles;
    }
  }

  async function pedir(ruta, { metodo = 'GET', cuerpo } = {}) {
    let respuesta;
    try {
      respuesta = await fetch(ruta, {
        method: metodo,
        credentials: 'same-origin',
        headers: cuerpo ? { 'Content-Type': 'application/json' } : {},
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      });
    } catch {
      throw new ErrorDeApi(0, { error: { mensaje: 'No hay conexión con el servidor.' } });
    }
    const datos = await respuesta.json().catch(() => null);
    if (!respuesta.ok) throw new ErrorDeApi(respuesta.status, datos);
    return datos;
  }

  function escaparHTML(texto) {
    return String(texto ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  window.api = { pedir, escaparHTML, ErrorDeApi };
}());
