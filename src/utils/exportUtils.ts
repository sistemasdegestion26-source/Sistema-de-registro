import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { Solicitud, InformeDependencia, RegistroAsistencia, Funcionario } from '../types';
import { DEPENDENCIAS_MUNICIPALES } from '../data/dependenciasData';
import { formatFechaEspanol } from './storage';

// Helper to generate a semi-transparent PNG watermark
async function getWatermarkDataUrl(url: string, opacity = 0.12): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 600;
        canvas.height = img.naturalHeight || 600;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = opacity;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png'));
      } catch (e) {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// Helper to get image data URL as PNG or JPEG
async function getImageDataUrl(url: string, asPng = true): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 500;
        canvas.height = img.naturalHeight || 500;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL(asPng ? 'image/png' : 'image/jpeg', 0.95));
      } catch (e) {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// Helper to calculate proportional, comfortable column widths in Excel
function autoFitColumns(data: Record<string, any>[]): { wch: number }[] {
  if (!data || data.length === 0) return [];
  const keys = Object.keys(data[0]);
  return keys.map((key) => {
    let maxLen = key.length;
    data.forEach((row) => {
      const val = row[key];
      if (val !== undefined && val !== null) {
        const strVal = String(val);
        if (strVal.length > maxLen) {
          maxLen = Math.min(strVal.length, 45);
        }
      }
    });
    return { wch: Math.max(maxLen + 4, 12) };
  });
}

/**
 * Security: Neutralizes CSV / Spreadsheet Formula Injection (CWE-1236).
 * If a string begins with '=', '+', '-', '@', '\t', or '\r', spreadsheet software
 * may treat it as an executable formula upon opening. Prepending a single quote
 * forces spreadsheet engines (Excel, Calc) to treat the cell safely as literal text.
 */
export function sanitizeSpreadsheetValue(val: any): any {
  if (typeof val !== 'string') return val;
  const trimmed = val.trim();
  if (/^[=+\-@\t\r]/.test(trimmed)) {
    return `'${val}`;
  }
  return val;
}

export function sanitizeRows<T extends Record<string, any>>(rows: T[]): T[] {
  return rows.map((row) => {
    const cleanRow: Record<string, any> = {};
    for (const k of Object.keys(row)) {
      cleanRow[k] = sanitizeSpreadsheetValue(row[k]);
    }
    return cleanRow as T;
  });
}

// ==========================================
// 1. EXCEL EXPORTS
// ==========================================

// 1.1 Exportar Todo en Excel
export function exportarExcelReportes(
  solicitudes: Solicitud[],
  informes: InformeDependencia[]
): void {
  const wb = XLSX.utils.book_new();

  // Hoja 1: Solicitudes y Ayudas Ciudadanas
  const solicitudesData = solicitudes.map((s, idx) => ({
    'N°': idx + 1,
    'N° Expediente': s.id,
    'Nombres y Apellidos': s.nombresApellidos,
    'Cédula de Identidad': s.cedula,
    'Profesión u Oficio': s.profesionOficio || 'No especificado',
    'Teléfono': s.telefonoCompleto || `${s.telefonoPrefijo}-${s.telefonoNumero}`,
    'Tipo de Solicitud': s.tipoSolicitud,
    'Fecha de Solicitud': s.fechaSolicitud,
    'Estado / Remisión': s.estadoRemision,
    'Especificación de Remisión': s.otroRemitirEspecifique || '',
    'Observaciones / Referencia': s.observaciones,
    'Adjuntos (Cant.)': s.adjuntos?.length || 0,
    'Registrado Por': s.creadoPor,
    'Fecha de Registro': s.fechaRegistro,
  }));
  const cleanSolicitudes = sanitizeRows(solicitudesData);
  const wsSolicitudes = XLSX.utils.json_to_sheet(cleanSolicitudes);
  wsSolicitudes['!cols'] = autoFitColumns(cleanSolicitudes);
  XLSX.utils.book_append_sheet(wb, wsSolicitudes, 'Solicitudes y Ayudas');

  // Hoja 2: Cumplimiento de Dependencias
  const informesPorDependencia = new Map<string, number>();
  informes.forEach((inf) => {
    const depName = inf.dependencia.toUpperCase().trim();
    informesPorDependencia.set(depName, (informesPorDependencia.get(depName) || 0) + 1);
  });

  const cumplimientoData = DEPENDENCIAS_MUNICIPALES.map((dep, idx) => {
    const cant = informesPorDependencia.get(dep.nombre.toUpperCase().trim()) || 0;
    return {
      'N°': idx + 1,
      'Dependencia / Ente': dep.nombre,
      'Clasificación': dep.tipo,
      'Estado de Carga': cant > 0 ? 'CARGÓ INFORME' : 'PENDIENTE POR CARGAR',
      'Informes Registrados': cant,
    };
  });
  const cleanCumplimiento = sanitizeRows(cumplimientoData);
  const wsCumplimiento = XLSX.utils.json_to_sheet(cleanCumplimiento);
  wsCumplimiento['!cols'] = autoFitColumns(cleanCumplimiento);
  XLSX.utils.book_append_sheet(wb, wsCumplimiento, 'Control de Carga');

  // Hoja 3: Informes de Gestión y Auditorías
  const informesData = informes.map((inf, idx) => ({
    'N°': idx + 1,
    'ID Informe': inf.id,
    'Dependencia': inf.dependencia,
    'Clasificación': inf.clasificacion || 'CENTRALIZADA',
    'Cargo': inf.cargo || 'N/A',
    'Responsable': inf.nombresApellidos,
    'Cédula': inf.cedula,
    'Teléfono': inf.telefono,
    'N° Resolución': inf.numeroResolucion || 'N/A',
    'Fecha Resolución': inf.fechaResolucion || 'N/A',
    'Tipo de Informe': inf.tipoInforme,
    'Trimestre / Periodo': inf.trimestre ? `${inf.trimestre} (${inf.anioGestion || ''})` : 'N/A',
    'Metas Prog. / Ejec.': inf.metasFisicasProgramadas
      ? `${inf.metasFisicasEjecutadas || 0} / ${inf.metasFisicasProgramadas} (${inf.alcancePorcentaje || 0}%)`
      : 'N/A',
    'Procedimientos Auditados': inf.procedimientosAuditados ? inf.procedimientosAuditados.join('; ') : 'N/A',
    'Hallazgos': inf.hallazgos || 'N/A',
    'Fecha Auditoría': inf.fechaAuditoria || 'N/A',
    'Registrado Por': inf.creadoPor,
  }));
  const cleanInformes = sanitizeRows(informesData);
  const wsInformes = XLSX.utils.json_to_sheet(cleanInformes);
  wsInformes['!cols'] = autoFitColumns(cleanInformes);
  XLSX.utils.book_append_sheet(wb, wsInformes, 'Informes Registrados');

  // Hoja 4: Frecuencia por Cédula
  const ayudasPorCedula: Record<string, { nombre: string; profesion?: string; cant: number; tipos: Set<string> }> = {};
  solicitudes.forEach((s) => {
    if (!ayudasPorCedula[s.cedula]) {
      ayudasPorCedula[s.cedula] = {
        nombre: s.nombresApellidos,
        profesion: s.profesionOficio,
        cant: 0,
        tipos: new Set(),
      };
    }
    ayudasPorCedula[s.cedula].cant += 1;
    ayudasPorCedula[s.cedula].tipos.add(s.tipoSolicitud);
  });

  const ayudasData = Object.entries(ayudasPorCedula)
    .sort((a, b) => b[1].cant - a[1].cant)
    .map(([cedula, data], idx) => ({
      'N°': idx + 1,
      'Cédula de Identidad': cedula,
      'Nombres y Apellidos': data.nombre,
      'Profesión u Oficio': data.profesion || 'No especificado',
      'Total de Solicitudes': data.cant,
      'Tipos de Ayudas Solicitadas': Array.from(data.tipos).join(', '),
    }));
  const cleanAyudas = sanitizeRows(ayudasData);
  const wsAyudas = XLSX.utils.json_to_sheet(cleanAyudas);
  wsAyudas['!cols'] = autoFitColumns(cleanAyudas);
  XLSX.utils.book_append_sheet(wb, wsAyudas, 'Ayudas por Beneficiario');

  const fechaHoy = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `Reporte_General_Tinaquillo_${fechaHoy}.xlsx`);
}

// 1.2 Exportar SOLO Solicitudes y Ayudas en Excel
export function exportarExcelSoloSolicitudes(solicitudes: Solicitud[]): void {
  const wb = XLSX.utils.book_new();

  const data = solicitudes.map((s, idx) => ({
    'N°': idx + 1,
    'N° Expediente': s.id,
    'Nombres y Apellidos': s.nombresApellidos,
    'Cédula': s.cedula,
    'Profesión u Oficio': s.profesionOficio || 'No especificado',
    'Teléfono': s.telefonoCompleto || `${s.telefonoPrefijo}-${s.telefonoNumero}`,
    'Tipo de Solicitud': s.tipoSolicitud,
    'Fecha Solicitud': s.fechaSolicitud,
    'Estado / Remisión': s.estadoRemision,
    'Detalle Remisión': s.otroRemitirEspecifique || '',
    'Observaciones': s.observaciones,
    'Registrado Por': s.creadoPor,
    'Fecha de Registro': s.fechaRegistro,
  }));

  const cleanData = sanitizeRows(data);
  const ws = XLSX.utils.json_to_sheet(cleanData);
  ws['!cols'] = autoFitColumns(cleanData);
  XLSX.utils.book_append_sheet(wb, ws, 'Solicitudes y Ayudas');

  const fechaHoy = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `Solicitudes_y_Ayudas_Tinaquillo_${fechaHoy}.xlsx`);
}

// 1.3 Exportar SOLO Informes y Cumplimiento en Excel
export function exportarExcelSoloInformes(informes: InformeDependencia[]): void {
  const wb = XLSX.utils.book_new();

  const informesPorDependencia = new Map<string, number>();
  informes.forEach((inf) => {
    const depName = inf.dependencia.toUpperCase().trim();
    informesPorDependencia.set(depName, (informesPorDependencia.get(depName) || 0) + 1);
  });

  const controlCarga = DEPENDENCIAS_MUNICIPALES.map((dep, idx) => {
    const cant = informesPorDependencia.get(dep.nombre.toUpperCase().trim()) || 0;
    return {
      'N°': idx + 1,
      'Dependencia': dep.nombre,
      'Clasificación': dep.tipo,
      'Estado': cant > 0 ? 'CARGÓ INFORME' : 'PENDIENTE',
      'Total Informes': cant,
    };
  });

  const cleanControl = sanitizeRows(controlCarga);
  const wsControl = XLSX.utils.json_to_sheet(cleanControl);
  wsControl['!cols'] = autoFitColumns(cleanControl);
  XLSX.utils.book_append_sheet(wb, wsControl, 'Control Cumplimiento');

  const detalleInformes = informes.map((inf, idx) => ({
    'N°': idx + 1,
    'ID': inf.id,
    'Dependencia': inf.dependencia,
    'Clasificación': inf.clasificacion || 'CENTRALIZADA',
    'Responsable': inf.nombresApellidos,
    'Cargo': inf.cargo || 'N/A',
    'Cédula': inf.cedula,
    'Teléfono': inf.telefono,
    'N° Resolución': inf.numeroResolucion || 'N/A',
    'Fecha Resolución': inf.fechaResolucion || 'N/A',
    'Tipo Informe': inf.tipoInforme,
    'Periodo': inf.trimestre ? `${inf.trimestre} (${inf.anioGestion || ''})` : 'N/A',
    'Metas': inf.metasFisicasProgramadas
      ? `${inf.metasFisicasEjecutadas || 0} / ${inf.metasFisicasProgramadas} (${inf.alcancePorcentaje || 0}%)`
      : 'N/A',
    'Fecha Auditoría': inf.fechaAuditoria || 'N/A',
    'Registrado Por': inf.creadoPor,
  }));

  const cleanDetalle = sanitizeRows(detalleInformes);
  const wsDetalle = XLSX.utils.json_to_sheet(cleanDetalle);
  wsDetalle['!cols'] = autoFitColumns(cleanDetalle);
  XLSX.utils.book_append_sheet(wb, wsDetalle, 'Detalle Informes');

  const fechaHoy = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `Control_Informes_Tinaquillo_${fechaHoy}.xlsx`);
}

