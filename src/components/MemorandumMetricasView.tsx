import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  Building,
  FileSpreadsheet,
  FileDown,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Image as ImageIcon,
  Eye,
  X,
  FileText,
  Users,
  Award,
  Layers,
  TrendingUp,
  Calendar,
  ChevronRight,
  Maximize2,
  Download,
} from 'lucide-react';
import { InformeDependencia, ClasificacionDependencia, Funcionario } from '../types';
import { DEPENDENCIAS_MUNICIPALES } from '../data/dependenciasData';
import { formatFechaEspanol, getStoredFuncionarios, normalizeString } from '../utils/storage';
import {
  exportarExcelMemorandumYMetricas,
  exportarPDFMemorandumYMetricas,
} from '../utils/exportUtils';

interface Props {
  informes: InformeDependencia[];
  funcionarios?: Funcionario[];
  onNewInforme?: () => void;
}

type FilterSector = 'TODOS' | ClasificacionDependencia;
type FilterEstadoMemo = 'TODOS' | 'CUMPLIO' | 'PENDIENTE' | 'CON_FIRMAS' | 'SIN_FIRMAS';
type ViewMode = 'tabla' | 'tarjetas';

export const MemorandumMetricasView: React.FC<Props> = ({
  informes,
  funcionarios: funcionariosProp,
  onNewInforme,
}) => {
  const [filterSector, setFilterSector] = useState<FilterSector>('TODOS');
  const [filterEstado, setFilterEstado] = useState<FilterEstadoMemo>('TODOS');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('tabla');

  // Modal inspection states
  const [selectedMemo, setSelectedMemo] = useState<InformeDependencia | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // Stored funcionarios for fallback info
  const funcionariosDirectorio: Funcionario[] = useMemo(() => {
    return funcionariosProp && funcionariosProp.length > 0
      ? funcionariosProp
      : getStoredFuncionarios();
  }, [funcionariosProp, informes]);

  // Calculate metrics per dependency
  const dependenciasMetrics = useMemo(() => {
    return DEPENDENCIAS_MUNICIPALES.map((dep) => {
      const depNormalized = normalizeString(dep.nombre);
      const depInformes = informes.filter(
        (inf) => normalizeString(inf.dependencia) === depNormalized
      );

      // Find comunicación interna / memorandums
      const memorandums = depInformes.filter(
        (inf) =>
          inf.tipoInforme === 'MEMORANDUM INTERNO' ||
          inf.tipoInforme === 'REGISTRO DE COMUNICACIÓN INTERNA DE DIRECTORIO'
      );
      const latestMemo = memorandums.length > 0 ? memorandums[0] : null;
      const cumplioMemo = memorandums.length > 0;

      // Firmas
      const tieneFirmas = !!(
        latestMemo?.fotoFirmaPersonal && latestMemo.fotoFirmaPersonal.length > 0
      );
      const cantFirmas = latestMemo?.fotoFirmaPersonal?.length || 0;

      // Trimestrales
      const trimestrales = depInformes.filter(
        (inf) => inf.tipoInforme === 'REPORTE DE GESTIÓN TRIMESTRAL'
      );
      const trimestresSet = Array.from(
        new Set(trimestrales.map((t) => t.trimestre).filter(Boolean))
      ) as string[];

      // Auditorias
      const auditorias = depInformes.filter(
        (inf) =>
          inf.tipoInforme === 'INFORME PARCIAL DE AUDITORIA' ||
          inf.tipoInforme === 'INFORME PARCIAL DE LA AUDITORIA OPERATIVA DE LA CONTRALORÍA MUNICIPAL' ||
          inf.tipoInforme === 'INFORME DE AUDITORÍA DEFINITIVO'
      );

      // Responsable titular
      const funcDir = funcionariosDirectorio.find(
        (f) => normalizeString(f.dependencia) === depNormalized
      );
      const responsable =
        latestMemo?.nombresApellidos ||
        (depInformes.length > 0 ? depInformes[0].nombresApellidos : funcDir?.nombresApellidos || 'No registrado');
      const cargo =
        latestMemo?.cargo ||
        (depInformes.length > 0 ? depInformes[0].cargo : funcDir?.cargo || 'Director(a) / Presidente(a)');
      const cedula =
        latestMemo?.cedula ||
        (depInformes.length > 0 ? depInformes[0].cedula : funcDir?.cedula || 'N/A');

      // Score / Compliance Level
      let nivelCumplimiento: 'ÓPTIMO' | 'PARCIAL' | 'PENDIENTE' = 'PENDIENTE';
      let porcentajeCumplimiento = 0;

      if (cumplioMemo && trimestrales.length > 0) {
        nivelCumplimiento = 'ÓPTIMO';
        porcentajeCumplimiento = 100;
      } else if (cumplioMemo || trimestrales.length > 0 || auditorias.length > 0) {
        nivelCumplimiento = 'PARCIAL';
        porcentajeCumplimiento = 50;
      }

      return {
        id: dep.id,
        nombre: dep.nombre,
        tipo: dep.tipo,
        responsable,
        cargo,
        cedula,
        cumplioMemo,
        latestMemo,
        tieneFirmas,
        cantFirmas,
        trimestralesCount: trimestrales.length,
        trimestresSet,
        auditoriasCount: auditorias.length,
        totalInformes: depInformes.length,
        nivelCumplimiento,
        porcentajeCumplimiento,
      };
    });
  }, [informes, funcionariosDirectorio]);

  // Sector metrics breakdown
  const sectorMetrics = useMemo(() => {
    const sectors: Array<{
      tipo: ClasificacionDependencia;
      titulo: string;
      subtitulo: string;
      colorBorder: string;
      colorBg: string;
      colorBadge: string;
      colorIcon: string;
    }> = [
      {
        tipo: 'CENTRALIZADA',
        titulo: 'Dependencias Centralizadas',
        subtitulo: 'Direcciones Generales, Sectoriales y Oficinas de Apoyo',
        colorBorder: 'border-emerald-200',
        colorBg: 'from-emerald-50/50 to-white',
        colorBadge: 'bg-emerald-100 text-emerald-800',
        colorIcon: 'text-emerald-700 bg-emerald-100',
      },
      {
        tipo: 'INSTITUTO',
        titulo: 'Institutos Autónomos',
        subtitulo: 'Entes Descentralizados y Organismos Municipales',
        colorBorder: 'border-sky-200',
        colorBg: 'from-sky-50/50 to-white',
        colorBadge: 'bg-sky-100 text-sky-800',
        colorIcon: 'text-sky-700 bg-sky-100',
      },
      {
        tipo: 'EMPRESA',
        titulo: 'Empresas Municipales',
        subtitulo: 'Sociedades Mercantiles y Servicios Productivos',
        colorBorder: 'border-amber-200',
        colorBg: 'from-amber-50/50 to-white',
        colorBadge: 'bg-amber-100 text-amber-800',
        colorIcon: 'text-amber-700 bg-amber-100',
      },
    ];

    return sectors.map((sec) => {
      const entities = dependenciasMetrics.filter((d) => d.tipo === sec.tipo);
      const total = entities.length;
      const cumplieronMemo = entities.filter((d) => d.cumplioMemo).length;
      const pendientesMemo = total - cumplieronMemo;
      const conFirmas = entities.filter((d) => d.tieneFirmas).length;
      const pctMemo = total > 0 ? Math.round((cumplieronMemo / total) * 100) : 0;
      const totalTrimestrales = entities.reduce((acc, curr) => acc + curr.trimestralesCount, 0);
      const totalAuditorias = entities.reduce((acc, curr) => acc + curr.auditoriasCount, 0);
      const totalInformesSector = entities.reduce((acc, curr) => acc + curr.totalInformes, 0);

      return {
        ...sec,
        total,
        cumplieronMemo,
        pendientesMemo,
        conFirmas,
        pctMemo,
        totalTrimestrales,
        totalAuditorias,
        totalInformesSector,
      };
    });
  }, [dependenciasMetrics]);

  // Overall KPIs
  const totalEntidades = dependenciasMetrics.length;
  const globalCumplieronMemo = dependenciasMetrics.filter((d) => d.cumplioMemo).length;
  const globalPendientesMemo = totalEntidades - globalCumplieronMemo;
  const globalPctMemo = totalEntidades > 0 ? Math.round((globalCumplieronMemo / totalEntidades) * 100) : 0;
  const globalConFirmas = dependenciasMetrics.filter((d) => d.tieneFirmas).length;

  // Filtered list
  const filteredEntities = useMemo(() => {
    return dependenciasMetrics.filter((item) => {
      // Sector filter
      if (filterSector !== 'TODOS' && item.tipo !== filterSector) {
        return false;
      }

      // Memo status filter
      if (filterEstado === 'CUMPLIO' && !item.cumplioMemo) return false;
      if (filterEstado === 'PENDIENTE' && item.cumplioMemo) return false;
      if (filterEstado === 'CON_FIRMAS' && !item.tieneFirmas) return false;
      if (filterEstado === 'SIN_FIRMAS' && (item.tieneFirmas || !item.cumplioMemo)) return false;

      // Text search
      if (searchQuery.trim()) {
        const qNorm = normalizeString(searchQuery);
        const matchNombre = normalizeString(item.nombre).includes(qNorm);
        const matchResp = normalizeString(item.responsable).includes(qNorm);
        const matchCed = normalizeString(item.cedula).includes(qNorm);
        const matchTipo = normalizeString(item.tipo).includes(qNorm);
        return matchNombre || matchResp || matchCed || matchTipo;
      }

      return true;
    });
  }, [dependenciasMetrics, filterSector, filterEstado, searchQuery]);

  return (
    <div className="space-y-6">
      {/* HEADER SECTION & EXPORT ACTIONS - CALM INSTITUTIONAL SLATE */}
      <div className="bg-slate-900 text-white p-5 sm:p-7 rounded-2xl shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-bold uppercase tracking-wider">
              Control Institucional
            </span>
            <span className="text-xs text-slate-400 font-medium">
              Alcaldía del Municipio Autónomo Tinaquillo
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-amber-400 shrink-0" />
            <span>Cumplimiento del Registro de Comunicación Interna de Directorio & Métricas</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Reporte de consignación de registros de comunicación interna de directorio, control de firmas digitalizadas del personal y métricas de desempeño de cada dependencia centralizada, instituto autónomo y empresa municipal.
          </p>
        </div>

        {/* Top Export Buttons */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => exportarExcelMemorandumYMetricas(informes)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer border border-emerald-600"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
            <span>Excel Comunicación Interna & Métricas</span>
          </button>
          <button
            type="button"
            onClick={() => exportarPDFMemorandumYMetricas(informes)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer border border-slate-700"
          >
            <FileDown className="w-4 h-4 text-amber-400" />
            <span>PDF Oficial</span>
          </button>
        </div>
      </div>

      {/* TOP KPI CARDS: RESUMEN GLOBAL DE MEMORÁNDUMS - ZERO GLARE SOLID MATTE CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Total Entidades</span>
            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
              <Building className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-black text-slate-900">{totalEntidades}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Centralizadas, Institutos y Empresas</p>
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Cumplieron Comunicación Interna</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl sm:text-3xl font-black text-slate-900">{globalCumplieronMemo}</p>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">({globalPctMemo}%)</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Entregaron Registro de Comunicación Interna</p>
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Firmas Digitalizadas</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center text-amber-700">
              <ImageIcon className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-black text-slate-900">{globalConFirmas}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Con constancia de firma del personal</p>
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Comunicación Interna Pendiente</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 flex items-center justify-center text-rose-700">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl sm:text-3xl font-black text-slate-900">{globalPendientesMemo}</p>
              <span className="text-xs font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded">({100 - globalPctMemo}%)</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Entidades que aún no lo entregan</p>
          </div>
        </div>
      </div>

      {/* METRICAS DESGLOSADAS POR SECTOR INSTITUCIONAL */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-700" />
            <span>Métricas Consolidadas por Sector Institucional</span>
          </h3>
          <span className="text-xs text-slate-500">3 Sectores Evaluados</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {sectorMetrics.map((sec) => (
            <div
              key={sec.tipo}
              className={`bg-gradient-to-b ${sec.colorBg} p-5 rounded-2xl border ${sec.colorBorder} shadow-xs flex flex-col justify-between space-y-4`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${sec.colorBadge}`}>
                    {sec.tipo}
                  </span>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${sec.colorIcon}`}>
                    {sec.total}
                  </div>
                </div>
                <h4 className="text-base font-black text-slate-900">{sec.titulo}</h4>
                <p className="text-xs text-slate-500 mt-0.5">{sec.subtitulo}</p>
              </div>

              {/* Progress bar of memorandum compliance */}
              <div className="space-y-1.5 pt-2 border-t border-slate-200/70">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">Cumplimiento Comunicación Interna:</span>
                  <span className="font-mono font-black text-slate-900">
                    {sec.cumplieronMemo} / {sec.total} ({sec.pctMemo}%)
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      sec.pctMemo >= 75
                        ? 'bg-emerald-600'
                        : sec.pctMemo >= 40
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                    }`}
                    style={{ width: `${sec.pctMemo}%` }}
                  />
                </div>
              </div>

              {/* Grid of secondary metrics */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/70 text-center">
                <div className="p-2 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Firmas</p>
                  <p className="text-sm font-black text-emerald-700">{sec.conFirmas}</p>
                </div>
                <div className="p-2 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Trimestrales</p>
                  <p className="text-sm font-black text-sky-700">{sec.totalTrimestrales}</p>
                </div>
                <div className="p-2 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Total Inf.</p>
                  <p className="text-sm font-black text-slate-800">{sec.totalInformesSector}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FILTER AND SEARCH CONTROLS */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3.5">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por dependencia, instituto, empresa o responsable..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sector Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
            <span className="text-[11px] font-bold text-slate-500 mr-1 hidden sm:inline">Sector:</span>
            {(['TODOS', 'CENTRALIZADA', 'INSTITUTO', 'EMPRESA'] as FilterSector[]).map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => setFilterSector(sec)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  filterSector === sec
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {sec === 'TODOS'
                  ? 'Todos'
                  : sec === 'CENTRALIZADA'
                  ? 'Centralizadas'
                  : sec === 'INSTITUTO'
                  ? 'Institutos'
                  : 'Empresas'}
              </button>
            ))}
          </div>

          {/* View mode toggle */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0 self-end lg:self-auto">
            <button
              type="button"
              onClick={() => setViewMode('tabla')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                viewMode === 'tabla' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Tabla
            </button>
            <button
              type="button"
              onClick={() => setViewMode('tarjetas')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                viewMode === 'tarjetas' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Fichas
            </button>
          </div>
        </div>

        {/* Status of memorandum pills */}
        <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-slate-100">
          <span className="text-[11px] font-bold text-slate-500 mr-1">Estado Comunicación Interna:</span>
          <button
            type="button"
            onClick={() => setFilterEstado('TODOS')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
              filterEstado === 'TODOS'
                ? 'bg-emerald-700 text-white font-bold'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Todos ({dependenciasMetrics.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterEstado('CUMPLIO')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
              filterEstado === 'CUMPLIO'
                ? 'bg-emerald-600 text-white font-bold'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            }`}
          >
            ✓ Cumplió Comunicación Interna ({globalCumplieronMemo})
          </button>
          <button
            type="button"
            onClick={() => setFilterEstado('CON_FIRMAS')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
              filterEstado === 'CON_FIRMAS'
                ? 'bg-amber-600 text-white font-bold'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
            }`}
          >
            ✍ Con Firmas Digitales ({globalConFirmas})
          </button>
          <button
            type="button"
            onClick={() => setFilterEstado('PENDIENTE')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
              filterEstado === 'PENDIENTE'
                ? 'bg-rose-600 text-white font-bold'
                : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
            }`}
          >
            ✕ Comunicación Interna Pendiente ({globalPendientesMemo})
          </button>
        </div>
      </div>

      {/* DETAILED RESULTS COUNT */}
      <div className="flex items-center justify-between text-xs text-slate-600 px-1">
        <span>
          Mostrando <strong>{filteredEntities.length}</strong> de <strong>{dependenciasMetrics.length}</strong> entidades evaluadas
        </span>
        {filterSector !== 'TODOS' || filterEstado !== 'TODOS' || searchQuery ? (
          <button
            type="button"
            onClick={() => {
              setFilterSector('TODOS');
              setFilterEstado('TODOS');
              setSearchQuery('');
            }}
            className="text-emerald-700 hover:underline font-bold"
          >
            Restablecer todos los filtros
          </button>
        ) : null}
      </div>

      {/* MAIN VIEW: TABLE OR CARDS */}
      {viewMode === 'tabla' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[960px]">
              <thead>
                <tr className="bg-slate-900 text-white text-[11px] font-bold uppercase tracking-wider">
                  <th className="py-3 px-3.5">N°</th>
                  <th className="py-3 px-4">Dependencia / Instituto / Empresa</th>
                  <th className="py-3 px-3">Sector</th>
                  <th className="py-3 px-4">Funcionario Responsable</th>
                  <th className="py-3 px-3.5">Registro de Comunicación Interna de Directorio</th>
                  <th className="py-3 px-3.5">Firmas del Personal</th>
                  <th className="py-3 px-3 text-center">Trimestral</th>
                  <th className="py-3 px-3 text-center">Auditorías</th>
                  <th className="py-3 px-3 text-center">Total Inf.</th>
                  <th className="py-3 px-3.5 text-center">Cumplimiento</th>
                  <th className="py-3 px-3.5 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredEntities.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-400">
                      No se encontraron entidades municipales con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredEntities.map((dep, idx) => (
                    <tr
                      key={dep.id}
                      className={`hover:bg-slate-50 transition ${
                        dep.cumplioMemo ? 'bg-white' : 'bg-rose-50/20'
                      }`}
                    >
                      <td className="py-3 px-3.5 font-mono text-slate-400 text-[11px]">
                        {idx + 1}
                      </td>

                      {/* Dependencia / Instituto */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 leading-snug">
                          {dep.nombre}
                        </div>
                      </td>

                      {/* Sector */}
                      <td className="py-3 px-3">
                        <span
                          className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full inline-block ${
                            dep.tipo === 'CENTRALIZADA'
                              ? 'bg-emerald-100 text-emerald-800'
                              : dep.tipo === 'INSTITUTO'
                              ? 'bg-sky-100 text-sky-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {dep.tipo}
                        </span>
                      </td>

                      {/* Funcionario Responsable */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">{dep.responsable}</div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <span>{dep.cargo}</span>
                          {dep.cedula !== 'N/A' && (
                            <span className="font-mono text-slate-400">• V-{dep.cedula}</span>
                          )}
                        </div>
                      </td>

                      {/* Memorándum Interno */}
                      <td className="py-3 px-3.5">
                        {dep.cumplioMemo ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>CUMPLIÓ</span>
                            </span>
                            {dep.latestMemo?.fechaRegistro && (
                              <p className="text-[10px] text-slate-500 font-mono">
                                {formatFechaEspanol(dep.latestMemo.fechaRegistro)}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                            <XCircle className="w-3 h-3 text-rose-600" />
                            <span>PENDIENTE</span>
                          </span>
                        )}
                      </td>

                      {/* Firmas del Personal */}
                      <td className="py-3 px-3.5">
                        {dep.tieneFirmas ? (
                          <button
                            type="button"
                            onClick={() => setSelectedMemo(dep.latestMemo)}
                            className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 hover:bg-amber-200 text-amber-900 transition cursor-pointer border border-amber-300"
                            title="Ver constancia de firmas digitalizadas"
                          >
                            <ImageIcon className="w-3 h-3 text-amber-700" />
                            <span>{dep.cantFirmas} {dep.cantFirmas === 1 ? 'Foto' : 'Fotos'}</span>
                          </button>
                        ) : dep.cumplioMemo ? (
                          <span className="text-[10px] text-slate-400 italic">Sin fotos adjuntas</span>
                        ) : (
                          <span className="text-[10px] text-slate-300">-</span>
                        )}
                      </td>

                      {/* Gestión Trimestral */}
                      <td className="py-3 px-3 text-center">
                        {dep.trimestralesCount > 0 ? (
                          <span className="inline-block px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 font-bold font-mono text-[11px]">
                            {dep.trimestralesCount}
                          </span>
                        ) : (
                          <span className="text-slate-300 font-mono text-xs">0</span>
                        )}
                      </td>

                      {/* Auditorías */}
                      <td className="py-3 px-3 text-center">
                        {dep.auditoriasCount > 0 ? (
                          <span className="inline-block px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold font-mono text-[11px]">
                            {dep.auditoriasCount}
                          </span>
                        ) : (
                          <span className="text-slate-300 font-mono text-xs">0</span>
                        )}
                      </td>

                      {/* Total Informes */}
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-900">
                        {dep.totalInformes}
                      </td>

                      {/* Cumplimiento Global */}
                      <td className="py-3 px-3.5 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span
                            className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                              dep.nivelCumplimiento === 'ÓPTIMO'
                                ? 'bg-emerald-600 text-white'
                                : dep.nivelCumplimiento === 'PARCIAL'
                                ? 'bg-amber-500 text-white'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {dep.nivelCumplimiento}
                          </span>
                          <div className="w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                dep.porcentajeCumplimiento === 100
                                  ? 'bg-emerald-600'
                                  : dep.porcentajeCumplimiento === 50
                                  ? 'bg-amber-500'
                                  : 'bg-transparent'
                              }`}
                              style={{ width: `${dep.porcentajeCumplimiento}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Acciones */}
                      <td className="py-3 px-3.5 text-center">
                        {dep.cumplioMemo ? (
                          <button
                            type="button"
                            onClick={() => setSelectedMemo(dep.latestMemo)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                            title="Ver registro de comunicación interna de directorio y firmas"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Pendiente</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* GRID DE TARJETAS / FICHAS EJECUTIVAS */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEntities.map((dep) => (
            <div
              key={dep.id}
              className={`p-4 rounded-2xl border transition shadow-xs space-y-3 flex flex-col justify-between ${
                dep.cumplioMemo
                  ? 'bg-white border-emerald-200'
                  : 'bg-white border-rose-200'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                      dep.tipo === 'CENTRALIZADA'
                        ? 'bg-emerald-100 text-emerald-800'
                        : dep.tipo === 'INSTITUTO'
                        ? 'bg-sky-100 text-sky-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {dep.tipo}
                  </span>

                  {dep.cumplioMemo ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>CUMPLIÓ COMUNICACIÓN INTERNA</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                      <XCircle className="w-3 h-3 text-rose-600" />
                      <span>COMUNICACIÓN INTERNA PENDIENTE</span>
                    </span>
                  )}
                </div>

                <h4 className="text-sm font-black text-slate-900 leading-snug">
                  {dep.nombre}
                </h4>

                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-0.5">
                  <p className="font-bold text-slate-800">{dep.responsable}</p>
                  <p className="text-[11px] text-slate-500">{dep.cargo}</p>
                  {dep.cedula !== 'N/A' && (
                    <p className="text-[10px] font-mono text-slate-400">C.I: V-{dep.cedula}</p>
                  )}
                </div>
              </div>

              {/* Metrics counts */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
                  <div className="p-1.5 bg-slate-50 rounded-lg">
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Trimestrales</p>
                    <p className="font-black text-sky-800">{dep.trimestralesCount}</p>
                  </div>
                  <div className="p-1.5 bg-slate-50 rounded-lg">
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Auditorías</p>
                    <p className="font-black text-amber-800">{dep.auditoriasCount}</p>
                  </div>
                  <div className="p-1.5 bg-slate-50 rounded-lg">
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Total Inf.</p>
                    <p className="font-black text-slate-900">{dep.totalInformes}</p>
                  </div>
                </div>

                {/* Firmas digitalizadas */}
                {dep.tieneFirmas ? (
                  <div className="flex items-center justify-between p-2 bg-amber-50/70 border border-amber-200 rounded-xl text-xs">
                    <div className="flex items-center gap-1.5 text-amber-900 font-bold">
                      <ImageIcon className="w-3.5 h-3.5 text-amber-600" />
                      <span>Firmas Digitalizadas: {dep.cantFirmas} foto(s)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedMemo(dep.latestMemo)}
                      className="text-[11px] font-extrabold text-amber-700 hover:underline cursor-pointer"
                    >
                      Ver →
                    </button>
                  </div>
                ) : dep.cumplioMemo ? (
                  <p className="text-[11px] text-slate-400 italic text-center">
                    Registro de comunicación interna consignado sin foto de firmas
                  </p>
                ) : (
                  <p className="text-[11px] text-rose-600 font-bold text-center">
                    Pendiente de consignar registro de comunicación interna de directorio
                  </p>
                )}

                {/* Inspect button if completed */}
                {dep.cumplioMemo && (
                  <button
                    type="button"
                    onClick={() => setSelectedMemo(dep.latestMemo)}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Ver Comunicación Interna de Directorio</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL: VER DETALLE DEL REGISTRO DE COMUNICACIÓN INTERNA DE DIRECTORIO Y CONSTANCIA DE FIRMAS */}
      {selectedMemo && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white p-5 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] font-bold uppercase">
                    Registro de Comunicación Interna de Directorio
                  </span>
                  <span className="text-xs text-slate-300 font-mono">
                    ID: {selectedMemo.id}
                  </span>
                </div>
                <h3 className="text-lg font-black text-white">{selectedMemo.dependencia}</h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Consignado por <strong>{selectedMemo.nombresApellidos}</strong> ({selectedMemo.cargo || 'Director/Presidente'}) el {formatFechaEspanol(selectedMemo.fechaRegistro)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedMemo(null)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              {/* Metadata Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Funcionario</p>
                  <p className="text-xs font-bold text-slate-800 truncate">{selectedMemo.nombresApellidos}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Cédula</p>
                  <p className="text-xs font-mono font-bold text-slate-800">V-{selectedMemo.cedula}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">N° Resolución</p>
                  <p className="text-xs font-mono font-bold text-slate-800 truncate">
                    {selectedMemo.numeroResolucion || 'S/R'}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Teléfono</p>
                  <p className="text-xs font-mono font-bold text-slate-800">{selectedMemo.telefono}</p>
                </div>
              </div>

              {/* Puntos de la Comunicación Interna de Directorio */}
              <div className="space-y-3">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  <span>Contenido del Registro de Comunicación Interna de Directorio</span>
                </h4>

                {/* Punto 1 */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                    1. Primer Punto / Directriz Registrada
                  </p>
                  <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {selectedMemo.punto1 || 'No especificado'}
                  </p>
                </div>

                {/* Punto 2 */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                    2. Segundo Punto / Directriz Registrada
                  </p>
                  <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {selectedMemo.punto2 || 'No especificado'}
                  </p>
                </div>

                {/* Puntos Adicionales */}
                {selectedMemo.puntosAdicionales && selectedMemo.puntosAdicionales.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold text-slate-700 uppercase">
                      Puntos Adicionales ({selectedMemo.puntosAdicionales.length})
                    </p>
                    {selectedMemo.puntosAdicionales.map((p, pIdx) => (
                      <div key={pIdx} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-700">
                        <span className="font-bold text-emerald-700 mr-2">{pIdx + 3}.</span>
                        <span>{p}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Constancia de Firmas del Personal */}
              <div className="space-y-3 pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-amber-600" />
                    <span>Lista de Firmas del Personal Digitalizada</span>
                  </h4>
                  <span className="text-xs font-bold text-slate-500">
                    {selectedMemo.fotoFirmaPersonal?.length || 0} archivo(s)
                  </span>
                </div>

                {selectedMemo.fotoFirmaPersonal && selectedMemo.fotoFirmaPersonal.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {selectedMemo.fotoFirmaPersonal.map((foto, fIdx) => (
                      <div
                        key={fIdx}
                        className="group relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 aspect-4/3 cursor-pointer shadow-2xs hover:shadow-md transition"
                        onClick={() => setZoomedImage(foto.dataUrl)}
                      >
                        <img
                          src={foto.dataUrl}
                          alt={`Firma Personal ${fIdx + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                        />
                        <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                          <Maximize2 className="w-5 h-5" />
                        </div>
                        <div className="absolute bottom-1.5 left-1.5 right-1.5 bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-mono px-2 py-0.5 rounded truncate">
                          {foto.name || `Página ${fIdx + 1}`}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-center text-xs text-amber-800">
                    Esta dependencia consignó los puntos del registro de comunicación interna de directorio pero no adjuntó fotografía de la lista de firmas del personal.
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Registrado por: <strong>{selectedMemo.creadoPor}</strong>
              </span>
              <button
                type="button"
                onClick={() => setSelectedMemo(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cerrar Detalle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL-SCREEN IMAGE ZOOM MODAL */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-60 bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setZoomedImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <button
              type="button"
              onClick={() => setZoomedImage(null)}
              className="absolute -top-10 right-0 text-white hover:text-amber-400 transition"
            >
              <X className="w-7 h-7" />
            </button>
            <img
              src={zoomedImage}
              alt="Firma Ampliada"
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};
