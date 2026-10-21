import React, { useState } from 'react';
import {
  Calendar,
  MapPin,
  Users,
  UserPlus,
  Trash2,
  Camera,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  FileDown,
  Search,
  Eye,
  Plus,
  FolderCheck,
  CalendarCheck,
} from 'lucide-react';
import {
  AppUser,
  TipoActividad,
  AsistenteActividad,
  RegistroAsistencia,
  FileAttachment,
} from '../types';
import { DEPENDENCIAS_MUNICIPALES } from '../data/dependenciasData';
import { formatFechaEspanol } from '../utils/storage';
import { validateFileSecurity, compressAndSanitizeImage } from '../utils/security';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

interface AsistenciasFormProps {
  currentUser: AppUser;
  asistencias: RegistroAsistencia[];
  onSaveAsistencia: (asistencia: RegistroAsistencia) => void;
  onDeleteAsistencia?: (id: string) => void;
}

const TIPOS_ACTIVIDADES: TipoActividad[] = [
  'FESTIVIDADES POPULARES',
  'EFEMÉRIDES',
  'EVENTOS',
  'MESAS DE TRABAJO',
  'DIRECTORIOS',
];

function getLabelNombre(tipo: TipoActividad): string {
  switch (tipo) {
    case 'FESTIVIDADES POPULARES':
      return 'Nombre de la Festividad Popular';
    case 'EFEMÉRIDES':
      return 'Nombre de la Efeméride';
    case 'EVENTOS':
      return 'Nombre del Evento';
    case 'MESAS DE TRABAJO':
      return 'Nombre de la Mesa de Trabajo';
    case 'DIRECTORIOS':
      return 'Nombre del Directorio';
    default:
      return 'Nombre de la Actividad';
  }
}