// 1.3.B Exportar Excel Específico de Cumplimiento de Registro de Comunicación Interna de Directorio y Métricas
export function exportarExcelMemorandumYMetricas(informes: InformeDependencia[]): void {
  const wb = XLSX.utils.book_new();

  // Hoja 1: Cumplimiento de Registro de Comunicación Interna de Directorio
  const memoData = DEPENDENCIAS_MUNICIPALES.map((dep, idx) => {
    const memo = informes.find(
      (inf) =>
        inf.dependencia.toUpperCase().trim() === dep.nombre.toUpperCase().trim() &&
        (inf.tipoInforme === 'MEMORANDUM INTERNO' ||
          inf.tipoInforme === 'REGISTRO DE COMUNICACIÓN INTERNA DE DIRECTORIO')
    );

    const tieneFirmas = (memo?.fotoFirmaPersonal && memo.fotoFirmaPersonal.length > 0) || false;
    const cantFirmas = memo?.fotoFirmaPersonal?.length || 0;

    return {
      'N°': idx + 1,
      'Entidad Municipal': dep.nombre,
      'Clasificación': dep.tipo,
      'Cumplió Comunicación Interna': memo ? 'SÍ (CONSIGNADO)' : 'NO (PENDIENTE)',
      'Fecha Consignación': memo?.fechaRegistro ? formatFechaEspanol(memo.fechaRegistro) : 'PENDIENTE',
      'Responsable / Funcionario': memo?.nombresApellidos || 'No registrado',
      'Cédula': memo?.cedula || 'N/A',
      'N° Resolución': memo?.numeroResolucion || 'N/A',
      'Puntos Registrados': memo ? (memo.punto1 ? 'Punto 1 y 2' : 'Registrado') : 'N/A',
      'Puntos Adicionales': memo?.puntosAdicionales?.length || 0,
      'Constancia de Firmas': tieneFirmas ? `SÍ (${cantFirmas} fotos)` : 'NO CONSIGNADA',
      'Registrado Por': memo?.creadoPor || 'N/A',
    };
  });

  const cleanMemo = sanitizeRows(memoData);
  const wsMemo = XLSX.utils.json_to_sheet(cleanMemo);
  wsMemo['!cols'] = autoFitColumns(cleanMemo);
  XLSX.utils.book_append_sheet(wb, wsMemo, 'Cumplimiento Com. Interna');

  // Hoja 2: Métricas Detalladas por Dependencia, Instituto y Empresa
  const metricasData = DEPENDENCIAS_MUNICIPALES.map((dep, idx) => {
    const depInformes = informes.filter(
      (inf) => inf.dependencia.toUpperCase().trim() === dep.nombre.toUpperCase().trim()
    );

    const memoCount = depInformes.filter(
      (inf) =>
        inf.tipoInforme === 'MEMORANDUM INTERNO' ||
        inf.tipoInforme === 'REGISTRO DE COMUNICACIÓN INTERNA DE DIRECTORIO'
    ).length;
    const trimestralCount = depInformes.filter((inf) => inf.tipoInforme === 'REPORTE DE GESTIÓN TRIMESTRAL').length;
    const auditoriasCount = depInformes.filter(
      (inf) =>
        inf.tipoInforme === 'INFORME PARCIAL DE AUDITORIA' ||
        inf.tipoInforme === 'INFORME PARCIAL DE LA AUDITORIA OPERATIVA DE LA CONTRALORÍA MUNICIPAL' ||
        inf.tipoInforme === 'INFORME DE AUDITORÍA DEFINITIVO'
    ).length;

    const cumplioMemo = memoCount > 0;
    const nivelCumplimiento =
      cumplioMemo && trimestralCount > 0
        ? '100% (ÓPTIMO)'
        : cumplioMemo || trimestralCount > 0
        ? '50% (PARCIAL)'
        : '0% (PENDIENTE)';

    return {
      'N°': idx + 1,
      'Entidad Municipal': dep.nombre,
      'Clasificación': dep.tipo,
      'Registro de Comunicación Interna de Directorio': cumplioMemo ? 'CONSIGNADO' : 'PENDIENTE',
      'Reportes Trimestrales (Cant.)': trimestralCount,
      'Auditorías (Cant.)': auditoriasCount,
      'Total Informes Registrados': depInformes.length,
      'Nivel de Cumplimiento': nivelCumplimiento,
    };
  });

  const cleanMetricas = sanitizeRows(metricasData);
  const wsMetricas = XLSX.utils.json_to_sheet(cleanMetricas);
  wsMetricas['!cols'] = autoFitColumns(cleanMetricas);
  XLSX.utils.book_append_sheet(wb, wsMetricas, 'Métricas por Entidad');

  // Hoja 3: Resumen Consolidado por Sector
  const tipos: Array<{ tipo: string; label: string }> = [
    { tipo: 'CENTRALIZADA', label: 'DEPENDENCIAS CENTRALIZADAS' },
    { tipo: 'INSTITUTO', label: 'INSTITUTOS AUTÓNOMOS' },
    { tipo: 'EMPRESA', label: 'EMPRESAS MUNICIPALES' },
  ];

  const sectorData = tipos.map((t, idx) => {
    const depsSector = DEPENDENCIAS_MUNICIPALES.filter((d) => d.tipo === t.tipo);
    const totalSector = depsSector.length;

    const cumplieronMemo = depsSector.filter((d) =>
      informes.some(
        (inf) =>
          inf.dependencia.toUpperCase().trim() === d.nombre.toUpperCase().trim() &&
          (inf.tipoInforme === 'MEMORANDUM INTERNO' ||
            inf.tipoInforme === 'REGISTRO DE COMUNICACIÓN INTERNA DE DIRECTORIO')
      )
    ).length;

    const sectorInformes = informes.filter((inf) =>
      depsSector.some((d) => d.nombre.toUpperCase().trim() === inf.dependencia.toUpperCase().trim())
    );

    const trimestrales = sectorInformes.filter((inf) => inf.tipoInforme === 'REPORTE DE GESTIÓN TRIMESTRAL').length;
    const auditorias = sectorInformes.filter(
      (inf) =>
        inf.tipoInforme === 'INFORME PARCIAL DE AUDITORIA' ||
        inf.tipoInforme === 'INFORME PARCIAL DE LA AUDITORIA OPERATIVA DE LA CONTRALORÍA MUNICIPAL' ||
        inf.tipoInforme === 'INFORME DE AUDITORÍA DEFINITIVO'
    ).length;

    const pctMemo = totalSector > 0 ? Math.round((cumplieronMemo / totalSector) * 100) : 0;

    return {
      'N°': idx + 1,
      'Sector / Clasificación': t.label,
      'Total Entidades': totalSector,
      'Cumplieron Comunicación Interna': cumplieronMemo,
      'Comunicación Interna Pendiente': totalSector - cumplieronMemo,
      '% Cumplimiento Comunicación Interna': `${pctMemo}%`,
      'Reportes Trimestrales': trimestrales,
      'Auditorías Registradas': auditorias,
      'Total Informes del Sector': sectorInformes.length,
    };
  });

  const cleanSector = sanitizeRows(sectorData);
  const wsSector = XLSX.utils.json_to_sheet(cleanSector);
  wsSector['!cols'] = autoFitColumns(cleanSector);
  XLSX.utils.book_append_sheet(wb, wsSector, 'Resumen por Sector');

  const fechaHoy = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `Reporte_Comunicacion_Interna_Directorio_y_Metricas_Tinaquillo_${fechaHoy}.xlsx`);
}

// 1.4 Exportar Asistencias en Excel
export function exportarExcelAsistencias(asistencias: RegistroAsistencia[]): void {
  const wb = XLSX.utils.book_new();

  // Hoja 1: Actividades
  const actividadesData = asistencias.map((a, idx) => ({
    'N°': idx + 1,
    'ID Registro': a.id,
    'Tipo de Actividad': a.tipoActividad,
    'Nombre de la Actividad': a.nombreActividad,
    'Fecha': a.fecha,
    'Lugar': a.lugar,
    'Total Asistentes': a.asistentes.length,
    'Tiene Foto Adjunta': a.foto ? 'SÍ' : 'NO',
    'Registrado Por': a.creadoPor,
    'Fecha de Registro': a.fechaRegistro,
  }));
  const cleanActividades = sanitizeRows(actividadesData);
  const wsActividades = XLSX.utils.json_to_sheet(cleanActividades);
  wsActividades['!cols'] = autoFitColumns(cleanActividades);
  XLSX.utils.book_append_sheet(wb, wsActividades, 'Actividades');

  // Hoja 2: Detalle de Asistentes
  const asistentesDetallados: any[] = [];
  asistencias.forEach((a) => {
    a.asistentes.forEach((p, pIdx) => {
      asistentesDetallados.push({
        'N° General': asistentesDetallados.length + 1,
        'Actividad ID': a.id,
        'Tipo de Actividad': a.tipoActividad,
        'Nombre Actividad': a.nombreActividad,
        'Fecha Actividad': a.fecha,
        'Lugar': a.lugar,
        'N° Asistente': pIdx + 1,
        'Nombres y Apellidos': p.nombresApellidos,
        'Cédula de Identidad': p.cedula,
        'Teléfono de Contacto': p.telefono,
      });
    });
  });
  const cleanAsistentes = sanitizeRows(asistentesDetallados);
  const wsAsistentes = XLSX.utils.json_to_sheet(cleanAsistentes);
  wsAsistentes['!cols'] = autoFitColumns(cleanAsistentes);
  XLSX.utils.book_append_sheet(wb, wsAsistentes, 'Asistentes Detallados');

  const fechaHoy = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `Registro_Asistencias_Tinaquillo_${fechaHoy}.xlsx`);
}

// 1.5 Exportar Excel General Maestro
export function exportarExcelGeneralMaestro(
  solicitudes: Solicitud[],
  informes: InformeDependencia[],
  asistencias?: RegistroAsistencia[]
): void {
  const wb = XLSX.utils.book_new();

  // Hoja 1: Solicitudes y Ayudas
  const solicitudesData = solicitudes.map((s, idx) => ({
    'N°': idx + 1,
    'N° Expediente': s.id,
    'Nombres y Apellidos': s.nombresApellidos,
    'Cédula de Identidad': s.cedula,
    'Profesión u Oficio': s.profesionOficio || 'No especificado',
    'Teléfono': s.telefonoCompleto || `${s.telefonoPrefijo}-${s.telefonoNumero}`,
    'Tipo de Solicitud': s.tipoSolicitud,
    'Fecha de Solicitud': s.fechaSolicitud,
    'Estado / Remisión': s.estadoRemision,
    'Especificación de Remisión': s.otroRemitirEspecifique || '',
    'Observaciones / Referencia': s.observaciones,
    'Adjuntos (Cant.)': s.adjuntos?.length || 0,
    'Registrado Por': s.creadoPor,
    'Fecha de Registro': s.fechaRegistro,
  }));
  const cleanSolicitudes = sanitizeRows(solicitudesData);
  const wsSolicitudes = XLSX.utils.json_to_sheet(cleanSolicitudes);
  wsSolicitudes['!cols'] = autoFitColumns(cleanSolicitudes);
  XLSX.utils.book_append_sheet(wb, wsSolicitudes, 'Solicitudes y Ayudas');

  // Hoja 2: Informes de Gestión
  const informesData = informes.map((inf, idx) => ({
    'N°': idx + 1,
    'ID Informe': inf.id,
    'Dependencia': inf.dependencia,
    'Clasificación': inf.clasificacion || 'CENTRALIZADA',
    'Cargo': inf.cargo || 'N/A',
    'Responsable': inf.nombresApellidos,
    'Cédula': inf.cedula,
    'Teléfono': inf.telefono,
    'N° Resolución': inf.numeroResolucion || 'N/A',
    'Fecha Resolución': inf.fechaResolucion || 'N/A',
    'Tipo de Informe': inf.tipoInforme,
    'Trimestre / Periodo': inf.trimestre ? `${inf.trimestre} (${inf.anioGestion || ''})` : 'N/A',
    'Metas Prog. / Ejec.': inf.metasFisicasProgramadas
      ? `${inf.metasFisicasEjecutadas || 0} / ${inf.metasFisicasProgramadas} (${inf.alcancePorcentaje || 0}%)`
      : 'N/A',
    'Procedimientos Auditados': inf.procedimientosAuditados ? inf.procedimientosAuditados.join('; ') : 'N/A',
    'Hallazgos': inf.hallazgos || 'N/A',
    'Fecha Auditoría': inf.fechaAuditoria || 'N/A',
    'Registrado Por': inf.creadoPor,
  }));
  const cleanInformes = sanitizeRows(informesData);
  const wsInformes = XLSX.utils.json_to_sheet(cleanInformes);
  wsInformes['!cols'] = autoFitColumns(cleanInformes);
  XLSX.utils.book_append_sheet(wb, wsInformes, 'Informes Registrados');

  // Hoja 3: Asistencias a Actividades
  if (asistencias && asistencias.length > 0) {
    const actData = asistencias.map((a, idx) => ({
      'N°': idx + 1,
      'ID Registro': a.id,
      'Tipo Actividad': a.tipoActividad,
      'Nombre Actividad': a.nombreActividad,
      'Fecha': a.fecha,
      'Lugar': a.lugar,
      'Total Asistentes': a.asistentes.length,
      'Registrado Por': a.creadoPor,
      'Fecha Registro': a.fechaRegistro,
    }));
    const cleanAct = sanitizeRows(actData);
    const wsAct = XLSX.utils.json_to_sheet(cleanAct);
    wsAct['!cols'] = autoFitColumns(cleanAct);
    XLSX.utils.book_append_sheet(wb, wsAct, 'Asistencias Actividades');
  }

  const fechaHoy = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `Libro_Maestro_Tinaquillo_DG_${fechaHoy}.xlsx`);
}

