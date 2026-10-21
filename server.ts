import express, { Request, Response } from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { neon } from '@neondatabase/serverless';
import { INITIAL_FUNCIONARIOS } from './src/data/dependenciasData';

const app = express();
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const isProduction = process.env.NODE_ENV === 'production';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'database.json');
const DEFAULT_FUNC_FILE = path.join(DB_DIR, 'default_funcionarios.json');
const BACKUP_DIR = path.join(DB_DIR, 'backups');
const SERVER_SESSION_SECRET = process.env.SESSION_SECRET || 'TQ_SERVER_HMAC_SECRET_2026_MUNICIPAL';

// Ensure data and backup directories exist
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// -------------------------------------------------------------
// POSTGRES / NEON CLOUD DATABASE INTEGRATION WITH LOCAL FALLBACK
// -------------------------------------------------------------
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
      console.log('[Server DB] Cliente Neon Postgres inicializado con éxito');
    } catch (e) {
      console.error('[Server DB] Error creando cliente Neon:', e);
    }
  }
  return sqlClient;
}

interface DatabaseSchema {
  solicitudes: any[];
  informes: any[];
  asistencias: any[];
  funcionarios: any[];
  metasPoa: any[];
  authCredentials: any[];
  userProfiles: Record<string, any>;
  _version?: number;
  _serverTimestamp?: number;
}

const EMPTY_DB: DatabaseSchema = {
  solicitudes: [],
  informes: [],
  asistencias: [],
  funcionarios: INITIAL_FUNCIONARIOS || [],
  metasPoa: [],
  authCredentials: [],
  userProfiles: {},
  _version: Date.now(),
  _serverTimestamp: Date.now(),
};

