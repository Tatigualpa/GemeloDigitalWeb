import { SENSOR_ROLES, clamp } from '../utils/sensors';

const DISPLAY_KEYS = ['ax', 'ay', 'az', 'gx', 'gy', 'gz'];

const axisLimits = {
  ax: 18000,
  ay: 18000,
  az: 18000,
  gx: 260,
  gy: 260,
  gz: 260,
};

const axisLabels = {
  ax: 'AX',
  ay: 'AY',
  az: 'AZ',
  gx: 'GX',
  gy: 'GY',
  gz: 'GZ',
};

function AxisBar({ axis, value }) {
  const limit = axisLimits[axis];
  const normalized = clamp(Math.abs(value) / limit, 0, 1);
  const width = `${Math.max(4, normalized * 100)}%`;
  const isGyro = axis.startsWith('g');

  return (
    <div className="grid grid-cols-[2.25rem_1fr_4.25rem] items-center gap-3 text-xs">
      <span className="font-semibold text-slate-300">{axisLabels[axis]}</span>
      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full rounded-full ${isGyro ? 'bg-indigo-300' : 'bg-teal-300'}`}
          style={{ width }}
        />
      </div>
      <span className="text-right tabular-nums text-slate-300">{Math.round(value)}</span>
    </div>
  );
}

export default function SensorCard({ id, title, data }) {
  return (
    <article className="rounded-lg border border-white/10 bg-slate-950/70 p-4 shadow-xl shadow-black/20 backdrop-blur">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <p className="mt-1 text-xs text-slate-400">{SENSOR_ROLES[id]}</p>
        </div>
        <span className="rounded-md border border-teal-300/20 bg-teal-300/10 px-2 py-1 text-xs font-medium text-teal-100">
          Activo
        </span>
      </div>

      <div className="space-y-2.5">
        {DISPLAY_KEYS.map((axis) => (
          <AxisBar key={axis} axis={axis} value={data[axis]} />
        ))}
      </div>
    </article>
  );
}
