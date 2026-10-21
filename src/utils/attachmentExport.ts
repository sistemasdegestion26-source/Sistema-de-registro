import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { Solicitud, InformeDependencia, RegistroAsistencia, FileAttachment } from '../types';
import { DEPENDENCIAS_MUNICIPALES } from '../data/dependenciasData';

export interface FlattenedAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl: string;
  category:
    | 'Informe Trimestral'
    | 'Firma Memorándum'
    | 'Auditoría'
    | 'Solicitud Ciudadana'
    | 'Lista Asistencia'
    | 'Digitalizado'
    | 'Excel'
    | 'Word'
    | 'PDF'
    | 'Imagen'
    | string;
  sourceTitle: string;
  sourceId: string;
  fecha: string;
  dependencia: string;
  tipoDependencia: 'CENTRALIZADA' | 'DESCENTRALIZADA';
  subtipo: 'DIRECCION' | 'INSTITUTO' | 'EMPRESA';
}

export interface DependencyStats {
  id: string;
  nombre: string;
  tipo: 'CENTRALIZADA' | 'DESCENTRALIZADA';
  subtipo: 'DIRECCION' | 'INSTITUTO' | 'EMPRESA';
  attachments: FlattenedAttachment[];
  totalFiles: number;
  totalBytes: number;
  categories: { [key: string]: number };
}

/**
 * Matches a raw dependency name to its official institutional denomination and classification
 */
export function matchOfficialDependencia(rawDep: string): {
  nombreOficial: string;
  tipo: 'CENTRALIZADA' | 'DESCENTRALIZADA';
  subtipo: 'DIRECCION' | 'INSTITUTO' | 'EMPRESA';
} {
  const norm = (rawDep || '').trim().toUpperCase();

  // 1. Direct exact or partial match with DEPENDENCIAS_MUNICIPALES
  const found = DEPENDENCIAS_MUNICIPALES.find((d) => {
    const dNorm = d.nombre.trim().toUpperCase();
    return dNorm === norm || norm.includes(dNorm) || dNorm.includes(norm);
  });

  if (found) {
    const isCentralizada = found.tipo === 'CENTRALIZADA';
    const subtipo: 'DIRECCION' | 'INSTITUTO' | 'EMPRESA' = isCentralizada
      ? 'DIRECCION'
      : found.tipo === 'EMPRESA'
      ? 'EMPRESA'
      : 'INSTITUTO';
    return {
      nombreOficial: found.nombre,
      tipo: isCentralizada ? 'CENTRALIZADA' : 'DESCENTRALIZADA',
      subtipo,
    };
  }

  // 2. Common aliases & normalized keywords
  if (norm.includes('ATENCION') || norm.includes('ATENCIÓN')) {
    return {
      nombreOficial: 'DIRECCIÓN DE ATENCIÓN AL CIUDADANO',
      tipo: 'CENTRALIZADA',
      subtipo: 'DIRECCION',
    };
  }
  if (norm.includes('GENERAL') || norm.includes('ACTIVIDAD')) {
    return {
      nombreOficial: 'DIRECCIÓN GENERAL',
      tipo: 'CENTRALIZADA',
      subtipo: 'DIRECCION',
    };
  }
  if (norm.includes('DESPACHO')) {
    return {
      nombreOficial: 'DIRECCIÓN EJECUTIVA DE DESPACHO',
      tipo: 'CENTRALIZADA',
      subtipo: 'DIRECCION',
    };
  }
  if (norm.includes('PLANIFICACI') || norm.includes('ORGANIZACI')) {
    return {
      nombreOficial: 'DIRECCIÓN DE PLANIFICACIÓN Y ORGANIZACIÓN',
      tipo: 'CENTRALIZADA',
      subtipo: 'DIRECCION',
    };
  }
  if (norm.includes('TALENTO') || norm.includes('HUMANO') || norm.includes('RRHH') || norm.includes('PERSONAL')) {
    return {
      nombreOficial: 'DIRECCIÓN DE TALENTO HUMANO',
      tipo: 'CENTRALIZADA',
      subtipo: 'DIRECCION',
    };
  }
  if (norm.includes('HACIENDA') || norm.includes('ADMINISTRACI')) {
    return {
      nombreOficial: 'DIRECCIÓN DE ADMINISTRACIÓN HACIENDA MUNICIPAL',
      tipo: 'CENTRALIZADA',
      subtipo: 'DIRECCION',
    };
  }
  if (norm.includes('AUDITORI') || norm.includes('AUDITORÍA')) {
    return {
      nombreOficial: 'DIRECCIÒN DE AUDITORIA INTERNA',
      tipo: 'CENTRALIZADA',
      subtipo: 'DIRECCION',
    };
  }
  if (norm.includes('INFORMATICA') || norm.includes('INFORMÁTICA') || norm.includes('SISTEMA')) {
    return {
      nombreOficial: 'UNIDAD DE INFORMÁTICA',
      tipo: 'CENTRALIZADA',
      subtipo: 'DIRECCION',
    };
  }
  if (norm.includes('INFRAESTRUCTURA') || norm.includes('OBRAS') || norm.includes('INGENIER')) {
    return {
      nombreOficial: 'DIRECCIÓN DE INFRAESTRUCTURA',
      tipo: 'CENTRALIZADA',
      subtipo: 'DIRECCION',
    };
  }
  if (norm.includes('SERVICIOS P') || norm.includes('ALUMBRADO')) {
    return {
      nombreOficial: 'DIRECCIÓN DE SERVICIOS PÚBLICOS',
      tipo: 'CENTRALIZADA',
      subtipo: 'DIRECCION',
    };
  }
  if (norm.includes('CATASTRO')) {
    return {
      nombreOficial: 'DIRECCIÓN DE CATASTRO MUNICIPAL',
      tipo: 'CENTRALIZADA',
      subtipo: 'DIRECCION',
    };
  }
  if (norm.includes('SINDICATURA')) {
    return {
      nombreOficial: 'DIRECCIÓN DE SINDICATURA MUNICIPAL',
      tipo: 'CENTRALIZADA',
      subtipo: 'DIRECCION',
    };
  }
  if (norm.includes('REGISTRO CIVIL')) {
    return {
      nombreOficial: 'DIRECCIÓN DE REGISTRO CIVIL',
      tipo: 'CENTRALIZADA',
      subtipo: 'DIRECCION',
    };
  }
  if (norm.includes('DESARROLLO SOCIAL') || norm.includes('COMUNAL')) {
    return {
      nombreOficial: 'DIRECCIÓN DE DESARROLLO SOCIAL Y COMUNAL',
      tipo: 'CENTRALIZADA',
      subtipo: 'DIRECCION',
    };
  }
  if (norm.includes('SALUD')) {
    return {
      nombreOficial: 'DIRECCIÓN DE SALUD MUNICIPAL',
      tipo: 'CENTRALIZADA',
      subtipo: 'DIRECCION',
    };
  }
  if (norm.includes('ECONOMICO') || norm.includes('ECONÓMICO')) {
    return {
      nombreOficial: 'DIRECCIÓN DE DESARROLLO ECONOMICO',
      tipo: 'CENTRALIZADA',
      subtipo: 'DIRECCION',
    };
  }
  if (norm.includes('SEGURIDAD') || norm.includes('POLITICA') || norm.includes('POLÍTICA')) {
    return {
      nombreOficial: 'DIRECCIÓN DE SEGURIDAD Y POLITICA',
      tipo: 'CENTRALIZADA',
      subtipo: 'DIRECCION',
    };
  }

  // 3. Fallback inference based on naming
  const isDireccion = norm.startsWith('DIRECCI') || norm.startsWith('UNIDAD');
  return {
    nombreOficial: rawDep || 'DIRECCIÓN O ENTE MUNICIPAL',
    tipo: isDireccion ? 'CENTRALIZADA' : 'DESCENTRALIZADA',
    subtipo: isDireccion ? 'DIRECCION' : 'INSTITUTO',
  };
}

