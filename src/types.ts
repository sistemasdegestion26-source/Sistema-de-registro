export type UserRole = 'PRIMARY_ADMIN' | 'SECONDARY_USER' | 'PLANIFICACION_USER' | 'PROTOCOLO_USER';

export interface UserCredential {
  id: string;
  usernameOrEmail: string;
  plainPassword?: string;
  passwordHash?: string;
  name: string;
  role: UserRole;
  title: string;
  dependencia?: string;
  cedula?: string;
  isActive: boolean;
  fechaCreacion?: string;
  fechaActualizacion?: string;
}

export interface MetaPoa {
  id: string;
  dependencia: string;
  clasificacion: 'CENTRALIZADA' | 'DESCENTRALIZADA';
  anio: string;
  periodo?: string;
  objetivosEstablecidosPoa: number;
  objetivosEjecutados: number;
  porcentajeAlcanzado: number;
  observaciones?: string;
  registradoPor: string;
  fechaRegistro: string;
  fechaActualizacion?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AppUser {
  email: string;
  name: string;
  role: UserRole;
  title: string;
  cedula?: string;
  dependencia?: string;
  numeroResolucion?: string;
  fechaEmisionResolucion?: string;
}

export type TipoSolicitud =
  | 'ECONÓMICA'
  | 'MEDICINA'
  | 'INSUMOS MEDICOS'
  | 'AYUDA TÉCNICA'
  | 'EXÁMENES DE LABORATORIO'
  | 'ECOGRAFÍA'
  | 'COMIDA'
  | 'UTILES'
  | 'EMPLEO'
  | 'GESTIÓN COMUNAL';

export type AreaComunal =
  | 'ÁREA 1'
  | 'ÁREA 2'
  | 'ÁREA 3'
  | 'ÁREA 4'
  | 'ÁREA 5'
  | 'ÁREA 6'
  | 'ÁREA 7';

export type EstadoSolicitud =
  | 'ATENDIDO'
  | 'REMITIR A ADMINISTRACIÓN'
  | 'REMITIR A DESPACHO'
  | 'REMITIR A DESARROLLO SOCIAL'
  | 'REMITIR A SERVICIOS PÚBLICOS'
  | 'REMITIR A TALENTO HUMANO'
  | 'REMITIDO A OTRO'
  | 'OTRO, ESPECIFIQUE'
  | 'PENDIENTE'
  | 'RECHAZADA';

export interface FileAttachment {
  id: string;
  name: string;
  type: string; // 'image' | 'pdf' | 'doc' | 'excel'
  size: number;
  dataUrl: string; // base64 representation
}

export interface Solicitud {
  id: string;
  nombresApellidos: string;
  cedula: string;
  profesionOficio?: string;
  telefonoPrefijo: string;
  telefonoNumero: string;
  telefonoCompleto: string;
  tipoSolicitud: TipoSolicitud;
  fechaSolicitud: string; // YYYY-MM-DD
  observaciones: string;
  estadoRemision: EstadoSolicitud;
  otroRemitirEspecifique?: string;
  adjuntos: FileAttachment[];
  creadoPor: string;
  fechaRegistro: string;

  // Gestión Comunal specific fields
  areaComunal?: AreaComunal;
  sector?: string;
  nombreComunidad?: string;
  planteamientoDescripcion?: string;
  observacionesReferencia?: string;
  resolucionComunal?: string;