export const AsistenciasForm: React.FC<AsistenciasFormProps> = ({
  currentUser,
  asistencias,
  onSaveAsistencia,
  onDeleteAsistencia,
}) => {
  const [viewMode, setViewMode] = useState<'FORM' | 'HISTORIAL'>('FORM');

  // Form State
  const [tipoActividad, setTipoActividad] = useState<TipoActividad | ''>('');
  const [nombreActividad, setNombreActividad] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [lugar, setLugar] = useState('');

  // Attendees list
  const [asistentes, setAsistentes] = useState<AsistenteActividad[]>([
    { id: '1', nombresApellidos: '', cedula: '', telefono: '' },
  ]);

  // Single Photo Attachment
  const [foto, setFoto] = useState<FileAttachment | undefined>(undefined);

  // Status & Feedback
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Search in Historial
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAsistencia, setSelectedAsistencia] = useState<RegistroAsistencia | null>(null);

  const handleClearForm = () => {
    setTipoActividad('');
    setNombreActividad('');
    setFecha(new Date().toISOString().split('T')[0]);
    setLugar('');
    setAsistentes([{ id: '1', nombresApellidos: '', cedula: '', telefono: '' }]);
    setFoto(undefined);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const hasLoadedData = Boolean(
    tipoActividad ||
    nombreActividad ||
    lugar ||
    foto ||
    asistentes.some((a) => a.nombresApellidos || a.cedula || a.telefono)
  );

  // Check authorization - Reservado para Dirección General y Protocolo
  const isAuthorized =
    currentUser.role === 'PRIMARY_ADMIN' ||
    currentUser.role === 'PROTOCOLO_USER' ||
    currentUser.email.toLowerCase() === 'protocolo1' ||
    currentUser.email.toLowerCase() === 'protocolo1@gmail.com' ||
    currentUser.email.toLowerCase() === 'dg.municipiotianquillo@gmail.com' ||
    currentUser.email.toLowerCase() === 'dg.municipiotinaquillo@gmail.com' ||
    currentUser.email.toLowerCase() === 'sistemasdegestion26@gmail.com';

  if (!isAuthorized) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4 text-center">
        <div className="p-8 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">Acceso Reservado</h2>
          <p className="text-sm text-slate-600">
            El Módulo de Registro de Actividades está reservado para la Dirección General y el usuario de Protocolo (<code>Protocolo1</code>).
          </p>
        </div>
      </div>
    );
  }

  // Handle Photo upload (1 single photo) with security checks and safe compression
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const secCheck = validateFileSecurity(file);
    if (!secCheck.safe) {
      setErrorMsg(secCheck.reason || 'Formato no permitido por seguridad.');
      return;
    }

    if (!file.type.startsWith('image/')) {
      setErrorMsg('El archivo adjunto debe ser una imagen válida (JPG, PNG o WEBP).');
      return;
    }

    try {
      const comp = await compressAndSanitizeImage(file, 1280, 1280, 0.82);
      setFoto({
        id: 'foto-' + Date.now(),
        name: comp.name,
        type: 'image',
        size: comp.size,
        dataUrl: comp.dataUrl,
      });
      setErrorMsg(null);
    } catch (err) {
      setErrorMsg('Error al procesar y optimizar la fotografía.');
    }
  };

  // Add Attendee
  const handleAddAsistente = () => {
    setAsistentes([
      ...asistentes,
      {
        id: String(Date.now() + Math.random()),
        nombresApellidos: '',
        cedula: '',
        telefono: '',
        dependencia: '',
        clasificacion: undefined,
        cargo: '',
      },
    ]);
  };

  // Update Attendee
  const handleUpdateAsistente = (
    id: string,
    field: keyof Omit<AsistenteActividad, 'id'>,
    val: string
  ) => {
    setAsistentes(
      asistentes.map((a) => {
        if (a.id !== id) return a;
        if (field === 'dependencia') {
          const matchDep = DEPENDENCIAS_MUNICIPALES.find((d) => d.nombre === val);
          return {
            ...a,
            dependencia: val,
            clasificacion: matchDep ? matchDep.tipo : undefined,
            cargo: matchDep?.cargos && matchDep.cargos.length > 0 && !a.cargo ? matchDep.cargos[0] : a.cargo,
          };
        }
        return { ...a, [field]: val };
      })
    );
  };

  // Remove Attendee
  const handleRemoveAsistente = (id: string) => {
    if (asistentes.length <= 1) {
      setErrorMsg('Debe registrar al menos un asistente para la actividad.');
      return;
    }
    setAsistentes(asistentes.filter((a) => a.id !== id));
  };

  // Submit Form
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!tipoActividad) {
      setErrorMsg('Por favor seleccione el tipo de actividad del menú desplegable.');
      return;
    }

    if (!nombreActividad.trim()) {
      setErrorMsg(`Por favor indique el ${getLabelNombre(tipoActividad)}.`);
      return;
    }

    if (!fecha) {
      setErrorMsg('Por favor seleccione la fecha de la actividad.');
      return;
    }

    if (!lugar.trim()) {
      setErrorMsg('Por favor indique el lugar de la actividad.');
      return;
    }

    // Validate attendees
    const validAsistentes = asistentes.filter(
      (a) => a.nombresApellidos.trim() && a.cedula.trim()
    );

    if (validAsistentes.length === 0) {
      setErrorMsg('Debe registrar por lo menos un asistente con Nombres, Apellidos y Cédula.');
      return;
    }

    const nuevoRegistro: RegistroAsistencia = {
      id: `ACT-${Date.now().toString().slice(-6)}`,
      tipoActividad,
      nombreActividad: nombreActividad.trim(),
      fecha,
      lugar: lugar.trim(),
      asistentes: validAsistentes.map((a) => {
        const matchDep = DEPENDENCIAS_MUNICIPALES.find((d) => d.nombre === a.dependencia);
        return {
          id: a.id,
          nombresApellidos: a.nombresApellidos.trim().toUpperCase(),
          cedula: a.cedula.trim().toUpperCase(),
          telefono: a.telefono.trim(),
          dependencia: a.dependencia || '',
          clasificacion: a.clasificacion || (matchDep ? matchDep.tipo : undefined),
          cargo: a.cargo ? a.cargo.trim().toUpperCase() : '',
        };
      }),
      foto,
      creadoPor: currentUser.email,
      fechaRegistro: new Date().toISOString(),
    };

    onSaveAsistencia(nuevoRegistro);

    setSuccessMsg(
      `Registro de asistencia para "${nombreActividad}" guardado exitosamente con ${validAsistentes.length} asistente(s).`
    );

    // Reset fields
    setTipoActividad('');
    setNombreActividad('');
    setLugar('');
    setAsistentes([{ id: '1', nombresApellidos: '', cedula: '', telefono: '' }]);
    setFoto(undefined);

    setTimeout(() => {
      setSuccessMsg(null);
    }, 4500);
  };

  // Export Asistencia to PDF
  const exportarAsistenciaPDF = (asist: RegistroAsistencia) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    const pw = doc.internal.pageSize.getWidth();

    // Soft Metallic Institutional Header
    doc.setFillColor(39, 45, 53); // Deep metallic slate
    doc.rect(0, 0, pw, 26, 'F');
    doc.setFillColor(180, 186, 196); // Soft brushed silver line
    doc.rect(0, 26, pw, 1.2, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('REPÚBLICA BOLIVARIANA DE VENEZUELA', pw / 2, 8, { align: 'center' });
    doc.setFontSize(8.5);
    doc.text('ALCALDÍA DEL MUNICIPIO AUTÓNOMO TINAQUILLO • ESTADO COJEDES', pw / 2, 13, { align: 'center' });
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('DIRECCIÓN GENERAL • REGISTRO INSTITUCIONAL DE ASISTENCIA A ACTIVIDADES', pw / 2, 18, { align: 'center' });

    // Activity Info Card
    let y = 35;
    doc.setFillColor(248, 249, 250);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(14, y, pw - 28, 38, 2, 2, 'FD');

    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(`TIPO DE ACTIVIDAD: ${asist.tipoActividad}`, 18, y + 8);
    doc.setFontSize(11);
    doc.text(`${asist.nombreActividad}`, 18, y + 16);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Fecha: ${formatFechaEspanol(asist.fecha)}`, 18, y + 25);
    doc.text(`Lugar: ${asist.lugar}`, 18, y + 31);
    doc.text(`Control N°: ${asist.id}`, pw - 55, y + 8);
    doc.text(`Total Asistentes: ${asist.asistentes.length}`, pw - 55, y + 16);

    // Attendees Table
    y = 80;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('LISTA DE ASISTENCIA Y PARTICIPANTES', 14, y);

    y += 5;
    doc.setFillColor(226, 232, 240);
    doc.rect(14, y, pw - 28, 7, 'F');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text('N°', 17, y + 5);
    doc.text('NOMBRES Y APELLIDOS', 28, y + 5);
    doc.text('CÉDULA DE IDENTIDAD', 110, y + 5);
    doc.text('TELÉFONO DE CONTACTO', 150, y + 5);

    y += 7;
    doc.setFont('helvetica', 'normal');
    asist.asistentes.forEach((item, idx) => {
      if (y > 240) {
        doc.addPage();
        y = 20;
      }
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(14, y, pw - 28, 6.5, 'F');
      }
      doc.text(String(idx + 1), 17, y + 4.5);
      doc.text(item.nombresApellidos, 28, y + 4.5);
      doc.text(item.cedula, 110, y + 4.5);
      doc.text(item.telefono || 'N/A', 150, y + 4.5);
      y += 6.5;
    });

    // Signature section
    y = Math.max(y + 20, 230);
    if (y > 250) {
      doc.addPage();
      y = 40;
    }
    doc.setDrawColor(148, 163, 184);
    doc.line(pw / 2 - 40, y, pw / 2 + 40, y);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text('DIRECCIÓN GENERAL', pw / 2, y + 5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('Alcaldía del Municipio Autónomo Tinaquillo', pw / 2, y + 9, { align: 'center' });

    doc.save(`ASISTENCIA_${asist.tipoActividad.replace(/ /g, '_')}_${asist.fecha}.pdf`);
  };

  // Filtered Historial
  const filteredHistorial = asistencias.filter((a) => {
    const q = searchTerm.toLowerCase();
    if (!q) return true;
    return (
      a.nombreActividad.toLowerCase().includes(q) ||
      a.tipoActividad.toLowerCase().includes(q) ||
      a.lugar.toLowerCase().includes(q) ||
      a.asistentes.some(
        (asist) =>
          asist.nombresApellidos.toLowerCase().includes(q) ||
          asist.cedula.toLowerCase().includes(q) ||
          asist.telefono.includes(q)
      )
    );
  });

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* SOFT METALLIC HEADER BANNER (NO LOGO, CLEAN DESIGN) */}
      <div className="bg-gradient-to-r from-slate-800 via-zinc-800 to-slate-800 text-white p-5 sm:p-6 rounded-2xl shadow-xs border border-slate-700/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300">
            Dirección General
          </span>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-0.5">
            Registro de Actividades
          </h2>
        </div>

        {/* Navigation buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode('FORM')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              viewMode === 'FORM'
                ? 'bg-slate-100 text-slate-900 shadow-xs'
                : 'bg-slate-700/60 hover:bg-slate-700 text-white'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Registro</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('HISTORIAL')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              viewMode === 'HISTORIAL'
                ? 'bg-slate-100 text-slate-900 shadow-xs'
                : 'bg-slate-700/60 hover:bg-slate-700 text-white'
            }`}
          >
            <CalendarCheck className="w-4 h-4" />
            <span>Ver Registradas ({asistencias.length})</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs sm:text-sm flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xs sm:text-sm flex items-center gap-2 shadow-xs">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* VIEW: FORM */}
      {viewMode === 'FORM' && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* TIPO DE ACTIVIDAD */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                Tipo de Actividad
              </h3>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                Tipo de Actividad <span className="text-rose-500">*</span>
              </label>
              <select
                value={tipoActividad}
                onChange={(e) => {
                  const val = e.target.value as TipoActividad;
                  setTipoActividad(val);
                  setNombreActividad('');
                }}
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-700 focus:bg-white transition"
              >
                <option value="">-- Seleccione una opción --</option>
                {TIPOS_ACTIVIDADES.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {tipo}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* DATOS DE LA ACTIVIDAD */}
          {tipoActividad && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4 transition-all">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  {getLabelNombre(tipoActividad)}, Fecha y Lugar
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Nombre dinámico */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                    {getLabelNombre(tipoActividad)} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={nombreActividad}
                    onChange={(e) => setNombreActividad(e.target.value)}
                    placeholder={`Indique el ${getLabelNombre(tipoActividad).toLowerCase()}`}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-700 focus:bg-white transition"
                  />
                </div>

                {/* Fecha */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>Fecha <span className="text-rose-500">*</span></span>
                  </label>
                  <input
                    type="date"
                    required
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-700 focus:bg-white transition"
                  />
                </div>

                {/* Lugar */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-500" />
                    <span>Lugar <span className="text-rose-500">*</span></span>
                  </label>
                  <input
                    type="text"
                    required
                    value={lugar}
                    onChange={(e) => setLugar(e.target.value)}
                    placeholder="Ej. Salón de Sesiones, Plaza Bolívar, Casa de la Cultura..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-700 focus:bg-white transition"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ASISTENTES Y FOTO */}
          {tipoActividad && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-5 transition-all">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-600" />
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    Asistentes ({asistentes.length})
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={handleAddAsistente}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold transition cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ Agregar Otro Asistente</span>
                </button>
              </div>

              {/* Attendees List Inputs */}
              <div className="space-y-3">
                {asistentes.map((asist, idx) => (
                  <div
                    key={asist.id}
                    className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-600">
                        Asistente #{idx + 1}
                      </span>
                      {asistentes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveAsistente(asist.id)}
                          className="text-rose-600 hover:text-rose-800 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                          title="Remover Asistente"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Eliminar</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                          Nombres y Apellidos <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={asist.nombresApellidos}
                          onChange={(e) =>
                            handleUpdateAsistente(asist.id, 'nombresApellidos', e.target.value)
                          }
                          placeholder="Ej. Juan Carlos Pérez Pérez"
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-slate-700"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                          Cédula de Identidad <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={asist.cedula}
                          onChange={(e) =>
                            handleUpdateAsistente(asist.id, 'cedula', e.target.value)
                          }
                          placeholder="Ej. V-18.456.789"
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-slate-700"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                          Teléfono
                        </label>
                        <input
                          type="tel"
                          value={asist.telefono}
                          onChange={(e) =>
                            handleUpdateAsistente(asist.id, 'telefono', e.target.value)
                          }
                          placeholder="Ej. 0414-1234567"
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-slate-700"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200/60">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                          Dependencia, Empresa o Instituto Representado
                        </label>
                        <select
                          value={asist.dependencia || ''}
                          onChange={(e) =>
                            handleUpdateAsistente(asist.id, 'dependencia', e.target.value)
                          }
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-slate-700"
                        >
                          <option value="">-- Seleccionar Ente Municipal (Opcional) --</option>
                          <optgroup label="DEPENDENCIAS CENTRALIZADAS">
                            {DEPENDENCIAS_MUNICIPALES.filter((d) => d.tipo === 'CENTRALIZADA').map(
                              (d) => (
                                <option key={d.id} value={d.nombre}>
                                  {d.nombre}
                                </option>
                              )
                            )}
                          </optgroup>
                          <optgroup label="EMPRESAS MUNICIPALES">
                            {DEPENDENCIAS_MUNICIPALES.filter((d) => d.tipo === 'EMPRESA').map(
                              (d) => (
                                <option key={d.id} value={d.nombre}>
                                  {d.nombre}
                                </option>
                              )
                            )}
                          </optgroup>
                          <optgroup label="INSTITUTOS AUTÓNOMOS">
                            {DEPENDENCIAS_MUNICIPALES.filter((d) => d.tipo === 'INSTITUTO').map(
                              (d) => (
                                <option key={d.id} value={d.nombre}>
                                  {d.nombre}
                                </option>
                              )
                            )}
                          </optgroup>
                          <option value="OTRA / EXTERNO">OTRA / EXTERNO / COMUNIDAD</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                          Cargo o Rol en la Actividad
                        </label>
                        {(() => {
                          const matchDep = DEPENDENCIAS_MUNICIPALES.find((d) => d.nombre === asist.dependencia);
                          if (matchDep?.cargos && matchDep.cargos.length > 0) {
                            return (
                              <div className="space-y-1">
                                <select
                                  value={matchDep.cargos.includes(asist.cargo || '') ? asist.cargo : 'OTRO'}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    handleUpdateAsistente(asist.id, 'cargo', val === 'OTRO' ? '' : val);
                                  }}
                                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-slate-700"
                                >
                                  {matchDep.cargos.map((c) => (
                                    <option key={c} value={c}>
                                      {c}
                                    </option>
                                  ))}
                                  <option value="OTRO">OTRO / ESPECIFICAR ROL</option>
                                </select>
                                {(!matchDep.cargos.includes(asist.cargo || '') || !asist.cargo) && (
                                  <input
                                    type="text"
                                    value={asist.cargo || ''}
                                    onChange={(e) =>
                                      handleUpdateAsistente(asist.id, 'cargo', e.target.value)
                                    }
                                    placeholder="Especifique el cargo o rol..."
                                    className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-amber-500"
                                  />
                                )}
                              </div>
                            );
                          }
                          return (
                            <input
                              type="text"
                              value={asist.cargo || ''}
                              onChange={(e) =>
                                handleUpdateAsistente(asist.id, 'cargo', e.target.value)
                              }
                              placeholder="Ej. Director, Coordinador, Asistente..."
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-slate-700"
                            />
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* ADJUNTAR FOTO (1) */}
              <div className="pt-3 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-slate-500" />
                  <span>Adjuntar Fotografía de la Actividad (1)</span>
                </label>

                {foto ? (
                  <div className="relative inline-block border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-slate-50 p-2">
                    <img
                      src={foto.dataUrl}
                      alt="Foto de la Actividad"
                      className="w-48 h-32 object-cover rounded-lg"
                    />
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="text-slate-600 truncate max-w-[140px]" title={foto.name}>
                        {foto.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => setFoto(undefined)}
                        className="text-rose-600 hover:text-rose-800 text-xs font-bold ml-2 cursor-pointer"
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="relative border-2 border-dashed border-slate-300 hover:border-slate-400 rounded-xl p-6 text-center bg-slate-50/50 transition">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <Camera className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                    <p className="text-xs font-semibold text-slate-700">
                      Haga clic o arrastre aquí para adjuntar la fotografía
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Formatos compatibles: JPG, PNG, WEBP (Hasta 8MB)
                    </p>
                  </div>
                )}
              </div>

              {/* SUBMIT BUTTON */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
                <button
                  type="submit"
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs sm:text-sm shadow-xs hover:shadow transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Guardar Registro de Asistencia</span>
                </button>
              </div>
            </div>
          )}
        </form>
      )}

      {/* VIEW: HISTORIAL */}
      {viewMode === 'HISTORIAL' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Historial de Actividades y Asistencias Registradas
              </h3>
              <p className="text-xs text-slate-500">
                Consulte y descargue actas de asistencia formalizadas.
              </p>
            </div>

            {/* Search filter */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por actividad, lugar o cédula..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-700"
              />
            </div>
          </div>

          {filteredHistorial.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No hay actividades registradas que coincidan con la búsqueda.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredHistorial.map((asist) => (
                <div
                  key={asist.id}
                  className="p-4 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50/50 hover:bg-white transition shadow-2xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-200 text-slate-800">
                        {asist.tipoActividad}
                      </span>
                      <h4 className="font-bold text-sm text-slate-900 mt-1">
                        {asist.nombreActividad}
                      </h4>
                    </div>

                    <span className="text-[10px] text-slate-400 font-mono">
                      {asist.id}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{formatFechaEspanol(asist.fecha)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 truncate">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{asist.lugar}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-200/60">
                    <span className="flex items-center gap-1 font-semibold text-slate-700">
                      <Users className="w-3.5 h-3.5" />
                      <span>{asist.asistentes.length} asistente(s)</span>
                    </span>

                    {asist.foto && (
                      <span className="text-[11px] text-emerald-700 font-medium">
                        ✓ Foto adjunta
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                    <button
                      type="button"
                      onClick={() => setSelectedAsistencia(asist)}
                      className="text-xs font-semibold text-slate-700 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Ver Detalles</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => exportarAsistenciaPDF(asist)}
                        className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition"
                        title="Exportar Acta de Asistencia en PDF"
                      >
                        <FileDown className="w-3.5 h-3.5 text-slate-700" />
                        <span>PDF</span>
                      </button>

                      {onDeleteAsistencia && (
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`¿Eliminar registro de actividad "${asist.nombreActividad}"?`)) {
                              onDeleteAsistencia(asist.id);
                            }
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                          title="Eliminar Registro"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL DETALLES DE ASISTENCIA */}
      {selectedAsistencia && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between border-b border-slate-200 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-800 px-2 py-0.5 rounded">
                  {selectedAsistencia.tipoActividad}
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-1">
                  {selectedAsistencia.nombreActividad}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAsistencia(null)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 font-bold uppercase">Fecha:</span>
                <p className="font-semibold text-slate-800">
                  {formatFechaEspanol(selectedAsistencia.fecha)}
                </p>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase">Lugar:</span>
                <p className="font-semibold text-slate-800">{selectedAsistencia.lugar}</p>
              </div>
            </div>

            {/* Photo preview */}
            {selectedAsistencia.foto && (
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-700 uppercase">
                  Fotografía de la Actividad:
                </span>
                <div className="rounded-xl overflow-hidden border border-slate-200 max-h-60">
                  <img
                    src={selectedAsistencia.foto.dataUrl}
                    alt="Foto de la Actividad"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            )}

            {/* Attendees list table */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 uppercase">
                Lista de Asistentes ({selectedAsistencia.asistentes.length}):
              </span>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                    <tr>
                      <th className="px-3 py-2">N°</th>
                      <th className="px-3 py-2">Nombres y Apellidos</th>
                      <th className="px-3 py-2">Cédula</th>
                      <th className="px-3 py-2">Dependencia / Ente</th>
                      <th className="px-3 py-2">Cargo</th>
                      <th className="px-3 py-2">Teléfono</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedAsistencia.asistentes.map((a, idx) => (
                      <tr key={a.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-bold text-slate-500">{idx + 1}</td>
                        <td className="px-3 py-2 font-semibold text-slate-900">
                          {a.nombresApellidos}
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-700">{a.cedula}</td>
                        <td className="px-3 py-2">
                          {a.dependencia ? (
                            <span className="font-semibold text-slate-800">
                              {a.dependencia}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">No especificado</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-600">{a.cargo || 'N/A'}</td>
                        <td className="px-3 py-2 text-slate-600">{a.telefono || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => exportarAsistenciaPDF(selectedAsistencia)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
              >
                <FileDown className="w-4 h-4" />
                <span>Descargar Acta PDF</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedAsistencia(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
