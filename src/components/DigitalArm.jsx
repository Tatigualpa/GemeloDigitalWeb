import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { MathUtils, Matrix4, Quaternion, Vector3 } from 'three';

const upperArmLength = 1.72;
const forearmLength = 1.58;
const WORLD_DOWN = new Vector3(0, -1, 0);
const LOCAL_FOREARM_AXIS = new Vector3(0, -1, 0);

const fingers = [
  { name: 'thumb', x: -0.36, y: -0.1, z: 0.14, length: 0.52, radius: 0.048, spread: 0.82, side: -0.42 },
  { name: 'index', x: -0.2, y: -0.53, z: 0.02, length: 0.66, radius: 0.042, spread: 0.13, side: 0 },
  { name: 'middle', x: -0.07, y: -0.56, z: 0.02, length: 0.73, radius: 0.045, spread: 0.02, side: 0 },
  { name: 'ring', x: 0.07, y: -0.55, z: 0.02, length: 0.66, radius: 0.041, spread: -0.08, side: 0 },
  { name: 'little', x: 0.2, y: -0.51, z: 0.02, length: 0.53, radius: 0.037, spread: -0.17, side: 0 },
];

function skin(color = '#e7c6b6', emissive = '#1b0d0b', intensity = 0.035) {
  return {
    color,
    roughness: 0.72,
    metalness: 0.02,
    emissive,
    emissiveIntensity: intensity,
  };
}

function SoftCapsule({ position, rotation = [0, 0, 0], scale = [1, 1, 1], radius, length, color }) {
  return (
    <mesh position={position} rotation={rotation} scale={scale} castShadow receiveShadow>
      <capsuleGeometry args={[radius, length, 14, 36]} />
      <meshStandardMaterial {...skin(color)} />
    </mesh>
  );
}

function MuscleBulge({ position, scale, color = '#efcdbc' }) {
  return (
    <mesh position={position} scale={scale} castShadow receiveShadow>
      <sphereGeometry args={[1, 40, 20]} />
      <meshStandardMaterial {...skin(color, '#2a1510', 0.04)} />
    </mesh>
  );
}

function UpperArm() {
  return (
    <group>
      <SoftCapsule position={[0, -0.86, 0]} radius={0.25} length={1.22} color="#e8c6b4" />
      <MuscleBulge position={[-0.08, -0.7, 0.11]} scale={[0.28, 0.62, 0.2]} color="#f0ccba" />
      <MuscleBulge position={[0.09, -0.78, -0.09]} scale={[0.22, 0.58, 0.18]} color="#dcae9d" />
      <MuscleBulge position={[0.02, -1.24, 0.02]} scale={[0.24, 0.35, 0.2]} color="#e4bdaa" />
    </group>
  );
}

function Forearm() {
  return (
    <group>
      <SoftCapsule position={[0, -0.79, 0]} radius={0.19} length={1.22} color="#eccbbb" />
      <MuscleBulge position={[-0.04, -0.52, 0.1]} scale={[0.23, 0.5, 0.16]} color="#f1d0c1" />
      <MuscleBulge position={[0.07, -0.83, -0.08]} scale={[0.17, 0.46, 0.13]} color="#dcb4a4" />
      <MuscleBulge position={[0, -1.28, 0]} scale={[0.16, 0.28, 0.13]} color="#e7c4b5" />
    </group>
  );
}

function Finger({ config, curl }) {
  const base = useRef();
  const mid = useRef();
  const firstLength = config.length * 0.43;
  const secondLength = config.length * 0.31;
  const tipLength = config.length * 0.2;

  useFrame((_, delta) => {
    const speed = 1 - Math.pow(0.001, delta);
    base.current.rotation.x = MathUtils.lerp(base.current.rotation.x, -curl * 0.36, speed);
    mid.current.rotation.x = MathUtils.lerp(mid.current.rotation.x, -curl * 0.28, speed);
  });

  return (
    <group position={[config.x, config.y, config.z]} rotation={[0, config.side, config.spread]}>
      <group ref={base}>
        <SoftCapsule position={[0, -firstLength / 2, 0]} radius={config.radius} length={firstLength * 0.76} color="#efd0c1" />
        <group ref={mid} position={[0, -firstLength, 0]}>
          <SoftCapsule position={[0, -secondLength / 2, 0]} radius={config.radius * 0.86} length={secondLength * 0.74} color="#e9c5b6" />
          <SoftCapsule position={[0, -secondLength - tipLength / 2, 0]} radius={config.radius * 0.68} length={tipLength * 0.7} color="#f3d8cb" />
        </group>
      </group>
    </group>
  );
}

