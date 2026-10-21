import React, { useState, useMemo } from 'react';
import {
  Target,
  Building2,
  Percent,
  CheckCircle2,
  AlertTriangle,
  Search,
  Filter,
  BarChart3,
  TrendingUp,
  Download,
  Calendar,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  FileSpreadsheet,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { MetaPoa } from '../types';
import { DEPENDENCIAS_MUNICIPALES } from '../data/dependenciasData';

interface MetasPoaMetricasViewProps {
  metasPoa: MetaPoa[];
  onNewRegistro?: () => void;
}

export const MetasPoaMetricasView: React.FC<MetasPoaMetricasViewProps> = ({
  metasPoa,
  onNewRegistro,
}) => {
  const [filterSector, setFilterSector] = useState<'TODAS' | 'CENTRALIZADA' | 'DESCENTRALIZADA'>('TODAS');
  const [filterRendimiento, setFilterRendimiento] = useState<'TODOS' | 'OPTIMO' | 'INTERMEDIO' | 'BAJO'>('TODOS');
  const [searchTerm, setSearchTerm] = useState('');

  // Statistical calculations
  const stats = useMemo(() => {
    const totalRegistros = metasPoa.length;
    const totalEstablecidos = metasPoa.reduce((acc, m) => acc + (m.objetivosEstablecidosPoa || 0), 0);
    const totalEjecutados = metasPoa.reduce((acc, m) => acc + (m.objetivosEjecutados || 0), 0);
    const promedioAlcanzado =
      totalEstablecidos > 0 ? Math.round((totalEjecutados / totalEstablecidos) * 100) : 0;

    const centralizadas = metasPoa.filter((m) => m.clasificacion === 'CENTRALIZADA');
    const descentralizadas = metasPoa.filter((m) => m.clasificacion === 'DESCENTRALIZADA');

    const estCent = centralizadas.reduce((acc, m) => acc + (m.objetivosEstablecidosPoa || 0), 0);
    const ejecCent = centralizadas.reduce((acc, m) => acc + (m.objetivosEjecutados || 0), 0);
    const pctCent = estCent > 0 ? Math.round((ejecCent / estCent) * 100) : 0;

    const estDesc = descentralizadas.reduce((acc, m) => acc + (m.objetivosEstablecidosPoa || 0), 0);
    const ejecDesc = descentralizadas.reduce((acc, m) => acc + (m.objetivosEjecutados || 0), 0);
    const pctDesc = estDesc > 0 ? Math.round((ejecDesc / estDesc) * 100) : 0;

    const optimos = metasPoa.filter((m) => m.porcentajeAlcanzado >= 80).length;
    const intermedios = metasPoa.filter((m) => m.porcentajeAlcanzado >= 50 && m.porcentajeAlcanzado < 80).length;
    const bajos = metasPoa.filter((m) => m.porcentajeAlcanzado < 50).length;

    return {
      totalRegistros,
      totalEstablecidos,
      totalEjecutados,
      promedioAlcanzado,
      centralizadasCount: centralizadas.length,
      descentralizadasCount: descentralizadas.length,
      pctCent,
      pctDesc,
      optimos,
      intermedios,
      bajos,
    };
  }, [metasPoa]);

  // Filtered list
  const filteredList = useMemo(() => {
    return metasPoa.filter((item) => {
      if (filterSector !== 'TODAS' && item.clasificacion !== filterSector) {
        return false;
      }
      if (filterRendimiento === 'OPTIMO' && item.porcentajeAlcanzado < 80) return false;
      if (filterRendimiento === 'INTERMEDIO' && (item.porcentajeAlcanzado < 50 || item.porcentajeAlcanzado >= 80)) return false;
      if (filterRendimiento === 'BAJO' && item.porcentajeAlcanzado >= 50) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchDep = item.dependencia.toLowerCase().includes(q);
        const matchAnio = item.anio.toLowerCase().includes(q);
        const matchPer = (item.periodo || '').toLowerCase().includes(q);
        if (!matchDep && !matchAnio && !matchPer) return false;
      }
      return true;
    });
  }, [metasPoa, filterSector, filterRendimiento, searchTerm]);

  // Export Excel
  const handleExportExcel = () => {
    if (metasPoa.length === 0) return;

    const exportData = metasPoa.map((m, idx) => ({
      'N°': idx + 1,
      'Entidad / Dependencia': m.dependencia,
      'Clasificación': m.clasificacion,
      'Año': m.anio,
      'Período': m.periodo || 'ANUAL',
      'Objetivos Establecidos en POA': m.objetivosEstablecidosPoa,
      'Objetivos Ejecutados': m.objetivosEjecutados,
      '% Alcanzado': `${m.porcentajeAlcanzado}%`,
      'Rendimiento':
        m.porcentajeAlcanzado >= 80
          ? 'ÓPTIMO'
          : m.porcentajeAlcanzado >= 50
          ? 'INTERMEDIO'
          : 'BAJO',
      'Observaciones': m.observaciones || '',
      'Fecha de Registro': m.fechaRegistro?.split('T')[0] || '',
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Metas POA Municipal');
    XLSX.writeFile(wb, `Reporte_Metas_POA_Tinaquillo_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 text-[10px] sm:text-xs uppercase tracking-wider">
                Dirección de Organización y Planificación
              </span>
              <span className="text-xs text-slate-400">
                Alcaldía del Municipio Autónomo Tinaquillo
              </span>
            </div>
            <h2 className="font-institutional text-2xl sm:text-3xl font-black text-white tracking-wide flex items-center gap-2.5">
              <Target className="w-7 h-7 text-amber-400" />
              <span>Métricas Estadísticas del Plan Operativo Anual (POA)</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
              Consolidación estadística y evaluación de objetivos establecidos en el POA municipal, cantidad de objetivos ejecutados y porcentaje de alcance institucional en dependencias centralizadas y descentralizadas.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {metasPoa.length > 0 && (
              <button
                type="button"
                onClick={handleExportExcel}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition shadow-md cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Exportar Excel POA</span>
              </button>
            )}
            {onNewRegistro && (
              <button
                type="button"
                onClick={onNewRegistro}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs transition shadow-md cursor-pointer"
              >
                <Target className="w-4 h-4" />
                <span>Registrar Datos POA</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Total Objetivos POA
            </span>
            <Target className="w-4 h-4 text-sky-600" />
          </div>
          <p className="text-2xl font-black text-slate-900">{stats.totalEstablecidos}</p>
          <span className="text-[10px] text-slate-500">Establecidos en Tinaquillo</span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
              Total Ejecutados
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-slate-900">{stats.totalEjecutados}</p>
          <span className="text-[10px] text-slate-500">Metas alcanzadas</span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">
              % Promedio Global
            </span>
            <Percent className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-black text-slate-900">{stats.promedioAlcanzado}%</p>
          <span className="text-[10px] text-slate-500">Ejecución municipal</span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600">
              Dependencias Evaluadas
            </span>
            <Building2 className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-2xl font-black text-slate-900">{stats.totalRegistros}</p>
          <span className="text-[10px] text-slate-500">
            {stats.centralizadasCount} Centralizadas • {stats.descentralizadasCount} Descentralizadas
          </span>
        </div>
      </div>

      {/* Sector Breakdown Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Centralizadas */}
        <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-sky-500" />
              <h3 className="text-sm font-bold text-slate-900">
                Dependencias Centralizadas (Direcciones)
              </h3>
            </div>
            <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-800 border border-sky-200 text-xs font-bold font-mono">
              {stats.pctCent}% Ejecutado
            </span>
          </div>

          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-sky-500 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, stats.pctCent))}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-slate-600 pt-1">
            <span>{stats.centralizadasCount} Entidades evaluadas</span>
            <span className="font-semibold text-slate-900">
              Rendimiento: {stats.pctCent >= 80 ? 'Óptimo' : stats.pctCent >= 50 ? 'Intermedio' : 'Bajo'}
            </span>
          </div>
        </div>

        {/* Descentralizadas */}
        <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-purple-500" />
              <h3 className="text-sm font-bold text-slate-900">
                Dependencias Descentralizadas (Institutos & Empresas)
              </h3>
            </div>
            <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 border border-purple-200 text-xs font-bold font-mono">
              {stats.pctDesc}% Ejecutado
            </span>
          </div>

          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-500 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, stats.pctDesc))}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-slate-600 pt-1">
            <span>{stats.descentralizadasCount} Entidades evaluadas</span>
            <span className="font-semibold text-slate-900">
              Rendimiento: {stats.pctDesc >= 80 ? 'Óptimo' : stats.pctDesc >= 50 ? 'Intermedio' : 'Bajo'}
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por dependencia o año..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:bg-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Sector filter */}
          <select
            value={filterSector}
            onChange={(e) => setFilterSector(e.target.value as any)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-sky-600"
          >
            <option value="TODAS">Todos los Sectores</option>
            <option value="CENTRALIZADA">Solo Centralizadas (Direcciones)</option>
            <option value="DESCENTRALIZADA">Solo Descentralizadas (Institutos/Empresas)</option>
          </select>

          {/* Rendimiento filter */}
          <select
            value={filterRendimiento}
            onChange={(e) => setFilterRendimiento(e.target.value as any)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-sky-600"
          >
            <option value="TODOS">Todos los Rendimientos</option>
            <option value="OPTIMO">Óptimo (≥ 80%)</option>
            <option value="INTERMEDIO">Intermedio (50% - 79%)</option>
            <option value="BAJO">Bajo (&lt; 50%)</option>
          </select>
        </div>
      </div>

      {/* Statistical Entity Cards / List */}
      <div className="space-y-3">
        {filteredList.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-3 shadow-2xs">
            <Target className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-700">
              No hay metas POA registradas que coincidan con los filtros.
            </p>
            <p className="text-xs text-slate-500">
              Los datos son registrados por el usuario de la Dirección de Organización y Planificación.
            </p>
          </div>
        ) : (
          filteredList.map((meta) => {
            const pct = meta.porcentajeAlcanzado;
            const isOptimo = pct >= 80;
            const isIntermedio = pct >= 50 && pct < 80;
            return (
              <div
                key={meta.id}
                className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs hover:shadow-xs transition space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                          meta.clasificacion === 'CENTRALIZADA'
                            ? 'bg-sky-50 text-sky-800 border-sky-200'
                            : 'bg-purple-50 text-purple-800 border-purple-200'
                        }`}
                      >
                        {meta.clasificacion}
                      </span>
                      <span className="text-[11px] text-slate-500 font-semibold">
                        {meta.periodo || 'ANUAL'} • {meta.anio}
                      </span>
                    </div>
                    <h3 className="text-sm sm:text-base font-black text-slate-900">
                      {meta.dependencia}
                    </h3>
                  </div>

                  {/* Quantitative Badge */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 font-bold block uppercase">
                        Ejecución POA
                      </span>
                      <span className="font-mono text-xs font-bold text-slate-700">
                        {meta.objetivosEjecutados} de {meta.objetivosEstablecidosPoa} metas
                      </span>
                    </div>
                    <div
                      className={`px-3 py-1.5 rounded-xl font-mono text-sm sm:text-base font-black border ${
                        isOptimo
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : isIntermedio
                          ? 'bg-amber-50 text-amber-800 border-amber-300'
                          : 'bg-rose-50 text-rose-800 border-rose-300'
                      }`}
                    >
                      {pct}%
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isOptimo ? 'bg-emerald-500' : isIntermedio ? 'bg-amber-500' : 'bg-rose-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>
                      Estado:{' '}
                      <strong className={isOptimo ? 'text-emerald-700' : isIntermedio ? 'text-amber-700' : 'text-rose-700'}>
                        {isOptimo ? 'Cumplimiento Óptimo' : isIntermedio ? 'Cumplimiento Intermedio' : 'Bajo Cumplimiento'}
                      </strong>
                    </span>
                    {meta.observaciones && (
                      <span className="truncate max-w-xs sm:max-w-md text-slate-600" title={meta.observaciones}>
                        {meta.observaciones}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
