import React, { useState } from 'react';
import {
  HardDrive,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  FileCode,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Clock,
  Database,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { Solicitud, InformeDependencia, RegistroAsistencia, AppUser } from '../types';
import {
  createDriveBackupSnapshot,
  restoreDriveBackup,
  clearAllStoredData,
  getStoredFuncionarios,
  BackupSnapshot,
  formatFechaEspanol,
} from '../utils/storage';
import { exportarExcelGeneralMaestro } from '../utils/exportUtils';

interface DriveBackupPanelProps {
  currentUser: AppUser;
  solicitudes: Solicitud[];
  informes: InformeDependencia[];
  asistencias: RegistroAsistencia[];
  onDataRestored?: () => void;
  onClearAllData?: () => void;
  onCleanCacheAndSync?: () => void;
  isCleaningCache?: boolean;
}

export const DriveBackupPanel: React.FC<DriveBackupPanelProps> = ({
  currentUser,
  solicitudes,
  informes,
  asistencias,
  onDataRestored,
  onClearAllData,
  onCleanCacheAndSync,
  isCleaningCache = false,
}) => {
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [pendingRestoreData, setPendingRestoreData] = useState<BackupSnapshot | null>(null);

  // Generate & Download JSON Snapshot for Google Drive
  const handleDownloadJsonBackup = () => {
    try {
      const snapshot = createDriveBackupSnapshot();
      const jsonStr = JSON.stringify(snapshot, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateTag = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `RESPALDO_DRIVE_TINAQUILLO_DG_${dateTag}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccessMsg(
        'Archivo de respaldo JSON generado exitosamente. Puede almacenarlo en su carpeta de Google Drive.'
      );
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (e) {
      console.error('Error al generar respaldo JSON', e);
      setErrorMsg('Ocurrió un error al preparar el archivo de respaldo.');
    }
  };

  // Generate & Download Full Excel Master
  const handleDownloadExcelBackup = () => {
    try {
      exportarExcelGeneralMaestro(solicitudes, informes, asistencias);
      setSuccessMsg('Libro Maestro Excel generado para respaldo en Google Drive.');
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (e) {
      console.error('Error al generar Excel maestro', e);
      setErrorMsg('No se pudo generar la hoja de cálculo de respaldo.');
    }
  };

  // Restore from JSON Backup
  const handleRestoreFromFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.json')) {
      setErrorMsg('El archivo debe tener formato JSON (.json).');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setErrorMsg('El archivo de respaldo supera el tamaño máximo de seguridad de 15MB.');
      return;
    }

    setErrorMsg(null);
    setIsRestoring(true);

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string) as BackupSnapshot;
        if (!parsed.solicitudes || !parsed.informes) {
          throw new Error('El archivo no contiene la estructura requerida del sistema.');
        }

        setPendingRestoreData(parsed);
      } catch (err: any) {
        console.error('Error al parsear archivo de respaldo', err);
        setErrorMsg('El archivo seleccionado no es un respaldo válido de la Dirección General.');
      } finally {
        setIsRestoring(false);
      }
    };
    reader.readAsText(file);
  };

  const executeRestore = async (data: BackupSnapshot) => {
    setIsRestoring(true);
    try {
      const ok = await restoreDriveBackup(data);
      if (ok) {
        setSuccessMsg('¡Datos restaurados con éxito y guardados en el servidor para todos los dispositivos!');
        if (onDataRestored) onDataRestored();
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        setErrorMsg('No se pudo completar la restauración de los registros.');
      }
    } catch (err) {
      console.error('Error restaurando backup:', err);
      setErrorMsg('Ocurrió un error al persistir los registros en el servidor.');
    } finally {
      setIsRestoring(false);
      setPendingRestoreData(null);
    }
  };

  // Clear all data to start fresh upload
  const executeClearAllData = async () => {
    await clearAllStoredData();
    if (onClearAllData) {
      await onClearAllData();
    }
    setSuccessMsg('Se han eliminado todos los datos cargados. El sistema está listo para una nueva carga de datos.');
    setTimeout(() => {
      window.location.reload();
    }, 800);
  };

  const fechaActual = formatFechaEspanol(new Date().toISOString());

  return (
    <div className="space-y-6">
      {/* SOFT METALLIC HEADER */}
      <div className="bg-gradient-to-r from-slate-800 via-zinc-800 to-slate-800 text-white rounded-2xl p-6 shadow-xs border border-slate-700/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300">
            Seguridad y Continuidad Operativa
          </span>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-0.5">
            Copia de Seguridad y Respaldo en Google Drive
          </h2>
          <p className="text-xs text-slate-300">
            Respalde periódicamente la base de datos de solicitudes, informes y asistencias institucionales.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="https://drive.google.com/drive/my-drive"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-white text-slate-900 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer inline-flex"
          >
            <ExternalLink className="w-3.5 h-3.5 text-slate-700" />
            <span>Abrir Google Drive</span>
          </a>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs sm:text-sm flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xs sm:text-sm flex items-center gap-2 shadow-xs">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* METRICS / DATABASE STATUS */}
      <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-950 font-semibold">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <span>Base de Datos y Almacenamiento Permanente: <strong>ACTIVO Y PROTEGIDO</strong></span>
        </div>
        <span className="text-[11px] text-emerald-800 bg-white px-2.5 py-0.5 rounded-full border border-emerald-200">
          Sincronización Continua
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Solicitudes en Respaldo
          </span>
          <p className="text-2xl font-black text-slate-900 mt-1">{solicitudes.length}</p>
          <p className="text-[11px] text-slate-500">Expedientes de atención ciudadana</p>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Informes de Gestión
          </span>
          <p className="text-2xl font-black text-slate-900 mt-1">{informes.length}</p>
          <p className="text-[11px] text-slate-500">Dependencias centralizadas y entes</p>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Asistencias a Actividades
          </span>
          <p className="text-2xl font-black text-slate-900 mt-1">{asistencias.length}</p>
          <p className="text-[11px] text-slate-500">Eventos, festividades y mesas</p>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Directorio Funcionarios
          </span>
          <p className="text-2xl font-black text-slate-900 mt-1">{getStoredFuncionarios().length}</p>
          <p className="text-[11px] text-slate-500">Titulares y directores registrados</p>
        </div>
      </div>

      {/* TWO PRIMARY BACKUP ACTIONS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* CARD 1: EXPORTAR RESPALDO */}
        <div className="p-5 sm:p-6 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                1. Descargar Paquete de Respaldo
              </h3>
              <p className="text-xs text-slate-500">
                Genere el archivo de seguridad para guardarlo en su unidad de Google Drive.
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Descargue el archivo de datos oficial para resguardo. Puede subirlo directamente a su carpeta institucional de Google Drive para mantener copias de seguridad fechadas.
          </p>

          <div className="space-y-2.5 pt-2">
            <button
              type="button"
              onClick={handleDownloadJsonBackup}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-slate-300" />
                <span>Descargar Respaldo JSON para Drive (.json)</span>
              </div>
              <Download className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleDownloadExcelBackup}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition border border-slate-300 cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                <span>Descargar Libro Maestro Completo (.xlsx)</span>
              </div>
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* CARD 2: RESTAURAR O GESTIONAR EN DRIVE */}
        <div className="p-5 sm:p-6 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                2. Restaurar Copia de Seguridad
              </h3>
              <p className="text-xs text-slate-500">
                Recupere los datos del sistema desde un respaldo previo.
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Si necesita restaurar los registros en este u otro equipo, seleccione el archivo <strong className="font-mono">.json</strong> previamente descargado de Google Drive.
          </p>

          <div className="pt-2">
            <label className="w-full flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-slate-400 rounded-xl p-4 cursor-pointer bg-slate-50/50 hover:bg-slate-50 transition">
              <Upload className="w-6 h-6 text-slate-400 mb-1" />
              <span className="text-xs font-bold text-slate-700">
                {isRestoring ? 'Procesando archivo...' : 'Seleccionar archivo .json para restaurar'}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">
                Archivos con formato oficial de la Dirección General
              </span>
              <input
                type="file"
                accept=".json"
                onChange={handleRestoreFromFile}
                disabled={isRestoring}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>

      {/* CARD: LIMPIAR CACHÉ Y FORZAR SINCRONIZACIÓN EN VIVO */}
      {onCleanCacheAndSync && (
        <div className="p-5 sm:p-6 bg-sky-50/60 border border-sky-200 rounded-2xl shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-800 flex items-center justify-center">
                <RefreshCw className={`w-4 h-4 ${isCleaningCache ? 'animate-spin' : ''}`} />
              </div>
              <h4 className="text-sm font-bold text-slate-900">
                Limpieza de Caché y Sincronización en Vivo Multi-Dispositivo
              </h4>
            </div>
            <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
              Purga las copias temporales del navegador (LocalStorage e IndexedDB) y descarga al instante el estado central y actualizado del servidor. Garantiza que todos los datos registrados por usuarios secundarios y en cualquier equipo (PC o móvil) sean visibles de inmediato en su sesión.
            </p>
          </div>

          <button
            type="button"
            onClick={onCleanCacheAndSync}
            disabled={isCleaningCache}
            className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs shrink-0 cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${isCleaningCache ? 'animate-spin' : ''}`} />
            <span>{isCleaningCache ? 'Sincronizando...' : 'Limpiar Caché y Sincronizar'}</span>
          </button>
        </div>
      )}

      {/* CARD 3: VACIAR REGISTROS PARA NUEVA CARGA LIMPIA */}
      <div className="p-5 sm:p-6 bg-white border border-slate-200 rounded-2xl shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
              <Trash2 className="w-4 h-4" />
            </div>
            <h4 className="text-sm font-bold text-slate-900">
              Vaciar Registros para Iniciar Nueva Carga
            </h4>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
            Elimina todos los datos cargados en el sistema (solicitudes, informes de dependencias y asistencias) para comenzar un nuevo ciclo de registro en blanco. Recuerde respaldar sus datos antes de realizar esta operación.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowClearConfirmModal(true)}
          className="px-4 py-2.5 bg-white hover:bg-rose-50 text-rose-700 hover:text-rose-800 border border-rose-200 hover:border-rose-300 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-2xs shrink-0 cursor-pointer"
        >
          <Trash2 className="w-4 h-4 text-rose-600" />
          <span>Vaciar Datos para Nueva Carga</span>
        </button>
      </div>

      {/* PROTOCOLO INSTITUCIONAL DE RESPALDO */}
      <div className="p-4 sm:p-5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-2">
        <div className="flex items-center gap-2 text-slate-800 font-bold">
          <ShieldCheck className="w-4 h-4 text-slate-700" />
          <span>Protocolo de Resguardo Digital • Alcaldía del Municipio Autónomo Tinaquillo</span>
        </div>
        <p className="leading-relaxed">
          Se recomienda a la <strong>Dirección General</strong> realizar una descarga de respaldo al final de cada jornada o semanalmente y almacenarla en la carpeta compartida de Google Drive institucional (<span className="font-mono text-[11px] text-slate-700">dg.municipiotinaquillo@gmail.com</span>). De esta manera, ante cualquier eventualidad, la totalidad de los datos puede ser recuperada en cuestión de segundos.
        </p>
      </div>

      {/* MODAL IN-APP: CONFIRMAR VACIAR TODOS LOS DATOS */}
      {showClearConfirmModal && (
        <div className="fixed inset-0 z-70 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl p-5 sm:p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900">¿Vaciar todos los registros?</h4>
                <p className="text-xs text-slate-500">Preparación para nueva carga limpia</p>
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs text-slate-700 leading-relaxed">
              <p className="font-semibold text-slate-900">
                Esta acción eliminará todos los datos almacenados en el sistema:
              </p>
              <ul className="list-disc list-inside space-y-1 text-slate-600 text-[11px]">
                <li>{solicitudes.length} solicitudes ciudadanas registradas</li>
                <li>{informes.length} informes de dependencias municipales</li>
                <li>{asistencias.length} registros de asistencia institucional</li>
              </ul>
              <p className="text-[11px] text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200 mt-2">
                <strong>Recomendación:</strong> Asegúrese de haber descargado el respaldo en JSON o Excel antes de confirmar.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowClearConfirmModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowClearConfirmModal(false);
                  executeClearAllData();
                }}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Sí, Vaciar Todo</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL IN-APP: CONFIRMAR RESTAURACIÓN DESDE RESPALDO */}
      {pendingRestoreData && (
        <div className="fixed inset-0 z-70 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl p-5 sm:p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-slate-800 shrink-0">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900">¿Restaurar copia de seguridad?</h4>
                <p className="text-xs text-slate-500">Recuperación de base de datos</p>
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5 text-xs text-slate-700 leading-relaxed">
              <p className="font-semibold text-slate-900 mb-1">
                Contenido del archivo de respaldo:
              </p>
              <p>• <strong>{pendingRestoreData.solicitudes?.length || 0}</strong> solicitudes</p>
              <p>• <strong>{pendingRestoreData.informes?.length || 0}</strong> informes de dependencias</p>
              <p>• <strong>{pendingRestoreData.asistencias?.length || 0}</strong> registros de asistencias</p>
              <p className="text-[11px] text-slate-500 pt-1">
                Los registros actuales se actualizarán con los datos contenidos en este archivo de respaldo.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPendingRestoreData(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const data = pendingRestoreData;
                  setPendingRestoreData(null);
                  executeRestore(data);
                }}
                className="px-4 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white rounded-xl transition cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Sí, Restaurar Datos</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