  historialCambios?: {
    fecha: string;
    usuario: string;
    estadoAnterior: string;
    nuevoEstado: string;
    nota?: string;
  }[];
}

export type TipoInforme =
  | 'REPORTE DE GESTIÓN TRIMESTRAL'
  | 'INFORME PARCIAL DE AUDITORIA'
  | 'INFORME PARCIAL DE LA AUDITORIA OPERATIVA DE LA CONTRALORÍA MUNICIPAL'
  | 'INFORME DE AUDITORÍA DEFINITIVO'
  | 'MEMORANDUM INTERNO'
  | 'REGISTRO DE COMUNICACIÓN INTERNA DE DIRECTORIO';

export type ClasificacionDependencia = 'CENTRALIZADA' | 'EMPRESA' | 'INSTITUTO';

export interface DependenciaConfig {
  id: string;
  nombre: string;
  tipo: ClasificacionDependencia;
  tieneCargos: boolean;
  cargos?: string[];
  requiereResolucion?: boolean;
}

export type EstadoFuncionario = 'ACTIVO' | 'PROCESADO' | 'REMITIDO' | 'EN COMISION';

export interface Funcionario {
  id: string;
  nombresApellidos: string;
  cedula: string;
  dependencia: string;
  clasificacion?: ClasificacionDependencia;
  tipoDependencia?: ClasificacionDependencia | string;
  subtipo?: string;
  cargo: string;
  numeroResolucion?: string;
  fechaResolucion?: string;
  telefono?: string;
  actualizadoEn?: string;
  estado?: EstadoFuncionario;
  dependenciaRemitida?: string;
  remitidoA?: string;
  fechaRemision?: string;
  motivoRemision?: string;
  observacionProceso?: string;
  fechaProcesado?: string;
}

export type EstadoInforme = 'PENDIENTE' | 'EN REVISION' | 'PROCESADO' | 'REMITIDO';

export interface InformeDependencia {
  id: string;
  dependencia: string;
  clasificacion?: ClasificacionDependencia;
  cargo?: string;
  otroCargoEspecifique?: string;
  nombresApellidos: string;
  cedula: string;
  telefono: string;
  numeroResolucion?: string;
  fechaResolucion?: string;
  tipoInforme: TipoInforme;

  // Ciclo de vida y gestión
  estado?: EstadoInforme;
  remitidoA?: string;
  fechaRemision?: string;
  motivoRemision?: string;
  observacionProceso?: string;
  fechaProcesado?: string;
  historialEstados?: {
    fecha: string;
    usuario: string;
    estadoAnterior: string;
    nuevoEstado: string;
    nota?: string;
  }[];
  
  // Trimestral fields (actualizado: descripción breve y adjuntar informe)
  trimestre?: 'I TRIMESTRE' | 'II TRIMESTRE' | 'III TRIMESTRE' | 'IV TRIMESTRE';
  anioGestion?: string;
  descripcionBreve?: string; // Descripción breve del período
  adjuntoInforme?: FileAttachment[]; // Archivo oficial del informe
  adjuntoInformeTrimestral?: FileAttachment[]; // Archivo oficial del informe
  actividadesEjecutadas?: string; // Mantenido para retrocompatibilidad
  logrosAlcanzados?: string; // Mantenido para retrocompatibilidad
  metasFisicasProgramadas?: number;
  metasFisicasEjecutadas?: number;
  alcancePorcentaje?: number;
  memoriaFotografica?: FileAttachment[]; // Mantenido para retrocompatibilidad

  // Memorandum Interno fields (Requirement 11)
  punto1?: string;
  punto2?: string;
  puntosAdicionales?: string[];
  memorandumPuntos?: string[]; // Retrocompatibilidad
  fotoFirmaPersonal?: FileAttachment[]; // Foto de la lista de la firma del personal

  // Auditoria fields
  procedimientosAuditados?: string[]; // 1. PROCEDIMIENTOS ADMINISTRATIVOS, etc.
  descripcionDetallada?: string;
  hallazgos?: string;
  conclusionesRecomendaciones?: string;
  fechaAuditoria?: string;
  archivosAuditoria?: FileAttachment[]; // images, word, excel, pdf

  creadoPor: string;
  fechaRegistro: string;
}

export type TipoActividad =
  | 'FESTIVIDADES POPULARES'
  | 'EFEMÉRIDES'
  | 'EVENTOS'
  | 'MESAS DE TRABAJO'
  | 'DIRECTORIOS';

export interface AsistenteActividad {
  id: string;
  nombresApellidos: string;
  cedula: string;
  telefono: string;
  dependencia?: string;
  clasificacion?: ClasificacionDependencia;
  cargo?: string;
}

export interface RegistroAsistencia {
  id: string;
  tipoActividad: TipoActividad;
  nombreActividad: string;
  fecha: string;
  lugar: string;
  asistentes: AsistenteActividad[];
  foto?: FileAttachment;
  creadoPor: string;
  fechaRegistro: string;
}
