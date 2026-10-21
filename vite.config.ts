import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';

function silenceViteWebsocketPlugin(): Plugin {
  const errorSuppressScript = `
    (function() {
      try {
        if (typeof window !== 'undefined' && window.fetch) {
          var originalFetch = window.fetch;
          var desc = Object.getOwnPropertyDescriptor(window, 'fetch') || Object.getOwnPropertyDescriptor(Object.getPrototypeOf(window), 'fetch');
          if (desc && !desc.writable && !desc.set) {
            try {
              Object.defineProperty(window, 'fetch', {
                get: function() { return originalFetch; },
                set: function(fn) { originalFetch = fn; },
                configurable: true,
                enumerable: true
              });
            } catch (e) {}
          }
        }
      } catch (e) {}

      function isBenign(msg) {
        if (!msg) return false;
        var str = String(msg).toLowerCase();
        return (
          str.indexOf('websocket') !== -1 ||
          str.indexOf('[vite]') !== -1 ||
          str.indexOf('closed without opened') !== -1 ||
          str.indexOf('cerrado sin haber abierto') !== -1 ||
          str.indexOf('cerrado sin abrirse') !== -1 ||
          str.indexOf('failed to connect to websocket') !== -1 ||
          str.indexOf('cannot set property fetch') !== -1 ||
          str.indexOf('which has only a getter') !== -1
        );
      }
      var origError = console.error;
      console.error = function() {
        var full = Array.prototype.slice.call(arguments).map(function(a) {
          return String(a && (a.message || a.stack || a));
        }).join(' ');
        if (isBenign(full)) return;
        return origError.apply(console, arguments);
      };
      var origWarn = console.warn;
      console.warn = function() {
        var full = Array.prototype.slice.call(arguments).map(function(a) {
          return String(a && (a.message || a.stack || a));
        }).join(' ');
        if (isBenign(full)) return;
        return origWarn.apply(console, arguments);
      };
      window.addEventListener('unhandledrejection', function(event) {
        var reason = event && (event.reason || event);
        var msg = typeof reason === 'string' ? reason : (reason && (reason.message || reason.stack || reason.description)) || '';
        if (isBenign(msg)) {
          event.preventDefault();
          if (event.stopImmediatePropagation) event.stopImmediatePropagation();
          if (event.stopPropagation) event.stopPropagation();
          return true;
        }
      }, true);
      window.addEventListener('error', function(event) {
        var msg = (event && (event.message || (event.error && (event.error.message || event.error.stack)))) || '';
        if (isBenign(msg)) {
          event.preventDefault();
          if (event.stopImmediatePropagation) event.stopImmediatePropagation();
          if (event.stopPropagation) event.stopPropagation();
          return true;
        }
      }, true);
    })();
  `;

  return {
    name: 'silence-vite-websocket',
    transformIndexHtml: {
      order: 'pre',
      handler() {
        return [
          {
            tag: 'script',
            attrs: { type: 'text/javascript' },
            children: errorSuppressScript,
            injectTo: 'head-prepend',
          },
        ];
      },
    },
    transform(code, id) {
      if (id.includes('@vite/client') || id.includes('client.mjs')) {
        return code
          .replace(/throw e;/g, '/* silenced */')
          .replace(
            /reject\(new Error\(["']WebSocket closed without opened\.?["']\)\);/g,
            'resolve(); return;'
          )
          .replace(
            /console\.error\(\s*`\[vite\] failed to connect to websocket/g,
            'console.debug(`[vite] failed to connect to websocket'
          )
          .replace(/console\.error\(\s*"\[vite\]"/g, 'console.debug("[vite]"');
      }
      return null;
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [silenceViteWebsocketPlugin(), react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      strictPort: false,
      watch: null,
    },
    preview: {
      host: '0.0.0.0',
      port: 4173,
    },
    build: {
      sourcemap: false,
      minify: 'esbuild' as const,
      cssMinify: true,
      reportCompressedSize: false,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            icons: ['lucide-react'],
            pdf: ['jspdf'],
            xlsx: ['xlsx'],
          },
        },
      },
    },
    esbuild: {
      legalComments: 'none' as 'none',
      drop: (process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : []) as ('console' | 'debugger')[],
    },
  };
});