/**
 * Helper to ensure file name has correct extension based on its type
 */
function resolveFileName(rawName: string | undefined, type: string, defaultName: string): string {
  const name = (rawName || '').trim();
  if (name && name.includes('.')) return name;
  const base = name || defaultName.replace(/\.[^/.]+$/, '');
  if (type === 'excel') return `${base}.xlsx`;
  if (type === 'doc') return `${base}.docx`;
  if (type === 'image') return `${base}.jpg`;
  return `${base}.pdf`;
}

/**
 * Generates an institutional Excel workbook (.xlsx) for a dependency
 */
function generateDependencyExcel(
  depName: string,
  items: InformeDependencia[]
): { name: string; dataUrl: string; size: number } {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Resumen Institucional
  const summaryRows = [
    {
      'ALCALDÍA DEL MUNICIPIO AUTÓNOMO TINAQUILLO': 'DIRECCIÓN GENERAL - EXPEDIENTE DE CONTROL DE GESTIÓN',
      'VALOR': '',
    },
    {
      'ALCALDÍA DEL MUNICIPIO AUTÓNOMO TINAQUILLO': 'Dependencia Oficial',
      'VALOR': depName,
    },
    {
      'ALCALDÍA DEL MUNICIPIO AUTÓNOMO TINAQUILLO': 'Fecha de Generación',
      'VALOR': new Date().toLocaleDateString('es-VE'),
    },
    {
      'ALCALDÍA DEL MUNICIPIO AUTÓNOMO TINAQUILLO': 'Total de Informes y Consignaciones',
      'VALOR': items.length,
    },
    {
      'ALCALDÍA DEL MUNICIPIO AUTÓNOMO TINAQUILLO': 'Estado General de Auditoría',
      'VALOR': items.length > 0 ? 'CONSIGNADO CON EVIDENCIAS' : 'CONSIGNACIÓN PENDIENTE',
    },
  ];
  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Ficha Resumen');

  // Sheet 2: Detalle de Informes
  const detailRows = items.map((inf, idx) => ({
    'N°': idx + 1,
    'Código Expediente': inf.id,
    'Tipo de Informe': inf.tipoInforme,
    'Período / Trimestre': inf.trimestre || inf.anioGestion || '2025-2026',
    'Responsable': inf.nombresApellidos || 'Dirección General',
    'Cédula': inf.cedula || 'N/A',
    'Cargo': inf.cargo || 'Director / Responsable',
    'Fecha de Registro': inf.fechaRegistro || 'N/A',
    'Metas Programadas': inf.metasFisicasProgramadas ?? 'N/A',
    'Metas Ejecutadas': inf.metasFisicasEjecutadas ?? 'N/A',
    '% Alcance': inf.alcancePorcentaje ? `${inf.alcancePorcentaje}%` : 'N/A',
    'Estado': inf.estado || 'PROCESADO',
  }));

  const wsDetails = XLSX.utils.json_to_sheet(
    detailRows.length > 0 ? detailRows : [{ 'Estado': 'Sin informes cargados a la fecha' }]
  );
  XLSX.utils.book_append_sheet(wb, wsDetails, 'Detalle de Gestión');

  const base64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
  const safeName = sanitizeFileName(depName);
  return {
    name: `Control_Gestion_${safeName}.xlsx`,
    dataUrl: `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`,
    size: Math.round(base64.length * 0.75),
  };
}

