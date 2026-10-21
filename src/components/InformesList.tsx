import React, { useState, useMemo } from 'react';
import {
  Building2,
  Plus,
  Search,
  FileText,
  Calendar,
  Eye,
  Trash2,
  Edit,
  FileDown,
  CheckCircle2,
  Send,
  Clock,
  ArrowRight,
  X,
  AlertTriangle,
  UserCheck,
  Check,
  Filter,
  Download,
  ExternalLink,
  Image as ImageIcon,
} from 'lucide-react';
import { InformeDependencia, AppUser, EstadoInforme } from '../types';
import { exportarPDFInformeIndividual } from '../utils/exportUtils';
import { DEPENDENCIAS_MUNICIPALES } from '../data/dependenciasData';
import { getStoredUser } from '../utils/storage';

interface InformesListProps {
  informes: InformeDependencia[];
  currentUser?: AppUser | null;
  onNewInforme: () => void;
  onEditInforme: (informe: InformeDependencia) => void;
  onDeleteInforme: (id: string) => void;
  onUpdateInformeEstado?: (
    id: string,
    nuevoEstado: EstadoInforme,
    detalles?: { remitidoA?: string; motivo?: string; observacion?: string }
  ) => void;
}

export const InformesList: React.FC<InformesListProps> = ({
  informes,
  currentUser,
  onNewInforme,
  onEditInforme,
  onDeleteInforme,
  onUpdateInformeEstado,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipo, setFilterTipo] = useState('TODOS');
  const [filterEstado, setFilterEstado] = useState<'TODOS' | EstadoInforme>('TODOS');
  const [selectedDetail, setSelectedDetail] = useState<InformeDependencia | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // Determine user privilege: Primary Admin vs Secondary User
  const activeUser = currentUser || (typeof window !== 'undefined' ? getStoredUser() : null);
  const isPrimaryUser =
    activeUser?.role === 'PRIMARY_ADMIN' ||
    activeUser?.email?.toLowerCase() === 'dg.municipiotianquillo@gmail.com' ||
    activeUser?.email?.toLowerCase() === 'dg.municipiotinaquillo@gmail.com' ||
    activeUser?.email?.toLowerCase() === 'sistemasdegestion26@gmail.com';

  // Modals state
  const [processModalTarget, setProcessModalTarget] = useState<InformeDependencia | null>(null);
  const [processObservacion, setProcessObservacion] = useState('');

  const [remitModalTarget, setRemitModalTarget] = useState<InformeDependencia | null>(null);
  const [remitDestino, setRemitDestino] = useState(DEPENDENCIAS_MUNICIPALES[0]?.nombre || 'DIRECCIÓN GENERAL');
  const [remitMotivo, setRemitMotivo] = useState('');

  const [deleteModalTarget, setDeleteModalTarget] = useState<InformeDependencia | null>(null);

  // Status counts for badge filters
  const stats = useMemo(() => {
    let pendientes = 0;
    let procesados = 0;
    let remitidos = 0;
    informes.forEach((inf) => {
      const st = inf.estado || 'PENDIENTE';
      if (st === 'PROCESADO') procesados++;
      else if (st === 'REMITIDO') remitidos++;
      else pendientes++;
    });
    return { pendientes, procesados, remitidos, total: informes.length };
  }, [informes]);

  const filtered = useMemo(() => {
    return informes.filter((inf) => {
      const currentEst: EstadoInforme = inf.estado || 'PENDIENTE';
      if (isPrimaryUser && filterEstado !== 'TODOS' && currentEst !== filterEstado) return false;
      if (filterTipo !== 'TODOS') {
        const matchesType =
          inf.tipoInforme === filterTipo ||
          ((filterTipo === 'MEMORANDUM INTERNO' || filterTipo === 'REGISTRO DE COMUNICACIÓN INTERNA DE DIRECTORIO') &&
            (inf.tipoInforme === 'MEMORANDUM INTERNO' || inf.tipoInforme === 'REGISTRO DE COMUNICACIÓN INTERNA DE DIRECTORIO')) ||
          (filterTipo === 'INFORME PARCIAL DE AUDITORIA' &&
            inf.tipoInforme === 'INFORME PARCIAL DE LA AUDITORIA OPERATIVA DE LA CONTRALORÍA MUNICIPAL');
        if (!matchesType) return false;
      }
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        return (
          inf.dependencia.toLowerCase().includes(q) ||
          inf.nombresApellidos.toLowerCase().includes(q) ||
          inf.cedula.toLowerCase().includes(q) ||
          inf.tipoInforme.toLowerCase().includes(q) ||
          (inf.remitidoA && inf.remitidoA.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [informes, filterEstado, filterTipo, searchTerm, isPrimaryUser]);

  // Execute processing - Only primary user
  const handleConfirmProcess = () => {
    if (!isPrimaryUser || !processModalTarget) return;
    if (onUpdateInformeEstado) {
      onUpdateInformeEstado(processModalTarget.id, 'PROCESADO', {
        observacion: processObservacion.trim() || 'Informe revisado y procesado satisfactoriamente por la administración municipal.',
      });
    }
    setProcessModalTarget(null);
    setProcessObservacion('');
  };

  // Execute remitting - Only primary user
  const handleConfirmRemit = () => {
    if (!isPrimaryUser || !remitModalTarget) return;
    if (onUpdateInformeEstado) {
      onUpdateInformeEstado(remitModalTarget.id, 'REMITIDO', {
        remitidoA: remitDestino,
        motivo: remitMotivo.trim() || 'Remisión institucional para conocimiento, archivo y seguimiento.',
      });
    }
    setRemitModalTarget(null);
    setRemitMotivo('');
  };

  // Execute deletion
  const handleConfirmDelete = () => {
    if (!deleteModalTarget) return;
    onDeleteInforme(deleteModalTarget.id);
    setDeleteModalTarget(null);
    if (selectedDetail?.id === deleteModalTarget.id) {
      setSelectedDetail(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Top Banner with primary action */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-zinc-900 text-white rounded-2xl p-5 sm:p-6 shadow-md border border-slate-700/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
            Control Institucional de Informes
          </span>
          <h2 className="font-institutional text-xl sm:text-2xl font-bold tracking-wide mt-0.5 text-white">
            Informes de Dependencias e Institutos
          </h2>
          <p className="text-xs text-slate-300">
            {isPrimaryUser
              ? 'Cargue, edite, procese, remita y gestione los informes de gestión y registros de comunicación interna de directorio de la Alcaldía.'
              : 'Cargue, edite y consulte los informes de gestión y registros de comunicación interna de directorio de la Alcaldía.'}
          </p>
        </div>

        <button
          id="btn-nuevo-informe-banner"
          onClick={onNewInforme}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs sm:text-sm font-black shadow-md transition cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Cargar Nuevo Informe</span>
        </button>
      </div>

      {/* Filter and Stats Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
        {/* Quick status tabs - Exclusivo usuario principal para filtrar por estados */}
        {isPrimaryUser && (
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
            <button
              type="button"
              onClick={() => setFilterEstado('TODOS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                filterEstado === 'TODOS'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>Todos</span>
              <span className="px-1.5 py-0.2 rounded-md bg-white/20 text-[10px]">{stats.total}</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterEstado('PENDIENTE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                filterEstado === 'PENDIENTE'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Pendientes</span>
              <span className="px-1.5 py-0.2 rounded-md bg-amber-200/60 text-[10px]">{stats.pendientes}</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterEstado('PROCESADO')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                filterEstado === 'PROCESADO'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Procesados</span>
              <span className="px-1.5 py-0.2 rounded-md bg-emerald-200/60 text-[10px]">{stats.procesados}</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterEstado('REMITIDO')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                filterEstado === 'REMITIDO'
                  ? 'bg-purple-700 text-white shadow-xs'
                  : 'bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>Remitidos</span>
              <span className="px-1.5 py-0.2 rounded-md bg-purple-200/60 text-[10px]">{stats.remitidos}</span>
            </button>
          </div>
        )}

        {/* Search and Type Filter */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por dependencia, responsable, remitido a..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-emerald-600 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-600"
            >
              <option value="TODOS">Todos los Tipos de Informe</option>
              <option value="REGISTRO DE COMUNICACIÓN INTERNA DE DIRECTORIO">Registro de Comunicación Interna de Directorio</option>
              <option value="REPORTE DE GESTIÓN TRIMESTRAL">Reporte Trimestral</option>
              <option value="INFORME PARCIAL DE AUDITORIA">
                Informe Parcial de Auditoría
              </option>
              <option value="INFORME DE AUDITORÍA DEFINITIVO">Auditoría Definitiva</option>
            </select>
          </div>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-slate-200 p-8 space-y-3">
            <FileText className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-slate-700 font-bold text-sm">
              No se encontraron informes de gestión con los filtros seleccionados.
            </p>
            <p className="text-slate-500 text-xs max-w-sm mx-auto">
              Puede registrar un nuevo informe haciendo clic en el botón a continuación.
            </p>
            <button
              onClick={onNewInforme}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Cargar Nuevo Informe</span>
            </button>
          </div>
        ) : (
          filtered.map((inf) => {
            const estadoActual: EstadoInforme = inf.estado || 'PENDIENTE';
            return (
              <div
                key={inf.id}
                id={`card-informe-${inf.id}`}
                className="p-4 bg-white rounded-2xl border border-slate-200 hover:border-slate-300 shadow-xs hover:shadow-md transition flex flex-col justify-between space-y-3"
              >
                <div>
                  {/* Top tags: Tipo + Estado */}
                  <div className="flex items-center justify-between gap-1.5 mb-2">
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-sky-100 text-sky-800 truncate">
                      {inf.tipoInforme === 'REPORTE DE GESTIÓN TRIMESTRAL'
                        ? 'Trimestral'
                        : inf.tipoInforme === 'MEMORANDUM INTERNO' || inf.tipoInforme === 'REGISTRO DE COMUNICACIÓN INTERNA DE DIRECTORIO'
                        ? 'Com. Interna'
                        : 'Auditoría'}
                    </span>

                    {/* Estado Badge */}
                    {estadoActual === 'PROCESADO' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Procesado
                      </span>
                    )}
                    {estadoActual === 'REMITIDO' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-300 truncate max-w-[130px]">
                        <Send className="w-3 h-3 text-purple-600 shrink-0" />
                        <span className="truncate">Remitido</span>
                      </span>
                    )}
                    {estadoActual === 'PENDIENTE' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                        <Clock className="w-3 h-3 text-amber-600" />
                        Pendiente
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-black text-slate-900 leading-snug mb-1">
                    {inf.dependencia}
                  </h3>

                  <p className="text-xs text-slate-700 font-semibold">
                    {inf.nombresApellidos}
                  </p>
                  <p className="text-[11px] text-slate-400 font-mono mb-1.5">
                    {inf.cargo ? `${inf.cargo} • ` : ''}{inf.cedula}
                  </p>

                  {inf.numeroResolucion && (
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 mb-2 rounded bg-amber-50 border border-amber-200 text-amber-900 text-[10px] font-semibold">
                      <span>Res: {inf.numeroResolucion}</span>
                      {inf.fechaResolucion && <span className="text-amber-700">({inf.fechaResolucion})</span>}
                    </div>
                  )}

                  {/* Remisión Info if applicable */}
                  {estadoActual === 'REMITIDO' && inf.remitidoA && (
                    <div className="p-2 mb-2 rounded-xl bg-purple-50 border border-purple-200 text-[11px] text-purple-900 space-y-0.5">
                      <div className="font-bold flex items-center gap-1 text-purple-800">
                        <ArrowRight className="w-3 h-3 text-purple-600" />
                        <span>Remitido a: {inf.remitidoA}</span>
                      </div>
                      {inf.motivoRemision && (
                        <p className="text-[10px] text-purple-700 line-clamp-1">{inf.motivoRemision}</p>
                      )}
                    </div>
                  )}

                  {/* Procesado Info if applicable */}
                  {estadoActual === 'PROCESADO' && (
                    <div className="p-2 mb-2 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900 space-y-0.5">
                      <div className="font-bold flex items-center gap-1 text-emerald-800">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Expediente Procesado y Verificado</span>
                      </div>
                      {inf.observacionProceso && (
                        <p className="text-[10px] text-emerald-700 line-clamp-1">{inf.observacionProceso}</p>
                      )}
                    </div>
                  )}

                  <p className="text-xs text-slate-600 line-clamp-2">
                    {inf.actividadesEjecutadas || inf.descripcionBreve || inf.descripcionDetallada || inf.hallazgos || inf.punto1 || ''}
                  </p>
                </div>

                {/* Bottom Action Toolbar: Cargar (subir archivo o ver detalle), Editar, Procesar, Remitir, Eliminar */}
                <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="text-[11px] font-mono">
                      {inf.fechaRegistro ? inf.fechaRegistro.split('T')[0] : 'S/F'}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">{inf.id}</span>
                  </div>

                  {/* Primary interactive buttons for: Editar, Procesar (solo principal), Remitir (solo principal), Eliminar */}
                  <div className={`grid ${isPrimaryUser ? 'grid-cols-4' : 'grid-cols-2'} gap-1.5`}>
                    {/* Botón Editar */}
                    <button
                      type="button"
                      onClick={() => onEditInforme(inf)}
                      className="flex items-center justify-center gap-1 py-1.5 px-2 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 hover:border-emerald-300 rounded-lg text-[11px] font-bold transition cursor-pointer"
                      title="Editar datos de este informe"
                    >
                      <Edit className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Editar</span>
                    </button>

                    {/* Botón Procesar - Exclusivo usuario principal */}
                    {isPrimaryUser && (
                      <button
                        type="button"
                        onClick={() => {
                          setProcessModalTarget(inf);
                          setProcessObservacion(inf.observacionProceso || '');
                        }}
                        className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition cursor-pointer border ${
                          estadoActual === 'PROCESADO'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                            : 'bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border-slate-200 hover:border-emerald-300'
                        }`}
                        title="Procesar y validar informe"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Procesar</span>
                      </button>
                    )}

                    {/* Botón Remitir - Exclusivo usuario principal */}
                    {isPrimaryUser && (
                      <button
                        type="button"
                        onClick={() => {
                          setRemitModalTarget(inf);
                          setRemitDestino(inf.remitidoA || DEPENDENCIAS_MUNICIPALES[0]?.nombre || 'DIRECCIÓN GENERAL');
                          setRemitMotivo(inf.motivoRemision || '');
                        }}
                        className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition cursor-pointer border ${
                          estadoActual === 'REMITIDO'
                            ? 'bg-purple-50 text-purple-800 border-purple-300 hover:bg-purple-100'
                            : 'bg-slate-100 hover:bg-purple-50 text-slate-700 hover:text-purple-800 border-slate-200 hover:border-purple-300'
                        }`}
                        title="Remitir informe a otra dependencia"
                      >
                        <Send className="w-3.5 h-3.5 text-purple-600" />
                        <span>Remitir</span>
                      </button>
                    )}

                    {/* Botón Eliminar */}
                    <button
                      type="button"
                      onClick={() => setDeleteModalTarget(inf)}
                      className="flex items-center justify-center gap-1 py-1.5 px-2 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-300 rounded-lg text-[11px] font-bold transition cursor-pointer"
                      title="Eliminar este informe"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      <span>Eliminar</span>
                    </button>
                  </div>

                  {/* Secondary buttons: Exportar PDF (solo usuario principal) y Ver Detalle */}
                  <div className="flex items-center justify-end gap-1.5 pt-1">
                    {isPrimaryUser && (
                      <button
                        type="button"
                        onClick={() => exportarPDFInformeIndividual(inf)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg text-[11px] font-medium transition cursor-pointer"
                        title="Exportar PDF oficial con escudo"
                      >
                        <FileDown className="w-3.5 h-3.5 text-emerald-600" />
                        <span>PDF</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setSelectedDetail(inf)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-600 hover:text-sky-700 hover:bg-sky-50 rounded-lg text-[11px] font-medium transition cursor-pointer"
                      title="Ver todos los detalles del informe"
                    >
                      <Eye className="w-3.5 h-3.5 text-sky-600" />
                      <span>Ver</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Procesar Informe (Exclusivo Usuario Principal) */}
      {processModalTarget && isPrimaryUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Procesar Informe</h3>
                  <p className="text-xs text-slate-500">{processModalTarget.dependencia}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setProcessModalTarget(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <p className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                Al marcar este informe como <strong>PROCESADO</strong>, quedará registrado con estatus completado y validado en el sistema institucional de la Dirección General.
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Observaciones de Procesamiento / Validación
                </label>
                <textarea
                  rows={3}
                  value={processObservacion}
                  onChange={(e) => setProcessObservacion(e.target.value)}
                  placeholder="Escriba comentarios u observaciones sobre la revisión del informe..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-emerald-600 focus:bg-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setProcessModalTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmProcess}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-sm"
              >
                <Check className="w-4 h-4" />
                <span>Confirmar Procesamiento</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Remitir Informe (Exclusivo Usuario Principal) */}
      {remitModalTarget && isPrimaryUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Remitir Informe</h3>
                  <p className="text-xs text-slate-500">{remitModalTarget.dependencia}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRemitModalTarget(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Dependencia o Entidad Receptora <span className="text-rose-500">*</span>
                </label>
                <select
                  value={remitDestino}
                  onChange={(e) => setRemitDestino(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-purple-600"
                >
                  <option value="DESPACHO DEL ALCALDE">DESPACHO DEL ALCALDE</option>
                  <option value="DIRECCIÓN GENERAL">DIRECCIÓN GENERAL</option>
                  <option value="SINDICATURA MUNICIPAL">SINDICATURA MUNICIPAL</option>
                  <option value="CONTRALORÍA MUNICIPAL">CONTRALORÍA MUNICIPAL</option>
                  <option value="DIRECCIÓN DE ADMINISTRACIÓN Y FINANZAS">DIRECCIÓN DE ADMINISTRACIÓN Y FINANZAS</option>
                  <option value="DIRECCIÓN DE TALENTO HUMANO">DIRECCIÓN DE TALENTO HUMANO</option>
                  <option value="DIRECCIÓN DE PLANIFICACIÓN Y PRESUPUESTO">DIRECCIÓN DE PLANIFICACIÓN Y PRESUPUESTO</option>
                  {DEPENDENCIAS_MUNICIPALES.map((d) => (
                    <option key={d.id} value={d.nombre}>
                      {d.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Motivo de Remisión o Instrucción
                </label>
                <textarea
                  rows={3}
                  value={remitMotivo}
                  onChange={(e) => setRemitMotivo(e.target.value)}
                  placeholder="Indique el motivo de la remisión, solicitud de aval o instrucciones de despacho..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-purple-600 focus:bg-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setRemitModalTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmRemit}
                className="flex items-center gap-1.5 px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-sm"
              >
                <Send className="w-4 h-4" />
                <span>Confirmar Remisión</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Eliminar Informe con Confirmación In-App */}
      {deleteModalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">¿Eliminar este Informe?</h4>
                <p className="text-xs text-slate-500">Expediente {deleteModalTarget.id}</p>
              </div>
            </div>

            <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200 leading-relaxed">
              ¿Está seguro de eliminar de forma permanente el informe de{' '}
              <strong className="font-bold text-slate-900">{deleteModalTarget.dependencia}</strong>? Esta acción removerá el registro tanto del dispositivo local como del servidor central.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setDeleteModalTarget(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition cursor-pointer shadow-sm"
              >
                Eliminar Permanentemente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalle Completo */}
      {selectedDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="text-[10px] font-bold text-sky-700 uppercase">
                  {selectedDetail.tipoInforme}
                </span>
                <h3 className="font-black text-slate-900 text-base">{selectedDetail.dependencia}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDetail(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick action bar inside modal */}
            <div className={`grid ${isPrimaryUser ? 'grid-cols-4' : 'grid-cols-2'} gap-2 p-2 bg-slate-50 rounded-xl border border-slate-200`}>
              <button
                type="button"
                onClick={() => {
                  const inf = selectedDetail;
                  setSelectedDetail(null);
                  onEditInforme(inf);
                }}
                className="flex items-center justify-center gap-1 py-1.5 px-2 bg-white text-slate-700 hover:text-emerald-700 rounded-lg border border-slate-200 text-xs font-bold transition cursor-pointer"
              >
                <Edit className="w-3.5 h-3.5 text-emerald-600" />
                <span>Editar</span>
              </button>

              {isPrimaryUser && (
                <button
                  type="button"
                  onClick={() => {
                    setProcessModalTarget(selectedDetail);
                    setProcessObservacion(selectedDetail.observacionProceso || '');
                  }}
                  className="flex items-center justify-center gap-1 py-1.5 px-2 bg-white text-slate-700 hover:text-emerald-700 rounded-lg border border-slate-200 text-xs font-bold transition cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Procesar</span>
                </button>
              )}

              {isPrimaryUser && (
                <button
                  type="button"
                  onClick={() => {
                    setRemitModalTarget(selectedDetail);
                    setRemitDestino(selectedDetail.remitidoA || DEPENDENCIAS_MUNICIPALES[0]?.nombre || 'DIRECCIÓN GENERAL');
                    setRemitMotivo(selectedDetail.motivoRemision || '');
                  }}
                  className="flex items-center justify-center gap-1 py-1.5 px-2 bg-white text-slate-700 hover:text-purple-700 rounded-lg border border-slate-200 text-xs font-bold transition cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5 text-purple-600" />
                  <span>Remitir</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setDeleteModalTarget(selectedDetail)}
                className="flex items-center justify-center gap-1 py-1.5 px-2 bg-white text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-200 text-xs font-bold transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                <span>Eliminar</span>
              </button>
            </div>

            <div className="text-xs space-y-2 text-slate-700">
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Estado Actual</span>
                  <span className="font-bold text-slate-900">{selectedDetail.estado || 'PENDIENTE'}</span>
                </div>
                {selectedDetail.remitidoA && (
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Remitido a</span>
                    <span className="font-bold text-purple-800">{selectedDetail.remitidoA}</span>
                  </div>
                )}
                {selectedDetail.fechaProcesado && (
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Fecha de Proceso</span>
                    <span className="font-bold text-emerald-800">{selectedDetail.fechaProcesado.split('T')[0]}</span>
                  </div>
                )}
              </div>

              <p><strong>Clasificación:</strong> {selectedDetail.clasificacion || 'CENTRALIZADA'}</p>
              <p><strong>Funcionario:</strong> {selectedDetail.nombresApellidos} ({selectedDetail.cedula})</p>
              <p><strong>Cargo:</strong> {selectedDetail.cargo || 'N/A'}</p>
              <p><strong>Teléfono:</strong> {selectedDetail.telefono}</p>
              {selectedDetail.numeroResolucion && (
                <p><strong>Resolución:</strong> {selectedDetail.numeroResolucion} {selectedDetail.fechaResolucion ? `(${selectedDetail.fechaResolucion})` : ''}</p>
              )}

              {/* Registro de Comunicación Interna de Directorio / Memorandum Details */}
              {(selectedDetail.tipoInforme === 'MEMORANDUM INTERNO' || selectedDetail.tipoInforme === 'REGISTRO DE COMUNICACIÓN INTERNA DE DIRECTORIO') && (
                <div className="space-y-2 pt-1 border-t border-slate-100">
                  {selectedDetail.punto1 && (
                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                      <strong className="text-slate-900 block mb-1">Punto 1:</strong>
                      <p className="whitespace-pre-line text-slate-700">{selectedDetail.punto1}</p>
                    </div>
                  )}
                  {selectedDetail.punto2 && (
                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                      <strong className="text-slate-900 block mb-1">Punto 2:</strong>
                      <p className="whitespace-pre-line text-slate-700">{selectedDetail.punto2}</p>
                    </div>
                  )}
                  {selectedDetail.puntosAdicionales && selectedDetail.puntosAdicionales.length > 0 && (
                    <div className="space-y-1.5">
                      {selectedDetail.puntosAdicionales.map((p, idx) => (
                        <div key={idx} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                          <strong className="text-slate-900 block mb-1">Punto Adicional #{idx + 3}:</strong>
                          <p className="whitespace-pre-line text-slate-700">{p}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {selectedDetail.fotoFirmaPersonal && selectedDetail.fotoFirmaPersonal.length > 0 && (
                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <strong className="text-emerald-950 font-black text-xs flex items-center gap-1.5">
                          <ImageIcon className="w-4 h-4 text-emerald-700" />
                          <span>Lista de Firmas del Personal Digitalizada:</span>
                        </strong>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200/70 text-emerald-900">
                          {selectedDetail.fotoFirmaPersonal.length} foto(s)
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {selectedDetail.fotoFirmaPersonal.map((foto, fIdx) => (
                          <div
                            key={fIdx}
                            className="group relative rounded-xl overflow-hidden border border-emerald-300 bg-white shadow-2xs hover:shadow-md transition aspect-4/3 cursor-pointer"
                            onClick={() => setZoomedImage(foto.dataUrl)}
                          >
                            <img
                              src={foto.dataUrl}
                              alt={foto.name || `Firma ${fIdx + 1}`}
                              className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                            />
                            <div className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                              <span className="p-1 rounded-full bg-white text-slate-900 text-xs shadow-xs" title="Ver foto">
                                <Eye className="w-3.5 h-3.5" />
                              </span>
                              <a
                                href={foto.dataUrl}
                                download={foto.name || `firma_personal_${fIdx + 1}.jpg`}
                                onClick={(e) => e.stopPropagation()}
                                className="p-1 rounded-full bg-emerald-600 text-white text-xs shadow-xs hover:bg-emerald-700"
                                title="Descargar foto"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Gestión Trimestral Details */}
              {selectedDetail.tipoInforme === 'REPORTE DE GESTIÓN TRIMESTRAL' && (
                <div className="space-y-2 pt-1 border-t border-slate-100">
                  <p><strong>Período:</strong> {selectedDetail.trimestre} - {selectedDetail.anioGestion}</p>
                  {selectedDetail.descripcionBreve && (
                    <div>
                      <strong>Descripción Breve del Período:</strong>
                      <p className="mt-1 p-2.5 bg-slate-50 rounded-lg border border-slate-200 whitespace-pre-line text-slate-800">{selectedDetail.descripcionBreve}</p>
                    </div>
                  )}
                  {(() => {
                    const docs = selectedDetail.adjuntoInformeTrimestral || selectedDetail.adjuntoInforme || [];
                    if (!docs || docs.length === 0) return null;
                    return (
                      <div className="p-3 bg-sky-50 rounded-xl border border-sky-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <strong className="text-sky-950 font-black text-xs flex items-center gap-1.5">
                            <FileText className="w-4 h-4 text-sky-700" />
                            <span>Documentos y Evidencias Digitales Adjuntas:</span>
                          </strong>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-200/70 text-sky-900">
                            {docs.length} archivo(s)
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {docs.map((doc, dIdx) => (
                            <div
                              key={dIdx}
                              className="flex items-center justify-between p-2 bg-white rounded-lg border border-sky-200 gap-2"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <FileText className="w-4 h-4 text-sky-600 shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-slate-900 truncate" title={doc.name}>
                                    {doc.name}
                                  </p>
                                  <p className="text-[10px] text-slate-500">
                                    {(doc.size / 1024).toFixed(1)} KB
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {doc.dataUrl && (
                                  <a
                                    href={doc.dataUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1 text-slate-600 hover:text-sky-700 hover:bg-sky-50 rounded-md transition"
                                    title="Ver / Abrir archivo"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                )}
                                {doc.dataUrl && (
                                  <a
                                    href={doc.dataUrl}
                                    download={doc.name || `archivo_${dIdx + 1}`}
                                    className="flex items-center gap-1 px-2 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded-md text-[10.5px] font-bold transition shadow-2xs"
                                    title="Descargar archivo"
                                  >
                                    <Download className="w-3 h-3" />
                                    <span>Descargar</span>
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Auditoría Interna Files */}
              {selectedDetail.archivosAuditoria && selectedDetail.archivosAuditoria.length > 0 && (
                <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 space-y-2">
                  <strong className="text-purple-950 font-black text-xs flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-purple-700" />
                    <span>Evidencias de Auditoría Adjuntas:</span>
                  </strong>
                  <div className="space-y-1.5">
                    {selectedDetail.archivosAuditoria.map((doc, aIdx) => (
                      <div key={aIdx} className="flex items-center justify-between p-2 bg-white rounded-lg border border-purple-200 gap-2">
                        <span className="text-xs font-bold text-slate-800 truncate">{doc.name}</span>
                        {doc.dataUrl && (
                          <a
                            href={doc.dataUrl}
                            download={doc.name || `evidencia_${aIdx + 1}`}
                            className="flex items-center gap-1 px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-[10px] font-bold transition"
                          >
                            <Download className="w-3 h-3" />
                            <span>Descargar</span>
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedDetail.actividadesEjecutadas && (
                <div>
                  <strong>Actividades Ejecutadas:</strong>
                  <p className="mt-1 p-2 bg-slate-50 rounded-lg">{selectedDetail.actividadesEjecutadas}</p>
                </div>
              )}
              {selectedDetail.logrosAlcanzados && (
                <div>
                  <strong>Logros Alcanzados:</strong>
                  <p className="mt-1 p-2 bg-slate-50 rounded-lg">{selectedDetail.logrosAlcanzados}</p>
                </div>
              )}
            </div>

            <div className="pt-3 border-t flex items-center justify-between gap-3">
              {isPrimaryUser ? (
                <button
                  type="button"
                  onClick={() => exportarPDFInformeIndividual(selectedDetail)}
                  className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer"
                >
                  <FileDown className="w-4 h-4" />
                  <span>Descargar PDF (con Escudo)</span>
                </button>
              ) : (
                <div />
              )}
              <button
                type="button"
                onClick={() => setSelectedDetail(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX: ZOOM DE FOTO DE FIRMA */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-60 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setZoomedImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-2xl p-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-2 px-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-700">Evidencia Fotográfica de Firmas del Personal</span>
              <div className="flex items-center gap-2">
                <a
                  href={zoomedImage}
                  download="firma_personal_ampliada.jpg"
                  className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar</span>
                </a>
                <button
                  type="button"
                  onClick={() => setZoomedImage(null)}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="overflow-auto max-h-[80vh] flex items-center justify-center p-2 bg-slate-950/5">
              <img src={zoomedImage} alt="Firma ampliada" className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-sm" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
