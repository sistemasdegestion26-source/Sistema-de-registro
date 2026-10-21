import {
  Solicitud,
  InformeDependencia,
  AppUser,
  RegistroAsistencia,
  Funcionario,
  ClasificacionDependencia,
  MetaPoa,
  UserCredential,
} from '../types';
import { generateSessionToken, sha256 } from './security';
import { idbSaveAll, idbGetAll, idbClear, requestPersistentStorage } from './indexedDb';
import { INITIAL_FUNCIONARIOS } from '../data/dependenciasData';

export { idbSaveAll, idbGetAll, idbClear, requestPersistentStorage };

export const KEY_USER = 'tinaquillo_dg_current_user';
export const KEY_SESSION_TIME = 'tinaquillo_dg_session_last_active';
export const KEY_SESSION_TOKEN = 'tinaquillo_dg_session_token';
export const KEY_SOLICITUDES = 'tinaquillo_dg_solicitudes';
export const KEY_INFORMES = 'tinaquillo_dg_informes';
export const KEY_ASISTENCIAS = 'tinaquillo_dg_asistencias';
export const KEY_FUNCIONARIOS = 'tinaquillo_dg_funcionarios';
export const KEY_METAS_POA = 'tinaquillo_dg_metas_poa';
export const KEY_USER_PROFILES = 'tinaquillo_dg_saved_profiles';
export const KEY_AUTH_CREDENTIALS = 'tinaquillo_auth_credentials';

export function getCredentialPasswordForUser(usernameOrEmail: string): string {
  const normalized = (usernameOrEmail || '').trim().toLowerCase();

  const envLookup: Record<string, string> = {
    'dg.municipiotianquillo@gmail.com': import.meta.env.VITE_PRIMARY_ADMIN_PASSWORD ?? '',
    'dg.municipiotinaquillo@gmail.com': import.meta.env.VITE_PRIMARY_ADMIN_PASSWORD ?? '',
    'sistemasdegestion26@gmail.com': import.meta.env.VITE_PRIMARY_ADMIN_PASSWORD ?? '',
    'proyectociudad2@gmail.com': import.meta.env.VITE_SECONDARY_USER_PASSWORD ?? '',
    'organizacionplanificacion34@gmail.com': import.meta.env.VITE_PLANIFICACION_PASSWORD ?? '',
    'protocolo1': import.meta.env.VITE_PROTOCOLO_PASSWORD ?? '',
    'protocolo1@gmail.com': import.meta.env.VITE_PROTOCOLO_PASSWORD ?? '',
  };

  return envLookup[normalized] ?? '';
}

export async function matchesCredentialPassword(
  candidatePassword: string,
  credential: UserCredential
): Promise<boolean> {
  const normalizedCandidate = (candidatePassword ?? '').trim();
  if (!normalizedCandidate) return false;

  if (credential.plainPassword) {
    const plain = credential.plainPassword.trim();
    if (plain === normalizedCandidate || plain.toLowerCase() === normalizedCandidate.toLowerCase()) {
      return true;
    }
  }

  if (credential.passwordHash) {
    const candidateHash = await sha256(normalizedCandidate);
    if (candidateHash === credential.passwordHash) {
      return true;
    }
  }

  const configuredPassword = getCredentialPasswordForUser(credential.usernameOrEmail);
  if (
    configuredPassword &&
    (configuredPassword === normalizedCandidate ||
      configuredPassword.toLowerCase() === normalizedCandidate.toLowerCase())
  ) {
    return true;
  }

  return false;
}

