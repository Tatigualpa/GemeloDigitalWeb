import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_SENSOR_DATA,
  WS_URL,
  averageSensorSamples,
  cloneSensorData,
  isValidSensorData,
  normalizeSensorData,
  subtractCalibration,
} from '../utils/sensors';

// Secuencia guiada de calibración. La pose 1 fija el "abajo" del brazo
// y la pose 2 fija qué dirección es "al frente" para tu cuerpo. Sin estas
// dos referencias no se puede recuperar la orientación 3D del brazo a
// partir solo del acelerómetro.
const STAGES = [
  {
    id: 'prep_rest',
    label: 'POSE 1 — Brazo natural pegado al cuerpo, palma hacia el muslo',
    detail: 'Brazo relajado a un costado, como cuando estás parado normal. Empezamos en…',
    duration: 4000,
    capture: null,
  },
  {
    id: 'capture_rest',
    label: 'CAPTURANDO REPOSO',
    detail: 'No muevas el brazo. Mantén la pose natural.',
    duration: 1500,
    capture: 'rest',
  },
  {
    id: 'prep_fwd',
    label: 'POSE 2 — Brazo recto al frente, paralelo al piso, palma hacia abajo',
    detail: 'Cambia a la nueva pose. Empezamos en…',
    duration: 4500,
    capture: null,
  },
  {
    id: 'capture_fwd',
    label: 'CAPTURANDO FRENTE',
    detail: 'No muevas el brazo. Sostén firme al frente.',
    duration: 1500,
    capture: 'fwd',
  },
];