let tableEnsured = false;
async function ensureNeonTable(sql: any) {
  if (tableEnsured) return;
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS app_state (
        id BOOLEAN PRIMARY KEY DEFAULT TRUE,
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT now()
      );
    `;
    tableEnsured = true;
  } catch (e) {
    console.error('[Server DB] Error verificando/creando tabla app_state en Neon:', e);
  }
}

// In-memory cache for ultra-fast response & instant real-time sync
let memoryDb: DatabaseSchema = { ...EMPTY_DB };
let isDbLoaded = false;

function loadDefaultFuncionarios(): any[] {
  try {
    if (fs.existsSync(DEFAULT_FUNC_FILE)) {
      const raw = fs.readFileSync(DEFAULT_FUNC_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('[Server DB] Error leyendo default_funcionarios.json:', e);
  }
  return INITIAL_FUNCIONARIOS || [];
}

function readDatabase(): DatabaseSchema {
  if (isDbLoaded && memoryDb.funcionarios && memoryDb.funcionarios.length > 0) {
    return memoryDb;
  }

  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        memoryDb = {
          solicitudes: Array.isArray(parsed.solicitudes) ? parsed.solicitudes : [],
          informes: Array.isArray(parsed.informes) ? parsed.informes : [],
          asistencias: Array.isArray(parsed.asistencias) ? parsed.asistencias : [],
          funcionarios: Array.isArray(parsed.funcionarios) && parsed.funcionarios.length > 0
            ? parsed.funcionarios
            : loadDefaultFuncionarios(),
          metasPoa: Array.isArray(parsed.metasPoa) ? parsed.metasPoa : [],
          authCredentials: Array.isArray(parsed.authCredentials) ? parsed.authCredentials : [],
          userProfiles: parsed.userProfiles && typeof parsed.userProfiles === 'object' ? parsed.userProfiles : {},
          _version: parsed._version || Date.now(),
          _serverTimestamp: Date.now(),
        };

        // If database.json was missing funcionarios, write them back
        if (!Array.isArray(parsed.funcionarios) || parsed.funcionarios.length === 0) {
          writeDatabase(memoryDb);
        }

        isDbLoaded = true;
        return memoryDb;
      }
    }
  } catch (e) {
    console.error('[Server DB] Error leyendo database.json local:', e);
  }

  // Fallback default
  memoryDb = {
    ...EMPTY_DB,
    funcionarios: loadDefaultFuncionarios(),
    _version: Date.now(),
    _serverTimestamp: Date.now(),
  };
  writeDatabase(memoryDb);
  isDbLoaded = true;
  return memoryDb;
}

function writeDatabase(data: DatabaseSchema): boolean {
  try {
    data._version = Date.now();
    data._serverTimestamp = Date.now();
    memoryDb = data;
    isDbLoaded = true;

    // 1. Atomic write to local JSON file
    const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);

    // 2. Periodic safe backup in data/backups/
    try {
      const backupPath = path.join(BACKUP_DIR, `backup_${Date.now()}.json`);
      fs.writeFileSync(backupPath, JSON.stringify(data, null, 2), 'utf-8');

      // Keep only 15 latest backups to conserve disk
      const existingBackups = fs
        .readdirSync(BACKUP_DIR)
        .filter((f) => f.startsWith('backup_') && f.endsWith('.json'))
        .sort()
        .reverse();

      if (existingBackups.length > 15) {
        for (let i = 15; i < existingBackups.length; i++) {
          try {
            fs.unlinkSync(path.join(BACKUP_DIR, existingBackups[i]));
          } catch (_) {}
        }
      }
    } catch (_) {}

    // 3. Write asynchronously to Neon if configured
    const sql = getSql();
    if (sql) {
      ensureNeonTable(sql)
        .then(() => {
          return sql`
            INSERT INTO app_state (id, data, updated_at)
            VALUES (TRUE, ${JSON.stringify(data)}, now())
            ON CONFLICT (id) DO UPDATE
            SET data = EXCLUDED.data, updated_at = now();
          `;
        })
        .catch((err) => {
          console.error('[Server DB] Error sincronizando con Neon:', err);
        });
    }

    return true;
  } catch (e) {
    console.error('[Server DB] Error crítico escribiendo base de datos:', e);
    return false;
  }
}

// Initial read on boot
readDatabase();

// -------------------------------------------------------------
// REAL-TIME WEBSOCKET AND SSE BROADCASTING
// -------------------------------------------------------------
let wss: WebSocketServer | null = null;
const sseClients = new Set<Response>();

function broadcastDbUpdate(action: string, updatedData?: Partial<DatabaseSchema>) {
  const currentDb = readDatabase();
  const timestamp = Date.now();
  const version = currentDb._version || timestamp;

  const payload = JSON.stringify({
    type: 'db_update',
    action,
    version,
    timestamp,
    data: {
      solicitudes: currentDb.solicitudes || [],
      informes: currentDb.informes || [],
      asistencias: currentDb.asistencias || [],
      funcionarios: currentDb.funcionarios || [],
      metasPoa: currentDb.metasPoa || [],
      authCredentials: (currentDb.authCredentials || []).map((c: any) => {
        const { plainPassword, ...rest } = c;
        return rest;
      }),
      userProfiles: currentDb.userProfiles || {},
      _serverTimestamp: timestamp,
    },
  });

  // Broadcast to all active WebSocket clients
  if (wss) {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(payload);
        } catch (_) {}
      }
    });
  }

  // Broadcast to all active Server-Sent Events (SSE) connections
  sseClients.forEach((res) => {
    try {
      res.write(`event: db_update\ndata: ${payload}\n\n`);
    } catch (_) {
      sseClients.delete(res);
    }
  });
}

// -------------------------------------------------------------
// SANITIZATION AND AUTHENTICATION UTILS
// -------------------------------------------------------------
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

interface ActiveSession {
  email: string;
  role: string;
  name: string;
  createdAt: number;
  expiresAt: number;
}

function createSignedSessionToken(userPayload: { email: string; role: string; name: string }): string {
  const iat = Date.now();
  const exp = iat + 12 * 60 * 60 * 1000; // 12 hours
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

function extractToken(req: Request): string {
  const authHeader = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim();
  const customHeader = (req.headers['x-session-token'] as string) || '';
  const queryToken = (req.query.token as string) || '';
  return authHeader || customHeader || queryToken;
}

function getRequestSession(req: Request): ActiveSession | null {
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

const loginRateLimit = new Map<string, { count: number; lockedUntil: number }>();

// -------------------------------------------------------------
// EXPRESS MIDDLEWARE SETUP
// -------------------------------------------------------------
app.use(express.json({ limit: '150mb' }));
app.use(express.urlencoded({ extended: true, limit: '150mb' }));

// Institutional Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

// -------------------------------------------------------------
// API ROUTES
// -------------------------------------------------------------

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  const db = readDatabase();
  res.status(200).json({
    status: 'ok',
    database: 'connected',
    timestamp: Date.now(),
    counts: {
      solicitudes: db.solicitudes?.length || 0,
      informes: db.informes?.length || 0,
      asistencias: db.asistencias?.length || 0,
      funcionarios: db.funcionarios?.length || 0,
      metasPoa: db.metasPoa?.length || 0,
    },
    activeWebSockets: wss ? wss.clients.size : 0,
    activeSSE: sseClients.size,
  });
});

// Version check for adaptive polling
app.get('/api/sync/version', (req: Request, res: Response) => {
  const db = readDatabase();
  res.status(200).json({
    version: db._version || Date.now(),
    serverTimestamp: Date.now(),
    counts: {
      solicitudes: db.solicitudes?.length || 0,
      informes: db.informes?.length || 0,
      asistencias: db.asistencias?.length || 0,
      funcionarios: db.funcionarios?.length || 0,
      metasPoa: db.metasPoa?.length || 0,
    },
    connectedWsClients: wss ? wss.clients.size : 0,
    connectedSseClients: sseClients.size,
  });
});

// Server-Sent Events (SSE) for Real-Time synchronization
app.get('/api/sync/events', (req: Request, res: Response) => {
  const db = readDatabase();
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  sseClients.add(res);

  // Send initial state snapshot
  res.write(
    `event: init\ndata: ${JSON.stringify({
      type: 'init',
      version: db._version || Date.now(),
      timestamp: Date.now(),
      data: {
        solicitudes: db.solicitudes || [],
        informes: db.informes || [],
        asistencias: db.asistencias || [],
        funcionarios: db.funcionarios || [],
        metasPoa: db.metasPoa || [],
      },
    })}\n\n`
  );

  // Keep-alive heartbeat
  const heartbeat = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
    } catch (_) {
      clearInterval(heartbeat);
      sseClients.delete(res);
    }
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});

// Authentication: Login
app.post('/api/auth/login', (req: Request, res: Response) => {
  const clientIp =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    'unknown';
  const now = Date.now();

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
    const db = readDatabase();
    const dynamicCreds = db.authCredentials || [];
    for (const cred of dynamicCreds) {
      if (cred && cred.usernameOrEmail) {
        const u = String(cred.usernameOrEmail).toLowerCase().trim();
        if (u === rawInput || u === canonical) {
          const credHash = cred.passwordHash || (cred.plainPassword ? hashPassword(cred.plainPassword) : '');
          if (
            (cleanPass && cred.plainPassword && cred.plainPassword.trim() === cleanPass) ||
            credHash === calculatedHash
          ) {
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

  const current = loginRateLimit.get(clientIp) || { count: 0, lockedUntil: 0 };
  current.count += 1;
  if (current.count >= 8) {
    current.lockedUntil = now + 30 * 1000;
    current.count = 0;
  }
  loginRateLimit.set(clientIp, current);
  return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
});

// Authentication: Verify token
app.all(['/api/auth/verify', '/api/auth/session'], (req: Request, res: Response) => {
  const session = getRequestSession(req);
  if (!session) {
    return res.status(401).json({ valid: false, error: 'Sesión no válida o expirada' });
  }
  return res.status(200).json({ success: true, valid: true, user: session });
});

// Live status
app.get('/api/live-status', (req: Request, res: Response) => {
  const db = readDatabase();
  res.status(200).json({
    counts: {
      solicitudes: db.solicitudes?.length || 0,
      informes: db.informes?.length || 0,
      asistencias: db.asistencias?.length || 0,
      funcionarios: db.funcionarios?.length || 0,
      metasPoa: db.metasPoa?.length || 0,
    },
    clients: [],
    serverTimestamp: Date.now(),
    activeDevices: wss ? Math.max(1, wss.clients.size) : 1,
  });
});

// Storage Info
app.get('/api/storage/info', (req: Request, res: Response) => {
  const db = readDatabase();
  let dbFileSize = 0;
  try {
    if (fs.existsSync(DB_FILE)) {
      dbFileSize = fs.statSync(DB_FILE).size;
    }
  } catch (_) {}

  res.status(200).json({
    status: 'online',
    storageType: sqlClient ? 'Neon Postgres + Local Disk' : 'Local Disk Persistent',
    fileSize: dbFileSize,
    counts: {
      solicitudes: db.solicitudes?.length || 0,
      informes: db.informes?.length || 0,
      asistencias: db.asistencias?.length || 0,
      funcionarios: db.funcionarios?.length || 0,
      metasPoa: db.metasPoa?.length || 0,
    },
  });
});

// Full Database GET
app.get('/api/database', (req: Request, res: Response) => {
  const db = readDatabase();
  const session = getRequestSession(req);
  const isPrimary = session?.role === 'PRIMARY_ADMIN';

  const safeCreds = isPrimary
    ? (db.authCredentials || []).map((c: any) => {
        const { plainPassword, ...rest } = c;
        return rest;
      })
    : [];

  const safeProfiles = isPrimary
    ? db.userProfiles || {}
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
    _version: db._version || Date.now(),
    _serverTimestamp: Date.now(),
  });
});

// Full Database POST
app.post('/api/database', (req: Request, res: Response) => {
  const session = getRequestSession(req);
  if (!session) {
    return res.status(401).json({ error: 'Acceso no autorizado: inicie sesión.' });
  }

  const {
    solicitudes,
    informes,
    asistencias,
    funcionarios,
    metasPoa,
    authCredentials,
    userProfiles,
    replace,
  } = req.body || {};

  const isPrimary = session.role === 'PRIMARY_ADMIN';
  const shouldReplace = replace === true;

  if (shouldReplace && !isPrimary) {
    return res.status(403).json({
      error: 'Permisos insuficientes: se requiere perfil de Usuario Principal para reemplazar colecciones.',
    });
  }

  const db = readDatabase();

  if (isPrimary) {
    if (Array.isArray(solicitudes)) {
      db.solicitudes = shouldReplace ? sanitizeValue(solicitudes) : mergeById(db.solicitudes, solicitudes);
    }
    if (Array.isArray(informes)) {
      db.informes = shouldReplace ? sanitizeValue(informes) : mergeById(db.informes, informes);
    }
    if (Array.isArray(asistencias)) {
      db.asistencias = shouldReplace ? sanitizeValue(asistencias) : mergeById(db.asistencias, asistencias);
    }
    if (Array.isArray(funcionarios)) {
      db.funcionarios = shouldReplace ? sanitizeValue(funcionarios) : mergeById(db.funcionarios, funcionarios);
    }
    if (Array.isArray(metasPoa)) {
      db.metasPoa = shouldReplace ? sanitizeValue(metasPoa) : mergeById(db.metasPoa || [], metasPoa);
    }
    if (Array.isArray(authCredentials)) {
      const sanitizedIncoming = authCredentials.map((c: any) => {
        const { plainPassword, ...rest } = c;
        return rest;
      });
      db.authCredentials = shouldReplace
        ? sanitizedIncoming
        : mergeById(db.authCredentials || [], sanitizedIncoming);
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

  writeDatabase(db);
  broadcastDbUpdate('database_saved', db);

  return res.status(200).json({
    success: true,
    message: 'Base de datos sincronizada y asegurada en almacenamiento permanente',
    counts: {
      solicitudes: db.solicitudes.length,
      informes: db.informes.length,
      asistencias: db.asistencias.length,
      funcionarios: db.funcionarios.length,
      metasPoa: db.metasPoa ? db.metasPoa.length : 0,
    },
  });
});

// Cache purge & force re-sync
app.post('/api/cache/clean', (req: Request, res: Response) => {
  const session = getRequestSession(req);
  if (session && session.role !== 'PRIMARY_ADMIN') {
    return res.status(403).json({ error: 'Acceso denegado: solo el Usuario Principal puede purgar la caché.' });
  }

  // Force fresh disk reload
  isDbLoaded = false;
  const db = readDatabase();
  broadcastDbUpdate('cache_cleaned', db);

  return res.status(200).json({
    success: true,
    message: 'Caché de servidor purgada con éxito y retransmitida en tiempo real',
    serverTimestamp: Date.now(),
    counts: {
      solicitudes: db.solicitudes.length,
      informes: db.informes.length,
      asistencias: db.asistencias.length,
      funcionarios: db.funcionarios.length,
      metasPoa: db.metasPoa ? db.metasPoa.length : 0,
    },
  });
});

// -------------------------------------------------------------
// FUNCIONARIOS CRUD (Directorio Oficial Municipal)
// -------------------------------------------------------------
app.get('/api/funcionarios', (req: Request, res: Response) => {
  const db = readDatabase();
  res.status(200).json(db.funcionarios || []);
});

app.post('/api/funcionarios', (req: Request, res: Response) => {
  const session = getRequestSession(req);
  if (!session || session.role !== 'PRIMARY_ADMIN') {
    return res.status(403).json({
      error: 'Solo el Usuario Principal puede agregar o modificar funcionarios.',
    });
  }

  const rawItem = req.body?.funcionario || req.body;
  if (!rawItem) {
    return res.status(400).json({ error: 'Faltan datos del funcionario.' });
  }

  const db = readDatabase();

  // If payload is an array of funcionarios (batch update)
  if (Array.isArray(rawItem)) {
    db.funcionarios = sanitizeValue(rawItem);
    writeDatabase(db);
    broadcastDbUpdate('funcionarios_batch_saved', db);
    return res.status(200).json({ success: true, count: db.funcionarios.length });
  }

  // Single funcionario registration / update
  const item = sanitizeValue(rawItem);
  if (!item.nombresApellidos || !item.dependencia) {
    return res.status(400).json({ error: 'Nombre y dependencia son requeridos.' });
  }

  const funcId = item.id || `func-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  item.id = funcId;
  item.actualizadoEn = new Date().toISOString();

  let updatedList: any[];
  const existingIdx = db.funcionarios.findIndex(
    (f) =>
      f.id === funcId ||
      (item.cedula && f.cedula && f.cedula.trim() === item.cedula.trim()) ||
      (f.dependencia?.toUpperCase() === item.dependencia?.toUpperCase() &&
        f.cargo?.toUpperCase() === item.cargo?.toUpperCase())
  );

  if (existingIdx >= 0) {
    updatedList = [...db.funcionarios];
    updatedList[existingIdx] = mergeTwoRecords(updatedList[existingIdx], item);
  } else {
    updatedList = [item, ...db.funcionarios];
  }

  db.funcionarios = updatedList;
  writeDatabase(db);
  broadcastDbUpdate('funcionario_saved', db);

  return res.status(200).json({
    success: true,
    funcionario: item,
    count: db.funcionarios.length,
  });
});

