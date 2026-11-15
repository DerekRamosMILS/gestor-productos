// Utilidades para las pruebas unitarias: req/res/next simulados y consultas de Mongoose encadenables.

/** Objeto res de Express simulado: status() y json() se pueden encadenar como en Express. */
function respuestaSimulada() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.location = jest.fn(() => res);
  res.cookie = jest.fn(() => res);
  res.clearCookie = jest.fn(() => res);
  res.set = jest.fn(() => res);
  return res;
}

/**
 * Simula una consulta de Mongoose (Producto.find(...).sort().skip().limit().populate()).
 * Cada método devuelve la misma consulta y, al usar await, entrega el resultado indicado.
 */
function consultaSimulada(resultado) {
  const consulta = {};
  for (const metodo of ['sort', 'skip', 'limit', 'populate', 'select', 'lean']) consulta[metodo] = jest.fn(() => consulta);
  consulta.then = (resolver, rechazar) => Promise.resolve(resultado).then(resolver, rechazar);
  return consulta;
}

module.exports = { respuestaSimulada, consultaSimulada };