// ==========================================
// 2. PDF EXPORTS
// ==========================================

// Helper to draw the standard official header
function drawOfficialHeader(doc: jsPDF, title: string, subtitle: string, logoDataUrl?: string | null) {
  const pageWidth = doc.internal.pageSize.getWidth();

  // Institutional Deep Emerald Top Stripe
  doc.setFillColor(10, 85, 45);
  doc.rect(0, 0, pageWidth, 26, 'F');

  // Metallic Gold accent line
  doc.setFillColor(217, 140, 20);
  doc.rect(0, 26, pageWidth, 2.5, 'F');

  if (logoDataUrl) {
    try {
      // Symmetrical Escudo de Tinaquillo on left and right
      doc.addImage(logoDataUrl, 'PNG', 9, 2.5, 17, 21);
      doc.addImage(logoDataUrl, 'PNG', pageWidth - 26, 2.5, 17, 21);
    } catch (e) {
      try {
        doc.addImage(logoDataUrl, 'JPEG', 9, 2.5, 17, 21);
        doc.addImage(logoDataUrl, 'JPEG', pageWidth - 26, 2.5, 17, 21);
      } catch (err) {
        // safe fallback
      }
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('REPÚBLICA BOLIVARIANA DE VENEZUELA • ESTADO BOLIVARIANO DE COJEDES', pageWidth / 2, 7.5, { align: 'center' });

  doc.setFontSize(10.5);
  doc.text('DIRECCIÓN GENERAL • ALCALDÍA DEL MUNICIPIO AUTÓNOMO TINAQUILLO', pageWidth / 2, 13.8, { align: 'center' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(254, 240, 138); // Golden metallic tone
  doc.text(`${title.toUpperCase()} • ${subtitle.toUpperCase()}`, pageWidth / 2, 19.8, { align: 'center' });

  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(220, 252, 231);
  doc.text('SISTEMA OFICIAL DE REGISTRO, CONTROL Y ATENCIÓN INSTITUCIONAL', pageWidth / 2, 24.2, { align: 'center' });

  doc.setTextColor(30, 41, 59);
}

// Helper to apply watermark in the center of the page
function applyWatermark(doc: jsPDF, watermarkDataUrl?: string | null) {
  if (!watermarkDataUrl) return;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const sizeW = 100;
  const sizeH = 125;
  const x = (pageWidth - sizeW) / 2;
  const y = (pageHeight - sizeH) / 2 + 10;
  try {
    doc.addImage(watermarkDataUrl, 'PNG', x, y, sizeW, sizeH);
  } catch (e) {
    // ignore
  }
}

// 2.1 EXPORTAR REPORTE INTEGRAL GENERAL (Estadísticas y Control)
export async function exportarPDFReportes(
  solicitudes: Solicitud[],
  informes: InformeDependencia[]
): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  const [watermark, logo] = await Promise.all([
    getWatermarkDataUrl('/escudo.png', 0.08).catch(() => null),
    getImageDataUrl('/escudo.png', true).catch(() => getImageDataUrl('/escudo.jpg', false)).catch(() => null),
  ]);

  // Page 1: Solicitudes
  drawOfficialHeader(doc, 'Informe Estadístico de Gestión', 'Atención al Ciudadano y Dependencias', logo);
  applyWatermark(doc, watermark);

  let currentY = 35;
  const fechaEmision = formatFechaEspanol(new Date().toISOString());
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`Fecha de Emisión: ${fechaEmision}`, margin, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(`Usuario: Dirección General`, pageWidth - margin, currentY, { align: 'right' });

  currentY += 8;

  // Metric Boxes
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('1. RESUMEN ESTADÍSTICO DE SOLICITUDES Y AYUDAS', margin, currentY);
  currentY += 5;

  const total = solicitudes.length;
  const atendidas = solicitudes.filter((s) => s.estadoRemision === 'ATENDIDO').length;
  const pendientes = solicitudes.filter((s) => s.estadoRemision === 'PENDIENTE').length;
  const rechazadas = solicitudes.filter((s) => s.estadoRemision === 'RECHAZADA').length;
  const remitidas = total - (atendidas + pendientes + rechazadas);

  const boxWidth = (pageWidth - margin * 2 - 12) / 5;
  const boxHeight = 15;

  const metrics = [
    { label: 'Total', value: total, bg: [241, 245, 249], text: [15, 23, 42] },
    { label: 'Atendidas', value: atendidas, bg: [220, 252, 231], text: [22, 101, 52] },
    { label: 'Pendientes', value: pendientes, bg: [254, 249, 195], text: [133, 77, 14] },
    { label: 'Rechazadas', value: rechazadas, bg: [254, 226, 226], text: [153, 27, 27] },
    { label: 'Remitidas', value: remitidas, bg: [224, 242, 254], text: [3, 105, 161] },
  ];

  metrics.forEach((m, i) => {
    const bx = margin + i * (boxWidth + 3);
    doc.setFillColor(m.bg[0], m.bg[1], m.bg[2]);
    doc.roundedRect(bx, currentY, boxWidth, boxHeight, 2, 2, 'F');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(m.text[0], m.text[1], m.text[2]);
    doc.text(m.label, bx + boxWidth / 2, currentY + 5, { align: 'center' });
    doc.setFontSize(11);
    doc.text(String(m.value), bx + boxWidth / 2, currentY + 11.5, { align: 'center' });
  });

  currentY += boxHeight + 8;

  // Table header
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Detalle de Solicitudes Registradas:', margin, currentY);
  currentY += 5;

  doc.setFillColor(241, 245, 249);
  doc.rect(margin, currentY, pageWidth - margin * 2, 6, 'F');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Cédula', margin + 2, currentY + 4.2);
  doc.text('Nombres y Apellidos', margin + 24, currentY + 4.2);
  doc.text('Profesión / Oficio', margin + 74, currentY + 4.2);
  doc.text('Tipo de Solicitud', margin + 115, currentY + 4.2);
  doc.text('Estado / Remisión', margin + 150, currentY + 4.2);

  currentY += 7;
  doc.setFont('helvetica', 'normal');

  solicitudes.slice(0, 16).forEach((sol, i) => {
    if (i % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, currentY - 3.5, pageWidth - margin * 2, 5.5, 'F');
    }
    doc.setFontSize(7);
    doc.setTextColor(30, 41, 59);
    doc.text(sol.cedula, margin + 2, currentY);
    const shortName = sol.nombresApellidos.length > 24 ? sol.nombresApellidos.slice(0, 22) + '...' : sol.nombresApellidos;
    doc.text(shortName, margin + 24, currentY);
    const shortProf = (sol.profesionOficio || 'N/E').length > 20 ? (sol.profesionOficio || '').slice(0, 18) + '..' : (sol.profesionOficio || 'N/E');
    doc.text(shortProf, margin + 74, currentY);
    doc.text(sol.tipoSolicitud, margin + 115, currentY);

    if (sol.estadoRemision === 'ATENDIDO') doc.setTextColor(22, 101, 52);
    else if (sol.estadoRemision === 'RECHAZADA') doc.setTextColor(153, 27, 27);
    else if (sol.estadoRemision === 'PENDIENTE') doc.setTextColor(133, 77, 14);
    else doc.setTextColor(3, 105, 161);

    const remText = sol.estadoRemision.length > 20 ? sol.estadoRemision.slice(0, 18) + '...' : sol.estadoRemision;
    doc.text(remText, margin + 150, currentY);
    doc.setTextColor(30, 41, 59);
    currentY += 5.2;
  });

  // Footer
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100, 116, 139);
  doc.text('Alcaldía del Municipio Autónomo Tinaquillo • Control y Gestión Oficial', pageWidth / 2, pageHeight - 6, { align: 'center' });

  // Page 2: Control de Carga de Informes
  doc.addPage();
  drawOfficialHeader(doc, 'Control de Cumplimiento Institucional', 'Carga de Informes de Gestión y Auditorías', logo);
  applyWatermark(doc, watermark);

  currentY = 35;
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('2. ESTADO DE CUMPLIMIENTO POR DEPENDENCIA E INSTITUTOS', margin, currentY);
  currentY += 6;

  const informesPorDep = new Map<string, number>();
  informes.forEach((inf) => {
    const depName = inf.dependencia.toUpperCase().trim();
    informesPorDep.set(depName, (informesPorDep.get(depName) || 0) + 1);
  });

  const cargaronCount = DEPENDENCIAS_MUNICIPALES.filter(
    (d) => (informesPorDep.get(d.nombre.toUpperCase().trim()) || 0) > 0
  ).length;
  const noCargaronCount = DEPENDENCIAS_MUNICIPALES.length - cargaronCount;

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Total Dependencias: ${DEPENDENCIAS_MUNICIPALES.length} | Cargaron Informe: ${cargaronCount} | Pendientes por Cargar: ${noCargaronCount}`,
    margin,
    currentY
  );
  currentY += 7;

  // Grid of all dependencies
  const colWidth = (pageWidth - margin * 2 - 6) / 2;
  const rowHeight = 6.2;
  const depsPerCol = Math.ceil(DEPENDENCIAS_MUNICIPALES.length / 2);

  DEPENDENCIAS_MUNICIPALES.forEach((dep, idx) => {
    const isSecondCol = idx >= depsPerCol;
    const colX = isSecondCol ? margin + colWidth + 6 : margin;
    const rowY = currentY + (idx % depsPerCol) * rowHeight;
    const cargado = (informesPorDep.get(dep.nombre.toUpperCase().trim()) || 0) > 0;

    doc.setFillColor(cargado ? 220 : 254, cargado ? 252 : 242, cargado ? 231 : 242);
    doc.roundedRect(colX, rowY - 4, colWidth, 5.2, 1, 1, 'F');

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(cargado ? 22 : 153, cargado ? 101 : 27, cargado ? 52 : 27);
    doc.text(cargado ? '[CARGÓ]' : '[PENDIENTE]', colX + 2, rowY);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    const depShort = dep.nombre.length > 34 ? dep.nombre.slice(0, 32) + '...' : dep.nombre;
    doc.text(depShort, colX + 24, rowY);
  });

  // Official Institutional Footer on all pages
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 11, pageWidth - margin, pageHeight - 11);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(51, 65, 85);
    doc.text(
      'Alcaldía del Municipio Autónomo Tinaquillo • Despacho de la Dirección General',
      margin,
      pageHeight - 6.5
    );

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Página ${i} de ${pageCount} • Formato Oficial de Exportación - Informe General`,
      pageWidth - margin,
      pageHeight - 6.5,
      { align: 'right' }
    );
  }

  const fechaHoy = new Date().toISOString().split('T')[0];
  doc.save(`Informe_General_Tinaquillo_${fechaHoy}.pdf`);
}

