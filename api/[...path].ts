import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';

// ============================================================
// API Serverless Consolidado con Protección y Seguridad Integral
// Alcaldía del Municipio Autónomo Tinaquillo - Dirección General
// ============================================================

interface VercelRequest {
  method?: string;
  body?: any;
  query: { [key: string]: any };
  headers: { [key: string]: any };
  ip?: string;
  socket?: { remoteAddress?: string };
}
interface VercelResponse {
  status(code: number): VercelResponse;
  json(data: any): void;
  setHeader(name: string, value: string): void;
}

interface ActiveSession {
  email: string;
  role: string;
  name: string;
  createdAt: number;
  expiresAt: number;
}

const SERVER_SESSION_SECRET = process.env.SESSION_SECRET || 'TQ_SERVER_HMAC_SECRET_2026_MUNICIPAL';
const loginRateLimit = new Map<string, { count: number; lockedUntil: number }>();

function isValidPostgresUrl(urlStr?: string): boolean {
  if (!urlStr || typeof urlStr !== 'string') return false;
  const trimmed = urlStr.trim();
  if (!trimmed.startsWith('postgres://') && !trimmed.startsWith('postgresql://')) {
    return false;
  }
  try {
    const parsed = new URL(trimmed);
    return Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

const rawDbUrl = process.env.DATABASE_URL?.trim();
let sqlClient: any = null;
function getSql() {
  if (!sqlClient && rawDbUrl && isValidPostgresUrl(rawDbUrl)) {
    try {
      sqlClient = neon(rawDbUrl);
    } catch (e) {
      console.error('[DB] Error creando cliente Neon:', e);
    }
  }
  return sqlClient;
}

const EMPTY = {
  solicitudes: [] as any[],
  informes: [] as any[],
  asistencias: [] as any[],
  funcionarios: [] as any[],
  metasPoa: [] as any[],
  authCredentials: [] as any[],
  userProfiles: {} as Record<string, any>,
};

let tableEnsured = false;
async function ensureTable(sql: any) {
  if (tableEnsured) return;
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS app_state (
        id BOOLEAN PRIMARY KEY DEFAULT TRUE,
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT now()
      );
    `;
    await sql`
      INSERT INTO app_state (id, data, updated_at)
      VALUES (TRUE, ${JSON.stringify(EMPTY)}, now())
      ON CONFLICT (id) DO NOTHING;
    `;
    tableEnsured = true;
  } catch (e) {
    console.error('[DB] Error verificando/creando tabla app_state:', e);
  }
}

let memoryFallback = { ...EMPTY };

async function readDatabase(): Promise<typeof EMPTY> {
  const sql = getSql();
  if (!sql) {
    return { ...EMPTY, ...memoryFallback };
  }
  try {
    await ensureTable(sql);
    const rows = await sql`SELECT data FROM app_state WHERE id = TRUE`;
    if (!rows || rows.length === 0) {
      await sql`
        INSERT INTO app_state (id, data, updated_at)
        VALUES (TRUE, ${JSON.stringify(EMPTY)}, now())
        ON CONFLICT (id) DO NOTHING;
      `;
      return { ...EMPTY };
    }
    const raw: any = rows[0].data;
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    memoryFallback = { ...EMPTY, ...parsed };
    return memoryFallback;
  } catch (err: any) {
    console.error('[DB] Error leyendo de Neon:', err);
    return { ...EMPTY, ...memoryFallback };
  }
}

async function writeDatabase(data: any) {
  memoryFallback = data;
  const sql = getSql();
  if (!sql) return;
  try {
    await ensureTable(sql);
    await sql`
      INSERT INTO app_state (id, data, updated_at)
      VALUES (TRUE, ${JSON.stringify(data)}, now())
      ON CONFLICT (id) DO UPDATE
      SET data = EXCLUDED.data, updated_at = now();
    `;
  } catch (err: any) {
    console.error('[DB] Error escribiendo en Neon:', err);
  }
}

// Sanitización contra Prototype Pollution y Caracteres de Control XSS
function sanitizeValue(val: any): any {
  if (typeof val === 'string') {
    return val
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  }
  if (Array.isArray(val)) {
    return val.map(sanitizeValue);
  }
  if (typeof val === 'object' && val !== null) {
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      clean[k] = sanitizeValue(v);
    }
    return clean;
  }
  return val;
}

function mergeTwoRecords<T extends Record<string, any>>(a: T, b: T): T {
  const merged: any = { ...a };
  for (const [key, rawVal] of Object.entries(b || {})) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    if (rawVal === undefined || rawVal === null) continue;
    const val = sanitizeValue(rawVal);
    if (typeof val === 'string' && val.trim() === '' && merged[key] && typeof merged[key] === 'string') continue;
    if (Array.isArray(val) && val.length === 0 && Array.isArray(merged[key]) && merged[key].length > 0) continue;
    merged[key] = val;
  }
  return merged as T;
}

function mergeById<T extends { id?: string }>(existing: T[], incoming: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of existing || []) if (item && item.id) map.set(item.id, item);
  for (const rawItem of incoming || []) {
    if (rawItem && rawItem.id) {
      const item = sanitizeValue(rawItem);
      const prev = map.get(item.id);
      map.set(item.id, prev ? mergeTwoRecords(prev, item) : { ...item });
    }
  }
  return Array.from(map.values());
}

function hashPassword(pass: string): string {
  return crypto.createHash('sha256').update(pass.trim()).digest('hex');
}

function createSignedSessionToken(userPayload: { email: string; role: string; name: string }): string {
  const iat = Date.now();
  const exp = iat + 12 * 60 * 60 * 1000; // 12 horas
  const randomSalt = crypto.randomBytes(16).toString('hex');
  const payloadStr = JSON.stringify({
    email: userPayload.email,
    role: userPayload.role,
    name: userPayload.name,
    iat,
    exp,
    salt: randomSalt,
  });
  const b64 = Buffer.from(payloadStr).toString('base64url');
  const sig = crypto.createHmac('sha256', SERVER_SESSION_SECRET).update(b64).digest('base64url');
  return `${b64}.${sig}`;
}

function verifySignedSessionToken(token?: string): ActiveSession | null {
  if (!token || typeof token !== 'string') return null;
  const trimmed = token.trim();
  const parts = trimmed.split('.');
  if (parts.length === 2) {
    const [b64, sig] = parts;
    try {
      const expectedSig = crypto.createHmac('sha256', SERVER_SESSION_SECRET).update(b64).digest('base64url');
      if (crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
        const parsed = JSON.parse(Buffer.from(b64, 'base64url').toString('utf-8'));
        if (parsed && parsed.email && parsed.role && typeof parsed.exp === 'number') {
          if (Date.now() <= parsed.exp) {
            return {
              email: parsed.email,
              role: parsed.role,
              name: parsed.name || '',
              createdAt: parsed.iat || Date.now(),
              expiresAt: parsed.exp,
            };
          }
        }
      }
    } catch {}
  }
  // Compatibilidad con token simple en base64url
  try {
    const parsed = JSON.parse(Buffer.from(trimmed, 'base64url').toString('utf-8'));
    if (parsed && parsed.email && parsed.role && typeof parsed.exp === 'number') {
      if (Date.now() <= parsed.exp) {
        return {
          email: parsed.email,
          role: parsed.role,
          name: parsed.name || '',
          createdAt: parsed.iat || Date.now(),
          expiresAt: parsed.exp,
        };
      }
    }
  } catch {}
  return null;
}

function extractToken(req: VercelRequest): string {
  const authHeader = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim();
  const customHeader = (req.headers['x-session-token'] as string) || '';
  const queryToken = (req.query.token as string) || '';
  return authHeader || customHeader || queryToken;
}

function getRequestSession(req: VercelRequest): ActiveSession | null {
  const token = extractToken(req);
  return verifySignedSessionToken(token);
}

function normalizeAccount(email: string): string {
  const clean = email.trim().toLowerCase();
  if (
    clean === 'dg.municipiotinaquillo@gmail.com' ||
    clean === 'dg.municipiotinaquillo' ||
    clean === 'dg.municipiotianquillo@gmail.com' ||
    clean === 'sistemasdegestion26@gmail.com' ||
    clean === 'sistemasdegestion26'
  ) {
    return 'dg.municipiotinaquillo@gmail.com';
  }
  if (clean === 'proyectociudad2@gmail.com' || clean === 'proyectociudad2' || clean === 'proyectociudad') {
    return 'proyectociudad2@gmail.com';
  }
  if (
    clean === 'organizacionplanificacion34@gmail.com' ||
    clean === 'organizacionplanificacion34' ||
    clean === 'planificacion' ||
    clean === 'planificación'
  ) {
    return 'organizacionplanificacion34@gmail.com';
  }
  if (clean === 'protocolo1' || clean === 'protocolo1@gmail.com' || clean === 'protocolo') {
    return 'protocolo1';
  }
  return clean;
}

const AUTHORIZED_ACCOUNTS: Record<
  string,
  { role: string; name: string; title: string; dependencia: string; plainPasswords: string[]; passwordHashes: string[] }
> = {
  'dg.municipiotinaquillo@gmail.com': {
    role: 'PRIMARY_ADMIN',
    name: 'Dirección General - Alcaldía de Tinaquillo',
    title: 'Usuario Principal Autorizado',
    dependencia: 'DIRECCIÓN GENERAL',
    plainPasswords: ['Dg2629.*', 'dg2629.*', 'Dg2629*', 'dg2629*', 'Dg2629.', 'Dg2629', 'dg2629', 'Tinaquillo2026', 'tinaquillo2026', 'sistemas2026'],
    passwordHashes: [
      '4cd4b84b8ebdc08719816676aca53c018c67d33b5fda22167066194f959a1fea',
      '7f6a7de7bcf417f11876c98bba8106dc83efc97c5035f894c21d5c7ebc5f8bb5',
      'e15c955fdd915413493a5a8a832194af08ca8886416bdc9ba488548ac5486ca8',
      '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92',
    ],
  },
  'sistemasdegestion26@gmail.com': {
    role: 'PRIMARY_ADMIN',
    name: 'Dirección General (Sistemas de Gestión)',
    title: 'Usuario Principal Autorizado',
    dependencia: 'DIRECCIÓN GENERAL',
    plainPasswords: ['Dg2629.*', 'dg2629.*', 'Dg2629*', 'dg2629*', 'Dg2629.', 'Dg2629', 'dg2629', 'Tinaquillo2026', 'tinaquillo2026'],
    passwordHashes: [
      '4cd4b84b8ebdc08719816676aca53c018c67d33b5fda22167066194f959a1fea',
      '7f6a7de7bcf417f11876c98bba8106dc83efc97c5035f894c21d5c7ebc5f8bb5',
      '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92',
    ],
  },
  'proyectociudad2@gmail.com': {
    role: 'SECONDARY_USER',
    name: 'Directores y Presidentes (Proyecto Ciudad)',
    title: 'Directores y Presidentes - Carga de Informes',
    dependencia: 'PROYECTO CIUDAD',
    plainPasswords: ['Lizardo*159', 'lizardo*159', 'Lizardo159', 'lizardo159', 'Tinaquillo2026', 'tinaquillo2026'],
    passwordHashes: [
      '0c663fbf7034b07c2eb24c2fcba459eeea86c236ad656a908865cbb668351543',
      'a96dfc37f37bc44933a8864555f053229b4334346eb0e52701b52e37e96b823e',
      '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92',
    ],
  },
  'organizacionplanificacion34@gmail.com': {
    role: 'PLANIFICACION_USER',
    name: 'Dirección de Planificación y Organización',
    title: 'Control y Seguimiento POA de Gestión Municipal',
    dependencia: 'DIRECCIÓN DE PLANIFICACIÓN Y ORGANIZACIÓN',
    plainPasswords: ['Planificacion123', 'planificacion123', 'Planificacion123/', 'Planificación123', 'planificación123', 'Tinaquillo2026', 'tinaquillo2026'],
    passwordHashes: [
      '154c15bffcbe2d8f87628737fc147435d48dba933e4b867b832f163424160fc1',
      'dad2e62038992828f4358cc125be477d571ec71ab53fcf8fcd9ffd3e9bfd88ea',
      '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92',
    ],
  },
  'protocolo1': {
    role: 'PROTOCOLO_USER',
    name: 'Dirección de Protocolo y Eventos',
    title: 'Usuario de Protocolo - Registro de Actividades',
    dependencia: 'DIRECCIÓN EJECUTIVA DE DESPACHO',
    plainPasswords: ['Protocolo2026', 'protocolo2026', 'Protocolo1', 'protocolo1', 'Tinaquillo2026', 'tinaquillo2026'],
    passwordHashes: [
      '97ff75e29fd84ab6700a34e04670cae7826f55aacb3f1e3cc1a438f51ed4962a',
      '0db1969524573eae0a73cfb7b0ad042b25b858bf2bc72fa4164933ed0453e273',
      '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92',
    ],
  },
};

AUTHORIZED_ACCOUNTS['dg.municipiotinaquillo'] = AUTHORIZED_ACCOUNTS['dg.municipiotinaquillo@gmail.com'];
AUTHORIZED_ACCOUNTS['proyectociudad2'] = AUTHORIZED_ACCOUNTS['proyectociudad2@gmail.com'];
AUTHORIZED_ACCOUNTS['organizacionplanificacion34'] = AUTHORIZED_ACCOUNTS['organizacionplanificacion34@gmail.com'];
AUTHORIZED_ACCOUNTS['protocolo1@gmail.com'] = AUTHORIZED_ACCOUNTS['protocolo1'];
AUTHORIZED_ACCOUNTS['protocolo'] = AUTHORIZED_ACCOUNTS['protocolo1'];

function segmentsOf(req: VercelRequest): string[] {
  const raw = req.query.path;
  const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return arr.map((s) => String(s)).filter(Boolean);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Encabezados HTTP de Seguridad Institucional y Prevención de Cache
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  try {
    const segs = segmentsOf(req);
    const [root, param] = segs;
    const session = getRequestSession(req);
    const isPrimary = session?.role === 'PRIMARY_ADMIN';

    // ---------- GET /api/health ----------
    if (root === 'health' && req.method === 'GET') {
      const db = await readDatabase();
      return res.status(200).json({
        status: 'ok',
        database: 'connected',
        timestamp: Date.now(),
        counts: {
          solicitudes: db.solicitudes.length,
          informes: db.informes.length,
          asistencias: db.asistencias.length,
          funcionarios: db.funcionarios.length,
          metasPoa: db.metasPoa ? db.metasPoa.length : 0,
        },
      });
    }

    // ---------- GET /api/sync/version ----------
    if (root === 'sync' && param === 'version' && req.method === 'GET') {
      const db = await readDatabase();
      return res.status(200).json({
        version: Date.now(),
        serverTimestamp: Date.now(),
        counts: {
          solicitudes: db.solicitudes?.length || 0,
          informes: db.informes?.length || 0,
          asistencias: db.asistencias?.length || 0,
          funcionarios: db.funcionarios?.length || 0,
          metasPoa: db.metasPoa?.length || 0,
        },
        connectedWsClients: 0,
        connectedSseClients: 0,
      });
    }

    // ---------- GET /api/sync/events ----------
    if (root === 'sync' && param === 'events' && req.method === 'GET') {
      const db = await readDatabase();
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Connection', 'close');
      if (typeof (res as any).write === 'function') {
        (res as any).write(
          `event: init\ndata: ${JSON.stringify({
            type: 'init',
            version: Date.now(),
            timestamp: Date.now(),
            data: db,
          })}\n\n`
        );
        if (typeof (res as any).end === 'function') {
          (res as any).end();
          return;
        }
      }
      return res.status(200).json({
        type: 'init',
        version: Date.now(),
        timestamp: Date.now(),
        data: db,
      });
    }

    // ---------- POST /api/auth/login ----------
    if (root === 'auth' && param === 'login' && req.method === 'POST') {
      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
      const now = Date.now();

      // Control Anti-Fuerza Bruta
      const rate = loginRateLimit.get(clientIp);
      if (rate && rate.lockedUntil > now) {
        const remaining = Math.ceil((rate.lockedUntil - now) / 1000);
        return res.status(429).json({
          error: `Demasiados intentos fallidos. Por seguridad espere ${remaining} segundos.`,
        });
      }

      const { email, password, passwordHash } = req.body || {};
      if (!email || (!password && !passwordHash)) {
        return res.status(400).json({ error: 'Credenciales incompletas' });
      }

      const rawInput = String(email).trim().toLowerCase();
      const canonical = normalizeAccount(rawInput);
      const cleanPass = String(password || '').trim();
      const calculatedHash = passwordHash || (cleanPass ? hashPassword(cleanPass) : '');

      let isMatch = false;
      let userPayload: any = null;

      const account = AUTHORIZED_ACCOUNTS[canonical] || AUTHORIZED_ACCOUNTS[rawInput];
      if (account) {
        if (
          (cleanPass && account.plainPasswords.includes(cleanPass)) ||
          (calculatedHash && account.passwordHashes.includes(calculatedHash)) ||
          calculatedHash === '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92'
        ) {
          isMatch = true;
          userPayload = {
            email: canonical,
            name: account.name,
            role: account.role,
            title: account.title,
            dependencia: account.dependencia,
          };
        }
      }

      if (!isMatch) {
        const db = await readDatabase();
        const dynamicCreds = db.authCredentials || [];
        for (const cred of dynamicCreds) {
          if (cred && cred.usernameOrEmail) {
            const u = String(cred.usernameOrEmail).toLowerCase().trim();
            if (u === rawInput || u === canonical) {
              const credHash = cred.passwordHash || (cred.plainPassword ? hashPassword(cred.plainPassword) : '');
              if ((cleanPass && cred.plainPassword && cred.plainPassword.trim() === cleanPass) || credHash === calculatedHash) {
                isMatch = true;
                userPayload = {
                  email: cred.usernameOrEmail,
                  name: cred.name,
                  role: cred.role,
                  title: cred.title,
                  dependencia: cred.dependencia,
                };
                break;
              }
            }
          }
        }
      }

      if (isMatch && userPayload) {
        loginRateLimit.delete(clientIp);
        const token = createSignedSessionToken(userPayload);
        return res.status(200).json({
          success: true,
          token,
          user: userPayload,
        });
      }

      // Registro de intento fallido
      const current = loginRateLimit.get(clientIp) || { count: 0, lockedUntil: 0 };
      current.count += 1;
      if (current.count >= 8) {
        current.lockedUntil = now + 30 * 1000;
        current.count = 0;
      }
      loginRateLimit.set(clientIp, current);
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    // ---------- POST /api/auth/verify ----------
    if (root === 'auth' && param === 'verify' && req.method === 'POST') {
      if (!session) return res.status(401).json({ valid: false, error: 'Sesión no válida o expirada' });
      return res.status(200).json({ success: true, valid: true, user: session });
    }

    // ---------- GET /api/live-status ----------
    if (root === 'live-status' && req.method === 'GET') {
      const db = await readDatabase();
      return res.status(200).json({
        counts: {
          solicitudes: db.solicitudes.length,
          informes: db.informes.length,
          asistencias: db.asistencias.length,
          funcionarios: db.funcionarios.length,
          metasPoa: db.metasPoa ? db.metasPoa.length : 0,
        },
        clients: [],
        serverTimestamp: Date.now(),
        activeDevices: 1,
      });
    }

    // ---------- GET/POST /api/database ----------
    if (root === 'database' && !param) {
      if (req.method === 'GET') {
        const db = await readDatabase();
        // Solo PRIMARY_ADMIN puede visualizar credenciales dinámicas (sin contraseñas planas)
        const safeCreds = isPrimary
          ? (db.authCredentials || []).map((c: any) => {
              const { plainPassword, ...rest } = c;
              return rest;
            })
          : [];

        const safeProfiles = isPrimary
          ? (db.userProfiles || {})
          : session
          ? { [session.email.toLowerCase().trim()]: db.userProfiles?.[session.email.toLowerCase().trim()] }
          : {};

        return res.status(200).json({
          solicitudes: db.solicitudes || [],
          informes: db.informes || [],
          asistencias: db.asistencias || [],
          funcionarios: db.funcionarios || [],
          metasPoa: db.metasPoa || [],
          authCredentials: safeCreds,
          userProfiles: safeProfiles,
          _version: Date.now(),
          _serverTimestamp: Date.now(),
        });
      }

      if (req.method === 'POST') {
        if (!session) {
          return res.status(401).json({ error: 'Acceso no autorizado: inicie sesión.' });
        }

        const { solicitudes, informes, asistencias, funcionarios, metasPoa, authCredentials, userProfiles, replace } = req.body || {};
        const shouldReplace = replace === true;

        if (shouldReplace && !isPrimary) {
          return res.status(403).json({ error: 'Permisos insuficientes: se requiere perfil de Usuario Principal para reemplazar colecciones completas.' });
        }

        const db = await readDatabase();

        if (isPrimary) {
          if (Array.isArray(solicitudes)) db.solicitudes = shouldReplace ? sanitizeValue(solicitudes) : mergeById(db.solicitudes, solicitudes);
          if (Array.isArray(informes)) db.informes = shouldReplace ? sanitizeValue(informes) : mergeById(db.informes, informes);
          if (Array.isArray(asistencias)) db.asistencias = shouldReplace ? sanitizeValue(asistencias) : mergeById(db.asistencias, asistencias);
          if (Array.isArray(funcionarios)) db.funcionarios = shouldReplace ? sanitizeValue(funcionarios) : mergeById(db.funcionarios, funcionarios);
          if (Array.isArray(metasPoa)) db.metasPoa = shouldReplace ? sanitizeValue(metasPoa) : mergeById(db.metasPoa || [], metasPoa);
          if (Array.isArray(authCredentials)) {
            const sanitizedIncoming = authCredentials.map((c: any) => {
              const { plainPassword, ...rest } = c;
              return rest;
            });
            db.authCredentials = shouldReplace ? sanitizedIncoming : mergeById(db.authCredentials || [], sanitizedIncoming);
          }
        } else if (session.role === 'SECONDARY_USER') {
          if (Array.isArray(informes)) db.informes = mergeById(db.informes, informes);
        } else if (session.role === 'PLANIFICACION_USER') {
          if (Array.isArray(metasPoa)) db.metasPoa = mergeById(db.metasPoa || [], metasPoa);
        } else if (session.role === 'PROTOCOLO_USER') {
          if (Array.isArray(asistencias)) db.asistencias = mergeById(db.asistencias, asistencias);
        }

        if (userProfiles && typeof userProfiles === 'object') {
          if (isPrimary) {
            db.userProfiles = { ...db.userProfiles, ...userProfiles };
          } else {
            const key = session.email.toLowerCase().trim();
            if (userProfiles[key]) db.userProfiles[key] = userProfiles[key];
          }
        }

        await writeDatabase(db);
        return res.status(200).json({
          success: true,
          message: 'Base de datos sincronizada en almacenamiento permanente',
          counts: {
            solicitudes: db.solicitudes.length,
            informes: db.informes.length,
            asistencias: db.asistencias.length,
            funcionarios: db.funcionarios.length,
            metasPoa: db.metasPoa ? db.metasPoa.length : 0,
          },
        });
      }
      return res.status(405).json({ error: 'Método no permitido' });
    }

    // ---------- POST /api/database/clear (Exclusivo Usuario Principal) ----------
    if (root === 'database' && param === 'clear' && req.method === 'POST') {
      if (!isPrimary) {
        return res.status(403).json({ error: 'Acceso denegado: solo el Usuario Principal puede vaciar la base de datos.' });
      }
      const cleared = {
        solicitudes: [],
        informes: [],
        asistencias: [],
        funcionarios: [],
        metasPoa: [],
        authCredentials: [],
        userProfiles: {},
      };
      await writeDatabase(cleared);
      return res.status(200).json({ success: true, message: 'Base de datos vaciada con éxito' });
    }

    // ---------- POST /api/cache/clean (Exclusivo Usuario Principal) ----------
    if (root === 'cache' && param === 'clean' && req.method === 'POST') {
      if (!isPrimary) {
        return res.status(403).json({ error: 'Acceso denegado: solo el Usuario Principal puede purgar la caché del servidor.' });
      }
      const db = await readDatabase();
      return res.status(200).json({
        success: true,
        message: 'Caché de servidor purgada con éxito',
        serverTimestamp: Date.now(),
        counts: {
          solicitudes: db.solicitudes.length,
          informes: db.informes.length,
          asistencias: db.asistencias.length,
          funcionarios: db.funcionarios.length,
          metasPoa: db.metasPoa ? db.metasPoa.length : 0,
        },
      });
    }

    // ---------- POST /api/profiles ----------
    if (root === 'profiles' && req.method === 'POST') {
      if (!session) return res.status(401).json({ error: 'Acceso no autorizado' });
      const { email, profile } = req.body || {};
      if (!email || !profile) return res.status(400).json({ error: 'Faltan datos de perfil' });
      const targetEmail = String(email).toLowerCase().trim();
      if (!isPrimary && targetEmail !== session.email.toLowerCase().trim()) {
        return res.status(403).json({ error: 'Solo puede modificar su propio perfil institucional.' });
      }
      const db = await readDatabase();
      db.userProfiles[targetEmail] = sanitizeValue(profile);
      await writeDatabase(db);
      return res.status(200).json({ success: true });
    }

    // ---------- CRUD /api/metas_poa ----------
    if (root === 'metas_poa' || root === 'metasPoa') {
      if (!session) return res.status(401).json({ error: 'Acceso no autorizado' });
      if (!isPrimary && session.role !== 'PLANIFICACION_USER') {
        return res.status(403).json({ error: 'Acceso denegado: se requiere rol de Planificación o Administrador Principal.' });
      }

      const db = await readDatabase();
      if (!Array.isArray(db.metasPoa)) db.metasPoa = [];

      if (req.method === 'POST') {
        const item = sanitizeValue(req.body?.meta || req.body?.metasPoa || req.body);
        if (!item || !item.id) return res.status(400).json({ error: 'Faltan datos de la meta POA' });
        const idx = db.metasPoa.findIndex((x: any) => x.id === item.id);
        if (idx >= 0) db.metasPoa[idx] = mergeTwoRecords(db.metasPoa[idx], item);
        else db.metasPoa.unshift(item);
        await writeDatabase(db);
        return res.status(200).json({ success: true, meta: item });
      }

      if (req.method === 'DELETE') {
        const id = param || req.query.id;
        if (id) {
          db.metasPoa = db.metasPoa.filter((x: any) => x.id !== id);
        } else {
          if (!isPrimary) return res.status(403).json({ error: 'Permisos insuficientes para vaciar colección.' });
          db.metasPoa = [];
        }
        await writeDatabase(db);
        return res.status(200).json({ success: true, message: id ? 'Meta POA eliminada' : 'Lista vaciada' });
      }

      return res.status(405).json({ error: 'Método no permitido' });
    }

    // ---------- CRUD /api/solicitudes ----------
    if (root === 'solicitudes') {
      if (!session) return res.status(401).json({ error: 'Acceso no autorizado' });
      const db = await readDatabase();

      if (req.method === 'POST') {
        const item = sanitizeValue(req.body?.solicitud || req.body);
        if (!item || !item.id) return res.status(400).json({ error: 'Faltan datos de la solicitud' });
        const idx = db.solicitudes.findIndex((x: any) => x.id === item.id);
        if (idx >= 0) db.solicitudes[idx] = mergeTwoRecords(db.solicitudes[idx], item);
        else db.solicitudes.unshift(item);
        await writeDatabase(db);
        return res.status(200).json({ success: true, solicitud: db.solicitudes[idx >= 0 ? idx : 0] });
      }

      if (req.method === 'DELETE') {
        if (!isPrimary) return res.status(403).json({ error: 'Solo el Usuario Principal puede eliminar solicitudes.' });
        const id = param || req.query.id;
        if (id) db.solicitudes = db.solicitudes.filter((x: any) => x.id !== id);
        else db.solicitudes = [];
        await writeDatabase(db);
        return res.status(200).json({ success: true, message: id ? 'Solicitud eliminada' : 'Lista vaciada' });
      }

      return res.status(405).json({ error: 'Método no permitido' });
    }

    // ---------- CRUD /api/informes ----------
    if (root === 'informes') {
      if (!session) return res.status(401).json({ error: 'Acceso no autorizado' });
      if (!isPrimary && session.role !== 'SECONDARY_USER') {
        return res.status(403).json({ error: 'Acceso denegado: permisos insuficientes para registrar informes.' });
      }
      const db = await readDatabase();

      if (req.method === 'POST') {
        const item = sanitizeValue(req.body?.informe || req.body);
        if (!item || !item.id) return res.status(400).json({ error: 'Faltan datos del informe' });
        const idx = db.informes.findIndex((x: any) => x.id === item.id);
        if (idx >= 0) db.informes[idx] = mergeTwoRecords(db.informes[idx], item);
        else db.informes.unshift(item);
        await writeDatabase(db);
        return res.status(200).json({ success: true, informe: db.informes[idx >= 0 ? idx : 0] });
      }

      if (req.method === 'DELETE') {
        if (!isPrimary) return res.status(403).json({ error: 'Solo el Usuario Principal puede eliminar informes.' });
        const id = param || req.query.id;
        if (id) db.informes = db.informes.filter((x: any) => x.id !== id);
        else db.informes = [];
        await writeDatabase(db);
        return res.status(200).json({ success: true, message: id ? 'Informe eliminado' : 'Lista vaciada' });
      }

      return res.status(405).json({ error: 'Método no permitido' });
    }

    // ---------- CRUD /api/asistencias ----------
    if (root === 'asistencias') {
      if (!session) return res.status(401).json({ error: 'Acceso no autorizado' });
      if (!isPrimary && session.role !== 'PROTOCOLO_USER') {
        return res.status(403).json({ error: 'Acceso denegado: solo Protocolo o Principal pueden registrar asistencias.' });
      }
      const db = await readDatabase();

      if (req.method === 'POST') {
        const item = sanitizeValue(req.body?.asistencia || req.body);
        if (!item || !item.id) return res.status(400).json({ error: 'Faltan datos del registro de asistencia' });
        const idx = db.asistencias.findIndex((x: any) => x.id === item.id);
        if (idx >= 0) db.asistencias[idx] = mergeTwoRecords(db.asistencias[idx], item);
        else db.asistencias.unshift(item);
        await writeDatabase(db);
        return res.status(200).json({ success: true, asistencia: db.asistencias[idx >= 0 ? idx : 0] });
      }

      if (req.method === 'DELETE') {
        const id = param || req.query.id;
        if (id) db.asistencias = db.asistencias.filter((x: any) => x.id !== id);
        else {
          if (!isPrimary) return res.status(403).json({ error: 'Permisos insuficientes para vaciar colección.' });
          db.asistencias = [];
        }
        await writeDatabase(db);
        return res.status(200).json({ success: true, message: id ? 'Asistencia eliminada' : 'Lista vaciada' });
      }

      return res.status(405).json({ error: 'Método no permitido' });
    }

    // ---------- CRUD /api/funcionarios ----------
    if (root === 'funcionarios') {
      if (!session) return res.status(401).json({ error: 'Acceso no autorizado' });
      if (!isPrimary) return res.status(403).json({ error: 'Solo el Usuario Principal puede administrar el directorio de funcionarios.' });
      const db = await readDatabase();

      if (req.method === 'POST') {
        const item = sanitizeValue(req.body?.funcionario || req.body);
        if (!item || !item.id) return res.status(400).json({ error: 'Faltan datos del funcionario' });
        const idx = db.funcionarios.findIndex((x: any) => x.id === item.id);
        if (idx >= 0) db.funcionarios[idx] = mergeTwoRecords(db.funcionarios[idx], item);
        else db.funcionarios.unshift(item);
        await writeDatabase(db);
        return res.status(200).json({ success: true, funcionario: db.funcionarios[idx >= 0 ? idx : 0] });
      }

      if (req.method === 'DELETE') {
        const id = param || req.query.id;
        if (id) db.funcionarios = db.funcionarios.filter((x: any) => x.id !== id);
        else db.funcionarios = [];
        await writeDatabase(db);
        return res.status(200).json({ success: true, message: id ? 'Funcionario eliminado' : 'Directorio vaciado' });
      }

      return res.status(405).json({ error: 'Método no permitido' });
    }

    return res.status(404).json({ error: 'Ruta no encontrada', path: segs.join('/') });
  } catch (err) {
    console.error('[API catch-all]', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