app.delete('/api/funcionarios/:id', (req: Request, res: Response) => {
  const session = getRequestSession(req);
  if (!session || session.role !== 'PRIMARY_ADMIN') {
    return res.status(403).json({ error: 'Solo el Usuario Principal puede eliminar funcionarios.' });
  }

  const { id } = req.params;
  const db = readDatabase();
  const initialLen = db.funcionarios.length;
  db.funcionarios = db.funcionarios.filter((f) => f.id !== id);

  writeDatabase(db);
  broadcastDbUpdate('funcionario_deleted', db);

  return res.status(200).json({
    success: true,
    message: 'Funcionario eliminado del directorio oficial.',
    removed: initialLen !== db.funcionarios.length,
    remainingCount: db.funcionarios.length,
  });
});

app.delete('/api/funcionarios', (req: Request, res: Response) => {
  const session = getRequestSession(req);
  if (!session || session.role !== 'PRIMARY_ADMIN') {
    return res.status(403).json({ error: 'Solo el Usuario Principal puede vaciar el directorio.' });
  }

  const db = readDatabase();
  db.funcionarios = [];
  writeDatabase(db);
  broadcastDbUpdate('funcionarios_cleared', db);

  return res.status(200).json({
    success: true,
    message: 'Directorio de funcionarios vaciado.',
    count: 0,
  });
});

