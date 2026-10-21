import {
  Solicitud,
  InformeDependencia,
  RegistroAsistencia,
  Funcionario,
  MetaPoa,
  UserCredential,
} from '../types';
import {
  safeLocalStorageSet,
  KEY_SOLICITUDES,
  KEY_INFORMES,
  KEY_ASISTENCIAS,
  KEY_FUNCIONARIOS,
  KEY_METAS_POA,
  KEY_AUTH_CREDENTIALS,
  idbSaveAll,
  getStoredSolicitudes,
  getStoredInformes,
  getStoredAsistencias,
  getStoredFuncionarios,
  getStoredMetasPoa,
  mergeCollectionsById,
  syncToServer,
  updateMemoryStorage,
  getAuthHeaders,
} from './storage';

export type SyncStatus = 'connected' | 'connecting' | 'polling' | 'offline';

export interface DatabaseSnapshot {
  solicitudes?: Solicitud[];
  informes?: InformeDependencia[];
  asistencias?: RegistroAsistencia[];
  funcionarios?: Funcionario[];
  metasPoa?: MetaPoa[];
  authCredentials?: UserCredential[];
  userProfiles?: Record<string, any>;
  _serverTimestamp?: number;
}

type DataListener = (data: DatabaseSnapshot) => void;
type StatusListener = (status: SyncStatus) => void;

class RealtimeSyncManager {
  private ws: WebSocket | null = null;
  private eventSource: EventSource | null = null;
  private status: SyncStatus = 'connecting';
  private dataListeners: Set<DataListener> = new Set();
  private statusListeners: Set<StatusListener> = new Set();
  private reconnectAttempts = 0;
  private wsDisabled = false;
  private reconnectTimer: any = null;
  private pingTimer: any = null;
  private connectTimeoutTimer: any = null;
  private pollIntervalTimer: any = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private isInitialized = false;
  private lastKnownTimestamp = 0;
  private lastKnownVersion = 0;
  private lastKnownSnapshot: DatabaseSnapshot | null = null;
  private isVercel = false;
  private versionEndpointDisabled = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.isVercel = Boolean(
        window.location.hostname.includes('vercel.app') ||
        window.location.hostname.includes('now.sh')
      );

      // If deployed on Vercel or serverless platform, operate in clean adaptive polling
      if (this.isVercel) {
        this.wsDisabled = true;
        this.status = 'polling';
      }

      try {
        this.broadcastChannel = new BroadcastChannel('tinaquillo_live_sync');
        this.broadcastChannel.onmessage = () => {
          this.fetchLatestFromServer();
        };
      } catch (e) {
        // BroadcastChannel unavailable in some environments
      }

      window.addEventListener('online', () => {
        console.log('[Realtime] Conexión a internet restablecida');
        if (!this.isVercel) {
          this.connectEventSource();
          if (!this.wsDisabled) {
            this.reconnectAttempts = 0;
            this.connectWebSocket();
          }
        }
        this.checkVersionAndSync();
      });

      window.addEventListener('offline', () => {
        this.setStatus('offline');
      });

