import React, { useState, useEffect, useRef } from 'react';
import {
  AppUser,
  Solicitud,
  InformeDependencia,
  EstadoSolicitud,
  EstadoInforme,
  RegistroAsistencia,
  Funcionario,
  MetaPoa,
} from './types';
import {
  getStoredUser,
  saveStoredUser,
  touchUserSession,
  getStoredSolicitudes,
  saveStoredSolicitudes,
  getStoredInformes,
  saveStoredInformes,
  getStoredAsistencias,
  saveStoredAsistencias,
  getStoredFuncionarios,
  saveStoredFuncionarios,
  getStoredMetasPoa,
  saveStoredMetasPoa,
  saveSingleMetaPoa,
  saveStoredUserProfile,
  clearAllStoredData,
  resetToSeedData,
  initializePersistentDatabase,
  mergeCollectionsById,
  safeLocalStorageSet,
  cleanCacheAndForceSync,
  idbSaveAll,
  broadcastLiveSync,
  syncToServer,
  authFetch,
  KEY_SOLICITUDES,
  KEY_INFORMES,
  KEY_ASISTENCIAS,
  KEY_FUNCIONARIOS,
  KEY_METAS_POA,
} from './utils/storage';
import {
  initRealtimeSync,
  subscribeRealtimeData,
  subscribeSyncStatus,
  triggerInstantSync,
  SyncStatus,
  DatabaseSnapshot,
} from './utils/realtimeSync';
import { CheckCircle2, RefreshCw } from 'lucide-react';
import { Login } from './components/Login';
import { Navbar } from './components/Navbar';
import { SolicitudesForm } from './components/SolicitudesForm';
import { SolicitudesList } from './components/SolicitudesList';
import { InformesForm } from './components/InformesForm';
import { InformesList } from './components/InformesList';
import { ReportesEstadisticas, SubTabReportes } from './components/ReportesEstadisticas';
import { Busqueda } from './components/Busqueda';
import { AsistenciasForm } from './components/AsistenciasForm';
import { FuncionariosModal } from './components/FuncionariosModal';
import { UserProfileModal } from './components/UserProfileModal';
import { UserCredentialsModal } from './components/UserCredentialsModal';
import { PlanificacionPoaForm } from './components/PlanificacionPoaForm';
import { DirectorioFuncionariosView } from './components/DirectorioFuncionariosView';
import { INITIAL_FUNCIONARIOS } from './data/dependenciasData';

