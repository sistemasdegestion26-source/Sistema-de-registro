import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  Building2,
  FileSpreadsheet,
  FileText,
  Plus,
  Edit2,
  Trash2,
  Phone,
  FileCheck2,
  ShieldCheck,
  CheckCircle2,
  Send,
  Calendar,
  X,
  LayoutGrid,
  Table as TableIcon,
  Filter,
  Eye,
  RefreshCw,
} from 'lucide-react';
import { Funcionario, AppUser, ClasificacionDependencia } from '../types';
import { exportarExcelFuncionarios, exportarPDFFuncionarios } from '../utils/exportUtils';
import { formatFechaEspanol } from '../utils/storage';

interface DirectorioFuncionariosViewProps {
  currentUser: AppUser | null;
  funcionarios: Funcionario[];
  onOpenFuncionariosModal: () => void;
  onEditFuncionario?: (funcionario: Funcionario) => void;
  onDeleteFuncionario?: (id: string) => void;
  onRefresh?: () => void;
}

export const DirectorioFuncionariosView: React.FC<DirectorioFuncionariosViewProps> = ({
  currentUser,
  funcionarios,
  onOpenFuncionariosModal,
  onEditFuncionario,
  onDeleteFuncionario,
  onRefresh,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClasificacion, setFilterClasificacion] = useState<string>('TODAS');
  const [filterEstado, setFilterEstado] = useState<string>('TODOS');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [selectedFuncionarioModal, setSelectedFuncionarioModal] = useState<Funcionario | null>(null);

  const isPrimaryUser =
    currentUser?.role === 'PRIMARY_ADMIN' ||
    currentUser?.email === 'dg.municipiotianquillo@gmail.com' ||
    currentUser?.email === 'dg.municipiotinaquillo@gmail.com' ||
    currentUser?.email === 'sistemasdegestion26@gmail.com';

  // Stats
  const totalCount = funcionarios.length;
  const centralizadasCount = useMemo(
    () => funcionarios.filter((f) => f.clasificacion === 'CENTRALIZADA' || !f.clasificacion).length,
    [funcionarios]
  );
  const institutosCount = useMemo(
    () => funcionarios.filter((f) => f.clasificacion === 'INSTITUTO').length,
    [funcionarios]
  );
  const empresasCount = useMemo(
    () => funcionarios.filter((f) => f.clasificacion === 'EMPRESA').length,
    [funcionarios]
  );
  const conResolucionCount = useMemo(
    () => funcionarios.filter((f) => f.numeroResolucion && f.numeroResolucion.trim()).length,
    [funcionarios]
  );

  // Filtered List
  const filteredFuncionarios = useMemo(() => {
    let result = [...funcionarios];

    // Filter by Clasificación
    if (filterClasificacion !== 'TODAS') {
      result = result.filter((f) => (f.clasificacion || 'CENTRALIZADA') === filterClasificacion);
    }

    // Filter by Estado
    if (filterEstado !== 'TODOS') {
      result = result.filter((f) => (f.estado || 'ACTIVO') === filterEstado);
    }

    // Search query
    const q = searchTerm.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (f) =>
          f.nombresApellidos?.toLowerCase().includes(q) ||
          f.cedula?.toLowerCase().includes(q) ||
          f.dependencia?.toLowerCase().includes(q) ||
          f.cargo?.toLowerCase().includes(q) ||
          f.numeroResolucion?.toLowerCase().includes(q) ||
          f.telefono?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [funcionarios, searchTerm, filterClasificacion, filterEstado]);

  const handleExportExcel = () => {
    exportarExcelFuncionarios(filteredFuncionarios.length > 0 ? filteredFuncionarios : funcionarios);
  };

  const handleExportPdf = async () => {
    await exportarPDFFuncionarios(filteredFuncionarios.length > 0 ? filteredFuncionarios : funcionarios);
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* HEADER INSTITUCIONAL DEL DIRECTORIO */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-slate-700/80 relative overflow-hidden">
        {/* Tricolor accent bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-sky-500 to-emerald-500" />

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-bold uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>Directorio Municipal Oficial • Tinaquillo</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Directorio de Funcionarios Públicos Registrados
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Consulte la nómina oficial de Directores, Presidentes de Institutos y Empresas Públicas de la Alcaldía del Municipio Autónomo Tinaquillo. Los datos cargados se vinculan automáticamente a los informes de gestión y metas POA.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-600 font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-sm hover:text-white"
                title="Actualizar datos"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Actualizar</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleExportExcel}
              className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-md"
              title="Descargar Directorio en Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Descargar Excel</span>
            </button>

            <button
              type="button"
              onClick={handleExportPdf}
              className="px-3.5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-md"
              title="Descargar Nómina Oficial en PDF (.pdf)"
            >
              <FileText className="w-4 h-4" />
              <span>Descargar PDF</span>
            </button>

            {isPrimaryUser && (
              <button
                type="button"
                onClick={onOpenFuncionariosModal}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 transition cursor-pointer shadow-lg shadow-amber-500/20"
                title="Gestionar o registrar nuevos funcionarios"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Registrar Funcionario</span>
              </button>
            )}
          </div>
        </div>

        {/* METRICS STATS BAR */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 mt-6 border-t border-slate-700/60">
          <div className="p-3.5 bg-slate-800/80 rounded-2xl border border-slate-700/60 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30 font-black">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Registrados</p>
              <p className="text-xl font-black text-white">{totalCount}</p>
            </div>
          </div>

          <div className="p-3.5 bg-slate-800/80 rounded-2xl border border-slate-700/60 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0 border border-sky-500/30">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Centralizadas</p>
              <p className="text-xl font-black text-sky-300">{centralizadasCount}</p>
            </div>
          </div>

          <div className="p-3.5 bg-slate-800/80 rounded-2xl border border-slate-700/60 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/30">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Institutos</p>
              <p className="text-xl font-black text-indigo-300">{institutosCount}</p>
            </div>
          </div>

          <div className="p-3.5 bg-slate-800/80 rounded-2xl border border-slate-700/60 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Empresas</p>
              <p className="text-xl font-black text-emerald-300">{empresasCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* TOOLBAR: SEARCH & FILTERS */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/90 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3.5">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar funcionario por nombre, cédula, cargo, dependencia o resolución..."
            className="w-full pl-10 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:bg-white transition"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-2.5 p-1 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer"
              title="Borrar búsqueda"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filters and View toggles */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Clasificación Filter */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold text-slate-700">
            <Filter className="w-3.5 h-3.5 text-slate-500 ml-1.5" />
            <select
              value={filterClasificacion}
              onChange={(e) => setFilterClasificacion(e.target.value)}
              className="bg-transparent border-none text-xs font-bold text-slate-800 focus:outline-none cursor-pointer pr-1"
            >
              <option value="TODAS">Todos los Entes ({funcionarios.length})</option>
              <option value="CENTRALIZADA">Centralizadas ({centralizadasCount})</option>
              <option value="INSTITUTO">Institutos ({institutosCount})</option>
              <option value="EMPRESA">Empresas ({empresasCount})</option>
            </select>
          </div>

          {/* Estado Filter */}
          <select
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value)}
            className="px-3 py-2 bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
          >
            <option value="TODOS">Todos los Estados</option>
            <option value="ACTIVO">Activos</option>
            <option value="PROCESADO">Procesados</option>
            <option value="REMITIDO">Remitidos</option>
          </select>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'table'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Vista de Tabla"
            >
              <TableIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Tabla</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'cards'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Vista de Tarjetas"
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline">Fichas</span>
            </button>
          </div>
        </div>
      </div>

      {/* MAIN DATA DISPLAY */}
      {filteredFuncionarios.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-slate-300 shadow-sm space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
            <Users className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-800">
              No se encontraron funcionarios registrados
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {searchTerm || filterClasificacion !== 'TODAS' || filterEstado !== 'TODOS'
                ? 'Ningún funcionario coincide con los filtros aplicados. Intente restablecer los criterios de búsqueda.'
                : 'Aún no se han registrado funcionarios en la base de datos municipal.'}
            </p>
          </div>
          {searchTerm && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setFilterClasificacion('TODAS');
                setFilterEstado('TODOS');
              }}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Limpiar Filtros
            </button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE VIEW */
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white text-[11px] font-black uppercase tracking-wider">
                  <th className="py-3.5 px-4 text-center w-12">N°</th>
                  <th className="py-3.5 px-4">Funcionario Público</th>
                  <th className="py-3.5 px-4">Cédula</th>
                  <th className="py-3.5 px-4">Dependencia Municipal</th>
                  <th className="py-3.5 px-4">Cargo Oficial</th>
                  <th className="py-3.5 px-4">Resolución</th>
                  <th className="py-3.5 px-4">Contacto</th>
                  <th className="py-3.5 px-4 text-center">Estatus</th>
                  <th className="py-3.5 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredFuncionarios.map((func, index) => {
                  const clasifColor =
                    func.clasificacion === 'EMPRESA'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : func.clasificacion === 'INSTITUTO'
                      ? 'bg-indigo-100 text-indigo-800 border-indigo-300'
                      : 'bg-sky-100 text-sky-800 border-sky-300';

                  return (
                    <tr
                      key={func.id}
                      className="hover:bg-amber-50/40 transition-colors group"
                    >
                      <td className="py-3 px-4 text-center font-bold text-slate-400 text-[11px]">
                        {index + 1}
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-black text-xs flex items-center justify-center shrink-0 border border-slate-200">
                            {func.nombresApellidos ? func.nombresApellidos.charAt(0).toUpperCase() : 'F'}
                          </div>
                          <div>
                            <p className="font-black text-slate-900 leading-tight">
                              {func.nombresApellidos}
                            </p>
                            <span className="text-[10px] text-slate-400 font-mono">
                              ID: {func.id}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono font-bold text-slate-800">
                        {func.cedula || 'N/A'}
                      </td>

                      <td className="py-3 px-4">
                        <p className="font-bold text-slate-800 leading-tight">
                          {func.dependencia}
                        </p>
                        <span
                          className={`inline-block mt-0.5 text-[9px] px-1.5 py-0.2 rounded font-black tracking-wider uppercase border ${clasifColor}`}
                        >
                          {func.clasificacion || 'CENTRALIZADA'}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-semibold text-slate-700">
                        {func.cargo || 'DIRECTOR(A)'}
                      </td>

                      <td className="py-3 px-4 font-mono text-slate-600 text-[11px]">
                        {func.numeroResolucion ? (
                          <div>
                            <span className="font-bold text-slate-800">{func.numeroResolucion}</span>
                            {func.fechaResolucion && (
                              <p className="text-[10px] text-slate-400 font-sans">
                                {func.fechaResolucion}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">S/R</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-700">
                        {func.telefono ? (
                          <a
                            href={`tel:${func.telefono}`}
                            className="inline-flex items-center gap-1 text-slate-700 hover:text-amber-600 font-mono font-medium transition"
                          >
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{func.telefono}</span>
                          </a>
                        ) : (
                          <span className="text-slate-400 italic">S/T</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        {func.estado === 'PROCESADO' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-300">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Procesado
                          </span>
                        ) : func.estado === 'REMITIDO' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-bold border border-purple-300">
                            <Send className="w-3 h-3 text-purple-600" />
                            Remitido
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold border border-slate-300">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            Activo
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setSelectedFuncionarioModal(func)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                            title="Ver Ficha Oficial Completa"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {isPrimaryUser && (
                            <button
                              type="button"
                              onClick={() => {
                                if (onEditFuncionario) {
                                  onEditFuncionario(func);
                                } else {
                                  onOpenFuncionariosModal();
                                }
                              }}
                              className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                              title="Editar datos del funcionario"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}

                          {isPrimaryUser && onDeleteFuncionario && (
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`¿Está seguro de eliminar al funcionario ${func.nombresApellidos}?`)) {
                                  onDeleteFuncionario(func.id);
                                }
                              }}
                              className="p-1.5 text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="Eliminar funcionario"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* CARDS VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFuncionarios.map((func) => {
            const clasifBadge =
              func.clasificacion === 'EMPRESA'
                ? { bg: 'bg-emerald-50 text-emerald-800 border-emerald-200', text: 'Empresa Pública' }
                : func.clasificacion === 'INSTITUTO'
                ? { bg: 'bg-indigo-50 text-indigo-800 border-indigo-200', text: 'Instituto Autónomo' }
                : { bg: 'bg-sky-50 text-sky-800 border-sky-200', text: 'Dirección Centralizada' };

            return (
              <div
                key={func.id}
                className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/90 hover:border-amber-400/80 hover:shadow-md transition-all flex flex-col justify-between space-y-4 group"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className={`text-[10px] font-black tracking-wider uppercase px-2.5 py-0.5 rounded-full border ${clasifBadge.bg}`}
                    >
                      {clasifBadge.text}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-700 border border-slate-200">
                      {func.estado || 'ACTIVO'}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-black text-slate-900 group-hover:text-amber-800 transition">
                      {func.nombresApellidos}
                    </h3>
                    <p className="text-xs font-mono font-bold text-slate-600 mt-0.5">
                      C.I. {func.cedula || 'No registrada'}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 space-y-1.5 text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Dependencia
                      </span>
                      <span className="font-bold text-slate-800 leading-tight">
                        {func.dependencia}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Cargo Oficial
                      </span>
                      <span className="font-semibold text-slate-700">
                        {func.cargo || 'DIRECTOR(A)'}
                      </span>
                    </div>

                    {func.numeroResolucion && (
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Resolución Oficial
                        </span>
                        <span className="font-mono text-slate-800 text-[11px] font-bold">
                          {func.numeroResolucion}{' '}
                          {func.fechaResolucion ? `(${func.fechaResolucion})` : ''}
                        </span>
                      </div>
                    )}

                    {func.telefono && (
                      <div className="pt-1">
                        <a
                          href={`tel:${func.telefono}`}
                          className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-slate-700 hover:text-amber-600 transition"
                        >
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{func.telefono}</span>
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedFuncionarioModal(func)}
                    className="flex-1 py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Ver Ficha</span>
                  </button>

                  {isPrimaryUser && (
                    <button
                      type="button"
                      onClick={() => {
                        if (onEditFuncionario) {
                          onEditFuncionario(func);
                        } else {
                          onOpenFuncionariosModal();
                        }
                      }}
                      className="py-1.5 px-3 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-amber-700" />
                      <span>Editar</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL DETALLE / FICHA COMPLETA DEL FUNCIONARIO */}
      {selectedFuncionarioModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden space-y-0">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-5 text-white flex items-center justify-between border-b border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-400 flex items-center justify-center font-black">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white leading-tight">
                    Ficha Oficial del Funcionario
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    Alcaldía del Municipio Autónomo Tinaquillo
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFuncionarioModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Nombres y Apellidos
                </span>
                <p className="text-lg font-black text-slate-900">
                  {selectedFuncionarioModal.nombresApellidos}
                </p>
                <p className="text-xs font-mono font-bold text-slate-600">
                  Cédula: {selectedFuncionarioModal.cedula}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Cargo Oficial
                  </span>
                  <p className="font-bold text-slate-800 mt-0.5">
                    {selectedFuncionarioModal.cargo || 'DIRECTOR(A)'}
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Clasificación
                  </span>
                  <p className="font-bold text-slate-800 mt-0.5">
                    {selectedFuncionarioModal.clasificacion || 'CENTRALIZADA'}
                  </p>
                </div>

                <div className="col-span-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Dependencia Municipal
                  </span>
                  <p className="font-black text-slate-900 mt-0.5">
                    {selectedFuncionarioModal.dependencia}
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    N° de Resolución
                  </span>
                  <p className="font-mono font-bold text-slate-800 mt-0.5">
                    {selectedFuncionarioModal.numeroResolucion || 'No asignada'}
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Fecha de Emisión
                  </span>
                  <p className="font-medium text-slate-700 mt-0.5">
                    {selectedFuncionarioModal.fechaResolucion
                      ? formatFechaEspanol(selectedFuncionarioModal.fechaResolucion)
                      : 'No especificada'}
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Teléfono
                  </span>
                  <p className="font-mono font-bold text-slate-800 mt-0.5">
                    {selectedFuncionarioModal.telefono || 'Sin teléfono'}
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Estatus
                  </span>
                  <p className="font-bold text-emerald-700 mt-0.5">
                    {selectedFuncionarioModal.estado || 'ACTIVO'}
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-100 p-4 border-t border-slate-200 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-medium">
                Alcaldía del Municipio Autónomo Tinaquillo
              </span>
              <button
                type="button"
                onClick={() => setSelectedFuncionarioModal(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cerrar Ficha
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
