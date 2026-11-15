// Página de acceso: pestañas, inicio de sesión, registro y validación en el navegador.
(function paginaLogin() {
  const { pedir } = window.api;
  const $ = (selector) => document.querySelector(selector);
  const mensaje = $('#mensaje');

  // Si ya hay una sesión válida, ir directo al panel
  pedir('/api/auth/perfil').then(() => window.location.replace('/productos')).catch(() => {});

  function mostrarMensaje(texto, tipo = 'error') {
    mensaje.textContent = texto;
    mensaje.className = `alerta alerta-${tipo}`;
    mensaje.hidden = !texto;
  }

  function limpiarErrores(form) {
    form.querySelectorAll('.campo').forEach((campo) => campo.classList.remove('invalido'));
    form.querySelectorAll('.error-campo').forEach((e) => e.remove());
  }

  function marcarErrores(form, detalles = {}) {
    for (const [nombre, texto] of Object.entries(detalles)) {
      const input = form.querySelector(`[name="${nombre}"]`);
      if (!input) continue;
      const campo = input.closest('.campo');
      campo.classList.add('invalido');
      const error = document.createElement('span');
      error.className = 'error-campo';
      error.textContent = texto;
      campo.append(error);
    }
  }

  function cambiarPestana(cual) {
    const esLogin = cual === 'login';
    $('#tab-login').setAttribute('aria-selected', String(esLogin));
    $('#tab-registro').setAttribute('aria-selected', String(!esLogin));
    $('#form-login').hidden = !esLogin;
    $('#form-registro').hidden = esLogin;
    $('#titulo').textContent = esLogin ? 'Bienvenido de nuevo' : 'Crea tu cuenta';
    $('#subtitulo').textContent = esLogin ? 'Inicia sesión para administrar tus productos.' : 'Regístrate para empezar a registrar productos.';
    mostrarMensaje('');
    (esLogin ? $('#login-correo') : $('#reg-nombre')).focus();
  }

  async function entrar(correo, password) {
    await pedir('/api/auth/login', { metodo: 'POST', cuerpo: { correo, password } });
    window.location.replace('/productos');
  }

  async function conCarga(boton, texto, tarea) {
    const original = boton.textContent;
    boton.disabled = true;
    boton.textContent = texto;
    try { await tarea(); } finally { boton.disabled = false; boton.textContent = original; }
  }

  $('#tab-login').addEventListener('click', () => cambiarPestana('login'));
  $('#tab-registro').addEventListener('click', () => cambiarPestana('registro'));

  document.querySelectorAll('.ver-password').forEach((boton) => {
    boton.addEventListener('click', () => {
      const input = document.getElementById(boton.dataset.objetivo);
      const mostrar = input.type === 'password';
      input.type = mostrar ? 'text' : 'password';
      boton.setAttribute('aria-label', mostrar ? 'Ocultar contraseña' : 'Mostrar contraseña');
    });
  });

  $('#reg-password').addEventListener('input', (e) => {
    const valor = e.target.value;
    const puntos = (valor.length >= 8) + (/[a-zA-Z]/.test(valor) && /\d/.test(valor)) + (valor.length >= 12 || /[^a-zA-Z0-9]/.test(valor));
    $('#medidor').dataset.nivel = valor ? String(Math.max(1, puntos)) : '0';
  });

  $('#form-login').addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    limpiarErrores(form);
    const correo = form.correo.value.trim();
    const password = form.password.value;
    const errores = {};
    if (!correo) errores.correo = 'Escribe tu correo.';
    if (!password) errores.password = 'Escribe tu contraseña.';
    if (Object.keys(errores).length) { marcarErrores(form, errores); return; }

    conCarga($('#btn-login'), 'Entrando…', async () => {
      try {
        await entrar(correo, password);
      } catch (error) {
        mostrarMensaje(error.message);
        marcarErrores(form, error.detalles);
        form.password.select();
      }
    });
  });

  $('#form-registro').addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    limpiarErrores(form);
    const datos = { nombre: form.nombre.value.trim(), correo: form.correo.value.trim(), password: form.password.value };
    const errores = {};
    if (datos.nombre.length < 2) errores.nombre = 'Escribe tu nombre.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(datos.correo)) errores.correo = 'Escribe un correo válido.';
    if (datos.password.length < 8 || !/[a-zA-Z]/.test(datos.password) || !/\d/.test(datos.password)) errores.password = 'Mínimo 8 caracteres, con letras y números.';
    if (Object.keys(errores).length) { marcarErrores(form, errores); return; }

    conCarga($('#btn-registro'), 'Creando cuenta…', async () => {
      try {
        await pedir('/api/auth/registro', { metodo: 'POST', cuerpo: datos });
        mostrarMensaje('Cuenta creada. Entrando…', 'ok');
        await entrar(datos.correo, datos.password);
      } catch (error) {
        mostrarMensaje(error.message);
        marcarErrores(form, error.detalles);
      }
    });
  });
}());
