import React, { useState, useMemo } from 'react';
import {
  FileText,
  Download,
  FolderArchive,
  Search,
  Filter,
  Paperclip,
  CheckCircle,
  Eye,
  Building2,
  Calendar,
  Layers,
  HardDrive,
  Users,
  Image as ImageIcon,
  FileSpreadsheet,
  AlertCircle,
  Loader2,
  X,
  Folder,
  FolderOpen,
  ChevronDown,
  ChevronUp,
  Landmark,
  ShieldAlert,
  ArrowDownToLine,
  ExternalLink,
} from 'lucide-react';
import { Solicitud, InformeDependencia, RegistroAsistencia } from '../types';
import {
  getAllAttachments,
  downloadSingleAttachment,
  downloadAttachmentsAsZip,
  downloadDependencyAsZip,
  downloadGroupAsZip,
  getDependencyAttachmentStats,
  FlattenedAttachment,
  DependencyStats,
  isDirectoryPickerSupported,
  saveFilesToDirectoryPicker,
  downloadFilesDirectly,
  downloadDependencyFilesDirectly,
} from '../utils/attachmentExport';

interface AdjuntosExportPanelProps {
  solicitudes: Solicitud[];
  informes: InformeDependencia[];
  asistencias?: RegistroAsistencia[];
}