// 2.2 EXPORTAR SOLO SOLICITUDES Y AYUDAS EN PDF
export async function exportarPDFSoloSolicitudes(solicitudes: Solicitud[]): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  const [watermark, logo] = await Promise.all([
    getWatermarkDataUrl('/escudo.png', 0.08).catch(() => null),
    getImageDataUrl('/escudo.png', true).catch(() => getImageDataUrl('/escudo.jpg', false)).catch(() => null),
  ]);

  drawOfficialHeader(doc, 'Reporte de Solicitudes y Ayudas Ciudadanas', 'Atención al Ciudadano', logo);
  applyWatermark(doc, watermark);

  let currentY = 35;
  const fechaEmision = formatFechaEspanol(new Date().toISOString());
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`Fecha de Emisión: ${fechaEmision}`, margin, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total Solicitudes: ${solicitudes.length}`, pageWidth - margin, currentY, { align: 'right' });

  currentY += 8;

  // Table Header
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, currentY, pageWidth - margin * 2, 6, 'F');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Cédula', margin + 2, currentY + 4.2);
  doc.text('Nombres y Apellidos', margin + 24, currentY + 4.2);
  doc.text('Profesión / Oficio', margin + 74, currentY + 4.2);
  doc.text('Tipo de Solicitud', margin + 115, currentY + 4.2);
  doc.text('Fecha', margin + 148, currentY + 4.2);
  doc.text('Estado', margin + 168, currentY + 4.2);

  currentY += 7;
  doc.setFont('helvetica', 'normal');

  solicitudes.forEach((sol, i) => {
    if (currentY > pageHeight - 20) {
      doc.addPage();
      drawOfficialHeader(doc, 'Reporte de Solicitudes y Ayudas Ciudadanas', 'Atención al Ciudadano', logo);
      applyWatermark(doc, watermark);
      currentY = 35;
    }

    if (i % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, currentY - 3.5, pageWidth - margin * 2, 5.5, 'F');
    }

    doc.setFontSize(7);
    doc.setTextColor(30, 41, 59);
    doc.text(sol.cedula, margin + 2, currentY);
    const shortName = sol.nombresApellidos.length > 25 ? sol.nombresApellidos.slice(0, 23) + '..' : sol.nombresApellidos;
    doc.text(shortName, margin + 24, currentY);
    const shortProf = (sol.profesionOficio || 'N/E').length > 20 ? (sol.profesionOficio || '').slice(0, 18) + '..' : (sol.profesionOficio || 'N/E');
    doc.text(shortProf, margin + 74, currentY);
    doc.text(sol.tipoSolicitud, margin + 115, currentY);
    doc.text(sol.fechaSolicitud, margin + 148, currentY);

    if (sol.estadoRemision === 'ATENDIDO') doc.setTextColor(22, 101, 52);
    else if (sol.estadoRemision === 'RECHAZADA') doc.setTextColor(153, 27, 27);
    else if (sol.estadoRemision === 'PENDIENTE') doc.setTextColor(133, 77, 14);
    else doc.setTextColor(3, 105, 161);

    const remText = sol.estadoRemision.length > 15 ? sol.estadoRemision.slice(0, 13) + '..' : sol.estadoRemision;
    doc.text(remText, margin + 168, currentY);
    doc.setTextColor(30, 41, 59);
    currentY += 5.5;
  });

  const fechaHoy = new Date().toISOString().split('T')[0];
  doc.save(`Solicitudes_y_Ayudas_Tinaquillo_${fechaHoy}.pdf`);
}

// 2.3 EXPORTAR SOLO CONTROL DE INFORMES EN PDF
export async function exportarPDFSoloInformes(informes: InformeDependencia[]): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  const [watermark, logo] = await Promise.all([
    getWatermarkDataUrl('/escudo.png', 0.08).catch(() => null),
    getImageDataUrl('/escudo.png', true).catch(() => getImageDataUrl('/escudo.jpg', false)).catch(() => null),
  ]);

  drawOfficialHeader(doc, 'Control de Carga de Informes y Auditorías', 'Dependencias e Institutos', logo);
  applyWatermark(doc, watermark);

  let currentY = 35;
  const fechaEmision = formatFechaEspanol(new Date().toISOString());
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`Fecha de Emisión: ${fechaEmision}`, margin, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total Informes Registrados: ${informes.length}`, pageWidth - margin, currentY, { align: 'right' });

  currentY += 8;

  // Table Header
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, currentY, pageWidth - margin * 2, 6, 'F');
  doc.setFontSize(7.2);
  doc.setFont('helvetica', 'bold');
  doc.text('Dependencia', margin + 2, currentY + 4.2);
  doc.text('Clasificación', margin + 50, currentY + 4.2);
  doc.text('Responsable', margin + 78, currentY + 4.2);
  doc.text('N° Resolución / Fecha', margin + 114, currentY + 4.2);
  doc.text('Tipo de Informe', margin + 148, currentY + 4.2);

  currentY += 7;
  doc.setFont('helvetica', 'normal');

  informes.forEach((inf, i) => {
    if (currentY > pageHeight - 20) {
      doc.addPage();
      drawOfficialHeader(doc, 'Control de Carga de Informes y Auditorías', 'Dependencias e Institutos', logo);
      applyWatermark(doc, watermark);
      currentY = 35;
    }

    if (i % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, currentY - 3.5, pageWidth - margin * 2, 5.5, 'F');
    }

    doc.setFontSize(6.8);
    doc.setTextColor(30, 41, 59);
    const depShort = inf.dependencia.length > 27 ? inf.dependencia.slice(0, 25) + '..' : inf.dependencia;
    doc.text(depShort, margin + 2, currentY);
    doc.text(inf.clasificacion || 'CENTRALIZADA', margin + 50, currentY);
    const respShort = inf.nombresApellidos.length > 18 ? inf.nombresApellidos.slice(0, 16) + '..' : inf.nombresApellidos;
    doc.text(respShort, margin + 78, currentY);
    const resText = inf.numeroResolucion ? `${inf.numeroResolucion}` : 'S/R';
    const resShort = resText.length > 18 ? resText.slice(0, 16) + '..' : resText;
    doc.text(resShort, margin + 114, currentY);
    const tipoShort = inf.tipoInforme.length > 20 ? inf.tipoInforme.slice(0, 18) + '..' : inf.tipoInforme;
    doc.text(tipoShort, margin + 148, currentY);

    currentY += 5.5;
  });

  const fechaHoy = new Date().toISOString().split('T')[0];
  doc.save(`Control_Informes_Tinaquillo_${fechaHoy}.pdf`);
}

// 2.3.B EXPORTAR REPORTE DE REGISTRO DE COMUNICACIÓN INTERNA DE DIRECTORIO Y MÉTRICAS EN PDF
export async function exportarPDFMemorandumYMetricas(informes: InformeDependencia[]): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  const [watermark, logo] = await Promise.all([
    getWatermarkDataUrl('/escudo.png', 0.08).catch(() => null),
    getImageDataUrl('/escudo.png', true).catch(() => getImageDataUrl('/escudo.jpg', false)).catch(() => null),
  ]);

  drawOfficialHeader(doc, 'Control de Cumplimiento: Registro de Comunicación Interna de Directorio', 'Métricas por Dependencia, Instituto y Empresa', logo);
  applyWatermark(doc, watermark);

  let currentY = 35;
  const fechaEmision = formatFechaEspanol(new Date().toISOString());

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(`Fecha de Emisión: ${fechaEmision}`, margin, currentY);

  const totalDeps = DEPENDENCIAS_MUNICIPALES.length;
  const memoReports = informes.filter(
    (i) =>
      i.tipoInforme === 'MEMORANDUM INTERNO' ||
      i.tipoInforme === 'REGISTRO DE COMUNICACIÓN INTERNA DE DIRECTORIO'
  );
  const depsQueCumplieron = DEPENDENCIAS_MUNICIPALES.filter((dep) =>
    memoReports.some((m) => m.dependencia.toUpperCase().trim() === dep.nombre.toUpperCase().trim())
  );
  const totalCumplieron = depsQueCumplieron.length;
  const totalPendientes = totalDeps - totalCumplieron;
  const pctCumplimiento = totalDeps > 0 ? Math.round((totalCumplieron / totalDeps) * 100) : 0;
  const totalConFirmas = memoReports.filter((m) => m.fotoFirmaPersonal && m.fotoFirmaPersonal.length > 0).length;

  doc.setFont('helvetica', 'normal');
  doc.text(
    `Total Entidades: ${totalDeps} | Cumplieron: ${totalCumplieron} (${pctCumplimiento}%) | Pendientes: ${totalPendientes}`,
    pageWidth - margin,
    currentY,
    { align: 'right' }
  );

  currentY += 7;

  // Resumen por sector
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, currentY, pageWidth - margin * 2, 18, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('BALANCE CONSOLIDADO POR SECTOR INSTITUCIONAL:', margin + 4, currentY + 5);

  const sectors = [
    { label: 'Dependencias Centralizadas', tipo: 'CENTRALIZADA' },
    { label: 'Institutos Autónomos', tipo: 'INSTITUTO' },
    { label: 'Empresas Municipales', tipo: 'EMPRESA' },
  ];

  let secX = margin + 4;
  const secW = (pageWidth - margin * 2 - 8) / 3;

  sectors.forEach((sec) => {
    const list = DEPENDENCIAS_MUNICIPALES.filter((d) => d.tipo === sec.tipo);
    const cCount = list.filter((d) =>
      memoReports.some((m) => m.dependencia.toUpperCase().trim() === d.nombre.toUpperCase().trim())
    ).length;
    const p = list.length > 0 ? Math.round((cCount / list.length) * 100) : 0;

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(sec.label, secX, currentY + 10);
    doc.setFont('helvetica', 'normal');
    doc.text(`${cCount} de ${list.length} cumplieron (${p}%)`, secX, currentY + 14.5);

    secX += secW;
  });

  currentY += 23;

  // Título: Quién Cumplió con el Registro de Comunicación Interna de Directorio
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(10, 85, 45);
  doc.text('1. RELACIÓN DETALLADA: QUIÉN CUMPLIÓ CON EL REGISTRO DE COMUNICACIÓN INTERNA DE DIRECTORIO', margin, currentY);
  currentY += 5;

  // Table header
  doc.setFillColor(15, 23, 42);
  doc.rect(margin, currentY, pageWidth - margin * 2, 6, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Dependencia / Instituto / Empresa', margin + 2, currentY + 4.2);
  doc.text('Clasificación', margin + 65, currentY + 4.2);
  doc.text('Estado Comunicación Interna', margin + 98, currentY + 4.2);
  doc.text('Responsable Consignó', margin + 133, currentY + 4.2);
  doc.text('Firmas Personal', margin + 163, currentY + 4.2);

  currentY += 6.5;

  DEPENDENCIAS_MUNICIPALES.forEach((dep, idx) => {
    if (currentY > pageHeight - 20) {
      doc.addPage();
      drawOfficialHeader(doc, 'Control de Cumplimiento: Registro de Comunicación Interna de Directorio', 'Métricas por Dependencia, Instituto y Empresa', logo);
      applyWatermark(doc, watermark);
      currentY = 35;
    }

    const memo = memoReports.find(
      (m) => m.dependencia.toUpperCase().trim() === dep.nombre.toUpperCase().trim()
    );

    const cumplio = !!memo;
    const tieneFirmas = (memo?.fotoFirmaPersonal && memo.fotoFirmaPersonal.length > 0) || false;

    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, currentY - 3.2, pageWidth - margin * 2, 5.2, 'F');
    }

    doc.setFontSize(6.5);
    doc.setTextColor(15, 23, 42);
    const depShort = dep.nombre.length > 34 ? dep.nombre.slice(0, 32) + '..' : dep.nombre;
    doc.text(depShort, margin + 2, currentY);

    doc.setTextColor(100, 116, 139);
    doc.text(dep.tipo, margin + 65, currentY);

    if (cumplio) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(22, 101, 52);
      doc.text('[✓] CUMPLIÓ', margin + 98, currentY);
      doc.setFont('helvetica', 'normal');
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(185, 28, 28);
      doc.text('[✕] PENDIENTE', margin + 98, currentY);
      doc.setFont('helvetica', 'normal');
    }

    doc.setTextColor(30, 41, 59);
    const resp = memo ? memo.nombresApellidos : 'S/R';
    const respShort = resp.length > 18 ? resp.slice(0, 16) + '..' : resp;
    doc.text(respShort, margin + 133, currentY);

    if (tieneFirmas) {
      doc.setTextColor(10, 85, 45);
      doc.text(`[✓] ${memo?.fotoFirmaPersonal?.length} fotos`, margin + 163, currentY);
    } else {
      doc.setTextColor(148, 163, 184);
      doc.text(cumplio ? 'Sin foto firma' : '-', margin + 163, currentY);
    }

    currentY += 5.2;
  });

  const fechaHoy = new Date().toISOString().split('T')[0];
  doc.save(`Cumplimiento_Comunicacion_Interna_Directorio_y_Metricas_${fechaHoy}.pdf`);
}

