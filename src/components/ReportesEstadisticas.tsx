import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  BarChart3,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  Clock,
  XCircle,
  ArrowRightCircle,
  Building,
  UserCheck,
  Search,
  Filter,
  Calendar,
  AlertOctagon,
  Edit,
  ShieldCheck,
  Check,
  X,
  Send,
  Eye,
  FileDown,
  Download,
  HardDrive,
  ClipboardList,
  Users,
  Trash2,
  ChevronDown,
  Menu,
  FolderArchive,
  Target,
} from 'lucide-react';
import {
  Solicitud,
  InformeDependencia,
  EstadoSolicitud,
  EstadoInforme,
  AppUser,
  RegistroAsistencia,
  Funcionario,
  MetaPoa,
} from '../types';
import { DEPENDENCIAS_MUNICIPALES } from '../data/dependenciasData';
import { formatFechaEspanol } from '../utils/storage';
import {
  exportarExcelReportes,
  exportarPDFReportes,
  exportarExcelSoloSolicitudes,
  exportarExcelSoloInformes,
  exportarPDFSoloSolicitudes,
  exportarPDFSoloInformes,
  exportarPDFSolicitudIndividual,
  exportarExcelMemorandumYMetricas,
  exportarPDFMemorandumYMetricas,
  exportarPDFControlCumplimiento,
  exportarExcelControlCumplimiento,
} from '../utils/exportUtils';
import { SolicitudesList } from './SolicitudesList';
import { InformesList } from './InformesList';
import { DriveBackupPanel } from './DriveBackupPanel';
import { MemorandumMetricasView } from './MemorandumMetricasView';
import { AsistenciasEntesReporte } from './AsistenciasEntesReporte';
import { AdjuntosExportPanel } from './AdjuntosExportPanel';
import { MetasPoaMetricasView } from './MetasPoaMetricasView';
import { DirectorioFuncionariosView } from './DirectorioFuncionariosView';

export type SubTabReportes =
  | 'estadisticas'
  | 'asistencias_entes'
  | 'memorandum'
  | 'poa'
  | 'adjuntos'
  | 'solicitudes'
  | 'informes'
  | 'funcionarios'
  | 'respaldo';

interface ReportesEstadisticasProps {
  currentUser: AppUser;
  solicitudes: Solicitud[];
  informes: InformeDependencia[];
  asistencias?: RegistroAsistencia[];
  funcionarios?: Funcionario[];
  metasPoa?: MetaPoa[];
  onUpdateSolicitudEstado: (id: string, nuevoEstado: EstadoSolicitud, otroEspecifique?: string) => void;
  onEditSolicitud: (solicitud: Solicitud) => void;
  onDeleteSolicitud?: (id: string) => void;
  onNewSolicitud?: () => void;
  onNewInforme?: () => void;
  onNewAsistencia?: () => void;
  onNewPoa?: () => void;
  onEditInforme?: (informe: InformeDependencia) => void;
  onDeleteInforme?: (id: string) => void;
  onUpdateInformeEstado?: (
    id: string,
    nuevoEstado: EstadoInforme,
    detalles?: { remitidoA?: string; motivo?: string; observacion?: string }
  ) => void;
  activeSubTab?: SubTabReportes;
  onSelectSubTab?: (tab: SubTabReportes) => void;
  onOpenFuncionariosModal?: () => void;
  onClearAllData?: () => void;
  onCleanCacheAndSync?: () => void;
  isCleaningCache?: boolean;
  syncStatus?: string;
}