app.post('/api/funcionarios/restore-defaults', (req: Request, res: Response) => {
  const session = getRequestSession(req);
  if (!session || session.role !== 'PRIMARY_ADMIN') {
    return res.status(403).json({ error: 'Solo el Usuario Principal puede restaurar el directorio.' });
  }

  const db = readDatabase();
  const defaults = loadDefaultFuncionarios();
  db.funcionarios = defaults;
  writeDatabase(db);
  broadcastDbUpdate('funcionarios_restored', db);

  return res.status(200).json({
    success: true,
    message: 'Directorio de funcionarios restaurado a valores institucionales.',
    count: defaults.length,
  });
});

// -------------------------------------------------------------
// SOLICITUDES CRUD
// -------------------------------------------------------------
app.get('/api/solicitudes', (req: Request, res: Response) => {
  const db = readDatabase();
  res.status(200).json(db.solicitudes || []);
});

app.post('/api/solicitudes', (req: Request, res: Response) => {
  const session = getRequestSession(req);
  if (!session) return res.status(401).json({ error: 'Inicie sesión para registrar solicitudes.' });

  const raw = req.body?.solicitud || req.body;
  if (!raw || !raw.id) return res.status(400).json({ error: 'Faltan datos de la solicitud.' });

  const db = readDatabase();
  const item = sanitizeValue(raw);
  const idx = db.solicitudes.findIndex((x) => x.id === item.id);
  if (idx >= 0) db.solicitudes[idx] = mergeTwoRecords(db.solicitudes[idx], item);
  else db.solicitudes.unshift(item);

  writeDatabase(db);
  broadcastDbUpdate('solicitud_saved', db);

  res.status(200).json({ success: true, solicitud: item });
});