function Hand({ wristCurl }) {
  const curl = MathUtils.clamp(Math.abs(wristCurl) * 0.5 + 0.08, 0.08, 0.5);

  return (
    <group>
      <MuscleBulge position={[0, -0.25, 0.01]} scale={[0.36, 0.54, 0.15]} color="#eecdbc" />
      <MuscleBulge position={[-0.16, -0.12, 0.08]} scale={[0.2, 0.24, 0.1]} color="#f4d8cb" />
      <MuscleBulge position={[0.16, -0.16, -0.02]} scale={[0.16, 0.28, 0.09]} color="#dab2a4" />
      {fingers.map((finger) => (
        <Finger key={finger.name} config={finger} curl={curl} />
      ))}
    </group>
  );
}

function gravityFromSensor(sensor) {
  const v = new Vector3(
    Number.isFinite(sensor?.ax) ? sensor.ax : 0,
    Number.isFinite(sensor?.ay) ? sensor.ay : 0,
    Number.isFinite(sensor?.az) ? sensor.az : 1,
  );
  if (v.lengthSq() < 1e-6) return new Vector3(0, -1, 0);
  return v.normalize();
}

// Construye R_s0⁻¹ a partir de las dos poses de calibración.
// forwardFlip permite invertir el sentido del eje "adelante" si tu setup
// físico (montaje de MPU + brazo usado) produce el mapeo opuesto al
// esperado por defecto.
function buildSensorInverseFrame(sensorCal, forwardFlip = false) {
  if (!sensorCal?.rest || !sensorCal?.fwd) return null;

  const restG = gravityFromSensor(sensorCal.rest);
  const fwdG = gravityFromSensor(sensorCal.fwd);

  const colY = restG.clone().multiplyScalar(-1).normalize();
  const forwardSign = forwardFlip ? 1 : -1;
  let colZ = fwdG.clone().multiplyScalar(forwardSign).normalize();
  const proj = colY.dot(colZ);
  colZ = colZ.clone().sub(colY.clone().multiplyScalar(proj));
  if (colZ.lengthSq() < 1e-6) {
    return null;
  }
  colZ.normalize();
  const colX = colY.clone().cross(colZ).normalize();

  const m = new Matrix4().makeBasis(colX, colY, colZ);
  const Rs0 = new Quaternion().setFromRotationMatrix(m);
  return Rs0.clone().invert();
}

// Rotación mundial del segmento, recuperada a partir de la gravedad actual
// usando el marco calibrado del sensor.
function jointWorldRotation(rawSensor, sensorInvFrame) {
  if (!sensorInvFrame) return new Quaternion();
  const curG = gravityFromSensor(rawSensor);
  const v = curG.clone().applyQuaternion(sensorInvFrame);
  return new Quaternion().setFromUnitVectors(v, WORLD_DOWN);
}

function numericSensorValue(sensor, key) {
  const value = Number(sensor?.[key]);

  return Number.isFinite(value) ? value : 0;
}

