import React, { useState } from 'react';
import {
  ClipboardList,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  ArrowRightCircle,
  FileText,
  Edit,
  Phone,
  Calendar,
  Eye,
  Trash2,
  FileDown,
  FileSpreadsheet,
  Briefcase,
  PenTool,
  Download,
  ExternalLink,
} from 'lucide-react';
import { Solicitud, EstadoSolicitud } from '../types';
import {
  exportarPDFSolicitudIndividual,
  exportarExcelSoloSolicitudes,
  exportarPDFSoloSolicitudes,
} from '../utils/exportUtils';
import { formatFechaEspanol } from '../utils/storage';

interface SolicitudesListProps {
  solicitudes: Solicitud[];
  onNewSolicitud: () => void;
  onEditSolicitud: (solicitud: Solicitud) => void;
  onDeleteSolicitud: (id: string) => void;
}

export const SolicitudesList: React.FC<SolicitudesListProps> = ({
  solicitudes,
  onNewSolicitud,
  onEditSolicitud,
  onDeleteSolicitud,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState('TODOS');
  const [selectedDetail, setSelectedDetail] = useState<Solicitud | null>(null);

  // Signature customization for beneficiary PDF
  const [quienEntregaNombre, setQuienEntregaNombre] = useState('Dirección General');
  const [quienEntregaCargo, setQuienEntregaCargo] = useState('Funcionario(a) Autorizado(a)');
  const [quienEntregaCedula, setQuienEntregaCedula] = useState('Alcaldía del Municipio Autónomo Tinaquillo');

  const filtered = solicitudes.filter((s) => {
    if (filterEstado !== 'TODOS' && s.estadoRemision !== filterEstado) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        s.nombresApellidos.toLowerCase().includes(q) ||
        s.cedula.toLowerCase().includes(q) ||
        (s.profesionOficio && s.profesionOficio.toLowerCase().includes(q)) ||
        s.telefonoCompleto.toLowerCase().includes(q) ||
        s.tipoSolicitud.toLowerCase().includes(q) ||
        s.observaciones.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleDescargarPDFBeneficiario = (sol: Solicitud) => {
    exportarPDFSolicitudIndividual(sol, {
      quienEntregaNombre,
      quienEntregaCargo,
      quienEntregaCedula,
    });
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Top Banner in Soft Metallic (No Logo) */}
      <div className="bg-gradient-to-r from-slate-800 via-zinc-800 to-slate-800 text-white rounded-2xl p-5 sm:p-6 shadow-xs border border-slate-700/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300">
            Atención al Ciudadano • Tinaquillo
          </span>
          <h2 className="font-institutional text-xl sm:text-2xl font-bold tracking-wide mt-0.5 text-white">
            Listado de Solicitudes Registradas
          </h2>
          <p className="text-xs text-slate-300">
            Total en sistema: {solicitudes.length} solicitudes de asistencia ciudadana
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Export full solicitudes list */}
          <button
            onClick={() => exportarExcelSoloSolicitudes(solicitudes)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer border border-slate-600"
            title="Exportar todas las solicitudes a Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-slate-200" />
            <span className="hidden sm:inline">Excel</span>
          </button>

          <button
            onClick={() => exportarPDFSoloSolicitudes(solicitudes)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer border border-slate-600"
            title="Exportar todas las solicitudes a PDF"
          >
            <FileDown className="w-3.5 h-3.5 text-slate-200" />
            <span className="hidden sm:inline">PDF</span>
          </button>

          <button
            onClick={onNewSolicitud}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-white text-slate-900 rounded-xl text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Solicitud</span>
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por cédula, nombre, oficio o tipo..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-emerald-600"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
          >
            <option value="TODOS">Todos los Estados</option>
            <option value="ATENDIDO">Atendidos</option>
            <option value="PENDIENTE">Pendientes</option>
            <option value="RECHAZADA">Rechazadas</option>
            <option value="REMITIR A ADMINISTRACIÓN">Remitir a Administración</option>
            <option value="REMITIR A DESPACHO">Remitir a Despacho</option>
            <option value="REMITIR A DESARROLLO SOCIAL">Remitir a Desarrollo Social</option>
            <option value="REMITIR A SERVICIOS PÚBLICOS">Remitir a Servicios Públicos</option>
            <option value="REMITIR A TALENTO HUMANO">Remitir a Talento Humano</option>
          </select>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-400 text-xs">
            No se encontraron solicitudes registradas con los filtros seleccionados.
          </div>
        ) : (
          filtered.map((sol) => (
            <div
              key={sol.id}
              className="p-4 bg-white rounded-2xl border border-slate-200 hover:border-emerald-400 shadow-xs hover:shadow-md transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-slate-400">
                      {sol.id}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 leading-snug">
                      {sol.nombresApellidos}
                    </h3>
                    <p className="text-xs text-slate-500 font-mono">
                      {sol.cedula}
                    </p>
                  </div>

                  <span
                    className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
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

                {/* Profesión u Oficio */}
                {sol.profesionOficio && (
                  <div className="flex items-center gap-1.5 text-slate-600 text-xs mb-2">
                    <Briefcase className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="truncate">Oficio: <strong>{sol.profesionOficio}</strong></span>
                  </div>
                )}

                <div className="mb-2.5">
                  <span className="inline-block text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                    {sol.tipoSolicitud}
                  </span>
                </div>

                <p className="text-xs text-slate-600 line-clamp-2 mb-3">
                  {sol.observaciones || 'Sin observaciones adicionales.'}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-400 font-mono">
                  {sol.fechaSolicitud}
                </span>

                <div className="flex items-center gap-1">
                  {/* Export Individual Beneficiary PDF */}
                  <button
                    onClick={() => handleDescargarPDFBeneficiario(sol)}
                    className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                    title="Exportar Comprobante PDF (con firmas y marca de agua del escudo)"
                  >
                    <FileDown className="w-4 h-4 text-emerald-700" />
                  </button>

                  <button
                    onClick={() => {
                      setSelectedDetail(sol);
                    }}
                    className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                    title="Ver Detalle Completo"
                  >
                    <Eye className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => onEditSolicitud(sol)}
                    className="p-1.5 text-slate-600 hover:text-sky-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                    title="Editar Solicitud"
                  >
                    <Edit className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => {
                      if (confirm(`¿Está seguro de eliminar la solicitud de ${sol.nombresApellidos}?`)) {
                        onDeleteSolicitud(sol.id);
                      }
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                    title="Eliminar Solicitud"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Detail with Signatures & PDF Generator */}
      {selectedDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl bg-white rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="text-[10px] font-mono font-bold text-slate-400">
                  EXPEDIENTE: {selectedDetail.id}
                </span>
                <h3 className="font-black text-slate-900 text-base">Comprobante de Solicitud y Asistencia</h3>
              </div>
              <button onClick={() => setSelectedDetail(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">✕</button>
            </div>

            <div className="text-xs space-y-2.5 text-slate-700">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <p><strong>Nombres y Apellidos:</strong> {selectedDetail.nombresApellidos}</p>
                <p><strong>Cédula de Identidad:</strong> {selectedDetail.cedula}</p>
                <p><strong>Profesión u Oficio:</strong> {selectedDetail.profesionOficio || 'No especificado'}</p>
                <p><strong>Teléfono:</strong> {selectedDetail.telefonoCompleto || `${selectedDetail.telefonoPrefijo}-${selectedDetail.telefonoNumero}`}</p>
                <p><strong>Tipo de Solicitud:</strong> {selectedDetail.tipoSolicitud}</p>
                <p><strong>Fecha de Solicitud:</strong> {formatFechaEspanol(selectedDetail.fechaSolicitud)}</p>
                <p className="col-span-2"><strong>Estado / Remisión:</strong> <span className="font-bold text-emerald-800">{selectedDetail.estadoRemision}</span></p>
              </div>

              <div>
                <p className="font-bold text-slate-800">Observaciones / Motivo:</p>
                <p className="mt-1 p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-slate-600">
                  {selectedDetail.observaciones || 'Sin observaciones adicionales.'}
                </p>
              </div>

              {selectedDetail.adjuntos && selectedDetail.adjuntos.length > 0 && (
                <div className="p-3 bg-sky-50/70 rounded-xl border border-sky-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-sky-950 text-xs flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-sky-700" />
                      <span>Documentos y Comprobantes Digitalizados:</span>
                    </p>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-200/70 text-sky-900">
                      {selectedDetail.adjuntos.length} archivo(s)
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {selectedDetail.adjuntos.map((file, fIdx) => (
                      <div key={fIdx} className="flex items-center justify-between p-2 bg-white rounded-lg border border-sky-200 gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-4 h-4 text-sky-600 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate" title={file.name}>{file.name}</p>
                            <p className="text-[10px] text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {file.dataUrl && (
                            <a href={file.dataUrl} target="_blank" rel="noreferrer" className="p-1 text-slate-600 hover:text-sky-700 rounded transition" title="Abrir">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                          {file.dataUrl && (
                            <a href={file.dataUrl} download={file.name || `adjunto_${fIdx + 1}`} className="flex items-center gap-1 px-2 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded text-[10.5px] font-bold transition">
                              <Download className="w-3 h-3" />
                              <span>Descargar</span>
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Signature configuration */}
              <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200 space-y-2">
                <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs">
                  <PenTool className="w-3.5 h-3.5 text-amber-700" />
                  <span>Datos para la Firma del Comprobante PDF:</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase">Funcionario que Entrega</label>
                    <input
                      type="text"
                      value={quienEntregaNombre}
                      onChange={(e) => setQuienEntregaNombre(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                      placeholder="Nombre del funcionario"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase">Cargo</label>
                    <input
                      type="text"
                      value={quienEntregaCargo}
                      onChange={(e) => setQuienEntregaCargo(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                      placeholder="Cargo oficial"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-amber-800 italic">
                  * El beneficiario ({selectedDetail.nombresApellidos}) firmará en el recuadro "RECIBIDO CONFORME" del comprobante oficial.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={() => handleDescargarPDFBeneficiario(selectedDetail)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition cursor-pointer"
              >
                <FileDown className="w-4 h-4" />
                <span>Exportar Comprobante PDF (con Firmas y Escudo)</span>
              </button>

              <button
                onClick={() => setSelectedDetail(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
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
