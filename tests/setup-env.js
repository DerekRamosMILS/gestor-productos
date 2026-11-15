// Variables de entorno para todas las pruebas (se cargan antes de importar el código)
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-solo-para-pruebas-automaticas-0123456789abcdef';
