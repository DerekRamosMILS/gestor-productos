// Productos de ejemplo que se cargan una sola vez (si la colección está vacía y SEMBRAR_DATOS=true),
// para que la aplicación desplegada no arranque sin inventario. Quedan a nombre del administrador.
module.exports = [
  { nombre: 'Laptop 14" Ryzen 5', sku: 'ELEC-001', categoria: 'Electrónica', precio: 13499, stock: 8, descripcion: '16 GB de RAM, SSD de 512 GB, pantalla Full HD.' },
  { nombre: 'Monitor 27" QHD', sku: 'ELEC-002', categoria: 'Electrónica', precio: 5299, stock: 4, descripcion: 'Panel IPS de 75 Hz con puertos HDMI y DisplayPort.' },
  { nombre: 'Audífonos inalámbricos', sku: 'ELEC-003', categoria: 'Electrónica', precio: 1299.9, stock: 25, descripcion: 'Bluetooth 5.3 con cancelación de ruido.' },
  { nombre: 'Silla ergonómica', sku: 'OFI-001', categoria: 'Oficina', precio: 3899, stock: 6, descripcion: 'Soporte lumbar ajustable y descansabrazos 3D.' },
  { nombre: 'Escritorio de pie', sku: 'OFI-002', categoria: 'Oficina', precio: 6499, stock: 3, descripcion: 'Altura eléctrica de 72 a 120 cm.' },
  { nombre: 'Cafetera de goteo', sku: 'HOG-001', categoria: 'Hogar', precio: 899, stock: 14, descripcion: 'Capacidad de 12 tazas con apagado automático.' },
  { nombre: 'Juego de sartenes', sku: 'HOG-002', categoria: 'Hogar', precio: 1499, stock: 9, descripcion: 'Tres piezas con recubrimiento antiadherente.' },
  { nombre: 'Sudadera unisex', sku: 'ROP-001', categoria: 'Ropa', precio: 549, stock: 30, descripcion: 'Algodón perchado, tallas CH a XG.' },
  { nombre: 'Café de Chiapas 500 g', sku: 'ALI-001', categoria: 'Alimentos', precio: 239, stock: 40, descripcion: 'Grano tostado medio de altura.' },
  { nombre: 'Balón de futbol No. 5', sku: 'DEP-001', categoria: 'Deportes', precio: 449, stock: 2, descripcion: 'Cosido a máquina, uso en pasto y sintético.' },
];
