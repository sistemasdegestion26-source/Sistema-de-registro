import express from 'express';
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
const DB_FILE = path.join(process.cwd(), 'data', 'database.json');
const isProduction = process.env.NODE_ENV === 'production';

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

// ... rest of the file unchanged ...

async function startServer() {
  const server = http.createServer(app);
  const distPath = path.resolve(process.cwd(), 'dist');

  if (!isProduction) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    if (!fs.existsSync(distPath)) {
      console.error('[Server] Build de producción no encontrado en dist/. Ejecuta: npm run build');
    }
    app.use(express.static(distPath));
    app.get(/^(?!\/api\/|\/ws).*/, (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

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
    } catch (e) {
      // Ignored: other upgrade events allowed through
    }
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
      } catch (err) {}
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
        server.listen(PORT, '0.0.0.0');
      }, 1000);
    } else {
      console.error('[Server] Error en servidor HTTP:', err);
    }
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor Tinaquillo con WebSockets y API en http://0.0.0.0:${PORT}`);
  });
}

process.on('uncaughtException', (err) => {
  console.error('[Process] Excepción no capturada:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Process] Rechazo no controlado:', reason);
});

startServer();
