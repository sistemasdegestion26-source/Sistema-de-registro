import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  User,
  CreditCard,
  Phone,
  Building2,
  Calendar,
  FileText,
  ClipboardList,
  CheckCircle2,
  Clock,
  XCircle,
  ArrowRightCircle,
  Eye,
  ExternalLink,
} from 'lucide-react';
import { Solicitud, InformeDependencia, AppUser } from '../types';
import { TIPOS_SOLICITUD, ESTADOS_SOLICITUD, DEPENDENCIAS_MUNICIPALES } from '../data/dependenciasData';
import { formatFechaEspanol } from '../utils/storage';

interface BusquedaProps {
  currentUser: AppUser;
  solicitudes: Solicitud[];
  informes: InformeDependencia[];
  onSelectSolicitud?: (sol: Solicitud) => void;
}

export const Busqueda: React.FC<BusquedaProps> = ({
  currentUser,
  solicitudes,
  informes,
  onSelectSolicitud,
}) => {
  // Global search input
  const [searchTerm, setSearchTerm] = useState('');

  // Specific filters requested in item 6:
  // - NÚMERO DE CÉDULA
  // - NOMBRES Y APELLIDOS
  // - TELÉFONO
  // - POR TIPO DE SOLICITUD
  // - POR ESTADO DE REMISIÓN
  // - POR DEPENDENCIA O INSTITUTO
  // - POR TIPO DE INFORME (INFORME TRIMESTRAL, INFORME DE AUDITORIA PARCIAL E INFORME DE AUDITORIA DEFINITIVO)
  // - POR FECHA
  const [filterCedula, setFilterCedula] = useState('');
  const [filterNombre, setFilterNombre] = useState('');
  const [filterTelefono, setFilterTelefono] = useState('');
  const [filterTipoSolicitud, setFilterTipoSolicitud] = useState('TODOS');
  const [filterEstadoRemision, setFilterEstadoRemision] = useState('TODOS');
  const [filterDependencia, setFilterDependencia] = useState('TODAS');
  const [filterTipoInforme, setFilterTipoInforme] = useState('TODOS');
  const [filterFechaDesde, setFilterFechaDesde] = useState('');
  const [filterFechaHasta, setFilterFechaHasta] = useState('');

  const [activeTab, setActiveTab] = useState<'ALL' | 'SOLICITUDES' | 'INFORMES'>('ALL');
  const [selectedItemDetail, setSelectedItemDetail] = useState<{
    type: 'solicitud' | 'informe';
    data: any;
  } | null>(null);

  // Filtered Solicitudes
  const filteredSolicitudes = useMemo(() => {
    return solicitudes.filter((s) => {
      // Global quick term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesGlobal =
          s.nombresApellidos.toLowerCase().includes(q) ||
          s.cedula.toLowerCase().includes(q) ||
          s.telefonoCompleto.toLowerCase().includes(q) ||
          s.tipoSolicitud.toLowerCase().includes(q) ||
          s.estadoRemision.toLowerCase().includes(q) ||
          s.observaciones.toLowerCase().includes(q);
        if (!matchesGlobal) return false;
      }

      // Specific filters
      if (filterCedula.trim()) {
        const cleanCed = filterCedula.replace(/\D/g, '');
        const targetClean = s.cedula.replace(/\D/g, '');
        if (!targetClean.includes(cleanCed)) return false;
      }

      if (filterNombre.trim()) {
        if (!s.nombresApellidos.toLowerCase().includes(filterNombre.toLowerCase().trim())) {
          return false;
        }
      }

      if (filterTelefono.trim()) {
        const cleanTel = filterTelefono.replace(/\D/g, '');
        const targetTel = s.telefonoCompleto.replace(/\D/g, '');
        if (!targetTel.includes(cleanTel)) return false;
      }

      if (filterTipoSolicitud !== 'TODOS') {
        if (s.tipoSolicitud !== filterTipoSolicitud) return false;
      }

      if (filterEstadoRemision !== 'TODOS') {
        if (filterEstadoRemision === 'REMITIDAS' && !s.estadoRemision.startsWith('REMITIR')) {
          return false;
        } else if (filterEstadoRemision !== 'REMITIDAS' && s.estadoRemision !== filterEstadoRemision) {
          return false;
        }
      }

      // Filter by date range
      if (filterFechaDesde && s.fechaSolicitud < filterFechaDesde) return false;
      if (filterFechaHasta && s.fechaSolicitud > filterFechaHasta) return false;

      // If user selected a dependency/instituto or report type filter, solicitudes don't have them
      if (filterDependencia !== 'TODAS' || filterTipoInforme !== 'TODOS') {
        return false;
      }

      return true;
    });
  }, [
    solicitudes,
    searchTerm,
    filterCedula,
    filterNombre,
    filterTelefono,
    filterTipoSolicitud,
    filterEstadoRemision,
    filterDependencia,
    filterTipoInforme,
    filterFechaDesde,
    filterFechaHasta,
  ]);

  // Filtered Informes
  const filteredInformes = useMemo(() => {
    return informes.filter((inf) => {
      // Global quick term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesGlobal =
          inf.dependencia.toLowerCase().includes(q) ||
          inf.nombresApellidos.toLowerCase().includes(q) ||
          inf.cedula.toLowerCase().includes(q) ||
          inf.tipoInforme.toLowerCase().includes(q) ||
          (inf.actividadesEjecutadas && inf.actividadesEjecutadas.toLowerCase().includes(q)) ||
          (inf.hallazgos && inf.hallazgos.toLowerCase().includes(q));
        if (!matchesGlobal) return false;
      }

      // Specific filters
      if (filterCedula.trim()) {
        const cleanCed = filterCedula.replace(/\D/g, '');
        const targetClean = inf.cedula.replace(/\D/g, '');
        if (!targetClean.includes(cleanCed)) return false;
      }

      if (filterNombre.trim()) {
        if (!inf.nombresApellidos.toLowerCase().includes(filterNombre.toLowerCase().trim())) {
          return false;
        }
      }

      if (filterTelefono.trim()) {
        const cleanTel = filterTelefono.replace(/\D/g, '');
        const targetTel = (inf.telefono || '').replace(/\D/g, '');
        if (!targetTel.includes(cleanTel)) return false;
      }

      if (filterDependencia !== 'TODAS') {
        if (inf.dependencia.toUpperCase().trim() !== filterDependencia.toUpperCase().trim()) {
          return false;
        }
      }

      if (filterTipoInforme !== 'TODOS') {
        const matchesType =
          inf.tipoInforme === filterTipoInforme ||
          (filterTipoInforme === 'INFORME PARCIAL DE AUDITORIA' &&
            inf.tipoInforme === 'INFORME PARCIAL DE LA AUDITORIA OPERATIVA DE LA CONTRALORÍA MUNICIPAL');
        if (!matchesType) return false;
      }

      // If user specified Solicitud-specific filter
      if (filterTipoSolicitud !== 'TODOS' || filterEstadoRemision !== 'TODOS') {
        return false;
      }

      // Date filtering (checks fechaRegistro, fechaResolucion, or fechaAuditoria)
      const infFecha = (inf.fechaAuditoria || inf.fechaResolucion || inf.fechaRegistro || '').split('T')[0];
      if (filterFechaDesde && infFecha && infFecha < filterFechaDesde) return false;
      if (filterFechaHasta && infFecha && infFecha > filterFechaHasta) return false;

      return true;
    });
  }, [
    informes,
    searchTerm,
    filterCedula,
    filterNombre,
    filterTelefono,
    filterDependencia,
    filterTipoInforme,
    filterTipoSolicitud,
    filterEstadoRemision,
    filterFechaDesde,
    filterFechaHasta,
  ]);

  const totalResults = filteredSolicitudes.length + filteredInformes.length;

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Search Header Banner in Soft Metallic (No Logo) */}
      <div className="bg-gradient-to-r from-slate-800 via-zinc-800 to-slate-800 text-white rounded-2xl p-5 sm:p-6 shadow-xs border border-slate-700/60 flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-slate-700 flex items-center justify-center shrink-0 border border-slate-600">
            <Search className="w-6 h-6 text-slate-200" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300">
              Centro de Búsqueda y Consultas
            </span>
            <h2 className="font-institutional text-xl sm:text-2xl font-bold tracking-wide text-white mt-0.5">
              Búsqueda General de Solicitudes y Reportes
            </h2>
            <p className="text-xs text-slate-300">
              Consulte por Cédula, Nombres, Teléfono, Tipo de Solicitud, Dependencia, Tipo de Informe y Fechas
            </p>
          </div>
        </div>
      </div>

      {/* SEARCH FILTERS PANEL */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
        {/* Global Search Input */}
        <div className="relative">
          <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Escriba cualquier término: nombre, cédula, teléfono, observación, auditoría o actividad..."
            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white transition"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600"
            >
              Limpiar
            </button>
          )}
        </div>

        {/* Detailed Filters Grid (All parameters from item 6) */}
        <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1. NÚMERO DE CÉDULA */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Cédula de Identidad
            </label>
            <div className="relative">
              <CreditCard className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={filterCedula}
                onChange={(e) => setFilterCedula(e.target.value)}
                placeholder="Ej. 14852369"
                className="w-full pl-8 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          {/* 2. NOMBRES Y APELLIDOS */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Nombres y Apellidos
            </label>
            <div className="relative">
              <User className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={filterNombre}
                onChange={(e) => setFilterNombre(e.target.value)}
                placeholder="Ej. María Elena"
                className="w-full pl-8 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          {/* 3. TELÉFONO */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Teléfono
            </label>
            <div className="relative">
              <Phone className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={filterTelefono}
                onChange={(e) => setFilterTelefono(e.target.value)}
                placeholder="Ej. 0414 o 4851234"
                className="w-full pl-8 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          {/* 4. TIPO DE SOLICITUD */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Tipo de Solicitud
            </label>
            <select
              value={filterTipoSolicitud}
              onChange={(e) => setFilterTipoSolicitud(e.target.value)}
              className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:ring-2 focus:ring-emerald-600"
            >
              <option value="TODOS">Todos los Tipos</option>
              {TIPOS_SOLICITUD.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {tipo}
                </option>
              ))}
            </select>
          </div>

          {/* 5. ESTADO DE REMISIÓN */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Estado de Remisión
            </label>
            <select
              value={filterEstadoRemision}
              onChange={(e) => setFilterEstadoRemision(e.target.value)}
              className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:ring-2 focus:ring-emerald-600"
            >
              <option value="TODOS">Todos los Estados</option>
              <option value="ATENDIDO">ATENDIDO</option>
              <option value="PENDIENTE">PENDIENTE</option>
              <option value="RECHAZADA">RECHAZADA</option>
              <option value="REMITIDAS">REMITIDAS (Todas)</option>
              {ESTADOS_SOLICITUD.map((est) => (
                <option key={est} value={est}>
                  {est}
                </option>
              ))}
            </select>
          </div>

          {/* 6. POR DEPENDENCIA O INSTITUTO */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Dependencia o Instituto
            </label>
            <select
              value={filterDependencia}
              onChange={(e) => setFilterDependencia(e.target.value)}
              className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:ring-2 focus:ring-emerald-600"
            >
              <option value="TODAS">Todas las Dependencias</option>
              {DEPENDENCIAS_MUNICIPALES.map((dep) => (
                <option key={dep.id} value={dep.nombre}>
                  {dep.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* 7. POR TIPO DE INFORME */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Tipo de Informe
            </label>
            <select
              value={filterTipoInforme}
              onChange={(e) => setFilterTipoInforme(e.target.value)}
              className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:ring-2 focus:ring-emerald-600"
            >
              <option value="TODOS">Todos los Informes</option>
              <option value="REPORTE DE GESTIÓN TRIMESTRAL">
                REPORTE DE GESTIÓN TRIMESTRAL
              </option>
              <option value="INFORME PARCIAL DE AUDITORIA">
                INFORME PARCIAL DE AUDITORIA
              </option>
              <option value="INFORME DE AUDITORÍA DEFINITIVO">
                AUDITORÍA DEFINITIVA
              </option>
            </select>
          </div>

          {/* 8. POR FECHA (DESDE / HASTA) */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Desde
              </label>
              <input
                type="date"
                value={filterFechaDesde}
                onChange={(e) => setFilterFechaDesde(e.target.value)}
                className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Hasta
              </label>
              <input
                type="date"
                value={filterFechaHasta}
                onChange={(e) => setFilterFechaHasta(e.target.value)}
                className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900"
              />
            </div>
          </div>
        </div>

        {/* Results summary & Tab switcher */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'ALL'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos ({totalResults})
            </button>
            <button
              onClick={() => setActiveTab('SOLICITUDES')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'SOLICITUDES'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Solicitudes ({filteredSolicitudes.length})
            </button>
            <button
              onClick={() => setActiveTab('INFORMES')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'INFORMES'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Informes ({filteredInformes.length})
            </button>
          </div>

          <span className="text-xs text-slate-500 font-semibold">
            Mostrando {totalResults} registros coincidentes
          </span>
        </div>
      </div>

      {/* RESULTS LIST SECTION */}
      <div className="space-y-6">
        {/* SOLICITUDES RESULTS */}
        {(activeTab === 'ALL' || activeTab === 'SOLICITUDES') && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-emerald-700" />
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                  Solicitudes Ciudadanas ({filteredSolicitudes.length})
                </h3>
              </div>
            </div>

            {filteredSolicitudes.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                No se encontraron solicitudes con los filtros aplicados.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredSolicitudes.map((sol) => (
                  <div
                    key={sol.id}
                    onClick={() => setSelectedItemDetail({ type: 'solicitud', data: sol })}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-emerald-50/30 hover:border-emerald-300 transition cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="text-xs font-black text-slate-900">
                            {sol.nombresApellidos}
                          </p>
                          <p className="text-[11px] text-slate-500 font-mono">
                            {sol.cedula} • {sol.telefonoCompleto}
                          </p>
                        </div>

                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                            sol.estadoRemision === 'ATENDIDO'
                              ? 'bg-emerald-100 text-emerald-800'
                              : sol.estadoRemision === 'RECHAZADA'
                              ? 'bg-rose-100 text-rose-800'
                              : sol.estadoRemision === 'PENDIENTE'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-sky-100 text-sky-800'
                          }`}
                        >
                          {sol.estadoRemision}
                        </span>
                      </div>

                      <div className="mb-2">
                        <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded">
                          {sol.tipoSolicitud}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 line-clamp-2">
                        {sol.observaciones || 'Sin observaciones registradas'}
                      </p>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Fecha: {sol.fechaSolicitud}</span>
                      <span className="text-emerald-700 font-bold flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5" /> Ver Detalle
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* INFORMES RESULTS */}
        {(activeTab === 'ALL' || activeTab === 'INFORMES') && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-sky-700" />
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                  Informes de Dependencias e Institutos ({filteredInformes.length})
                </h3>
              </div>
            </div>

            {filteredInformes.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                No se encontraron informes con los filtros aplicados.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredInformes.map((inf) => (
                  <div
                    key={inf.id}
                    onClick={() => setSelectedItemDetail({ type: 'informe', data: inf })}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-sky-50/30 hover:border-sky-300 transition cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-sky-100 text-sky-800">
                          {inf.tipoInforme}
                        </span>
                        {inf.alcancePorcentaje !== undefined && (
                          <span className="text-xs font-mono font-bold text-emerald-700">
                            {inf.alcancePorcentaje}% Alcance
                          </span>
                        )}
                      </div>

                      <h4 className="text-xs font-black text-slate-900 leading-snug">
                        {inf.dependencia}
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {inf.cargo ? `${inf.cargo} • ` : ''}{inf.nombresApellidos} ({inf.cedula})
                      </p>

                      <p className="text-xs text-slate-600 mt-2 line-clamp-2">
                        {inf.actividadesEjecutadas || inf.descripcionDetallada || inf.hallazgos || ''}
                      </p>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Registrado: {inf.fechaRegistro.split('T')[0]}</span>
                      <span className="text-sky-700 font-bold flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5" /> Ver Informe
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* DETAIL MODAL FOR INSPECTING ANY SOLICITUD OR INFORME */}
      {selectedItemDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-white rounded-3xl p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700">
                  {selectedItemDetail.type === 'solicitud' ? 'Expediente de Solicitud' : 'Informe Municipal'}
                </span>
                <h3 className="text-lg font-black text-slate-900">
                  {selectedItemDetail.type === 'solicitud'
                    ? selectedItemDetail.data.nombresApellidos
                    : selectedItemDetail.data.dependencia}
                </h3>
              </div>
              <button
                onClick={() => setSelectedItemDetail(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            {selectedItemDetail.type === 'solicitud' ? (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl">
                  <div>
                    <span className="text-slate-400 block font-bold">Cédula:</span>
                    <span className="font-mono font-bold text-slate-900">{selectedItemDetail.data.cedula}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-bold">Teléfono:</span>
                    <span className="font-mono font-bold text-slate-900">{selectedItemDetail.data.telefonoCompleto}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-bold">Tipo de Solicitud:</span>
                    <span className="font-bold text-emerald-700">{selectedItemDetail.data.tipoSolicitud}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-bold">Fecha de Solicitud:</span>
                    <span className="font-bold text-slate-900">{selectedItemDetail.data.fechaSolicitud}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 block font-bold">Estado / Remisión:</span>
                    <span className="font-bold text-sky-700">{selectedItemDetail.data.estadoRemision}</span>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-slate-700 uppercase tracking-wider mb-1">Observaciones / Referencia</h4>
                  <p className="p-3 bg-slate-50 rounded-xl text-slate-800 leading-relaxed">
                    {selectedItemDetail.data.observaciones || 'Sin observaciones registradas.'}
                  </p>
                </div>

                {selectedItemDetail.data.adjuntos && selectedItemDetail.data.adjuntos.length > 0 && (
                  <div>
                    <h4 className="font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Archivos Adjuntos ({selectedItemDetail.data.adjuntos.length})
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {selectedItemDetail.data.adjuntos.map((adj: any) => (
                        <div key={adj.id} className="p-2 border rounded-xl bg-slate-50 flex flex-col items-center">
                          {adj.type === 'pdf' ? (
                            <FileText className="w-8 h-8 text-rose-600" />
                          ) : (
                            <img src={adj.dataUrl} alt={adj.name} className="w-full h-16 object-cover rounded" />
                          )}
                          <p className="text-[10px] text-slate-700 truncate w-full mt-1">{adj.name}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl">
                  <div>
                    <span className="text-slate-400 block font-bold">Responsable:</span>
                    <span className="font-bold text-slate-900">{selectedItemDetail.data.nombresApellidos}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-bold">Cédula:</span>
                    <span className="font-mono font-bold text-slate-900">{selectedItemDetail.data.cedula}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-bold">Cargo:</span>
                    <span className="font-bold text-slate-800">{selectedItemDetail.data.cargo || 'Funcionario'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-bold">Teléfono:</span>
                    <span className="font-mono font-bold text-slate-800">{selectedItemDetail.data.telefono}</span>
                  </div>
                  {selectedItemDetail.data.numeroResolucion && (
                    <div className="col-span-2">
                      <span className="text-slate-400 block font-bold">Resolución:</span>
                      <span className="font-mono font-bold text-sky-800">
                        {selectedItemDetail.data.numeroResolucion} ({selectedItemDetail.data.fechaResolucion})
                      </span>
                    </div>
                  )}
                </div>

                {selectedItemDetail.data.tipoInforme === 'REPORTE DE GESTIÓN TRIMESTRAL' ? (
                  <>
                    <div>
                      <h4 className="font-bold text-slate-700 uppercase tracking-wider mb-1">Actividades Ejecutadas</h4>
                      <p className="p-3 bg-slate-50 rounded-xl text-slate-800 leading-relaxed">
                        {selectedItemDetail.data.actividadesEjecutadas}
                      </p>
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-700 uppercase tracking-wider mb-1">Logros Alcanzados</h4>
                      <p className="p-3 bg-slate-50 rounded-xl text-slate-800 leading-relaxed">
                        {selectedItemDetail.data.logrosAlcanzados}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <h4 className="font-bold text-slate-700 uppercase tracking-wider mb-1">Procedimientos Auditados</h4>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {selectedItemDetail.data.procedimientosAuditados?.map((p: string) => (
                          <span key={p} className="px-2 py-0.5 bg-sky-100 text-sky-800 rounded font-semibold text-[10px]">
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-700 uppercase tracking-wider mb-1">Descripción y Hallazgos</h4>
                      <p className="p-3 bg-slate-50 rounded-xl text-slate-800 leading-relaxed">
                        {selectedItemDetail.data.descripcionDetallada}
                      </p>
                      <p className="p-3 bg-amber-50 rounded-xl text-amber-900 leading-relaxed mt-2 border border-amber-200">
                        <strong>Hallazgos:</strong> {selectedItemDetail.data.hallazgos}
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedItemDetail(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
              >
                Cerrar Detalle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
