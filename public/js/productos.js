// Panel de productos: protege la página, carga el resumen y la tabla, y hace el CRUD con diálogos.
(function panelProductos() {
  const { pedir, escaparHTML } = window.api;
  const $ = (selector) => document.querySelector(selector);
  const moneda = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
  const entero = new Intl.NumberFormat('es-MX');

  const estado = { usuario: null, pagina: 1, paginas: 1, productos: [], editando: null, eliminando: null };

  // ---------- Utilidades ----------
  function aviso(texto, tipo = 'ok') {
    const el = document.createElement('div');
    el.className = `aviso ${tipo === 'error' ? 'error' : ''}`;
    el.textContent = texto;
    $('#avisos').append(el);
    setTimeout(() => el.remove(), 3800);
  }

  function manejarError(error) {
    if (error.estado === 401) { window.location.replace('/login'); return; }
    aviso(error.message, 'error');
  }

  function puedeEditar(producto) {
    return estado.usuario.rol === 'admin' || producto.creadoPor?.id === estado.usuario.id;
  }

  const icono = {
    editar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    borrar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>',
  };

  // ---------- Carga de datos ----------
  async function cargarResumen() {
    const r = await pedir('/api/productos/resumen');
    $('#kpi-productos').textContent = entero.format(r.productos);
    $('#kpi-unidades').textContent = entero.format(r.unidades);
    $('#kpi-valor').textContent = moneda.format(r.valorInventario);
    $('#kpi-bajo').textContent = entero.format(r.bajoStock);
  }

  function parametros() {
    const p = new URLSearchParams({ pagina: estado.pagina, limite: 8, orden: $('#orden').value });
    if ($('#buscar').value.trim()) p.set('buscar', $('#buscar').value.trim());
    if ($('#categoria').value) p.set('categoria', $('#categoria').value);
    if ($('#mios').checked) p.set('mios', 'true');
    return p;
  }

  async function cargarProductos() {
    const { datos, paginacion } = await pedir(`/api/productos?${parametros()}`);
    estado.productos = datos;
    estado.paginas = paginacion.paginas;
    $('#filas').innerHTML = datos.map((p) => {
      const permitido = puedeEditar(p);
      const titulo = permitido ? '' : ' title="Solo quien lo registró o un administrador"';
      return `<tr data-id="${p.id}">
        <td><span class="sku">${escaparHTML(p.sku)}</span></td>
        <td><div class="producto-nombre">${escaparHTML(p.nombre)}</div><div class="producto-desc">${escaparHTML(p.descripcion || '—')}</div></td>
        <td class="col-opcional"><span class="pastilla">${escaparHTML(p.categoria)}</span></td>
        <td class="num">${moneda.format(p.precio)}</td>
        <td class="num ${p.stock <= 5 ? 'stock-bajo' : ''}">${entero.format(p.stock)}</td>
        <td class="col-opcional">${escaparHTML(p.creadoPor?.nombre ?? '—')}</td>
        <td class="num"><div class="acciones">
          <button class="boton boton-fantasma" type="button" data-accion="editar" aria-label="Editar ${escaparHTML(p.nombre)}" aria-disabled="${!permitido}"${titulo}>${icono.editar}</button>
          <button class="boton boton-fantasma" type="button" data-accion="eliminar" aria-label="Eliminar ${escaparHTML(p.nombre)}" aria-disabled="${!permitido}"${titulo}>${icono.borrar}</button>
        </div></td>
      </tr>`;
    }).join('');
    $('#vacio').hidden = datos.length > 0;
    const desde = paginacion.total ? (paginacion.pagina - 1) * paginacion.limite + 1 : 0;
    const hasta = Math.min(paginacion.pagina * paginacion.limite, paginacion.total);
    $('#info-paginacion').textContent = `${desde}–${hasta} de ${paginacion.total} productos`;
    $('#anterior').disabled = paginacion.pagina <= 1;
    $('#siguiente').disabled = paginacion.pagina >= paginacion.paginas;
  }

  async function recargar() {
    try { await Promise.all([cargarResumen(), cargarProductos()]); } catch (error) { manejarError(error); }
  }

  // ---------- Formulario ----------
  function limpiarErroresFormulario() {
    const form = $('#form-producto');
    form.querySelectorAll('.campo').forEach((c) => c.classList.remove('invalido'));
    form.querySelectorAll('.error-campo').forEach((e) => e.remove());
    $('#mensaje-producto').hidden = true;
  }

  function marcarErrores(detalles = {}) {
    for (const [campo, texto] of Object.entries(detalles)) {
      const input = $(`#form-producto [name="${campo}"]`);
      if (!input) continue;
      input.closest('.campo').classList.add('invalido');
      const span = document.createElement('span');
      span.className = 'error-campo';
      span.textContent = texto;
      input.closest('.campo').append(span);
    }
  }

  function abrirFormulario(producto = null) {
    const form = $('#form-producto');
    form.reset();
    limpiarErroresFormulario();
    estado.editando = producto;
    $('#titulo-dialogo').textContent = producto ? 'Editar producto' : 'Nuevo producto';
    if (producto) {
      for (const campo of ['nombre', 'sku', 'categoria', 'precio', 'stock', 'descripcion']) form[campo].value = producto[campo] ?? '';
    }
    $('#dialogo-producto').showModal();
    form.nombre.focus();
  }

  function leerFormulario() {
    const form = $('#form-producto');
    const datos = {
      nombre: form.nombre.value.trim(),
      sku: form.sku.value.trim().toUpperCase(),
      categoria: form.categoria.value,
      precio: form.precio.value === '' ? null : Number(form.precio.value),
      stock: form.stock.value === '' ? null : Number(form.stock.value),
      descripcion: form.descripcion.value.trim(),
    };
    const errores = {};
    if (datos.nombre.length < 2) errores.nombre = 'Escribe un nombre de al menos 2 caracteres.';
    if (!/^[A-Z0-9-]{3,20}$/.test(datos.sku)) errores.sku = 'De 3 a 20 letras, números o guiones.';
    if (!datos.categoria) errores.categoria = 'Elige una categoría.';
    if (datos.precio === null || datos.precio < 0) errores.precio = 'Escribe un precio de 0 o más.';
    if (datos.stock === null || datos.stock < 0 || !Number.isInteger(datos.stock)) errores.stock = 'Escribe un entero de 0 o más.';
    return { datos, errores };
  }

  async function guardar(e) {
    e.preventDefault();
    limpiarErroresFormulario();
    const { datos, errores } = leerFormulario();
    if (Object.keys(errores).length) { marcarErrores(errores); return; }
    const boton = $('#guardar-producto');
    boton.disabled = true;
    try {
      if (estado.editando) {
        await pedir(`/api/productos/${estado.editando.id}`, { metodo: 'PUT', cuerpo: datos });
        aviso('Producto actualizado.');
      } else {
        await pedir('/api/productos', { metodo: 'POST', cuerpo: datos });
        aviso('Producto creado.');
      }
      $('#dialogo-producto').close();
      await recargar();
    } catch (error) {
      if (error.estado === 401) { manejarError(error); return; }
      $('#mensaje-producto').textContent = error.message;
      $('#mensaje-producto').hidden = false;
      marcarErrores(error.detalles);
    } finally {
      boton.disabled = false;
    }
  }

  // ---------- Eventos ----------
  $('#btn-nuevo').addEventListener('click', () => abrirFormulario());
  $('#cancelar-producto').addEventListener('click', () => $('#dialogo-producto').close());
  $('#form-producto').addEventListener('submit', guardar);

  $('#filas').addEventListener('click', (e) => {
    const boton = e.target.closest('[data-accion]');
    if (!boton) return;
    const producto = estado.productos.find((p) => p.id === boton.closest('tr').dataset.id);
    if (boton.getAttribute('aria-disabled') === 'true') {
      aviso('Solo quien registró el producto o un administrador puede modificarlo.', 'error');
      return;
    }
    if (boton.dataset.accion === 'editar') abrirFormulario(producto);
    if (boton.dataset.accion === 'eliminar') {
      estado.eliminando = producto;
      $('#texto-eliminar').textContent = `Se eliminará «${producto.nombre}» (${producto.sku}). Esta acción no se puede deshacer.`;
      $('#dialogo-eliminar').showModal();
    }
  });
  $('#cancelar-eliminar').addEventListener('click', () => $('#dialogo-eliminar').close());
  $('#confirmar-eliminar').addEventListener('click', async () => {
    try {
      await pedir(`/api/productos/${estado.eliminando.id}`, { metodo: 'DELETE' });
      $('#dialogo-eliminar').close();
      aviso('Producto eliminado.');
      if (estado.productos.length === 1 && estado.pagina > 1) estado.pagina -= 1;
      await recargar();
    } catch (error) {
      $('#dialogo-eliminar').close();
      manejarError(error);
    }
  });

  let espera;
  $('#buscar').addEventListener('input', () => {
    clearTimeout(espera);
    espera = setTimeout(() => { estado.pagina = 1; cargarProductos().catch(manejarError); }, 300);
  });
  for (const id of ['#categoria', '#orden', '#mios']) {
    $(id).addEventListener('change', () => { estado.pagina = 1; cargarProductos().catch(manejarError); });
  }
  $('#filtros').addEventListener('submit', (e) => e.preventDefault());
  $('#anterior').addEventListener('click', () => { estado.pagina -= 1; cargarProductos().catch(manejarError); });
  $('#siguiente').addEventListener('click', () => { estado.pagina += 1; cargarProductos().catch(manejarError); });

  $('#btn-salir').addEventListener('click', async () => {
    try { await pedir('/api/auth/logout', { metodo: 'POST' }); } catch { /* la sesión ya no existía */ }
    window.location.replace('/login');
  });

  // ---------- Inicio: la página solo se muestra con una sesión válida ----------
  (async function iniciar() {
    try {
      const { usuario } = await pedir('/api/auth/perfil');
      estado.usuario = usuario;
      $('#avatar').textContent = usuario.nombre.trim().charAt(0).toUpperCase();
      $('#nombre-usuario').textContent = usuario.nombre;
      $('#rol-usuario').textContent = usuario.rol;
      $('#rol-usuario').classList.toggle('rol-admin', usuario.rol === 'admin');
      $('#usuario-chip').hidden = false;
      const categorias = await pedir('/api/productos/categorias');
      const opciones = categorias.map((c) => `<option value="${escaparHTML(c)}">${escaparHTML(c)}</option>`).join('');
      $('#categoria').insertAdjacentHTML('beforeend', opciones);
      $('#p-categoria').innerHTML = `<option value="">Elige una categoría</option>${opciones}`;
      await recargar();
    } catch (error) {
      manejarError(error);
    }
  }());
}());
