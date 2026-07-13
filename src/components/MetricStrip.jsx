import { Cpu, Gauge, Hand, Waves } from 'lucide-react';

function Metric({ icon: Icon, label, value }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center gap-3">
        <span className="rounded-md border border-white/10 bg-slate-950/60 p-2 text-teal-200">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs uppercase tracking-[0.16em] text-slate-500">{label}</p>
          <p className="mt-1 truncate text-lg font-semibold text-white">{value}</p>
        </div>
      </div>
    </div>
  );
}

export default function MetricStrip({ status, activeSource, isCalibrated, messageCount }) {
  const channel = status === 'connected' ? 'Puente local' : 'Esperando datos';

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric icon={Cpu} label="Sistema" value="Captura articular" />
      <Metric icon={Waves} label="Canal" value={channel} />
      <Metric icon={Hand} label="Modelo" value="Brazo 3D articulado" />
      <Metric icon={Gauge} label="Calibración" value={isCalibrated ? 'Neutral fijado' : `${messageCount} lecturas`} />
    </section>
  );
}