export default function App() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => getStoredUser());
  const isPrimaryUser =
    currentUser?.role === 'PRIMARY_ADMIN' ||
    currentUser?.email === 'dg.municipiotianquillo@gmail.com' ||
    currentUser?.email === 'dg.municipiotinaquillo@gmail.com' ||
    currentUser?.email === 'sistemasdegestion26@gmail.com';
  const isSecondaryUser =
    currentUser?.role === 'SECONDARY_USER' ||
    currentUser?.email === 'proyectociudad2@gmail.com';
  const isPlanificacionUser =
    currentUser?.role === 'PLANIFICACION_USER' ||
    currentUser?.email === 'organizacionplanificacion34@gmail.com';
  const isProtocoloUser =
    currentUser?.role === 'PROTOCOLO_USER' ||
    currentUser?.email?.toLowerCase() === 'protocolo1' ||
    currentUser?.email?.toLowerCase() === 'protocolo1@gmail.com';

  const [currentTab, setCurrentTab] = useState<string>(() => {
    const user = getStoredUser();
    if (user?.role === 'PLANIFICACION_USER' || user?.email === 'organizacionplanificacion34@gmail.com') {
      return 'poa_form';
    }
    if (user?.role === 'SECONDARY_USER' || user?.email === 'proyectociudad2@gmail.com') {
      return 'informes_form';
    }
    if (user?.role === 'PROTOCOLO_USER' || user?.email?.toLowerCase() === 'protocolo1' || user?.email?.toLowerCase() === 'protocolo1@gmail.com') {
      return 'asistencias';
    }
    if (
      user?.role === 'PRIMARY_ADMIN' ||
      user?.email === 'dg.municipiotianquillo@gmail.com' ||
      user?.email === 'dg.municipiotinaquillo@gmail.com' ||
      user?.email === 'sistemasdegestion26@gmail.com'
    ) {
      return 'reportes';
    }
    return 'solicitudes_form';
  });
  const [reportesSubTab, setReportesSubTab] = useState<SubTabReportes>('estadisticas');

  const [solicitudes, setSolicitudes] = useState<Solicitud[]>(() => getStoredSolicitudes());
  const [informes, setInformes] = useState<InformeDependencia[]>(() => getStoredInformes());
  const [asistencias, setAsistencias] = useState<RegistroAsistencia[]>(() => getStoredAsistencias());
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>(() => getStoredFuncionarios());
  const [metasPoa, setMetasPoa] = useState<MetaPoa[]>(() => getStoredMetasPoa());
  const [dbStatus, setDbStatus] = useState<'connecting' | 'connected'>('connecting');
  const isHydratedRef = useRef(false);

  // Hydrate from Persistent Database (Server disk + IndexedDB) on boot
  useEffect(() => {
    let isMounted = true;
    initializePersistentDatabase().then((dbData) => {
      if (!isMounted) return;
      if (dbData) {
        setSolicitudes(dbData.solicitudes);
        setInformes(dbData.informes);
        setAsistencias(dbData.asistencias);
        setFuncionarios(dbData.funcionarios);
        if (dbData.metasPoa) setMetasPoa(dbData.metasPoa);
      }
      isHydratedRef.current = true;
      setDbStatus('connected');
    });

    const handleFuncsSync = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) {
        setFuncionarios(e.detail);
      } else {
        setFuncionarios(getStoredFuncionarios());
      }
    };

    const handlePoaSync = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) {
        setMetasPoa(e.detail);
      } else {
        setMetasPoa(getStoredMetasPoa());
      }
    };

    window.addEventListener('tinaquillo_funcionarios_sync', handleFuncsSync);
    window.addEventListener('tinaquillo_metas_poa_sync', handlePoaSync);
    return () => {
      isMounted = false;
      window.removeEventListener('tinaquillo_funcionarios_sync', handleFuncsSync);
      window.removeEventListener('tinaquillo_metas_poa_sync', handlePoaSync);
    };
  }, []);

  // Editing state
  const [editingSolicitud, setEditingSolicitud] = useState<Solicitud | null>(null);
  const [editingInforme, setEditingInforme] = useState<InformeDependencia | null>(null);

  // Administrative Modals
  const [funcionariosModalOpen, setFuncionariosModalOpen] = useState(false);
  const [userProfileModalOpen, setUserProfileModalOpen] = useState(false);
  const [credentialsModalOpen, setCredentialsModalOpen] = useState(false);

  // Security: Automatic session expiration after inactivity
  useEffect(() => {
    if (!currentUser) return;

    const handleUserActivity = () => {
      touchUserSession();
    };

    window.addEventListener('mousedown', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);

    // Check expiration every 30 seconds
    const interval = setInterval(() => {
      const validUser = getStoredUser();
      if (!validUser) {
        setCurrentUser(null);
      }
    }, 30000);

    return () => {
      window.removeEventListener('mousedown', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      clearInterval(interval);
    };
  }, [currentUser]);

  // Login handler with persistent database hydration
  const handleLoginSuccess = async (user: AppUser) => {
    setCurrentUser(user);
    await saveStoredUser(user);

    // Refresh and ensure all persistent data is rehydrated from server persistent database
    try {
      const dbData = await initializePersistentDatabase();
      if (dbData) {
        setSolicitudes(dbData.solicitudes);
        setInformes(dbData.informes);
        setAsistencias(dbData.asistencias);
        setFuncionarios(dbData.funcionarios);
        if (dbData.metasPoa) setMetasPoa(dbData.metasPoa);
      }
      await triggerInstantSync();
    } catch (e) {
      console.error('[App] Error rehidratando datos tras login:', e);
    }

    if (user.role === 'PLANIFICACION_USER' || user.email === 'organizacionplanificacion34@gmail.com') {
      setCurrentTab('poa_form');
    } else if (user.role === 'SECONDARY_USER' || user.email === 'proyectociudad2@gmail.com') {
      setCurrentTab('informes_form');
    } else if (user.role === 'PROTOCOLO_USER' || user.email?.toLowerCase() === 'protocolo1' || user.email?.toLowerCase() === 'protocolo1@gmail.com') {
      setCurrentTab('asistencias');
    } else if (
      user.role === 'PRIMARY_ADMIN' ||
      user.email === 'dg.municipiotianquillo@gmail.com' ||
      user.email === 'dg.municipiotinaquillo@gmail.com' ||
      user.email === 'sistemasdegestion26@gmail.com'
    ) {
      setCurrentTab('reportes');
      setReportesSubTab('estadisticas');
    } else {
      setCurrentTab('solicitudes_form');
    }
  };

  // Logout handler
  const handleLogout = () => {
    setCurrentUser(null);
    saveStoredUser(null);
  };

  // Cache cleaning & forced live synchronization state
  const [isCleaningCache, setIsCleaningCache] = useState(false);
  const [cacheCleanToast, setCacheCleanToast] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('connecting');

  // Forced cache purge & fresh sync handler - Exclusivo Usuario Principal
  const handleCleanCacheAndSync = async () => {
    if (isSecondaryUser || isPlanificacionUser) {
      console.warn('[Seguridad] Este usuario no tiene permisos para limpiar caché.');
      return;
    }
    setIsCleaningCache(true);
    try {
      const fresh = await cleanCacheAndForceSync();
      setSolicitudes(fresh.solicitudes);
      setInformes(fresh.informes);
      setAsistencias(fresh.asistencias);
      setFuncionarios(fresh.funcionarios);
      if (fresh.metasPoa) setMetasPoa(fresh.metasPoa);
      await triggerInstantSync();
      setCacheCleanToast('Caché limpiada y datos sincronizados en tiempo real en todos los dispositivos');
      setTimeout(() => setCacheCleanToast(null), 4000);
    } catch (err) {
      console.error('Error al limpiar caché y sincronizar:', err);
    } finally {
      setIsCleaningCache(false);
    }
  };

  // Cross-device and multi-user automatic synchronization in real-time (PC <-> Android)
  // Powered by WebSockets with adaptive background fallback polling
  useEffect(() => {
    initRealtimeSync();

    const unsubscribeStatus = subscribeSyncStatus((status) => {
      setSyncStatus(status);
    });

    const unsubscribeData = subscribeRealtimeData((data: DatabaseSnapshot) => {
      if (Array.isArray(data.solicitudes)) {
        setSolicitudes((prev) => {
          const prevStr = JSON.stringify(prev);
          const serverStr = JSON.stringify(data.solicitudes);
          return prevStr !== serverStr ? data.solicitudes! : prev;
        });
      }
      if (Array.isArray(data.informes)) {
        setInformes((prev) => {
          const prevStr = JSON.stringify(prev);
          const serverStr = JSON.stringify(data.informes);
          return prevStr !== serverStr ? data.informes! : prev;
        });
      }
      if (Array.isArray(data.asistencias)) {
        setAsistencias((prev) => {
          const prevStr = JSON.stringify(prev);
          const serverStr = JSON.stringify(data.asistencias);
          return prevStr !== serverStr ? data.asistencias! : prev;
        });
      }
      if (Array.isArray(data.funcionarios)) {
        const cleanIncoming = data.funcionarios.filter(
          (f: any) => f && f.nombresApellidos && f.nombresApellidos !== 'VFCVG KCD'
        );
        setFuncionarios((prev) => {
          const prevStr = JSON.stringify(prev);
          const serverStr = JSON.stringify(cleanIncoming);
          return prevStr !== serverStr ? cleanIncoming : prev;
        });
      }
      if (Array.isArray(data.metasPoa)) {
        setMetasPoa((prev) => {
          const prevStr = JSON.stringify(prev);
          const serverStr = JSON.stringify(data.metasPoa);
          return prevStr !== serverStr ? data.metasPoa! : prev;
        });
      }
    });

    return () => {
      unsubscribeStatus();
      unsubscribeData();
    };
  }, []);

  // Solicitudes CRUD - Strictly guarded for primary user
  const handleSaveSolicitud = async (solicitud: Solicitud) => {
    if (isSecondaryUser) return;
    const wasEditing = Boolean(editingSolicitud);
    let updatedList: Solicitud[] = [];
    setSolicitudes((prev) => {
      const exists = prev.some((s) => s.id === solicitud.id);
      updatedList = exists
        ? prev.map((s) => (s.id === solicitud.id ? solicitud : s))
        : [solicitud, ...prev];
      return updatedList;
    });
    setEditingSolicitud(null);
    if (wasEditing) {
      setReportesSubTab('solicitudes');
      setCurrentTab('reportes');
    }
    const current = getStoredSolicitudes();
    const exists = current.some((s) => s.id === solicitud.id);
    const next = exists
      ? current.map((s) => (s.id === solicitud.id ? solicitud : s))
      : [solicitud, ...current];
    await saveStoredSolicitudes(next, false);
    await syncToServer('/api/solicitudes', solicitud).catch(() => {});
    broadcastLiveSync();
  };

  const handleEditSolicitud = (solicitud: Solicitud) => {
    if (isSecondaryUser) return;
    setEditingSolicitud(solicitud);
    setCurrentTab('solicitudes_form');
  };

  const handleDeleteSolicitud = async (id: string) => {
    if (isSecondaryUser) return;
    setSolicitudes((prev) => prev.filter((s) => s.id !== id));
    const next = getStoredSolicitudes().filter((s) => s.id !== id);
    await saveStoredSolicitudes(next, true);
    await authFetch(`/api/solicitudes/${id}`, { method: 'DELETE' }).catch(() => {});
    broadcastLiveSync();
  };

  const handleUpdateSolicitudEstado = async (
    id: string,
    nuevoEstado: EstadoSolicitud,
    otroEspecifique?: string
  ) => {
    if (isSecondaryUser) return;
    setSolicitudes((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
              ...s,
              estadoRemision: nuevoEstado,
              otroRemitirEspecifique: otroEspecifique || s.otroRemitirEspecifique,
            }
          : s
      )
    );
    const next = getStoredSolicitudes().map((s) =>
      s.id === id
        ? {
            ...s,
            estadoRemision: nuevoEstado,
            otroRemitirEspecifique: otroEspecifique || s.otroRemitirEspecifique,
          }
        : s
    );
    await saveStoredSolicitudes(next, true);
    broadcastLiveSync();
  };

  // Informes CRUD
  const handleSaveInforme = async (informe: InformeDependencia) => {
    const wasEditing = Boolean(editingInforme);
    setInformes((prev) => {
      const exists = prev.some((i) => i.id === informe.id);
      return exists
        ? prev.map((i) => (i.id === informe.id ? informe : i))
        : [informe, ...prev];
    });
    setEditingInforme(null);
    if (isSecondaryUser) {
      setCurrentTab('informes_form');
    } else if (wasEditing) {
      setReportesSubTab('informes');
      setCurrentTab('reportes');
    } else {
      setCurrentTab('informes_list');
    }
    const current = getStoredInformes();
    const exists = current.some((i) => i.id === informe.id);
    const next = exists
      ? current.map((i) => (i.id === informe.id ? informe : i))
      : [informe, ...current];
    await saveStoredInformes(next, false);
    await syncToServer('/api/informes', informe).catch(() => {});
    broadcastLiveSync();
  };

  const handleEditInforme = (informe: InformeDependencia) => {
    setEditingInforme(informe);
    setCurrentTab('informes_form');
  };

  const handleDeleteInforme = async (id: string) => {
    setInformes((prev) => prev.filter((i) => i.id !== id));
    const next = getStoredInformes().filter((i) => i.id !== id);
    await saveStoredInformes(next, true);
    await authFetch(`/api/informes/${id}`, { method: 'DELETE' }).catch(() => {});
    broadcastLiveSync();
  };

  const handleUpdateInformeEstado = async (
    id: string,
    nuevoEstado: EstadoInforme,
    detalles?: { remitidoA?: string; motivo?: string; observacion?: string }
  ) => {
    if (isSecondaryUser) {
      console.warn('[Seguridad] El usuario secundario no tiene permisos para procesar o remitir informes.');
      return;
    }
    let updatedTarget: InformeDependencia | null = null;
    setInformes((prev) =>
      prev.map((inf) => {
        if (inf.id === id) {
          const item: InformeDependencia = {
            ...inf,
            estado: nuevoEstado,
            remitidoA: nuevoEstado === 'REMITIDO' ? (detalles?.remitidoA || inf.remitidoA) : inf.remitidoA,
            fechaRemision: nuevoEstado === 'REMITIDO' ? new Date().toISOString() : inf.fechaRemision,
            motivoRemision: detalles?.motivo || inf.motivoRemision,
            observacionProceso: detalles?.observacion || inf.observacionProceso,
            fechaProcesado: nuevoEstado === 'PROCESADO' ? new Date().toISOString() : inf.fechaProcesado,
            historialEstados: [
              ...(inf.historialEstados || []),
              {
                fecha: new Date().toISOString(),
                usuario: currentUser?.email || 'Usuario',
                estadoAnterior: inf.estado || 'PENDIENTE',
                nuevoEstado,
                nota: detalles?.observacion || detalles?.motivo || '',
              },
            ],
          };
          updatedTarget = item;
          return item;
        }
        return inf;
      })
    );
    const next = getStoredInformes().map((inf) => (inf.id === id && updatedTarget ? updatedTarget : inf));
    await saveStoredInformes(next, true);
    if (updatedTarget) {
      await syncToServer('/api/informes', updatedTarget).catch(() => {});
    }
    broadcastLiveSync();
  };

  // Asistencias CRUD - Strictly guarded for primary user
  const handleSaveAsistencia = async (asistencia: RegistroAsistencia) => {
    if (isSecondaryUser) return;
    setAsistencias((prev) => {
      const exists = prev.some((a) => a.id === asistencia.id);
      return exists
        ? prev.map((a) => (a.id === asistencia.id ? asistencia : a))
        : [asistencia, ...prev];
    });
    const current = getStoredAsistencias();
    const exists = current.some((a) => a.id === asistencia.id);
    const next = exists
      ? current.map((a) => (a.id === asistencia.id ? asistencia : a))
      : [asistencia, ...current];
    await saveStoredAsistencias(next, false);
    await syncToServer('/api/asistencias', asistencia).catch(() => {});
    broadcastLiveSync();
  };

  const handleDeleteAsistencia = async (id: string) => {
    if (isSecondaryUser) return;
    setAsistencias((prev) => prev.filter((a) => a.id !== id));
    const next = getStoredAsistencias().filter((a) => a.id !== id);
    await saveStoredAsistencias(next, true);
    await authFetch(`/api/asistencias/${id}`, { method: 'DELETE' }).catch(() => {});
    broadcastLiveSync();
  };

  // Reset database to completely clean state
  const handleResetData = async () => {
    if (isSecondaryUser || isPlanificacionUser || isProtocoloUser) return;
    if (confirm('¿Desea vaciar todos los registros operativos para iniciar una nueva carga de datos en blanco? El directorio oficial se mantendrá intacto.')) {
      await clearAllStoredData();
      setSolicitudes([]);
      setInformes([]);
      setAsistencias([]);
      setMetasPoa([]);
      setFuncionarios(INITIAL_FUNCIONARIOS);
      await triggerInstantSync();
    }
  };

  const handleClearAllData = async () => {
    if (isSecondaryUser || isPlanificacionUser || isProtocoloUser) return;
    await clearAllStoredData();
    setSolicitudes([]);
    setInformes([]);
    setAsistencias([]);
    setMetasPoa([]);
    setFuncionarios(INITIAL_FUNCIONARIOS);
    await triggerInstantSync();
  };

  // Metas POA CRUD
  const handleSaveMetaPoa = async (meta: MetaPoa) => {
    const result = await saveSingleMetaPoa(meta);
    setMetasPoa(result.list);
    await triggerInstantSync();
  };

  const handleDeleteMetaPoa = async (id: string) => {
    const updated = metasPoa.filter((m) => m.id !== id);
    setMetasPoa(updated);
    await saveStoredMetasPoa(updated, true);
    await authFetch(`/api/metas_poa/${id}`, { method: 'DELETE' }).catch(() => {});
    await triggerInstantSync();
  };

  // Funcionarios CRUD
  const handleDeleteFuncionario = async (id: string) => {
    try {
      const updated = funcionarios.filter((f) => f.id !== id);
      setFuncionarios(updated);
      await saveStoredFuncionarios(updated, true);
      await authFetch(`/api/funcionarios/${id}`, { method: 'DELETE' }).catch(() => {});
      await triggerInstantSync();
    } catch (e) {
      console.error('Error eliminando funcionario:', e);
    }
  };

  // Update user profile with persistent storage (Requirement 15)
  const handleSaveUserProfile = (updatedUser: AppUser) => {
    setCurrentUser(updatedUser);
    saveStoredUser(updatedUser);
    saveStoredUserProfile(updatedUser);
  };

  // If not logged in, show Login screen
  if (!currentUser) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen relative flex flex-col bg-slate-100 text-slate-900 font-sans pb-16 md:pb-0">
      {/* Background Graphic Ambient Layer - Soft Institutional Watermark, Zero Glare */}
      <div
        className="fixed inset-0 pointer-events-none z-0 opacity-5"
        style={{
          backgroundImage: `url('/fondo.svg')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />

      {/* Official Header Navbar */}
      <Navbar
        currentUser={currentUser}
        currentTab={currentTab}
        onSelectTab={(tab) => {
          if (tab === 'solicitudes_form') setEditingSolicitud(null);
          if (tab === 'informes_form') setEditingInforme(null);
          setCurrentTab(tab);
        }}
        onLogout={handleLogout}
        onOpenFuncionariosModal={isPrimaryUser ? () => setFuncionariosModalOpen(true) : undefined}
        onOpenUserProfileModal={isPrimaryUser ? () => setUserProfileModalOpen(true) : undefined}
        onOpenCredentialsModal={isPrimaryUser ? () => setCredentialsModalOpen(true) : undefined}
        onCleanCacheAndSync={isPrimaryUser ? handleCleanCacheAndSync : undefined}
        isCleaningCache={isCleaningCache}
        solicitudesCount={solicitudes.length}
        informesCount={informes.length}
        funcionariosCount={funcionarios.length}
        syncStatus={syncStatus}
      />

      {/* Cache purge & synchronization notification banner */}
      {cacheCleanToast && (
        <div className="fixed top-20 right-4 z-50 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-slate-700 flex items-center gap-2.5 text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{cacheCleanToast}</span>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 py-4 sm:py-6">
        {isPlanificacionUser ? (
          <PlanificacionPoaForm
            currentUser={currentUser}
            metasPoa={metasPoa}
            onSaveMetaPoa={handleSaveMetaPoa}
            onDeleteMetaPoa={handleDeleteMetaPoa}
            funcionarios={funcionarios}
          />
        ) : isSecondaryUser ? (
          <InformesForm
            currentUser={currentUser}
            funcionarios={funcionarios}
            onOpenFuncionariosModal={undefined}
            onSaveInforme={handleSaveInforme}
            onCancel={() => {
              setEditingInforme(null);
              setCurrentTab('informes_form');
            }}
            initialData={editingInforme}
          />
        ) : isProtocoloUser ? (
          <AsistenciasForm
            currentUser={currentUser}
            asistencias={asistencias}
            onSaveAsistencia={handleSaveAsistencia}
            onDeleteAsistencia={handleDeleteAsistencia}
          />
        ) : currentTab === 'funcionarios_list' ? (
          <DirectorioFuncionariosView
            currentUser={currentUser}
            funcionarios={funcionarios}
            onOpenFuncionariosModal={() => setFuncionariosModalOpen(true)}
            onEditFuncionario={() => setFuncionariosModalOpen(true)}
            onDeleteFuncionario={handleDeleteFuncionario}
            onRefresh={async () => {
              const fresh = await initializePersistentDatabase();
              if (fresh && fresh.funcionarios) setFuncionarios(fresh.funcionarios);
            }}
          />
        ) : (
          <>
            {currentTab === 'poa_form' && (
              <PlanificacionPoaForm
                currentUser={currentUser}
                metasPoa={metasPoa}
                onSaveMetaPoa={handleSaveMetaPoa}
                onDeleteMetaPoa={handleDeleteMetaPoa}
                funcionarios={funcionarios}
              />
            )}

            {currentTab === 'solicitudes_form' && (
              <SolicitudesForm
                currentUser={currentUser}
                onSaveSolicitud={handleSaveSolicitud}
                onCancel={
                  editingSolicitud
                    ? () => {
                        setEditingSolicitud(null);
                        setReportesSubTab('solicitudes');
                        setCurrentTab('reportes');
                      }
                    : undefined
                }
                initialData={editingSolicitud}
              />
            )}

            {currentTab === 'solicitudes_list' && (
              <SolicitudesList
                solicitudes={solicitudes}
                onNewSolicitud={() => {
                  setEditingSolicitud(null);
                  setCurrentTab('solicitudes_form');
                }}
                onEditSolicitud={handleEditSolicitud}
                onDeleteSolicitud={handleDeleteSolicitud}
              />
            )}

            {currentTab === 'informes_form' && (
              <InformesForm
                currentUser={currentUser}
                funcionarios={funcionarios}
                onOpenFuncionariosModal={() => setFuncionariosModalOpen(true)}
                onSaveInforme={handleSaveInforme}
                onCancel={
                  editingInforme
                    ? () => {
                        setEditingInforme(null);
                        setReportesSubTab('informes');
                        setCurrentTab('reportes');
                      }
                    : undefined
                }
                initialData={editingInforme}
                onViewList={() => setCurrentTab('informes_list')}
                informesCount={informes.length}
              />
            )}

            {currentTab === 'informes_list' && (
              <InformesList
                informes={informes}
                currentUser={currentUser}
                onNewInforme={() => {
                  setEditingInforme(null);
                  setCurrentTab('informes_form');
                }}
                onEditInforme={handleEditInforme}
                onDeleteInforme={handleDeleteInforme}
                onUpdateInformeEstado={handleUpdateInformeEstado}
              />
            )}

            {currentTab === 'asistencias' && (
              <AsistenciasForm
                currentUser={currentUser}
                asistencias={asistencias}
                onSaveAsistencia={handleSaveAsistencia}
                onDeleteAsistencia={handleDeleteAsistencia}
              />
            )}

            {currentTab === 'busqueda' && (
              <Busqueda
                currentUser={currentUser}
                solicitudes={solicitudes}
                informes={informes}
                onSelectSolicitud={handleEditSolicitud}
              />
            )}

            {currentTab === 'reportes' && (
              <ReportesEstadisticas
                currentUser={currentUser}
                solicitudes={solicitudes}
                informes={informes}
                asistencias={asistencias}
                funcionarios={funcionarios}
                metasPoa={metasPoa}
                onNewPoa={() => setCurrentTab('poa_form')}
                onUpdateSolicitudEstado={handleUpdateSolicitudEstado}
                onEditSolicitud={handleEditSolicitud}
                onDeleteSolicitud={handleDeleteSolicitud}
                onNewSolicitud={() => {
                  setEditingSolicitud(null);
                  setCurrentTab('solicitudes_form');
                }}
                onNewInforme={() => {
                  setEditingInforme(null);
                  setCurrentTab('informes_form');
                }}
                onNewAsistencia={() => {
                  setCurrentTab('asistencias');
                }}
                onEditInforme={handleEditInforme}
                onDeleteInforme={handleDeleteInforme}
                onUpdateInformeEstado={handleUpdateInformeEstado}
                activeSubTab={reportesSubTab}
                onSelectSubTab={setReportesSubTab}
                onOpenFuncionariosModal={() => setFuncionariosModalOpen(true)}
                onClearAllData={handleClearAllData}
                onCleanCacheAndSync={handleCleanCacheAndSync}
                isCleaningCache={isCleaningCache}
                syncStatus={syncStatus}
              />
            )}
          </>
        )}
      </main>

      {/* Municipal Footer */}
      <footer className="relative z-10 bg-white/90 backdrop-blur border-t border-slate-200 py-4 px-4 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <img
              src="/logo-oficial.png"
              alt="Logo Dirección General Tinaquillo"
              className="w-7 h-7 rounded-full object-contain bg-white/95 p-0.5 border border-slate-300 shadow-xs"
            />
            <span className="font-semibold text-slate-800">
              Dirección General • Alcaldía del Municipio Autónomo Tinaquillo
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 text-[11px]">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span>Base de Datos Persistente Activa</span>
            </div>
            <span>Estado Cojedes, Venezuela</span>
          </div>
        </div>
      </footer>

      {/* Administrative Modals for Authenticated Users (Solo Usuario Principal) */}
      {currentUser && isPrimaryUser && (
        <>
          <FuncionariosModal
            isOpen={funcionariosModalOpen}
            onClose={() => setFuncionariosModalOpen(false)}
            onUpdated={() => {
              setFuncionarios(getStoredFuncionarios());
            }}
          />
          <UserProfileModal
            isOpen={userProfileModalOpen}
            onClose={() => setUserProfileModalOpen(false)}
            currentUser={currentUser}
            onSaveUser={handleSaveUserProfile}
          />
          <UserCredentialsModal
            isOpen={credentialsModalOpen}
            onClose={() => setCredentialsModalOpen(false)}
            currentUser={currentUser}
          />
        </>
      )}
    </div>
  );
}