export function useSensorStream(url = WS_URL) {
  const [rawData, setRawData] = useState(DEFAULT_SENSOR_DATA);
  const [status, setStatus] = useState('connecting');
  const [activeSource, setActiveSource] = useState('websocket');
  const [messageCount, setMessageCount] = useState(0);
  const [lastMessageAt, setLastMessageAt] = useState(null);
  const [retryKey, setRetryKey] = useState(0);
  const [calibration, setCalibration] = useState(null);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationStage, setCalibrationStage] = useState(null);
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [forwardFlip, setForwardFlip] = useState(false);
  const restSamplesRef = useRef([]);
  const fwdSamplesRef = useRef([]);
  const captureModeRef = useRef(null);
  const socketRef = useRef(null);
  const calibrationTimerRef = useRef(null);
  const calibrationStageStartedAtRef = useRef(0);
  const autoCalibratedRef = useRef(false);

  const commitSensorData = useCallback((value, source) => {
    if (!isValidSensorData(value)) {
      return false;
    }

    const normalized = normalizeSensorData(value);
    setRawData(normalized);
    setMessageCount((count) => count + 1);
    setLastMessageAt(new Date());
    setActiveSource(source);
    setStatus('connected');

    const mode = captureModeRef.current;
    if (mode === 'rest') {
      restSamplesRef.current.push(cloneSensorData(normalized));
    } else if (mode === 'fwd') {
      fwdSamplesRef.current.push(cloneSensorData(normalized));
    }

    return true;
  }, []);

  useEffect(() => {
    if (!('WebSocket' in window)) {
      setStatus('disconnected');
      return undefined;
    }

    let socket;
    let closedByEffect = false;
    let retryTimer;

    try {
      setStatus('connecting');
      socket = new WebSocket(url);
      socketRef.current = socket;
    } catch {
      setStatus('disconnected');
      retryTimer = window.setTimeout(() => setRetryKey((value) => value + 1), 3000);
      return () => window.clearTimeout(retryTimer);
    }

    socket.onopen = () => {
      setActiveSource('bridge');
      setStatus('connected');
    };

    socket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        commitSensorData(parsed, 'bridge');
      } catch {
        // Ignorado
      }
    };

    socket.onerror = () => setStatus('disconnected');

    socket.onclose = () => {
      socketRef.current = null;
      if (closedByEffect) return;
      setStatus('disconnected');
      retryTimer = window.setTimeout(() => setRetryKey((value) => value + 1), 3000);
    };

    return () => {
      closedByEffect = true;
      window.clearTimeout(retryTimer);
      if (socket && socket.readyState <= WebSocket.OPEN) {
        socket.close();
      }
      socketRef.current = null;
    };
  }, [commitSensorData, retryKey, url]);

  useEffect(() => {
    if (!calibrationStage) {
      setCalibrationProgress(0);
      return undefined;
    }

    let frame;
    const tick = () => {
      const elapsed = performance.now() - calibrationStageStartedAtRef.current;
      const ratio = Math.min(1, elapsed / calibrationStage.duration);
      setCalibrationProgress(ratio);
      if (ratio < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      if (frame) cancelAnimationFrame(frame);
    };
  }, [calibrationStage]);

  const runStage = useCallback((idx) => {
    if (idx >= STAGES.length) {
      captureModeRef.current = null;
      const restAvg = averageSensorSamples(restSamplesRef.current);
      const fwdAvg = averageSensorSamples(fwdSamplesRef.current);
      if (restAvg && fwdAvg) {
        setCalibration({
          sensor1: { rest: restAvg.sensor1, fwd: fwdAvg.sensor1 },
          sensor2: { rest: restAvg.sensor2, fwd: fwdAvg.sensor2 },
          sensor3: { rest: restAvg.sensor3, fwd: fwdAvg.sensor3 },
        });
      }
      restSamplesRef.current = [];
      fwdSamplesRef.current = [];
      setIsCalibrating(false);
      setCalibrationStage(null);
      calibrationTimerRef.current = null;
      autoCalibratedRef.current = true;
      return;
    }

    const stage = STAGES[idx];
    captureModeRef.current = stage.capture;
    calibrationStageStartedAtRef.current = performance.now();
    setCalibrationStage({ ...stage, index: idx, total: STAGES.length });

    calibrationTimerRef.current = window.setTimeout(() => {
      runStage(idx + 1);
    }, stage.duration);
  }, []);

  const calibrate = useCallback(() => {
    if (messageCount === 0) return;
    if (calibrationTimerRef.current) {
      window.clearTimeout(calibrationTimerRef.current);
      calibrationTimerRef.current = null;
    }
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      try {
        socketRef.current.send(JSON.stringify({ cmd: 'reset_orientation' }));
      } catch {
        // ignorado
      }
    }
    setCalibration(null);
    restSamplesRef.current = [];
    fwdSamplesRef.current = [];
    captureModeRef.current = null;
    setIsCalibrating(true);
    runStage(0);
  }, [messageCount, runStage]);

  const resetCalibration = useCallback(() => {
    setCalibration(null);
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      try {
        socketRef.current.send(JSON.stringify({ cmd: 'reset_orientation' }));
      } catch {
        // ignorado
      }
    }
  }, []);

  // Auto-calibración una sola vez por sesión, cuando llegan datos estables.
  useEffect(() => {
    if (autoCalibratedRef.current) return;
    if (calibration) return;
    if (isCalibrating) return;
    if (messageCount < 25) return;
    autoCalibratedRef.current = true;
    calibrate();
  }, [messageCount, calibration, isCalibrating, calibrate]);

  const calibratedData = useMemo(
    () => subtractCalibration(rawData, calibration),
    [rawData, calibration],
  );

  const toggleForwardFlip = useCallback(() => {
    setForwardFlip((prev) => !prev);
  }, []);

  return {
    rawData,
    data: calibratedData,
    status,
    activeSource,
    hasRealData: messageCount > 0,
    messageCount,
    lastMessageAt,
    calibration,
    isCalibrating,
    calibrationProgress,
    calibrationStage,
    forwardFlip,
    toggleForwardFlip,
    calibrate,
    resetCalibration,
  };
}
