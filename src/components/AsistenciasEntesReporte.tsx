import React, { useState, useMemo } from 'react';
import {
  Users,
  Building2,
  Calendar,
  FileDown,
  FileSpreadsheet,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowUpDown,
  ChevronRight,
  ExternalLink,
  Layers,
  MapPin,
  Eye,
  X,
  Plus,
} from 'lucide-react';
import { RegistroAsistencia, ClasificacionDependencia, DependenciaConfig } from '../types';
import { DEPENDENCIAS_MUNICIPALES } from '../data/dependenciasData';
import { exportarPDFAsistenciasPorEntes, exportarExcelAsistenciasPorEntes } from '../utils/exportUtils';

interface AsistenciasEntesReporteProps {
  asistencias: RegistroAsistencia[];
  onNewAsistencia?: () => void;
}

export const AsistenciasEntesReporte: React.FC<AsistenciasEntesReporteProps> = ({
  asistencias,
  onNewAsistencia,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<string>('TODOS');
  const [filtroEstado, setFiltroEstado] = useState<'TODOS' | 'CON_ASISTENCIA' | 'SIN_ASISTENCIA'>('TODOS');
  const [selectedEnteDetalle, setSelectedEnteDetalle] = useState<{
    dependencia: DependenciaConfig;
    actividades: { actividad: RegistroAsistencia; asistente: any }[];
  } | null>(null);

  // Calculate detailed stats per municipal entity
  const entesCalculados = useMemo(() => {
    return DEPENDENCIAS_MUNICIPALES.map((dep, idx) => {
      const depKey = dep.nombre.toUpperCase().trim();
      const matchedActividades: { actividad: RegistroAsistencia; asistente: any }[] = [];

      asistencias.forEach((act) => {
        act.asistentes.forEach((asist) => {
          const asistDep = (asist.dependencia || '').toUpperCase().trim();
          if (asistDep === depKey) {
            matchedActividades.push({ actividad: act, asistente: asist });
          }
        });
      });

      const uniqueActs = Array.from(new Set(matchedActividades.map((m) => m.actividad.id)));
      const cantActividades = uniqueActs.length;
      const tieneAsistencia = cantActividades > 0;
      const totalAsistentes = matchedActividades.length;

      // Sort activities desc by date
      const sortedMatches = [...matchedActividades].sort((a, b) =>
        (b.actividad.fecha || '').localeCompare(a.actividad.fecha || '')
      );
      const ultimaActividad = sortedMatches.length > 0 ? sortedMatches[0].actividad : null;

      // Unique officials names
      const funcionarios = Array.from(
        new Set(matchedActividades.map((m) => m.asistente.nombresApellidos))
      ).filter(Boolean);

      return {
        n: idx + 1,
        dependencia: dep,
        nombre: dep.nombre,
        tipo: dep.tipo,
        tieneAsistencia,
        cantActividades,
        totalAsistentes,
        ultimaFecha: ultimaActividad ? ultimaActividad.fecha : null,
        ultimaActividadNombre: ultimaActividad ? ultimaActividad.nombreActividad : null,
        funcionarios,
        matchedActividades: sortedMatches,
      };
    });
  }, [asistencias]);

  // Overall KPIs
  const kpis = useMemo(() => {
    const totalActividades = asistencias.length;
    const centralizadas = entesCalculados.filter((e) => e.tipo === 'CENTRALIZADA');
    const empresas = entesCalculados.filter((e) => e.tipo === 'EMPRESA');
    const institutos = entesCalculados.filter((e) => e.tipo === 'INSTITUTO');

    const centConAsistencia = centralizadas.filter((c) => c.tieneAsistencia).length;
    const empConAsistencia = empresas.filter((e) => e.tieneAsistencia).length;
    const instConAsistencia = institutos.filter((i) => i.tieneAsistencia).length;

    const totalAsistenciasAcumuladas = asistencias.reduce(
      (acc, act) => acc + (act.asistentes?.length || 0),
      0
    );

    return {
      totalActividades,
      totalAsistenciasAcumuladas,
      centralizadas: {
        total: centralizadas.length,
        asistieron: centConAsistencia,
        pct: Math.round((centConAsistencia / (centralizadas.length || 1)) * 100),
      },
      empresas: {
        total: empresas.length,
        asistieron: empConAsistencia,
        pct: Math.round((empConAsistencia / (empresas.length || 1)) * 100),
      },
      institutos: {
        total: institutos.length,
        asistieron: instConAsistencia,
        pct: Math.round((instConAsistencia / (institutos.length || 1)) * 100),
      },
    };
  }, [asistencias, entesCalculados]);

  // Filtered entities list
  const filteredEntes = useMemo(() => {
    return entesCalculados.filter((item) => {
      // Classification filter
      if (filtroTipo !== 'TODOS' && item.tipo !== filtroTipo) return false;

      // Status filter
      if (filtroEstado === 'CON_ASISTENCIA' && !item.tieneAsistencia) return false;
      if (filtroEstado === 'SIN_ASISTENCIA' && item.tieneAsistencia) return false;

      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchName = item.nombre.toLowerCase().includes(query);
        const matchFunc = item.funcionarios.some((f) => f.toLowerCase().includes(query));
        const matchAct = item.matchedActividades.some((m) =>
          m.actividad.nombreActividad.toLowerCase().includes(query)
        );
        if (!matchName && !matchFunc && !matchAct) return false;
      }

      return true;
    });
  }, [entesCalculados, filtroTipo, filtroEstado, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Top Header & Export Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase tracking-wider">
                Auditoría de Actividades
              </span>
              <span className="text-xs text-slate-400 font-mono">•</span>
              <span className="text-xs font-semibold text-slate-600">38 Entidades Municipales</span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
              Reporte de Asistencias por Dependencia, Empresa e Instituto
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed max-w-3xl">
              Monitoreo oficial del grado de participación de las Dependencias Centralizadas, Empresas Municipales e Institutos Autónomos en directorios, eventos cívicos, efemérides y mesas de trabajo convocadas por la Dirección General.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {onNewAsistencia && (
              <button
                type="button"
                onClick={onNewAsistencia}
                className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Registrar Actividad</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => exportarPDFAsistenciasPorEntes(asistencias)}
              className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
              title="Descargar Reporte Oficial de Asistencias en PDF"
            >
              <FileDown className="w-4 h-4 text-emerald-400" />
              <span>Descargar PDF</span>
            </button>

            <button
              type="button"
              onClick={() => exportarExcelAsistenciasPorEntes(asistencias)}
              className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              title="Descargar Matriz Completa en Excel"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Exportar Excel</span>
            </button>
          </div>
        </div>

        {/* KPI Cards Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-100">
          {/* Total Actividades */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Actividades Registradas
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-slate-900">{kpis.totalActividades}</span>
              <span className="text-[11px] text-slate-500 font-medium">convocadas</span>
            </div>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              {kpis.totalAsistenciasAcumuladas} asistencias en total
            </span>
          </div>

          {/* Centralizadas */}
          <div className="p-3.5 bg-indigo-50/60 rounded-xl border border-indigo-200">
            <span className="text-[11px] font-bold text-indigo-800 uppercase tracking-wider block">
              Dependencias Centralizadas
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-indigo-950">
                {kpis.centralizadas.asistieron}
                <span className="text-sm font-semibold text-indigo-600">/{kpis.centralizadas.total}</span>
              </span>
              <span className="text-xs font-extrabold text-indigo-700">
                {kpis.centralizadas.pct}%
              </span>
            </div>
            <span className="text-[10px] text-indigo-700 block mt-0.5">
              han asistido a convocatorias
            </span>
          </div>

          {/* Empresas */}
          <div className="p-3.5 bg-amber-50/60 rounded-xl border border-amber-200">
            <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">
              Empresas Municipales
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-amber-950">
                {kpis.empresas.asistieron}
                <span className="text-sm font-semibold text-amber-600">/{kpis.empresas.total}</span>
              </span>
              <span className="text-xs font-extrabold text-amber-700">
                {kpis.empresas.pct}%
              </span>
            </div>
            <span className="text-[10px] text-amber-700 block mt-0.5">
              han asistido a convocatorias
            </span>
          </div>

          {/* Institutos */}
          <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-200">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
              Institutos Autónomos
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-emerald-950">
                {kpis.institutos.asistieron}
                <span className="text-sm font-semibold text-emerald-600">/{kpis.institutos.total}</span>
              </span>
              <span className="text-xs font-extrabold text-emerald-700">
                {kpis.institutos.pct}%
              </span>
            </div>
            <span className="text-[10px] text-emerald-700 block mt-0.5">
              han asistido a convocatorias
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por dependencia, empresa, instituto o funcionario..."
            className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-700 focus:bg-white transition"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Classification Filters */}
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <span className="text-xs font-bold text-slate-500 uppercase mr-1 hidden sm:inline">
            Tipo:
          </span>
          {(['TODOS', 'CENTRALIZADA', 'EMPRESA', 'INSTITUTO'] as const).map((tipo) => (
            <button
              key={tipo}
              type="button"
              onClick={() => setFiltroTipo(tipo)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                filtroTipo === tipo
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {tipo === 'TODOS'
                ? 'Todos (38)'
                : tipo === 'CENTRALIZADA'
                ? 'Centralizadas (29)'
                : tipo === 'EMPRESA'
                ? 'Empresas (3)'
                : 'Institutos (6)'}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs font-bold text-slate-500 uppercase mr-1 hidden sm:inline">
            Estado:
          </span>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value as any)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-700"
          >
            <option value="TODOS">Todos los Estados</option>
            <option value="CON_ASISTENCIA">Con Asistencia</option>
            <option value="SIN_ASISTENCIA">Sin Registro</option>
          </select>
        </div>
      </div>

      {/* Main Table of Municipal Entities */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Relación Detallada de Entes Municipales ({filteredEntes.length})
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Mostrando {filteredEntes.length} de {entesCalculados.length} entidades
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900 text-white text-[11px] uppercase tracking-wider font-bold">
                <th className="px-3.5 py-3 w-10 text-center">N°</th>
                <th className="px-4 py-3">Dependencia / Ente</th>
                <th className="px-3 py-3">Clasificación</th>
                <th className="px-3 py-3 text-center">Actividades</th>
                <th className="px-3 py-3 text-center">Asistentes</th>
                <th className="px-3 py-3">Estado</th>
                <th className="px-3 py-3">Última Asistencia</th>
                <th className="px-3 py-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80">
              {filteredEntes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="font-semibold">No se encontraron dependencias con los filtros seleccionados.</p>
                  </td>
                </tr>
              ) : (
                filteredEntes.map((ente, idx) => (
                  <tr
                    key={ente.nombre}
                    className={`hover:bg-slate-50/90 transition ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                    }`}
                  >
                    <td className="px-3.5 py-3 text-center font-mono font-bold text-slate-500">
                      {ente.n}
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        <span className="font-bold text-slate-900 text-xs block">
                          {ente.nombre}
                        </span>
                        {ente.funcionarios.length > 0 && (
                          <p className="text-[11px] text-slate-500 flex items-center gap-1 truncate max-w-md">
                            <Users className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{ente.funcionarios.join(', ')}</span>
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide border ${
                          ente.tipo === 'CENTRALIZADA'
                            ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                            : ente.tipo === 'EMPRESA'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        }`}
                      >
                        {ente.tipo}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="font-black text-slate-900 text-xs">
                        {ente.cantActividades}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="font-semibold text-slate-700 text-xs">
                        {ente.totalAsistentes}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {ente.tieneAsistencia ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Asistió</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                          <span>Sin Registro</span>
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {ente.ultimaFecha ? (
                        <div className="space-y-0.5">
                          <span className="font-mono text-slate-800 font-semibold block text-[11px]">
                            {ente.ultimaFecha}
                          </span>
                          <span className="text-[10px] text-slate-500 block truncate max-w-[140px]" title={ente.ultimaActividadNombre || ''}>
                            {ente.ultimaActividadNombre}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs font-mono">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {ente.tieneAsistencia ? (
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedEnteDetalle({
                              dependencia: ente.dependencia,
                              actividades: ente.matchedActividades,
                            })
                          }
                          className="px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Ver ({ente.cantActividades})</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400">N/A</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal for Entity Attendance Details */}
      {selectedEnteDetalle && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="space-y-0.5 pr-4">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">
                  Historial de Participación Institucional
                </span>
                <h3 className="text-sm sm:text-base font-bold text-white leading-tight">
                  {selectedEnteDetalle.dependencia.nombre}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEnteDetalle(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500 font-medium">Clasificación:</span>{' '}
                  <strong className="text-slate-900">{selectedEnteDetalle.dependencia.tipo}</strong>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Total Asistencias Registradas:</span>{' '}
                  <strong className="text-emerald-700 font-black">
                    {selectedEnteDetalle.actividades.length}
                  </strong>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Actividades Asistidas
                </h4>
                {selectedEnteDetalle.actividades.map((match, mIdx) => (
                  <div
                    key={match.actividad.id + '-' + mIdx}
                    className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-2 hover:border-slate-300 transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 mb-1">
                          {match.actividad.tipoActividad}
                        </span>
                        <h5 className="text-xs sm:text-sm font-bold text-slate-900">
                          {match.actividad.nombreActividad}
                        </h5>
                      </div>
                      <span className="text-[11px] font-mono font-semibold text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 shrink-0">
                        {match.actividad.fecha}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100 text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{match.actividad.lugar}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate font-medium text-slate-900">
                          {match.asistente.nombresApellidos}
                          {match.asistente.cargo ? ` (${match.asistente.cargo})` : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end shrink-0">
              <button
                type="button"
                onClick={() => setSelectedEnteDetalle(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
