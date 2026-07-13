// Puente MQTT -> WebSocket local.
//
// Hace exactamente el mismo trabajo que scripts/serial-bridge.js, pero
// recibe los datos de los sensores por MQTT (Mosquitto, ver docker-compose.yml)
// en vez de leer el puerto serial del ESP32. El resultado hacia la app React
// (src/hooks/useSensorStream.js) es IDENTICO en formato: la app no sabe ni le
// importa si el dato vino por cable o por WiFi/MQTT.
//
// IMPORTANTE: no correr este script al mismo tiempo que "npm run serial".
// Los dos abren un servidor WebSocket en el mismo puerto (8081 por defecto),
// asi que solo uno puede estar activo a la vez.
import mqtt from 'mqtt';
import { WebSocket, WebSocketServer } from 'ws';

const mqttUrl = process.env.MQTT_URL ?? 'mqtt://localhost:1883';
const wsPort = Number(process.env.WS_PORT ?? 8081);

const wss = new WebSocketServer({ port: wsPort });

// Mismo mapeo que ya usa scripts/serial-bridge.js y que documenta el README
// (seccion "Mapeo de Sensores"): hombro -> sensor3, codo -> sensor2,
// muneca -> sensor1. Los nombres "sensor1/2/3" son los que espera la app.
const topicToSensor = {
  'g6/brazo/sensores/hombro': 'sensor3',
  'g6/brazo/sensores/codo': 'sensor2',
  'g6/brazo/sensores/muneca': 'sensor1',
};

let clients = 0;
let receivedFrames = 0;
let sentFrames = 0;
let invalidPayloads = 0;

const latestSensorData = {
  sensor1: null,
  sensor2: null,
  sensor3: null,
};

// --- Calculo de orientacion (roll/pitch/yaw), duplicado a proposito ---
// Es el mismo algoritmo (filtro complementario: acelerometro para la
// inclinacion absoluta + integracion del giroscopio para los cambios
// rapidos) que ya usa scripts/serial-bridge.js. Se copia aqui en vez de
// importarlo desde ahi para no acoplar los dos puentes ni arriesgar tocar
// un archivo que ya funciona. La app (src/utils/sensors.js) calibra sobre
// estos tres angulos, no sobre los valores crudos del acelerometro/giroscopio,
// asi que sin este calculo el boton "Calibrar" dejaria de tener sentido.
const orientationState = {
  sensor1: { roll: 0, pitch: 0, yaw: 0, lastAt: null, initialized: false },
  sensor2: { roll: 0, pitch: 0, yaw: 0, lastAt: null, initialized: false },
  sensor3: { roll: 0, pitch: 0, yaw: 0, lastAt: null, initialized: false },
};
const GYRO_LSB_PER_DEGREE_SECOND = 131;
const GYRO_DEADZONE_DEGREE_SECOND = 1.5;
const MAX_INTEGRATION_STEP_SECONDS = 0.25;

function resetOrientationState() {
  ['sensor1', 'sensor2', 'sensor3'].forEach((sensorId) => {
    orientationState[sensorId] = { roll: 0, pitch: 0, yaw: 0, lastAt: null, initialized: false };
  });
  console.log('[ws] Estado de orientación reiniciado por solicitud del cliente');
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
// --- fin del bloque de orientacion duplicado ---

console.log(`[ws] Esperando app en ws://localhost:${wsPort}`);
console.log(`[mqtt] Servidor configurado: ${mqttUrl}`);
console.log('[mqtt] Mapeo esperado: hombro -> sensor3, codo -> sensor2, muñeca -> sensor1');

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
    console.log(`[mqtt] Lecturas recibidas: ${receivedFrames} | enviadas: ${sentFrames} | clientes: ${clients}`);
  }
}

const mqttClient = mqtt.connect(mqttUrl, { reconnectPeriod: 2000 });

mqttClient.on('connect', () => {
  console.log(`[mqtt] Conectado a ${mqttUrl}`);
  Object.keys(topicToSensor).forEach((topic) => {
    mqttClient.subscribe(topic, (error) => {
      if (error) {
        console.error(`[mqtt] No se pudo suscribir a ${topic}: ${error.message}`);
      } else {
        console.log(`[mqtt] Suscrito a ${topic} -> ${topicToSensor[topic]}`);
      }
    });
  });
});

mqttClient.on('reconnect', () => {
  console.log('[mqtt] Reconectando al broker...');
});

mqttClient.on('error', (error) => {
  console.error(`[mqtt] Error: ${error.message}`);
});

mqttClient.on('message', (topic, rawMessage) => {
  const sensorId = topicToSensor[topic];

  if (!sensorId) {
    return;
  }

  let values;
  try {
    values = JSON.parse(rawMessage.toString());
  } catch (error) {
    invalidPayloads += 1;
    if (invalidPayloads <= 10 || invalidPayloads % 50 === 0) {
      console.warn(`[mqtt] Payload no es JSON válido en ${topic}: ${error.message}`);
    }
    return;
  }

  const axes = ['ax', 'ay', 'az', 'gx', 'gy', 'gz'];
  const numericValues = {};
  const allValid = axes.every((axis) => {
    const numericAxisValue = Number(values[axis]);
    numericValues[axis] = numericAxisValue;
    return Number.isFinite(numericAxisValue);
  });

  if (!allValid) {
    invalidPayloads += 1;
    if (invalidPayloads <= 10 || invalidPayloads % 50 === 0) {
      console.warn(`[mqtt] Payload incompleto en ${topic}: ${JSON.stringify(values)}`);
    }
    return;
  }

  latestSensorData[sensorId] = {
    ...numericValues,
    ...computeOrientation(sensorId, numericValues),
  };
  broadcastLatestIfReady();
});

process.on('SIGINT', () => {
  console.log('\n[mqtt] Cerrando puente');
  mqttClient.end(true, () => {
    wss.close(() => process.exit(0));
  });
});