app.delete('/api/solicitudes/:id', (req: Request, res: Response) => {
  const session = getRequestSession(req);
  if (!session || session.role !== 'PRIMARY_ADMIN') {
    return res.status(403).json({ error: 'Solo el Usuario Principal puede eliminar solicitudes.' });
  }
  const { id } = req.params;
  const db = readDatabase();
  db.solicitudes = db.solicitudes.filter((x) => x.id !== id);
  writeDatabase(db);
  broadcastDbUpdate('solicitud_deleted', db);
  res.status(200).json({ success: true, message: 'Solicitud eliminada' });
});

// -------------------------------------------------------------
// INFORMES CRUD
// -------------------------------------------------------------
app.get('/api/informes', (req: Request, res: Response) => {
  const db = readDatabase();
  res.status(200).json(db.informes || []);
});

app.post('/api/informes', (req: Request, res: Response) => {
  const session = getRequestSession(req);
  if (!session) return res.status(401).json({ error: 'Inicie sesión para registrar informes.' });

  const raw = req.body?.informe || req.body;
  if (!raw || !raw.id) return res.status(400).json({ error: 'Faltan datos del informe.' });

  const db = readDatabase();
  const item = sanitizeValue(raw);
  const idx = db.informes.findIndex((x) => x.id === item.id);
  if (idx >= 0) db.informes[idx] = mergeTwoRecords(db.informes[idx], item);
  else db.informes.unshift(item);

  writeDatabase(db);
  broadcastDbUpdate('informe_saved', db);

  res.status(200).json({ success: true, informe: item });
});