export const DEFAULT_AUTH_CREDENTIALS: UserCredential[] = [
  {
    id: 'cred-1',
    usernameOrEmail: 'dg.municipiotinaquillo@gmail.com',
    name: 'Dirección General - Alcaldía de Tinaquillo',
    role: 'PRIMARY_ADMIN',
    title: 'Usuario Principal Autorizado',
    dependencia: 'DIRECCIÓN GENERAL',
    passwordHash: '4cd4b84b8ebdc08719816676aca53c018c67d33b5fda22167066194f959a1fea',
    isActive: true,
  },
  {
    id: 'cred-1b',
    usernameOrEmail: 'sistemasdegestion26@gmail.com',
    name: 'Dirección General (Sistemas de Gestión)',
    role: 'PRIMARY_ADMIN',
    title: 'Usuario Principal Autorizado',
    dependencia: 'DIRECCIÓN GENERAL',
    passwordHash: '4cd4b84b8ebdc08719816676aca53c018c67d33b5fda22167066194f959a1fea',
    isActive: true,
  },
  {
    id: 'cred-2',
    usernameOrEmail: 'proyectociudad2@gmail.com',
    name: 'Directores y Presidentes (Proyecto Ciudad)',
    role: 'SECONDARY_USER',
    title: 'Directores y Presidentes - Carga de Informes',
    dependencia: 'PROYECTO CIUDAD',
    passwordHash: '0c663fbf7034b07c2eb24c2fcba459eeea86c236ad656a908865cbb668351543',
    isActive: true,
  },
  {
    id: 'cred-3',
    usernameOrEmail: 'organizacionplanificacion34@gmail.com',
    name: 'Dirección de Planificación y Organización',
    role: 'PLANIFICACION_USER',
    title: 'Control y Seguimiento POA de Gestión Municipal',
    dependencia: 'DIRECCIÓN DE PLANIFICACIÓN Y ORGANIZACIÓN',
    passwordHash: '154c15bffcbe2d8f87628737fc147435d48dba933e4b867b832f163424160fc1',
    isActive: true,
  },
  {
    id: 'cred-4',
    usernameOrEmail: 'Protocolo1',
    name: 'Dirección de Protocolo y Eventos',
    role: 'PROTOCOLO_USER',
    title: 'Usuario de Protocolo - Registro de Actividades',
    dependencia: 'DIRECCIÓN EJECUTIVA DE DESPACHO',
    passwordHash: '97ff75e29fd84ab6700a34e04670cae7826f55aacb3f1e3cc1a438f51ed4962a',
    isActive: true,
  },
];

export const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

export function normalizeString(str: string): string {
  return (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export function formatFechaEspanol(dateInput?: string | number | Date | null): string {
  if (!dateInput) return 'Fecha no especificada';
  try {
    if (typeof dateInput === 'string') {
      const trimmed = dateInput.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        const [year, month, day] = trimmed.split('-').map(Number);
        const meses = [
          'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
          'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
        ];
        return `${day} de ${meses[month - 1] || 'mes'} de ${year}`;
      }
    }
    const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) {
      return String(dateInput);
    }
    const meses = [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
    ];
    const dia = d.getDate();
    const mes = meses[d.getMonth()];
    const anio = d.getFullYear();
    return `${dia} de ${mes} de ${anio}`;
  } catch {
    return String(dateInput);
  }
}

// In-memory cache to guarantee fast access and eliminate 5MB localStorage quota limits
let memorySolicitudes: Solicitud[] = [];
let memoryInformes: InformeDependencia[] = [];
let memoryAsistencias: RegistroAsistencia[] = [];
let memoryFuncionarios: Funcionario[] = [];
let memoryMetasPoa: MetaPoa[] = [];
let memoryCredentials: UserCredential[] = [];
let memoryProfiles: Record<string, any> = {};

export function updateMemoryStorage(snapshot: {
  solicitudes?: Solicitud[];
  informes?: InformeDependencia[];
  asistencias?: RegistroAsistencia[];
  funcionarios?: Funcionario[];
  metasPoa?: MetaPoa[];
  authCredentials?: UserCredential[];
  userProfiles?: Record<string, any>;
}): void {
  if (Array.isArray(snapshot.solicitudes)) memorySolicitudes = snapshot.solicitudes;
  if (Array.isArray(snapshot.informes)) memoryInformes = snapshot.informes;
  if (Array.isArray(snapshot.asistencias)) memoryAsistencias = snapshot.asistencias;
  if (Array.isArray(snapshot.funcionarios)) memoryFuncionarios = snapshot.funcionarios;
  if (Array.isArray(snapshot.metasPoa)) memoryMetasPoa = snapshot.metasPoa;
  if (Array.isArray(snapshot.authCredentials)) memoryCredentials = snapshot.authCredentials;
  if (snapshot.userProfiles && typeof snapshot.userProfiles === 'object') {
    memoryProfiles = { ...memoryProfiles, ...snapshot.userProfiles };
  }
}

export function getSessionToken(): string | null {
  try {
    return localStorage.getItem(KEY_SESSION_TOKEN) || null;
  } catch {
    return null;
  }
}

