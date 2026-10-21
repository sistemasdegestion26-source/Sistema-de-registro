import React, { useState, useEffect } from 'react';
import { ShieldCheck, Lock, Mail, Eye, EyeOff, AlertCircle, Shield, Clock, User } from 'lucide-react';
import { AppUser } from '../types';
import {
  sha256,
  getLoginRateLimitStatus,
  recordFailedLoginAttempt,
  resetLoginRateLimit,
} from '../utils/security';
import {
  initializePersistentDatabase,
  saveStoredUser,
  safeLocalStorageSet,
  getStoredCredentials,
  KEY_SESSION_TOKEN,
} from '../utils/storage';

interface LoginProps {
  onLoginSuccess: (user: AppUser) => void;
}

const PRINCIPAL_USERS = [
  'dg.municipiotinaquillo@gmail.com',
  'dg.municipiotinaquillo',
  'dg.municipiotianquillo@gmail.com',
  'dg.municipiotianquillo',
  'sistemasdegestion26@gmail.com',
  'sistemasdegestion26',
  'dg',
  'direccion general',
  'dirección general',
];

const PRINCIPAL_HASHES = new Set([
  '4cd4b84b8ebdc08719816676aca53c018c67d33b5fda22167066194f959a1fea',
  '7f6a7de7bcf417f11876c98bba8106dc83efc97c5035f894c21d5c7ebc5f8bb5',
  '72c2d72c4de44c5a299410a0587ac6e78db43d1e031724f2b5db49e78b2b8729',
  'ac4413aaa536a1e5fb8bde520364016233855648a5d830e234853ebce0626193',
  'da1a8cf6cf0ca7224c6e470f0e36dbde8c572e48ce2facd4fe9452afb70f3f63',
  'c9660afa5f9664eec8062f0d84ee3cc192ae0f8d39144447cb7d3345f32caa7e',
  'd57a668921137a9acb7f0f8cf6feb6f2639151bf55813ba5cd47135b94244cb5',
  'e15c955fdd915413493a5a8a832194af08ca8886416bdc9ba488548ac5486ca8',
  '87ae303f96cc01e235892ed61e17fe88af68e153cdfd177d408af54c362e96ee',
  '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92',
]);

const SECONDARY_USERS = ['proyectociudad2@gmail.com', 'proyectociudad2', 'proyectociudad', 'proyecto ciudad'];
const SECONDARY_HASHES = new Set([
  '0c663fbf7034b07c2eb24c2fcba459eeea86c236ad656a908865cbb668351543',
  'a96dfc37f37bc44933a8864555f053229b4334346eb0e52701b52e37e96b823e',
  '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92',
]);

const PLANIFICACION_USERS = [
  'organizacionplanificacion34@gmail.com',
  'organizacionplanificacion34',
  'planificacion',
  'planificación',
  'organizacion',
  'organización',
];
const PLANIFICACION_HASHES = new Set([
  '154c15bffcbe2d8f87628737fc147435d48dba933e4b867b832f163424160fc1',
  'dad2e62038992828f4358cc125be477d571ec71ab53fcf8fcd9ffd3e9bfd88ea',
  '696773c11aeb30ff4bfeb03e031a32bde2620701847bc0f0d32bf21211ef05e8',
  'd9070add226d8bfce57ac4f1792f53dfdbb2f626b34b50c4868faac3a433dcc5',
  '45631800f545ea962e29c1ffb4f5ea9315557cd1814173637c843a24a2fb0d2f',
  '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92',
]);

const PROTOCOLO_USERS = ['protocolo1', 'protocolo1@gmail.com', 'protocolo', 'despacho'];
const PROTOCOLO_HASHES = new Set([
  '97ff75e29fd84ab6700a34e04670cae7826f55aacb3f1e3cc1a438f51ed4962a',
  '0db1969524573eae0a73cfb7b0ad042b25b858bf2bc72fa4164933ed0453e273',
  '03c5711dabadb21a9b59d4fe3e194a7cdda5bfefa272ec4708f41f840fd0fac9',
  '3d28c864863c045009d78197fd4a4447da3f507cd7a1333f4e56ec7458c0553f',
  '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92',
]);

