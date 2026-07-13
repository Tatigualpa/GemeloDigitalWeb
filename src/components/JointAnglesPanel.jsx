import { useMemo } from 'react';

function fmt(value) {
  const v = Number.isFinite(value) ? value : 0;
  const sign = v >= 0 ? '+' : '−';
  return `${sign}${Math.abs(v).toFixed(0)}°`;
}

function AngleRow({ label, value, range = 90 }) {
  const v = Number.isFinite(value) ? value : 0;
  const clamped = Math.max(-range, Math.min(range, v));
  const pct = ((clamped + range) / (range * 2)) * 100;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-300">{label}</span>
        <span className="tabular-nums font-medium text-slate-100">{fmt(v)}</span>
      </div>
      <div className="relative h-1.5 overflow-hidden rounded-full bg-slate-800">
        <span className="absolute left-1/2 top-0 h-full w-px bg-slate-600" aria-hidden="true" />
        <span
          className="absolute top-0 h-full rounded-full bg-teal-300"
          style={{
            left: `${Math.min(pct, 50)}%`,
            width: `${Math.abs(pct - 50)}%`,
          }}
        />
      </div>
    </div>
  );
}

export default function JointAnglesPanel({ data }) {
  const angles = useMemo(() => {
    const s3 = data.sensor3;
    const s2 = data.sensor2;
    const s1 = data.sensor1;
    return {
      shoulderPitch: s3.pitch,
      shoulderRoll: s3.roll,
      shoulderYaw: s3.yaw,
      elbowFlex: s2.pitch - s3.pitch,
      elbowTwist: s2.roll - s3.roll,
      wristPitch: s1.pitch - s2.pitch,
      wristRoll: s1.roll - s2.roll,
      wristYaw: s1.yaw - s2.yaw,
    };
  }, [data]);

  return (
    <div className="rounded-lg border border-white/10 bg-slate-950/70 p-4 shadow-xl shadow-black/20">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-white">Ángulos articulares</h2>
        <span className="rounded-md border border-teal-300/20 bg-teal-300/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-teal-100">
          tiempo real
        </span>
      </div>

      <div className="space-y-4">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Hombro</p>
          <div className="space-y-2">
            <AngleRow label="Elevación (pitch)" value={angles.shoulderPitch} range={90} />
            <AngleRow label="Abducción (roll)" value={angles.shoulderRoll} range={90} />
            <AngleRow label="Rotación (yaw)" value={angles.shoulderYaw} range={90} />
          </div>
        </div>

        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Codo</p>
          <div className="space-y-2">
            <AngleRow label="Flexión" value={angles.elbowFlex} range={140} />
            <AngleRow label="Pronación" value={angles.elbowTwist} range={90} />
          </div>
        </div>

        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Muñeca</p>
          <div className="space-y-2">
            <AngleRow label="Flexión / extensión" value={angles.wristPitch} range={70} />
            <AngleRow label="Desviación radial" value={angles.wristRoll} range={60} />
            <AngleRow label="Rotación" value={angles.wristYaw} range={60} />
          </div>
        </div>
      </div>
    </div>
  );
}
