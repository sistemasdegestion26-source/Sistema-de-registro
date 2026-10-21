import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  ClipboardList,
  BarChart3,
  Search,
  LogOut,
  Menu,
  X,
  Building2,
  Users,
  UserCheck,
  FileCheck2,
  RefreshCw,
  ChevronDown,
  Check,
  Target,
  KeyRound,
} from 'lucide-react';
import { AppUser } from '../types';
import { SyncStatus, triggerInstantSync } from '../utils/realtimeSync';

interface NavbarProps {
  currentUser: AppUser;
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onLogout: () => void;
  onOpenFuncionariosModal?: () => void;
  onOpenUserProfileModal?: () => void;
  onOpenCredentialsModal?: () => void;
  onCleanCacheAndSync?: () => void;
  isCleaningCache?: boolean;
  solicitudesCount?: number;
  informesCount?: number;
  funcionariosCount?: number;
  syncStatus?: SyncStatus;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  currentTab,
  onSelectTab,
  onLogout,
  onOpenFuncionariosModal,
  onOpenUserProfileModal,
  onOpenCredentialsModal,
  onCleanCacheAndSync,
  isCleaningCache = false,
  solicitudesCount,
  informesCount,
  funcionariosCount,
  syncStatus = 'connected',
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleManualSync = async () => {
    setIsSyncingNow(true);
    try {
      await triggerInstantSync();
    } catch (_) {
    } finally {
      setTimeout(() => setIsSyncingNow(false), 500);
    }
  };

  // Close dropdown on click outside or escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Status configuration for real-time WebSocket and polling fallback
  const getStatusConfig = () => {
    if (isCleaningCache || isSyncingNow) {
      return {
        label: 'Sincronizando...',
        shortLabel: 'Sync...',
        pingColor: 'bg-sky-400',
        dotColor: 'bg-sky-600',
        textColor: 'text-sky-800',
        title: 'Actualizando base de datos central en tiempo real...',
      };
    }
    switch (syncStatus) {
      case 'connected':
        return {
          label: 'En Vivo (Multi-dispositivo)',
          shortLabel: 'En Vivo',
          pingColor: 'bg-emerald-400',
          dotColor: 'bg-emerald-600',
          textColor: 'text-emerald-800',
          title: 'Sincronización multi-dispositivo activa en tiempo real: los registros cargados desde PC o teléfonos se actualizan de inmediato. Clic para forzar actualización.',
        };
      case 'polling':
        return {
          label: 'Sincronizado (Multi-dispositivo)',
          shortLabel: 'Sincronizado',
          pingColor: 'bg-teal-400',
          dotColor: 'bg-teal-600',
          textColor: 'text-teal-800',
          title: 'Conectado a la base de datos central en modo sincronización continua. Clic para sincronizar ahora.',
        };
      case 'connecting':
        return {
          label: 'Conectando...',
          shortLabel: 'Conectando',
          pingColor: 'bg-amber-400',
          dotColor: 'bg-amber-600',
          textColor: 'text-amber-800',
          title: 'Estableciendo enlace de datos en tiempo real...',
        };
      case 'offline':
      default:
        return {
          label: 'Modo Local',
          shortLabel: 'Local',
          pingColor: 'hidden',
          dotColor: 'bg-rose-500',
          textColor: 'text-rose-800',
          title: 'Sin conexión a internet. Los datos se guardan de forma segura en este dispositivo.',
        };
    }
  };

  const statusCfg = getStatusConfig();

  const isPrimaryUser =
    currentUser.role === 'PRIMARY_ADMIN' ||
    currentUser.email === 'dg.municipiotianquillo@gmail.com' ||
    currentUser.email === 'dg.municipiotinaquillo@gmail.com' ||
    currentUser.email === 'sistemasdegestion26@gmail.com';
  const isSecondaryUser =
    currentUser.role === 'SECONDARY_USER' ||
    currentUser.email === 'proyectociudad2@gmail.com';
  const isPlanificacionUser =
    currentUser.role === 'PLANIFICACION_USER' ||
    currentUser.email === 'organizacionplanificacion34@gmail.com';
  const isProtocoloUser =
    currentUser.role === 'PROTOCOLO_USER' ||
    currentUser.email.toLowerCase() === 'protocolo1' ||
    currentUser.email.toLowerCase() === 'protocolo1@gmail.com';