/**
 * Generates an institutional Word document (.doc) for a dependency
 */
function generateDependencyWord(
  depName: string,
  items: InformeDependencia[]
): { name: string; dataUrl: string; size: number } {
  const safeName = sanitizeFileName(depName);
  const dateStr = new Date().toLocaleDateString('es-VE');

  const rows = items
    .map(
      (inf, idx) => `
    <tr>
      <td style="border:1px solid #cbd5e1;padding:6px;text-align:center;">${idx + 1}</td>
      <td style="border:1px solid #cbd5e1;padding:6px;font-family:monospace;">${inf.id}</td>
      <td style="border:1px solid #cbd5e1;padding:6px;">${inf.tipoInforme}</td>
      <td style="border:1px solid #cbd5e1;padding:6px;">${inf.trimestre || inf.anioGestion || '2025-2026'}</td>
      <td style="border:1px solid #cbd5e1;padding:6px;">${inf.nombresApellidos || 'Dirección General'}</td>
      <td style="border:1px solid #cbd5e1;padding:6px;text-align:center;">${inf.fechaRegistro || 'N/A'}</td>
      <td style="border:1px solid #cbd5e1;padding:6px;font-weight:bold;color:#047857;">${inf.estado || 'CONSIGNADO'}</td>
    </tr>
  `
    )
    .join('');

  const html = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset="utf-8">
      <title>Ficha Técnica Municipal - ${depName}</title>
      <style>
        body { font-family: Calibri, Arial, sans-serif; margin: 30px; color: #1e293b; font-size: 11pt; }
        h1 { color: #0f172a; font-size: 16pt; margin-bottom: 2px; }
        h2 { color: #475569; font-size: 12pt; margin-top: 0; font-weight: normal; }
        .header-box { border-bottom: 3px solid #0284c7; padding-bottom: 10px; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 9.5pt; }
        th { background-color: #0f172a; color: white; padding: 7px; text-align: left; }
        .info-card { background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; margin-bottom: 15px; border-radius: 4px; }
        .footer-note { font-size: 8.5pt; color: #64748b; margin-top: 30px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 8px; }
      </style>
    </head>
    <body>
      <div class="header-box">
        <h1>REPÚBLICA BOLIVARIANA DE VENEZUELA</h1>
        <h1>ALCALDÍA DEL MUNICIPIO AUTÓNOMO TINAQUILLO</h1>
        <h2>DIRECCIÓN GENERAL • FICHA TÉCNICA INSTITUCIONAL DE GESTIÓN</h2>
      </div>

      <div class="info-card">
        <p><strong>Dependencia Oficial:</strong> ${depName}</p>
        <p><strong>Fecha de Expedición:</strong> ${dateStr}</p>
        <p><strong>Total de Actuaciones Registradas:</strong> ${items.length}</p>
        <p><strong>Estatus Institucional:</strong> Documento oficial con plena validez de verificación.</p>
      </div>

      <h3 style="color:#0f172a;margin-top:20px;">Relación de Informes y Consignaciones</h3>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Expediente</th>
            <th>Tipo de Informe</th>
            <th>Período</th>
            <th>Responsable</th>
            <th>Fecha</th>
            <th>Estatus</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="7" style="padding:15px;text-align:center;color:#64748b;">No se registran informes cargados a la fecha</td></tr>'}
        </tbody>
      </table>

      <div class="footer-note">
        Alcaldía Bolivariana del Municipio Tinaquillo • Estado Cojedes • Despacho del Alcalde • Dirección General
      </div>
    </body>
    </html>
  `;

  const base64 = btoa(unescape(encodeURIComponent(html)));
  return {
    name: `Ficha_Tecnica_${safeName}.doc`,
    dataUrl: `data:application/msword;base64,${base64}`,
    size: Math.round(base64.length * 0.75),
  };
}

/**
 * Generates an institutional PDF document (.pdf) for a dependency
 */
function generateDependencyPdf(
  depName: string,
  items: InformeDependencia[]
): { name: string; dataUrl: string; size: number } {
  const safeName = sanitizeFileName(depName);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Top header banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('ALCALDÍA DEL MUNICIPIO AUTÓNOMO TINAQUILLO', pageWidth / 2, 9, { align: 'center' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(226, 232, 240);
  doc.text('DIRECCIÓN GENERAL • EXPEDIENTE DE CONTROL DE GESTIÓN Y AUDITORÍA', pageWidth / 2, 15, { align: 'center' });

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(254, 240, 138);
  doc.text(`DEPENDENCIA: ${depName}`, pageWidth / 2, 22, { align: 'center' });

  let y = 38;
  doc.setTextColor(30, 41, 59);

  // Box 1: Summary
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, y, pageWidth - 28, 18, 2, 2, 'F');
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('RESUMEN DE EXPEDIENTE INSTITUCIONAL', 18, y + 6);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString('es-VE')}   |   Total de Informes Consignados: ${items.length}`, 18, y + 12);

  y += 26;

  // Box 2: Records
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('RELACIÓN DETALLADA DE CONSIGNACIONES', 14, y);
  y += 6;

  if (items.length === 0) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 116, 139);
    doc.text('Sin informes registrados para este período fiscal.', 14, y);
    y += 10;
  } else {
    items.slice(0, 12).forEach((inf, i) => {
      doc.setFillColor(i % 2 === 0 ? 255 : 248, i % 2 === 0 ? 255 : 250, i % 2 === 0 ? 255 : 252);
      doc.rect(14, y - 4, pageWidth - 28, 9, 'F');

      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`${i + 1}. [${inf.id}] ${inf.tipoInforme}`, 16, y);

      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(`Resp: ${inf.nombresApellidos || 'Dirección General'} | Período: ${inf.trimestre || inf.anioGestion || '2025-2026'}`, 16, y + 4);

      y += 10;
    });
  }

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('EXPEDIENTE OFICIAL DE GESTIÓN MUNICIPAL • ALCALDÍA DE TINAQUILLO', pageWidth / 2, pageHeight - 8, { align: 'center' });

  const dataUrl = doc.output('datauristring');
  return {
    name: `Expediente_Oficial_${safeName}.pdf`,
    dataUrl,
    size: Math.round(dataUrl.length * 0.75),
  };
}

/**
 * Generates an institutional emblem / image (.jpg) for a dependency
 */
function generateDependencyEmblem(depName: string): { name: string; dataUrl: string; size: number } {
  const safeName = sanitizeFileName(depName);
  try {
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = 600;
      canvas.height = 400;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const grad = ctx.createLinearGradient(0, 0, 600, 400);
        grad.addColorStop(0, '#0f172a');
        grad.addColorStop(0.5, '#1e293b');
        grad.addColorStop(1, '#0f172a');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 600, 400);

        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 4;
        ctx.strokeRect(12, 12, 576, 376);

        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1;
        ctx.strokeRect(20, 20, 560, 360);

        ctx.beginPath();
        ctx.arc(300, 125, 55, 0, Math.PI * 2);
        ctx.fillStyle = '#f59e0b';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(300, 125, 50, 0, Math.PI * 2);
        ctx.fillStyle = '#0f172a';
        ctx.fill();

        ctx.fillStyle = '#f59e0b';
        ctx.font = 'bold 34px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★', 300, 125);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 15px sans-serif';
        ctx.fillText('ALCALDÍA BOLIVARIANA DE TINAQUILLO', 300, 215);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '11px sans-serif';
        ctx.fillText('DIRECCIÓN GENERAL • ARCHIVO DE GESTIÓN MUNICIPAL', 300, 240);

        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 12.5px sans-serif';
        ctx.fillText(depName.slice(0, 48), 300, 280);
        if (depName.length > 48) {
          ctx.fillText(depName.slice(48, 96), 300, 300);
        }

        ctx.fillStyle = '#64748b';
        ctx.font = '9.5px monospace';
        ctx.fillText('EXPEDIENTE OFICIAL DE EVIDENCIAS Y DIGITALIZACIÓN', 300, 345);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        return {
          name: `Emblema_Oficial_${safeName}.jpg`,
          dataUrl,
          size: Math.round(dataUrl.length * 0.75),
        };
      }
    }
  } catch (e) {}

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
    <rect width="600" height="400" fill="#0f172a"/>
    <rect x="15" y="15" width="570" height="370" fill="none" stroke="#f59e0b" stroke-width="4"/>
    <circle cx="300" cy="130" r="50" fill="#f59e0b"/>
    <text x="300" y="220" font-size="16" font-family="sans-serif" font-weight="bold" fill="#ffffff" text-anchor="middle">ALCALDÍA DE TINAQUILLO</text>
    <text x="300" y="270" font-size="14" font-family="sans-serif" fill="#fbbf24" text-anchor="middle">${depName}</text>
  </svg>`;
  const base64 = btoa(unescape(encodeURIComponent(svg)));
  const dataUrl = `data:image/svg+xml;base64,${base64}`;
  return {
    name: `Emblema_Oficial_${safeName}.jpg`,
    dataUrl,
    size: Math.round(base64.length * 0.75),
  };
}

/**
 * Extracts all attachments from across the entire institutional repository
 * with official dependency normalization and classification
 */
export function getAllAttachments(
  solicitudes: Solicitud[] = [],
  informes: InformeDependencia[] = [],
  asistencias: RegistroAsistencia[] = []
): FlattenedAttachment[] {
  const result: FlattenedAttachment[] = [];

  // 1. Informes Dependencias
  informes.forEach((inf) => {
    const rawDep = inf.dependencia || 'Sin Dependencia';
    const matched = matchOfficialDependencia(rawDep);
    const dep = matched.nombreOficial;
    const fecha = inf.fechaRegistro || inf.fechaAuditoria || 'Fecha no especificada';

    // 1.1 Trimestrales (adjuntoInformeTrimestral o adjuntoInforme)
    const trimestrales = inf.adjuntoInformeTrimestral || inf.adjuntoInforme;
    if (trimestrales && Array.isArray(trimestrales)) {
      trimestrales.forEach((file) => {
        const finalName = resolveFileName(file.name, file.type, 'informe_trimestral.pdf');
        result.push({
          id: file.id || `trim-${Math.random()}`,
          name: finalName,
          type: file.type || 'pdf',
          size: file.size || 0,
          dataUrl: file.dataUrl,
          category: 'Informe Trimestral',
          sourceTitle: `${inf.tipoInforme} - ${inf.trimestre || ''} ${inf.anioGestion || ''}`.trim(),
          sourceId: inf.id,
          fecha,
          dependencia: dep,
          tipoDependencia: matched.tipo,
          subtipo: matched.subtipo,
        });
      });
    }

    // 1.2 Memorándums (Firma Personal)
    if (inf.fotoFirmaPersonal && Array.isArray(inf.fotoFirmaPersonal)) {
      inf.fotoFirmaPersonal.forEach((file) => {
        const finalName = resolveFileName(file.name, file.type, 'firma_personal.jpg');
        result.push({
          id: file.id || `memo-${Math.random()}`,
          name: finalName,
          type: file.type || 'image',
          size: file.size || 0,
          dataUrl: file.dataUrl,
          category: 'Firma Memorándum',
          sourceTitle: `Memorándum Interno - ${dep}`,
          sourceId: inf.id,
          fecha,
          dependencia: dep,
          tipoDependencia: matched.tipo,
          subtipo: matched.subtipo,
        });
      });
    }

    // 1.3 Auditoría
    if (inf.archivosAuditoria && Array.isArray(inf.archivosAuditoria)) {
      inf.archivosAuditoria.forEach((file) => {
        const finalName = resolveFileName(file.name, file.type, 'evidencia_auditoria.pdf');
        result.push({
          id: file.id || `aud-${Math.random()}`,
          name: finalName,
          type: file.type || 'pdf',
          size: file.size || 0,
          dataUrl: file.dataUrl,
          category: 'Auditoría',
          sourceTitle: `${inf.tipoInforme} - ${dep}`,
          sourceId: inf.id,
          fecha,
          dependencia: dep,
          tipoDependencia: matched.tipo,
          subtipo: matched.subtipo,
        });
      });
    }

    // 1.4 Memoria Fotográfica (retrocompatibilidad)
    if (inf.memoriaFotografica && Array.isArray(inf.memoriaFotografica)) {
      inf.memoriaFotografica.forEach((file) => {
        const finalName = resolveFileName(file.name, file.type, 'foto_evidencia.jpg');
        result.push({
          id: file.id || `fot-${Math.random()}`,
          name: finalName,
          type: file.type || 'image',
          size: file.size || 0,
          dataUrl: file.dataUrl,
          category: 'Digitalizado',
          sourceTitle: `Evidencia - ${dep}`,
          sourceId: inf.id,
          fecha,
          dependencia: dep,
          tipoDependencia: matched.tipo,
          subtipo: matched.subtipo,
        });
      });
    }
  });

  // 2. Solicitudes Ciudadanas (adjuntos) -> Pertenecientes a DIRECCIÓN DE ATENCIÓN AL CIUDADANO
  const atencionMatched = matchOfficialDependencia('DIRECCIÓN DE ATENCIÓN AL CIUDADANO');
  solicitudes.forEach((sol) => {
    if (sol.adjuntos && Array.isArray(sol.adjuntos)) {
      sol.adjuntos.forEach((file) => {
        const finalName = resolveFileName(file.name, file.type, 'adjunto_solicitud.pdf');
        result.push({
          id: file.id || `sol-${Math.random()}`,
          name: finalName,
          type: file.type || 'pdf',
          size: file.size || 0,
          dataUrl: file.dataUrl,
          category: 'Solicitud Ciudadana',
          sourceTitle: `Solicitud #${sol.id} - ${sol.nombresApellidos} (C.I. ${sol.cedula})`,
          sourceId: sol.id,
          fecha: sol.fechaRegistro || sol.fechaSolicitud,
          dependencia: atencionMatched.nombreOficial,
          tipoDependencia: atencionMatched.tipo,
          subtipo: atencionMatched.subtipo,
        });
      });
    }
  });

  // 3. Registro de Asistencias a Actividades -> Pertenecientes a DIRECCIÓN GENERAL
  const dirGeneralMatched = matchOfficialDependencia('DIRECCIÓN GENERAL');
  asistencias.forEach((asist) => {
    if (asist.foto && asist.foto.dataUrl) {
      const finalName = resolveFileName(asist.foto.name, asist.foto.type, 'foto_asistencia.jpg');
      result.push({
        id: asist.foto.id || `asis-${Math.random()}`,
        name: finalName,
        type: asist.foto.type || 'image',
        size: asist.foto.size || 0,
        dataUrl: asist.foto.dataUrl,
        category: 'Lista Asistencia',
        sourceTitle: `Actividad: ${asist.nombreActividad} (${asist.lugar})`,
        sourceId: asist.id,
        fecha: asist.fecha,
        dependencia: dirGeneralMatched.nombreOficial,
        tipoDependencia: dirGeneralMatched.tipo,
        subtipo: dirGeneralMatched.subtipo,
      });
    }
  });

  // 4. Dossier Institucional Automático por Dependencia (Excel, Word, PDF e Imágenes)
  // Garantiza que CADA carpeta descargable por dependencia contenga sus archivos correspondientes
  DEPENDENCIAS_MUNICIPALES.forEach((depObj) => {
    const isCentralizada = depObj.tipo === 'CENTRALIZADA';
    const subtipo: 'DIRECCION' | 'INSTITUTO' | 'EMPRESA' = isCentralizada
      ? 'DIRECCION'
      : depObj.tipo === 'EMPRESA'
      ? 'EMPRESA'
      : 'INSTITUTO';
    const depName = depObj.nombre;
    const norm = depName.trim().toUpperCase();

    // Informes que corresponden a esta dependencia
    const depInformes = informes.filter((inf) => {
      const infNorm = (inf.dependencia || '').trim().toUpperCase();
      return infNorm === norm || infNorm.includes(norm) || norm.includes(infNorm);
    });

    const fechaHoy = new Date().toISOString().split('T')[0];

    // 4.1 Archivo Excel (.xlsx)
    const excelDoc = generateDependencyExcel(depName, depInformes);
    result.push({
      id: `gen-xls-${depObj.id}`,
      name: excelDoc.name,
      type: 'excel',
      size: excelDoc.size,
      dataUrl: excelDoc.dataUrl,
      category: 'Excel',
      sourceTitle: `Control de Gestión Excel - ${depName}`,
      sourceId: `xls-${depObj.id}`,
      fecha: fechaHoy,
      dependencia: depName,
      tipoDependencia: isCentralizada ? 'CENTRALIZADA' : 'DESCENTRALIZADA',
      subtipo,
    });

    // 4.2 Archivo Word (.doc)
    const wordDoc = generateDependencyWord(depName, depInformes);
    result.push({
      id: `gen-doc-${depObj.id}`,
      name: wordDoc.name,
      type: 'doc',
      size: wordDoc.size,
      dataUrl: wordDoc.dataUrl,
      category: 'Word',
      sourceTitle: `Ficha Técnica Word - ${depName}`,
      sourceId: `doc-${depObj.id}`,
      fecha: fechaHoy,
      dependencia: depName,
      tipoDependencia: isCentralizada ? 'CENTRALIZADA' : 'DESCENTRALIZADA',
      subtipo,
    });

    // 4.3 Archivo PDF (.pdf)
    const pdfDoc = generateDependencyPdf(depName, depInformes);
    result.push({
      id: `gen-pdf-${depObj.id}`,
      name: pdfDoc.name,
      type: 'pdf',
      size: pdfDoc.size,
      dataUrl: pdfDoc.dataUrl,
      category: 'PDF',
      sourceTitle: `Expediente Oficial PDF - ${depName}`,
      sourceId: `pdf-${depObj.id}`,
      fecha: fechaHoy,
      dependencia: depName,
      tipoDependencia: isCentralizada ? 'CENTRALIZADA' : 'DESCENTRALIZADA',
      subtipo,
    });

    // 4.4 Imagen Institucional (.jpg)
    const imgDoc = generateDependencyEmblem(depName);
    result.push({
      id: `gen-img-${depObj.id}`,
      name: imgDoc.name,
      type: 'image',
      size: imgDoc.size,
      dataUrl: imgDoc.dataUrl,
      category: 'Imagen',
      sourceTitle: `Emblema Institucional - ${depName}`,
      sourceId: `img-${depObj.id}`,
      fecha: fechaHoy,
      dependencia: depName,
      tipoDependencia: isCentralizada ? 'CENTRALIZADA' : 'DESCENTRALIZADA',
      subtipo,
    });
  });

  return result;
}

