import React, { useState } from 'react';
import {
  ClipboardList,
  Upload,
  FileText,
  Image as ImageIcon,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Calendar,
  Phone,
  User,
  CreditCard,
  Building,
  HelpCircle,
  Briefcase,
  Eraser,
} from 'lucide-react';
import {
  Solicitud,
  TipoSolicitud,
  EstadoSolicitud,
  FileAttachment,
  AppUser,
  AreaComunal,
} from '../types';
import { TELEFONO_PREFIJOS, TIPOS_SOLICITUD, ESTADOS_SOLICITUD, AREAS_COMUNALES } from '../data/dependenciasData';

import { validateFileSecurity, compressAndSanitizeImage } from '../utils/security';

interface SolicitudesFormProps {
  currentUser: AppUser;
  onSaveSolicitud: (solicitud: Solicitud) => void;
  onCancel?: () => void;
  initialData?: Solicitud | null;
}

export const SolicitudesForm: React.FC<SolicitudesFormProps> = ({
  currentUser,
  onSaveSolicitud,
  onCancel,
  initialData,
}) => {
  const [nombresApellidos, setNombresApellidos] = useState(initialData?.nombresApellidos || '');
  const [cedulaPrefijo, setCedulaPrefijo] = useState(
    initialData?.cedula?.startsWith('E-') ? 'E-' : initialData?.cedula?.startsWith('J-') ? 'J-' : 'V-'
  );
  const [cedulaNumero, setCedulaNumero] = useState(
    initialData?.cedula ? initialData.cedula.replace(/^[VEJ]-/, '').replace(/\./g, '') : ''
  );

  const [telefonoPrefijo, setTelefonoPrefijo] = useState(
    initialData?.telefonoPrefijo || '0414'
  );
  const [telefonoNumero, setTelefonoNumero] = useState(initialData?.telefonoNumero || '');
  const [profesionOficio, setProfesionOficio] = useState(initialData?.profesionOficio || '');

  const [tipoSolicitud, setTipoSolicitud] = useState<TipoSolicitud>(
    initialData?.tipoSolicitud || 'ECONÓMICA'
  );

  // Gestión Comunal specific state
  const [areaComunal, setAreaComunal] = useState<AreaComunal>(
    initialData?.areaComunal || 'ÁREA 1'
  );
  const [sector, setSector] = useState(initialData?.sector || '');
  const [nombreComunidad, setNombreComunidad] = useState(initialData?.nombreComunidad || '');
  const [planteamientoDescripcion, setPlanteamientoDescripcion] = useState(
    initialData?.planteamientoDescripcion || ''
  );
  const [observacionesReferencia, setObservacionesReferencia] = useState(
    initialData?.observacionesReferencia || ''
  );
  const [resolucionComunal, setResolucionComunal] = useState(
    initialData?.resolucionComunal || ''
  );

  const [fechaSolicitud, setFechaSolicitud] = useState(
    initialData?.fechaSolicitud || new Date().toISOString().split('T')[0]
  );

  const [observaciones, setObservaciones] = useState(initialData?.observaciones || '');

  const [estadoRemision, setEstadoRemision] = useState<EstadoSolicitud>(
    initialData?.estadoRemision || 'ATENDIDO'
  );

  const [otroRemitirEspecifique, setOtroRemitirEspecifique] = useState(
    initialData?.otroRemitirEspecifique || ''
  );

  const [adjuntos, setAdjuntos] = useState<FileAttachment[]>(initialData?.adjuntos || []);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // File Upload Handler (1 to 5 images OR 1 PDF file)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments: FileAttachment[] = [...adjuntos];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Institutional security check
      const secCheck = validateFileSecurity(file);
      if (!secCheck.safe) {
        setErrorMsg(secCheck.reason || 'Archivo rechazado por seguridad.');
        continue;
      }

      // Check if trying to add PDF when images exist or vice versa
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const isImage = file.type.startsWith('image/');

      if (!isPdf && !isImage) {
        setErrorMsg('Formato no permitido. Solo puede adjuntar de 1 a 5 imágenes (JPG, PNG) o un archivo PDF.');
        continue;
      }

      if (isPdf) {
        if (newAttachments.length > 0) {
          setErrorMsg('Solo se permite adjuntar un archivo PDF único o hasta 5 imágenes.');
          return;
        }
        // Read single PDF
        const reader = new FileReader();
        reader.onload = () => {
          setAdjuntos([
            {
              id: `pdf-${Date.now()}-${Math.random()}`,
              name: file.name,
              type: 'pdf',
              size: file.size,
              dataUrl: reader.result as string,
            },
          ]);
        };
        reader.readAsDataURL(file);
        return;
      }

      // If it's an image
      const hasPdfAlready = newAttachments.some((a) => a.type === 'pdf');
      if (hasPdfAlready) {
        setErrorMsg('No puede mezclar archivos PDF con imágenes. Elimine el PDF primero.');
        return;
      }

      if (newAttachments.length >= 5) {
        setErrorMsg('Límite alcanzado: Máximo 5 imágenes permitidas por solicitud.');
        break;
      }

      try {
        const compressed = await compressAndSanitizeImage(file, 1280, 1280, 0.82);
        newAttachments.push({
          id: `img-${Date.now()}-${Math.random()}`,
          name: compressed.name,
          type: 'image',
          size: compressed.size,
          dataUrl: compressed.dataUrl,
        });
        setAdjuntos([...newAttachments]);
      } catch (err) {
        setErrorMsg(`Error al procesar la imagen "${file.name}".`);
      }
    }
  };

  const removeAttachment = (id: string) => {
    setAdjuntos(adjuntos.filter((a) => a.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!nombresApellidos.trim()) {
      setErrorMsg('Debe ingresar los Nombres y Apellidos del solicitante.');
      return;
    }

    if (!cedulaNumero.trim()) {
      setErrorMsg('Debe ingresar el número de Cédula de Identidad.');
      return;
    }

    if (!telefonoNumero.trim() || telefonoNumero.trim().length < 7) {
      setErrorMsg('Debe ingresar un número de teléfono válido de 7 dígitos.');
      return;
    }

    if (tipoSolicitud === 'EMPLEO' && !profesionOficio.trim()) {
      setErrorMsg('Para registrar una solicitud de EMPLEO, debe ingresar la Profesión u Oficio del postulante.');
      return;
    }

    if (tipoSolicitud === 'GESTIÓN COMUNAL') {
      if (!sector.trim()) {
        setErrorMsg('Para registrar una solicitud de GESTIÓN COMUNAL, debe ingresar el Sector.');
        return;
      }
      if (!nombreComunidad.trim()) {
        setErrorMsg('Para registrar una solicitud de GESTIÓN COMUNAL, debe ingresar el Nombre de la Comunidad.');
        return;
      }
      if (!planteamientoDescripcion.trim()) {
        setErrorMsg('Para registrar una solicitud de GESTIÓN COMUNAL, debe ingresar el Planteamiento o Descripción.');
        return;
      }
    }

    if (estadoRemision === 'OTRO, ESPECIFIQUE' && !otroRemitirEspecifique.trim()) {
      setErrorMsg('Por favor especifique a qué dependencia u organismo se remite.');
      return;
    }

    // Format Cédula with thousands separators
    const numClean = cedulaNumero.replace(/\D/g, '');
    const cedulaFormateada = `${cedulaPrefijo}${numClean.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
    const telefonoCompleto = `${telefonoPrefijo}-${telefonoNumero.trim()}`;

    const nuevaSolicitud: Solicitud = {
      id: initialData?.id || `DG-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
      nombresApellidos: nombresApellidos.trim(),
      cedula: cedulaFormateada,
      profesionOficio: profesionOficio.trim(),
      telefonoPrefijo,
      telefonoNumero: telefonoNumero.trim(),
      telefonoCompleto,
      tipoSolicitud,
      fechaSolicitud,
      observaciones: observaciones.trim(),
      estadoRemision,
      otroRemitirEspecifique: estadoRemision === 'OTRO, ESPECIFIQUE' ? otroRemitirEspecifique.trim() : undefined,
      adjuntos,

      // Gestión Comunal specific fields
      areaComunal: tipoSolicitud === 'GESTIÓN COMUNAL' ? areaComunal : undefined,
      sector: tipoSolicitud === 'GESTIÓN COMUNAL' ? sector.trim() : undefined,
      nombreComunidad: tipoSolicitud === 'GESTIÓN COMUNAL' ? nombreComunidad.trim() : undefined,
      planteamientoDescripcion: tipoSolicitud === 'GESTIÓN COMUNAL' ? planteamientoDescripcion.trim() : undefined,
      observacionesReferencia: tipoSolicitud === 'GESTIÓN COMUNAL' ? observacionesReferencia.trim() : undefined,
      resolucionComunal: tipoSolicitud === 'GESTIÓN COMUNAL' ? resolucionComunal.trim() : undefined,

      creadoPor: currentUser.email,
      fechaRegistro: initialData?.fechaRegistro || new Date().toISOString(),
    };

    onSaveSolicitud(nuevaSolicitud);
    setSuccessMsg('¡Solicitud registrada satisfactoriamente en el sistema municipal!');

    if (!initialData) {
      // Reset form
      setNombresApellidos('');
      setCedulaNumero('');
      setTelefonoNumero('');
      setProfesionOficio('');
      setSector('');
      setNombreComunidad('');
      setPlanteamientoDescripcion('');
      setObservacionesReferencia('');
      setResolucionComunal('');
      setObservaciones('');
      setOtroRemitirEspecifique('');
      setAdjuntos([]);
    }

    setTimeout(() => {
      setSuccessMsg(null);
    }, 4000);
  };

  const handleClearForm = () => {
    setNombresApellidos('');
    setCedulaNumero('');
    setTelefonoNumero('');
    setProfesionOficio('');
    setSector('');
    setNombreComunidad('');
    setPlanteamientoDescripcion('');
    setObservacionesReferencia('');
    setResolucionComunal('');
    setObservaciones('');
    setOtroRemitirEspecifique('');
    setAdjuntos([]);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const hasLoadedData = Boolean(
    nombresApellidos ||
    cedulaNumero ||
    telefonoNumero ||
    profesionOficio ||
    sector ||
    nombreComunidad ||
    planteamientoDescripcion ||
    observaciones ||
    adjuntos.length > 0
  );

  return (
    <div className="max-w-4xl mx-auto py-4 sm:py-6 px-3 sm:px-6">
      {/* Header card with soft metallic colors (no logo) */}
      <div className="bg-gradient-to-r from-slate-800 via-zinc-800 to-slate-800 text-white p-4 sm:p-6 rounded-2xl shadow-xs border border-slate-700/60 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300">
            Módulo de Atención al Ciudadano
          </span>
          <h2 className="font-institutional text-xl sm:text-2xl font-bold tracking-wide mt-0.5 text-white">
            {initialData ? 'Modificar Solicitud Ciudadana' : 'Registrar Solicitud'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300">
            Dirección General • Alcaldía del Municipio Autónomo Tinaquillo
          </p>
        </div>

        <div className="flex items-center gap-2">
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
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-sm flex items-center gap-3 animate-fade-in">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-semibold">{successMsg}</span>
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
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* NOMBRES Y APELLIDOS */}
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Nombres y Apellidos <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                value={nombresApellidos}
                onChange={(e) => setNombresApellidos(e.target.value)}
                placeholder="Ej. Juan Carlos Morales Pérez"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white transition"
              />
            </div>
          </div>

          {/* CEDULA */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Cédula de Identidad <span className="text-rose-500">*</span>
            </label>
            <div className="flex gap-2">
              <select
                value={cedulaPrefijo}
                onChange={(e) => setCedulaPrefijo(e.target.value)}
                className="w-20 px-2 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                <option value="V-">V-</option>
                <option value="E-">E-</option>
                <option value="J-">J-</option>
              </select>
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <CreditCard className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={cedulaNumero}
                  onChange={(e) => setCedulaNumero(e.target.value.replace(/\D/g, ''))}
                  placeholder="14852369"
                  maxLength={9}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white transition"
                />
              </div>
            </div>
          </div>

          {/* TELÉFONO DESPLEGABLE CON INICIO EN: 0416, 0426, 0412, 0414, 0422, 0424, 0258 */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Teléfono de Contacto <span className="text-rose-500">*</span>
            </label>
            <div className="flex gap-2">
              <select
                value={telefonoPrefijo}
                onChange={(e) => setTelefonoPrefijo(e.target.value)}
                className="w-24 px-2.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                {TELEFONO_PREFIJOS.map((pref) => (
                  <option key={pref} value={pref}>
                    {pref}
                  </option>
                ))}
              </select>
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Phone className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={telefonoNumero}
                  onChange={(e) => setTelefonoNumero(e.target.value.replace(/\D/g, ''))}
                  placeholder="1234567"
                  maxLength={7}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white transition"
                />
              </div>
            </div>
          </div>

          {/* TIPO DE SOLICITUD */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Tipo de Solicitud <span className="text-rose-500">*</span>
            </label>
            <select
              value={tipoSolicitud}
              onChange={(e) => setTipoSolicitud(e.target.value as TipoSolicitud)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white"
            >
              {TIPOS_SOLICITUD.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {tipo}
                </option>
              ))}
            </select>
          </div>

          {/* FECHA DE SOLICITUD (FORMATO CALENDARIO EN ESPAÑOL) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Fecha de Solicitud (Calendario) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Calendar className="w-4 h-4" />
              </div>
              <input
                type="date"
                required
                value={fechaSolicitud}
                onChange={(e) => setFechaSolicitud(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white"
              />
            </div>
          </div>

          {/* CASILLA POSTERIOR PARA PROFESIÓN U OFICIO AL SELECCIONAR EMPLEO */}
          {tipoSolicitud === 'EMPLEO' && (
            <div className="md:col-span-2 p-4 bg-emerald-50/90 border-2 border-emerald-500 rounded-2xl shadow-xs animate-fadeIn">
              <label className="block text-xs font-bold text-emerald-950 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-emerald-700" />
                  <span>Profesión u Oficio del Postulante <span className="text-rose-500">*</span></span>
                </span>
                <span className="text-[10px] bg-emerald-200 text-emerald-900 px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider">
                  Postulación de Empleo
                </span>
              </label>
              <p className="text-[11px] text-emerald-800/90 mb-2">
                Indique la profesión, oficio, carrera técnica o perfil laboral del ciudadano para el registro institucional.
              </p>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-emerald-600">
                  <Briefcase className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={profesionOficio}
                  onChange={(e) => setProfesionOficio(e.target.value)}
                  placeholder="Ej. Docente, Ingeniero Agrónomo, Albañil, Chofer, Electricista, Enfermera, Asistente..."
                  className="w-full pl-10 pr-3 py-2.5 bg-white border border-emerald-400 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white shadow-xs"
                />
              </div>
            </div>
          )}

          {/* CAMPOS ESPECÍFICOS PARA GESTIÓN COMUNAL */}
          {tipoSolicitud === 'GESTIÓN COMUNAL' && (
            <div className="md:col-span-2 p-5 bg-slate-50 border-2 border-slate-400 rounded-2xl shadow-xs space-y-4 animate-fadeIn">
              <div className="border-b border-slate-200 pb-2 flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <Building className="w-4 h-4 text-slate-700" />
                  <span>Detalle de Gestión Comunal</span>
                </h4>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-slate-200 text-slate-800 uppercase">
                  Poder Popular y Comunas
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {/* Desplegable de Área (ÁREA 1 a ÁREA 7) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Área Territorial <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={areaComunal}
                    onChange={(e) => setAreaComunal(e.target.value as AreaComunal)}
                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-700"
                  >
                    {AREAS_COMUNALES.map((area) => (
                      <option key={area} value={area}>
                        {area}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Casilla Sector */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Sector <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={sector}
                    onChange={(e) => setSector(e.target.value)}
                    placeholder="Ej. Sector El Centro, San Isidro..."
                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-700"
                  />
                </div>

                {/* Casilla Nombre de la Comunidad */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Nombre de la Comunidad <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={nombreComunidad}
                    onChange={(e) => setNombreComunidad(e.target.value)}
                    placeholder="Ej. Comunidad Las Palmas, Buenos Aires..."
                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-700"
                  />
                </div>
              </div>

              {/* Planteamiento o Descripción */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Planteamiento o Descripción <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={planteamientoDescripcion}
                  onChange={(e) => setPlanteamientoDescripcion(e.target.value)}
                  placeholder="Detalle los requerimientos comunitarios, problemática, proyecto o solicitud presentada por la comunidad..."
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-700"
                />
              </div>

              {/* Observaciones y Referencia & Resolución */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Observaciones y Referencia
                  </label>
                  <textarea
                    rows={2}
                    value={observacionesReferencia}
                    onChange={(e) => setObservacionesReferencia(e.target.value)}
                    placeholder="Puntos de referencia de la comunidad, líderes comunitarios de contacto..."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Resolución
                  </label>
                  <textarea
                    rows={2}
                    value={resolucionComunal}
                    onChange={(e) => setResolucionComunal(e.target.value)}
                    placeholder="Resolución dictada, derivación técnica o plan de acción institucional..."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-700"
                  />
                </div>
              </div>
            </div>
          )}

          {/* DESPLEGABLE QUE CONTENGA: ATENDIDO, REMITIR A ADMINISTRACIÓN, ETC. */}
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Estado / Remisión Institucional <span className="text-rose-500">*</span>
            </label>
            <select
              value={estadoRemision}
              onChange={(e) => setEstadoRemision(e.target.value as EstadoSolicitud)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-sky-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white"
            >
              {ESTADOS_SOLICITUD.map((est) => (
                <option key={est} value={est}>
                  {est}
                </option>
              ))}
            </select>
          </div>

          {/* SI SELECCIONÓ OTRO, ESPECIFIQUE */}
          {estadoRemision === 'OTRO, ESPECIFIQUE' && (
            <div className="md:col-span-2 p-3.5 bg-amber-50/80 rounded-xl border border-amber-200">
              <label className="block text-xs font-bold text-amber-900 uppercase tracking-wider mb-1.5">
                Especifique Dependencia u Organismo Remitido <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={otroRemitirEspecifique}
                onChange={(e) => setOtroRemitirEspecifique(e.target.value)}
                placeholder="Indique el nombre de la institución o dependencia de destino"
                className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          )}

          {/* OBSERVACIONES / REFERENCIA */}
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Observaciones / Referencia
            </label>
            <textarea
              rows={3}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Detalles de la solicitud, dirección de residencia, informe médico de referencia o requerimientos especiales..."
              className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white transition"
            />
          </div>

          {/* ADJUNTAR DE 1 A 5 IMÁGENES O UN ARCHIVO PDF */}
          <div className="md:col-span-2">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Adjuntos (De 1 a 5 imágenes O un archivo PDF)
              </label>
              <span className="text-[11px] text-slate-500 font-medium">
                {adjuntos.length} {adjuntos.length === 1 ? 'adjunto' : 'adjuntos'}
              </span>
            </div>

            {/* Upload Zone */}
            <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-5 text-center bg-slate-50/50 hover:bg-emerald-50/30 transition">
              <input
                type="file"
                id="file-upload-solicitud"
                multiple
                accept="image/*,application/pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
              <label
                htmlFor="file-upload-solicitud"
                className="cursor-pointer flex flex-col items-center justify-center gap-2"
              >
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs sm:text-sm font-bold text-emerald-700 hover:underline">
                    Presione aquí para seleccionar archivos
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Permite de 1 a 5 fotos (JPG, PNG, WEBP) o un documento en PDF (recetas médicas, informes, cédula)
                  </p>
                </div>
              </label>
            </div>

            {/* Attachments Preview Grid */}
            {adjuntos.length > 0 && (
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {adjuntos.map((file) => (
                  <div
                    key={file.id}
                    className="relative group rounded-xl border border-slate-200 bg-white p-2 flex flex-col items-center justify-center text-center shadow-xs overflow-hidden"
                  >
                    {file.type === 'pdf' ? (
                      <div className="w-full h-20 bg-rose-50 rounded-lg flex flex-col items-center justify-center text-rose-600 p-2">
                        <FileText className="w-8 h-8 mb-1" />
                        <span className="text-[10px] font-bold uppercase truncate max-w-full">
                          Documento PDF
                        </span>
                      </div>
                    ) : (
                      <div className="w-full h-20 rounded-lg overflow-hidden bg-slate-100">
                        <img
                          src={file.dataUrl}
                          alt={file.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    <p className="text-[10px] font-medium text-slate-700 truncate w-full mt-1.5 px-1">
                      {file.name}
                    </p>

                    <button
                      type="button"
                      onClick={() => removeAttachment(file.id)}
                      className="absolute top-1 right-1 p-1 bg-rose-600 hover:bg-rose-700 text-white rounded-md shadow-xs opacity-90 group-hover:opacity-100 transition"
                      title="Eliminar adjunto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Submit Actions */}
        <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            {hasLoadedData && (
              <button
                type="button"
                onClick={handleClearForm}
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
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-sky-700 hover:from-emerald-700 hover:to-sky-800 text-white text-sm font-bold shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <CheckCircle className="w-4 h-4" />
              <span>{initialData ? 'Guardar Cambios' : 'Registrar Solicitud'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