// ==========================================
// 3. EXPORTAR SOLICITUD INDIVIDUAL POR BENEFICIARIO
// Con marca de agua oficial (escudo) y firmas de quien entrega y quien recibe
// ==========================================
export async function exportarPDFSolicitudIndividual(
  solicitud: Solicitud,
  opciones?: {
    quienEntregaNombre?: string;
    quienEntregaCargo?: string;
    quienEntregaCedula?: string;
  }
): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;

  // Load watermark and logo (Both using the official Escudo Municipal)
  const [watermark, logo] = await Promise.all([
    getWatermarkDataUrl('/escudo.png', 0.12).catch(() => null),
    getImageDataUrl('/escudo.png', true).catch(() => getImageDataUrl('/escudo.jpg', false)).catch(() => null),
  ]);

  // Header Banner
  doc.setFillColor(10, 85, 45); // Deep Institutional Emerald
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setFillColor(217, 140, 20); // Metallic Gold stripe
  doc.rect(0, 28, pageWidth, 2.5, 'F');

  if (logo) {
    try {
      // Symmetrical official Escudo
      doc.addImage(logo, 'PNG', 10, 3, 17, 22);
      doc.addImage(logo, 'PNG', pageWidth - 27, 3, 17, 22);
    } catch (e) {
      try {
        doc.addImage(logo, 'JPEG', 10, 3, 17, 22);
        doc.addImage(logo, 'JPEG', pageWidth - 27, 3, 17, 22);
      } catch (err) {
        // safe fallback
      }
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('REPÚBLICA BOLIVARIANA DE VENEZUELA • ESTADO BOLIVARIANO DE COJEDES', pageWidth / 2, 7.5, { align: 'center' });

  doc.setFontSize(10.5);
  doc.text('DIRECCIÓN GENERAL • ALCALDÍA DEL MUNICIPIO AUTÓNOMO TINAQUILLO', pageWidth / 2, 13.8, { align: 'center' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(254, 240, 138);
  doc.text('COMPROBANTE OFICIAL DE ATENCIÓN Y ASISTENCIA CIUDADANA', pageWidth / 2, 19.8, { align: 'center' });

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(220, 252, 231);
  doc.text(`EXPEDIENTE N°: ${solicitud.id}   |   FECHA DE REGISTRO: ${solicitud.fechaSolicitud}`, pageWidth / 2, 25, { align: 'center' });

  // Watermark
  applyWatermark(doc, watermark);

  let currentY = 40;
  doc.setTextColor(30, 41, 59);

  // Box 1: Datos del Beneficiario
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 8, 2, 2, 'F');
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(13, 122, 66);
  doc.text('I. INFORMACIÓN DEL BENEFICIARIO / CIUDADANO SOLICITANTE', margin + 4, currentY + 5.5);

  currentY += 12;

  // Helper function: Render two columns with text wrapping and mathematical overflow protection
  const renderDobleColumna = (
    label1: string,
    val1: string,
    label2: string,
    val2: string,
    yPos: number
  ): number => {
    const totalContentWidth = pageWidth - margin * 2;
    const colWidth = (totalContentWidth - 6) / 2;
    const col1X = margin;
    const col2X = margin + colWidth + 6;

    // Column 1
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    const label1Width = doc.getTextWidth(label1) + 2.5;
    doc.text(label1, col1X, yPos);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    const maxVal1Width = Math.max(20, colWidth - label1Width);
    const lines1 = doc.splitTextToSize(val1 || 'No especificado', maxVal1Width);
    doc.text(lines1, col1X + label1Width, yPos);

    // Column 2
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    const label2Width = doc.getTextWidth(label2) + 2.5;
    doc.text(label2, col2X, yPos);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    const maxVal2Width = Math.max(20, colWidth - label2Width);
    const lines2 = doc.splitTextToSize(val2 || 'No especificado', maxVal2Width);
    doc.text(lines2, col2X + label2Width, yPos);

    const maxLines = Math.max(Array.isArray(lines1) ? lines1.length : 1, Array.isArray(lines2) ? lines2.length : 1);
    return Math.max(7.5, maxLines * 4.2 + 2.8);
  };

  currentY += renderDobleColumna(
    'Nombres y Apellidos:',
    solicitud.nombresApellidos,
    'Cédula de Identidad:',
    solicitud.cedula,
    currentY
  );

  currentY += renderDobleColumna(
    'Profesión u Oficio:',
    solicitud.profesionOficio || 'No especificado',
    'Teléfono de Contacto:',
    solicitud.telefonoCompleto || `${solicitud.telefonoPrefijo}-${solicitud.telefonoNumero}`,
    currentY
  );

  currentY += renderDobleColumna(
    'Fecha de Solicitud:',
    formatFechaEspanol(solicitud.fechaSolicitud),
    'Tipo de Asistencia:',
    solicitud.tipoSolicitud,
    currentY
  );

  currentY += 5;

  // Box 2: Estado y Observaciones
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 8, 2, 2, 'F');
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(13, 122, 66);
  doc.text('II. DETALLES DE LA SOLICITUD Y DICTAMEN DE REMISIÓN', margin + 4, currentY + 5.5);

  currentY += 13;

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Estado Institucional / Destino:', margin, currentY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(13, 122, 66);
  doc.text(solicitud.estadoRemision, margin + 50, currentY);

  if (solicitud.otroRemitirEspecifique) {
    currentY += 6;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Detalle de Remisión: ${solicitud.otroRemitirEspecifique}`, margin, currentY);
  }

  currentY += 8;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Observaciones / Justificación Social:', margin, currentY);
  currentY += 5;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  const obsLines = doc.splitTextToSize(
    solicitud.observaciones || 'Sin observaciones adicionales registradas en el expediente municipal.',
    pageWidth - margin * 2
  );
  doc.text(obsLines, margin, currentY);

  currentY += obsLines.length * 5 + 14;

  // Box 3: Constancia y Declaración Jurada
  doc.setFillColor(254, 252, 232);
  doc.setDrawColor(251, 191, 36);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 20, 2, 2, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(113, 63, 18);
  const notaCertificacion =
    'El presente documento certifica la recepción y tramitación de la solicitud de asistencia social a través de la Dirección General de la Alcaldía del Municipio Autónomo Tinaquillo, conforme a las atribuciones legales de gestión municipal y en apego a los principios de transparencia y justicia social.';
  const notaLines = doc.splitTextToSize(notaCertificacion, pageWidth - margin * 2 - 8);
  doc.text(notaLines, margin + 4, currentY + 6);

  currentY += 32;

  // Box 4: FIRMAS DE QUIEN ENTREGA Y QUIEN RECIBE
  const signatureBoxWidth = (pageWidth - margin * 2 - 14) / 2;
  const sigBoxHeight = 46;

  const quienEntrega = opciones?.quienEntregaNombre || 'Dirección General';
  const cargoEntrega = opciones?.quienEntregaCargo || 'Funcionario(a) Autorizado(a)';
  const cedulaEntrega = opciones?.quienEntregaCedula || 'Alcaldía del Municipio Autónomo Tinaquillo';

  // Box Izquierda: Quien Entrega
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, currentY, signatureBoxWidth, sigBoxHeight, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('ENTREGADO POR / AUTORIZADO:', margin + 4, currentY + 6);

  doc.setDrawColor(148, 163, 184);
  doc.line(margin + 10, currentY + 28, margin + signatureBoxWidth - 10, currentY + 28);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text(quienEntrega, margin + signatureBoxWidth / 2, currentY + 33, { align: 'center' });
  doc.setFontSize(6.8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(cargoEntrega, margin + signatureBoxWidth / 2, currentY + 37, { align: 'center' });
  doc.text(`C.I. / RIF: ${cedulaEntrega}`, margin + signatureBoxWidth / 2, currentY + 41, { align: 'center' });

  // Box Derecha: Quien Recibe
  const rightBoxX = margin + signatureBoxWidth + 14;
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(rightBoxX, currentY, signatureBoxWidth, sigBoxHeight, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('RECIBIDO CONFORME / BENEFICIARIO:', rightBoxX + 4, currentY + 6);

  doc.setDrawColor(148, 163, 184);
  doc.line(rightBoxX + 10, currentY + 28, rightBoxX + signatureBoxWidth - 10, currentY + 28);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text(solicitud.nombresApellidos, rightBoxX + signatureBoxWidth / 2, currentY + 33, { align: 'center' });
  doc.setFontSize(6.8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`C.I.: ${solicitud.cedula}`, rightBoxX + signatureBoxWidth / 2, currentY + 37, { align: 'center' });
  doc.text('Firma y Huella Dactilar', rightBoxX + signatureBoxWidth / 2, currentY + 41, { align: 'center' });

  // Bottom Footer
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Comprobante emitido el ${formatFechaEspanol(new Date().toISOString())} • Alcaldía del Municipio Autónomo Tinaquillo`,
    pageWidth / 2,
    pageHeight - 8,
    { align: 'center' }
  );

  const safeCedula = solicitud.cedula.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Comprobante_Solicitud_${safeCedula}_${solicitud.id}.pdf`);
}

// ==========================================
// 4. EXPORTAR DETALLE DE INFORME INDIVIDUAL
// Con marca de agua oficial (escudo) y datos completos
// ==========================================
export async function exportarPDFInformeIndividual(
  informe: InformeDependencia
): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;

  // Load watermark and logo (Both using the official Escudo Municipal)
  const [watermark, logo] = await Promise.all([
    getWatermarkDataUrl('/escudo.png', 0.12).catch(() => null),
    getImageDataUrl('/escudo.png', true).catch(() => getImageDataUrl('/escudo.jpg', false)).catch(() => null),
  ]);

  // Header Banner
  doc.setFillColor(10, 85, 45); // Deep Institutional Emerald
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setFillColor(217, 140, 20); // Metallic Gold stripe
  doc.rect(0, 28, pageWidth, 2.5, 'F');

  if (logo) {
    try {
      // Symmetrical official Escudo
      doc.addImage(logo, 'PNG', 10, 3, 17, 22);
      doc.addImage(logo, 'PNG', pageWidth - 27, 3, 17, 22);
    } catch (e) {
      try {
        doc.addImage(logo, 'JPEG', 10, 3, 17, 22);
        doc.addImage(logo, 'JPEG', pageWidth - 27, 3, 17, 22);
      } catch (err) {
        // safe fallback
      }
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('REPÚBLICA BOLIVARIANA DE VENEZUELA • ESTADO BOLIVARIANO DE COJEDES', pageWidth / 2, 7.5, { align: 'center' });

  doc.setFontSize(10.5);
  doc.text('DIRECCIÓN GENERAL • ALCALDÍA DEL MUNICIPIO AUTÓNOMO TINAQUILLO', pageWidth / 2, 13.8, { align: 'center' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(254, 240, 138);
  doc.text('EXPEDIENTE OFICIAL DE CONTROL DE GESTIÓN Y AUDITORÍA MUNICIPAL', pageWidth / 2, 19.8, { align: 'center' });

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(220, 252, 231);
  doc.text(`EXPEDIENTE: ${informe.id}   |   FECHA: ${formatFechaEspanol(informe.fechaRegistro)}`, pageWidth / 2, 25, { align: 'center' });

  // Watermark
  applyWatermark(doc, watermark);

  let currentY = 40;
  doc.setTextColor(30, 41, 59);

  // Box 1: Datos de la Dependencia y Responsable
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 8, 2, 2, 'F');
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(13, 122, 66);
  doc.text('I. IDENTIFICACIÓN DE LA DEPENDENCIA Y FUNCIONARIO RESPONSABLE', margin + 4, currentY + 5.5);

  currentY += 12;

  const totalContentWidth = pageWidth - margin * 2;
  const colWidth = (totalContentWidth - 6) / 2;

  // Helper function: Render two columns with text wrapping and mathematical overflow protection
  const renderDobleColumna = (
    label1: string,
    val1: string,
    label2: string,
    val2: string,
    yPos: number
  ): number => {
    const col1X = margin;
    const col2X = margin + colWidth + 6;

    // Column 1
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    const label1Width = doc.getTextWidth(label1) + 2.5;
    doc.text(label1, col1X, yPos);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    const maxVal1Width = Math.max(20, colWidth - label1Width);
    const lines1 = doc.splitTextToSize(val1 || 'No especificado', maxVal1Width);
    doc.text(lines1, col1X + label1Width, yPos);

    // Column 2
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    const label2Width = doc.getTextWidth(label2) + 2.5;
    doc.text(label2, col2X, yPos);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    const maxVal2Width = Math.max(20, colWidth - label2Width);
    const lines2 = doc.splitTextToSize(val2 || 'No especificado', maxVal2Width);
    doc.text(lines2, col2X + label2Width, yPos);

    const maxLines = Math.max(Array.isArray(lines1) ? lines1.length : 1, Array.isArray(lines2) ? lines2.length : 1);
    return Math.max(7.5, maxLines * 4.2 + 2.8);
  };

  currentY += renderDobleColumna(
    'Dependencia / Ente:',
    informe.dependencia,
    'Clasificación:',
    informe.clasificacion || 'CENTRALIZADA',
    currentY
  );

  currentY += renderDobleColumna(
    'Responsable:',
    informe.nombresApellidos,
    'Cargo Oficial:',
    informe.cargo || informe.otroCargoEspecifique || 'N/A',
    currentY
  );

  currentY += renderDobleColumna(
    'Cédula de Identidad:',
    informe.cedula,
    'Teléfono Contacto:',
    informe.telefono,
    currentY
  );

  currentY += renderDobleColumna(
    'N° de Resolución:',
    informe.numeroResolucion || 'No especificado',
    'Fecha Resolución:',
    informe.fechaResolucion || 'No especificado',
    currentY
  );

  currentY += 5;

  // Box 2: Tipo de Informe y Contenido Técnico
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 8, 2, 2, 'F');
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(13, 122, 66);
  doc.text('II. CONTENIDO DEL INFORME TÉCNICO PRESENTADO', margin + 4, currentY + 5.5);

  currentY += 12;

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Tipo de Informe Oficial:', margin, currentY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(13, 122, 66);
  doc.text(informe.tipoInforme, margin + 40, currentY);

  currentY += 8;

  if (
    informe.tipoInforme === 'MEMORANDUM INTERNO' ||
    informe.tipoInforme === 'REGISTRO DE COMUNICACIÓN INTERNA DE DIRECTORIO'
  ) {
    // Registro de Comunicación Interna de Directorio / Memorandum Interno
    if (informe.punto1) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text('Punto 1:', margin, currentY);
      currentY += 4.5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      const p1Lines = doc.splitTextToSize(informe.punto1, pageWidth - margin * 2);
      doc.text(p1Lines, margin, currentY);
      currentY += p1Lines.length * 4.5 + 4;
    }

    if (informe.punto2) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text('Punto 2:', margin, currentY);
      currentY += 4.5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      const p2Lines = doc.splitTextToSize(informe.punto2, pageWidth - margin * 2);
      doc.text(p2Lines, margin, currentY);
      currentY += p2Lines.length * 4.5 + 4;
    }

    if (informe.puntosAdicionales && informe.puntosAdicionales.length > 0) {
      informe.puntosAdicionales.forEach((pt, idx) => {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(71, 85, 105);
        doc.text(`Punto Adicional #${idx + 3}:`, margin, currentY);
        currentY += 4.5;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(15, 23, 42);
        const paLines = doc.splitTextToSize(pt, pageWidth - margin * 2);
        doc.text(paLines, margin, currentY);
        currentY += paLines.length * 4.5 + 4;
      });
    }

    if (informe.fotoFirmaPersonal && informe.fotoFirmaPersonal.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(10, 85, 45);
      doc.text(`[✓] Constancia de Firmas del Personal Consignada (${informe.fotoFirmaPersonal.length} archivo(s) digitalizado(s))`, margin, currentY);
      currentY += 6;
    }
  } else if (informe.tipoInforme === 'REPORTE DE GESTIÓN TRIMESTRAL') {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text(`Periodo: ${informe.trimestre || 'N/A'} - Año: ${informe.anioGestion || '2026'}`, margin, currentY);
    doc.text(
      `Metas Programadas: ${informe.metasFisicasProgramadas || 0}  |  Ejecutadas: ${informe.metasFisicasEjecutadas || 0}  |  Alcance: ${informe.alcancePorcentaje || 0}%`,
      margin + colWidth,
      currentY
    );

    currentY += 8;

    if (informe.descripcionBreve) {
      doc.setFont('helvetica', 'bold');
      doc.text('Descripción Breve del Período:', margin, currentY);
      currentY += 4.5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      const descLines = doc.splitTextToSize(informe.descripcionBreve, pageWidth - margin * 2);
      doc.text(descLines, margin, currentY);
      currentY += descLines.length * 4.5 + 4;
    }

    if (informe.adjuntoInforme && informe.adjuntoInforme.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(10, 85, 45);
      doc.text(`[✓] Informe Oficial Adjunto: ${informe.adjuntoInforme[0].name}`, margin, currentY);
      currentY += 6;
    }

    if (informe.actividadesEjecutadas) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text('Actividades Ejecutadas:', margin, currentY);
      currentY += 4.5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      const actLines = doc.splitTextToSize(informe.actividadesEjecutadas, pageWidth - margin * 2);
      doc.text(actLines, margin, currentY);
      currentY += actLines.length * 4.5 + 4;
    }

    if (informe.logrosAlcanzados) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text('Logros Alcanzados:', margin, currentY);
      currentY += 4.5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      const logLines = doc.splitTextToSize(informe.logrosAlcanzados, pageWidth - margin * 2);
      doc.text(logLines, margin, currentY);
      currentY += logLines.length * 4.5 + 8;
    }
  } else {
    // Auditoría
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text(`Fecha de Auditoría: ${informe.fechaAuditoria || 'N/A'}`, margin, currentY);

    if (informe.procedimientosAuditados && informe.procedimientosAuditados.length > 0) {
      currentY += 6;
      doc.text('Procedimientos Auditados:', margin, currentY);
      currentY += 4.5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      informe.procedimientosAuditados.forEach((proc) => {
        doc.text(`• ${proc}`, margin + 4, currentY);
        currentY += 4;
      });
      currentY += 2;
    }

    if (informe.descripcionDetallada) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text('Descripción Detallada:', margin, currentY);
      currentY += 4.5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      const descLines = doc.splitTextToSize(informe.descripcionDetallada, pageWidth - margin * 2);
      doc.text(descLines, margin, currentY);
      currentY += descLines.length * 4.5 + 4;
    }

    if (informe.hallazgos) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text('Hallazgos de la Contraloría:', margin, currentY);
      currentY += 4.5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      const halLines = doc.splitTextToSize(informe.hallazgos, pageWidth - margin * 2);
      doc.text(halLines, margin, currentY);
      currentY += halLines.length * 4.5 + 4;
    }

    if (informe.conclusionesRecomendaciones) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text('Conclusiones y Recomendaciones:', margin, currentY);
      currentY += 4.5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      const conLines = doc.splitTextToSize(informe.conclusionesRecomendaciones, pageWidth - margin * 2);
      doc.text(conLines, margin, currentY);
      currentY += conLines.length * 4.5 + 8;
    }
  }

  // Box 3: FIRMAS INSTITUCIONALES
  const signatureBoxWidth = (pageWidth - margin * 2 - 14) / 2;
  const sigBoxHeight = 40;

  if (currentY > pageHeight - 55) {
    doc.addPage();
    applyWatermark(doc, watermark);
    currentY = 40;
  }

  // Box Izquierda: Responsable Dependencia
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, currentY, signatureBoxWidth, sigBoxHeight, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('CONSIGNADO POR (DEPENDENCIA):', margin + 4, currentY + 6);

  doc.setDrawColor(148, 163, 184);
  doc.line(margin + 10, currentY + 24, margin + signatureBoxWidth - 10, currentY + 24);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text(informe.nombresApellidos, margin + signatureBoxWidth / 2, currentY + 29, { align: 'center' });
  doc.setFontSize(6.8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  const shortCargo = (informe.cargo || 'Responsable').length > 32 ? (informe.cargo || '').slice(0, 30) + '..' : (informe.cargo || 'Responsable');
  doc.text(shortCargo, margin + signatureBoxWidth / 2, currentY + 33, { align: 'center' });
  doc.text(`C.I.: ${informe.cedula}`, margin + signatureBoxWidth / 2, currentY + 37, { align: 'center' });

  // Box Derecha: Dirección General (Visto Bueno)
  const rightBoxX = margin + signatureBoxWidth + 14;
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(rightBoxX, currentY, signatureBoxWidth, sigBoxHeight, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('VISTO BUENO / RECEPCIÓN:', rightBoxX + 4, currentY + 6);

  doc.setDrawColor(148, 163, 184);
  doc.line(rightBoxX + 10, currentY + 24, rightBoxX + signatureBoxWidth - 10, currentY + 24);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('DIRECCIÓN GENERAL', rightBoxX + signatureBoxWidth / 2, currentY + 29, { align: 'center' });
  doc.setFontSize(6.8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Alcaldía del Municipio Autónomo Tinaquillo', rightBoxX + signatureBoxWidth / 2, currentY + 33, { align: 'center' });
  doc.text('Firma y Sello de Recibido', rightBoxX + signatureBoxWidth / 2, currentY + 37, { align: 'center' });

  // Footer
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Informe de Gestión Municipal • Alcaldía del Municipio Autónomo Tinaquillo • Expediente ${informe.id}`,
    pageWidth / 2,
    pageHeight - 8,
    { align: 'center' }
  );

  doc.save(`Informe_${informe.id}_Tinaquillo.pdf`);
}

/**
 * Exportar Reporte Oficial de Control de Cumplimiento de Dependencias e Institutos a PDF
 */
export async function exportarPDFControlCumplimiento(informes: InformeDependencia[]) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const [watermark, logo] = await Promise.all([
    getWatermarkDataUrl('/escudo.png', 0.08).catch(() => null),
    getImageDataUrl('/escudo.png', true).catch(() => getImageDataUrl('/escudo.jpg', false)).catch(() => null),
  ]);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  drawOfficialHeader(doc, 'Control de Cumplimiento de Dependencias e Institutos', 'Monitoreo de Carga de Informes Trimestrales y Registros de Comunicación Interna de Directorio', logo);
  applyWatermark(doc, watermark);

  let currentY = 36;

  // Compute stats
  const informesPorDep = new Map<string, InformeDependencia[]>();
  informes.forEach((inf) => {
    const depKey = inf.dependencia.toUpperCase().trim();
    if (!informesPorDep.has(depKey)) {
      informesPorDep.set(depKey, []);
    }
    informesPorDep.get(depKey)!.push(inf);
  });

  const totalDeps = DEPENDENCIAS_MUNICIPALES.length;
  const depsCargaron = DEPENDENCIAS_MUNICIPALES.filter(d => (informesPorDep.get(d.nombre.toUpperCase().trim())?.length || 0) > 0);
  const depsPendientes = DEPENDENCIAS_MUNICIPALES.filter(d => (informesPorDep.get(d.nombre.toUpperCase().trim())?.length || 0) === 0);
  const totalCargaron = depsCargaron.length;
  const totalPendientes = depsPendientes.length;
  const pctCumplimiento = Math.round((totalCargaron / totalDeps) * 100);

  // Summary KPI Cards
  const boxWidth = (pageWidth - margin * 2 - 8) / 3;
  const boxHeight = 16;

  // Box 1: Total Dependencias
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, currentY, boxWidth, boxHeight, 2, 2, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('TOTAL DEPENDENCIAS', margin + boxWidth / 2, currentY + 5, { align: 'center' });
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(`${totalDeps}`, margin + boxWidth / 2, currentY + 12, { align: 'center' });

  // Box 2: Cargaron
  const box2X = margin + boxWidth + 4;
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(167, 243, 208);
  doc.roundedRect(box2X, currentY, boxWidth, boxHeight, 2, 2, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(4, 120, 87);
  doc.text('CARGARON INFORME', box2X + boxWidth / 2, currentY + 5, { align: 'center' });
  doc.setFontSize(14);
  doc.text(`${totalCargaron} (${pctCumplimiento}%)`, box2X + boxWidth / 2, currentY + 12, { align: 'center' });

  // Box 3: Pendientes
  const box3X = box2X + boxWidth + 4;
  doc.setFillColor(254, 242, 242);
  doc.setDrawColor(254, 202, 202);
  doc.roundedRect(box3X, currentY, boxWidth, boxHeight, 2, 2, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(185, 28, 28);
  doc.text('PENDIENTES POR CARGAR', box3X + boxWidth / 2, currentY + 5, { align: 'center' });
  doc.setFontSize(14);
  doc.text(`${totalPendientes}`, box3X + boxWidth / 2, currentY + 12, { align: 'center' });

  currentY += boxHeight + 8;

  // Table header
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('RELACIÓN DE DEPENDENCIAS, DIRECCIONES E INSTITUTOS', margin, currentY);
  currentY += 4;

  // Table
  const tableHeaders = ['N°', 'DEPENDENCIA / ENTE', 'TIPO', 'ESTADO', 'INFORMES', 'ÚLTIMA CARGA'];
  const colWidths = [10, 85, 28, 24, 18, 23]; // Total = 188mm

  doc.setFillColor(15, 23, 42);
  doc.rect(margin, currentY, pageWidth - margin * 2, 6.5, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);

  let currentX = margin;
  tableHeaders.forEach((th, i) => {
    doc.text(th, currentX + (i === 0 ? 5 : 2), currentY + 4.5, { align: i === 0 ? 'center' : 'left' });
    currentX += colWidths[i];
  });
  currentY += 6.5;

  // Rows
  const sortedDeps = [...DEPENDENCIAS_MUNICIPALES].sort((a, b) => {
    const aC = (informesPorDep.get(a.nombre.toUpperCase().trim())?.length || 0) > 0;
    const bC = (informesPorDep.get(b.nombre.toUpperCase().trim())?.length || 0) > 0;
    if (aC === bC) return a.nombre.localeCompare(b.nombre);
    return aC ? -1 : 1;
  });

  sortedDeps.forEach((dep, idx) => {
    if (currentY > pageHeight - 20) {
      doc.addPage();
      drawOfficialHeader(doc, 'Control de Cumplimiento de Dependencias e Institutos', 'Monitoreo de Carga de Informes Trimestrales y Registros de Comunicación Interna de Directorio (Cont.)', logo);
      applyWatermark(doc, watermark);
      currentY = 35;

      // Repeat table header
      doc.setFillColor(15, 23, 42);
      doc.rect(margin, currentY, pageWidth - margin * 2, 6.5, 'F');
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      let hX = margin;
      tableHeaders.forEach((th, i) => {
        doc.text(th, hX + (i === 0 ? 5 : 2), currentY + 4.5, { align: i === 0 ? 'center' : 'left' });
        hX += colWidths[i];
      });
      currentY += 6.5;
    }

    const docs = informesPorDep.get(dep.nombre.toUpperCase().trim()) || [];
    const cargo = docs.length > 0;
    const ultimaFecha = cargo ? docs[docs.length - 1].fechaRegistro : '-';

    const rowBg = idx % 2 === 0 ? [248, 250, 252] : [255, 255, 255];
    doc.setFillColor(rowBg[0], rowBg[1], rowBg[2]);
    doc.rect(margin, currentY, pageWidth - margin * 2, 5.8, 'F');

    doc.setFontSize(6.8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);

    let cellX = margin;
    // N°
    doc.text(`${idx + 1}`, cellX + 5, currentY + 4, { align: 'center' });
    cellX += colWidths[0];

    // Dependencia
    const depTitle = dep.nombre.length > 55 ? dep.nombre.slice(0, 53) + '..' : dep.nombre;
    doc.setFont('helvetica', 'bold');
    doc.text(depTitle, cellX + 2, currentY + 4);
    cellX += colWidths[1];

    // Tipo
    doc.setFont('helvetica', 'normal');
    doc.text(dep.tipo, cellX + 2, currentY + 4);
    cellX += colWidths[2];

    // Estado
    if (cargo) {
      doc.setTextColor(5, 150, 105);
      doc.setFont('helvetica', 'bold');
      doc.text('CUMPLIÓ', cellX + 2, currentY + 4);
    } else {
      doc.setTextColor(220, 38, 38);
      doc.setFont('helvetica', 'bold');
      doc.text('PENDIENTE', cellX + 2, currentY + 4);
    }
    doc.setTextColor(51, 65, 85);
    cellX += colWidths[3];

    // Cantidad
    doc.text(`${docs.length}`, cellX + 6, currentY + 4, { align: 'center' });
    cellX += colWidths[4];

    // Fecha
    doc.text(ultimaFecha, cellX + 2, currentY + 4);

    currentY += 5.8;
  });

  // Footer on all pages
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Control de Cumplimiento de Dependencias e Institutos • Alcaldía del Municipio Autónomo Tinaquillo • Página ${i} de ${pageCount}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    );
  }

  doc.save(`Control_Cumplimiento_Dependencias_Tinaquillo_${new Date().toISOString().split('T')[0]}.pdf`);
}

/**
 * Exportar Reporte de Control de Cumplimiento a Excel
 */
export function exportarExcelControlCumplimiento(informes: InformeDependencia[]) {
  const informesPorDep = new Map<string, InformeDependencia[]>();
  informes.forEach((inf) => {
    const depKey = inf.dependencia.toUpperCase().trim();
    if (!informesPorDep.has(depKey)) {
      informesPorDep.set(depKey, []);
    }
    informesPorDep.get(depKey)!.push(inf);
  });

  const data = DEPENDENCIAS_MUNICIPALES.map((dep, idx) => {
    const docs = informesPorDep.get(dep.nombre.toUpperCase().trim()) || [];
    const cargo = docs.length > 0;
    const ultimoDoc = cargo ? docs[docs.length - 1] : null;

    return {
      'N°': idx + 1,
      'Dependencia o Instituto': dep.nombre,
      'Clasificación': dep.tipo,
      'Estado de Cumplimiento': cargo ? 'CARGÓ INFORME' : 'PENDIENTE',
      'Total Informes Registrados': docs.length,
      'Última Fecha de Carga': ultimoDoc ? ultimoDoc.fechaRegistro : 'Sin Carga',
      'Último Funcionario Responsable': ultimoDoc ? ultimoDoc.nombresApellidos : 'N/A',
      'Cédula Funcionario': ultimoDoc ? ultimoDoc.cedula : 'N/A',
      'Cargo Funcionario': ultimoDoc ? (ultimoDoc.cargo || 'N/A') : 'N/A',
    };
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [
    { wch: 6 },
    { wch: 45 },
    { wch: 20 },
    { wch: 22 },
    { wch: 26 },
    { wch: 20 },
    { wch: 32 },
    { wch: 18 },
    { wch: 30 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Control Cumplimiento');
  XLSX.writeFile(wb, `Control_Cumplimiento_Dependencias_${new Date().toISOString().split('T')[0]}.xlsx`);
}

/**
 * Exportar Reporte de Asistencias por Dependencia, Empresa e Instituto a Excel
 */
export function exportarExcelAsistenciasPorEntes(asistencias: RegistroAsistencia[]) {
  const entesStats = DEPENDENCIAS_MUNICIPALES.map((dep, idx) => {
    const depKey = dep.nombre.toUpperCase().trim();
    
    const matchedActividades: { actividad: RegistroAsistencia; asistente: any }[] = [];
    asistencias.forEach((act) => {
      act.asistentes.forEach((asist) => {
        const asistDep = (asist.dependencia || '').toUpperCase().trim();
        if (asistDep === depKey) {
          matchedActividades.push({ actividad: act, asistente: asist });
        }
      });
    });

    const totalAsistentes = matchedActividades.length;
    const uniqueActs = Array.from(new Set(matchedActividades.map((m) => m.actividad.id)));
    const cantActividades = uniqueActs.length;
    const tieneAsistencia = cantActividades > 0;
    
    const sortedActs = [...matchedActividades].sort((a, b) => 
      (b.actividad.fecha || '').localeCompare(a.actividad.fecha || '')
    );
    const ultimaActividad = sortedActs.length > 0 ? sortedActs[0].actividad : null;
    const nombresFuncionarios = Array.from(new Set(matchedActividades.map((m) => m.asistente.nombresApellidos))).join(', ');

    return {
      n: idx + 1,
      nombre: dep.nombre,
      tipo: dep.tipo,
      tieneAsistencia,
      cantActividades,
      totalAsistentes,
      ultimaFecha: ultimaActividad ? ultimaActividad.fecha : 'Sin Registro',
      ultimaActividadNombre: ultimaActividad ? ultimaActividad.nombreActividad : 'N/A',
      funcionarios: nombresFuncionarios || 'N/A',
    };
  });

  const wb = XLSX.utils.book_new();

  // Hoja 1: Resumen por Ente
  const hoja1Data = entesStats.map((e) => ({
    'N°': e.n,
    'Dependencia, Empresa o Instituto': e.nombre,
    'Clasificación': e.tipo,
    'Estado de Asistencia': e.tieneAsistencia ? 'CON ASISTENCIA' : 'SIN ASISTENCIA',
    'Actividades Asistidas': e.cantActividades,
    'Total Asistentes Registrados': e.totalAsistentes,
    'Última Actividad': e.ultimaActividadNombre,
    'Fecha Última Asistencia': e.ultimaFecha,
    'Funcionarios Participantes': e.funcionarios,
  }));
  const ws1 = XLSX.utils.json_to_sheet(hoja1Data);
  ws1['!cols'] = [
    { wch: 6 },
    { wch: 45 },
    { wch: 18 },
    { wch: 22 },
    { wch: 22 },
    { wch: 25 },
    { wch: 35 },
    { wch: 22 },
    { wch: 45 },
  ];
  XLSX.utils.book_append_sheet(wb, ws1, 'Resumen por Ente');

  // Hoja 2: Detalle Cronológico de Asistencias
  const hoja2Data: any[] = [];
  asistencias.forEach((act) => {
    act.asistentes.forEach((asist) => {
      hoja2Data.push({
        'N°': hoja2Data.length + 1,
        'ID Actividad': act.id,
        'Fecha': act.fecha,
        'Tipo de Actividad': act.tipoActividad,
        'Nombre de Actividad': act.nombreActividad,
        'Lugar': act.lugar,
        'Dependencia / Ente': asist.dependencia || 'NO ESPECIFICADO / GENERAL',
        'Clasificación Ente': asist.clasificacion || 'GENERAL',
        'Funcionario Asistente': asist.nombresApellidos,
        'Cédula': asist.cedula,
        'Cargo': asist.cargo || 'N/A',
        'Teléfono': asist.telefono || 'N/A',
      });
    });
  });
  const ws2 = XLSX.utils.json_to_sheet(hoja2Data.length > 0 ? hoja2Data : [{ 'Información': 'No hay asistencias registradas aún' }]);
  ws2['!cols'] = [
    { wch: 6 },
    { wch: 16 },
    { wch: 14 },
    { wch: 22 },
    { wch: 35 },
    { wch: 25 },
    { wch: 40 },
    { wch: 18 },
    { wch: 32 },
    { wch: 16 },
    { wch: 28 },
    { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(wb, ws2, 'Detalle de Asistentes');

  // Hoja 3: Consolidado por Clasificación
  const centralizadas = entesStats.filter((e) => e.tipo === 'CENTRALIZADA');
  const empresas = entesStats.filter((e) => e.tipo === 'EMPRESA');
  const institutos = entesStats.filter((e) => e.tipo === 'INSTITUTO');

  const hoja3Data = [
    {
      'Clasificación de Ente': 'DEPENDENCIAS CENTRALIZADAS',
      'Total Entidades': centralizadas.length,
      'Entidades con Asistencia': centralizadas.filter((c) => c.tieneAsistencia).length,
      '% Entidades con Asistencia': `${Math.round((centralizadas.filter((c) => c.tieneAsistencia).length / (centralizadas.length || 1)) * 100)}%`,
      'Total Asistencias Acumuladas': centralizadas.reduce((acc, c) => acc + c.totalAsistentes, 0),
    },
    {
      'Clasificación de Ente': 'EMPRESAS MUNICIPALES',
      'Total Entidades': empresas.length,
      'Entidades con Asistencia': empresas.filter((c) => c.tieneAsistencia).length,
      '% Entidades con Asistencia': `${Math.round((empresas.filter((c) => c.tieneAsistencia).length / (empresas.length || 1)) * 100)}%`,
      'Total Asistencias Acumuladas': empresas.reduce((acc, c) => acc + c.totalAsistentes, 0),
    },
    {
      'Clasificación de Ente': 'INSTITUTOS AUTÓNOMOS',
      'Total Entidades': institutos.length,
      'Entidades con Asistencia': institutos.filter((c) => c.tieneAsistencia).length,
      '% Entidades con Asistencia': `${Math.round((institutos.filter((c) => c.tieneAsistencia).length / (institutos.length || 1)) * 100)}%`,
      'Total Asistencias Acumuladas': institutos.reduce((acc, c) => acc + c.totalAsistentes, 0),
    },
  ];
  const ws3 = XLSX.utils.json_to_sheet(hoja3Data);
  ws3['!cols'] = [{ wch: 32 }, { wch: 18 }, { wch: 25 }, { wch: 28 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(wb, ws3, 'Consolidado Clasificación');

  XLSX.writeFile(wb, `Reporte_Asistencias_Entes_Tinaquillo_${new Date().toISOString().split('T')[0]}.xlsx`);
}

/**
 * Exportar Reporte Oficial de Asistencias por Dependencia, Empresa e Instituto a PDF
 */
export async function exportarPDFAsistenciasPorEntes(asistencias: RegistroAsistencia[]) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const [watermark, logo] = await Promise.all([
    getWatermarkDataUrl('/escudo.png', 0.08).catch(() => null),
    getImageDataUrl('/escudo.png', true).catch(() => getImageDataUrl('/escudo.jpg', false)).catch(() => null),
  ]);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  drawOfficialHeader(
    doc,
    'Reporte de Asistencias por Dependencia, Empresa e Instituto',
    'Participación en Festividades, Efemérides, Eventos, Mesas y Directorios',
    logo
  );
  applyWatermark(doc, watermark);

  let currentY = 36;

  // Compute stats per dependency
  const entesStats = DEPENDENCIAS_MUNICIPALES.map((dep, idx) => {
    const depKey = dep.nombre.toUpperCase().trim();
    const matchedActividades: { actividad: RegistroAsistencia; asistente: any }[] = [];
    asistencias.forEach((act) => {
      act.asistentes.forEach((asist) => {
        const asistDep = (asist.dependencia || '').toUpperCase().trim();
        if (asistDep === depKey) {
          matchedActividades.push({ actividad: act, asistente: asist });
        }
      });
    });

    const totalAsistentes = matchedActividades.length;
    const uniqueActs = Array.from(new Set(matchedActividades.map((m) => m.actividad.id)));
    const cantActividades = uniqueActs.length;
    const tieneAsistencia = cantActividades > 0;
    const sortedActs = [...matchedActividades].sort((a, b) => 
      (b.actividad.fecha || '').localeCompare(a.actividad.fecha || '')
    );
    const ultimaActividad = sortedActs.length > 0 ? sortedActs[0].actividad : null;
    const nombresFuncionarios = Array.from(new Set(matchedActividades.map((m) => m.asistente.nombresApellidos))).join(', ');

    return {
      n: idx + 1,
      nombre: dep.nombre,
      tipo: dep.tipo,
      tieneAsistencia,
      cantActividades,
      totalAsistentes,
      ultimaFecha: ultimaActividad ? ultimaActividad.fecha : '-',
      funcionarios: nombresFuncionarios || '-',
    };
  });

  const totalActividades = asistencias.length;
  const centralizadas = entesStats.filter((e) => e.tipo === 'CENTRALIZADA');
  const empresas = entesStats.filter((e) => e.tipo === 'EMPRESA');
  const institutos = entesStats.filter((e) => e.tipo === 'INSTITUTO');

  const centAsistieron = centralizadas.filter((c) => c.tieneAsistencia).length;
  const empAsistieron = empresas.filter((e) => e.tieneAsistencia).length;
  const instAsistieron = institutos.filter((i) => i.tieneAsistencia).length;

  // 4 KPI Summary Cards
  const boxWidth = (pageWidth - margin * 2 - 9) / 4;
  const boxHeight = 16;

  // Box 1: Total Actividades
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, currentY, boxWidth, boxHeight, 2, 2, 'FD');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('TOTAL ACTIVIDADES', margin + boxWidth / 2, currentY + 5, { align: 'center' });
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(`${totalActividades}`, margin + boxWidth / 2, currentY + 12, { align: 'center' });

  // Box 2: Centralizadas
  const box2X = margin + boxWidth + 3;
  doc.setFillColor(238, 242, 255);
  doc.setDrawColor(199, 210, 254);
  doc.roundedRect(box2X, currentY, boxWidth, boxHeight, 2, 2, 'FD');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(67, 56, 202);
  doc.text('CENTRALIZADAS', box2X + boxWidth / 2, currentY + 5, { align: 'center' });
  doc.setFontSize(12);
  doc.text(`${centAsistieron}/${centralizadas.length}`, box2X + boxWidth / 2, currentY + 12, { align: 'center' });

  // Box 3: Empresas
  const box3X = box2X + boxWidth + 3;
  doc.setFillColor(254, 243, 199);
  doc.setDrawColor(253, 230, 138);
  doc.roundedRect(box3X, currentY, boxWidth, boxHeight, 2, 2, 'FD');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(180, 83, 9);
  doc.text('EMPRESAS MPAL.', box3X + boxWidth / 2, currentY + 5, { align: 'center' });
  doc.setFontSize(12);
  doc.text(`${empAsistieron}/${empresas.length}`, box3X + boxWidth / 2, currentY + 12, { align: 'center' });

  // Box 4: Institutos
  const box4X = box3X + boxWidth + 3;
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(167, 243, 208);
  doc.roundedRect(box4X, currentY, boxWidth, boxHeight, 2, 2, 'FD');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(4, 120, 87);
  doc.text('INSTITUTOS', box4X + boxWidth / 2, currentY + 5, { align: 'center' });
  doc.setFontSize(12);
  doc.text(`${instAsistieron}/${institutos.length}`, box4X + boxWidth / 2, currentY + 12, { align: 'center' });

  currentY += 21;

  // Section title
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('RELACIÓN DE ASISTENCIAS POR DEPENDENCIA, EMPRESA E INSTITUTO', margin, currentY);
  currentY += 4;

  // Table
  const tableHeaders = ['N°', 'DEPENDENCIA / ENTE', 'TIPO', 'ACT.', 'ASISTENTES', 'ESTADO', 'ÚLTIMA'];
  const colWidths = [8, 75, 26, 14, 22, 23, 20]; // Total = 188mm

  doc.setFillColor(15, 23, 42);
  doc.rect(margin, currentY, pageWidth - margin * 2, 6.5, 'F');
  doc.setFontSize(6.8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);

  let currentX = margin;
  tableHeaders.forEach((th, i) => {
    doc.text(th, currentX + (i === 0 || i === 3 ? 4 : 2), currentY + 4.5, {
      align: i === 0 || i === 3 ? 'center' : 'left',
    });
    currentX += colWidths[i];
  });
  currentY += 6.5;

  // Sort: entes with attendance first, then by name
  const sortedEntes = [...entesStats].sort((a, b) => {
    if (a.tieneAsistencia !== b.tieneAsistencia) return a.tieneAsistencia ? -1 : 1;
    if (a.cantActividades !== b.cantActividades) return b.cantActividades - a.cantActividades;
    return a.nombre.localeCompare(b.nombre);
  });

  sortedEntes.forEach((ente, idx) => {
    if (currentY > pageHeight - 22) {
      doc.addPage();
      drawOfficialHeader(
        doc,
        'Reporte de Asistencias por Dependencia, Empresa e Instituto',
        'Participación en Festividades, Efemérides, Eventos, Mesas y Directorios (Cont.)',
        logo
      );
      applyWatermark(doc, watermark);
      currentY = 35;

      // Repeat table header
      doc.setFillColor(15, 23, 42);
      doc.rect(margin, currentY, pageWidth - margin * 2, 6.5, 'F');
      doc.setFontSize(6.8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      let hX = margin;
      tableHeaders.forEach((th, i) => {
        doc.text(th, hX + (i === 0 || i === 3 ? 4 : 2), currentY + 4.5, {
          align: i === 0 || i === 3 ? 'center' : 'left',
        });
        hX += colWidths[i];
      });
      currentY += 6.5;
    }

    const rowBg = idx % 2 === 0 ? [248, 250, 252] : [255, 255, 255];
    doc.setFillColor(rowBg[0], rowBg[1], rowBg[2]);
    doc.rect(margin, currentY, pageWidth - margin * 2, 5.8, 'F');

    doc.setFontSize(6.8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);

    let cellX = margin;
    // N°
    doc.text(`${idx + 1}`, cellX + 4, currentY + 4, { align: 'center' });
    cellX += colWidths[0];

    // Dependencia / Ente
    const depTitle = ente.nombre.length > 48 ? ente.nombre.slice(0, 46) + '..' : ente.nombre;
    doc.setFont('helvetica', 'bold');
    doc.text(depTitle, cellX + 2, currentY + 4);
    cellX += colWidths[1];

    // Tipo
    doc.setFont('helvetica', 'normal');
    doc.text(ente.tipo, cellX + 2, currentY + 4);
    cellX += colWidths[2];

    // Actividades
    doc.text(`${ente.cantActividades}`, cellX + 7, currentY + 4, { align: 'center' });
    cellX += colWidths[3];

    // Asistentes
    doc.text(`${ente.totalAsistentes}`, cellX + 2, currentY + 4);
    cellX += colWidths[4];

    // Estado
    if (ente.tieneAsistencia) {
      doc.setTextColor(5, 150, 105);
      doc.setFont('helvetica', 'bold');
      doc.text('ASISTIÓ', cellX + 2, currentY + 4);
    } else {
      doc.setTextColor(220, 38, 38);
      doc.setFont('helvetica', 'bold');
      doc.text('SIN REGISTRO', cellX + 2, currentY + 4);
    }
    doc.setTextColor(51, 65, 85);
    cellX += colWidths[5];

    // Última fecha
    doc.setFont('helvetica', 'normal');
    doc.text(ente.ultimaFecha, cellX + 2, currentY + 4);

    currentY += 5.8;
  });

  // Footer on all pages
  const totalPages = doc.internal.pages.length - 1;
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Página ${p} de ${totalPages} — Alcaldía del Municipio Autónomo Tinaquillo | Dirección General`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    );
  }

  doc.save(`Reporte_Asistencias_Por_Entes_Tinaquillo_${new Date().toISOString().split('T')[0]}.pdf`);
}