/**
 * Downloads a single attachment directly in the browser
 */
export function downloadSingleAttachment(att: FlattenedAttachment | FileAttachment) {
  if (!att.dataUrl) return;
  const link = document.createElement('a');
  link.href = att.dataUrl;
  link.download = att.name || 'archivo_adjunto';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Clean sanitization for folder and file names inside ZIP
 */
export function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim();
}

/**
 * Calculates complete dependency statistics across all 37 municipal dependencies
 * separating Centralizadas (17) and Descentralizadas (20)
 */
export function getDependencyAttachmentStats(attachments: FlattenedAttachment[]): {
  centralizadas: DependencyStats[];
  descentralizadas: DependencyStats[];
  todas: DependencyStats[];
} {
  const statsMap = new Map<string, DependencyStats>();

  // Initialize with all official municipal dependencies
  DEPENDENCIAS_MUNICIPALES.forEach((dep) => {
    const isCentralizada = dep.tipo === 'CENTRALIZADA';
    const subtipo: 'DIRECCION' | 'INSTITUTO' | 'EMPRESA' = isCentralizada
      ? 'DIRECCION'
      : dep.tipo === 'EMPRESA'
      ? 'EMPRESA'
      : 'INSTITUTO';

    statsMap.set(dep.nombre.trim().toUpperCase(), {
      id: dep.id,
      nombre: dep.nombre,
      tipo: isCentralizada ? 'CENTRALIZADA' : 'DESCENTRALIZADA',
      subtipo,
      attachments: [],
      totalFiles: 0,
      totalBytes: 0,
      categories: {},
    });
  });

  // Populate with actual attachments
  attachments.forEach((att) => {
    const key = (att.dependencia || '').trim().toUpperCase();
    let entry = statsMap.get(key);

    if (!entry) {
      // Find case-insensitive or partial
      for (const [mapKey, mapVal] of statsMap.entries()) {
        if (mapKey === key || mapKey.includes(key) || key.includes(mapKey)) {
          entry = mapVal;
          break;
        }
      }
    }

    if (!entry) {
      // Create ad-hoc entry if not found
      entry = {
        id: `custom-${Math.random()}`,
        nombre: att.dependencia || 'Sin Dependencia',
        tipo: att.tipoDependencia || 'CENTRALIZADA',
        subtipo: att.subtipo || 'DIRECCION',
        attachments: [],
        totalFiles: 0,
        totalBytes: 0,
        categories: {},
      };
      statsMap.set(key, entry);
    }

    entry.attachments.push(att);
    entry.totalFiles += 1;
    entry.totalBytes += att.size || 0;
    entry.categories[att.category] = (entry.categories[att.category] || 0) + 1;
  });

  const todas = Array.from(statsMap.values());
  const centralizadas = todas.filter((d) => d.tipo === 'CENTRALIZADA');
  const descentralizadas = todas.filter((d) => d.tipo === 'DESCENTRALIZADA');

  return { centralizadas, descentralizadas, todas };
}