export function getAuthHeaders(): Record<string, string> {
  const token = getSessionToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['x-session-token'] = token;
  }
  return headers;
}

export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const authHeaders = getAuthHeaders();
  const mergedHeaders = {
    ...authHeaders,
    ...(options.headers || {}),
  };
  return fetch(url, { ...options, headers: mergedHeaders });
}

export function broadcastLiveSync(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('tinaquillo_live_sync'));
}

export async function syncToServer(endpoint: string, data: any): Promise<boolean> {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return response.ok;
  } catch (e) {
    return false;
  }
}

export function safeLocalStorageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    // QuotaExceededError or private browsing: do not delete existing key, keep in memory and IndexedDB
    console.warn(`[Storage] localStorage quota alcanzada para ${key}; persistiendo en memoria e IndexedDB`);
  }
}

export function getStoredUserProfile(email: string): Partial<AppUser> | null {
  try {
    const normalizedEmail = (email || '').trim().toLowerCase();
    if (memoryProfiles[normalizedEmail]) return memoryProfiles[normalizedEmail];
    const raw = localStorage.getItem(KEY_USER_PROFILES);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    memoryProfiles = { ...memoryProfiles, ...parsed };
    return memoryProfiles[normalizedEmail] ?? null;
  } catch (e) {
    return null;
  }
}

export function saveStoredUserProfile(user: AppUser): void {
  try {
    const normalized = (user.email || '').trim().toLowerCase();
    const updatedProfile = {
      email: user.email,
      name: user.name,
      role: user.role,
      title: user.title,
      dependencia: user.dependencia,
      cedula: user.cedula,
      numeroResolucion: user.numeroResolucion,
      fechaEmisionResolucion: user.fechaEmisionResolucion,
    };
    memoryProfiles[normalized] = updatedProfile;
    safeLocalStorageSet(KEY_USER_PROFILES, JSON.stringify(memoryProfiles));
    syncToServer('/api/profiles', { email: user.email, profile: updatedProfile }).catch(() => {});
  } catch (e) {
    console.error('Error saving profile', e);
  }
}

export function getStoredUser(): AppUser | null {
  try {
    const raw = localStorage.getItem(KEY_USER);
    if (!raw) return null;

    const lastActive = localStorage.getItem(KEY_SESSION_TIME);
    if (lastActive) {
      const elapsed = Date.now() - parseInt(lastActive, 10);
      if (elapsed > SESSION_TIMEOUT_MS) {
        localStorage.removeItem(KEY_USER);
        localStorage.removeItem(KEY_SESSION_TIME);
        localStorage.removeItem(KEY_SESSION_TOKEN);
        return null;
      }
    }

    const parsed: AppUser = JSON.parse(raw);
    const validEmails = [
      'dg.municipiotianquillo@gmail.com',
      'dg.municipiotinaquillo@gmail.com',
      'dg.municipiotinaquillo',
      'sistemasdegestion26@gmail.com',
      'sistemasdegestion26',
      'proyectociudad2@gmail.com',
      'proyectociudad2',
      'organizacionplanificacion34@gmail.com',
      'organizacionplanificacion34',
      'protocolo1',
      'protocolo1@gmail.com',
    ];

    try {
      const storedCredsRaw = localStorage.getItem(KEY_AUTH_CREDENTIALS);
      if (storedCredsRaw) {
        const list = JSON.parse(storedCredsRaw);
        if (Array.isArray(list)) {
          for (const c of list) {
            if (c.usernameOrEmail) {
              validEmails.push(c.usernameOrEmail.toLowerCase());
            }
          }
        }
      }
    } catch (e) {}

    if (!validEmails.includes(parsed.email?.toLowerCase())) {
      localStorage.removeItem(KEY_USER);
      localStorage.removeItem(KEY_SESSION_TIME);
      localStorage.removeItem(KEY_SESSION_TOKEN);
      return null;
    }

    safeLocalStorageSet(KEY_SESSION_TIME, Date.now().toString());
    return parsed;
  } catch (e) {
    console.error('Error reading stored user', e);
    return null;
  }
}

export function touchUserSession(): void {
  try {
    safeLocalStorageSet(KEY_SESSION_TIME, Date.now().toString());
  } catch (e) {}
}