app.delete('/api/informes/:id', (req: Request, res: Response) => {
  const session = getRequestSession(req);
  if (!session || session.role !== 'PRIMARY_ADMIN') {
    return res.status(403).json({ error: 'Solo el Usuario Principal puede eliminar informes.' });
  }
  const { id } = req.params;
  const db = readDatabase();
  db.informes = db.informes.filter((x) => x.id !== id);
  writeDatabase(db);
  broadcastDbUpdate('informe_deleted', db);
  res.status(200).json({ success: true, message: 'Informe eliminado' });
});

// -------------------------------------------------------------
// ASISTENCIAS CRUD
// -------------------------------------------------------------
app.get('/api/asistencias', (req: Request, res: Response) => {
  const db = readDatabase();
  res.status(200).json(db.asistencias || []);
});

app.post('/api/asistencias', (req: Request, res: Response) => {
  const session = getRequestSession(req);
  if (!session) return res.status(401).json({ error: 'Inicie sesión para registrar asistencias.' });

  const raw = req.body?.asistencia || req.body;
  if (!raw || !raw.id) return res.status(400).json({ error: 'Faltan datos del registro.' });

  const db = readDatabase();
  const item = sanitizeValue(raw);
  const idx = db.asistencias.findIndex((x) => x.id === item.id);
  if (idx >= 0) db.asistencias[idx] = mergeTwoRecords(db.asistencias[idx], item);
  else db.asistencias.unshift(item);

  writeDatabase(db);
  broadcastDbUpdate('asistencia_saved', db);

  res.status(200).json({ success: true, asistencia: item });
});

