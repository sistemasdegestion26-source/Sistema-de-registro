import React, { useEffect, useMemo, useState } from 'react';
import { Activity, MonitorSmartphone, ServerCog, Wifi, CheckCircle2 } from 'lucide-react';

interface DeviceSession {
  id: string;
  userAgent: string;
  platform: string;
  isMobile: boolean;
  ip: string;
  connectedAt: number;
  lastSeen: number;
}

interface LiveStatusResponse {
  counts: {
    solicitudes: number;
    informes: number;
    asistencias: number;
    funcionarios: number;
  };
  clients: DeviceSession[];
  serverTimestamp: number;
  activeDevices: number;
}

const getDeviceId = (): string => {
  if (typeof window === 'undefined') return 'device_server';
  let id = localStorage.getItem('tinaquillo_device_id');
  if (!id) {
    id = 'dev_' + Math.random().toString(36).substring(2, 10);
    localStorage.setItem('tinaquillo_device_id', id);
  }
  return id;
};

export const LiveDataMonitor: React.FC<{ syncStatus?: string }> = ({ syncStatus = 'connected' }) => {
  const [liveStatus, setLiveStatus] = useState<LiveStatusResponse | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadStatus = async () => {
      try {
        const deviceId = getDeviceId();
        const res = await fetch(`/api/live-status?_t=${Date.now()}&cid=${deviceId}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
          },
        });

        if (!res.ok) return;
        const data = await res.json();
        if (mounted) setLiveStatus(data);
      } catch (err) {
        // Fallback: polling seguirá actualizando
      }
    };

    loadStatus();
    const timer = window.setInterval(loadStatus, 4000);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  const totalRecords = useMemo(() => {
    if (!liveStatus) return 0;
    return (
      liveStatus.counts.solicitudes +
      liveStatus.counts.informes +
      liveStatus.counts.asistencias +
      liveStatus.counts.funcionarios
    );
  }, [liveStatus]);

  const isOnline = syncStatus !== 'offline';

  return (
    <div id="live-data-monitor" className="bg-slate-900 text-white rounded-2xl border border-slate-700 shadow-xl p-4 sm:p-5">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-300">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-bold">Tiempo real</p>
            <h3 className="text-lg font-black text-white">Monitoreo global de datos</h3>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start lg:self-auto">
          <span
            className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-full text-[10px] font-bold border ${
              isOnline
                ? 'bg-emerald-500/15 border-emerald-400/30 text-emerald-300'
                : 'bg-rose-500/15 border-rose-400/30 text-rose-300'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
            {isOnline ? 'Sincronización activa' : 'Sin conexión'}
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-700 bg-slate-800/80 p-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">Solicitudes</p>
          <p className="mt-2 text-2xl font-black text-white">{liveStatus?.counts.solicitudes ?? 0}</p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800/80 p-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">Informes</p>
          <p className="mt-2 text-2xl font-black text-white">{liveStatus?.counts.informes ?? 0}</p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800/80 p-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">Asistencias</p>
          <p className="mt-2 text-2xl font-black text-white">{liveStatus?.counts.asistencias ?? 0}</p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800/80 p-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">Total</p>
          <p className="mt-2 text-2xl font-black text-white">{totalRecords}</p>
        </div>
      </div>

      <div className="mt-4 grid lg:grid-cols-[1.2fr_0.8fr] gap-4">
        <div className="rounded-xl border border-slate-700 bg-slate-800/80 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
              <MonitorSmartphone className="w-4 h-4 text-sky-400" />
              Dispositivos conectados
            </div>
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-sky-500/10 border border-sky-400/25 text-[10px] font-bold text-sky-200">
              <Wifi className="w-3 h-3" />
              {liveStatus?.activeDevices ?? 0}
            </span>
          </div>

          <div className="mt-3 space-y-2 max-h-52 overflow-y-auto pr-1">
            {!liveStatus?.clients?.length ? (
              <div className="text-xs text-slate-400 px-2 py-3">No hay dispositivos conectados en este momento.</div>
            ) : (
              liveStatus.clients.map((device) => (
                <div key={device.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2">
                  <div className="min-w-0">
                    <p className="font-bold text-xs text-white truncate">
                      {device.platform} {device.isMobile ? '(Android/iPhone)' : '(Escritorio)'}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">{device.userAgent || 'Navegador web'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-400/30 px-2 py-0.5 text-[10px] font-bold text-emerald-200">
                      <CheckCircle2 className="w-3 h-3" />
                      Online
                    </div>
                    <p className="mt-1 text-[10px] text-slate-400">
                      {new Date(device.lastSeen).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-800/80 p-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
            <ServerCog className="w-4 h-4 text-emerald-400" />
            Estado del servidor
          </div>

          <div className="mt-3 space-y-3 text-xs text-slate-300">
            <div className="flex items-center justify-between rounded-lg bg-slate-900/70 px-3 py-2">
              <span>Última actualización</span>
              <span className="font-bold text-white">
                {liveStatus
                  ? new Date(liveStatus.serverTimestamp).toLocaleTimeString('es-VE', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })
                  : '--:--:--'}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-900/70 px-3 py-2">
              <span>Base de datos</span>
              <span className="font-bold text-emerald-300">Activa</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-900/70 px-3 py-2">
              <span>Modo sync</span>
              <span className="font-bold text-sky-300 uppercase">{syncStatus}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
