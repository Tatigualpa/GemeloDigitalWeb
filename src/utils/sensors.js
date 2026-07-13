export const SENSOR_KEYS = ['ax', 'ay', 'az', 'gx', 'gy', 'gz', 'roll', 'pitch', 'yaw'];
export const ORIENTATION_KEYS = ['roll', 'pitch', 'yaw'];

export const SENSOR_NAMES = {
  sensor1: 'Muñeca',
  sensor2: 'Codo',
  sensor3: 'Hombro',
};

export const SENSOR_ROLES = {
  sensor1: 'Rotación de muñeca y mano',
  sensor2: 'Flexión del codo',
  sensor3: 'Orientación del hombro',
};

export const DEFAULT_SENSOR_DATA = {
  sensor1: { ax: 0, ay: 0, az: 16384, gx: 0, gy: 0, gz: 0, roll: 0, pitch: 0, yaw: 0 },
  sensor2: { ax: 0, ay: 0, az: 16384, gx: 0, gy: 0, gz: 0, roll: 0, pitch: 0, yaw: 0 },
  sensor3: { ax: 0, ay: 0, az: 16384, gx: 0, gy: 0, gz: 0, roll: 0, pitch: 0, yaw: 0 },
};

export const WS_URL = 'ws://localhost:8081';

export function cloneSensorData(data) {
  return {
    sensor1: { ...data.sensor1 },
    sensor2: { ...data.sensor2 },
    sensor3: { ...data.sensor3 },
  };
}

export function isValidSensorData(value) {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return ['sensor1', 'sensor2', 'sensor3'].every((sensorId) => {
    const sensor = value[sensorId];
    return (
      sensor &&
      typeof sensor === 'object' &&
      ['ax', 'ay', 'az', 'gx', 'gy', 'gz'].every((key) => Number.isFinite(Number(sensor[key])))
    );
  });
}

export function normalizeSensorData(value) {
  const normalized = cloneSensorData(DEFAULT_SENSOR_DATA);

  ['sensor1', 'sensor2', 'sensor3'].forEach((sensorId) => {
    SENSOR_KEYS.forEach((key) => {
      const numericValue = Number(value[sensorId][key]);
      normalized[sensorId][key] = Number.isFinite(numericValue) ? numericValue : DEFAULT_SENSOR_DATA[sensorId][key];
    });
  });

  return normalized;
}

export function subtractCalibration(data, calibration) {
  if (!calibration) {
    return data;
  }

  const adjusted = cloneSensorData(data);

  ['sensor1', 'sensor2', 'sensor3'].forEach((sensorId) => {
    // La nueva calibración guarda dos poses por sensor: { rest, fwd }.
    // Usamos la pose de reposo como referencia para mostrar deltas en el panel.
    const restRef = calibration[sensorId]?.rest ?? calibration[sensorId];
    if (!restRef) return;
    ORIENTATION_KEYS.forEach((key) => {
      const offset = Number(restRef[key]) || 0;
      adjusted[sensorId][key] = data[sensorId][key] - offset;
    });
  });

  return adjusted;
}

export function createEmptySensorData() {
  return {
    sensor1: { ax: 0, ay: 0, az: 0, gx: 0, gy: 0, gz: 0 },
    sensor2: { ax: 0, ay: 0, az: 0, gx: 0, gy: 0, gz: 0 },
    sensor3: { ax: 0, ay: 0, az: 0, gx: 0, gy: 0, gz: 0 },
  };
}

export function averageSensorSamples(samples) {
  if (samples.length === 0) {
    return null;
  }

  const totals = createEmptySensorData();

  samples.forEach((sample) => {
    ['sensor1', 'sensor2', 'sensor3'].forEach((sensorId) => {
      SENSOR_KEYS.forEach((key) => {
        totals[sensorId][key] += sample[sensorId][key];
      });
    });
  });

  ['sensor1', 'sensor2', 'sensor3'].forEach((sensorId) => {
    SENSOR_KEYS.forEach((key) => {
      totals[sensorId][key] /= samples.length;
    });
  });

  return totals;
}

export function deadzone(value, threshold) {
  return Math.abs(value) < threshold ? 0 : value;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