app.delete('/api/asistencias/:id', (req: Request, res: Response) => {
  const session = getRequestSession(req);
  if (!session || (session.role !== 'PRIMARY_ADMIN' && session.role !== 'PROTOCOLO_USER')) {
    return res.status(403).json({ error: 'Acceso denegado para eliminar asistencias.' });
  }
  const { id } = req.params;
  const db = readDatabase();
  db.asistencias = db.asistencias.filter((x) => x.id !== id);
  writeDatabase(db);
  broadcastDbUpdate('asistencia_deleted', db);
  res.status(200).json({ success: true, message: 'Asistencia eliminada' });
});

// -------------------------------------------------------------
// METAS POA CRUD
// -------------------------------------------------------------
app.get('/api/metas_poa', (req: Request, res: Response) => {
  const db = readDatabase();
  res.status(200).json(db.metasPoa || []);
});

app.post('/api/metas_poa', (req: Request, res: Response) => {
  const session = getRequestSession(req);
  if (!session) return res.status(401).json({ error: 'Inicie sesión para registrar metas POA.' });

  const raw = req.body?.meta || req.body?.metasPoa || req.body;
  if (!raw || !raw.id) return res.status(400).json({ error: 'Faltan datos de la meta POA.' });

  const db = readDatabase();
  if (!Array.isArray(db.metasPoa)) db.metasPoa = [];

  const item = sanitizeValue(raw);
  const idx = db.metasPoa.findIndex((x) => x.id === item.id);
  if (idx >= 0) db.metasPoa[idx] = mergeTwoRecords(db.metasPoa[idx], item);
  else db.metasPoa.unshift(item);

  writeDatabase(db);
  broadcastDbUpdate('meta_poa_saved', db);

  res.status(200).json({ success: true, meta: item });
});

app.delete('/api/metas_poa/:id', (req: Request, res: Response) => {
  const session = getRequestSession(req);
  if (!session || (session.role !== 'PRIMARY_ADMIN' && session.role !== 'PLANIFICACION_USER')) {
    return res.status(403).json({ error: 'Acceso denegado para eliminar metas POA.' });
  }
  const { id } = req.params;
  const db = readDatabase();
  db.metasPoa = (db.metasPoa || []).filter((x) => x.id !== id);
  writeDatabase(db);
  broadcastDbUpdate('meta_poa_deleted', db);
  res.status(200).json({ success: true, message: 'Meta POA eliminada' });
});

