import { SerialPort } from 'serialport';

const ports = await SerialPort.list();

if (ports.length === 0) {
  console.log('No se encontraron puertos seriales.');
  process.exit(0);
}

console.log('Puertos seriales detectados:\n');

ports.forEach((port) => {
  console.log(`- ${port.path}`);

  if (port.manufacturer) {
    console.log(`  Fabricante: ${port.manufacturer}`);
  }

  if (port.friendlyName) {
    console.log(`  Nombre: ${port.friendlyName}`);
  }
});
