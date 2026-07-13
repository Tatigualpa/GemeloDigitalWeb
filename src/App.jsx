import CalibrationButton from './components/CalibrationButton';
import ConnectionStatus from './components/ConnectionStatus';
import ArmScene from './components/ArmScene';
import MetricStrip from './components/MetricStrip';
import SensorCard from './components/SensorCard';
import JointAnglesPanel from './components/JointAnglesPanel';
import { useSensorStream } from './hooks/useSensorStream';
import { SENSOR_NAMES, WS_URL } from './utils/sensors';

export default function App() {
  const {
    rawData,
    data,
    status,
    activeSource,
    hasRealData,
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
  } = useSensorStream(WS_URL);

  // Durante la calibración suavizamos la respuesta del modelo.
  const blendStrength = isCalibrating ? 0.18 : 1;

  return (
    <main className="min-h-screen px-4 py-5 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-4 rounded-lg border border-white/10 bg-slate-950/60 p-5 shadow-2xl shadow-black/20 backdrop-blur lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-200">Dashboard tecnológico</p>
            <h1 className="mt-3 text-3xl font-bold tracking-normal text-white sm:text-4xl">Gemelo digital de brazo</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              Vista en espejo del brazo en tiempo real. La calibración guiada de 2 poses fija el sistema de referencia para que el modelo se mueva igual a tu brazo real.
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-2">
            <CalibrationButton
              onCalibrate={calibrate}
              onReset={resetCalibration}
              calibrated={Boolean(calibration)}
              disabled={!hasRealData}
              isCalibrating={isCalibrating}
              progress={calibrationProgress}
              stage={calibrationStage}
            />
            <button
              type="button"
              onClick={toggleForwardFlip}
              className={`inline-flex items-center justify-center gap-2 rounded-md border px-3.5 py-2 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-amber-200 focus:ring-offset-2 focus:ring-offset-slate-950 ${
                forwardFlip
                  ? 'border-amber-300/40 bg-amber-300/20 text-amber-100 hover:bg-amber-300/30'
                  : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
              }`}
              title="Invierte el sentido de adelante/atras del brazo si el movimiento sale al reves"
            >
              {forwardFlip ? '↺ Sentido invertido' : '↻ Invertir sentido'}
            </button>
          </div>
        </header>

        <MetricStrip status={status} activeSource={activeSource} isCalibrated={Boolean(calibration)} messageCount={messageCount} />

        <section className="rounded-lg border border-teal-300/20 bg-teal-300/[0.06] p-4 text-sm leading-6 text-slate-200 shadow-xl shadow-black/10">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-teal-200">Colocación de los sensores (físico)</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <p className="text-xs font-semibold text-teal-200">Canal 0 · Hombro</p>
              <p className="mt-1 text-xs text-slate-300">Pega el MPU sobre el <strong>bíceps</strong>, a media altura entre hombro y codo, cara externa del brazo. Firme, que no rote.</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-teal-200">Canal 1 · Codo</p>
              <p className="mt-1 text-xs text-slate-300">Pega el MPU sobre el <strong>antebrazo</strong>, unos 5 cm debajo del codo, cara externa. Firme.</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-teal-200">Canal 3 · Muñeca</p>
              <p className="mt-1 text-xs text-slate-300">Pega el MPU sobre el <strong>dorso de la mano</strong> cerca del nudillo del dedo medio (o una pulsera firme).</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            La orientación específica del chip (qué eje apunta dónde) <strong>ya no importa</strong>: la calibración de 2 poses la resuelve sola. Solo cuida que los sensores queden bien sujetos al brazo.
          </p>
        </section>

        <div className="grid gap-5 xl:grid-cols-[1fr_22rem]">
          <ArmScene
            rawData={rawData}
            calibration={calibration}
            blendStrength={blendStrength}
            isCalibrating={isCalibrating}
            calibrationStage={calibrationStage}
            calibrationProgress={calibrationProgress}
            forwardFlip={forwardFlip}
          />

          <aside className="flex flex-col gap-5">
            <ConnectionStatus
              status={status}
              url={WS_URL}
              messageCount={messageCount}
              lastMessageAt={lastMessageAt}
            />

            <JointAnglesPanel data={data} />

            <div className="rounded-lg border border-white/10 bg-slate-950/70 p-4 shadow-xl shadow-black/20">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-white">Cómo funciona la calibración</h2>
                </div>
                <span className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300">
                  {isCalibrating ? 'En proceso' : calibration ? 'Lista' : 'Pendiente'}
                </span>
              </div>
              <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm leading-6 text-slate-400">
                <li><strong>Pose 1</strong>: brazo natural pegado al cuerpo, palma hacia el muslo.</li>
                <li><strong>Pose 2</strong>: brazo recto al frente, paralelo al piso, palma hacia abajo.</li>
                <li>Si el movimiento sale al revés después de calibrar, pulsa el botón <strong>"Invertir sentido"</strong>.</li>
              </ol>
              <p className="mt-3 text-xs text-slate-500">La auto-calibración inicia al recibir datos. Pulsa <strong>Re-calibrar</strong> para repetir cuando quieras.</p>
            </div>
          </aside>
        </div>

        <section className="grid gap-4 lg:grid-cols-3">
          {Object.entries(SENSOR_NAMES).map(([sensorId, title]) => (
            <SensorCard key={sensorId} id={sensorId} title={title} data={rawData[sensorId]} />
          ))}
        </section>
      </div>
    </main>
  );
}