export const ReportesEstadisticas: React.FC<ReportesEstadisticasProps> = ({
  currentUser,
  solicitudes,
  informes,
  asistencias = [],
  funcionarios = [],
  metasPoa = [],
  onUpdateSolicitudEstado,
  onEditSolicitud,
  onDeleteSolicitud,
  onNewSolicitud,
  onNewInforme,
  onNewAsistencia,
  onNewPoa,
  onEditInforme,
  onDeleteInforme,
  onUpdateInformeEstado,
  activeSubTab = 'estadisticas',
  onSelectSubTab,
  onOpenFuncionariosModal,
  onClearAllData,
  onCleanCacheAndSync,
  isCleaningCache = false,
  syncStatus = 'connected',
}) => {
  const isPrimary =
    currentUser.role === 'PRIMARY_ADMIN' ||
    currentUser.email === 'dg.municipiotianquillo@gmail.com' ||
    currentUser.email === 'dg.municipiotinaquillo@gmail.com' ||
    currentUser.email === 'sistemasdegestion26@gmail.com';

  const [currentSubTab, setCurrentSubTab] = useState<SubTabReportes>(activeSubTab);
  const [subTabMenuOpen, setSubTabMenuOpen] = useState(false);
  const subTabMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeSubTab) {
      setCurrentSubTab(activeSubTab);
    }
  }, [activeSubTab]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (subTabMenuRef.current && !subTabMenuRef.current.contains(event.target as Node)) {
        setSubTabMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubTabChange = (tab: SubTabReportes) => {
    setCurrentSubTab(tab);
    setSubTabMenuOpen(false);
    if (onSelectSubTab) {
      onSelectSubTab(tab);
    }
  };

  // State for remision modal or prompt
  const [remitirModalOpen, setRemitirModalOpen] = useState(false);
  const [selectedSolicitudForRemit, setSelectedSolicitudForRemit] = useState<Solicitud | null>(null);
  const [selectedRemitirDestino, setSelectedRemitirDestino] = useState<string>('ADMINISTRACIÓN');
  const [otroRemitirTexto, setOtroRemitirTexto] = useState('');

  // Search in table
  const [tableSearch, setTableSearch] = useState('');
  const [tableFilterEstado, setTableFilterEstado] = useState<string>('TODOS');

  // Filter compliance
  const [complianceFilter, setComplianceFilter] = useState<'TODOS' | 'CARGO' | 'PENDIENTE'>('TODOS');
  const [complianceSearch, setComplianceSearch] = useState('');

  // Security barrier
  if (!isPrimary) {
    return (
      <div className="max-w-2xl mx-auto my-12 p-8 bg-white rounded-2xl border border-rose-200 shadow-lg text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
          <AlertOctagon className="w-9 h-9" />
        </div>
        <h2 className="text-xl font-black text-slate-900">Acceso Restringido a Estadísticas</h2>
        <p className="text-sm text-slate-600">
          El módulo de <strong>Reportes y Estadísticas</strong> está reservado exclusivamente para el usuario principal de la Dirección General (<code>dg.municipiotinaquillo@gmail.com</code>).
        </p>
        <p className="text-xs text-slate-500">
          Su sesión actual está autenticada como <strong>{currentUser.email}</strong>.
        </p>
      </div>
    );
  }

  // --- STATISTICAL CALCULATIONS ---
  const total = solicitudes.length;
  const atendidas = solicitudes.filter((s) => s.estadoRemision === 'ATENDIDO').length;
  const pendientes = solicitudes.filter((s) => s.estadoRemision === 'PENDIENTE').length;
  const rechazadas = solicitudes.filter((s) => s.estadoRemision === 'RECHAZADA').length;
  const remitidas = total - (atendidas + pendientes + rechazadas);

  const pctAtendidas = total > 0 ? Math.round((atendidas / total) * 100) : 0;
  const pctPendientes = total > 0 ? Math.round((pendientes / total) * 100) : 0;
  const pctRechazadas = total > 0 ? Math.round((rechazadas / total) * 100) : 0;

  // Breakdown by Type of Solicitud
  const solicitudesPorTipo = useMemo(() => {
    const map: Record<string, number> = {};
    solicitudes.forEach((s) => {
      map[s.tipoSolicitud] = (map[s.tipoSolicitud] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [solicitudes]);

  // Breakdown by Cédula (Ayudas por Cédula)
  const ayudasPorCedula = useMemo(() => {
    const map: Record<string, { nombre: string; cant: number; tipos: Set<string>; ultimaFecha: string }> = {};
    solicitudes.forEach((s) => {
      if (!map[s.cedula]) {
        map[s.cedula] = {
          nombre: s.nombresApellidos,
          cant: 0,
          tipos: new Set(),
          ultimaFecha: s.fechaSolicitud,
        };
      }
      map[s.cedula].cant += 1;
      map[s.cedula].tipos.add(s.tipoSolicitud);
      if (s.fechaSolicitud > map[s.cedula].ultimaFecha) {
        map[s.cedula].ultimaFecha = s.fechaSolicitud;
      }
    });
    return Object.entries(map).sort((a, b) => b[1].cant - a[1].cant);
  }, [solicitudes]);

  // Breakdown of Informes
  const totalInformes = informes.length;
  const informesMemorandum = informes.filter(
    (i) =>
      i.tipoInforme === 'MEMORANDUM INTERNO' ||
      i.tipoInforme === 'REGISTRO DE COMUNICACIÓN INTERNA DE DIRECTORIO'
  ).length;
  const informesTrimestrales = informes.filter(
    (i) => i.tipoInforme === 'REPORTE DE GESTIÓN TRIMESTRAL'
  ).length;
  const informesAuditoriaParcial = informes.filter(
    (i) =>
      i.tipoInforme === 'INFORME PARCIAL DE AUDITORIA' ||
      i.tipoInforme === 'INFORME PARCIAL DE LA AUDITORIA OPERATIVA DE LA CONTRALORÍA MUNICIPAL'
  ).length;
  const informesAuditoriaDefinitiva = informes.filter(
    (i) => i.tipoInforme === 'INFORME DE AUDITORÍA DEFINITIVO'
  ).length;

  // Comunicación Interna de Directorio / Memorándum metrics
  const depsCumplieronMemorandum = useMemo(() => {
    return DEPENDENCIAS_MUNICIPALES.filter((dep) =>
      informes.some(
        (inf) =>
          inf.dependencia.toUpperCase().trim() === dep.nombre.toUpperCase().trim() &&
          (inf.tipoInforme === 'MEMORANDUM INTERNO' ||
            inf.tipoInforme === 'REGISTRO DE COMUNICACIÓN INTERNA DE DIRECTORIO')
      )
    );
  }, [informes]);

  const totalDeps = DEPENDENCIAS_MUNICIPALES.length;
  const totalCumplieronMemo = depsCumplieronMemorandum.length;
  const totalPendientesMemo = totalDeps - totalCumplieronMemo;
  const pctCumplieronMemo = totalDeps > 0 ? Math.round((totalCumplieronMemo / totalDeps) * 100) : 0;
  const totalConFirmasDigitalizadas = useMemo(() => {
    return informes.filter(
      (i) =>
        (i.tipoInforme === 'MEMORANDUM INTERNO' ||
          i.tipoInforme === 'REGISTRO DE COMUNICACIÓN INTERNA DE DIRECTORIO') &&
        i.fotoFirmaPersonal &&
        i.fotoFirmaPersonal.length > 0
    ).length;
  }, [informes]);

  // Sector breakdown for comunicación interna
  const sectorMemoResumen = useMemo(() => {
    const sectors = [
      { tipo: 'CENTRALIZADA', label: 'Centralizadas' },
      { tipo: 'INSTITUTO', label: 'Institutos' },
      { tipo: 'EMPRESA', label: 'Empresas' },
    ];
    return sectors.map((s) => {
      const list = DEPENDENCIAS_MUNICIPALES.filter((d) => d.tipo === s.tipo);
      const cCount = list.filter((d) =>
        informes.some(
          (inf) =>
            inf.dependencia.toUpperCase().trim() === d.nombre.toUpperCase().trim() &&
            (inf.tipoInforme === 'MEMORANDUM INTERNO' ||
              inf.tipoInforme === 'REGISTRO DE COMUNICACIÓN INTERNA DE DIRECTORIO')
        )
      ).length;
      const p = list.length > 0 ? Math.round((cCount / list.length) * 100) : 0;
      return { ...s, total: list.length, cumplieron: cCount, pct: p };
    });
  }, [informes]);

  // Compliance (Quién cargó informes y quién no)
  const informesCountByDep = useMemo(() => {
    const map = new Map<string, number>();
    informes.forEach((inf) => {
      const key = inf.dependencia.toUpperCase().trim();
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  }, [informes]);

  const dependenciasCumplimiento = useMemo(() => {
    return DEPENDENCIAS_MUNICIPALES.map((dep) => {
      const count = informesCountByDep.get(dep.nombre.toUpperCase().trim()) || 0;
      return {
        ...dep,
        cargoInformes: count > 0,
        cantidadInformes: count,
      };
    });
  }, [informesCountByDep]);

  const filteredCompliance = useMemo(() => {
    return dependenciasCumplimiento.filter((dep) => {
      if (complianceFilter === 'CARGO' && !dep.cargoInformes) return false;
      if (complianceFilter === 'PENDIENTE' && dep.cargoInformes) return false;
      if (complianceSearch.trim()) {
        const query = complianceSearch.toLowerCase();
        return (
          dep.nombre.toLowerCase().includes(query) ||
          dep.tipo.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [dependenciasCumplimiento, complianceFilter, complianceSearch]);

  const totalCargaron = dependenciasCumplimiento.filter((d) => d.cargoInformes).length;
  const totalPendientesCarga = dependenciasCumplimiento.length - totalCargaron;
  const pctCumplimiento = Math.round((totalCargaron / dependenciasCumplimiento.length) * 100);

  // Filtered solicitudes table
  const filteredSolicitudes = useMemo(() => {
    return solicitudes.filter((s) => {
      if (tableFilterEstado !== 'TODOS') {
        if (tableFilterEstado === 'REMITIDAS' && !s.estadoRemision.startsWith('REMITIR')) {
          return false;
        } else if (tableFilterEstado !== 'REMITIDAS' && s.estadoRemision !== tableFilterEstado) {
          return false;
        }
      }
      if (tableSearch.trim()) {
        const query = tableSearch.toLowerCase();
        return (
          s.nombresApellidos.toLowerCase().includes(query) ||
          s.cedula.toLowerCase().includes(query) ||
          s.tipoSolicitud.toLowerCase().includes(query) ||
          s.telefonoCompleto.toLowerCase().includes(query) ||
          s.estadoRemision.toLowerCase().includes(query) ||
          s.observaciones.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [solicitudes, tableFilterEstado, tableSearch]);

  // Handle open remitir modal
  const openRemitirModal = (sol: Solicitud) => {
    setSelectedSolicitudForRemit(sol);
    setSelectedRemitirDestino('ADMINISTRACIÓN');
    setOtroRemitirTexto('');
    setRemitirModalOpen(true);
  };

  const confirmRemitir = () => {
    if (!selectedSolicitudForRemit) return;
    let nuevoEstado: EstadoSolicitud = 'REMITIR A ADMINISTRACIÓN';

    if (selectedRemitirDestino === 'ADMINISTRACIÓN') nuevoEstado = 'REMITIR A ADMINISTRACIÓN';
    else if (selectedRemitirDestino === 'DESPACHO') nuevoEstado = 'REMITIR A DESPACHO';
    else if (selectedRemitirDestino === 'DESARROLLO SOCIAL') nuevoEstado = 'REMITIR A DESARROLLO SOCIAL';
    else if (selectedRemitirDestino === 'SERVICIOS PÚBLICOS') nuevoEstado = 'REMITIR A SERVICIOS PÚBLICOS';
    else if (selectedRemitirDestino === 'TALENTO HUMANO') nuevoEstado = 'REMITIR A TALENTO HUMANO';
    else if (selectedRemitirDestino === 'OTRO') nuevoEstado = 'REMITIDO A OTRO';

    onUpdateSolicitudEstado(
      selectedSolicitudForRemit.id,
      nuevoEstado,
      selectedRemitirDestino === 'OTRO' ? otroRemitirTexto : undefined
    );
    setRemitirModalOpen(false);
  };

  const fechaEmision = formatFechaEspanol(new Date().toISOString());

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* HEADER CARD IN REFINED INSTITUTIONAL SLATE (ZERO GLARE, CALM CONTRAST) */}
      <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xs border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Dirección General • Tinaquillo
          </span>
          <h1 className="font-institutional text-2xl sm:text-3xl font-bold tracking-wide mt-0.5 text-white">
            Reportes, Control de Gestión y Registros
          </h1>
          <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>Fecha de Emisión: <strong>{fechaEmision}</strong></span>
          </p>
        </div>

        {/* UNIFIED SUB-TABS DROPDOWN MENU */}
        <div className="relative" ref={subTabMenuRef}>
          <button
            type="button"
            onClick={() => setSubTabMenuOpen(!subTabMenuOpen)}
            className="flex items-center gap-2.5 px-4 py-2.5 bg-slate-950 hover:bg-slate-800 text-white rounded-xl border border-slate-700 font-bold text-xs sm:text-sm shadow-md transition cursor-pointer"
            aria-expanded={subTabMenuOpen}
          >
            <BarChart3 className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Vista:{' '}
              <strong className="text-amber-300">
                {currentSubTab === 'estadisticas' && 'Estadísticas'}
                {currentSubTab === 'asistencias_entes' && 'Asistencias por Entes'}
                {currentSubTab === 'memorandum' && 'Cumplimiento Comunicación Interna de Directorio'}
                {currentSubTab === 'poa' && 'Métricas POA (Planificación)'}
                {currentSubTab === 'adjuntos' && 'Descarga por Carpeta'}
                {currentSubTab === 'solicitudes' && `Ver Solicitudes (${solicitudes.length})`}
                {currentSubTab === 'informes' && `Ver Informes (${informes.length})`}
                {currentSubTab === 'funcionarios' && `Directorio de Funcionarios (${funcionarios.length})`}
                {currentSubTab === 'respaldo' && 'Respaldar en Drive'}
              </strong>
            </span>
            <ChevronDown
              className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${
                subTabMenuOpen ? 'rotate-180 text-amber-400' : ''
              }`}
            />
          </button>

          {/* Menú Desplegable de Subpestañas */}
          {subTabMenuOpen && (
            <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-40 p-2 space-y-1 animate-in fade-in-0 zoom-in-95 duration-150">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-3 py-1.5">
                Seleccionar Vista de Reporte
              </p>

              <button
                type="button"
                onClick={() => handleSubTabChange('estadisticas')}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  currentSubTab === 'estadisticas'
                    ? 'bg-slate-800 text-amber-300 border border-slate-700'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <BarChart3 className="w-4 h-4 text-amber-400" />
                  <span>Estadísticas Generales</span>
                </div>
                {currentSubTab === 'estadisticas' && <Check className="w-3.5 h-3.5 text-amber-400" />}
              </button>

              <button
                type="button"
                onClick={() => handleSubTabChange('asistencias_entes')}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  currentSubTab === 'asistencias_entes'
                    ? 'bg-slate-800 text-emerald-300 border border-slate-700'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Users className="w-4 h-4 text-emerald-400" />
                  <span>Asistencias por Entes</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-700/50 text-[10px] font-bold">
                  38
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleSubTabChange('memorandum')}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  currentSubTab === 'memorandum'
                    ? 'bg-slate-800 text-amber-300 border border-slate-700'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span>Comunicación Interna de Directorio & Métricas</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-bold">
                  {totalCumplieronMemo}/{totalDeps}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleSubTabChange('poa')}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  currentSubTab === 'poa'
                    ? 'bg-slate-800 text-sky-300 border border-slate-700'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Target className="w-4 h-4 text-sky-400" />
                  <span>Métricas POA (Planificación)</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-sky-950/80 text-sky-300 border border-sky-700/50 text-[10px] font-bold">
                  {metasPoa.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleSubTabChange('adjuntos')}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  currentSubTab === 'adjuntos'
                    ? 'bg-slate-800 text-amber-300 border border-slate-700'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <FolderArchive className="w-4 h-4 text-amber-400" />
                  <span>Descarga por Carpeta</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-700/50 text-[10px] font-bold">
                  Carpeta
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleSubTabChange('solicitudes')}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  currentSubTab === 'solicitudes'
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4 text-sky-400" />
                  <span>Ver Solicitudes</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-bold">
                  {solicitudes.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleSubTabChange('informes')}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  currentSubTab === 'informes'
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <ClipboardList className="w-4 h-4 text-emerald-400" />
                  <span>Ver Informes</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-bold">
                  {informes.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleSubTabChange('funcionarios')}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  currentSubTab === 'funcionarios'
                    ? 'bg-slate-800 text-amber-300 border border-slate-700'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <UserCheck className="w-4 h-4 text-amber-400" />
                  <span>Directorio de Funcionarios</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-bold">
                  {funcionarios.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleSubTabChange('respaldo')}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  currentSubTab === 'respaldo'
                    ? 'bg-slate-800 text-sky-300 border border-slate-700'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <HardDrive className="w-4 h-4 text-sky-400" />
                  <span>Respaldar en Google Drive</span>
                </div>
                {currentSubTab === 'respaldo' && <Check className="w-3.5 h-3.5 text-sky-400" />}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* RENDER CONDITIONAL SUB-TABS */}
      {currentSubTab === 'asistencias_entes' && (
        <AsistenciasEntesReporte
          asistencias={asistencias}
          onNewAsistencia={onNewAsistencia}
        />
      )}

      {currentSubTab === 'memorandum' && (
        <MemorandumMetricasView
          informes={informes}
          funcionarios={funcionarios}
          onNewInforme={onNewInforme}
        />
      )}

      {currentSubTab === 'poa' && (
        <MetasPoaMetricasView metasPoa={metasPoa} onNewRegistro={onNewPoa} />
      )}

      {currentSubTab === 'adjuntos' && (
        <AdjuntosExportPanel
          solicitudes={solicitudes}
          informes={informes}
          asistencias={asistencias}
        />
      )}

      {currentSubTab === 'solicitudes' && (
        <SolicitudesList
          solicitudes={solicitudes}
          onNewSolicitud={onNewSolicitud || (() => {})}
          onEditSolicitud={onEditSolicitud}
          onDeleteSolicitud={onDeleteSolicitud || (() => {})}
        />
      )}

      {currentSubTab === 'informes' && (
        <InformesList
          informes={informes}
          currentUser={currentUser}
          onNewInforme={onNewInforme || (() => {})}
          onEditInforme={onEditInforme || (() => {})}
          onDeleteInforme={onDeleteInforme || (() => {})}
          onUpdateInformeEstado={onUpdateInformeEstado}
        />
      )}

      {currentSubTab === 'funcionarios' && (
        <DirectorioFuncionariosView
          currentUser={currentUser}
          funcionarios={funcionarios}
          onOpenFuncionariosModal={onOpenFuncionariosModal || (() => {})}
          onRefresh={onCleanCacheAndSync}
        />
      )}

      {currentSubTab === 'respaldo' && (
        <DriveBackupPanel
          currentUser={currentUser}
          solicitudes={solicitudes}
          informes={informes}
          asistencias={asistencias}
          onClearAllData={onClearAllData}
          onCleanCacheAndSync={onCleanCacheAndSync}
          isCleaningCache={isCleaningCache}
        />
      )}

      {currentSubTab === 'estadisticas' && (
        <div className="space-y-8">
          {/* Quick Analytical Export Bar inside Statistics view */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <Download className="w-4 h-4 text-slate-500" />
              <span>Exportar Reporte General:</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => exportarExcelReportes(solicitudes, informes)}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-semibold transition border border-emerald-200 cursor-pointer shadow-2xs"
                title="Descargar datos en Excel"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Excel General</span>
              </button>
              <button
                type="button"
                onClick={() => exportarPDFReportes(solicitudes, informes)}
                className="flex items-center gap-1.5 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-800 rounded-lg text-xs font-semibold transition border border-rose-200 cursor-pointer shadow-2xs"
                title="Generar Acta Oficial en PDF"
              >
                <FileText className="w-4 h-4 text-rose-600" />
                <span>PDF General</span>
              </button>
            </div>
          </div>

          {/* DEDICATED HIGHLIGHT CARD: CUMPLIMIENTO DE COMUNICACIÓN INTERNA DE DIRECTORIO */}
          <div className="bg-white text-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold border border-slate-200 text-[10px] uppercase tracking-wider">
                  Cumplimiento
                </span>
                <span className="text-xs text-slate-500">
                  {totalCumplieronMemo} / {totalDeps} ({pctCumplieronMemo}%)
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0" />
                <span>Control de Comunicación Interna de Directorio</span>
              </h3>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 pt-0.5">
                {sectorMemoResumen.map((s) => (
                  <span key={s.tipo} className="flex items-center gap-1">
                    <strong className="text-slate-900">{s.label}:</strong> {s.cumplieron}/{s.total} ({s.pct}%)
                  </span>
                ))}
                <span className="text-amber-700 font-semibold">• {totalConFirmasDigitalizadas} con firmas adjuntas</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleSubTabChange('memorandum')}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition shadow-2xs cursor-pointer shrink-0"
            >
              <span>Detalles</span>
              <ArrowRightCircle className="w-4 h-4" />
            </button>
          </div>

          {/* BANNER ASISTENCIAS POR ENTES (38 DEPENDENCIAS, EMPRESAS E INSTITUTOS) */}
          <div className="bg-emerald-50/50 border border-emerald-200/80 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold border border-emerald-300 text-[10px] uppercase tracking-wider">
                  Participación Institucional
                </span>
                <span className="text-xs text-slate-500">
                  {asistencias.length} actividades convocadas
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-700 shrink-0" />
                <span>Asistencias por Dependencia, Empresa e Instituto</span>
              </h3>
            </div>

            <button
              type="button"
              onClick={() => handleSubTabChange('asistencias_entes')}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-xl text-xs transition shadow-2xs cursor-pointer shrink-0"
            >
              <span>Ver Reporte de Entes</span>
              <ArrowRightCircle className="w-4 h-4" />
            </button>
          </div>


      {/* METRICS OVERVIEW CARDS - ZERO GLARE SOLID MATTE CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Total Solicitudes */}
        <div className="p-4 sm:p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Total Solicitudes</span>
            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-black text-slate-900">{total}</p>
            <p className="text-[11px] text-slate-500 mt-1">Registradas en sistema</p>
          </div>
        </div>

        {/* Atendidas */}
        <div className="p-4 sm:p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Atendidas</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl sm:text-3xl font-black text-slate-900">{atendidas}</p>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">({pctAtendidas}%)</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Ayuda entregada con éxito</p>
          </div>
        </div>

        {/* Pendientes */}
        <div className="p-4 sm:p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Pendientes</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center text-amber-700">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl sm:text-3xl font-black text-slate-900">{pendientes}</p>
              <span className="text-xs font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded">({pctPendientes}%)</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">En proceso de evaluación</p>
          </div>
        </div>

        {/* Rechazadas */}
        <div className="p-4 sm:p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Rechazadas</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 flex items-center justify-center text-rose-700">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl sm:text-3xl font-black text-slate-900">{rechazadas}</p>
              <span className="text-xs font-bold text-rose-800 bg-rose-50 px-1.5 py-0.5 rounded">({pctRechazadas}%)</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">No procedentes</p>
          </div>
        </div>

        {/* Remitidas */}
        <div className="col-span-2 sm:col-span-2 lg:col-span-1 p-4 sm:p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Remitidas</span>
            <div className="w-7 h-7 rounded-lg bg-sky-50 flex items-center justify-center text-sky-700">
              <ArrowRightCircle className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-black text-slate-900">{remitidas}</p>
            <p className="text-[11px] text-slate-500 mt-1">A Direcciones Municipales</p>
          </div>
        </div>
      </div>

      {/* SECTION: REPORTES POR DEPENDENCIA E INSTITUTOS & CONTROL DE AUDITORÍAS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card 1: Informes Cargados por Tipo */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
              <Building className="w-4 h-4 text-emerald-600" />
              <span>Informes de Dependencias</span>
            </h3>
            <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
              {totalInformes} Total
            </span>
          </div>

          <div className="space-y-3">
            <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-800">Comunicación Interna de Directorio</p>
                <p className="text-[11px] text-slate-500">Quién cumplió y firmas</p>
              </div>
              <div className="text-right">
                <span className="text-lg font-black text-amber-700">{informesMemorandum}</span>
                <span className="text-[10px] text-slate-400 block">{totalCumplieronMemo} entidades</span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-800">Informe Trimestral</p>
                <p className="text-[11px] text-slate-500">Por Dependencia e Instituto</p>
              </div>
              <span className="text-lg font-black text-sky-700">{informesTrimestrales}</span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-800">Auditoría Parcial</p>
                <p className="text-[11px] text-slate-500">Contraloría Municipal</p>
              </div>
              <span className="text-lg font-black text-amber-700">{informesAuditoriaParcial}</span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-800">Auditoría Definitiva</p>
                <p className="text-[11px] text-slate-500">Por Dependencia e Instituto</p>
              </div>
              <span className="text-lg font-black text-emerald-700">{informesAuditoriaDefinitiva}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Distribución por Tipo de Solicitud */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-sky-600" />
              <span>Tipo de Solicitudes</span>
            </h3>
            <span className="text-xs text-slate-500">{solicitudesPorTipo.length} categorías</span>
          </div>

          <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
            {solicitudesPorTipo.map(([tipo, cant]) => {
              const pct = total > 0 ? Math.round((cant / total) * 100) : 0;
              return (
                <div key={tipo} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 truncate">{tipo}</span>
                    <span className="font-mono font-bold text-slate-900">
                      {cant} <span className="text-slate-400 font-normal">({pct}%)</span>
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Card 3: Número de Ayudas por Cédula (Frecuencia) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-amber-600" />
              <span>Ayudas por Cédula</span>
            </h3>
            <span className="text-xs text-slate-500">{ayudasPorCedula.length} personas</span>
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {ayudasPorCedula.map(([ced, item]) => (
              <div
                key={ced}
                className="p-2 bg-slate-50 rounded-lg flex items-center justify-between text-xs border border-slate-100"
              >
                <div className="overflow-hidden">
                  <p className="font-bold text-slate-800 truncate">{item.nombre}</p>
                  <p className="text-[10px] text-slate-500 font-mono">{ced}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold font-mono text-[11px]">
                    {item.cant} {item.cant === 1 ? 'ayuda' : 'ayudas'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SECTION 5: CONTROL DE CARGA DE INFORMES (QUIÉN CARGÓ Y QUIÉN NO) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-900">
              Control de Cumplimiento de Dependencias e Institutos
            </h3>
            <p className="text-xs sm:text-sm text-slate-500">
              Lista detallada de dependencias centralizadas y descentralizadas que han cargado informes y quién no.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => exportarPDFControlCumplimiento(informes)}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
              title="Descargar Reporte Oficial de Control de Cumplimiento en PDF"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>PDF Cumplimiento</span>
            </button>

            <button
              type="button"
              onClick={() => exportarExcelControlCumplimiento(informes)}
              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
              title="Descargar Reporte Oficial de Control de Cumplimiento en Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Excel Cumplimiento</span>
            </button>
          </div>
        </div>

        {/* Filters for compliance */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={complianceSearch}
              onChange={(e) => setComplianceSearch(e.target.value)}
              placeholder="Buscar dependencia o instituto..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setComplianceFilter('TODOS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                complianceFilter === 'TODOS'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Todas ({dependenciasCumplimiento.length})
            </button>
            <button
              onClick={() => setComplianceFilter('CARGO')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                complianceFilter === 'CARGO'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              Cargó ({totalCargaron})
            </button>
            <button
              onClick={() => setComplianceFilter('PENDIENTE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                complianceFilter === 'PENDIENTE'
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
              }`}
            >
              Pendiente ({totalPendientesCarga})
            </button>
          </div>
        </div>

        {/* Compliance Table / Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto pr-1">
          {filteredCompliance.map((dep) => (
            <div
              key={dep.id}
              className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 transition ${
                dep.cargoInformes
                  ? 'bg-emerald-50/50 border-emerald-200'
                  : 'bg-rose-50/40 border-rose-200'
              }`}
            >
              <div className="overflow-hidden">
                <div className="flex items-center gap-1.5 mb-1">
                  <span
                    className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                      dep.cargoInformes
                        ? 'bg-emerald-600 text-white'
                        : 'bg-rose-600 text-white'
                    }`}
                  >
                    {dep.cargoInformes ? 'CARGÓ INFORME' : 'PENDIENTE'}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {dep.tipo}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-slate-900 leading-snug">
                  {dep.nombre}
                </h4>
              </div>

              <div className="text-right shrink-0">
                {dep.cargoInformes ? (
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    {dep.cantidadInformes} {dep.cantidadInformes === 1 ? 'doc' : 'docs'}
                  </span>
                ) : (
                  <span className="text-[11px] font-bold text-rose-600">0 docs</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 4: TABLA DETALLADA DE SOLICITUDES CON ACCIONES (PROCESAR, EDITAR, PENDIENTE, RECHAZAR, REMITIDO A) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-900">
              Gestión y Procesamiento de Solicitudes
            </h3>
            <p className="text-xs sm:text-sm text-slate-500">
              Acciones directas para Procesar, Editar, dejar Pendiente, Rechazar o Remitir a Direcciones.
            </p>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={tableFilterEstado}
              onChange={(e) => setTableFilterEstado(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
            >
              <option value="TODOS">Todos los Estados</option>
              <option value="ATENDIDO">Atendidos</option>
              <option value="PENDIENTE">Pendientes</option>
              <option value="RECHAZADA">Rechazadas</option>
              <option value="REMITIDAS">Remitidas</option>
            </select>
          </div>
        </div>

        {/* Search inside table */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={tableSearch}
            onChange={(e) => setTableSearch(e.target.value)}
            placeholder="Filtrar solicitudes por nombre, cédula, tipo de ayuda o número..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
        </div>

        {/* Responsive Table / Cards */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-3">Ciudadano / Cédula</th>
                <th className="py-3 px-3">Tipo de Ayuda</th>
                <th className="py-3 px-3">Fecha</th>
                <th className="py-3 px-3">Estado Actual</th>
                <th className="py-3 px-3 text-right">Acciones de Despacho</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSolicitudes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                    No se encontraron solicitudes con los criterios de búsqueda.
                  </td>
                </tr>
              ) : (
                filteredSolicitudes.map((sol) => (
                  <tr key={sol.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-3">
                      <p className="font-bold text-slate-900 text-xs">{sol.nombresApellidos}</p>
                      <p className="text-[11px] text-slate-500 font-mono">{sol.cedula}</p>
                      <p className="text-[10px] text-emerald-700 font-mono">{sol.telefonoCompleto}</p>
                    </td>

                    <td className="py-3 px-3">
                      <span className="font-semibold text-slate-800">{sol.tipoSolicitud}</span>
                      <p className="text-[10px] text-slate-500 line-clamp-1 max-w-[200px]" title={sol.observaciones}>
                        {sol.observaciones || 'Sin observaciones'}
                      </p>
                    </td>

                    <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                      {sol.fechaSolicitud}
                    </td>

                    <td className="py-3 px-3">
                      {sol.estadoRemision === 'ATENDIDO' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <CheckCircle2 className="w-3 h-3" />
                          ATENDIDO
                        </span>
                      ) : sol.estadoRemision === 'RECHAZADA' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300">
                          <XCircle className="w-3 h-3" />
                          RECHAZADA
                        </span>
                      ) : sol.estadoRemision === 'PENDIENTE' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
                          <Clock className="w-3 h-3" />
                          PENDIENTE
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-sky-100 text-sky-800 border border-sky-300">
                          <ArrowRightCircle className="w-3 h-3" />
                          {sol.estadoRemision}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-right">
                      {/* ACTION BUTTONS: EXPORTAR PDF, PROCESAR, EDITAR, PENDIENTE, RECHAZAR, REMITIDO A, ELIMINAR */}
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {/* EXPORTAR PDF BENEFICIARIO */}
                        <button
                          onClick={() => exportarPDFSolicitudIndividual(sol)}
                          className="p-1 text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 rounded transition cursor-pointer"
                          title="Descargar Comprobante PDF de este beneficiario (con firmas y escudo)"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                        </button>

                        {/* PROCESAR (ATENDIDO) */}
                        <button
                          onClick={() => onUpdateSolicitudEstado(sol.id, 'ATENDIDO')}
                          className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold transition cursor-pointer"
                          title="Marcar como Atendido / Procesado"
                        >
                          Procesar
                        </button>

                        {/* EDITAR */}
                        <button
                          onClick={() => onEditSolicitud(sol)}
                          className="p-1 text-slate-600 hover:text-sky-700 bg-slate-100 hover:bg-sky-50 rounded transition cursor-pointer"
                          title="Editar Solicitud"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>

                        {/* PENDIENTE */}
                        <button
                          onClick={() => onUpdateSolicitudEstado(sol.id, 'PENDIENTE')}
                          className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-[10px] font-bold transition cursor-pointer"
                          title="Marcar como Pendiente"
                        >
                          Pendiente
                        </button>

                        {/* RECHAZAR */}
                        <button
                          onClick={() => onUpdateSolicitudEstado(sol.id, 'RECHAZADA')}
                          className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold transition cursor-pointer"
                          title="Marcar como Rechazada"
                        >
                          Rechazar
                        </button>

                        {/* REMITIDO A (BUTTON THAT OPENS MODAL WITH ALL DESTINATIONS) */}
                        <button
                          onClick={() => openRemitirModal(sol)}
                          className="px-2 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded text-[10px] font-bold transition cursor-pointer"
                          title="Remitir a Dependencia"
                        >
                          Remitir A...
                        </button>

                        {/* ELIMINAR SOLICITUD */}
                        {onDeleteSolicitud && (
                          <button
                            onClick={() => {
                              const nombre = sol.nombresApellidos || ((sol as any).nombres ? `${(sol as any).nombres || ''} ${(sol as any).apellidos || ''}`.trim() : '') || sol.id;
                              if (window.confirm(`¿Está seguro de que desea eliminar la solicitud ${sol.id} correspondiente a "${nombre}"? Esta acción se actualizará en todos los dispositivos conectados.`)) {
                                onDeleteSolicitud(sol.id);
                              }
                            }}
                            className="p-1 text-rose-600 hover:text-white hover:bg-rose-600 bg-rose-50 border border-rose-200 rounded transition cursor-pointer"
                            title="Eliminar esta Solicitud"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )}

      {/* MODAL: REMITIDO A (ADMINISTRACIÓN, DESPACHO, DESARROLLO SOCIAL, SERVICIOS PÚBLICOS, TALENTO HUMANO, OTRO ESPECIFIQUE) */}
      {remitirModalOpen && selectedSolicitudForRemit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Send className="w-4 h-4 text-sky-600" />
                <span>Remitir Solicitud a Dependencia</span>
              </h3>
              <button
                onClick={() => setRemitirModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-3 rounded-xl">
              <p><strong>Solicitante:</strong> {selectedSolicitudForRemit.nombresApellidos}</p>
              <p><strong>Cédula:</strong> {selectedSolicitudForRemit.cedula}</p>
              <p><strong>Tipo:</strong> {selectedSolicitudForRemit.tipoSolicitud}</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Seleccione Dependencia de Destino <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedRemitirDestino}
                onChange={(e) => setSelectedRemitirDestino(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-sky-950 focus:ring-2 focus:ring-sky-600"
              >
                <option value="ADMINISTRACIÓN">ADMINISTRACIÓN</option>
                <option value="DESPACHO">DESPACHO</option>
                <option value="DESARROLLO SOCIAL">DESARROLLO SOCIAL</option>
                <option value="SERVICIOS PÚBLICOS">SERVICIOS PÚBLICOS</option>
                <option value="TALENTO HUMANO">TALENTO HUMANO</option>
                <option value="OTRO">OTRO, ESPECIFIQUE</option>
              </select>
            </div>

            {selectedRemitirDestino === 'OTRO' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Especifique Dependencia u Organismo
                </label>
                <input
                  type="text"
                  required
                  value={otroRemitirTexto}
                  onChange={(e) => setOtroRemitirTexto(e.target.value)}
                  placeholder="Ej. Instituto Municipal de Deporte..."
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-sky-600"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRemitirModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmRemitir}
                className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-sm flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Confirmar Remisión</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