export async function saveStoredUser(user: AppUser | null, serverToken?: string): Promise<void> {
  try {
    if (user) {
      const now = Date.now();
      const token = serverToken || localStorage.getItem(KEY_SESSION_TOKEN) || (await generateSessionToken(user, now));
      safeLocalStorageSet(KEY_USER, JSON.stringify(user));
      safeLocalStorageSet(KEY_SESSION_TIME, now.toString());
      safeLocalStorageSet(KEY_SESSION_TOKEN, token);
    } else {
      localStorage.removeItem(KEY_USER);
      localStorage.removeItem(KEY_SESSION_TIME);
      localStorage.removeItem(KEY_SESSION_TOKEN);
    }
  } catch (e) {
    console.error('Error saving user', e);
  }
}

export function getStoredCredentials(): UserCredential[] {
  if (memoryCredentials.length > 0) return memoryCredentials;
  try {
    const raw = localStorage.getItem(KEY_AUTH_CREDENTIALS);
    if (!raw) return DEFAULT_AUTH_CREDENTIALS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_AUTH_CREDENTIALS;
    memoryCredentials = parsed;
    return parsed;
  } catch (e) {
    return DEFAULT_AUTH_CREDENTIALS;
  }
}

export async function saveStoredCredentials(creds: UserCredential[], replace = false): Promise<boolean> {
  try {
    const sanitized = await Promise.all(
      creds.map(async (cred) => {
        const base = {
          ...cred,
          plainPassword: undefined,
          passwordHash: cred.passwordHash || (cred.plainPassword ? await sha256(cred.plainPassword.trim()) : ''),
        };
        delete (base as any).plainPassword;
        return base;
      })
    );

    memoryCredentials = sanitized;
    safeLocalStorageSet(KEY_AUTH_CREDENTIALS, JSON.stringify(sanitized));
    await idbSaveAll('authCredentials', sanitized).catch(() => {});
    const ok = await syncToServer('/api/database', {
      authCredentials: sanitized,
      replace,
    }).catch(() => false);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tinaquillo_credentials_sync', { detail: sanitized }));
    }
    return ok;
  } catch (e) {
    console.error('Error saving credentials', e);
    return false;
  }
}

export async function saveStoredSolicitudes(solicitudes: any[], replace = false): Promise<boolean> {
  try {
    memorySolicitudes = solicitudes;
    safeLocalStorageSet(KEY_SOLICITUDES, JSON.stringify(solicitudes));
    await idbSaveAll('solicitudes', solicitudes);
    return await syncToServer('/api/database', { solicitudes, replace });
  } catch (e) {
    console.error('Error saving solicitudes', e);
    return false;
  }
}

export function getStoredSolicitudes(): any[] {
  if (memorySolicitudes.length > 0) return memorySolicitudes;
  try {
    const raw = localStorage.getItem(KEY_SOLICITUDES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      memorySolicitudes = parsed;
      return parsed;
    }
    return [];
  } catch (e) {
    return [];
  }
}

export async function saveStoredInformes(informes: any[], replace = false): Promise<boolean> {
  try {
    memoryInformes = informes;
    safeLocalStorageSet(KEY_INFORMES, JSON.stringify(informes));
    await idbSaveAll('informes', informes);
    return await syncToServer('/api/database', { informes, replace });
  } catch (e) {
    console.error('Error saving informes', e);
    return false;
  }
}

export function getStoredInformes(): any[] {
  if (memoryInformes.length > 0) return memoryInformes;
  try {
    const raw = localStorage.getItem(KEY_INFORMES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      memoryInformes = parsed;
      return parsed;
    }
    return [];
  } catch (e) {
    return [];
  }
}

export async function saveStoredAsistencias(asistencias: any[], replace = false): Promise<boolean> {
  try {
    memoryAsistencias = asistencias;
    safeLocalStorageSet(KEY_ASISTENCIAS, JSON.stringify(asistencias));
    await idbSaveAll('asistencias', asistencias);
    return await syncToServer('/api/database', { asistencias, replace });
  } catch (e) {
    console.error('Error saving asistencias', e);
    return false;
  }
}

export function getStoredAsistencias(): any[] {
  if (memoryAsistencias.length > 0) return memoryAsistencias;
  try {
    const raw = localStorage.getItem(KEY_ASISTENCIAS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      memoryAsistencias = parsed;
      return parsed;
    }
    return [];
  } catch (e) {
    return [];
  }
}