export const AdjuntosExportPanel: React.FC<AdjuntosExportPanelProps> = ({
  solicitudes,
  informes,
  asistencias = [],
}) => {
  // Navigation view: 'carpetas' (Download by dependency folders) vs 'tabla' (Detailed files list)
  const [activeView, setActiveView] = useState<'carpetas' | 'tabla'>('carpetas');
  const [depFilterType, setDepFilterType] = useState<'TODAS' | 'CENTRALIZADAS' | 'DESCENTRALIZADAS'>('TODAS');
  const [depSearchTerm, setDepSearchTerm] = useState('');
  const [expandedDepId, setExpandedDepId] = useState<string | null>(null);

  // Table filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('TODAS');
  const [selectedDependencia, setSelectedDependencia] = useState<string>('TODAS');

  // ZIP export progress states
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ percent: number; currentFile: string } | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<FlattenedAttachment | null>(null);

  // Extract all attachments from state
  const allAttachments = useMemo(() => {
    return getAllAttachments(solicitudes, informes, asistencias);
  }, [solicitudes, informes, asistencias]);

  // Comprehensive dependency stats (Centralizadas and Descentralizadas)
  const dependencyStats = useMemo(() => {
    return getDependencyAttachmentStats(allAttachments);
  }, [allAttachments]);

  // Overall statistics
  const stats = useMemo(() => {
    const totalFiles = allAttachments.length;
    const totalBytes = allAttachments.reduce((acc, curr) => acc + (curr.size || 0), 0);
    const centralizadasFiles = allAttachments.filter((a) => a.tipoDependencia === 'CENTRALIZADA');
    const descentralizadasFiles = allAttachments.filter((a) => a.tipoDependencia === 'DESCENTRALIZADA');
    const trimestrales = allAttachments.filter((a) => a.category === 'Informe Trimestral');
    const firmas = allAttachments.filter((a) => a.category === 'Firma Memorándum');
    const auditorias = allAttachments.filter((a) => a.category === 'Auditoría');
    const solicitudesAtt = allAttachments.filter((a) => a.category === 'Solicitud Ciudadana');
    const asistenciasAtt = allAttachments.filter((a) => a.category === 'Lista Asistencia');
    const excelCount = allAttachments.filter((a) => a.type === 'excel' || a.name.endsWith('.xlsx') || a.name.endsWith('.xls')).length;
    const wordCount = allAttachments.filter((a) => a.type === 'doc' || a.name.endsWith('.docx') || a.name.endsWith('.doc')).length;
    const pdfCount = allAttachments.filter((a) => a.type === 'pdf' || a.name.endsWith('.pdf')).length;
    const imageCount = allAttachments.filter((a) => a.type === 'image' || a.name.match(/\.(jpg|jpeg|png|webp)$/i)).length;

    return {
      totalFiles,
      totalBytes,
      centralizadasCount: centralizadasFiles.length,
      descentralizadasCount: descentralizadasFiles.length,
      trimestrales: trimestrales.length,
      firmas: firmas.length,
      auditorias: auditorias.length,
      solicitudesAtt: solicitudesAtt.length,
      asistenciasAtt: asistenciasAtt.length,
      excelCount,
      wordCount,
      pdfCount,
      imageCount,
    };
  }, [allAttachments]);

  // Unique dependencias list for filter
  const dependenciasList = useMemo(() => {
    const deps = new Set<string>();
    allAttachments.forEach((a) => {
      if (a.dependencia) deps.add(a.dependencia);
    });
    return Array.from(deps).sort();
  }, [allAttachments]);

  // Filtered list for table view
  const filteredAttachments = useMemo(() => {
    return allAttachments.filter((att) => {
      if (selectedCategory !== 'TODAS' && att.category !== selectedCategory) {
        return false;
      }
      if (selectedDependencia !== 'TODAS' && att.dependencia !== selectedDependencia) {
        return false;
      }
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchName = att.name.toLowerCase().includes(query);
        const matchDep = att.dependencia.toLowerCase().includes(query);
        const matchSource = att.sourceTitle.toLowerCase().includes(query);
        if (!matchName && !matchDep && !matchSource) {
          return false;
        }
      }
      return true;
    });
  }, [allAttachments, selectedCategory, selectedDependencia, searchTerm]);

  // Format bytes to human readable string
  const formatSize = (bytes: number) => {
    if (!bytes || isNaN(bytes)) return '0 KB';
    if (bytes > 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${Math.round(bytes / 1024)} KB`;
  };

  // Download entire repository in native folders (Sin formato ZIP)
  const handleExportAllFolder = async () => {
    if (allAttachments.length === 0) {
      alert('No hay archivos adjuntos en el sistema para exportar.');
      return;
    }
    setIsExportingZip(true);
    setExportProgress({ percent: 0, currentFile: 'Iniciando descarga en carpetas (sin ZIP)...' });

    try {
      if (isDirectoryPickerSupported) {
        const result = await saveFilesToDirectoryPicker(
          allAttachments,
          'Adjuntos_Tinaquillo_Por_Dependencias',
          (percent, currentFile) => {
            setExportProgress({ percent, currentFile });
          }
        );
        alert(result.message);
      } else {
        const count = await downloadFilesDirectly(allAttachments, (percent, currentFile) => {
          setExportProgress({ percent, currentFile });
        });
        alert(`Se descargaron ${count} archivos originales directamente (sin formato ZIP).`);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setIsExportingZip(false);
        setExportProgress(null);
        return;
      }
      console.warn('Fallback a descarga directa de archivos:', err);
      try {
        const count = await downloadFilesDirectly(allAttachments, (percent, currentFile) => {
          setExportProgress({ percent, currentFile });
        });
        alert(`Se descargaron ${count} archivos originales directamente (sin formato ZIP).`);
      } catch (innerErr: any) {
        alert(`Error al descargar archivos: ${innerErr.message || 'Error desconocido'}`);
      }
    } finally {
      setIsExportingZip(false);
      setExportProgress(null);
    }
  };

  // Download a single dependency's files directly (Sin formato ZIP)
  const handleExportDependencyFolder = async (dep: DependencyStats) => {
    if (dep.attachments.length === 0) {
      alert(`La dependencia "${dep.nombre}" no cuenta con archivos adjuntos registrados.`);
      return;
    }
    setIsExportingZip(true);
    setExportProgress({ percent: 0, currentFile: `Preparando archivos de ${dep.nombre}...` });

    try {
      if (isDirectoryPickerSupported) {
        const result = await saveFilesToDirectoryPicker(
          dep.attachments,
          dep.nombre,
          (percent, currentFile) => {
            setExportProgress({ percent, currentFile });
          }
        );
        alert(result.message);
      } else {
        const count = await downloadDependencyFilesDirectly(dep.nombre, allAttachments, (percent, currentFile) => {
          setExportProgress({ percent, currentFile });
        });
        alert(`Se descargaron ${count} archivos de "${dep.nombre}" en formato original (sin ZIP).`);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setIsExportingZip(false);
        setExportProgress(null);
        return;
      }
      try {
        const count = await downloadDependencyFilesDirectly(dep.nombre, allAttachments, (percent, currentFile) => {
          setExportProgress({ percent, currentFile });
        });
        alert(`Se descargaron ${count} archivos de "${dep.nombre}" (sin formato ZIP).`);
      } catch (innerErr: any) {
        alert(`Error al descargar archivos: ${innerErr.message || 'Error desconocido'}`);
      }
    } finally {
      setIsExportingZip(false);
      setExportProgress(null);
    }
  };

  // Download entire group of dependencies without ZIP
  const handleExportGroupFolder = async (groupType: 'CENTRALIZADA' | 'DESCENTRALIZADA') => {
    const filtered = allAttachments.filter((a) => a.tipoDependencia === groupType);
    const label = groupType === 'CENTRALIZADA' ? 'Dependencias Centralizadas' : 'Dependencias Descentralizadas';
    if (filtered.length === 0) {
      alert(`No hay archivos adjuntos registrados en ${label}.`);
      return;
    }
    setIsExportingZip(true);
    setExportProgress({ percent: 0, currentFile: `Preparando carpetas de ${label}...` });

    try {
      if (isDirectoryPickerSupported) {
        const result = await saveFilesToDirectoryPicker(
          filtered,
          label.replace(/\s+/g, '_'),
          (percent, currentFile) => {
            setExportProgress({ percent, currentFile });
          }
        );
        alert(result.message);
      } else {
        const count = await downloadFilesDirectly(filtered, (percent, currentFile) => {
          setExportProgress({ percent, currentFile });
        });
        alert(`Se descargaron ${count} archivos de ${label} en formato original (sin ZIP).`);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setIsExportingZip(false);
        setExportProgress(null);
        return;
      }
      try {
        const count = await downloadFilesDirectly(filtered, (percent, currentFile) => {
          setExportProgress({ percent, currentFile });
        });
        alert(`Se descargaron ${count} archivos de ${label} (sin formato ZIP).`);
      } catch (innerErr: any) {
        alert(`Error al descargar: ${innerErr.message || 'Error desconocido'}`);
      }
    } finally {
      setIsExportingZip(false);
      setExportProgress(null);
    }
  };

  // Download entire repository in master ZIP (organized by Centralizadas & Descentralizadas folders)
  const handleExportAllZip = async () => {
    if (allAttachments.length === 0) {
      alert('No hay archivos adjuntos en el sistema para exportar.');
      return;
    }
    setIsExportingZip(true);
    setExportProgress({ percent: 0, currentFile: 'Iniciando empaquetado por dependencias...' });

    try {
      const dateStr = new Date().toISOString().split('T')[0];
      await downloadAttachmentsAsZip(
        allAttachments,
        `Adjuntos_Tinaquillo_Por_Dependencias_${dateStr}.zip`,
        (percent, currentFile) => {
          setExportProgress({ percent, currentFile });
        }
      );
    } catch (err: any) {
      console.error('Error exportando ZIP:', err);
      alert(`Error al generar archivo ZIP: ${err.message || 'Error desconocido'}`);
    } finally {
      setIsExportingZip(false);
      setExportProgress(null);
    }
  };

  // Download a single dependency's ZIP folder
  const handleExportDependencyZip = async (dep: DependencyStats) => {
    if (dep.attachments.length === 0) {
      alert(`La dependencia "${dep.nombre}" no cuenta con archivos adjuntos registrados.`);
      return;
    }
    setIsExportingZip(true);
    setExportProgress({ percent: 0, currentFile: `Preparando carpeta de ${dep.nombre}...` });

    try {
      await downloadDependencyAsZip(dep.nombre, allAttachments, (percent, currentFile) => {
        setExportProgress({ percent, currentFile });
      });
    } catch (err: any) {
      console.error('Error exportando carpeta ZIP de dependencia:', err);
      alert(`Error al descargar carpeta: ${err.message || 'Error desconocido'}`);
    } finally {
      setIsExportingZip(false);
      setExportProgress(null);
    }
  };

  // Download entire group of dependencies (all Centralizadas or all Descentralizadas)
  const handleExportGroupZip = async (groupType: 'CENTRALIZADA' | 'DESCENTRALIZADA') => {
    const count = groupType === 'CENTRALIZADA' ? stats.centralizadasCount : stats.descentralizadasCount;
    const label = groupType === 'CENTRALIZADA' ? 'Dependencias Centralizadas' : 'Dependencias Descentralizadas';
    if (count === 0) {
      alert(`No hay archivos adjuntos registrados en ${label}.`);
      return;
    }
    setIsExportingZip(true);
    setExportProgress({ percent: 0, currentFile: `Empaquetando ${label}...` });

    try {
      await downloadGroupAsZip(groupType, allAttachments, (percent, currentFile) => {
        setExportProgress({ percent, currentFile });
      });
    } catch (err: any) {
      console.error('Error exportando grupo:', err);
      alert(`Error al generar ZIP: ${err.message || 'Error desconocido'}`);
    } finally {
      setIsExportingZip(false);
      setExportProgress(null);
    }
  };

  // Filter dependencies in the carpetas view
  const filteredCentralizadas = useMemo(() => {
    return dependencyStats.centralizadas.filter((d) => {
      if (!depSearchTerm.trim()) return true;
      return d.nombre.toLowerCase().includes(depSearchTerm.toLowerCase());
    });
  }, [dependencyStats.centralizadas, depSearchTerm]);

  const filteredDescentralizadas = useMemo(() => {
    return dependencyStats.descentralizadas.filter((d) => {
      if (!depSearchTerm.trim()) return true;
      return d.nombre.toLowerCase().includes(depSearchTerm.toLowerCase());
    });
  }, [dependencyStats.descentralizadas, depSearchTerm]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Banner with Master ZIP Action */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-700">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 text-[10px] uppercase tracking-wider">
                Expedientes y Evidencias Municipales
              </span>
              <span className="text-xs text-slate-300 font-semibold">
                Alcaldía Bolivariana de Tinaquillo
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
              <FolderArchive className="w-6 h-6 text-amber-400" />
              <span>Descarga por Carpeta de Archivos Adjuntos</span>
            </h2>
          </div>

          {/* Master Download Action Button - Descarga en Archivo Único */}
          <div className="flex items-center gap-2.5 shrink-0 w-full lg:w-auto">
            <button
              type="button"
              disabled={isExportingZip || allAttachments.length === 0}
              onClick={handleExportAllZip}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-lg transition active:scale-98 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="Descargar en un solo archivo con todas las carpetas organizadas por dependencias conteniendo Word, Excel, PDF e imágenes"
            >
              {isExportingZip ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Generando archivo único ({exportProgress?.percent || 0}%)...</span>
                </>
              ) : (
                <>
                  <FolderArchive className="w-4 h-4 text-slate-950" />
                  <span>Descargar Todos los Archivos por Dependencia (Archivo Único) ({allAttachments.length})</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Global Progress Bar during ZIP Generation */}
        {isExportingZip && exportProgress && (
          <div className="mt-4 p-3 bg-slate-950/80 rounded-xl border border-amber-500/40">
            <div className="flex items-center justify-between text-xs mb-1.5 font-bold">
              <span className="text-amber-300 truncate max-w-xs sm:max-w-md">
                Procesando archivo: {exportProgress.currentFile}
              </span>
              <span className="text-amber-400">{exportProgress.percent}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-400 transition-all duration-150"
                style={{ width: `${exportProgress.percent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Main KPI Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
            Total Archivos Adjuntos
          </span>
          <p className="text-xl font-black text-slate-900">{stats.totalFiles}</p>
          <span className="text-[11px] text-slate-500 font-mono font-medium">
            Peso Total: {formatSize(stats.totalBytes)}
          </span>
        </div>

        <div className="p-3.5 bg-white border border-sky-200 bg-sky-50/30 rounded-xl shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700 block mb-0.5">
            Dependencias Centralizadas (17)
          </span>
          <p className="text-xl font-black text-sky-950">{stats.centralizadasCount} <span className="text-xs font-semibold text-sky-700">archivos</span></p>
          <span className="text-[11px] text-sky-800 font-semibold block mt-0.5">17 Direcciones</span>
        </div>

        <div className="p-3.5 bg-white border border-purple-200 bg-purple-50/30 rounded-xl shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 block mb-0.5">
            Dependencias Descentralizadas (20)
          </span>
          <p className="text-xl font-black text-purple-950">{stats.descentralizadasCount} <span className="text-xs font-semibold text-purple-700">archivos</span></p>
          <span className="text-[11px] text-purple-800 font-semibold block mt-0.5">20 Entes e Institutos</span>
        </div>

        <div className="p-3.5 bg-white border border-emerald-200 bg-emerald-50/30 rounded-xl shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block mb-0.5">
            Estructura de Descarga
          </span>
          <p className="text-sm font-black text-slate-800 mt-1">Carpetas por Dependencia</p>
          <span className="text-[10px] text-slate-500 block">
            Organizadas por ente
          </span>
        </div>
      </div>

      {/* Search and Filters for Folders */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <Folder className="w-5 h-5 text-amber-500" />
          <h3 className="text-sm font-bold text-slate-800">Carpetas por Dependencia e Instituto</h3>
        </div>

        {/* View-specific controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={depSearchTerm}
              onChange={(e) => setDepSearchTerm(e.target.value)}
              placeholder="Buscar dependencia..."
              className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 w-48 sm:w-60"
            />
          </div>
          <div className="flex items-center bg-slate-100 p-1 rounded-lg text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setDepFilterType('TODAS')}
              className={`px-2.5 py-1 rounded-md transition ${
                depFilterType === 'TODAS' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
              }`}
            >
              Todas
            </button>
            <button
              type="button"
              onClick={() => setDepFilterType('CENTRALIZADAS')}
              className={`px-2.5 py-1 rounded-md transition ${
                depFilterType === 'CENTRALIZADAS' ? 'bg-sky-600 text-white shadow-2xs' : 'text-slate-600'
              }`}
            >
              Centralizadas
            </button>
            <button
              type="button"
              onClick={() => setDepFilterType('DESCENTRALIZADAS')}
              className={`px-2.5 py-1 rounded-md transition ${
                depFilterType === 'DESCENTRALIZADAS' ? 'bg-purple-600 text-white shadow-2xs' : 'text-slate-600'
              }`}
            >
              Descentralizadas
            </button>
          </div>
        </div>
      </div>

      {/* VIEW 1: CARPETAS POR DEPENDENCIA (CENTRALIZADAS Y DESCENTRALIZADAS) */}
      {activeView === 'carpetas' && (
        <div className="space-y-8 animate-fade-in">
          {/* SECTION 1: DEPENDENCIAS CENTRALIZADAS */}
          {(depFilterType === 'TODAS' || depFilterType === 'CENTRALIZADAS') && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-sky-50/80 border border-sky-200 p-4 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center font-black shadow-xs">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                      <span>Dependencias Centralizadas</span>
                      <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 text-[10px] font-bold">
                        17 Direcciones Municipales
                      </span>
                    </h3>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isExportingZip || stats.centralizadasCount === 0}
                  onClick={() => handleExportGroupZip('CENTRALIZADA')}
                  className="flex items-center gap-2 px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-40"
                  title="Descargar las carpetas de todas las dependencias centralizadas en un solo archivo"
                >
                  <ArrowDownToLine className="w-3.5 h-3.5" />
                  <span>Descargar Carpetas Centralizadas (Archivo Único) ({stats.centralizadasCount})</span>
                </button>
              </div>

              {/* Cards Grid for Centralizadas */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {filteredCentralizadas.map((dep) => {
                  const hasFiles = dep.totalFiles > 0;
                  const isExpanded = expandedDepId === dep.id;

                  return (
                    <div
                      key={dep.id}
                      className={`bg-white rounded-xl border transition-all shadow-2xs flex flex-col justify-between ${
                        hasFiles
                          ? 'border-sky-200 hover:border-sky-400 hover:shadow-sm'
                          : 'border-slate-200 bg-slate-50/50 opacity-80'
                      }`}
                    >
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className="px-2 py-0.5 rounded-md bg-sky-100 text-sky-800 font-bold text-[9px] uppercase tracking-wider">
                            Centralizada
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              hasFiles
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {dep.totalFiles} {dep.totalFiles === 1 ? 'archivo' : 'archivos'}
                          </span>
                        </div>

                        <h4 className="font-bold text-xs sm:text-sm text-slate-900 mb-1 leading-snug line-clamp-2" title={dep.nombre}>
                          {dep.nombre}
                        </h4>

                        <div className="flex items-center gap-2 text-[11px] text-slate-500 mb-3">
                          <HardDrive className="w-3 h-3 text-slate-400" />
                          <span>{formatSize(dep.totalBytes)}</span>
                        </div>

                        {/* Breakdown Categories Badges */}
                        {hasFiles && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {Object.entries(dep.categories).map(([cat, count]) => (
                              <span
                                key={cat}
                                className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[9px] font-semibold text-slate-700"
                              >
                                {cat}: <strong>{count}</strong>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Card Footer Actions */}
                      <div className="p-3 bg-slate-50 border-t border-slate-100 rounded-b-xl flex items-center justify-between gap-2">
                        {hasFiles ? (
                          <button
                            type="button"
                            onClick={() => setExpandedDepId(isExpanded ? null : dep.id)}
                            className="text-[11px] font-bold text-slate-600 hover:text-slate-900 inline-flex items-center gap-1 cursor-pointer"
                          >
                            <span>{isExpanded ? 'Ocultar' : 'Ver'} archivos</span>
                            {isExpanded ? (
                              <ChevronUp className="w-3 h-3" />
                            ) : (
                              <ChevronDown className="w-3 h-3" />
                            )}
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Sin archivos adjuntos</span>
                        )}

                        <button
                          type="button"
                          disabled={isExportingZip || !hasFiles}
                          onClick={() => handleExportDependencyZip(dep)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-2xs ${
                            hasFiles
                              ? 'bg-sky-600 hover:bg-sky-700 text-white cursor-pointer active:scale-98'
                              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                          }`}
                          title={`Descargar en un solo archivo la carpeta con todos los adjuntos (Excel, Word, PDF e imágenes) de ${dep.nombre}`}
                        >
                          <Download className="w-3 h-3" />
                          <span>Descargar Carpeta (Archivo Único)</span>
                        </button>
                      </div>

                      {/* Expanded list of files inside card */}
                      {isExpanded && hasFiles && (
                        <div className="p-3 border-t border-slate-200 bg-slate-100/70 max-h-48 overflow-y-auto space-y-1.5 text-xs animate-fade-in">
                          {dep.attachments.map((file) => (
                            <div
                              key={file.id}
                              className="flex items-center justify-between gap-2 p-1.5 bg-white rounded border border-slate-200"
                            >
                              <div className="min-w-0 flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="font-medium text-slate-800 truncate" title={file.name}>
                                  {file.name}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setPreviewAttachment(file)}
                                  className="p-1 text-slate-500 hover:text-slate-900 rounded hover:bg-slate-100 cursor-pointer"
                                  title="Ver archivo"
                                >
                                  <Eye className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => downloadSingleAttachment(file)}
                                  className="p-1 text-emerald-600 hover:text-emerald-800 rounded hover:bg-emerald-50 cursor-pointer"
                                  title="Descargar este archivo"
                                >
                                  <Download className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECTION 2: DEPENDENCIAS DESCENTRALIZADAS */}
          {(depFilterType === 'TODAS' || depFilterType === 'DESCENTRALIZADAS') && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-purple-50/80 border border-purple-200 p-4 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center font-black shadow-xs">
                    <Landmark className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                      <span>Dependencias Descentralizadas</span>
                      <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-bold">
                        20 Institutos y Empresas Públicas
                      </span>
                    </h3>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isExportingZip || stats.descentralizadasCount === 0}
                  onClick={() => handleExportGroupZip('DESCENTRALIZADA')}
                  className="flex items-center gap-2 px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-40"
                  title="Descargar las carpetas de todas las dependencias descentralizadas en un solo archivo"
                >
                  <ArrowDownToLine className="w-3.5 h-3.5" />
                  <span>Descargar Carpetas Descentralizadas (Archivo Único) ({stats.descentralizadasCount})</span>
                </button>
              </div>

              {/* Cards Grid for Descentralizadas */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {filteredDescentralizadas.map((dep) => {
                  const hasFiles = dep.totalFiles > 0;
                  const isExpanded = expandedDepId === dep.id;

                  return (
                    <div
                      key={dep.id}
                      className={`bg-white rounded-xl border transition-all shadow-2xs flex flex-col justify-between ${
                        hasFiles
                          ? 'border-purple-200 hover:border-purple-400 hover:shadow-sm'
                          : 'border-slate-200 bg-slate-50/50 opacity-80'
                      }`}
                    >
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 font-bold text-[9px] uppercase tracking-wider">
                            {dep.subtipo === 'EMPRESA' ? 'Empresa Pública' : 'Instituto Autónomo'}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              hasFiles
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {dep.totalFiles} {dep.totalFiles === 1 ? 'archivo' : 'archivos'}
                          </span>
                        </div>

                        <h4 className="font-bold text-xs sm:text-sm text-slate-900 mb-1 leading-snug line-clamp-2" title={dep.nombre}>
                          {dep.nombre}
                        </h4>

                        <div className="flex items-center gap-2 text-[11px] text-slate-500 mb-3">
                          <HardDrive className="w-3 h-3 text-slate-400" />
                          <span>{formatSize(dep.totalBytes)}</span>
                        </div>

                        {/* Breakdown Categories Badges */}
                        {hasFiles && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {Object.entries(dep.categories).map(([cat, count]) => (
                              <span
                                key={cat}
                                className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[9px] font-semibold text-slate-700"
                              >
                                {cat}: <strong>{count}</strong>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Card Footer Actions */}
                      <div className="p-3 bg-slate-50 border-t border-slate-100 rounded-b-xl flex items-center justify-between gap-2">
                        {hasFiles ? (
                          <button
                            type="button"
                            onClick={() => setExpandedDepId(isExpanded ? null : dep.id)}
                            className="text-[11px] font-bold text-slate-600 hover:text-slate-900 inline-flex items-center gap-1 cursor-pointer"
                          >
                            <span>{isExpanded ? 'Ocultar' : 'Ver'} archivos</span>
                            {isExpanded ? (
                              <ChevronUp className="w-3 h-3" />
                            ) : (
                              <ChevronDown className="w-3 h-3" />
                            )}
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Sin archivos adjuntos</span>
                        )}

                        <button
                          type="button"
                          disabled={isExportingZip || !hasFiles}
                          onClick={() => handleExportDependencyZip(dep)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-2xs ${
                            hasFiles
                              ? 'bg-purple-600 hover:bg-purple-700 text-white cursor-pointer active:scale-98'
                              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                          }`}
                          title={`Descargar en un solo archivo la carpeta con todos los adjuntos (Excel, Word, PDF e imágenes) de ${dep.nombre}`}
                        >
                          <Download className="w-3 h-3" />
                          <span>Descargar Carpeta (Archivo Único)</span>
                        </button>
                      </div>

                      {/* Expanded list of files inside card */}
                      {isExpanded && hasFiles && (
                        <div className="p-3 border-t border-slate-200 bg-slate-100/70 max-h-48 overflow-y-auto space-y-1.5 text-xs animate-fade-in">
                          {dep.attachments.map((file) => (
                            <div
                              key={file.id}
                              className="flex items-center justify-between gap-2 p-1.5 bg-white rounded border border-slate-200"
                            >
                              <div className="min-w-0 flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="font-medium text-slate-800 truncate" title={file.name}>
                                  {file.name}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setPreviewAttachment(file)}
                                  className="p-1 text-slate-500 hover:text-slate-900 rounded hover:bg-slate-100 cursor-pointer"
                                  title="Ver archivo"
                                >
                                  <Eye className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => downloadSingleAttachment(file)}
                                  className="p-1 text-emerald-600 hover:text-emerald-800 rounded hover:bg-emerald-50 cursor-pointer"
                                  title="Descargar este archivo"
                                >
                                  <Download className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: LISTADO GENERAL DETALLADO DE ARCHIVOS (TABLA) */}
      {activeView === 'tabla' && (
        <div className="space-y-4 animate-fade-in">
          {/* Filter and Search Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nombre de archivo, dependencia o asunto..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
              />
            </div>

            {/* Category filter */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-amber-500"
              >
                <option value="TODAS">Todas las Categorías</option>
                <option value="Informe Trimestral">Informes Trimestrales</option>
                <option value="Firma Memorándum">Firmas Comunicación Interna de Directorio</option>
                <option value="Auditoría">Auditorías</option>
                <option value="Solicitud Ciudadana">Solicitudes</option>
                <option value="Lista Asistencia">Listas de Asistencia</option>
              </select>

              {/* Dependency filter */}
              <select
                value={selectedDependencia}
                onChange={(e) => setSelectedDependencia(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-amber-500 max-w-[200px]"
              >
                <option value="TODAS">Todas las Dependencias</option>
                {dependenciasList.map((dep) => (
                  <option key={dep} value={dep}>
                    {dep}
                  </option>
                ))}
              </select>

              {/* Export current selection in ZIP */}
              <button
                type="button"
                disabled={isExportingZip || filteredAttachments.length === 0}
                onClick={async () => {
                  if (filteredAttachments.length === 0) return;
                  setIsExportingZip(true);
                  setExportProgress({ percent: 0, currentFile: 'Preparando selección...' });
                  try {
                    const dateStr = new Date().toISOString().split('T')[0];
                    await downloadAttachmentsAsZip(
                      filteredAttachments,
                      `Adjuntos_Filtrados_${dateStr}.zip`,
                      (percent, currentFile) => setExportProgress({ percent, currentFile })
                    );
                  } catch (err: any) {
                    alert(`Error al generar ZIP: ${err.message || 'Desconocido'}`);
                  } finally {
                    setIsExportingZip(false);
                    setExportProgress(null);
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer disabled:opacity-40"
                title="Descargar la carpeta con los archivos que coinciden con los filtros actuales"
              >
                <FolderArchive className="w-3.5 h-3.5 text-amber-400" />
                <span>Descargar Carpeta con Selección ({filteredAttachments.length})</span>
              </button>
            </div>
          </div>

          {/* Dedicated banner when a specific dependency is selected */}
          {selectedDependencia !== 'TODAS' && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-amber-900 font-bold">
                <FolderOpen className="w-4 h-4 text-amber-600" />
                <span>
                  Filtrando por carpeta: <strong>{selectedDependencia}</strong> ({filteredAttachments.length} archivos)
                </span>
              </div>
              <button
                type="button"
                disabled={isExportingZip || filteredAttachments.length === 0}
                onClick={() => {
                  const found = dependencyStats.todas.find(
                    (d) => d.nombre.toUpperCase() === selectedDependencia.toUpperCase()
                  );
                  if (found) {
                    handleExportDependencyZip(found);
                  } else {
                    downloadDependencyAsZip(selectedDependencia, allAttachments);
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs shadow-2xs cursor-pointer disabled:opacity-50"
              >
                <Download className="w-3 h-3" />
                <span>Descargar Carpeta de esta Dependencia</span>
              </button>
            </div>
          )}

          {/* Table / List */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">
                Listado de Archivos ({filteredAttachments.length} encontrados)
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                Haga clic en Descargar para obtener cualquier archivo individualmente
              </span>
            </div>

            {filteredAttachments.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <Paperclip className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-sm font-bold text-slate-700">
                  No se encontraron archivos adjuntos con los filtros aplicados.
                </p>
                <p className="text-xs text-slate-500">
                  Pruebe cambiando la categoría o dependencia seleccionada.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Archivo</th>
                      <th className="py-2.5 px-3">Categoría</th>
                      <th className="py-2.5 px-3">Dependencia</th>
                      <th className="py-2.5 px-3">Tipo</th>
                      <th className="py-2.5 px-3">Fecha</th>
                      <th className="py-2.5 px-3">Tamaño</th>
                      <th className="py-2.5 px-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {filteredAttachments.map((att) => {
                      const isImage = att.type === 'image' || att.name.match(/\.(jpg|jpeg|png|webp)$/i);
                      const isPdf = att.type === 'pdf' || att.name.endsWith('.pdf');

                      return (
                        <tr key={att.id} className="hover:bg-slate-50/80 transition">
                          {/* Name & Type */}
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2 max-w-xs sm:max-w-sm">
                              <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 text-slate-600 border border-slate-200">
                                {isImage ? (
                                  <ImageIcon className="w-3.5 h-3.5 text-amber-600" />
                                ) : isPdf ? (
                                  <FileText className="w-3.5 h-3.5 text-rose-600" />
                                ) : (
                                  <Paperclip className="w-3.5 h-3.5 text-slate-600" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <span className="font-bold text-slate-900 block truncate" title={att.name}>
                                  {att.name}
                                </span>
                                <span className="text-[10px] text-slate-500 truncate block">
                                  {att.sourceTitle}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Category Badge */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                att.category === 'Informe Trimestral'
                                  ? 'bg-sky-100 text-sky-800'
                                  : att.category === 'Firma Memorándum'
                                  ? 'bg-amber-100 text-amber-800'
                                  : att.category === 'Auditoría'
                                  ? 'bg-purple-100 text-purple-800'
                                  : att.category === 'Solicitud Ciudadana'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-slate-800'
                              }`}
                            >
                              {att.category}
                            </span>
                          </td>

                          {/* Dependencia */}
                          <td className="py-2.5 px-3 text-slate-700 max-w-[200px] truncate" title={att.dependencia}>
                            {att.dependencia}
                          </td>

                          {/* Tipo Dependencia */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                att.tipoDependencia === 'CENTRALIZADA'
                                  ? 'bg-sky-50 text-sky-700 border border-sky-200'
                                  : 'bg-purple-50 text-purple-700 border border-purple-200'
                              }`}
                            >
                              {att.tipoDependencia === 'CENTRALIZADA' ? 'Centralizada' : 'Descentralizada'}
                            </span>
                          </td>

                          {/* Fecha */}
                          <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                            {att.fecha}
                          </td>

                          {/* Tamaño */}
                          <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">
                            {formatSize(att.size)}
                          </td>

                          {/* Acciones */}
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {att.dataUrl && (
                                <button
                                  type="button"
                                  onClick={() => setPreviewAttachment(att)}
                                  className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                                  title="Previsualizar archivo"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => downloadSingleAttachment(att)}
                                className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg font-bold text-[11px] transition shadow-2xs cursor-pointer"
                                title="Descargar archivo individual"
                              >
                                <Download className="w-3 h-3 text-emerald-600" />
                                <span>Descargar</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewAttachment && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-300 overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="min-w-0 pr-4">
                <h3 className="text-sm font-bold truncate">{previewAttachment.name}</h3>
                <p className="text-[11px] text-slate-400 truncate">
                  {previewAttachment.category} • {previewAttachment.dependencia} (
                  {previewAttachment.tipoDependencia === 'CENTRALIZADA' ? 'Centralizada' : 'Descentralizada'})
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => downloadSingleAttachment(previewAttachment)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewAttachment(null)}
                  className="p-1.5 text-slate-400 hover:text-white transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4 overflow-auto flex-1 flex items-center justify-center bg-slate-100 min-h-[300px]">
              {previewAttachment.type === 'image' || previewAttachment.name.match(/\.(jpg|jpeg|png|webp)$/i) ? (
                <img
                  src={previewAttachment.dataUrl}
                  alt={previewAttachment.name}
                  className="max-h-[70vh] object-contain rounded-lg shadow-md"
                />
              ) : previewAttachment.type === 'pdf' || previewAttachment.name.endsWith('.pdf') ? (
                <iframe
                  src={previewAttachment.dataUrl}
                  title={previewAttachment.name}
                  className="w-full h-[65vh] border rounded-lg bg-white"
                />
              ) : (
                <div className="text-center p-6 space-y-3">
                  <Paperclip className="w-12 h-12 text-slate-400 mx-auto" />
                  <p className="text-sm font-bold text-slate-700">
                    Previsualización directa no disponible para este tipo de archivo.
                  </p>
                  <button
                    type="button"
                    onClick={() => downloadSingleAttachment(previewAttachment)}
                    className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition cursor-pointer"
                  >
                    Descargar para visualizar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