export default function DigitalArm({ rawData, calibration, blendStrength = 1, forwardFlip = false }) {
  const shoulder = useRef();
  const elbow = useRef();
  const wrist = useRef();

  const invFrames = useMemo(() => {
    if (!calibration) return null;
    return {
      sensor1: buildSensorInverseFrame(calibration.sensor1, forwardFlip),
      sensor2: buildSensorInverseFrame(calibration.sensor2, forwardFlip),
      sensor3: buildSensorInverseFrame(calibration.sensor3, forwardFlip),
    };
  }, [calibration, forwardFlip]);

  const targets = useMemo(() => {
    const Q3 = jointWorldRotation(rawData?.sensor3, invFrames?.sensor3); // hombro
    const Q2 = jointWorldRotation(rawData?.sensor2, invFrames?.sensor2); // codo
    const Q1 = jointWorldRotation(rawData?.sensor1, invFrames?.sensor1); // muñeca

    const shoulderQ = Q3.clone();
    const elbowQ = Q3.clone().invert().multiply(Q2);
    const wristQ = Q2.clone().invert().multiply(Q1);
    const wristTwist = MathUtils.degToRad(MathUtils.clamp(
      numericSensorValue(rawData?.sensor1, 'yaw') - numericSensorValue(rawData?.sensor2, 'yaw'),
      -85,
      85,
    ));
    const wristTwistQ = new Quaternion().setFromAxisAngle(LOCAL_FOREARM_AXIS, wristTwist);
    wristQ.x *= -1;
    wristQ.multiply(wristTwistQ);

    return { shoulderQ, elbowQ, wristQ };
  }, [rawData, invFrames]);

  const handCurl = useMemo(() => {
    const w = MathUtils.clamp(targets.wristQ.w, -1, 1);
    const angle = 2 * Math.acos(Math.abs(w));
    const wristGyro = Math.abs(numericSensorValue(rawData?.sensor1, 'gx'))
      + Math.abs(numericSensorValue(rawData?.sensor1, 'gy'))
      + Math.abs(numericSensorValue(rawData?.sensor1, 'gz'));

    return MathUtils.clamp(angle * 0.45 + MathUtils.clamp(wristGyro / 18000, 0, 0.16), 0.05, 0.58);
  }, [rawData?.sensor1, targets.wristQ]);

  useFrame((_, delta) => {
    if (!shoulder.current || !elbow.current || !wrist.current) return;
    // Constante de tiempo corta para muñeca y codo: responde rápido.
    const tau = 0.05;
    const speed = Math.min(1, (1 - Math.exp(-delta / tau)) * blendStrength);

    shoulder.current.quaternion.slerp(targets.shoulderQ, speed);
    elbow.current.quaternion.slerp(targets.elbowQ, speed);
    wrist.current.quaternion.slerp(targets.wristQ, speed);
  });

  return (
    <group>
      <mesh position={[-1.05, 0.12, -0.08]} scale={[1.12, 0.68, 0.34]} castShadow receiveShadow>
        <sphereGeometry args={[1, 56, 24]} />
        <meshStandardMaterial {...skin('#ddb6a7', '#1b0d0b', 0.03)} />
      </mesh>
      <mesh position={[-1.55, 0.16, -0.12]} rotation={[0, 0, -0.12]} scale={[0.42, 0.8, 0.3]} castShadow receiveShadow>
        <sphereGeometry args={[1, 44, 20]} />
        <meshStandardMaterial {...skin('#cfa393', '#130807', 0.025)} />
      </mesh>

      <group ref={shoulder} position={[0, 0, 0]}>
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[0.42, 52, 26]} />
          <meshStandardMaterial {...skin('#efcebf', '#24110d', 0.04)} />
        </mesh>

        <group position={[0, -0.36, 0]}>
          <UpperArm />

          <group ref={elbow} position={[0, -upperArmLength, 0]}>
            <mesh scale={[1, 0.8, 0.92]} castShadow receiveShadow>
              <sphereGeometry args={[0.29, 46, 22]} />
              <meshStandardMaterial {...skin('#e8c4b5', '#24110d', 0.035)} />
            </mesh>
            <MuscleBulge position={[0.02, -0.16, 0.02]} scale={[0.23, 0.22, 0.18]} color="#d9ad9e" />

            <group position={[0, -0.24, 0]}>
              <Forearm />

              <group ref={wrist} position={[0, -forearmLength, 0]}>
                <mesh scale={[0.9, 0.72, 0.82]} castShadow receiveShadow>
                  <sphereGeometry args={[0.19, 38, 18]} />
                  <meshStandardMaterial {...skin('#e5c1b4', '#1b0d0b', 0.03)} />
                </mesh>
                <group position={[0, -0.08, 0]}>
                  <Hand wristCurl={handCurl} />
                </group>
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
