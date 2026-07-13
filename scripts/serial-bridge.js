import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import { WebSocket, WebSocketServer } from 'ws';

const portPath = process.argv[2] ?? 'COM3';
const baudRate = Number(process.argv[3] ?? 115200);
const wsPort = Number(process.env.WS_PORT ?? 8081);
const debugSerial = process.env.SERIAL_DEBUG === '1';

const wss = new WebSocketServer({ port: wsPort });

let clients = 0;
let receivedFrames = 0;
let sentFrames = 0;
let invalidFrames = 0;
let rawLines = 0;
const latestSensorData = {
  sensor1: null,
  sensor2: null,
  sensor3: null,
};
const channelToSensor = {
  0: 'sensor3',
  1: 'sensor2',
  3: 'sensor1',
};
const orientationState = {
  sensor1: { roll: 0, pitch: 0, yaw: 0, lastAt: null, initialized: false },
  sensor2: { roll: 0, pitch: 0, yaw: 0, lastAt: null, initialized: false },
  sensor3: { roll: 0, pitch: 0, yaw: 0, lastAt: null, initialized: false },
};
const seenChannels = new Set();
const GYRO_LSB_PER_DEGREE_SECOND = 131;
const GYRO_DEADZONE_DEGREE_SECOND = 1.5;
const MAX_INTEGRATION_STEP_SECONDS = 0.25;

console.log(`[ws] Esperando app en ws://localhost:${wsPort}`);
console.log(`[serial] Puerto configurado: ${portPath} a ${baudRate} baudios`);
console.log(`[serial] Debug crudo: ${debugSerial ? 'activo' : 'inactivo'}`);
console.log('[serial] Mapeo esperado: Canal 0 -> sensor3, Canal 1 -> sensor2, Canal 3 -> sensor1');

function resetOrientationState() {
  ['sensor1', 'sensor2', 'sensor3'].forEach((sensorId) => {
    orientationState[sensorId] = { roll: 0, pitch: 0, yaw: 0, lastAt: null, initialized: false };
  });
  console.log('[ws] Estado de orientación reiniciado por solicitud del cliente');
}

wss.on('connection', (socket) => {
  clients += 1;
  console.log(`[ws] App conectada. Clientes: ${clients}`);

  socket.on('message', (raw) => {
    try {
      const message = JSON.parse(raw.toString());
      if (message && message.cmd === 'reset_orientation') {
        resetOrientationState();
      }
    } catch {
      // Ignora mensajes no JSON desde la app.
    }
  });

  socket.on('close', () => {
    clients = Math.max(0, clients - 1);
    console.log(`[ws] App desconectada. Clientes: ${clients}`);
  });
});

function broadcast(payload) {
  const message = JSON.stringify(payload);

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
      sentFrames += 1;
    }
  });
}

function isValidSensorData(value) {
  const axes = ['ax', 'ay', 'az', 'gx', 'gy', 'gz'];

  return ['sensor1', 'sensor2', 'sensor3'].every((sensorId) => {
    const sensor = value?.[sensorId];
    return sensor && axes.every((axis) => Number.isFinite(Number(sensor[axis])));
  });
}

function extractJson(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  return text.slice(start, end + 1);
}

function parseMpuLine(text) {
  const channelMatch = text.match(/Canal\s*:?\s*(\d+)/i);
  const axisMatches = {
    ax: text.match(/AX\s*:?\s*(-?\d+)/i),
    ay: text.match(/AY\s*:?\s*(-?\d+)/i),
    az: text.match(/AZ\s*:?\s*(-?\d+)/i),
    gx: text.match(/GX\s*:?\s*(-?\d+)/i),
    gy: text.match(/GY\s*:?\s*(-?\d+)/i),
    gz: text.match(/GZ\s*:?\s*(-?\d+)/i),
  };

  if (!channelMatch || Object.values(axisMatches).some((match) => !match)) {
    return null;
  }

  const channel = channelMatch[1];
  const sensorId = channelToSensor[channel];

  if (!sensorId) {
    return null;
  }

  return {
    channel,
    sensorId,
    values: {
      ax: Number(axisMatches.ax[1]),
      ay: Number(axisMatches.ay[1]),
      az: Number(axisMatches.az[1]),
      gx: Number(axisMatches.gx[1]),
      gy: Number(axisMatches.gy[1]),
      gz: Number(axisMatches.gz[1]),
    },
  };
}

function radiansToDegrees(value) {
  return value * (180 / Math.PI);
}

function normalizeAngle(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return ((((value + 180) % 360) + 360) % 360) - 180;
}

function gyroToDegreesPerSecond(value) {
  const degreesPerSecond = Number(value) / GYRO_LSB_PER_DEGREE_SECOND;

  return Math.abs(degreesPerSecond) < GYRO_DEADZONE_DEGREE_SECOND ? 0 : degreesPerSecond;
}