export async function saveStoredMetasPoa(metas: MetaPoa[], replace = false): Promise<boolean> {
  try {
    memoryMetasPoa = metas;
    safeLocalStorageSet(KEY_METAS_POA, JSON.stringify(metas));
    await idbSaveAll('metasPoa', metas);
    return await syncToServer('/api/database', { metasPoa: metas, replace });
  } catch (e) {
    console.error('Error saving metas POA', e);
    return false;
  }
}

export function getStoredMetasPoa(): MetaPoa[] {
  if (memoryMetasPoa.length > 0) return memoryMetasPoa;
  try {
    const raw = localStorage.getItem(KEY_METAS_POA);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      memoryMetasPoa = parsed;
      return parsed;
    }
    return [];
  } catch (e) {
    return [];
  }
}

export async function cleanCacheAndForceSync(): Promise<{
  solicitudes: any[];
  informes: any[];
  asistencias: any[];
  funcionarios: any[];
  metasPoa: MetaPoa[];
}> {
  try {
    // Notify server to purge cache and broadcast to all devices
    fetch('/api/cache/clean', { method: 'POST', headers: getAuthHeaders() }).catch(() => {});

    const res = await fetch(`/api/database?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache, no-store', Pragma: 'no-cache', ...getAuthHeaders() },
    });
    if (res.ok) {
      const data = await res.json();
      const freshSolicitudes = Array.isArray(data.solicitudes) ? data.solicitudes : [];
      const freshInformes = Array.isArray(data.informes) ? data.informes : [];
      const freshAsistencias = Array.isArray(data.asistencias) ? data.asistencias : [];
      const freshFuncionarios = Array.isArray(data.funcionarios) ? data.funcionarios : [];
      const freshMetasPoa = Array.isArray(data.metasPoa) ? data.metasPoa : [];

      updateMemoryStorage({
        solicitudes: freshSolicitudes,
        informes: freshInformes,
        asistencias: freshAsistencias,
        funcionarios: freshFuncionarios,
        metasPoa: freshMetasPoa,
      });

      safeLocalStorageSet(KEY_SOLICITUDES, JSON.stringify(freshSolicitudes));
      safeLocalStorageSet(KEY_INFORMES, JSON.stringify(freshInformes));
      safeLocalStorageSet(KEY_ASISTENCIAS, JSON.stringify(freshAsistencias));
      safeLocalStorageSet(KEY_FUNCIONARIOS, JSON.stringify(freshFuncionarios));
      safeLocalStorageSet('tinaquillo_dg_funcionarios', JSON.stringify(freshFuncionarios));
      safeLocalStorageSet(KEY_METAS_POA, JSON.stringify(freshMetasPoa));

      await Promise.all([
        idbSaveAll('solicitudes', freshSolicitudes).catch(() => {}),
        idbSaveAll('informes', freshInformes).catch(() => {}),
        idbSaveAll('asistencias', freshAsistencias).catch(() => {}),
        idbSaveAll('funcionarios', freshFuncionarios).catch(() => {}),
        idbSaveAll('metasPoa', freshMetasPoa).catch(() => {}),
      ]);

      return {
        solicitudes: freshSolicitudes,
        informes: freshInformes,
        asistencias: freshAsistencias,
        funcionarios: freshFuncionarios,
        metasPoa: freshMetasPoa,
      };
    }
    return {
      solicitudes: getStoredSolicitudes(),
      informes: getStoredInformes(),
      asistencias: getStoredAsistencias(),
      funcionarios: getStoredFuncionarios(),
      metasPoa: getStoredMetasPoa(),
    };
  } catch (e) {
    return {
      solicitudes: getStoredSolicitudes(),
      informes: getStoredInformes(),
      asistencias: getStoredAsistencias(),
      funcionarios: getStoredFuncionarios(),
      metasPoa: getStoredMetasPoa(),
    };
  }
}

export function getStoredFuncionarios(): Funcionario[] {
  if (Array.isArray(memoryFuncionarios)) return memoryFuncionarios;
  try {
    const raw = localStorage.getItem('tinaquillo_dg_funcionarios') || localStorage.getItem(KEY_FUNCIONARIOS);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        memoryFuncionarios = parsed;
        return parsed;
      }
    }
    memoryFuncionarios = [];
    return [];
  } catch (e) {
    memoryFuncionarios = [];
    return [];
  }
}

export async function saveStoredFuncionarios(funcionarios: Funcionario[], replace = false): Promise<boolean> {
  try {
    memoryFuncionarios = funcionarios;
    safeLocalStorageSet('tinaquillo_dg_funcionarios', JSON.stringify(funcionarios));
    safeLocalStorageSet(KEY_FUNCIONARIOS, JSON.stringify(funcionarios));
    await idbSaveAll('funcionarios', funcionarios);
    return await syncToServer('/api/database', { funcionarios, replace });
  } catch (e) {
    console.error('Error saving funcionarios', e);
    return false;
  }
}

export function getStoredUserProfiles(): Record<string, any> {
  try {
    const raw = localStorage.getItem(KEY_USER_PROFILES);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function findFuncionarioByDependencia(dependencia: string): Funcionario | null {
  try {
    const funcs = getStoredFuncionarios();
    const target = normalizeString(dependencia);
    return funcs.find((f) => normalizeString(f.dependencia) === target) || null;
  } catch {
    return null;
  }
}

export async function syncFuncionarioToDirectorio(data: Partial<Funcionario>): Promise<boolean> {
  try {
    if (!data.nombresApellidos || !data.dependencia) return false;
    const funcs = getStoredFuncionarios();
    const targetDep = normalizeString(data.dependencia);
    const existingIndex = funcs.findIndex((f) => normalizeString(f.dependencia) === targetDep);

    let updated: Funcionario[];
    if (existingIndex >= 0) {
      updated = [...funcs];
      updated[existingIndex] = {
        ...updated[existingIndex],
        ...data,
        nombresApellidos: data.nombresApellidos,
        dependencia: data.dependencia,
      } as Funcionario;
    } else {
      const newFunc: Funcionario = {
        id: `func-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        nombresApellidos: data.nombresApellidos,
        cedula: data.cedula || '',
        dependencia: data.dependencia,
        cargo: data.cargo || 'DIRECTOR(A)',
        tipoDependencia: (data.tipoDependencia as any) || 'CENTRALIZADA',
        subtipo: (data.subtipo as any) || 'DIRECCION',
        numeroResolucion: data.numeroResolucion,
        fechaResolucion: data.fechaResolucion,
        estado: 'ACTIVO',
      };
      updated = [...funcs, newFunc];
    }
    return await saveStoredFuncionarios(updated, true);
  } catch (e) {
    console.error('Error synchronizing funcionario to directorio:', e);
    return false;
  }
}