  const navItems = [
    {
      id: 'asistencias',
      label: 'Registro de Actividades',
      description: 'Convocatorias y asistencia oficial',
      icon: Users,
      group: 'gestion',
      allowed: isPrimaryUser || isProtocoloUser,
    },
    {
      id: 'poa_form',
      label: 'Objetivos y Metas POA',
      description: 'Control de metas y % de ejecución POA',
      icon: Target,
      group: 'planificacion',
      allowed: isPrimaryUser || isPlanificacionUser,
    },
    {
      id: 'solicitudes_form',
      label: 'Registrar Solicitud',
      description: 'Cargar nueva solicitud comunitaria',
      icon: ClipboardList,
      group: 'solicitudes',
      allowed: isPrimaryUser,
    },
    {
      id: 'solicitudes_list',
      label: solicitudesCount !== undefined ? `Ver Solicitudes (${solicitudesCount})` : 'Ver Solicitudes',
      description: 'Listado, procesamiento y filtros',
      icon: FileText,
      badge: solicitudesCount !== undefined ? `${solicitudesCount}` : undefined,
      group: 'solicitudes',
      allowed: isPrimaryUser,
    },
    {
      id: 'informes_form',
      label: 'Registrar Informes',
      description: 'Comunicación interna de directorio, trimestrales y auditorías',
      icon: Building2,
      group: 'informes',
      allowed: isPrimaryUser || isSecondaryUser,
    },
    {
      id: 'informes_list',
      label: informesCount !== undefined ? `Informes Registrados (${informesCount})` : 'Informes Registrados',
      description: 'Historial y control de expedientes',
      icon: FileCheck2,
      badge: informesCount !== undefined ? `${informesCount}` : undefined,
      group: 'informes',
      allowed: isPrimaryUser || isSecondaryUser,
    },
    {
      id: 'busqueda',
      label: 'Búsqueda Centralizada',
      description: 'Búsqueda por cédula, dependencia o fecha',
      icon: Search,
      group: 'gestion',
      allowed: isPrimaryUser,
    },
    {
      id: 'funcionarios_list',
      label: funcionariosCount !== undefined ? `Directorio Funcionarios (${funcionariosCount})` : 'Directorio Funcionarios',
      description: 'Nómina oficial de directores y presidentes',
      icon: UserCheck,
      badge: funcionariosCount !== undefined ? `${funcionariosCount}` : undefined,
      group: 'gestion',
      allowed: isPrimaryUser,
    },
    {
      id: 'reportes',
      label: 'Reportes y Métricas',
      description: 'Control de gestión, cumplimiento y estadísticas',
      icon: BarChart3,
      badge: 'DG',
      group: 'gestion',
      allowed: isPrimaryUser,
    },
  ];