/**
 * Direct file and folder export without ZIP format
 */
export const isDirectoryPickerSupported =
  typeof window !== 'undefined' && 'showDirectoryPicker' in window;

function dataUrlToUint8Array(dataUrl: string): { bytes: Uint8Array; mime: string } {
  let base64 = dataUrl;
  let mime = 'application/octet-stream';
  if (base64.includes(';base64,')) {
    const parts = base64.split(';base64,');
    mime = parts[0].replace('data:', '') || mime;
    base64 = parts[1];
  } else if (base64.includes(',')) {
    const parts = base64.split(',');
    mime = parts[0].replace('data:', '') || mime;
    base64 = parts[1];
  }
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return { bytes, mime };
}

/**
 * Saves files directly into native directory structure using File System Access API (Sin ZIP)
 */
export async function saveFilesToDirectoryPicker(
  files: FlattenedAttachment[],
  targetFolderName?: string,
  onProgress?: (percent: number, currentFile: string) => void
): Promise<{ success: boolean; savedCount: number; message: string }> {
  if (typeof window === 'undefined' || !('showDirectoryPicker' in window)) {
    throw new Error(
      'Su navegador o dispositivo no soporta la selección directa de carpetas en disco. Se procederá a descargar los archivos originales directamente.'
    );
  }

  const rootHandle = await (window as any).showDirectoryPicker({
    mode: 'readwrite',
  });

  let baseHandle = rootHandle;
  if (targetFolderName) {
    const safeBase = sanitizeFileName(targetFolderName);
    baseHandle = await rootHandle.getDirectoryHandle(safeBase, { create: true });
  }

  let count = 0;
  const total = files.length;
  const usedNamesInFolder = new Map<string, number>();

  for (let i = 0; i < total; i++) {
    const item = files[i];
    if (onProgress) {
      onProgress(Math.round(((i + 1) / total) * 100), item.name);
    }
    if (!item.dataUrl) continue;

    let targetDir = baseHandle;
    if (item.dependencia) {
      const depFolderName = sanitizeFileName(item.dependencia);
      targetDir = await baseHandle.getDirectoryHandle(depFolderName, { create: true });
    }

    const rawFileName = sanitizeFileName(item.name || `adjunto_${i + 1}`);
    const mapKey = `${item.dependencia || ''}/${rawFileName}`.toLowerCase();
    const existingCount = usedNamesInFolder.get(mapKey) || 0;
    let finalFileName = rawFileName;

    if (existingCount > 0) {
      const extDot = rawFileName.lastIndexOf('.');
      if (extDot > 0) {
        finalFileName = `${rawFileName.substring(0, extDot)}_(${existingCount + 1})${rawFileName.substring(extDot)}`;
      } else {
        finalFileName = `${rawFileName}_(${existingCount + 1})`;
      }
    }
    usedNamesInFolder.set(mapKey, existingCount + 1);

    const fileHandle = await targetDir.getFileHandle(finalFileName, { create: true });
    const writable = await fileHandle.createWritable();
    const { bytes } = dataUrlToUint8Array(item.dataUrl);
    await writable.write(bytes);
    await writable.close();
    count++;
  }

  return {
    success: true,
    savedCount: count,
    message: `Se guardaron ${count} archivos originales directamente en la carpeta (sin formato ZIP).`,
  };
}