export interface BackupSnapshot {
  version: string;
  timestamp: string;
  fechaEmision: string;
  origen: string;
  solicitudes: Solicitud[];
  informes: InformeDependencia[];
  asistencias: RegistroAsistencia[];
  funcionarios: Funcionario[];
  metasPoa: MetaPoa[];
  userProfiles?: Record<string, any>;
}

export function createDriveBackupSnapshot(): BackupSnapshot {
  return {
    version: '2.5.0-ENTERPRISE',
    timestamp: new Date().toISOString(),
    fechaEmision: formatFechaEspanol(new Date().toISOString()),
    origen: 'ALCALDÍA DEL MUNICIPIO AUTÓNOMO TINAQUILLO - DIRECCIÓN GENERAL',
    solicitudes: getStoredSolicitudes(),
    informes: getStoredInformes(),
    asistencias: getStoredAsistencias(),
    funcionarios: getStoredFuncionarios(),
    metasPoa: getStoredMetasPoa(),
    userProfiles: getStoredUserProfiles(),
  };
}

export async function restoreDriveBackup(snapshot: BackupSnapshot): Promise<boolean> {
  try {
    if (!snapshot || !Array.isArray(snapshot.solicitudes) || !Array.isArray(snapshot.informes)) {
      return false;
    }
    const solicitudes = snapshot.solicitudes || [];
    const informes = snapshot.informes || [];
    const asistencias = snapshot.asistencias || [];
    const funcionarios = snapshot.funcionarios || [];
    const metasPoa = snapshot.metasPoa || [];

    await saveStoredSolicitudes(solicitudes, true);
    await saveStoredInformes(informes, true);
    await saveStoredAsistencias(asistencias, true);
    await saveStoredFuncionarios(funcionarios, true);
    await saveStoredMetasPoa(metasPoa, true);

    if (snapshot.userProfiles) {
      safeLocalStorageSet(KEY_USER_PROFILES, JSON.stringify(snapshot.userProfiles));
    }

    await syncToServer('/api/database', {
      solicitudes,
      informes,
      asistencias,
      funcionarios,
      metasPoa,
      replace: true,
    });

    broadcastLiveSync();
    return true;
  } catch (e) {
    console.error('Error restaurando backup snapshot:', e);
    return false;
  }
}

