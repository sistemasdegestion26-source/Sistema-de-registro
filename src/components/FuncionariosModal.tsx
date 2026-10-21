import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  UserCheck,
  Plus,
  Trash2,
  Edit2,
  Save,
  Search,
  Building2,
  Calendar,
  FileCheck2,
  CheckCircle2,
  AlertCircle,
  Users,
  Eraser,
  RotateCcw,
  AlertTriangle,
  Loader2,
  Send,
  ArrowRight,
  Check,
} from 'lucide-react';
import { Funcionario, ClasificacionDependencia, EstadoFuncionario } from '../types';
import {
  DEPENDENCIAS_MUNICIPALES,
  CLASIFICACIONES_DEPENDENCIA,
} from '../data/dependenciasData';
import {
  getStoredFuncionarios,
  saveStoredFuncionarios,
  normalizeString,
  syncToServer,
  broadcastLiveSync,
} from '../utils/storage';

interface FuncionariosModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

export const FuncionariosModal: React.FC<FuncionariosModalProps> = ({
  isOpen,
  onClose,
  onUpdated,
}) => {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>(() =>
    getStoredFuncionarios()
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFuncionarioId, setSelectedFuncionarioId] = useState<string | null>(null);

  // Form Fields
  const [nombresApellidos, setNombresApellidos] = useState('');
  const [cedulaPrefijo, setCedulaPrefijo] = useState('V-');
  const [cedulaNumero, setCedulaNumero] = useState('');
  const [clasificacion, setClasificacion] = useState<ClasificacionDependencia>('CENTRALIZADA');
  const [dependenciaNombre, setDependenciaNombre] = useState(
    DEPENDENCIAS_MUNICIPALES.filter((d) => d.tipo === 'CENTRALIZADA')[0]?.nombre || ''
  );
  const [cargo, setCargo] = useState('DIRECTOR(A)');
  const [numeroResolucion, setNumeroResolucion] = useState('');
  const [fechaResolucion, setFechaResolucion] = useState('');
  const [telefono, setTelefono] = useState('');

  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<{ id: string; nombre: string } | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [recentlySavedId, setRecentlySavedId] = useState<string | null>(null);

  // Sync latest data when modal opens
  useEffect(() => {
    if (isOpen) {
      setFuncionarios(getStoredFuncionarios());
      fetch('/api/database')
        .then((res) => res.json())
        .then((data) => {
          if (data && Array.isArray(data.funcionarios)) {
            setFuncionarios(data.funcionarios);
          }
        })
        .catch(() => {});
      setSelectedFuncionarioId(null);
      setNombresApellidos('');
      setCedulaNumero('');
      setNumeroResolucion('');
      setFechaResolucion('');
      setTelefono('');
      setFeedbackMsg(null);
    }
  }, [isOpen]);

  // Dependencias filtered by current classification
  const dependenciasPorTipo = useMemo(() => {
    return DEPENDENCIAS_MUNICIPALES.filter((d) => d.tipo === clasificacion);
  }, [clasificacion]);

  const activeDep = useMemo(() => {
    if (!dependenciaNombre) return undefined;
    const norm = dependenciaNombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
    const found = DEPENDENCIAS_MUNICIPALES.find((d) => {
      const dNorm = d.nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
      return dNorm === norm;
    });
    if (found) {
      if (norm.includes('DESPACHO')) {
        return {
          ...found,
          cargos: [
            'DIRECTOR(A) EJECUTIVO (A) DE DESPACHO',
            'JEFE (A) DE DESPACHO',
            'JEFE (A) DE PRENSA Y COMUNICACIÓN',
            'JEFE (A) DE ARCHIVO DEL DESPACHO',
            'JEFE (A) DE RELACIONES PÚBLICAS Y PROTOCOLO',
          ],
        };
      }
      if (found.tipo === 'EMPRESA' || found.tipo === 'INSTITUTO') {
        return {
          ...found,
          cargos: ['PRESIDENTE (A)', 'ADMINISTRADOR', 'OTRO, ESPECIFIQUE'],
        };
      }
      return found;
    }
    if (clasificacion === 'EMPRESA' || clasificacion === 'INSTITUTO') {
      return {
        id: 'fallback-ente',
        nombre: dependenciaNombre,
        tipo: clasificacion,
        tieneCargos: true,
        cargos: ['PRESIDENTE (A)', 'ADMINISTRADOR', 'OTRO, ESPECIFIQUE'],
      };
    }
    return undefined;
  }, [dependenciaNombre, clasificacion]);

  // When classification changes, auto-select first matching dependency
  const handleClasificacionChange = (nuevaClasificacion: ClasificacionDependencia) => {
    setClasificacion(nuevaClasificacion);
    const lista = DEPENDENCIAS_MUNICIPALES.filter((d) => d.tipo === nuevaClasificacion);
    if (lista.length > 0) {
      setDependenciaNombre(lista[0].nombre);
      const defaultCargo = nuevaClasificacion === 'CENTRALIZADA' ? 'DIRECTOR(A)' : 'PRESIDENTE (A)';
      setCargo(lista[0].cargos?.[0] || defaultCargo);
    }
  };

  // When dependency changes, suggest default cargo
  const handleDependenciaChange = (nombre: string) => {
    setDependenciaNombre(nombre);
    const norm = nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
    const dep = DEPENDENCIAS_MUNICIPALES.find((d) => {
      const dNorm = d.nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
      return dNorm === norm;
    });
    if (norm.includes('DESPACHO')) {
      setCargo('DIRECTOR(A) EJECUTIVO (A) DE DESPACHO');
    } else if (dep?.cargos && dep.cargos.length > 0) {
      setCargo(dep.cargos[0]);
    } else {
      setCargo(clasificacion === 'CENTRALIZADA' ? 'DIRECTOR(A)' : 'PRESIDENTE (A)');
    }
  };

  // Load existing funcionario into form for editing
  const handleEdit = (func: Funcionario) => {
    setSelectedFuncionarioId(func.id);
    setNombresApellidos(func.nombresApellidos);
    
    // Parse cedula
    if (func.cedula.startsWith('E-')) {
      setCedulaPrefijo('E-');
      setCedulaNumero(func.cedula.replace(/^E-/, ''));
    } else if (func.cedula.startsWith('J-')) {
      setCedulaPrefijo('J-');
      setCedulaNumero(func.cedula.replace(/^J-/, ''));
    } else {
      setCedulaPrefijo('V-');
      setCedulaNumero(func.cedula.replace(/^[VEJ]-/, ''));
    }

    const dep = DEPENDENCIAS_MUNICIPALES.find((d) => d.nombre === func.dependencia);
    const tipo = func.clasificacion || dep?.tipo || 'CENTRALIZADA';
    setClasificacion(tipo);
    setDependenciaNombre(func.dependencia);
    setCargo(func.cargo || 'DIRECTOR(A)');
    setNumeroResolucion(func.numeroResolucion || '');
    setFechaResolucion(func.fechaResolucion || '');
    setTelefono(func.telefono || '');
    setFeedbackMsg(null);
  };

  // Reset form to add new
  const handleResetForm = () => {
    setSelectedFuncionarioId(null);
    setNombresApellidos('');
    setCedulaNumero('');
    setNumeroResolucion('');
    setFechaResolucion('');
    setTelefono('');
    setFeedbackMsg(null);
  };

  // Save or update funcionario
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackMsg(null);

    if (!nombresApellidos.trim()) {
      setFeedbackMsg({ type: 'error', text: 'El nombre y apellido son obligatorios.' });
      return;
    }
    if (!cedulaNumero.trim()) {
      setFeedbackMsg({ type: 'error', text: 'El número de cédula es obligatorio.' });
      return;
    }
    if (!dependenciaNombre.trim()) {
      setFeedbackMsg({ type: 'error', text: 'Debe seleccionar una dependencia, empresa o instituto.' });
      return;
    }
    if (!cargo.trim()) {
      setFeedbackMsg({ type: 'error', text: 'Debe indicar el cargo del funcionario.' });
      return;
    }

    setIsSaving(true);

    const formattedCedula = `${cedulaPrefijo}${cedulaNumero.trim()}`;
    const cleanCargo = cargo.trim().toUpperCase();
    const cleanDep = dependenciaNombre.trim();

    const newOrUpdated: Funcionario = {
      id: selectedFuncionarioId || `FUNC-${Date.now().toString().slice(-6)}`,
      nombresApellidos: nombresApellidos.trim().toUpperCase(),
      cedula: formattedCedula,
      dependencia: cleanDep,
      clasificacion,
      cargo: cleanCargo,
      numeroResolucion: numeroResolucion.trim().toUpperCase(),
      fechaResolucion,
      telefono: telefono.trim(),
      actualizadoEn: new Date().toISOString(),
    };

    let updatedList: Funcionario[];
    if (selectedFuncionarioId) {
      updatedList = funcionarios.map((f) =>
        f.id === selectedFuncionarioId ? newOrUpdated : f
      );
    } else {
      // 1. Check if same person exists by Cédula
      const existingByCedulaIdx = funcionarios.findIndex((f) => f.cedula?.trim() === formattedCedula);
      if (existingByCedulaIdx >= 0) {
        const existingId = funcionarios[existingByCedulaIdx].id;
        updatedList = [...funcionarios];
        updatedList[existingByCedulaIdx] = { ...newOrUpdated, id: existingId };
        newOrUpdated.id = existingId;
      } else {
        // 2. Check if matching titular in same dependency & same cargo
        const depNorm = normalizeString(cleanDep);
        const cargoNorm = normalizeString(cleanCargo);
        const existingByCargoIdx = funcionarios.findIndex(
          (f) => normalizeString(f.dependencia) === depNorm && normalizeString(f.cargo || '') === cargoNorm
        );
        if (existingByCargoIdx >= 0) {
          const existingId = funcionarios[existingByCargoIdx].id;
          updatedList = [...funcionarios];
          updatedList[existingByCargoIdx] = { ...newOrUpdated, id: existingId };
          newOrUpdated.id = existingId;
        } else {
          // New official registration added to top
          updatedList = [newOrUpdated, ...funcionarios];
        }
      }
    }

    setFuncionarios(updatedList);

    // Save across all durability tiers (LocalStorage, IndexedDB, Server Disk)
    await saveStoredFuncionarios(updatedList);
    await syncToServer('/api/funcionarios', newOrUpdated);

    if (onUpdated) onUpdated();

    setIsSaving(false);
    setRecentlySavedId(newOrUpdated.id);

    setFeedbackMsg({
      type: 'success',
      text: selectedFuncionarioId
        ? `¡Datos actualizados con éxito! Funcionario "${newOrUpdated.nombresApellidos}" (${newOrUpdated.cargo} - ${newOrUpdated.dependencia}) guardado en la base de datos municipal.`
        : `¡Guardado exitoso! Los datos de "${newOrUpdated.nombresApellidos}" (${newOrUpdated.cargo} - ${newOrUpdated.dependencia}) han sido registrados y asegurados en la base de datos municipal.`,
    });

    // Requirement: Automatically clear input fields after saving so new data can be filled cleanly
    setSelectedFuncionarioId(null);
    setNombresApellidos('');
    setCedulaNumero('');
    setNumeroResolucion('');
    setFechaResolucion('');
    setTelefono('');

    // Scroll directory list to the newly saved funcionario
    setTimeout(() => {
      const el = document.getElementById(`func-card-${newOrUpdated.id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 150);

    setTimeout(() => {
      setRecentlySavedId(null);
    }, 10000);
  };

  // Borrar casillas del formulario para registrar nuevo o limpiar
  const handleClearFormInputs = (silent = false) => {
    setSelectedFuncionarioId(null);
    setNombresApellidos('');
    setCedulaNumero('');
    setNumeroResolucion('');
    setFechaResolucion('');
    setTelefono('');
    if (!silent) {
      setFeedbackMsg({
        type: 'success',
        text: 'Datos cargados en las casillas borrados exitosamente. Puede escribir nuevos datos.',
      });
    }
  };

  // Solicitar confirmación para eliminar funcionario sin window.confirm (compatible con iframe)
  const promptDelete = (id: string) => {
    const target = funcionarios.find((f) => f.id === id);
    const nombre = target ? target.nombresApellidos : 'este funcionario';
    setConfirmDeleteTarget({ id, nombre });
  };

  // Ejecutar eliminación confirmada del funcionario
  const executeDelete = async (id: string, nombre: string) => {
    const updatedList = funcionarios.filter((f) => f.id !== id);
    setFuncionarios(updatedList);
    await saveStoredFuncionarios(updatedList, true);
    await fetch(`/api/funcionarios/${id}`, { method: 'DELETE' }).catch(() => {});
    broadcastLiveSync();
    if (onUpdated) onUpdated();
    if (selectedFuncionarioId === id) {
      handleClearFormInputs(true);
    }
    setFeedbackMsg({
      type: 'success',
      text: `Datos de "${nombre}" eliminados correctamente del registro y servidor.`,
    });
  };

  // Ejecutar vaciado de todo el directorio
  const executeClearAll = async () => {
    setFuncionarios([]);
    await saveStoredFuncionarios([], true);
    await fetch('/api/funcionarios', { method: 'DELETE' }).catch(() => {});
    broadcastLiveSync();
    if (onUpdated) onUpdated();
    handleClearFormInputs(true);
    setFeedbackMsg({
      type: 'success',
      text: 'Todos los datos de funcionarios han sido borrados del registro.',
    });
  };

  // Filtered funcionarios for list
  const filteredFuncionarios = useMemo(() => {
    const qNorm = normalizeString(searchTerm);
    if (!qNorm) return funcionarios;
    return funcionarios.filter(
      (f) =>
        normalizeString(f.nombresApellidos).includes(qNorm) ||
        normalizeString(f.cedula).includes(qNorm) ||
        normalizeString(f.dependencia).includes(qNorm) ||
        normalizeString(f.cargo || '').includes(qNorm) ||
        (f.numeroResolucion && normalizeString(f.numeroResolucion).includes(qNorm))
    );
  }, [funcionarios, searchTerm]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-slate-800 text-white px-5 py-4 flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-700 flex items-center justify-center text-amber-300">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold tracking-tight">
                Registro y Directorio de Funcionarios
              </h3>
              <p className="text-xs text-slate-300">
                Directores y Presidentes de Empresas e Institutos Municipales (Automatización SISC)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-y-auto flex-1">
          {/* Left / Form Section (5 cols) */}
          <div className="lg:col-span-6 p-5 sm:p-6 border-b lg:border-b-0 lg:border-r border-slate-200 bg-slate-50/50 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-black tracking-wider text-slate-700 uppercase flex items-center gap-1.5">
                {selectedFuncionarioId ? (
                  <>
                    <Edit2 className="w-4 h-4 text-amber-600" />
                    <span>Modificar Datos Cargados</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 text-emerald-600" />
                    <span>Registrar Nuevo Funcionario</span>
                  </>
                )}
              </h4>
              <div className="flex items-center gap-2">
                {selectedFuncionarioId && (
                  <button
                    type="button"
                    onClick={() => handleClearFormInputs()}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800 underline cursor-pointer"
                  >
                    Nuevo registro
                  </button>
                )}
              </div>
            </div>

            {/* Banner de datos cargados para edición */}
            {selectedFuncionarioId && (
              <div className="p-3 bg-amber-50/90 border border-amber-300/80 rounded-xl flex flex-wrap items-center justify-between gap-2 shadow-2xs">
                <div className="flex items-center gap-2 min-w-0">
                  <UserCheck className="w-4 h-4 text-amber-700 shrink-0" />
                  <div className="text-xs text-amber-900 truncate">
                    <span className="font-bold">Datos cargados:</span> {nombresApellidos || 'Funcionario'} ({cedulaPrefijo}{cedulaNumero || 'S/C'})
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => promptDelete(selectedFuncionarioId)}
                    className="px-2.5 py-1 text-[11px] font-bold text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition cursor-pointer flex items-center gap-1"
                    title="Borrar permanentemente este funcionario del registro"
                  >
                    <Trash2 className="w-3 h-3 text-rose-600" />
                    <span>Eliminar registro</span>
                  </button>
                </div>
              </div>
            )}

            {feedbackMsg && (
              <div
                className={`p-3.5 rounded-xl text-xs flex items-start gap-2.5 transition-all ${
                  feedbackMsg.type === 'success'
                    ? 'bg-emerald-50 border-2 border-emerald-300 text-emerald-950 shadow-xs'
                    : 'bg-rose-50 border border-rose-200 text-rose-800'
                }`}
              >
                {feedbackMsg.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <div className="font-bold">{feedbackMsg.type === 'success' ? 'Guardado exitoso' : 'Atención'}</div>
                  <div className="mt-0.5 leading-relaxed">{feedbackMsg.text}</div>
                </div>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-3.5">
              {/* Nombres y Apellidos */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Nombre y Apellido <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={nombresApellidos}
                    onChange={(e) => setNombresApellidos(e.target.value)}
                    placeholder="Ej. Abg. María Gabriela Colmenares"
                    className="w-full pl-3 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-700 transition"
                  />
                  {nombresApellidos && (
                    <button
                      type="button"
                      onClick={() => setNombresApellidos('')}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                      title="Borrar este campo"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Cédula */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Cédula de Identidad <span className="text-rose-500">*</span>
                </label>
                <div className="flex gap-2">
                  <select
                    value={cedulaPrefijo}
                    onChange={(e) => setCedulaPrefijo(e.target.value)}
                    className="w-20 px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-700"
                  >
                    <option value="V-">V-</option>
                    <option value="E-">E-</option>
                    <option value="J-">J-</option>
                  </select>
                  <div className="relative flex-1">
                    <input
                      type="text"
                      required
                      value={cedulaNumero}
                      onChange={(e) => setCedulaNumero(e.target.value.replace(/[^0-9.]/g, ''))}
                      placeholder="12.345.678"
                      className="w-full pl-3 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-700"
                    />
                    {cedulaNumero && (
                      <button
                        type="button"
                        onClick={() => setCedulaNumero('')}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                        title="Borrar este campo"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Clasificación: Centralizada, Empresa, Instituto */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Tipo de Entidad <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {CLASIFICACIONES_DEPENDENCIA.map((clas) => (
                    <button
                      key={clas.id}
                      type="button"
                      onClick={() => handleClasificacionChange(clas.id as ClasificacionDependencia)}
                      className={`px-2 py-1.5 rounded-lg text-xs font-bold transition border text-center cursor-pointer ${
                        clasificacion === clas.id
                          ? 'bg-slate-800 text-white border-slate-800 shadow-2xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {clas.id === 'CENTRALIZADA' ? 'Dependencia' : clas.id === 'EMPRESA' ? 'Empresa' : 'Instituto'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dependencia / Empresa / Instituto dropdown */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1 flex items-center justify-between">
                  <span>Dependencia, Empresa o Instituto <span className="text-rose-500">*</span></span>
                  <span className="text-[10px] text-slate-500 font-normal">
                    {dependenciasPorTipo.length} disponibles
                  </span>
                </label>
                <select
                  value={dependenciaNombre}
                  onChange={(e) => handleDependenciaChange(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-700"
                >
                  {dependenciasPorTipo.map((dep) => (
                    <option key={dep.id} value={dep.nombre}>
                      {dep.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {/* Cargo */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Cargo Oficial <span className="text-rose-500">*</span>
                </label>
                {activeDep?.cargos && activeDep.cargos.length > 0 ? (
                  <div className="space-y-1.5">
                    <select
                      value={
                        activeDep.cargos.includes(cargo)
                          ? cargo
                          : cargo
                          ? 'OTRO, ESPECIFIQUE'
                          : ''
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'OTRO, ESPECIFIQUE' || val === 'OTRO') {
                          setCargo('');
                        } else {
                          setCargo(val);
                        }
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-700"
                    >
                      <option value="">-- Seleccione el Cargo --</option>
                      {activeDep.cargos.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                      {!activeDep.cargos.includes('OTRO, ESPECIFIQUE') &&
                        !activeDep.cargos.includes('OTRO') && (
                          <option value="OTRO, ESPECIFIQUE">OTRO, ESPECIFIQUE</option>
                        )}
                    </select>
                    {(!activeDep.cargos.filter((c) => c !== 'OTRO, ESPECIFIQUE' && c !== 'OTRO').includes(cargo)) && (
                      <div className="relative">
                        <input
                          type="text"
                          required
                          value={cargo === 'OTRO, ESPECIFIQUE' ? '' : cargo}
                          onChange={(e) => setCargo(e.target.value)}
                          placeholder="Especifique el cargo correspondiente"
                          className="w-full pl-3 pr-8 py-2 bg-white border border-amber-300 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={cargo}
                      onChange={(e) => setCargo(e.target.value)}
                      placeholder="Ej. DIRECTOR(A), PRESIDENTE(A)..."
                      className="w-full pl-3 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-700"
                    />
                    {cargo && (
                      <button
                        type="button"
                        onClick={() => setCargo('')}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                        title="Borrar este campo"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Número de Resolución y Fecha de Emisión */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Número de Resolución
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={numeroResolucion}
                      onChange={(e) => setNumeroResolucion(e.target.value)}
                      placeholder="Ej. RES-DG-2026-001"
                      className="w-full pl-3 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-700"
                    />
                    {numeroResolucion && (
                      <button
                        type="button"
                        onClick={() => setNumeroResolucion('')}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                        title="Borrar este campo"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Fecha de Emisión
                  </label>
                  <input
                    type="date"
                    value={fechaResolucion}
                    onChange={(e) => setFechaResolucion(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-700"
                  />
                </div>
              </div>

              {/* Teléfono opcional */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Teléfono de Contacto (Opcional)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="Ej. 0414-1234567"
                    className="w-full pl-3 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-700"
                  />
                  {telefono && (
                    <button
                      type="button"
                      onClick={() => setTelefono('')}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                      title="Borrar este campo"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="pt-2 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-600 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                        <span>Guardando en BD...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 text-emerald-400" />
                        <span>{selectedFuncionarioId ? 'Guardar Cambios' : 'Cargar / Guardar Funcionario'}</span>
                      </>
                    )}
                  </button>

                  {/* Botón Borrar Datos Cargados */}
                  <button
                    type="button"
                    onClick={() => handleClearFormInputs()}
                    disabled={!nombresApellidos && !cedulaNumero && !numeroResolucion && !fechaResolucion && !telefono && !selectedFuncionarioId}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-white hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
                    title="Borrar todos los datos cargados en el formulario"
                  >
                    <Eraser className="w-4 h-4 text-rose-600" />
                    <span>Borrar Datos Cargados</span>
                  </button>

                  {/* Botón Eliminar Registro existente */}
                  {selectedFuncionarioId && (
                    <button
                      type="button"
                      onClick={() => promptDelete(selectedFuncionarioId)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition cursor-pointer"
                      title="Borrar permanentemente este funcionario del registro"
                    >
                      <Trash2 className="w-4 h-4 text-rose-600" />
                      <span>Eliminar del Registro</span>
                    </button>
                  )}
                </div>

                {selectedFuncionarioId && (
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                    <span>Modificando registro seleccionado</span>
                    <button
                      type="button"
                      onClick={() => handleClearFormInputs(true)}
                      className="text-slate-700 hover:text-slate-900 underline font-semibold cursor-pointer"
                    >
                      Cancelar edición
                    </button>
                  </div>
                )}
              </div>
            </form>
          </div>

          {/* Right / List Section (6 cols) */}
          <div className="lg:col-span-6 p-5 sm:p-6 bg-white flex flex-col space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-xs font-black tracking-wider text-slate-800 uppercase">
                    Directorio Registrado ({funcionarios.length})
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Al seleccionar una dependencia en el formulario de informes, estos datos se cargarán automáticamente.
                  </p>
                </div>
                {funcionarios.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setConfirmClearAll(true)}
                    className="px-2.5 py-1 text-[11px] font-bold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition cursor-pointer shrink-0"
                    title="Borrar todos los registros para cargar nuevos funcionarios"
                  >
                    Vaciar Directorio
                  </button>
                )}
              </div>
            </div>

            {/* Search filter */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nombre, dependencia o cédula..."
                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-700 focus:bg-white"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="Limpiar búsqueda"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[420px]">
              {filteredFuncionarios.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <Building2 className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-700">
                    {searchTerm ? 'No se encontraron funcionarios con el criterio de búsqueda.' : 'Directorio limpio sin datos de prueba.'}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {!searchTerm && 'Utilice el formulario de la izquierda para registrar los funcionarios oficiales de cada dependencia.'}
                  </p>
                </div>
              ) : (
                filteredFuncionarios.map((func) => {
                  const isSelected = selectedFuncionarioId === func.id;
                  const isRecentlySaved = recentlySavedId === func.id;
                  return (
                    <div
                      key={func.id}
                      id={`func-card-${func.id}`}
                      className={`p-3 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                        isSelected
                          ? 'border-amber-400 bg-amber-50/60 shadow-xs'
                          : isRecentlySaved
                          ? 'border-emerald-500 bg-emerald-50/80 ring-2 ring-emerald-400/40 shadow-xs'
                          : 'border-slate-200 bg-slate-50/40 hover:bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {func.nombresApellidos}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-mono font-bold">
                            {func.cedula}
                          </span>
                          {func.estado === 'PROCESADO' && (
                            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-300">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Procesado
                            </span>
                          )}
                          {func.estado === 'REMITIDO' && (
                            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-bold border border-purple-300">
                              <Send className="w-3 h-3 text-purple-600" />
                              Remitido
                            </span>
                          )}
                          {isRecentlySaved && (
                            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-300 animate-pulse">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Guardado con éxito
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] font-semibold text-slate-700 mt-0.5 leading-tight truncate">
                          {func.dependencia}
                        </p>
                        {func.estado === 'REMITIDO' && func.remitidoA && (
                          <p className="text-[10px] font-bold text-purple-700 mt-0.5 flex items-center gap-1">
                            <ArrowRight className="w-3 h-3" />
                            <span>Remitido a: {func.remitidoA}</span>
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-[10px] text-slate-500">
                          <span className="font-medium text-slate-600">Cargo: {func.cargo}</span>
                          {func.numeroResolucion && (
                            <span className="px-1 bg-white border border-slate-200 rounded text-slate-600 font-mono">
                              Res: {func.numeroResolucion}
                            </span>
                          )}
                          {func.fechaResolucion && (
                            <span>Emisión: {func.fechaResolucion}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1 shrink-0 pt-0.5 justify-end">
                        <button
                          type="button"
                          onClick={() => handleEdit(func)}
                          className="px-2.5 py-1 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg border border-slate-200 transition cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
                          title="Editar datos del funcionario"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                          <span>Editar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => promptDelete(func.id)}
                          className="px-2.5 py-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg border border-rose-200 transition cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                          title="Eliminar datos de este funcionario"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                          <span>Eliminar</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-100 px-5 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>Los datos registrados se aplican en tiempo real al seleccionar la dependencia.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-semibold transition cursor-pointer"
          >
            Cerrar Directorio
          </button>
        </div>

        {/* Modal de Confirmación para Eliminar Funcionario (In-App, compatible con iframe) */}
        {confirmDeleteTarget && (
          <div className="fixed inset-0 z-70 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">¿Eliminar Funcionario?</h4>
                  <p className="text-xs text-slate-500">Directorio de funcionarios</p>
                </div>
              </div>
              <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200 leading-relaxed">
                ¿Está seguro de borrar permanentemente los datos de <strong className="font-bold text-slate-900">{confirmDeleteTarget.nombre}</strong> del directorio?
              </p>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteTarget(null)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const { id, nombre } = confirmDeleteTarget;
                    setConfirmDeleteTarget(null);
                    executeDelete(id, nombre);
                  }}
                  className="px-3.5 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Sí, Eliminar</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Confirmación para Vaciar Directorio (In-App, compatible con iframe) */}
        {confirmClearAll && (
          <div className="fixed inset-0 z-70 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">¿Vaciar Todo el Directorio?</h4>
                  <p className="text-xs text-slate-500">Eliminación completa de registros</p>
                </div>
              </div>
              <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200 leading-relaxed">
                Se eliminarán permanentemente los <strong className="font-bold text-slate-900">{funcionarios.length}</strong> funcionarios cargados para iniciar con un directorio limpio.
              </p>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setConfirmClearAll(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmClearAll(false);
                    executeClearAll();
                  }}
                  className="px-3.5 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Sí, Vaciar Todo</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