/**
 * Downloads multiple files sequentially in original format without ZIP
 */
export async function downloadFilesDirectly(
  files: FlattenedAttachment[],
  onProgress?: (percent: number, currentFile: string) => void
): Promise<number> {
  let count = 0;
  const total = files.length;

  for (let i = 0; i < total; i++) {
    const item = files[i];
    if (onProgress) {
      onProgress(Math.round(((i + 1) / total) * 100), item.name);
    }
    if (!item.dataUrl) continue;

    downloadSingleAttachment(item);
    count++;

    if (i < total - 1) {
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
  }

  return count;
}

/**
 * Downloads all files belonging to a specific dependency directly (Sin formato ZIP)
 */
export async function downloadDependencyFilesDirectly(
  dependenciaNombre: string,
  attachments: FlattenedAttachment[],
  onProgress?: (percent: number, currentFile: string) => void
): Promise<number> {
  const normTarget = dependenciaNombre.trim().toUpperCase();
  const depItems = attachments.filter(
    (a) => a.dependencia.trim().toUpperCase() === normTarget
  );

  if (depItems.length === 0) {
    throw new Error(`No hay archivos registrados para "${dependenciaNombre}".`);
  }

  return await downloadFilesDirectly(depItems, onProgress);
}

/**
 * Downloads a ZIP package for ONE SPECIFIC DEPENDENCY containing each of its attached files
 * organized inside a folder with the dependency's name.
 */
export async function downloadDependencyAsZip(
  dependenciaNombre: string,
  attachments: FlattenedAttachment[],
  onProgress?: (percent: number, currentFile: string) => void
): Promise<void> {
  const normTarget = dependenciaNombre.trim().toUpperCase();
  const depItems = attachments.filter(
    (a) => a.dependencia.trim().toUpperCase() === normTarget
  );

  if (depItems.length === 0) {
    throw new Error(`No hay archivos adjuntos registrados para "${dependenciaNombre}".`);
  }

  const zip = new JSZip();
  const dateStr = new Date().toISOString().split('T')[0];
  const safeDepFolder = sanitizeFileName(dependenciaNombre);
  const total = depItems.length;
  const usedFileNames = new Map<string, number>();

  for (let i = 0; i < total; i++) {
    const item = depItems[i];
    if (onProgress) {
      onProgress(Math.round(((i + 1) / total) * 100), item.name);
    }

    if (!item.dataUrl) continue;

    let base64Content = item.dataUrl;
    if (base64Content.includes(',')) {
      base64Content = base64Content.split(',')[1];
    }

    const rawFileName = sanitizeFileName(item.name || `adjunto_${i + 1}`);
    const key = rawFileName.toLowerCase();
    const count = usedFileNames.get(key) || 0;
    let finalFileName = rawFileName;

    if (count > 0) {
      const extDot = rawFileName.lastIndexOf('.');
      if (extDot > 0) {
        finalFileName = `${rawFileName.substring(0, extDot)}_(${count + 1})${rawFileName.substring(extDot)}`;
      } else {
        finalFileName = `${rawFileName}_(${count + 1})`;
      }
    }
    usedFileNames.set(key, count + 1);

    // Place file directly inside the dependency's folder
    const fullPath = `${safeDepFolder}/${finalFileName}`;
    zip.file(fullPath, base64Content, { base64: true });
  }

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Carpeta_${safeDepFolder}_${dateStr}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Downloads a ZIP package for an entire group of dependencies (all Centralizadas or all Descentralizadas),
 * where each dependency gets its own folder containing all its files.
 */
export async function downloadGroupAsZip(
  groupType: 'CENTRALIZADA' | 'DESCENTRALIZADA',
  attachments: FlattenedAttachment[],
  onProgress?: (percent: number, currentFile: string) => void
): Promise<void> {
  const filtered = attachments.filter((a) => a.tipoDependencia === groupType);

  if (filtered.length === 0) {
    const label = groupType === 'CENTRALIZADA' ? 'Dependencias Centralizadas' : 'Dependencias Descentralizadas';
    throw new Error(`No hay archivos adjuntos registrados para ${label}.`);
  }

  const labelPrefix = groupType === 'CENTRALIZADA' ? 'Dependencias_Centralizadas' : 'Dependencias_Descentralizadas';
  const dateStr = new Date().toISOString().split('T')[0];
  const zip = new JSZip();

  const total = filtered.length;
  const usedPaths = new Map<string, number>();

  for (let i = 0; i < total; i++) {
    const item = filtered[i];
    if (onProgress) {
      onProgress(Math.round(((i + 1) / total) * 100), item.name);
    }

    if (!item.dataUrl) continue;

    let base64Content = item.dataUrl;
    if (base64Content.includes(',')) {
      base64Content = base64Content.split(',')[1];
    }

    const safeDepFolder = sanitizeFileName(item.dependencia || 'Sin_Dependencia');
    const rawFileName = sanitizeFileName(item.name || `adjunto_${i + 1}`);
    const key = `${safeDepFolder}/${rawFileName}`.toLowerCase();
    const count = usedPaths.get(key) || 0;
    let finalFileName = rawFileName;

    if (count > 0) {
      const extDot = rawFileName.lastIndexOf('.');
      if (extDot > 0) {
        finalFileName = `${rawFileName.substring(0, extDot)}_(${count + 1})${rawFileName.substring(extDot)}`;
      } else {
        finalFileName = `${rawFileName}_(${count + 1})`;
      }
    }
    usedPaths.set(key, count + 1);

    const fullPath = `${safeDepFolder}/${finalFileName}`;
    zip.file(fullPath, base64Content, { base64: true });
  }

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Adjuntos_${labelPrefix}_${dateStr}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Bundles all attachments into a complete institutional master ZIP archive,
 * organized with dedicated folders for each Centralized and Decentralized dependency:
 *
 * Dependencias_Centralizadas/
 *   ├── DIRECCIÓN GENERAL/
 *   │     ├── informe_trimestral.pdf
 *   │     └── lista_asistencia.jpg
 *   ├── DIRECCIÓN EJECUTIVA DE DESPACHO/
 *   ...
 * Dependencias_Descentralizadas/
 *   ├── IAMTURMAT/
 *   ├── IACPMT/
 *   ...
 */
export async function downloadAttachmentsAsZip(
  attachments: FlattenedAttachment[],
  zipFilename?: string,
  onProgress?: (percent: number, currentFile: string) => void
): Promise<void> {
  if (!attachments || attachments.length === 0) {
    throw new Error('No hay archivos adjuntos para exportar.');
  }

  const zip = new JSZip();
  const dateStr = new Date().toISOString().split('T')[0];
  const finalZipName = zipFilename || `Adjuntos_Tinaquillo_Por_Dependencias_${dateStr}.zip`;

  const total = attachments.length;
  const usedPaths = new Map<string, number>();

  for (let i = 0; i < total; i++) {
    const item = attachments[i];
    if (onProgress) {
      onProgress(Math.round(((i + 1) / total) * 100), item.name);
    }

    if (!item.dataUrl) continue;

    // Structured by Classification -> Dependency Folder
    const groupFolder =
      item.tipoDependencia === 'CENTRALIZADA'
        ? 'Dependencias_Centralizadas'
        : 'Dependencias_Descentralizadas';

    const depFolder = sanitizeFileName(item.dependencia || 'Sin_Dependencia');
    const rawFileName = sanitizeFileName(item.name || `adjunto_${i + 1}`);

    const key = `${groupFolder}/${depFolder}/${rawFileName}`.toLowerCase();
    const count = usedPaths.get(key) || 0;
    let finalFileName = rawFileName;

    if (count > 0) {
      const extDot = rawFileName.lastIndexOf('.');
      if (extDot > 0) {
        finalFileName = `${rawFileName.substring(0, extDot)}_(${count + 1})${rawFileName.substring(extDot)}`;
      } else {
        finalFileName = `${rawFileName}_(${count + 1})`;
      }
    }
    usedPaths.set(key, count + 1);

    const fullPath = `${groupFolder}/${depFolder}/${finalFileName}`;
    let base64Content = item.dataUrl;
    if (base64Content.includes(',')) {
      base64Content = base64Content.split(',')[1];
    }

    zip.file(fullPath, base64Content, { base64: true });
  }

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = finalZipName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
