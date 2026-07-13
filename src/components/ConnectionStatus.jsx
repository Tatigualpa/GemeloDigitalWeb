import { Activity, Radio, WifiOff } from 'lucide-react';

const statusConfig = {
  connected: {
    label: 'En línea',
    description: 'Recibiendo lecturas',
    Icon: Radio,
    badge: 'bg-teal-400',
    tone: 'border-teal-400/30 bg-teal-400/10 text-teal-100',
  },
  connecting: {
    label: 'Conectando',
    description: 'Esperando enlace de datos',
    Icon: Activity,
    badge: 'bg-amber-300',
    tone: 'border-amber-300/30 bg-amber-300/10 text-amber-100',
  },
  disconnected: {
    label: 'Sin conexión',
    description: 'Reintentando conexión',
    Icon: WifiOff,
    badge: 'bg-sky-300',
    tone: 'border-sky-300/30 bg-sky-300/10 text-sky-100',
  },
};

export default function ConnectionStatus({
  status,
  url,
  messageCount,
  lastMessageAt,
}) {
  const config = statusConfig[status] ?? statusConfig.disconnected;
  const { Icon } = config;
  const lastMessage = lastMessageAt
    ? lastMessageAt.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : 'Esperando lectura';

  return (
    <section className={`rounded-lg border p-4 shadow-glow ${config.tone}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${config.badge} ${status === 'connecting' ? 'animate-pulse' : ''}`} />
            <p className="text-sm font-semibold uppercase tracking-[0.18em]">{config.label}</p>
          </div>
          <p className="mt-2 truncate text-xs text-slate-300">{config.description}</p>
          <p className="mt-1 truncate text-xs text-slate-400">{url}</p>
        </div>
        <div className="rounded-md border border-white/10 bg-white/5 p-2">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-md border border-white/10 bg-black/20 p-3">
          <p className="text-slate-400">Lecturas</p>
          <p className="mt-1 text-lg font-semibold text-white">{messageCount}</p>
        </div>
        <div className="rounded-md border border-white/10 bg-black/20 p-3">
          <p className="text-slate-400">Última lectura</p>
          <p className="mt-1 truncate text-sm font-medium text-white">{lastMessage}</p>
        </div>
      </div>

      <div className="mt-3 rounded-md border border-white/10 bg-black/20 p-3">
        <p className="text-xs text-slate-400">Canal activo</p>
        <p className="mt-1 text-sm font-semibold text-white">Puente local</p>
      </div>
    </section>
  );
}