export async function clearAllStoredData(): Promise<void> {
  try {
    memorySolicitudes = [];
    memoryInformes = [];
    memoryAsistencias = [];
    memoryMetasPoa = [];

    safeLocalStorageSet(KEY_SOLICITUDES, '[]');
    safeLocalStorageSet(KEY_INFORMES, '[]');
    safeLocalStorageSet(KEY_ASISTENCIAS, '[]');
    safeLocalStorageSet(KEY_METAS_POA, '[]');

    await Promise.all([
      idbSaveAll('solicitudes', []).catch(() => {}),
      idbSaveAll('informes', []).catch(() => {}),
      idbSaveAll('asistencias', []).catch(() => {}),
      idbSaveAll('metasPoa', []).catch(() => {}),
    ]);

    await syncToServer('/api/database', {
      solicitudes: [],
      informes: [],
      asistencias: [],
      metasPoa: [],
      replace: true,
    }).catch(() => {});

    broadcastLiveSync();
  } catch (e) {
    console.error('Error clearing all stored data:', e);
  }
}

export async function clearAllStoredFuncionarios(): Promise<void> {
  try {
    memoryFuncionarios = [];
    safeLocalStorageSet('tinaquillo_dg_funcionarios', '[]');
    safeLocalStorageSet(KEY_FUNCIONARIOS, '[]');
    await idbSaveAll('funcionarios', []).catch(() => {});
    await authFetch('/api/funcionarios', { method: 'DELETE' }).catch(() => {});
    broadcastLiveSync();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tinaquillo_funcionarios_sync', { detail: [] }));
    }
  } catch (e) {
    console.error('Error clearing funcionarios', e);
  }
}

export async function restoreDefaultFuncionarios(): Promise<Funcionario[]> {
  try {
    memoryFuncionarios = INITIAL_FUNCIONARIOS;
    safeLocalStorageSet('tinaquillo_dg_funcionarios', JSON.stringify(INITIAL_FUNCIONARIOS));
    safeLocalStorageSet(KEY_FUNCIONARIOS, JSON.stringify(INITIAL_FUNCIONARIOS));
    await idbSaveAll('funcionarios', INITIAL_FUNCIONARIOS).catch(() => {});
    await authFetch('/api/funcionarios/restore-defaults', { method: 'POST' }).catch(() => {});
    broadcastLiveSync();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tinaquillo_funcionarios_sync', { detail: INITIAL_FUNCIONARIOS }));
    }
    return INITIAL_FUNCIONARIOS;
  } catch (e) {
    return INITIAL_FUNCIONARIOS;
  }
}

export async function resetToSeedData(): Promise<void> {
  await clearAllStoredData();
}

export function mergeCollectionsById<T extends { id?: string }>(primary: T[], incoming: T[]): T[] {
  const map = new Map<string, T>();
  (primary || []).forEach((item) => {
    if (item && item.id) map.set(item.id, item);
  });
  (incoming || []).forEach((item) => {
    if (item && item.id) map.set(item.id, item);
  });
  return Array.from(map.values());
}

