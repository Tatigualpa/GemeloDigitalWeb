import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Maximize2, Minimize2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import DigitalArm from './DigitalArm';

function ArmCanvas({ expanded = false, rawData, calibration, blendStrength = 1, forwardFlip = false }) {
  return (
    <Canvas
      camera={{ position: expanded ? [0.7, 1.1, 8.4] : [0.6, 1.15, 9.6], fov: expanded ? 40 : 44 }}
      shadows
      dpr={[1, 2]}
    >
      <color attach="background" args={['#071018']} />
      <fog attach="fog" args={['#071018', 9, 17]} />
      <ambientLight intensity={0.66} />
      <directionalLight position={[4, 6, 4]} intensity={1.9} castShadow shadow-mapSize={[1024, 1024]} />
      <pointLight position={[-3, 2, 2]} intensity={1.2} color="#2dd4bf" />
      <pointLight position={[3, -1, -2]} intensity={0.7} color="#a5b4fc" />
      <group position={[0.4, expanded ? 1.85 : 1.72, 0]} scale={expanded ? 0.88 : 0.72}>
        <DigitalArm rawData={rawData} calibration={calibration} blendStrength={blendStrength} forwardFlip={forwardFlip} />
      </group>
      <OrbitControls
        target={[-0.1, 0.1, 0]}
        enablePan={false}
        minDistance={expanded ? 5.8 : 6.2}
        maxDistance={expanded ? 11 : 12}
        maxPolarAngle={Math.PI * 0.78}
      />
    </Canvas>
  );
}

function CalibrationOverlay({ stage, progress }) {
  if (!stage) return null;
  const pct = Math.round((progress ?? 0) * 100);
  const isCapture = stage.id === 'capture_rest' || stage.id === 'capture_fwd';

  return (
    <div className="pointer-events-none absolute inset-0 flex items-start justify-center bg-gradient-to-b from-slate-950/85 via-slate-950/40 to-transparent p-6">
      <div className="pointer-events-auto w-full max-w-xl rounded-xl border border-teal-300/20 bg-slate-950/95 p-5 shadow-2xl shadow-black/40 backdrop-blur">
        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.22em] text-teal-200">
          <span>Calibración {stage.index + 1}/{stage.total}</span>
          <span>{isCapture ? 'CAPTURANDO' : 'PREPARA TU POSE'}</span>
        </div>
        <h3 className="mt-3 text-xl font-bold leading-snug text-white">{stage.label}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-300">{stage.detail}</p>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
          <div
            className={`h-full rounded-full transition-[width] duration-100 ease-linear ${isCapture ? 'bg-teal-300' : 'bg-amber-300'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-2 text-right text-xs tabular-nums text-slate-400">{pct}%</p>
      </div>
    </div>
  );
}

export default function ArmScene({ rawData, calibration, blendStrength = 1, isCalibrating = false, calibrationStage = null, calibrationProgress = 0, forwardFlip = false }) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setExpanded(false);
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [expanded]);

  return (
    <section className="min-h-[520px] overflow-hidden rounded-lg border border-white/10 bg-slate-950/70 shadow-2xl shadow-black/30">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Gemelo digital</h2>
          <p className="mt-1 text-sm text-slate-400">Vista en espejo: el muñeco te mira de frente</p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3.5 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-teal-200 focus:ring-offset-2 focus:ring-offset-slate-950"
        >
          <Maximize2 className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Pantalla completa</span>
        </button>
      </div>

      <div className="relative h-[520px] sm:h-[640px] xl:h-[70vh]">
        <ArmCanvas rawData={rawData} calibration={calibration} blendStrength={blendStrength} forwardFlip={forwardFlip} />
        {isCalibrating && <CalibrationOverlay stage={calibrationStage} progress={calibrationProgress} />}
      </div>

      {expanded && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#071018]">
          <div className="flex min-h-16 items-center justify-between border-b border-white/10 bg-slate-950/85 px-4 py-3 backdrop-blur sm:px-6">
            <div>
              <h2 className="text-base font-semibold text-white sm:text-lg">Gemelo digital</h2>
              <p className="hidden text-sm text-slate-400 sm:block">Vista enfocada del brazo en tiempo real</p>
            </div>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3.5 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-teal-200 focus:ring-offset-2 focus:ring-offset-slate-950"
            >
              <Minimize2 className="h-4 w-4" aria-hidden="true" />
              Salir
            </button>
          </div>
          <div className="relative min-h-0 flex-1">
            <ArmCanvas expanded rawData={rawData} calibration={calibration} blendStrength={blendStrength} forwardFlip={forwardFlip} />
            {isCalibrating && <CalibrationOverlay stage={calibrationStage} progress={calibrationProgress} />}
          </div>
        </div>
      )}
    </section>
  );
}
