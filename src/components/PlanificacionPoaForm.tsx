import React, { useState, useMemo, useEffect } from 'react';
import {
  Target,
  Building2,
  Calendar,
  Percent,
  CheckCircle2,
  AlertTriangle,
  Edit,
  Trash2,
  Search,
  Filter,
  BarChart3,
  ShieldCheck,
  TrendingUp,
  RotateCcw,
  PlusCircle,
  FileSpreadsheet,
  Layers,
  ArrowRight,
  Info,
} from 'lucide-react';
import { MetaPoa, AppUser, Funcionario } from '../types';
import { DEPENDENCIAS_MUNICIPALES } from '../data/dependenciasData';

interface PlanificacionPoaFormProps {
  currentUser: AppUser;
  metasPoa: MetaPoa[];
  onSaveMetaPoa: (meta: MetaPoa) => Promise<boolean | void>;
  onDeleteMetaPoa?: (id: string) => Promise<boolean | void>;
  funcionarios?: Funcionario[];
}

export const PlanificacionPoaForm: React.FC<PlanificacionPoaFormProps> = ({
  currentUser,
  metasPoa,
  onSaveMetaPoa,
  onDeleteMetaPoa,
  funcionarios = [],
}) => {
  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [clasificacion, setClasificacion] = useState<'CENTRALIZADA' | 'DESCENTRALIZADA'>('CENTRALIZADA');
  const [selectedDependencia, setSelectedDependencia] = useState('');
  const [anio, setAnio] = useState(new Date().getFullYear().toString());
  const [periodo, setPeriodo] = useState<string>('ANUAL');
  const [objetivosEstablecidos, setObjetivosEstablecidos] = useState<string>('');
  const [objetivosEjecutados, setObjetivosEjecutados] = useState<string>('');
  const [porcentajeAlcanzado, setPorcentajeAlcanzado] = useState<string>('');
  const [autoCalculate, setAutoCalculate] = useState<boolean>(true);
  const [observaciones, setObservaciones] = useState('');

  // Status and feedback
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Table filters
  const [searchTerm, setSearchTerm] = useState('');
  const [tableFilterClasif, setTableFilterClasif] = useState<'TODAS' | 'CENTRALIZADA' | 'DESCENTRALIZADA'>('TODAS');

  // Filter dependencias according to selected classification
  const dependenciasDisponibles = useMemo(() => {
    return DEPENDENCIAS_MUNICIPALES.filter((dep) => {
      if (clasificacion === 'CENTRALIZADA') {
        return dep.tipo === 'CENTRALIZADA';
      } else {
        return dep.tipo === 'EMPRESA' || dep.tipo === 'INSTITUTO';
      }
    });
  }, [clasificacion]);

  // Find official titular for the selected dependency
  const titularOficial = useMemo(() => {
    if (!selectedDependencia) return null;
    const norm = selectedDependencia.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
    const list = funcionarios && funcionarios.length > 0 ? funcionarios : [];
    return list.find((f) => {
      if (!f.dependencia) return false;
      const fNorm = f.dependencia.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
      return fNorm === norm || fNorm.includes(norm) || norm.includes(fNorm);
    });
  }, [selectedDependencia, funcionarios]);

  // Recalculate % automatically when targets change (if autoCalculate is active)
  useEffect(() => {
    if (!autoCalculate) return;
    const est = Number(objetivosEstablecidos);
    const ejec = Number(objetivosEjecutados);
    if (!isNaN(est) && est > 0 && !isNaN(ejec) && ejec >= 0) {
      const calc = Math.round((ejec / est) * 100);
      setPorcentajeAlcanzado(calc.toString());
    } else if (objetivosEstablecidos === '' || objetivosEjecutados === '') {
      setPorcentajeAlcanzado('');
    }
  }, [objetivosEstablecidos, objetivosEjecutados, autoCalculate]);

  // Reset or initialize dependency when classification changes
  const handleClasificacionChange = (newClasif: 'CENTRALIZADA' | 'DESCENTRALIZADA') => {
    setClasificacion(newClasif);
    setSelectedDependencia('');
  };

  // Reset form
  const handleResetForm = () => {
    setEditingId(null);
    setSelectedDependencia('');
    setObjetivosEstablecidos('');
    setObjetivosEjecutados('');
    setPorcentajeAlcanzado('');
    setAutoCalculate(true);
    setObservaciones('');
    setErrorMsg(null);
  };

  // Populate form for editing
  const handleEdit = (meta: MetaPoa) => {
    setEditingId(meta.id);
    setClasificacion(meta.clasificacion);
    setSelectedDependencia(meta.dependencia);
    setAnio(meta.anio);
    setPeriodo(meta.periodo || 'ANUAL');
    setObjetivosEstablecidos(meta.objetivosEstablecidosPoa.toString());
    setObjetivosEjecutados(meta.objetivosEjecutados.toString());
    setPorcentajeAlcanzado(meta.porcentajeAlcanzado.toString());
    setAutoCalculate(false);
    setObservaciones(meta.observaciones || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!selectedDependencia.trim()) {
      setErrorMsg('Debe seleccionar una Dependencia o Ente Municipal.');
      return;
    }

    const estNum = Number(objetivosEstablecidos);
    if (isNaN(estNum) || estNum <= 0) {
      setErrorMsg('La cantidad de objetivos establecidos en POA debe ser un número entero mayor a 0.');
      return;
    }

    const ejecNum = Number(objetivosEjecutados);
    if (isNaN(ejecNum) || ejecNum < 0) {
      setErrorMsg('La cantidad de objetivos ejecutados debe ser un número igual o mayor a 0.');
      return;
    }

    const pctNum = Number(porcentajeAlcanzado);
    if (isNaN(pctNum) || pctNum < 0) {
      setErrorMsg('El porcentaje alcanzado debe ser un número válido (igual o mayor a 0%).');
      return;
    }

    setIsSubmitting(true);
    try {
      const registro: MetaPoa = {
        id: editingId || `POA-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        dependencia: selectedDependencia,
        clasificacion,
        anio: anio.trim() || new Date().getFullYear().toString(),
        periodo,
        objetivosEstablecidosPoa: estNum,
        objetivosEjecutados: ejecNum,
        porcentajeAlcanzado: pctNum,
        observaciones: observaciones.trim() || undefined,
        registradoPor: currentUser.email,
        fechaRegistro: editingId
          ? metasPoa.find((m) => m.id === editingId)?.fechaRegistro || new Date().toISOString()
          : new Date().toISOString(),
        fechaActualizacion: new Date().toISOString(),
      };

      await onSaveMetaPoa(registro);
      setSuccessMsg(
        editingId
          ? '¡Registro POA actualizado con éxito en la base de datos institucional!'
          : '¡Objetivos POA registrados y sincronizados con éxito en las métricas institucionales!'
      );
      handleResetForm();
      setTimeout(() => setSuccessMsg(null), 4500);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al guardar el registro de planificación POA.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quantitative Stats Summary
  const summaryStats = useMemo(() => {
    const totalRegistros = metasPoa.length;
    const totalEstablecidos = metasPoa.reduce((acc, m) => acc + (m.objetivosEstablecidosPoa || 0), 0);
    const totalEjecutados = metasPoa.reduce((acc, m) => acc + (m.objetivosEjecutados || 0), 0);
    const promedioAlcanzado =
      totalEstablecidos > 0 ? Math.round((totalEjecutados / totalEstablecidos) * 100) : 0;

    const centralizadas = metasPoa.filter((m) => m.clasificacion === 'CENTRALIZADA');
    const descentralizadas = metasPoa.filter((m) => m.clasificacion === 'DESCENTRALIZADA');

    return {
      totalRegistros,
      totalEstablecidos,
      totalEjecutados,
      promedioAlcanzado,
      centralizadasCount: centralizadas.length,
      descentralizadasCount: descentralizadas.length,
    };
  }, [metasPoa]);

  // Filtered table list
  const filteredMetas = useMemo(() => {
    return metasPoa.filter((meta) => {
      if (tableFilterClasif !== 'TODAS' && meta.clasificacion !== tableFilterClasif) {
        return false;
      }
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchDep = meta.dependencia.toLowerCase().includes(q);
        const matchAnio = meta.anio.toLowerCase().includes(q);
        const matchPer = (meta.periodo || '').toLowerCase().includes(q);
        if (!matchDep && !matchAnio && !matchPer) return false;
      }
      return true;
    });
  }, [metasPoa, tableFilterClasif, searchTerm]);

  const pctNumber = Number(porcentajeAlcanzado);
  const isValidPct = !isNaN(pctNumber) && porcentajeAlcanzado !== '';

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-8 animate-fade-in">
      {/* Banner Institucional Exclusivo */}
      <div className="bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 text-[10px] sm:text-xs uppercase tracking-wider">
                Módulo Oficial de Planificación
              </span>
              <span className="text-xs text-slate-400">
                Alcaldía del Municipio Autónomo Tinaquillo
              </span>
            </div>
            <h1 className="font-institutional text-2xl sm:text-3xl font-black text-white tracking-wide">
              Control y Registro de Objetivos POA
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
              Sistema exclusivo de la <strong>Dirección de Planificación y Organización</strong> para la carga de objetivos establecidos en el Plan Operativo Anual (POA), cantidad de objetivos ejecutados y porcentaje de alcance institucional.
            </p>
          </div>

          <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/80 text-right shrink-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
              Usuario en Sesión
            </span>
            <span className="text-xs font-bold text-white block mt-0.5">
              {currentUser.email}
            </span>
            <span className="text-[10px] text-emerald-400 font-semibold inline-flex items-center gap-1 mt-1">
              <ShieldCheck className="w-3 h-3" /> Acceso Exclusivo POA
            </span>
          </div>
        </div>
      </div>

      {/* KPI Cards Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Objetivos en POA
            </span>
            <Target className="w-4 h-4 text-sky-600" />
          </div>
          <p className="text-2xl font-black text-slate-900">{summaryStats.totalEstablecidos}</p>
          <span className="text-[10px] text-slate-500">Programados en Tinaquillo</span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
              Objetivos Ejecutados
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-slate-900">{summaryStats.totalEjecutados}</p>
          <span className="text-[10px] text-slate-500">Alcanzados a la fecha</span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">
              % Cumplimiento Global
            </span>
            <Percent className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-black text-slate-900">{summaryStats.promedioAlcanzado}%</p>
          <span className="text-[10px] text-slate-500">Promedio general municipal</span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600">
              Entidades Evaluadas
            </span>
            <Building2 className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-2xl font-black text-slate-900">{summaryStats.totalRegistros}</p>
          <span className="text-[10px] text-slate-500">
            {summaryStats.centralizadasCount} Centralizadas • {summaryStats.descentralizadasCount} Descentralizadas
          </span>
        </div>
      </div>

      {/* Mensajes de Alerta y Confirmación */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-900 text-xs sm:text-sm font-semibold flex items-center gap-3 animate-shake">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs sm:text-sm font-semibold flex items-center gap-3 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* FORMULARIO DE CARGA DE DATOS POA */}
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-6"
      >
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center font-bold">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                {editingId ? 'Editar Registro POA Institucional' : 'Nuevo Registro de Objetivos POA'}
              </h2>
              <p className="text-xs text-slate-500">
                Complete las casillas requeridas de la dependencia y ejecución de metas.
              </p>
            </div>
          </div>

          {editingId && (
            <button
              type="button"
              onClick={handleResetForm}
              className="text-xs font-bold text-slate-600 hover:text-slate-900 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Cancelar Edición</span>
            </button>
          )}
        </div>

        {/* FILA 1: CASILLAS DE CLASIFICACIÓN Y DEPENDENCIA */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* CASILLA 1: DESPLEGABLE DE CLASIFICACIÓN (CENTRALIZADAS Y DESCENTRALIZADAS) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              1. Clasificación del Sector <span className="text-rose-500">*</span>
            </label>
            <select
              value={clasificacion}
              onChange={(e) => handleClasificacionChange(e.target.value as any)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-2xl text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:bg-white transition"
            >
              <option value="CENTRALIZADA">
                Dependencias Centralizadas (Direcciones del Despacho y Alcaldía)
              </option>
              <option value="DESCENTRALIZADA">
                Dependencias Descentralizadas (Institutos Autónomos y Empresas Municipales)
              </option>
            </select>
            <p className="text-[11px] text-slate-500 mt-1.5">
              {clasificacion === 'CENTRALIZADA'
                ? 'Direcciones centrales adscritas a la Alcaldía y Dirección General.'
                : 'Institutos autónomos descentralizados y empresas públicas municipales.'}
            </p>
          </div>

          {/* CASILLA 2: DESPLEGABLE DE DEPENDENCIAS SEGÚN CLASIFICACIÓN */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              2. Dependencia o Ente Municipal <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedDependencia}
              onChange={(e) => setSelectedDependencia(e.target.value)}
              required
              className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-2xl text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:bg-white transition"
            >
              <option value="">-- Seleccionar Dependencia ({dependenciasDisponibles.length} disponibles) --</option>
              {dependenciasDisponibles.map((dep) => (
                <option key={dep.id} value={dep.nombre}>
                  {dep.nombre}
                </option>
              ))}
            </select>
            {titularOficial && (
              <p className="text-[11px] text-emerald-700 font-semibold mt-1.5 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Titular en Directorio: {titularOficial.nombresApellidos} ({titularOficial.cargo || 'Responsable'})</span>
              </p>
            )}
          </div>
        </div>

        {/* FILA 2: CASILLAS DE PERÍODO Y AÑO */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 p-4 bg-slate-50 rounded-2xl border border-slate-200">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Año del POA <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={anio}
                onChange={(e) => setAnio(e.target.value)}
                placeholder="Ej. 2026"
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:ring-2 focus:ring-sky-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Período Evaluado <span className="text-rose-500">*</span>
            </label>
            <select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:ring-2 focus:ring-sky-600"
            >
              <option value="ANUAL">Período Anual Consolidado</option>
              <option value="I TRIMESTRE">I TRIMESTRE (Enero - Marzo)</option>
              <option value="II TRIMESTRE">II TRIMESTRE (Abril - Junio)</option>
              <option value="III TRIMESTRE">III TRIMESTRE (Julio - Septiembre)</option>
              <option value="IV TRIMESTRE">IV TRIMESTRE (Octubre - Diciembre)</option>
            </select>
          </div>
        </div>

        {/* FILA 3: CASILLAS DE OBJETIVOS ESTABLECIDOS, EJECUTADOS Y % ALCANZADO */}
        <div className="p-5 bg-gradient-to-br from-slate-50 via-white to-sky-50/50 rounded-2xl border border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-sky-600" />
              <span>Metas y Porcentaje de Cumplimiento</span>
            </h3>
            <button
              type="button"
              onClick={() => {
                const newState = !autoCalculate;
                setAutoCalculate(newState);
                if (newState) {
                  const est = Number(objetivosEstablecidos);
                  const ejec = Number(objetivosEjecutados);
                  if (est > 0 && ejec >= 0) {
                    setPorcentajeAlcanzado(Math.round((ejec / est) * 100).toString());
                  }
                }
              }}
              className="text-[11px] font-bold text-sky-700 hover:text-sky-900 flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>{autoCalculate ? 'Modo: Cálculo Automático (Activo)' : 'Modo: Edición Manual del %'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {/* CASILLA 3: CANTIDAD DE OBJETIVOS ESTABLECIDOS EN POA */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Objetivos Establecidos en POA <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                required
                value={objetivosEstablecidos}
                onChange={(e) => setObjetivosEstablecidos(e.target.value)}
                placeholder="Ej. 15"
                className="w-full px-4 py-3 bg-white border border-slate-300 rounded-2xl text-base font-mono font-bold text-slate-900 focus:ring-2 focus:ring-sky-600 shadow-2xs"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Total de metas programadas en el Plan Operativo
              </span>
            </div>

            {/* CASILLA 4: CANTIDAD DE OBJETIVOS EJECUTADOS */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Objetivos Ejecutados <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                required
                value={objetivosEjecutados}
                onChange={(e) => setObjetivosEjecutados(e.target.value)}
                placeholder="Ej. 12"
                className="w-full px-4 py-3 bg-white border border-slate-300 rounded-2xl text-base font-mono font-bold text-slate-900 focus:ring-2 focus:ring-emerald-600 shadow-2xs"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Total de metas cumplidas y documentadas
              </span>
            </div>

            {/* CASILLA 5: % ALCANZADO (EDITABLE DIRECTAMENTE) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>% Alcanzado <span className="text-rose-500">*</span></span>
                <span className="text-[10px] text-amber-700 font-bold">Colocar o Ajustar %</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="1000"
                  required
                  value={porcentajeAlcanzado}
                  onChange={(e) => {
                    setAutoCalculate(false);
                    setPorcentajeAlcanzado(e.target.value);
                  }}
                  placeholder="Ej. 80"
                  className="w-full pl-4 pr-10 py-3 bg-white border-2 border-amber-400/80 rounded-2xl text-base font-mono font-black text-slate-950 focus:ring-2 focus:ring-amber-500 shadow-2xs"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-black text-slate-500 text-sm">
                  %
                </span>
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                Se refleja estadísticamente en las métricas
              </span>
            </div>
          </div>

          {/* VISUALIZADOR EN TIEMPO REAL DEL % ALCANZADO */}
          {isValidPct && (
            <div className="mt-3 p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-700 flex items-center gap-1.5">
                  <span>Rendimiento Estimado:</span>
                  <strong
                    className={`px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider ${
                      pctNumber >= 80
                        ? 'bg-emerald-100 text-emerald-800'
                        : pctNumber >= 50
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {pctNumber >= 80
                      ? 'ÓPTIMO / CUMPLIMIENTO SATISFACTORIO'
                      : pctNumber >= 50
                      ? 'INTERMEDIO / EN PROCESO'
                      : 'BAJO / REQUIERE ATENCIÓN'}
                  </strong>
                </span>
                <span className="font-mono text-sm font-black text-slate-900">{pctNumber}%</span>
              </div>

              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    pctNumber >= 80
                      ? 'bg-emerald-500'
                      : pctNumber >= 50
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, pctNumber))}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* FILA 4: CASILLA DE OBSERVACIONES O DESCRIPCIÓN DE LOGROS */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Observaciones o Justificación de Gestión (Opcional)
          </label>
          <textarea
            rows={3}
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Indique detalles cualitativos, observaciones sobre metas cumplidas o justificaciones técnicas..."
            className="w-full p-3.5 bg-slate-50 border border-slate-300 rounded-2xl text-xs sm:text-sm text-slate-900 focus:ring-2 focus:ring-sky-600 focus:bg-white transition"
          />
        </div>

        {/* BOTONES DE ACCIÓN */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={handleResetForm}
            className="w-full sm:w-auto px-5 py-3 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold transition cursor-pointer"
          >
            Limpiar Formulario
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto px-7 py-3 bg-gradient-to-r from-slate-900 via-sky-900 to-slate-900 hover:from-slate-800 hover:to-sky-800 text-white rounded-xl text-xs sm:text-sm font-black shadow-md transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{editingId ? 'Guardar Cambios del Registro POA' : 'Registrar Datos de Planificación POA'}</span>
          </button>
        </div>
      </form>

      {/* TABLA DE REGISTROS POA CARGADOS */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm space-y-4 p-5 sm:p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-sky-600" />
              <span>Registros POA Cargados ({filteredMetas.length})</span>
            </h3>
            <p className="text-xs text-slate-500">
              Historial de metas POA registradas y su porcentaje de alcance institucional.
            </p>
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            <div className="relative flex-1 md:w-60">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar dependencia o año..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-sky-600"
              />
            </div>

            <select
              value={tableFilterClasif}
              onChange={(e) => setTableFilterClasif(e.target.value as any)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-sky-600"
            >
              <option value="TODAS">Todas las Clasificaciones</option>
              <option value="CENTRALIZADA">Solo Centralizadas</option>
              <option value="DESCENTRALIZADA">Solo Descentralizadas</option>
            </select>
          </div>
        </div>

        {filteredMetas.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <Target className="w-12 h-12 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-700">
              No hay metas POA registradas con los filtros seleccionados.
            </p>
            <p className="text-xs text-slate-500">
              Utilice el formulario superior para agregar los objetivos POA de las dependencias municipales.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3">Dependencia</th>
                  <th className="py-3 px-3">Clasificación</th>
                  <th className="py-3 px-3">Período / Año</th>
                  <th className="py-3 px-3 text-center">Objetivos Establecidos</th>
                  <th className="py-3 px-3 text-center">Objetivos Ejecutados</th>
                  <th className="py-3 px-3 text-center">% Alcanzado</th>
                  <th className="py-3 px-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredMetas.map((meta) => {
                  const pct = meta.porcentajeAlcanzado;
                  return (
                    <tr key={meta.id} className="hover:bg-slate-50/80 transition">
                      {/* Dependencia */}
                      <td className="py-3 px-3 font-bold text-slate-900 max-w-xs truncate" title={meta.dependencia}>
                        {meta.dependencia}
                        {meta.observaciones && (
                          <span className="block text-[10px] text-slate-500 font-normal truncate mt-0.5">
                            {meta.observaciones}
                          </span>
                        )}
                      </td>

                      {/* Clasificación */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            meta.clasificacion === 'CENTRALIZADA'
                              ? 'bg-sky-100 text-sky-800 border border-sky-200'
                              : 'bg-purple-100 text-purple-800 border border-purple-200'
                          }`}
                        >
                          {meta.clasificacion}
                        </span>
                      </td>

                      {/* Período / Año */}
                      <td className="py-3 px-3 whitespace-nowrap text-slate-600">
                        {meta.periodo || 'ANUAL'} • {meta.anio}
                      </td>

                      {/* Objetivos Establecidos */}
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-800">
                        {meta.objetivosEstablecidosPoa}
                      </td>

                      {/* Objetivos Ejecutados */}
                      <td className="py-3 px-3 text-center font-mono font-bold text-emerald-800">
                        {meta.objetivosEjecutados}
                      </td>

                      {/* % Alcanzado */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <span
                            className={`font-mono font-black text-xs px-2 py-0.5 rounded-md ${
                              pct >= 80
                                ? 'bg-emerald-100 text-emerald-800'
                                : pct >= 50
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {pct}%
                          </span>
                        </div>
                      </td>

                      {/* Acciones */}
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleEdit(meta)}
                            className="p-1.5 text-slate-600 hover:text-sky-700 hover:bg-sky-50 rounded-lg transition cursor-pointer"
                            title="Editar registro"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          {onDeleteMetaPoa && (
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`¿Eliminar registro POA de ${meta.dependencia}?`)) {
                                  onDeleteMetaPoa(meta.id);
                                }
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="Eliminar registro"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
        )}
      </div>
    </div>
  );
};
