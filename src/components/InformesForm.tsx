import React, { useState, useMemo, useEffect } from 'react';
import {
  Building2,
  FileText,
  Upload,
  Calendar,
  Phone,
  User,
  CreditCard,
  FileCheck2,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Percent,
  Layers,
  FileSpreadsheet,
  Plus,
  X,
  Sparkles,
  UserCheck,
  UserPlus,
  Paperclip,
  Lock,
  Unlock,
  ShieldCheck,
  Eraser,
  Check,
  ExternalLink,
  Users,
  Briefcase,
} from 'lucide-react';
import {
  InformeDependencia,
  TipoInforme,
  FileAttachment,
  AppUser,
  ClasificacionDependencia,
  Funcionario,
} from '../types';
import {
  DEPENDENCIAS_MUNICIPALES,
  PROCEDIMIENTOS_AUDITORIA,
  CLASIFICACIONES_DEPENDENCIA,
  TIPOS_INFORME_OPTIONS,
} from '../data/dependenciasData';
import {
  findFuncionarioByDependencia,
  syncFuncionarioToDirectorio,
  getStoredFuncionarios,
} from '../utils/storage';
import { validateFileSecurity, compressAndSanitizeImage } from '../utils/security';

interface InformesFormProps {
  currentUser: AppUser;
  funcionarios?: Funcionario[];
  onOpenFuncionariosModal?: () => void;
  onSaveInforme: (informe: InformeDependencia) => void;
  onCancel?: () => void;
  initialData?: InformeDependencia | null;
  onViewList?: () => void;
  informesCount?: number;
}