      window.addEventListener('focus', () => {
        this.checkVersionAndSync();
      });

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.checkVersionAndSync();
        }
      });
    }
  }

  public init(): void {
    if (this.isInitialized || typeof window === 'undefined') return;
    this.isInitialized = true;
    if (!this.isVercel) {
      this.connectEventSource();
      if (!this.wsDisabled) {
        this.connectWebSocket();
      } else {
        this.setStatus('polling');
      }
    } else {
      this.setStatus('polling');
    }
    this.startAdaptivePolling();
    this.fetchLatestFromServer();
  }

  public getStatus(): SyncStatus {
    return this.status;
  }

  private setStatus(newStatus: SyncStatus): void {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.statusListeners.forEach((listener) => {
        try {
          listener(newStatus);
        } catch (e) {
          console.error('[Realtime] Error en statusListener:', e);
        }
      });
    }
  }

  public subscribeData(listener: DataListener): () => void {
    this.dataListeners.add(listener);
    if (this.lastKnownSnapshot) {
      try {
        listener(this.lastKnownSnapshot);
      } catch (err) {
        console.error('[Realtime] Error enviando snapshot inicial a dataListener:', err);
      }
    }
    return () => {
      this.dataListeners.delete(listener);
    };
  }

  public subscribeStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  private getWebSocketUrl(): string {
    const loc = window.location;
    const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${loc.host}/ws`;
  }

  private connectWebSocket(): void {
    if (typeof window === 'undefined' || !window.WebSocket || this.wsDisabled) {
      this.setStatus('polling');
      this.resetPollingInterval(2500);
      return;
    }

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.setStatus(this.reconnectAttempts === 0 ? 'connecting' : 'polling');

    try {
      const url = this.getWebSocketUrl();
      let opened = false;
      const socket = new WebSocket(url);
      this.ws = socket;

      if (this.connectTimeoutTimer) {
        clearTimeout(this.connectTimeoutTimer);
      }
      this.connectTimeoutTimer = setTimeout(() => {
        if (!opened && this.ws === socket) {
          try {
            socket.onopen = null;
            socket.onclose = null;
            socket.onerror = null;
            socket.onmessage = null;
            if (socket.readyState === WebSocket.OPEN) {
              socket.close();
            }
          } catch (e) {}
          this.ws = null;
          this.setStatus('polling');
          this.resetPollingInterval(2500);
        }
      }, 4000);

      socket.onopen = () => {
        opened = true;
        if (this.connectTimeoutTimer) clearTimeout(this.connectTimeoutTimer);
        console.log('[Realtime WS] Conectado en tiempo real a la base de datos');
        this.reconnectAttempts = 0;
        this.setStatus('connected');
        this.startHeartbeat();
        this.resetPollingInterval(3500);
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'init' || message.type === 'db_update') {
            if (message.timestamp) {
              this.lastKnownTimestamp = message.timestamp;
            }
            if (message.data) {
              this.applyIncomingDatabase(message.data);
            }
          }
        } catch (err) {
          // ignore malformed frame
        }
      };

      socket.onclose = () => {
        if (this.connectTimeoutTimer) clearTimeout(this.connectTimeoutTimer);
        this.stopHeartbeat();
        this.setStatus('polling');
        this.resetPollingInterval(1800);

        if (!opened) {
          this.reconnectAttempts++;
          // If WebSocket failed to open twice (e.g. serverless proxy / unsupported platform), stop attempting
          if (this.reconnectAttempts >= 2) {
            console.log('[Realtime] Servidor sin soporte WebSocket directo; operando en modo sincronización continua de alta frecuencia');
            this.wsDisabled = true;
            this.setStatus('polling');
            return;
          }
        }
        this.scheduleReconnect();
      };

      socket.onerror = () => {
        // Handled silently to avoid unhandled rejections or error popups
        this.setStatus('polling');
      };
    } catch (err) {
      this.wsDisabled = true;
      this.setStatus('polling');
      this.resetPollingInterval(2500);
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: 'ping' }));
        } catch (e) {}
      }
    }, 20000);
  }

  private stopHeartbeat(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectAttempts++;
    // Exponential backoff with jitter: 1.5s, 3s, 6s (capped at 8s)
    const delay = Math.min(1500 * Math.pow(1.5, this.reconnectAttempts - 1), 8000);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!navigator.onLine) {
        this.setStatus('offline');
        return;
      }
      this.connectWebSocket();
    }, delay);
  }

  private connectEventSource(): void {
    if (typeof window === 'undefined' || !window.EventSource || this.isVercel) return;
    try {
      if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = null;
      }
      const es = new EventSource('/api/sync/events');
      this.eventSource = es;

      es.onopen = () => {
        console.log('[Realtime SSE] Conectado en tiempo real mediante Server-Sent Events');
        this.setStatus('connected');
      };

      es.addEventListener('init', (e: any) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.version) this.lastKnownVersion = payload.version;
          if (payload.data) this.applyIncomingDatabase(payload.data);
        } catch (_) {}
      });

      es.addEventListener('db_update', (e: any) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.version) this.lastKnownVersion = payload.version;
          if (payload.data) this.applyIncomingDatabase(payload.data);
        } catch (_) {}
      });

      es.onerror = () => {
        // Close immediately on error so the browser does not endlessly spam 404 reconnect requests
        try {
          es.close();
        } catch (_) {}
        if (this.eventSource === es) {
          this.eventSource = null;
        }
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
          this.setStatus('polling');
        }
      };
    } catch (err) {
      this.eventSource = null;
    }
  }

  public async checkVersionAndSync(): Promise<void> {
    try {
      if (this.versionEndpointDisabled) {
        await this.fetchLatestFromServer();
        return;
      }
      const res = await fetch(`/api/sync/version?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store',
          Pragma: 'no-cache',
          ...getAuthHeaders(),
        },
      });
      if (res.status === 404) {
        // If /api/sync/version is not supported by the hosting platform, fallback to direct db polling cleanly
        this.versionEndpointDisabled = true;
        this.resetPollingInterval(this.isVercel ? 6000 : 8000);
        await this.fetchLatestFromServer();
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      if (data && (data.version !== this.lastKnownVersion || !this.lastKnownSnapshot)) {
        if (data.version) this.lastKnownVersion = data.version;
        await this.fetchLatestFromServer();
      }
    } catch (_) {}
  }

  private startAdaptivePolling(): void {
    const interval = this.isVercel ? 6000 : this.status === 'connected' ? 3500 : 2500;
    this.resetPollingInterval(interval);
  }

  private resetPollingInterval(ms: number): void {
    if (this.pollIntervalTimer) {
      clearInterval(this.pollIntervalTimer);
    }
    this.pollIntervalTimer = setInterval(() => {
      this.checkVersionAndSync();
    }, ms);
  }

  public async fetchLatestFromServer(): Promise<void> {
    try {
      const res = await fetch(`/api/database?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          ...getAuthHeaders(),
        },
      });
      if (!res.ok) {
        if (this.status !== 'connected') {
          this.setStatus('polling');
        }
        return;
      }
      const data = await res.json();
      if (data) {
        if (data._version) {
          this.lastKnownVersion = data._version;
        }
        if (this.status !== 'connected' && navigator.onLine) {
          this.setStatus('polling');
        }
        this.applyIncomingDatabase(data);
      }
    } catch (err) {
      if (!navigator.onLine) {
        this.setStatus('offline');
      }
    }
  }

  // Idempotently apply incoming database updates to browser cache and active subscribers
  public applyIncomingDatabase(data: DatabaseSnapshot): void {
    if (!data) return;
    this.lastKnownSnapshot = data;
    updateMemoryStorage(data);

    let hasChanged = false;

    if (Array.isArray(data.solicitudes)) {
      const storedStr = localStorage.getItem(KEY_SOLICITUDES) || '[]';
      const incomingStr = JSON.stringify(data.solicitudes);
      if (storedStr !== incomingStr) {
        safeLocalStorageSet(KEY_SOLICITUDES, incomingStr);
        idbSaveAll('solicitudes', data.solicitudes).catch(() => {});
        hasChanged = true;
      }
    }

    if (Array.isArray(data.informes)) {
      const storedStr = localStorage.getItem(KEY_INFORMES) || '[]';
      const incomingStr = JSON.stringify(data.informes);
      if (storedStr !== incomingStr) {
        safeLocalStorageSet(KEY_INFORMES, incomingStr);
        idbSaveAll('informes', data.informes).catch(() => {});
        hasChanged = true;
      }
    }

    if (Array.isArray(data.asistencias)) {
      const storedStr = localStorage.getItem(KEY_ASISTENCIAS) || '[]';
      const incomingStr = JSON.stringify(data.asistencias);
      if (storedStr !== incomingStr) {
        safeLocalStorageSet(KEY_ASISTENCIAS, incomingStr);
        idbSaveAll('asistencias', data.asistencias).catch(() => {});
        hasChanged = true;
      }
    }

    if (Array.isArray(data.funcionarios)) {
      const cleanIncoming = data.funcionarios.filter(
        (f) => f && f.nombresApellidos && f.nombresApellidos !== 'VFCVG KCD'
      );
      data.funcionarios = cleanIncoming;
      const storedStr = localStorage.getItem(KEY_FUNCIONARIOS) || '[]';
      const incomingStr = JSON.stringify(cleanIncoming);
      if (storedStr !== incomingStr) {
        safeLocalStorageSet(KEY_FUNCIONARIOS, incomingStr);
        idbSaveAll('funcionarios', cleanIncoming).catch(() => {});
        hasChanged = true;
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('tinaquillo_funcionarios_sync', { detail: cleanIncoming })
          );
        }
      }
    }

    if (Array.isArray(data.metasPoa)) {
      const storedStr = localStorage.getItem(KEY_METAS_POA) || '[]';
      const incomingStr = JSON.stringify(data.metasPoa);
      if (storedStr !== incomingStr) {
        safeLocalStorageSet(KEY_METAS_POA, incomingStr);
        idbSaveAll('metasPoa', data.metasPoa).catch(() => {});
        hasChanged = true;
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('tinaquillo_metas_poa_sync', { detail: data.metasPoa })
          );
        }
      }
    }

    if (Array.isArray(data.authCredentials)) {
      const storedStr = localStorage.getItem(KEY_AUTH_CREDENTIALS) || '[]';
      const incomingStr = JSON.stringify(data.authCredentials);
      if (storedStr !== incomingStr) {
        safeLocalStorageSet(KEY_AUTH_CREDENTIALS, incomingStr);
        idbSaveAll('authCredentials', data.authCredentials).catch(() => {});
        hasChanged = true;
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('tinaquillo_credentials_sync', { detail: data.authCredentials })
          );
        }
      }
    }

    // Always inform in-memory React listeners
    this.dataListeners.forEach((listener) => {
      try {
        listener(data);
      } catch (err) {
        console.error('[Realtime] Error notificando a dataListener:', err);
      }
    });

    if (hasChanged && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tinaquillo_db_sync'));
      try {
        if (this.broadcastChannel) {
          this.broadcastChannel.postMessage({ type: 'SYNC_EVENT', timestamp: Date.now() });
        }
      } catch (e) {}
    }
  }

  public requestSync(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ type: 'request_sync' }));
        return;
      } catch (e) {}
    }
    this.fetchLatestFromServer();
  }
}

// Global Singleton Instance
export const realtimeSync = new RealtimeSyncManager();

export function initRealtimeSync(): void {
  realtimeSync.init();
}

export function subscribeRealtimeData(listener: DataListener): () => void {
  return realtimeSync.subscribeData(listener);
}

export function subscribeSyncStatus(listener: StatusListener): () => void {
  return realtimeSync.subscribeStatus(listener);
}

export function getRealtimeSyncStatus(): SyncStatus {
  return realtimeSync.getStatus();
}

export function triggerInstantSync(): Promise<void> {
  return realtimeSync.fetchLatestFromServer();
}