function computeOrientation(sensorId, values) {
  const accelRoll = radiansToDegrees(Math.atan2(values.ay, values.az));
  const accelPitch = radiansToDegrees(Math.atan2(-values.ax, Math.sqrt(values.ay ** 2 + values.az ** 2)));
  const state = orientationState[sensorId];
  const now = performance.now();
  const dt = state.lastAt
    ? Math.min(MAX_INTEGRATION_STEP_SECONDS, Math.max(0, (now - state.lastAt) / 1000))
    : 0;
  const accelBlend = 0.22;
  const gyroRoll = gyroToDegreesPerSecond(values.gx);
  const gyroPitch = gyroToDegreesPerSecond(values.gy);
  const gyroYaw = gyroToDegreesPerSecond(values.gz);

  if (!state.initialized) {
    state.roll = accelRoll;
    state.pitch = accelPitch;
    state.yaw = 0;
    state.initialized = true;
  } else {
    state.roll = normalizeAngle((state.roll + gyroRoll * dt) * (1 - accelBlend) + accelRoll * accelBlend);
    state.pitch = normalizeAngle((state.pitch + gyroPitch * dt) * (1 - accelBlend) + accelPitch * accelBlend);
    state.yaw = normalizeAngle(state.yaw + gyroYaw * dt);
  }

  state.lastAt = now;

  return {
    roll: state.roll,
    pitch: state.pitch,
    yaw: state.yaw,
  };
}

function broadcastLatestIfReady() {
  if (!latestSensorData.sensor1 || !latestSensorData.sensor2 || !latestSensorData.sensor3) {
    return;
  }

  receivedFrames += 1;
  broadcast({
    sensor1: latestSensorData.sensor1,
    sensor2: latestSensorData.sensor2,
    sensor3: latestSensorData.sensor3,
  });

  if (receivedFrames <= 5 || receivedFrames % 25 === 0) {
    console.log(`[serial] Lecturas recibidas: ${receivedFrames} | enviadas: ${sentFrames} | clientes: ${clients}`);
  }
}

function handleLine(line) {
  rawLines += 1;
  const text = line.trim();

  if (!text) {
    return;
  }

  if (debugSerial && (rawLines <= 20 || rawLines % 50 === 0)) {
    console.log(`[serial:line ${rawLines}] ${text.slice(0, 260)}`);
  }

  const mpuReading = parseMpuLine(text);

  if (mpuReading) {
    if (!seenChannels.has(mpuReading.channel)) {
      seenChannels.add(mpuReading.channel);
      console.log(`[serial] Canal ${mpuReading.channel} detectado como ${mpuReading.sensorId}`);
    }

    latestSensorData[mpuReading.sensorId] = {
      ...mpuReading.values,
      ...computeOrientation(mpuReading.sensorId, mpuReading.values),
    };
    broadcastLatestIfReady();
    return;
  }

  const jsonText = extractJson(text);

  if (!jsonText) {
    invalidFrames += 1;

    if (debugSerial && (invalidFrames <= 10 || invalidFrames % 50 === 0)) {
      console.warn(`[serial] Sin JSON en línea: ${text.slice(0, 180)}`);
    }

    return;
  }

  try {
    const parsed = JSON.parse(jsonText);

    if (!isValidSensorData(parsed)) {
      invalidFrames += 1;

      if (invalidFrames <= 10 || invalidFrames % 50 === 0) {
        console.warn(`[serial] JSON no coincide con sensor1/sensor2/sensor3. Claves: ${Object.keys(parsed).join(', ')}`);
      }

      return;
    }

    receivedFrames += 1;
    broadcast(parsed);

    if (receivedFrames <= 5 || receivedFrames % 25 === 0) {
      console.log(`[serial] Lecturas recibidas: ${receivedFrames} | enviadas: ${sentFrames} | clientes: ${clients}`);
    }
  } catch (error) {
    invalidFrames += 1;

    if (invalidFrames <= 10 || invalidFrames % 50 === 0) {
      console.warn(`[serial] JSON inválido: ${error.message}`);
      console.warn(`[serial] Texto: ${jsonText.slice(0, 220)}`);
    }
  }
}

const serial = new SerialPort({
  path: portPath,
  baudRate,
  autoOpen: false,
});

serial.on('open', () => {
  console.log(`[serial] ${portPath} abierto correctamente`);

  // Evita toggles innecesarios que pueden reiniciar algunas placas ESP32.
  serial.set({ dtr: false, rts: false }, () => {});
});

serial.on('error', (error) => {
  console.error(`[serial] Error: ${error.message}`);
});

serial.on('close', () => {
  console.warn(`[serial] ${portPath} se cerró`);
});

const parser = serial.pipe(new ReadlineParser({ delimiter: '\n', encoding: 'utf8' }));
parser.on('data', handleLine);

serial.open((error) => {
  if (!error) {
    return;
  }

  console.error(`[serial] No se pudo abrir ${portPath}: ${error.message}`);
  console.error('[serial] Cierra Monitor Serial, Plotter Serial, navegador u otra app que use el puerto.');
});

process.on('SIGINT', () => {
  console.log('\n[serial] Cerrando puente');
  serial.close(() => {
    wss.close(() => process.exit(0));
  });
});