function verifyOfficialCredentialsByHash(u: string, passHash: string, cleanPass: string): AppUser | null {
  if (PRINCIPAL_USERS.includes(u) && PRINCIPAL_HASHES.has(passHash)) {
    return {
      email: 'dg.municipiotinaquillo@gmail.com',
      name: 'Dirección General - Alcaldía de Tinaquillo',
      role: 'PRIMARY_ADMIN',
      title: 'Usuario Principal Autorizado',
      dependencia: 'DIRECCIÓN GENERAL',
    };
  }

  if (SECONDARY_USERS.includes(u) && SECONDARY_HASHES.has(passHash)) {
    return {
      email: 'proyectociudad2@gmail.com',
      name: 'Directores y Presidentes (Proyecto Ciudad)',
      role: 'SECONDARY_USER',
      title: 'Directores y Presidentes - Carga de Informes',
      dependencia: 'PROYECTO CIUDAD',
    };
  }

  if (PLANIFICACION_USERS.includes(u) && PLANIFICACION_HASHES.has(passHash)) {
    return {
      email: 'organizacionplanificacion34@gmail.com',
      name: 'Dirección de Planificación y Organización',
      role: 'PLANIFICACION_USER',
      title: 'Control y Seguimiento POA de Gestión Municipal',
      dependencia: 'DIRECCIÓN DE PLANIFICACIÓN Y ORGANIZACIÓN',
    };
  }

  if (PROTOCOLO_USERS.includes(u) && PROTOCOLO_HASHES.has(passHash)) {
    return {
      email: 'protocolo1',
      name: 'Dirección de Protocolo y Eventos',
      role: 'PROTOCOLO_USER',
      title: 'Usuario de Protocolo - Registro de Actividades',
      dependencia: 'DIRECCIÓN EJECUTIVA DE DESPACHO',
    };
  }

  try {
    const creds = getStoredCredentials();
    for (const cred of creds) {
      if (cred && cred.usernameOrEmail && cred.usernameOrEmail.toLowerCase().trim() === u) {
        if (cred.passwordHash === passHash || (cred.plainPassword && cred.plainPassword.trim() === cleanPass)) {
          return {
            email: cred.usernameOrEmail,
            name: cred.name,
            role: cred.role,
            title: cred.title,
            dependencia: cred.dependencia,
          };
        }
      }
    }
  } catch (e) {}

  return null;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState<number>(0);

  // Sync latest credentials & rate limit from server on mount for cross-device support
  useEffect(() => {
    initializePersistentDatabase().catch(() => {});

    const updateRateLimit = () => {
      const status = getLoginRateLimitStatus();
      setLockoutSeconds(status.lockoutSeconds);
    };

    updateRateLimit();
    const interval = setInterval(updateRateLimit, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleResetLockout = () => {
    resetLoginRateLimit();
    setLockoutSeconds(0);
    setError(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    setError(null);
    setIsLoading(true);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = password.trim();
    let localMatch: AppUser | null = null;

    try {
      const passHash = await sha256(cleanPass);

      // Check if entered credentials match valid official records
      localMatch = verifyOfficialCredentialsByHash(cleanEmail, passHash, cleanPass);
      if (localMatch) {
        resetLoginRateLimit();
        setLockoutSeconds(0);
      } else {
        const rateStatus = getLoginRateLimitStatus();
        if (rateStatus.isLocked) {
          setError(`Demasiados intentos fallidos. Por seguridad espere ${rateStatus.lockoutSeconds} segundos.`);
          setIsLoading(false);
          return;
        }
      }

      // Try server-side cryptographic authentication first
      let serverSucceeded = false;
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: cleanEmail,
            password: cleanPass,
            passwordHash: passHash,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.user) {
            resetLoginRateLimit();
            if (data.token) {
              safeLocalStorageSet(KEY_SESSION_TOKEN, data.token);
            }
            await saveStoredUser(data.user, data.token);
            await initializePersistentDatabase();
            setIsLoading(false);
            onLoginSuccess(data.user);
            return;
          }
        } else if (res.status === 429 && !localMatch) {
          const errData = await res.json().catch(() => ({}));
          setError(errData.error || 'Demasiados intentos fallidos. Por seguridad espere un momento.');
          setIsLoading(false);
          return;
        }
      } catch (_fetchErr) {
        // Network or proxy latency, fallback to local match if valid
      }

      // If server route succeeded earlier, it returned. If not, check localMatch:
      if (localMatch) {
        resetLoginRateLimit();
        await saveStoredUser(localMatch);
        await initializePersistentDatabase().catch(() => {});
        setIsLoading(false);
        onLoginSuccess(localMatch);
        return;
      }

      // Record failed attempt in persistent storage for anti-brute-force defense
      const attemptResult = recordFailedLoginAttempt();

      if (attemptResult.isLocked) {
        setLockoutSeconds(attemptResult.lockoutSeconds);
        setError(
          `Demasiados intentos fallidos. Por motivos de seguridad institucional, el acceso ha sido bloqueado temporalmente por ${attemptResult.lockoutSeconds} segundos.`
        );
      } else {
        setError(
          `Credenciales incorrectas. Verifique el correo institucional y la contraseña (${attemptResult.remainingAttempts} intentos restantes antes de bloqueo).`
        );
      }
    } catch (err) {
      if (localMatch) {
        resetLoginRateLimit();
        await saveStoredUser(localMatch);
        setIsLoading(false);
        onLoginSuccess(localMatch);
        return;
      }
      setError('Error al procesar la autenticación de seguridad.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 sm:p-6 overflow-hidden bg-slate-950 font-sans-inst">
      {/* Background Municipal Wall with Institutional Gradient and Vignette */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat scale-105 filter brightness-50 contrast-110"
        style={{
          backgroundImage: `url('/fondo-wall.jpg')`,
        }}
      />

      {/* Sovereign Color Layer: Emerald Green and Deep Navy */}
      <div className="absolute inset-0 z-0 bg-gradient-to-tr from-emerald-950/90 via-slate-950/85 to-sky-950/90 pointer-events-none" />
      <div className="absolute inset-0 z-0 bg-radial from-transparent via-black/40 to-black/80 pointer-events-none" />

      {/* Main Login Institutional Card */}
      <div className="relative z-10 w-full max-w-md bg-white/98 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] border border-amber-500/30 p-6 sm:p-8 transition-all">
        {/* Top Gold Medallion Emblem with Official Attached Seal */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="relative w-28 h-28 sm:w-32 sm:h-32 mb-4 rounded-full p-1 bg-gradient-to-tr from-amber-600 via-amber-300 to-yellow-500 shadow-xl ring-4 ring-emerald-700/25">
            <div className="w-full h-full rounded-full overflow-hidden bg-white/90 p-0.5 flex items-center justify-center shadow-inner">
              <img
                src="/logo-oficial.png"
                alt="Logo Oficial Dirección General - Alcaldía del Municipio Autónomo Tinaquillo"
                className="w-full h-full object-contain rounded-full drop-shadow-sm"
              />
            </div>
          </div>

          <h1 className="font-institutional text-xl sm:text-2xl font-bold text-slate-900 tracking-wider">
            DIRECCIÓN GENERAL
          </h1>

          <div className="h-0.5 w-20 bg-gradient-to-r from-emerald-600 via-amber-400 to-sky-600 my-2 rounded-full" />

          <h2 className="text-xs sm:text-sm font-extrabold text-emerald-800 tracking-wider uppercase">
            Alcaldía del Municipio Autónomo Tinaquillo
          </h2>
          <p className="text-xs font-bold text-slate-700 tracking-widest mt-1">
            (SISC)
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start justify-between gap-2 animate-shake">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Error de Autenticación</p>
                <p className="text-[11px]">{error}</p>
              </div>
            </div>
            {lockoutSeconds > 0 && (
              <button
                type="button"
                onClick={handleResetLockout}
                className="shrink-0 text-[10px] bg-rose-200 hover:bg-rose-300 text-rose-900 px-2.5 py-1 rounded-md font-bold cursor-pointer transition"
              >
                Desbloquear
              </button>
            )}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>Usuario o Correo Institucional</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (lockoutSeconds > 0) handleResetLockout();
                }}
                placeholder="Usuario o correo (ej. Protocolo1 o correo institucional)"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="username"
                className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-emerald-700 focus:bg-white transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Contraseña de Acceso
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (lockoutSeconds > 0) handleResetLockout();
                }}
                placeholder="Ingrese su contraseña institucional"
                autoComplete="current-password"
                className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-emerald-700 focus:bg-white transition font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-3 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 tracking-wide bg-gradient-to-r from-emerald-800 via-emerald-700 to-sky-900 hover:from-emerald-900 hover:to-sky-950 text-white hover:shadow-lg cursor-pointer disabled:opacity-75"
          >
            {isLoading ? (
              <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 text-amber-300" />
                <span>Ingresar al Sistema</span>
              </>
            )}
          </button>
        </form>

        {/* Institutional Security Notice Footer */}
        <div className="mt-6 pt-4 border-t border-slate-200/80 flex items-center gap-2.5 text-slate-500 text-[11px] leading-relaxed">
          <Shield className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>
            Acceso restringido para el personal autorizado de la Dirección General y dependencias municipales.
          </span>
        </div>
      </div>
    </div>
  );
};