export const InformesForm: React.FC<InformesFormProps> = ({
  currentUser,
  funcionarios,
  onOpenFuncionariosModal,
  onSaveInforme,
  onCancel,
  initialData,
  onViewList,
  informesCount,
}) => {
  // Dependency classification selection: CENTRALIZADA | EMPRESA | INSTITUTO
  const initialClasificacion = useMemo<ClasificacionDependencia>(() => {
    if (initialData?.clasificacion) return initialData.clasificacion;
    if (initialData?.dependencia) {
      const found = DEPENDENCIAS_MUNICIPALES.find((d) => d.nombre === initialData.dependencia);
      if (found) return found.tipo;
    }
    return 'CENTRALIZADA';
  }, [initialData]);

  const [selectedClasificacion, setSelectedClasificacion] = useState<ClasificacionDependencia>(initialClasificacion);

  const dependenciasFiltradas = useMemo(() => {
    return DEPENDENCIAS_MUNICIPALES.filter((d) => d.tipo === selectedClasificacion);
  }, [selectedClasificacion]);

  // Dependency selection - Inicia vacío si es nuevo informe para que no aparezca ningún dato sin registro oficial previo
  const [selectedDependenciaNombre, setSelectedDependenciaNombre] = useState(
    initialData?.dependencia || ''
  );

  const [selectedCargo, setSelectedCargo] = useState(initialData?.cargo || '');
  const [selectedFuncionarioId, setSelectedFuncionarioId] = useState<string>('');
  const [isCustomCargo, setIsCustomCargo] = useState(false);

  // Common official info
  const [nombresApellidos, setNombresApellidos] = useState(initialData?.nombresApellidos || '');
  const [cedula, setCedula] = useState(initialData?.cedula || '');
  const [telefono, setTelefono] = useState(initialData?.telefono || '');

  // Resolution fields (for Dirección General & Despacho)
  const [numeroResolucion, setNumeroResolucion] = useState(initialData?.numeroResolucion || '');
  const [fechaResolucion, setFechaResolucion] = useState(initialData?.fechaResolucion || '');

  // Report Type
  const [tipoInforme, setTipoInforme] = useState<TipoInforme>(
    initialData?.tipoInforme || 'REPORTE DE GESTIÓN TRIMESTRAL'
  );

  // Trimestral fields (Requirement 14: Descripción Breve y Adjuntar Informe)
  const [trimestre, setTrimestre] = useState<'I TRIMESTRE' | 'II TRIMESTRE' | 'III TRIMESTRE' | 'IV TRIMESTRE'>(
    initialData?.trimestre || 'II TRIMESTRE'
  );
  const [anioGestion, setAnioGestion] = useState(
    initialData?.anioGestion || new Date().getFullYear().toString()
  );
  const [descripcionBreve, setDescripcionBreve] = useState(
    initialData?.descripcionBreve ||
      (initialData?.actividadesEjecutadas
        ? `${initialData.actividadesEjecutadas}${initialData.logrosAlcanzados ? `\n\nLogros: ${initialData.logrosAlcanzados}` : ''}`
        : '')
  );
  const [adjuntoInformeTrimestral, setAdjuntoInformeTrimestral] = useState<FileAttachment[]>(
    initialData?.adjuntoInformeTrimestral || []
  );
  const [metasFisicasProgramadas, setMetasFisicasProgramadas] = useState<number | string>(
    initialData?.metasFisicasProgramadas !== undefined ? initialData.metasFisicasProgramadas : ''
  );
  const [metasFisicasEjecutadas, setMetasFisicasEjecutadas] = useState<number | string>(
    initialData?.metasFisicasEjecutadas !== undefined ? initialData.metasFisicasEjecutadas : ''
  );

  // Memorandum Interno fields (Requirement 11)
  const [punto1, setPunto1] = useState(initialData?.punto1 || '');
  const [punto2, setPunto2] = useState(initialData?.punto2 || '');
  const [puntosAdicionales, setPuntosAdicionales] = useState<string[]>(
    initialData?.puntosAdicionales || []
  );
  const [fotoFirmaPersonal, setFotoFirmaPersonal] = useState<FileAttachment[]>(
    initialData?.fotoFirmaPersonal || []
  );

  // State flag when auto-filled from Directorio
  const [autoFilledInfo, setAutoFilledInfo] = useState<string | null>(null);

  // Calculated % Alcance
  const alcanceCalculado = useMemo(() => {
    const prog = Number(metasFisicasProgramadas);
    const ejec = Number(metasFisicasEjecutadas);
    if (!prog || prog <= 0 || isNaN(ejec)) return 0;
    return Math.min(100, Math.round((ejec / prog) * 100));
  }, [metasFisicasProgramadas, metasFisicasEjecutadas]);

  // Auditoria fields
  const [procedimientosAuditados, setProcedimientosAuditados] = useState<string[]>(
    initialData?.procedimientosAuditados || []
  );
  const [descripcionDetallada, setDescripcionDetallada] = useState(
    initialData?.descripcionDetallada || ''
  );
  const [hallazgos, setHallazgos] = useState(initialData?.hallazgos || '');
  const [conclusionesRecomendaciones, setConclusionesRecomendaciones] = useState(
    initialData?.conclusionesRecomendaciones || ''
  );
  const [fechaAuditoria, setFechaAuditoria] = useState(
    initialData?.fechaAuditoria || new Date().toISOString().split('T')[0]
  );
  const [archivosAuditoria, setArchivosAuditoria] = useState<FileAttachment[]>(
    initialData?.archivosAuditoria || []
  );

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Automation from Directorio state - synchronized in real time
  const [directorioList, setDirectorioList] = useState<Funcionario[]>(() =>
    funcionarios && funcionarios.length > 0 ? funcionarios : getStoredFuncionarios()
  );

  // Sync with incoming prop or global custom events (real-time multi-user)
  useEffect(() => {
    if (funcionarios && funcionarios.length > 0) {
      setDirectorioList(funcionarios);
    }
  }, [funcionarios]);

  useEffect(() => {
    const handleSync = (e: any) => {
      const list = e?.detail || getStoredFuncionarios();
      if (Array.isArray(list) && list.length > 0) {
        setDirectorioList(list);
      }
    };
    window.addEventListener('tinaquillo_funcionarios_sync', handleSync);
    window.addEventListener('tinaquillo_db_sync', handleSync);
    return () => {
      window.removeEventListener('tinaquillo_funcionarios_sync', handleSync);
      window.removeEventListener('tinaquillo_db_sync', handleSync);
    };
  }, []);

  // Most up-to-date funcionarios list combining props, state and persistent storage
  const effectiveDirectorio = useMemo(() => {
    if (funcionarios && funcionarios.length > 0) return funcionarios;
    if (directorioList && directorioList.length > 0) return directorioList;
    return getStoredFuncionarios();
  }, [funcionarios, directorioList]);

  // Normalización para búsqueda de dependencias
  const normalizeDep = (dep: string) => {
    let norm = (dep || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
    if (norm.includes('OFICINA DE ATENCION AL CIUDADANO') || norm.includes('DIRECCION DE ATENCION AL CIUDADANO')) {
      return 'DIRECCION DE ATENCION AL CIUDADANO';
    }
    return norm;
  };

  // Funcionarios registrados para la dependencia seleccionada
  const funcionariosDeLaDependencia = useMemo(() => {
    if (!selectedDependenciaNombre) return [];
    const targetNorm = normalizeDep(selectedDependenciaNombre);
    return effectiveDirectorio.filter((f) => {
      const fDep = normalizeDep(f.dependencia || '');
      return fDep === targetNorm || fDep.includes(targetNorm) || targetNorm.includes(fDep);
    });
  }, [selectedDependenciaNombre, effectiveDirectorio]);

  // AUTOMATIZACIÓN DE DATOS DEL FUNCIONARIO EN TIEMPO REAL:
  // Carga automática del funcionario si está registrado en el directorio oficial por el Usuario Principal.
  useEffect(() => {
    if (initialData) return; // Si es edición de un informe existente, preservar los datos originales con los que se guardó

    if (!selectedDependenciaNombre || funcionariosDeLaDependencia.length === 0) {
      if (selectedDependenciaNombre && !autoFilledInfo) {
        setSelectedCargo('');
        setNombresApellidos('');
        setCedula('');
        setTelefono('');
        setNumeroResolucion('');
        setFechaResolucion('');
        setSelectedFuncionarioId('');
      }
      return;
    }

    // Si hay funcionarios registrados, seleccionar el asignado o el primero
    const funcionario =
      funcionariosDeLaDependencia.find((f) => f.id === selectedFuncionarioId) ||
      funcionariosDeLaDependencia[0];

    if (funcionario) {
      setSelectedFuncionarioId(funcionario.id);
      setSelectedCargo(funcionario.cargo || '');
      setNombresApellidos(funcionario.nombresApellidos || '');
      setCedula(funcionario.cedula || '');
      setTelefono(funcionario.telefono || '');
      setNumeroResolucion(funcionario.numeroResolucion || '');
      setFechaResolucion(funcionario.fechaResolucion || '');
      setAutoFilledInfo(
        `${funcionario.nombresApellidos} (${funcionario.cargo || 'TITULAR'}) - C.I. ${funcionario.cedula}`
      );
    }
  }, [selectedDependenciaNombre, selectedFuncionarioId, funcionariosDeLaDependencia, initialData]);

  // Configuración de la dependencia actualmente seleccionada (con sus cargos oficiales)
  const activeDependenciaConfig = useMemo(() => {
    if (!selectedDependenciaNombre) return undefined;
    const targetNorm = normalizeDep(selectedDependenciaNombre);
    const found = DEPENDENCIAS_MUNICIPALES.find((d) => normalizeDep(d.nombre) === targetNorm);
    if (found) {
      if (targetNorm.includes('DESPACHO')) {
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

    if (selectedClasificacion === 'EMPRESA' || selectedClasificacion === 'INSTITUTO') {
      return {
        id: 'fallback-ente',
        nombre: selectedDependenciaNombre,
        tipo: selectedClasificacion,
        tieneCargos: true,
        cargos: ['PRESIDENTE (A)', 'ADMINISTRADOR', 'OTRO, ESPECIFIQUE'],
      };
    }
    return undefined;
  }, [selectedDependenciaNombre, selectedClasificacion]);

  // Manejo de selección de cargo en la casilla desplegable
  const handleCargoSelect = (cargoVal: string) => {
    setSelectedCargo(cargoVal);
    if (!cargoVal || cargoVal === 'OTRO' || cargoVal === 'OTRO, ESPECIFIQUE') {
      if (funcionariosDeLaDependencia.length === 0) {
        setSelectedFuncionarioId('');
        setAutoFilledInfo(null);
      }
      return;
    }

    // Buscar si hay funcionario registrado oficialmente para esta dependencia y este cargo
    const match = funcionariosDeLaDependencia.find((f) => {
      const fNorm = (f.cargo || '').toUpperCase().trim();
      const cNorm = cargoVal.toUpperCase().trim();
      return fNorm === cNorm || fNorm.includes(cNorm) || cNorm.includes(fNorm);
    });

    if (match) {
      setSelectedFuncionarioId(match.id);
      setNombresApellidos(match.nombresApellidos || '');
      setCedula(match.cedula || '');
      setTelefono(match.telefono || '');
      setNumeroResolucion(match.numeroResolucion || '');
      setFechaResolucion(match.fechaResolucion || '');
      setAutoFilledInfo(
        `${match.nombresApellidos} (${match.cargo || cargoVal}) - C.I. ${match.cedula}`
      );
    } else {
      setSelectedFuncionarioId('');
      setAutoFilledInfo(null);
    }
  };

  // Manejo de cambio de funcionario cuando hay múltiples registrados
  const handleFuncionarioChange = (funcId: string) => {
    setSelectedFuncionarioId(funcId);
    const match = funcionariosDeLaDependencia.find((f) => f.id === funcId);
    if (match) {
      setSelectedCargo(match.cargo || '');
      setNombresApellidos(match.nombresApellidos || '');
      setCedula(match.cedula || '');
      setTelefono(match.telefono || '');
      setNumeroResolucion(match.numeroResolucion || '');
      setFechaResolucion(match.fechaResolucion || '');
      setAutoFilledInfo(
        `${match.nombresApellidos} (${match.cargo || 'TITULAR'}) - C.I. ${match.cedula}`
      );
    }
  };

  // Manejo de cambio de dependencia con autollenado instantáneo
  const handleDependenciaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const depName = e.target.value;
    setSelectedDependenciaNombre(depName);
    setIsCustomCargo(false);

    if (!depName) {
      setSelectedFuncionarioId('');
      setSelectedCargo('');
      setNombresApellidos('');
      setCedula('');
      setTelefono('');
      setNumeroResolucion('');
      setFechaResolucion('');
      setAutoFilledInfo(null);
      return;
    }

    const targetNorm = normalizeDep(depName);
    const matchingFuncs = effectiveDirectorio.filter((f) => {
      const fDep = normalizeDep(f.dependencia || '');
      return fDep === targetNorm || fDep.includes(targetNorm) || targetNorm.includes(fDep);
    });

    if (matchingFuncs.length > 0) {
      const funcionario = matchingFuncs[0];
      setSelectedFuncionarioId(funcionario.id);
      setSelectedCargo(funcionario.cargo || '');
      setNombresApellidos(funcionario.nombresApellidos || '');
      setCedula(funcionario.cedula || '');
      setTelefono(funcionario.telefono || '');
      setNumeroResolucion(funcionario.numeroResolucion || '');
      setFechaResolucion(funcionario.fechaResolucion || '');
      setAutoFilledInfo(
        `${funcionario.nombresApellidos} (${funcionario.cargo || 'TITULAR'}) - C.I. ${funcionario.cedula}`
      );
    } else {
      setSelectedFuncionarioId('');
      setSelectedCargo('');
      setNombresApellidos('');
      setCedula('');
      setTelefono('');
      setNumeroResolucion('');
      setFechaResolucion('');
      setAutoFilledInfo(null);
    }
  };

  // Memorandum Interno: Additional points management
  const handleAddPuntoAdicional = () => {
    setPuntosAdicionales([...puntosAdicionales, '']);
  };

  const handlePuntoAdicionalChange = (index: number, val: string) => {
    const updated = [...puntosAdicionales];
    updated[index] = val;
    setPuntosAdicionales(updated);
  };

  const handleRemovePuntoAdicional = (index: number) => {
    setPuntosAdicionales(puntosAdicionales.filter((_, i) => i !== index));
  };

  // Requirement 11: File upload for foto de la lista de firma del personal
  const handleFotoFirmaPersonalUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newPhotos = [...fotoFirmaPersonal];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Block SVG to prevent stored XSS attacks
      if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
        setErrorMsg('Por motivos de seguridad no se admiten archivos SVG. Utilice imágenes JPG, PNG o PDF.');
        continue;
      }

      if (file.size > 5 * 1024 * 1024) {
        setErrorMsg(`El archivo "${file.name}" supera el tamaño máximo permitido de 5MB.`);
        continue;
      }

      let fileType: 'image' | 'pdf' | 'doc' = 'image';
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        fileType = 'pdf';
      }

      const reader = new FileReader();
      reader.onload = () => {
        newPhotos.push({
          id: `firma-${Date.now()}-${Math.random()}`,
          name: file.name,
          type: fileType,
          size: file.size,
          dataUrl: reader.result as string,
        });
        setFotoFirmaPersonal([...newPhotos]);
      };
      reader.readAsDataURL(file);
    }
  };

  // Requirement 14: File upload for Adjuntar Informe Trimestral (PDF, DOC, XLS, IMG)
  const handleAdjuntoTrimestralUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newDocs = [...adjuntoInformeTrimestral];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      const secCheck = validateFileSecurity(file);
      if (!secCheck.safe) {
        setErrorMsg(secCheck.reason || 'Archivo rechazado por seguridad.');
        continue;
      }

      let fileType: 'pdf' | 'doc' | 'sheet' | 'image' = 'doc';
      if (file.type.startsWith('image/')) fileType = 'image';
      else if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) fileType = 'pdf';
      else if (file.name.endsWith('.xls') || file.name.endsWith('.xlsx')) fileType = 'sheet';

      if (fileType === 'image') {
        try {
          const comp = await compressAndSanitizeImage(file, 1280, 1280, 0.82);
          newDocs.push({
            id: `inf-doc-${Date.now()}-${Math.random()}`,
            name: comp.name,
            type: 'image',
            size: comp.size,
            dataUrl: comp.dataUrl,
          });
          setAdjuntoInformeTrimestral([...newDocs]);
        } catch (err) {
          setErrorMsg(`No se pudo procesar la imagen "${file.name}".`);
        }
      } else {
        const reader = new FileReader();
        reader.onload = () => {
          newDocs.push({
            id: `inf-doc-${Date.now()}-${Math.random()}`,
            name: file.name,
            type: fileType,
            size: file.size,
            dataUrl: reader.result as string,
          });
          setAdjuntoInformeTrimestral([...newDocs]);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  // Toggle procedure checkbox
  const toggleProcedimiento = (proc: string) => {
    if (procedimientosAuditados.includes(proc)) {
      setProcedimientosAuditados(procedimientosAuditados.filter((p) => p !== proc));
    } else {
      setProcedimientosAuditados([...procedimientosAuditados, proc]);
    }
  };


  // Auditoria Docs & Photos Upload (Images, Word, Excel, PDF)
  const handleAuditoriaFilesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newDocs = [...archivosAuditoria];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      const secCheck = validateFileSecurity(file);
      if (!secCheck.safe) {
        setErrorMsg(secCheck.reason || 'Archivo rechazado por seguridad.');
        continue;
      }

      let fileType = 'doc';
      if (file.type.startsWith('image/')) fileType = 'image';
      else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) fileType = 'pdf';
      else if (file.name.match(/\.(xlsx|xls|csv)$/i)) fileType = 'excel';
      else fileType = 'doc';

      if (fileType === 'image') {
        try {
          const comp = await compressAndSanitizeImage(file, 1280, 1280, 0.82);
          newDocs.push({
            id: `audit-${Date.now()}-${Math.random()}`,
            name: comp.name,
            type: 'image',
            size: comp.size,
            dataUrl: comp.dataUrl,
          });
          setArchivosAuditoria([...newDocs]);
        } catch (err) {
          setErrorMsg(`No se pudo procesar la imagen "${file.name}".`);
        }
      } else {
        const reader = new FileReader();
        reader.onload = () => {
          newDocs.push({
            id: `audit-${Date.now()}-${Math.random()}`,
            name: file.name,
            type: fileType,
            size: file.size,
            dataUrl: reader.result as string,
          });
          setArchivosAuditoria([...newDocs]);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedDependenciaNombre.trim()) {
      setErrorMsg('Debe seleccionar una Dependencia o Ente Adscrito.');
      return;
    }

    if (!nombresApellidos.trim() || !cedula.trim()) {
      setErrorMsg(
        'No se puede registrar el informe sin funcionario asignado. Debe existir un funcionario registrado en el Directorio Oficial por el Usuario Principal.'
      );
      return;
    }

    // Validate Trimestral (Solo opción de adjuntar archivo)
    if (tipoInforme === 'REPORTE DE GESTIÓN TRIMESTRAL') {
      if (!adjuntoInformeTrimestral || adjuntoInformeTrimestral.length === 0) {
        setErrorMsg('Debe adjuntar al menos un archivo digital o documento para el informe de gestión trimestral.');
        return;
      }
    }

    const isMemorandumTipo =
      tipoInforme === 'MEMORANDUM INTERNO' ||
      tipoInforme === 'REGISTRO DE COMUNICACIÓN INTERNA DE DIRECTORIO';

    // Validate Memorandum Interno / Registro de Comunicación Interna
    if (isMemorandumTipo) {
      if (!punto1.trim()) {
        setErrorMsg('Para registrar la comunicación interna de directorio, debe describir el Punto 1.');
        return;
      }
      if (!punto2.trim()) {
        setErrorMsg('Para registrar la comunicación interna de directorio, debe describir el Punto 2.');
        return;
      }
    }

    // Validate Auditoria
    if (
      tipoInforme === 'INFORME PARCIAL DE AUDITORIA' ||
      tipoInforme === 'INFORME PARCIAL DE LA AUDITORIA OPERATIVA DE LA CONTRALORÍA MUNICIPAL' ||
      tipoInforme === 'INFORME DE AUDITORÍA DEFINITIVO'
    ) {
      if (procedimientosAuditados.length === 0) {
        setErrorMsg('Debe seleccionar al menos un Procedimiento Auditado.');
        return;
      }
      if (!descripcionDetallada.trim()) {
        setErrorMsg('Debe ingresar la Descripción Detallada de la auditoría.');
        return;
      }
      if (!hallazgos.trim()) {
        setErrorMsg('Debe ingresar los Hallazgos de la auditoría.');
        return;
      }
      if (!fechaAuditoria) {
        setErrorMsg('Debe seleccionar la Fecha de la auditoría.');
        return;
      }
    }

    const nuevoInforme: InformeDependencia = {
      id: initialData?.id || `INF-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
      dependencia: selectedDependenciaNombre,
      clasificacion: selectedClasificacion,
      cargo: selectedCargo.trim() || undefined,
      nombresApellidos: nombresApellidos.trim(),
      cedula: cedula.trim(),
      telefono: telefono.trim(),
      numeroResolucion: numeroResolucion.trim() || undefined,
      fechaResolucion: fechaResolucion.trim() || undefined,
      tipoInforme,

      // Trimestral (Requirement 14)
      trimestre: tipoInforme === 'REPORTE DE GESTIÓN TRIMESTRAL' ? trimestre : undefined,
      anioGestion: tipoInforme === 'REPORTE DE GESTIÓN TRIMESTRAL' ? anioGestion : undefined,
      descripcionBreve: tipoInforme === 'REPORTE DE GESTIÓN TRIMESTRAL' ? descripcionBreve.trim() : undefined,
      adjuntoInformeTrimestral: tipoInforme === 'REPORTE DE GESTIÓN TRIMESTRAL' ? adjuntoInformeTrimestral : undefined,
      adjuntoInforme: tipoInforme === 'REPORTE DE GESTIÓN TRIMESTRAL' ? adjuntoInformeTrimestral : undefined,
      metasFisicasProgramadas: tipoInforme === 'REPORTE DE GESTIÓN TRIMESTRAL' ? Number(metasFisicasProgramadas) || 0 : undefined,
      metasFisicasEjecutadas: tipoInforme === 'REPORTE DE GESTIÓN TRIMESTRAL' ? Number(metasFisicasEjecutadas) || 0 : undefined,
      alcancePorcentaje: tipoInforme === 'REPORTE DE GESTIÓN TRIMESTRAL' ? alcanceCalculado : undefined,

      // Memorandum Interno / Registro de Comunicación Interna
      punto1: isMemorandumTipo ? punto1.trim() : undefined,
      punto2: isMemorandumTipo ? punto2.trim() : undefined,
      puntosAdicionales:
        isMemorandumTipo
          ? puntosAdicionales.map((p) => p.trim()).filter(Boolean)
          : undefined,
      fotoFirmaPersonal: isMemorandumTipo ? fotoFirmaPersonal : undefined,

      // Auditoria
      procedimientosAuditados:
        tipoInforme !== 'REPORTE DE GESTIÓN TRIMESTRAL' && !isMemorandumTipo
          ? procedimientosAuditados
          : undefined,
      descripcionDetallada:
        tipoInforme !== 'REPORTE DE GESTIÓN TRIMESTRAL' && !isMemorandumTipo
          ? descripcionDetallada.trim()
          : undefined,
      hallazgos:
        tipoInforme !== 'REPORTE DE GESTIÓN TRIMESTRAL' && !isMemorandumTipo
          ? hallazgos.trim()
          : undefined,
      conclusionesRecomendaciones: conclusionesRecomendaciones.trim() || undefined,
      fechaAuditoria:
        tipoInforme !== 'REPORTE DE GESTIÓN TRIMESTRAL' && !isMemorandumTipo
          ? fechaAuditoria
          : undefined,
      archivosAuditoria:
        tipoInforme !== 'REPORTE DE GESTIÓN TRIMESTRAL' && !isMemorandumTipo
          ? archivosAuditoria
          : undefined,

      creadoPor: currentUser.email,
      fechaRegistro: initialData?.fechaRegistro || new Date().toISOString(),
    };

    onSaveInforme(nuevoInforme);
    setSuccessMsg('¡Informe de gestión registrado exitosamente en el sistema de control municipal!');

    if (!initialData) {
      setNombresApellidos('');
      setCedula('');
      setTelefono('');
      setNumeroResolucion('');
      setFechaResolucion('');
      setDescripcionBreve('');
      setAdjuntoInformeTrimestral([]);
      setPunto1('');
      setPunto2('');
      setPuntosAdicionales([]);
      setFotoFirmaPersonal([]);
      setMetasFisicasProgramadas('');
      setMetasFisicasEjecutadas('');
      setProcedimientosAuditados([]);
      setDescripcionDetallada('');
      setHallazgos('');
      setConclusionesRecomendaciones('');
      setArchivosAuditoria([]);
    }

    setTimeout(() => {
      setSuccessMsg(null);
    }, 4500);
  };

  const handleClearFullForm = () => {
    setSelectedDependenciaNombre('');
    setSelectedCargo('');
    setSelectedFuncionarioId('');
    setNombresApellidos('');
    setCedula('');
    setTelefono('');
    setNumeroResolucion('');
    setFechaResolucion('');
    setAutoFilledInfo(null);
    setDescripcionBreve('');
    setAdjuntoInformeTrimestral([]);
    setPunto1('');
    setPunto2('');
    setPuntosAdicionales([]);
    setFotoFirmaPersonal([]);
    setMetasFisicasProgramadas('');
    setMetasFisicasEjecutadas('');
    setProcedimientosAuditados([]);
    setDescripcionDetallada('');
    setHallazgos('');
    setConclusionesRecomendaciones('');
    setArchivosAuditoria([]);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const hasLoadedData = Boolean(
    nombresApellidos ||
    cedula ||
    telefono ||
    numeroResolucion ||
    descripcionBreve ||
    punto1 ||
    punto2 ||
    metasFisicasProgramadas ||
    metasFisicasEjecutadas ||
    descripcionDetallada ||
    hallazgos ||
    conclusionesRecomendaciones ||
    adjuntoInformeTrimestral.length > 0 ||
    fotoFirmaPersonal.length > 0 ||
    archivosAuditoria.length > 0
  );

  return (
    <div className="max-w-4xl mx-auto py-4 sm:py-6 px-3 sm:px-6">
      {/* Header card with soft metallic colors (no logo) */}
      <div className="bg-gradient-to-r from-slate-800 via-zinc-800 to-slate-800 text-white p-4 sm:p-6 rounded-2xl shadow-xs border border-slate-700/60 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300">
            Control de Gestión Municipal
          </span>
          <h2 className="font-institutional text-xl sm:text-2xl font-bold tracking-wide mt-0.5 text-white">
            {initialData ? 'Modificar Informe de Dependencia' : 'Registrar Informe de Dependencia'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300">
            Dirección General • Alcaldía del Municipio Autónomo Tinaquillo
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onViewList && (
            <button
              type="button"
              onClick={onViewList}
              className="text-xs px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-xs transition cursor-pointer flex items-center gap-1.5 hover:scale-[1.02] active:scale-[0.98]"
              title="Ver listado completo de informes registrados en tiempo real"
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>Ver Informes Registrados {informesCount !== undefined ? `(${informesCount})` : ''}</span>
            </button>
          )}
          {initialData && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-semibold transition cursor-pointer"
            >
              Volver a Lista
            </button>
          )}
        </div>
      </div>

      {/* Success Alert */}
      {successMsg && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-semibold">{successMsg}</span>
          </div>
          {onViewList && (
            <button
              type="button"
              onClick={onViewList}
              className="self-start sm:self-auto text-xs px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition cursor-pointer shrink-0 shadow-xs"
            >
              Ver en la Lista →
            </button>
          )}
        </div>
      )}

      {/* Error Alert */}
      {errorMsg && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-sm flex items-center gap-3 animate-shake">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <span className="font-semibold">{errorMsg}</span>
        </div>
      )}

      {/* Form Container */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-8 space-y-7">
        {/* SECTION 1: DEPENDENCIA & CARGO SELECTION */}
        <div className="border-b border-slate-200 pb-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-700 text-white font-bold text-xs flex items-center justify-center">
                1
              </span>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Dependencia e Identificación del Funcionario
              </h3>
            </div>
            {currentUser.email === 'sistemasdegestion26@gmail.com' && onOpenFuncionariosModal && (
              <button
                type="button"
                onClick={onOpenFuncionariosModal}
                className="text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-100 font-semibold px-2.5 py-1.5 rounded-lg border border-slate-300 transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                title="Abrir Directorio Oficial de Funcionarios"
              >
                <Users className="w-3.5 h-3.5 text-slate-600" />
                <span>Directorio Oficial de Funcionarios</span>
              </button>
            )}
          </div>

          {/* BANNER DE SINCRONIZACIÓN Y ESTADO DEL FUNCIONARIO */}
          {nombresApellidos ? (
            <div className="p-3 bg-emerald-50/90 border border-emerald-200 rounded-xl flex items-center justify-between gap-3 text-xs text-emerald-950">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Funcionario oficial asignado: <strong className="font-bold text-emerald-900">{nombresApellidos}</strong> {cedula ? `(C.I. ${cedula})` : ''} • Sincronizado en tiempo real
                </span>
              </div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100/90 text-emerald-800 text-[10px] font-bold uppercase tracking-wider shrink-0 border border-emerald-200">
                <Lock className="w-3 h-3" /> Solo Lectura
              </span>
            </div>
          ) : (
            <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-amber-900">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  No hay funcionario registrado en el Directorio Oficial para esta dependencia. Los datos deben ser cargados en el Directorio de Funcionarios por el Usuario Principal.
                </span>
              </div>
              {currentUser.email === 'sistemasdegestion26@gmail.com' && onOpenFuncionariosModal && (
                <button
                  type="button"
                  onClick={onOpenFuncionariosModal}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition shrink-0 cursor-pointer shadow-xs"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Registrar en Directorio</span>
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* DESPLEGABLE 1: CLASIFICACIÓN (CENTRALIZADA, EMPRESA, INSTITUTO) */}
            <div className="md:col-span-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Clasificación de la Dependencia <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedClasificacion}
                onChange={(e) => {
                  const nuevaClasif = e.target.value as ClasificacionDependencia;
                  setSelectedClasificacion(nuevaClasif);
                  setSelectedDependenciaNombre('');
                  setSelectedFuncionarioId('');
                }}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white"
              >
                <option value="CENTRALIZADA">Centralizada (Direcciones)</option>
                <option value="EMPRESA">Empresa (Empresas Públicas Municipales)</option>
                <option value="INSTITUTO">Instituto (Institutos Autónomos y Descentralizados)</option>
              </select>
            </div>

            {/* DESPLEGABLE 2: LISTA DE DEPENDENCIAS FILTRADAS POR CLASIFICACIÓN */}
            <div className="md:col-span-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Dependencia o Ente Adscrito <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedDependenciaNombre}
                onChange={handleDependenciaChange}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white"
              >
                <option value="">-- Seleccione una Dependencia Municipal --</option>
                {dependenciasFiltradas.map((dep) => (
                  <option key={dep.id} value={dep.nombre}>
                    {dep.nombre}
                  </option>
                ))}
              </select>
            </div>

            {/* SI HAY MÁS DE 1 FUNCIONARIO REGISTRADO OFICIALMENTE EN ESTA DEPENDENCIA */}
            {funcionariosDeLaDependencia.length > 1 && (
              <div className="md:col-span-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Seleccionar Funcionario Oficial Registrado ({funcionariosDeLaDependencia.length} disponibles en Directorio)
                </label>
                <select
                  value={selectedFuncionarioId}
                  onChange={(e) => handleFuncionarioChange(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                >
                  {funcionariosDeLaDependencia.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nombresApellidos} — {f.cargo || 'TITULAR'} (C.I. {f.cedula})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* CARGO OFICIAL DEL FUNCIONARIO - CASILLA DESPLEGABLE */}
            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Cargo Oficial del Funcionario / Directivo <span className="text-rose-500">*</span>
                </label>
                {selectedCargo && (
                  <span className="text-[10px] font-bold text-emerald-700 uppercase flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Cargo Seleccionado
                  </span>
                )}
              </div>
              {activeDependenciaConfig?.cargos && activeDependenciaConfig.cargos.length > 0 ? (
                <div className="space-y-1.5">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <Briefcase className="w-4 h-4" />
                    </div>
                    <select
                      value={
                        isCustomCargo
                          ? 'OTRO, ESPECIFIQUE'
                          : activeDependenciaConfig.cargos.includes(selectedCargo)
                          ? selectedCargo
                          : selectedCargo
                          ? 'OTRO, ESPECIFIQUE'
                          : ''
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'OTRO, ESPECIFIQUE' || val === 'OTRO') {
                          setIsCustomCargo(true);
                          setSelectedCargo('');
                        } else {
                          setIsCustomCargo(false);
                          handleCargoSelect(val);
                        }
                      }}
                      className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 shadow-2xs"
                    >
                      <option value="">-- Seleccione el Cargo de la Casilla Desplegable --</option>
                      {activeDependenciaConfig.cargos.map((cargoItem) => (
                        <option key={cargoItem} value={cargoItem}>
                          {cargoItem}
                        </option>
                      ))}
                      {!activeDependenciaConfig.cargos.includes('OTRO, ESPECIFIQUE') &&
                        !activeDependenciaConfig.cargos.includes('OTRO') && (
                          <option value="OTRO, ESPECIFIQUE">OTRO, ESPECIFIQUE</option>
                        )}
                    </select>
                  </div>
                  {(isCustomCargo || (selectedCargo && !activeDependenciaConfig.cargos.filter((c) => c !== 'OTRO, ESPECIFIQUE' && c !== 'OTRO').includes(selectedCargo))) && (
                    <input
                      type="text"
                      required
                      value={selectedCargo}
                      onChange={(e) => setSelectedCargo(e.target.value)}
                      placeholder="Especifique el cargo correspondiente..."
                      className="w-full px-3.5 py-2.5 bg-white border border-amber-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                    />
                  )}
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Briefcase className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={selectedCargo}
                    onChange={(e) => setSelectedCargo(e.target.value)}
                    placeholder="Especifique el cargo oficial"
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 placeholder:text-slate-400"
                  />
                </div>
              )}
            </div>

            {/* NOMBRES Y APELLIDOS */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Nombres y Apellidos del Funcionario <span className="text-rose-500">*</span>
                </label>
                {autoFilledInfo && (
                  <span className="text-[10px] font-bold text-emerald-700 uppercase flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Vinculado a Directorio
                  </span>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={nombresApellidos}
                  onChange={(e) => setNombresApellidos(e.target.value)}
                  readOnly={Boolean(autoFilledInfo && selectedFuncionarioId)}
                  placeholder="Ingrese Nombres y Apellidos del funcionario"
                  className={`w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 ${
                    autoFilledInfo && selectedFuncionarioId ? 'bg-slate-100 cursor-not-allowed select-none' : 'bg-white'
                  }`}
                />
              </div>
            </div>

            {/* CEDULA */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Cédula del Funcionario <span className="text-rose-500">*</span>
                </label>
                {autoFilledInfo && (
                  <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" /> No editable
                  </span>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <CreditCard className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={cedula}
                  onChange={(e) => setCedula(e.target.value)}
                  readOnly={Boolean(autoFilledInfo && selectedFuncionarioId)}
                  placeholder="Ej. V-12.345.678"
                  className={`w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 ${
                    autoFilledInfo && selectedFuncionarioId ? 'bg-slate-100 cursor-not-allowed select-none' : 'bg-white'
                  }`}
                />
              </div>
            </div>

            {/* TELÉFONO */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Teléfono de Contacto
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Phone className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="Ej. 0412-1234567"
                  className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
            </div>

            {/* RESOLUCIÓN - SOLO LECTURA */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Número de Resolución Oficial
                </label>
                <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" /> No editable
                </span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <FileText className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  readOnly
                  value={numeroResolucion}
                  placeholder={numeroResolucion ? '' : 'Sin resolución registrada'}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-100 border border-slate-300 rounded-xl text-sm font-mono font-semibold text-slate-800 cursor-not-allowed select-none focus:outline-none placeholder:text-slate-400 placeholder:font-normal"
                />
              </div>
            </div>

            {/* FECHA RESOLUCIÓN - SOLO LECTURA */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Fecha de Resolución Oficial
                </label>
                <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" /> No editable
                </span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Calendar className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={fechaResolucion}
                  placeholder={fechaResolucion ? '' : 'Sin fecha asignada'}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-100 border border-slate-300 rounded-xl text-sm font-mono font-semibold text-slate-800 cursor-not-allowed select-none focus:outline-none placeholder:text-slate-400 placeholder:font-normal"
                />
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: TIPO DE INFORME */}
        <div className="border-b border-slate-200 pb-6 space-y-5">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-emerald-700 text-white font-bold text-xs flex items-center justify-center">
              2
            </span>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
              Tipo de Informe Municipal
            </h3>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Seleccione el Tipo de Informe <span className="text-rose-500">*</span>
            </label>
            <select
              value={tipoInforme}
              onChange={(e) => setTipoInforme(e.target.value as TipoInforme)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-sky-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white"
            >
              {TIPOS_INFORME_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* SECTION 3A: REPORTE DE GESTIÓN TRIMESTRAL (Requirement 14) */}
        {tipoInforme === 'REPORTE DE GESTIÓN TRIMESTRAL' && (
          <div className="space-y-5 animate-fade-in">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-sky-700 text-white font-bold text-xs flex items-center justify-center">
                3
              </span>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Contenido del Reporte de Gestión Trimestral
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Trimestre Evaluado
                </label>
                <select
                  value={trimestre}
                  onChange={(e) => setTrimestre(e.target.value as any)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-600"
                >
                  <option value="I TRIMESTRE">I TRIMESTRE (Enero - Marzo)</option>
                  <option value="II TRIMESTRE">II TRIMESTRE (Abril - Junio)</option>
                  <option value="III TRIMESTRE">III TRIMESTRE (Julio - Septiembre)</option>
                  <option value="IV TRIMESTRE">IV TRIMESTRE (Octubre - Diciembre)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Año de Gestión
                </label>
                <input
                  type="text"
                  value={anioGestion}
                  onChange={(e) => setAnioGestion(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-600"
                />
              </div>
            </div>

            {/* ADJUNTAR INFORME DIGITAL (Única opción requerida para Reporte Trimestral) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Adjuntar Informe (Documento Digital, PDF, Word, Excel o Evidencias) <span className="text-rose-500">*</span>
                </label>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  {adjuntoInformeTrimestral.length} Archivo(s)
                </span>
              </div>

              <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-5 text-center bg-slate-50/50 hover:bg-emerald-50/30 transition">
                <input
                  type="file"
                  id="adjunto-informe-trimestral"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,image/*"
                  onChange={handleAdjuntoTrimestralUpload}
                  className="hidden"
                />
                <label
                  htmlFor="adjunto-informe-trimestral"
                  className="cursor-pointer flex flex-col items-center justify-center gap-1.5"
                >
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Upload className="w-5 h-5" />
                  </div>
                  <span className="text-xs sm:text-sm font-bold text-emerald-700 hover:underline">
                    Seleccionar Archivo para Adjuntar Informe
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Formatos permitidos: PDF, Word (DOC/DOCX), Excel (XLS/XLSX) o Imágenes (JPG, PNG). Máx. 10MB por archivo.
                  </p>
                </label>
              </div>

              {adjuntoInformeTrimestral.length > 0 && (
                <div className="mt-3 space-y-2">
                  {adjuntoInformeTrimestral.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Paperclip className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="text-xs font-medium text-slate-800 truncate">
                          {doc.name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono shrink-0">
                          ({(doc.size / 1024).toFixed(0)} KB)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setAdjuntoInformeTrimestral(
                            adjuntoInformeTrimestral.filter((d) => d.id !== doc.id)
                          )
                        }
                        className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                        title="Eliminar archivo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* SECTION 3B: REGISTRO DE COMUNICACIÓN INTERNA DE DIRECTORIO / MEMORANDUM INTERNO */}
        {(tipoInforme === 'MEMORANDUM INTERNO' ||
          tipoInforme === 'REGISTRO DE COMUNICACIÓN INTERNA DE DIRECTORIO') && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-sky-700 text-white font-bold text-xs flex items-center justify-center">
                3
              </span>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Contenido del Registro de Comunicación Interna de Directorio
              </h3>
            </div>

            {/* CASILLA: PUNTO 1 */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Punto 1 <span className="text-rose-500">*</span></span>
                <span className="text-[10px] text-sky-700 font-semibold">Descripción o planteamiento inicial</span>
              </label>
              <textarea
                rows={3}
                required
                value={punto1}
                onChange={(e) => setPunto1(e.target.value)}
                placeholder="Describa de manera detallada el Punto 1 del registro de comunicación interna..."
                className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-sky-600 focus:bg-white"
              />
            </div>

            {/* CASILLA: PUNTO 2 */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Punto 2 <span className="text-rose-500">*</span></span>
                <span className="text-[10px] text-sky-700 font-semibold">Segundo aspecto o instrucción</span>
              </label>
              <textarea
                rows={3}
                required
                value={punto2}
                onChange={(e) => setPunto2(e.target.value)}
                placeholder="Describa de manera detallada el Punto 2 del registro de comunicación interna..."
                className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-sky-600 focus:bg-white"
              />
            </div>

            {/* SESIÓN ESPECIAL PARA AGREGAR UNO O MÁS PUNTOS SI LO AMERITA */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wide text-slate-800">
                    Sesión Especial: Puntos Adicionales
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Agregue uno o más puntos si el registro de comunicación interna de directorio así lo amerita.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddPuntoAdicional}
                  className="px-3 py-1.5 bg-sky-700 hover:bg-sky-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Agregar Punto
                </button>
              </div>

              {puntosAdicionales.length === 0 ? (
                <div className="text-center py-4 text-xs text-slate-400 border border-dashed border-slate-300 rounded-lg">
                  No se han agregado puntos adicionales. Presione "+ Agregar Punto" si requiere incluir más puntos.
                </div>
              ) : (
                <div className="space-y-3 pt-1">
                  {puntosAdicionales.map((pto, idx) => (
                    <div key={idx} className="space-y-1 bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 uppercase">
                          Punto {idx + 3} (Adicional)
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemovePuntoAdicional(idx)}
                          className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          Eliminar
                        </button>
                      </div>
                      <textarea
                        rows={2}
                        value={pto}
                        onChange={(e) => handlePuntoAdicionalChange(idx, e.target.value)}
                        placeholder={`Describa el contenido del Punto ${idx + 3}...`}
                        className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs sm:text-sm text-slate-900 focus:ring-2 focus:ring-sky-600 focus:bg-white"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ADJUNTAR FOTO DE LA LISTA DE LA FIRMA DEL PERSONAL */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Foto de la Lista de la Firma del Personal (Evidencia de Notificación)
                </label>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  {fotoFirmaPersonal.length} Archivo(s)
                </span>
              </div>

              <div className="border-2 border-dashed border-slate-300 hover:border-sky-500 rounded-2xl p-5 text-center bg-slate-50/50 hover:bg-sky-50/30 transition">
                <input
                  type="file"
                  id="foto-firma-personal"
                  multiple
                  accept="image/*,.pdf"
                  onChange={handleFotoFirmaPersonalUpload}
                  className="hidden"
                />
                <label
                  htmlFor="foto-firma-personal"
                  className="cursor-pointer flex flex-col items-center justify-center gap-1.5"
                >
                  <div className="w-10 h-10 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center">
                    <Upload className="w-5 h-5" />
                  </div>
                  <span className="text-xs sm:text-sm font-bold text-sky-700 hover:underline">
                    Adjuntar Foto de la Lista de Firma del Personal
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Fotografía o escaneo de la hoja con las firmas del personal (JPG, PNG o PDF)
                  </p>
                </label>
              </div>

              {fotoFirmaPersonal.length > 0 && (
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {fotoFirmaPersonal.map((foto) => (
                    <div
                      key={foto.id}
                      className="relative group rounded-xl border border-slate-200 bg-white p-1.5 shadow-xs overflow-hidden"
                    >
                      <div className="w-full h-24 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center">
                        {foto.type === 'pdf' ? (
                          <div className="flex flex-col items-center justify-center text-slate-500">
                            <FileText className="w-8 h-8 text-rose-500" />
                            <span className="text-[10px] font-bold mt-1">PDF</span>
                          </div>
                        ) : (
                          <img
                            src={foto.dataUrl}
                            alt={foto.name}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      <p className="text-[10px] text-slate-700 truncate mt-1 px-1">
                        {foto.name}
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          setFotoFirmaPersonal(fotoFirmaPersonal.filter((f) => f.id !== foto.id))
                        }
                        className="absolute top-2 right-2 p-1 bg-rose-600 hover:bg-rose-700 text-white rounded shadow-xs opacity-90 group-hover:opacity-100 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* SECTION 3B: AUDITORÍA OPERATIVA (PARCIAL O DEFINITIVO) */}
        {(tipoInforme === 'INFORME PARCIAL DE AUDITORIA' ||
          tipoInforme === 'INFORME PARCIAL DE LA AUDITORIA OPERATIVA DE LA CONTRALORÍA MUNICIPAL' ||
          tipoInforme === 'INFORME DE AUDITORÍA DEFINITIVO') && (
          <div className="space-y-5 animate-fade-in">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-sky-700 text-white font-bold text-xs flex items-center justify-center">
                3
              </span>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Procedimientos Auditados y Hallazgos
              </h3>
            </div>

            {/* SELECCIÓN SIMPLE / MÚLTIPLE: 1. PROCEDIMIENTOS ADMINISTRATIVOS, ETC. */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
                Procedimientos Auditados (Seleccione uno o varios) <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {PROCEDIMIENTOS_AUDITORIA.map((proc) => {
                  const isChecked = procedimientosAuditados.includes(proc);
                  return (
                    <label
                      key={proc}
                      className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-xs font-semibold cursor-pointer transition ${
                        isChecked
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-950 shadow-xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleProcedimiento(proc)}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>{proc}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* DESCRIPCIÓN DETALLADA */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Descripción Detallada <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                required
                value={descripcionDetallada}
                onChange={(e) => setDescripcionDetallada(e.target.value)}
                placeholder="Alcance del procedimiento, expedientes analizados, periodo fiscal auditado y marco metodológico..."
                className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            {/* HALLAZGOS */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Hallazgos u Observaciones Relevantes <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                required
                value={hallazgos}
                onChange={(e) => setHallazgos(e.target.value)}
                placeholder="Describa las evidencias, observaciones, debilidades de control interno o conformidades encontradas..."
                className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            {/* CONCLUSIONES / RECOMENDACIONES */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Conclusiones y Recomendaciones
              </label>
              <textarea
                rows={2}
                value={conclusionesRecomendaciones}
                onChange={(e) => setConclusionesRecomendaciones(e.target.value)}
                placeholder="Acciones correctivas recomendadas a la dependencia para solventar las observaciones..."
                className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            {/* FECHA EN FORMATO CALENDARIO EN ESPAÑOL */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Fecha del Informe de Auditoría (Calendario) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Calendar className="w-4 h-4" />
                </div>
                <input
                  type="date"
                  required
                  value={fechaAuditoria}
                  onChange={(e) => setFechaAuditoria(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-emerald-600"
                />
              </div>
            </div>

            {/* ADJUNTAR FOTOS, IMÁGENES Y ARCHIVO WORD, EXCEL O PDF */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Adjuntar Fotos, Imágenes y Archivos (Word, Excel o PDF)
                </label>
                <span className="text-xs text-slate-500">
                  {archivosAuditoria.length} archivos anexados
                </span>
              </div>

              <div className="border-2 border-dashed border-slate-300 hover:border-sky-500 rounded-2xl p-5 text-center bg-slate-50/50 hover:bg-sky-50/30 transition">
                <input
                  type="file"
                  id="auditoria-files"
                  multiple
                  accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv"
                  onChange={handleAuditoriaFilesUpload}
                  className="hidden"
                />
                <label
                  htmlFor="auditoria-files"
                  className="cursor-pointer flex flex-col items-center justify-center gap-1.5"
                >
                  <div className="w-10 h-10 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center">
                    <Upload className="w-5 h-5" />
                  </div>
                  <span className="text-xs sm:text-sm font-bold text-sky-700 hover:underline">
                    Seleccionar Archivos de Respaldo de Auditoría
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Admite Fotos, Informes Word (.docx), Hojas de Cálculo Excel (.xlsx) y Documentos PDF
                  </p>
                </label>
              </div>

              {archivosAuditoria.length > 0 && (
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {archivosAuditoria.map((file) => (
                    <div
                      key={file.id}
                      className="relative group rounded-xl border border-slate-200 bg-white p-2.5 flex flex-col items-center text-center shadow-xs overflow-hidden"
                    >
                      {file.type === 'pdf' ? (
                        <FileText className="w-9 h-9 text-rose-600 mb-1" />
                      ) : file.type === 'excel' ? (
                        <FileSpreadsheet className="w-9 h-9 text-emerald-600 mb-1" />
                      ) : file.type === 'image' ? (
                        <div className="w-full h-16 rounded overflow-hidden mb-1">
                          <img
                            src={file.dataUrl}
                            alt={file.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <FileText className="w-9 h-9 text-sky-600 mb-1" />
                      )}

                      <p className="text-[10px] font-semibold text-slate-700 truncate w-full">
                        {file.name}
                      </p>

                      <button
                        type="button"
                        onClick={() =>
                          setArchivosAuditoria(archivosAuditoria.filter((f) => f.id !== file.id))
                        }
                        className="absolute top-1 right-1 p-1 bg-rose-600 hover:bg-rose-700 text-white rounded shadow-xs opacity-90 group-hover:opacity-100 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Submit Actions */}
        <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            {hasLoadedData && (
              <button
                type="button"
                onClick={handleClearFullForm}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-sm font-semibold transition cursor-pointer flex items-center justify-center gap-1.5"
                title="Borrar todos los datos cargados del formulario"
              >
                <Eraser className="w-4 h-4 text-rose-500" />
                <span>Borrar Datos Cargados</span>
              </button>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            {initialData && onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
            )}

            <button
              type="submit"
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-700 to-sky-800 hover:from-emerald-800 hover:to-sky-900 text-white text-sm font-bold shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <CheckCircle className="w-4 h-4" />
              <span>{initialData ? 'Guardar Cambios' : 'Registrar Informe'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
