// Crea y configura la aplicación de Express (sin abrir el puerto, para poder usarla en las pruebas con supertest).
const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

const config = require('./config/env');
const db = require('./config/db');
const bitacora = require('./middleware/bitacora');
const { rutaNoEncontrada, manejadorErrores } = require('./middleware/errores');
const authRoutes = require('./routes/auth.routes');
const productosRoutes = require('./routes/productos.routes');
const usuariosRoutes = require('./routes/usuarios.routes');
const { verificarToken } = require('./middleware/auth');

const PUBLICO = path.join(__dirname, '..', 'public');

function crearApp() {
  const app = express();
  app.set('trust proxy', 1); // Render atiende detrás de un proxy: así req.ip es la IP real del cliente

  // ---------- Middlewares de seguridad y de manejo de solicitudes ----------
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        'default-src': ["'self'"],
        'style-src': ["'self'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'https://fonts.gstatic.com'],
        'img-src': ["'self'", 'data:'],
        'script-src': ["'self'"],
      },
    },
  }));
  app.use(express.json({ limit: '20kb' }));   // JSON → req.body
  app.use(cookieParser());                    // cookies → req.cookies (token de sesión)

  // La página del panel solo se entrega con una sesión válida; si no, redirige al login
  app.get(['/productos', '/productos.html'], (req, res) => {
    verificarToken(req, res, (error) => {
      if (error) return res.redirect('/login');
      res.set('Cache-Control', 'no-store');
      return res.sendFile(path.join(PUBLICO, 'productos.html'));
    });
  });
  app.use(express.static(PUBLICO, { extensions: ['html'] })); // vistas estáticas (login, estilos, scripts)

  // ---------- API ----------
  app.use('/api', bitacora);
  app.get('/api/salud', (req, res) => {
    const bd = db.estado();
    res.status(bd === 'conectada' ? 200 : 503).json({ estado: bd === 'conectada' ? 'ok' : 'sin base de datos', bd, entorno: config.entorno, version: config.version });
  });
  app.use('/api/auth', authRoutes);
  app.use('/api/productos', productosRoutes);
  app.use('/api/usuarios', usuariosRoutes);
  app.use('/api', rutaNoEncontrada);

  // ---------- Páginas ----------
  app.get('/', (req, res) => res.redirect('/login'));
  app.use((req, res) => res.status(404).sendFile(path.join(PUBLICO, '404.html')));

  app.use(manejadorErrores); // siempre al final
  return app;
}

module.exports = { crearApp };