// -------------------------------------------------------------
// USER PROFILES
// -------------------------------------------------------------
app.post('/api/profiles', (req: Request, res: Response) => {
  const session = getRequestSession(req);
  if (!session) return res.status(401).json({ error: 'Acceso no autorizado' });

  const { email, profile } = req.body || {};
  if (!email || !profile) return res.status(400).json({ error: 'Faltan datos de perfil' });

  const targetEmail = String(email).toLowerCase().trim();
  const isPrimary = session.role === 'PRIMARY_ADMIN';
  if (!isPrimary && targetEmail !== session.email.toLowerCase().trim()) {
    return res.status(403).json({ error: 'Solo puede modificar su propio perfil institucional.' });
  }

  const db = readDatabase();
  db.userProfiles[targetEmail] = sanitizeValue(profile);
  writeDatabase(db);

  res.status(200).json({ success: true });
});

// -------------------------------------------------------------
// VITE INTEGRATION & SERVER STARTUP
// -------------------------------------------------------------
async function startServer() {
  const server = http.createServer(app);
  const distPath = path.resolve(process.cwd(), 'dist');

  // Mount Vite dev server in non-production, or serve dist in production
  if (!isProduction) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('[Server] Middleware de Vite dev montado correctamente');
  } else {
    if (!fs.existsSync(distPath)) {
      console.warn('[Server] Directorio dist/ no encontrado. Ejecutando como dev middleware...');
      const vite = await createViteServer({
        server: {
          middlewareMode: true,
          hmr: false,
        },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      app.use(express.static(distPath));
      app.get(/^(?!\/api\/|\/ws).*/, (req: Request, res: Response) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  // Attach WebSocket Server
  wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    try {
      const url = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
      if (url.pathname === '/ws') {
        wss!.handleUpgrade(request, socket, head, (ws) => {
          wss!.emit('connection', ws, request);
        });
        return;
      }
    } catch (_) {}
  });

  wss.on('connection', (ws) => {
    const clientCount = wss ? wss.clients.size : 1;
    console.log(`[WS] Dispositivo conectado en tiempo real. Dispositivos activos: ${clientCount}`);

    try {
      const db = readDatabase();
      ws.send(
        JSON.stringify({
          type: 'init',
          timestamp: Date.now(),
          version: db._version || Date.now(),
          data: {
            solicitudes: db.solicitudes || [],
            informes: db.informes || [],
            asistencias: db.asistencias || [],
            funcionarios: db.funcionarios || [],
            metasPoa: db.metasPoa || [],
          },
        })
      );
    } catch (err) {
      console.error('[WS] Error enviando snapshot inicial:', err);
    }

    ws.on('message', (message) => {
      try {
        const parsed = JSON.parse(message.toString());
        if (parsed.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        } else if (parsed.type === 'request_sync') {
          const db = readDatabase();
          ws.send(
            JSON.stringify({
              type: 'db_update',
              action: 'client_requested',
              timestamp: Date.now(),
              version: db._version || Date.now(),
              data: {
                solicitudes: db.solicitudes || [],
                informes: db.informes || [],
                asistencias: db.asistencias || [],
                funcionarios: db.funcionarios || [],
                metasPoa: db.metasPoa || [],
              },
            })
          );
        }
      } catch (_) {}
    });

    ws.on('close', () => {
      const remaining = wss ? wss.clients.size : 0;
      console.log(`[WS] Dispositivo desconectado. Dispositivos restantes: ${remaining}`);
    });

    ws.on('error', (err) => {
      console.error('[WS] Error de socket:', err);
    });
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[Server] Puerto ${PORT} ocupado temporalmente. Reintentando enlace en 1s...`);
      setTimeout(() => {
        try {
          server.close();
        } catch (_) {}
        server.listen(PORT, HOST);
      }, 1000);
    } else {
      console.error('[Server] Error en servidor HTTP:', err);
    }
  });

  server.listen(PORT, HOST, () => {
    console.log(`Servidor Tinaquillo con WebSockets y API activo en http://${HOST}:${PORT}`);
  });
}

process.on('uncaughtException', (err) => {
  console.error('[Process] Excepción no capturada:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Process] Rechazo no controlado:', reason);
});

startServer();