  const handleSelectTab = (tabId: string) => {
    onSelectTab(tabId);
    setMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-white shadow-xs select-none">
      {/* Institutional Tricolor / Gold Accent Line */}
      <div className="h-1 w-full bg-gradient-to-r from-amber-500 via-sky-700 to-amber-600 shrink-0" />

      {/* ======================================================== */}
      {/* MEMBRETE INSTITUCIONAL (PARTE SUPERIOR)                  */}
      {/* ======================================================== */}
      <div className="border-b border-slate-200/80 bg-white">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16 gap-3">
            
            {/* Escudo y Jerarquía Institucional (Membrete Oficial) */}
            <div
              className="flex items-center gap-2.5 sm:gap-3 cursor-pointer group shrink-0"
              onClick={() => handleSelectTab(isPlanificacionUser ? 'poa_form' : isSecondaryUser ? 'informes_form' : isProtocoloUser ? 'asistencias' : 'solicitudes_form')}
              title="Alcaldía del Municipio Autónomo Tinaquillo - Dirección General"
            >
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full border-2 border-amber-500/40 bg-white p-0.5 flex items-center justify-center shrink-0 shadow-xs group-hover:border-amber-600 transition">
                <img
                  src="/logo-oficial.png"
                  alt="Escudo Oficial Tinaquillo"
                  className="w-full h-full object-contain rounded-full"
                />
              </div>
              <div className="flex flex-col justify-center">
                <span className="text-[7.5px] sm:text-[9px] font-black text-amber-800 tracking-wider uppercase leading-none">
                  República Bolivariana de Venezuela • Estado Cojedes
                </span>
                <h1 className="text-xs sm:text-sm lg:text-base font-black tracking-tight text-slate-950 leading-tight mt-0.5 group-hover:text-slate-800 transition">
                  ALCALDÍA DEL MUNICIPIO AUTÓNOMO TINAQUILLO
                </h1>
                <span className="text-[8.5px] sm:text-[10px] font-bold text-slate-500 tracking-wide leading-none uppercase">
                  Dirección General de Gestión y Despacho
                </span>
              </div>
            </div>

            {/* Estado de Sincronización y Sesión en el Membrete */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {/* Live Synchronization Status Pill & Manual Sync Button */}
              <button
                type="button"
                onClick={handleManualSync}
                disabled={isCleaningCache || isSyncingNow}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 hover:bg-slate-100 active:scale-95 border border-slate-200 text-xs text-slate-700 shadow-2xs transition cursor-pointer"
                title={statusCfg.title}
              >
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${statusCfg.pingColor} opacity-75`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${statusCfg.dotColor}`}></span>
                </span>
                <span className={`text-[10.5px] font-bold ${statusCfg.textColor}`}>
                  {statusCfg.label}
                </span>
                <RefreshCw
                  className={`w-3 h-3 text-slate-400 shrink-0 ${isSyncingNow ? 'animate-spin text-sky-600' : ''}`}
                />
              </button>

              {/* User Session Badge */}
              <div
                className="flex items-center gap-2 pl-2 py-0.5 border-l border-slate-200"
                title={`Sesión activa: ${currentUser.email}`}
              >
                <div className="w-8 h-8 rounded-full bg-slate-900 text-amber-400 font-black text-xs flex items-center justify-center shadow-xs border border-slate-800 shrink-0">
                  {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="hidden md:flex flex-col">
                  <span className="text-xs font-bold text-slate-900 leading-tight">
                    {isPrimaryUser ? 'Dirección General' : isPlanificacionUser ? 'Planificación y Organización' : isProtocoloUser ? 'Dirección de Protocolo' : isSecondaryUser ? 'Directores y Presidentes' : currentUser.name}
                  </span>
                  <span className="text-[10px] text-slate-500 font-semibold leading-tight truncate max-w-[130px]">
                    {currentUser.email}
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* BARRA JUSTO DEBAJO DEL MEMBRETE: MENÚ Y MÓDULO ACTIVO   */}
      {/* ======================================================== */}
      <div className="bg-slate-100/90 border-b border-slate-200/90 py-1.5 sm:py-2 backdrop-blur-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center">

            {/* UNIFIED SINGLE MENU BUTTON (JUSTO DEBAJO DEL MEMBRETE) */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen(!menuOpen)}
                className={`flex items-center gap-2 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer shadow-xs border ${
                  menuOpen
                    ? 'bg-slate-950 text-white border-slate-900 ring-2 ring-amber-500/50 shadow-md'
                    : 'bg-slate-900 text-white hover:bg-slate-800 border-slate-800 hover:border-slate-700'
                }`}
                aria-expanded={menuOpen}
                aria-haspopup="true"
                title="Abrir menú de módulos y opciones"
              >
                <Menu className="w-4 h-4 text-amber-400 shrink-0" strokeWidth={2.4} />
                <span className="tracking-wide">Menú</span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-300 transition-transform duration-200 shrink-0 ${
                    menuOpen ? 'rotate-180 text-amber-400' : ''
                  }`}
                  strokeWidth={2.2}
                />
              </button>

              {/* MENÚ DESPLEGABLE CON TODOS LOS BOTONES AGRUPADOS */}
              {menuOpen && (
                <div className="absolute left-0 mt-2 w-[calc(100vw-1.5rem)] sm:w-96 max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200/90 z-50 overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150">
                  
                  {/* Header del Desplegable: Perfil de Usuario */}
                  <div className="p-3.5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between border-b border-slate-700/80">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-slate-800 border border-amber-500/50 text-amber-400 font-black text-sm flex items-center justify-center shrink-0 shadow-xs">
                        {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">
                          {isPrimaryUser ? 'Dirección General' : isPlanificacionUser ? 'Planificación y Organización' : isSecondaryUser ? 'Registrador Oficial' : currentUser.name}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {currentUser.email}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMenuOpen(false)}
                      className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                      title="Cerrar menú"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Contenido scrolleable del menú */}
                  <div className="max-h-[75vh] overflow-y-auto p-3 space-y-3 divide-y divide-slate-100">

                    {/* SECCIÓN PLANIFICACIÓN POA */}
                    {navItems.some((item) => item.allowed && item.group === 'planificacion') && (
                      <div className="pt-1 first:pt-0">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-2 mb-1">
                          Control y Planificación POA
                        </p>
                        <div className="space-y-0.5">
                          {navItems
                            .filter((item) => item.allowed && item.group === 'planificacion')
                            .map((item) => {
                              const Icon = item.icon;
                              const isActive = currentTab === item.id;
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => handleSelectTab(item.id)}
                                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left transition cursor-pointer group ${
                                    isActive
                                      ? 'bg-slate-900 text-white shadow-xs'
                                      : 'hover:bg-slate-50 text-slate-800'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div
                                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition ${
                                        isActive
                                          ? 'bg-slate-800 text-amber-400'
                                          : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                                      }`}
                                    >
                                      <Icon className="w-3.5 h-3.5" strokeWidth={2.2} />
                                    </div>
                                    <p className="text-xs font-bold leading-tight truncate">{item.label}</p>
                                  </div>
                                  {isActive && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0 ml-2" />}
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    )}

                    {/* SECCIÓN 1: SOLICITUDES DE AYUDA SOCIAL */}
                    {navItems.some((item) => item.allowed && item.group === 'solicitudes') && (
                      <div className="pt-2 first:pt-0">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-2 mb-1">
                          Gestión de Solicitudes
                        </p>
                        <div className="space-y-0.5">
                          {navItems
                            .filter((item) => item.allowed && item.group === 'solicitudes')
                            .map((item) => {
                              const Icon = item.icon;
                              const isActive = currentTab === item.id;
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => handleSelectTab(item.id)}
                                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left transition cursor-pointer group ${
                                    isActive
                                      ? 'bg-slate-900 text-white shadow-xs'
                                      : 'hover:bg-slate-50 text-slate-800'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div
                                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition ${
                                        isActive
                                          ? 'bg-slate-800 text-amber-400'
                                          : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                                      }`}
                                    >
                                      <Icon className="w-3.5 h-3.5" strokeWidth={2.2} />
                                    </div>
                                    <p className="text-xs font-bold leading-tight truncate">{item.label}</p>
                                  </div>
                                  {isActive ? (
                                    <Check className="w-3.5 h-3.5 text-amber-400 shrink-0 ml-2" />
                                  ) : item.badge ? (
                                    <span className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-slate-100 text-slate-700 shrink-0 ml-2">
                                      {item.badge}
                                    </span>
                                  ) : null}
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    )}

                    {/* SECCIÓN 2: INFORMES DE DEPENDENCIAS */}
                    {navItems.some((item) => item.allowed && item.group === 'informes') && (
                    <div className="pt-2 first:pt-0">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-2 mb-1">
                        Informes de Dependencias
                      </p>
                      <div className="space-y-0.5">
                        {navItems
                          .filter((item) => item.allowed && item.group === 'informes')
                          .map((item) => {
                            const Icon = item.icon;
                            const isActive = currentTab === item.id;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => handleSelectTab(item.id)}
                                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left transition cursor-pointer group ${
                                  isActive
                                    ? 'bg-slate-900 text-white shadow-xs'
                                    : 'hover:bg-slate-50 text-slate-800'
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div
                                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition ${
                                      isActive
                                        ? 'bg-slate-800 text-amber-400'
                                        : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                                    }`}
                                  >
                                    <Icon className="w-3.5 h-3.5" strokeWidth={2.2} />
                                  </div>
                                  <p className="text-xs font-bold leading-tight truncate">{item.label}</p>
                                </div>
                                {isActive ? (
                                  <Check className="w-3.5 h-3.5 text-amber-400 shrink-0 ml-2" />
                                ) : item.badge ? (
                                  <span className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-slate-100 text-slate-700 shrink-0 ml-2">
                                    {item.badge}
                                  </span>
                                ) : null}
                              </button>
                            );
                          })}
                      </div>
                    </div>
                    )}

                    {/* SECCIÓN 3: CONTROL DE GESTIÓN Y REPORTES */}
                    {navItems.some((item) => item.allowed && item.group === 'gestion') && (
                      <div className="pt-2">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-2 mb-1">
                          Control de Gestión & Reportes
                        </p>
                        <div className="space-y-0.5">
                          {navItems
                            .filter((item) => item.allowed && item.group === 'gestion')
                            .map((item) => {
                              const Icon = item.icon;
                              const isActive = currentTab === item.id;
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => handleSelectTab(item.id)}
                                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left transition cursor-pointer group ${
                                    isActive
                                      ? 'bg-slate-900 text-white shadow-xs'
                                      : 'hover:bg-slate-50 text-slate-800'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div
                                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition ${
                                        isActive
                                          ? 'bg-slate-800 text-amber-400'
                                          : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                                      }`}
                                    >
                                      <Icon className="w-3.5 h-3.5" strokeWidth={2.2} />
                                    </div>
                                    <p className="text-xs font-bold leading-tight truncate">{item.label}</p>
                                  </div>
                                  {isActive ? (
                                    <Check className="w-3.5 h-3.5 text-amber-400 shrink-0 ml-2" />
                                  ) : item.badge ? (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded font-black tracking-wider uppercase bg-amber-100 text-amber-900 border border-amber-300 shrink-0 ml-2">
                                      {item.badge}
                                    </span>
                                  ) : null}
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    )}

                    {/* SECCIÓN 4: HERRAMIENTAS ADMINISTRATIVAS (USUARIO PRINCIPAL) */}
                    {isPrimaryUser && (
                      <div className="pt-2">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-2 mb-1">
                          Herramientas Administrativas
                        </p>
                        <div className="space-y-0.5">
                          {onOpenFuncionariosModal && (
                            <button
                              type="button"
                              onClick={() => {
                                setMenuOpen(false);
                                onOpenFuncionariosModal();
                              }}
                              className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left hover:bg-amber-50/70 text-slate-800 transition cursor-pointer group"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 group-hover:bg-amber-200 transition">
                                  <UserCheck className="w-3.5 h-3.5" strokeWidth={2.2} />
                                </div>
                                <p className="text-xs font-bold leading-tight text-slate-900 truncate">
                                  Directorio de Funcionarios
                                </p>
                              </div>
                              <span className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-amber-100 text-amber-900 border border-amber-200 shrink-0">
                                Directores
                              </span>
                            </button>
                          )}

                          {onOpenCredentialsModal && (
                            <button
                              type="button"
                              onClick={() => {
                                setMenuOpen(false);
                                onOpenCredentialsModal();
                              }}
                              className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left hover:bg-violet-50 text-slate-800 transition cursor-pointer group"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-7 h-7 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center shrink-0 group-hover:bg-violet-200 transition">
                                  <KeyRound className="w-3.5 h-3.5" strokeWidth={2.2} />
                                </div>
                                <p className="text-xs font-bold leading-tight text-slate-900 truncate">
                                  Credenciales y Contraseñas
                                </p>
                              </div>
                              <span className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-violet-100 text-violet-900 border border-violet-200 shrink-0">
                                Claves
                              </span>
                            </button>
                          )}

                          {onCleanCacheAndSync && (
                            <button
                              type="button"
                              onClick={() => {
                                setMenuOpen(false);
                                onCleanCacheAndSync();
                              }}
                              disabled={isCleaningCache}
                              className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left hover:bg-sky-50 text-slate-800 transition cursor-pointer group disabled:opacity-60"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-7 h-7 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0 group-hover:bg-sky-200 transition">
                                  <RefreshCw className={`w-3.5 h-3.5 ${isCleaningCache ? 'animate-spin' : ''}`} />
                                </div>
                                <p className="text-xs font-bold leading-tight text-slate-900 truncate">
                                  Limpiar Caché y Sincronizar
                                </p>
                              </div>
                              <span className="text-[9px] px-2 py-0.5 rounded font-black uppercase bg-sky-100 text-sky-800 border border-sky-200 shrink-0">
                                En Vivo
                              </span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* SECCIÓN 5: CERRAR SESIÓN */}
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          onLogout();
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left hover:bg-rose-50 text-rose-800 transition cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 group-hover:bg-rose-200 transition">
                            <LogOut className="w-3.5 h-3.5" strokeWidth={2.2} />
                          </div>
                          <p className="text-xs font-bold leading-tight text-rose-900 truncate">
                            Cerrar Sesión Institucional
                          </p>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-rose-100 text-rose-700 shrink-0">
                          Salir
                        </span>
                      </button>
                    </div>

                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </header>
  );
};
