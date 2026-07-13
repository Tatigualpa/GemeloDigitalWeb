import { RotateCcw, SlidersHorizontal, CheckCircle2 } from 'lucide-react';

export default function CalibrationButton({ onCalibrate, onReset, calibrated, disabled, isCalibrating, progress = 0, stage = null }) {
  const pct = Math.round((progress ?? 0) * 100);

  let label;
  if (isCalibrating) {
    label = stage ? `${stage.index + 1}/${stage.total} · ${pct}%` : `Calibrando ${pct}%`;
  } else if (calibrated) {
    label = 'Re-calibrar';
  } else {
    label = 'Calibrar';
  }

  return (
    <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
      <button
        type="button"
        onClick={onCalibrate}
        disabled={disabled || isCalibrating}
        className="relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-md bg-teal-300 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-teal-950/30 transition hover:bg-teal-200 focus:outline-none focus:ring-2 focus:ring-teal-200 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {isCalibrating && (
          <span
            className="absolute inset-y-0 left-0 bg-teal-500/70 transition-[width] duration-100 ease-linear"
            style={{ width: `${pct}%` }}
            aria-hidden="true"
          />
        )}
        <span className="relative inline-flex items-center gap-2">
          {calibrated && !isCalibrating ? (
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          ) : (
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          )}
          {label}
        </span>
      </button>

      <button
        type="button"
        onClick={onReset}
        disabled={!calibrated || isCalibrating}
        className="inline-flex items-center justify-center gap-2 rounded-md border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <RotateCcw className="h-4 w-4" aria-hidden="true" />
        Reiniciar
      </button>
    </div>
  );
}