export async function saveSingleMetaPoa(meta: MetaPoa): Promise<{ success: boolean; list: MetaPoa[] }> {
  try {
    const current = getStoredMetasPoa();
    const index = current.findIndex((m) => m.id === meta.id);
    let updated: MetaPoa[];
    if (index >= 0) {
      updated = [...current];
      updated[index] = { ...meta, updatedAt: new Date().toISOString() };
    } else {
      updated = [
        ...current,
        {
          ...meta,
          id: meta.id || `poa-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          createdAt: meta.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
    }
    await saveStoredMetasPoa(updated, true);
    broadcastLiveSync();
    return { success: true, list: updated };
  } catch (e) {
    console.error('Error saving single MetaPoa:', e);
    return { success: false, list: getStoredMetasPoa() };
  }
}

export async function initializePersistentDatabase(): Promise<{
  solicitudes: Solicitud[];
  informes: InformeDependencia[];
  asistencias: RegistroAsistencia[];
  funcionarios: Funcionario[];
  metasPoa: MetaPoa[];
}> {
  try {
    await requestPersistentStorage().catch(() => {});

    // Try fetching from server first
    try {
      const res = await fetch('/api/database', {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        const serverSolicitudes = Array.isArray(data.solicitudes) ? data.solicitudes : [];
        const serverInformes = Array.isArray(data.informes) ? data.informes : [];
        const serverAsistencias = Array.isArray(data.asistencias) ? data.asistencias : [];
        const serverFuncionarios = Array.isArray(data.funcionarios) ? data.funcionarios : [];
        const serverMetas = Array.isArray(data.metasPoa) ? data.metasPoa : [];
        const serverCreds = Array.isArray(data.authCredentials) ? data.authCredentials : [];
        const serverProfiles = data.userProfiles && typeof data.userProfiles === 'object' ? data.userProfiles : {};

        updateMemoryStorage({
          solicitudes: serverSolicitudes,
          informes: serverInformes,
          asistencias: serverAsistencias,
          funcionarios: serverFuncionarios,
          metasPoa: serverMetas,
          authCredentials: serverCreds,
          userProfiles: serverProfiles,
        });

        safeLocalStorageSet(KEY_SOLICITUDES, JSON.stringify(serverSolicitudes));
        safeLocalStorageSet(KEY_INFORMES, JSON.stringify(serverInformes));
        safeLocalStorageSet(KEY_ASISTENCIAS, JSON.stringify(serverAsistencias));
        safeLocalStorageSet(KEY_FUNCIONARIOS, JSON.stringify(serverFuncionarios));
        safeLocalStorageSet(KEY_METAS_POA, JSON.stringify(serverMetas));
        if (serverCreds.length > 0) safeLocalStorageSet(KEY_AUTH_CREDENTIALS, JSON.stringify(serverCreds));
        if (Object.keys(serverProfiles).length > 0) safeLocalStorageSet(KEY_USER_PROFILES, JSON.stringify(serverProfiles));

        await Promise.all([
          idbSaveAll('solicitudes', serverSolicitudes).catch(() => {}),
          idbSaveAll('informes', serverInformes).catch(() => {}),
          idbSaveAll('asistencias', serverAsistencias).catch(() => {}),
          idbSaveAll('funcionarios', serverFuncionarios).catch(() => {}),
          idbSaveAll('metasPoa', serverMetas).catch(() => {}),
          idbSaveAll('authCredentials', serverCreds).catch(() => {}),
        ]);

        return {
          solicitudes: serverSolicitudes,
          informes: serverInformes,
          asistencias: serverAsistencias,
          funcionarios: serverFuncionarios,
          metasPoa: serverMetas,
        };
      }
    } catch (_err) {
      // Offline fallback
    }

    const [idbSols, idbInfs, idbAsis, idbFuncs, idbMetas] = await Promise.all([
      idbGetAll<Solicitud>('solicitudes').catch(() => []),
      idbGetAll<InformeDependencia>('informes').catch(() => []),
      idbGetAll<RegistroAsistencia>('asistencias').catch(() => []),
      idbGetAll<Funcionario>('funcionarios').catch(() => []),
      idbGetAll<MetaPoa>('metasPoa').catch(() => []),
    ]);

    const localSols = getStoredSolicitudes();
    const localInfs = getStoredInformes();
    const localAsis = getStoredAsistencias();
    const localFuncs = getStoredFuncionarios();
    const localMetas = getStoredMetasPoa();

    return {
      solicitudes: idbSols.length >= localSols.length ? idbSols : localSols,
      informes: idbInfs.length >= localInfs.length ? idbInfs : localInfs,
      asistencias: idbAsis.length >= localAsis.length ? idbAsis : localAsis,
      funcionarios: idbFuncs.length >= localFuncs.length ? idbFuncs : localFuncs,
      metasPoa: idbMetas.length >= localMetas.length ? idbMetas : localMetas,
    };
  } catch (e) {
    console.error('Error initializing database:', e);
    return {
      solicitudes: getStoredSolicitudes(),
      informes: getStoredInformes(),
      asistencias: getStoredAsistencias(),
      funcionarios: getStoredFuncionarios(),
      metasPoa: getStoredMetasPoa(),
    };
  }
}