// 2.7 EXPORTAR DIRECTORIO DE FUNCIONARIOS A EXCEL
export function exportarExcelFuncionarios(funcionarios: Funcionario[]): void {
  const data = (funcionarios || []).map((f, idx) => ({
    'N°': idx + 1,
    'Nombres y Apellidos': f.nombresApellidos || 'No registrado',
    'Cédula de Identidad': f.cedula || 'N/A',
    'Dependencia Municipal': f.dependencia || 'N/A',
    'Clasificación': f.clasificacion || 'CENTRALIZADA',
    'Cargo Oficial': f.cargo || 'DIRECTOR(A)',
    'N° de Resolución': f.numeroResolucion || 'N/A',
    'Fecha de Resolución': f.fechaResolucion || 'N/A',
    'Teléfono de Contacto': f.telefono || 'N/A',
    'Estatus': f.estado || 'ACTIVO',
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data.length > 0 ? data : [
    {
      'N°': '-',
      'Nombres y Apellidos': 'Sin funcionarios registrados',
      'Cédula de Identidad': '-',
      'Dependencia Municipal': '-',
      'Clasificación': '-',
      'Cargo Oficial': '-',
      'N° de Resolución': '-',
      'Fecha de Resolución': '-',
      'Teléfono de Contacto': '-',
      'Estatus': '-',
    }
  ]);

  // Adjust column widths
  ws['!cols'] = [
    { wch: 5 },
    { wch: 32 },
    { wch: 16 },
    { wch: 42 },
    { wch: 18 },
    { wch: 30 },
    { wch: 20 },
    { wch: 18 },
    { wch: 18 },
    { wch: 12 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Directorio de Funcionarios');
  XLSX.writeFile(wb, `Directorio_Funcionarios_Tinaquillo_${new Date().toISOString().split('T')[0]}.xlsx`);
}

// 2.8 EXPORTAR DIRECTORIO DE FUNCIONARIOS A PDF
export async function exportarPDFFuncionarios(funcionarios: Funcionario[]): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  let currentY = 12;

  const logo = await getImageDataUrl('/logo-oficial.png', true);
  drawOfficialHeader(
    doc,
    'Directorio Oficial de Funcionarios Públicos Municipales',
    'Alcaldía del Municipio Autónomo Tinaquillo • Nómina Oficial de Directores y Presidentes',
    logo
  );
  currentY = 40;

  // Metadata Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 14, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(`Total de Funcionarios Registrados: ${funcionarios.length}`, margin + 5, currentY + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(`Fecha de emisión: ${new Date().toLocaleDateString('es-VE')}`, margin + 5, currentY + 11);

  currentY += 18;

  // Table Columns (Landscape: total width ~ 273mm)
  const colWidths = [10, 52, 26, 75, 45, 35, 30];
  const colHeaders = [
    'N°',
    'Nombres y Apellidos',
    'Cédula',
    'Dependencia Municipal',
    'Cargo Oficial',
    'N° Resolución',
    'Teléfono',
  ];

  const drawTableHeader = () => {
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(margin, currentY, pageWidth - margin * 2, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);

    let cellX = margin;
    colHeaders.forEach((h, i) => {
      doc.text(h, cellX + 2, currentY + 4.8);
      cellX += colWidths[i];
    });
    currentY += 7;
  };

  drawTableHeader();

  if (funcionarios.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('No hay funcionarios registrados en la base de datos municipal.', margin + 5, currentY + 10);
    currentY += 15;
  } else {
    funcionarios.forEach((func, idx) => {
      if (currentY > pageHeight - 20) {
        doc.addPage();
        currentY = 15;
        drawTableHeader();
      }

      // Zebra striping
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, currentY, pageWidth - margin * 2, 6, 'F');
      }

      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);

      let cellX = margin;

      // N°
      doc.text(`${idx + 1}`, cellX + 2, currentY + 4.2);
      cellX += colWidths[0];

      // Nombres
      doc.setFont('helvetica', 'bold');
      const nombreTrunc = (func.nombresApellidos || '').substring(0, 32);
      doc.text(nombreTrunc, cellX + 2, currentY + 4.2);
      cellX += colWidths[1];

      // Cédula
      doc.setFont('helvetica', 'normal');
      doc.text(func.cedula || 'N/A', cellX + 2, currentY + 4.2);
      cellX += colWidths[2];

      // Dependencia
      const depTrunc = (func.dependencia || '').substring(0, 50);
      doc.text(depTrunc, cellX + 2, currentY + 4.2);
      cellX += colWidths[3];

      // Cargo
      const cargoTrunc = (func.cargo || 'DIRECTOR(A)').substring(0, 28);
      doc.text(cargoTrunc, cellX + 2, currentY + 4.2);
      cellX += colWidths[4];

      // N° Resolución
      const resTrunc = (func.numeroResolucion || 'N/A').substring(0, 22);
      doc.text(resTrunc, cellX + 2, currentY + 4.2);
      cellX += colWidths[5];

      // Teléfono
      doc.text(func.telefono || 'N/A', cellX + 2, currentY + 4.2);

      currentY += 6;
    });
  }

  // Footer on all pages
  const totalPages = doc.internal.pages.length - 1;
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Página ${p} de ${totalPages} — Alcaldía del Municipio Autónomo Tinaquillo | Dirección General`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    );
  }

  doc.save(`Directorio_Oficial_Funcionarios_Tinaquillo_${new Date().toISOString().split('T')[0]}.pdf`);
}
