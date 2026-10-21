import React, { useState, useEffect } from 'react';
import {
  X,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Save,
  Plus,
  Trash2,
  Sparkles,
  Users,
  Check,
  Briefcase,
  Building2,
} from 'lucide-react';
import { AppUser, UserCredential, UserRole } from '../types';
import {
  getStoredCredentials,
  saveStoredCredentials,
  DEFAULT_AUTH_CREDENTIALS,
} from '../utils/storage';

interface UserCredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AppUser;
}

export const UserCredentialsModal: React.FC<UserCredentialsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const [credentials, setCredentials] = useState<UserCredential[]>(() =>
    getStoredCredentials()
  );
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [feedbackMsg, setFeedbackMsg] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // New User Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('PROTOCOLO_USER');
  const [newTitle, setNewTitle] = useState('');
  const [newDependencia, setNewDependencia] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Sync on open
  useEffect(() => {
    if (isOpen) {
      setCredentials(getStoredCredentials());
      setFeedbackMsg(null);
      setShowAddForm(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Strict Security Check: Only Primary Admin allowed
  const isPrimaryAdmin =
    currentUser.role === 'PRIMARY_ADMIN' ||
    currentUser.email.toLowerCase() === 'dg.municipiotinaquillo@gmail.com' ||
    currentUser.email.toLowerCase() === 'dg.municipiotianquillo@gmail.com' ||
    currentUser.email.toLowerCase() === 'sistemasdegestion26@gmail.com';

  if (!isPrimaryAdmin) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs">
        <div className="bg-white rounded-2xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl border border-rose-200">
          <div className="w-12 h-12 mx-auto rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Acceso Denegado</h3>
          <p className="text-xs text-slate-600">
            La edición de credenciales y contraseñas de acceso está restringida exclusivamente para el Usuario Principal (Dirección General).
          </p>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  const togglePasswordVisibility = (id: string) => {
    setShowPasswords((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleUpdateField = (
    id: string,
    field: keyof UserCredential,
    value: any
  ) => {
    setCredentials((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    setFeedbackMsg(null);
    try {
      const ok = await saveStoredCredentials(credentials, true);
      if (ok) {
        setFeedbackMsg({
          type: 'success',
          text: '¡Credenciales y contraseñas guardadas y sincronizadas exitosamente en todos los dispositivos!',
        });
      } else {
        setFeedbackMsg({
          type: 'success',
          text: 'Credenciales guardadas localmente y preparadas para sincronización.',
        });
      }
      setTimeout(() => setFeedbackMsg(null), 4000);
    } catch (e) {
      setFeedbackMsg({
        type: 'error',
        text: 'Ocurrió un error al guardar las credenciales.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = async () => {
    if (
      !window.confirm(
        '¿Desea restablecer todas las credenciales institucionales a sus valores oficiales originales?'
      )
    ) {
      return;
    }
    setCredentials(DEFAULT_AUTH_CREDENTIALS);
    await saveStoredCredentials(DEFAULT_AUTH_CREDENTIALS, true);
    setFeedbackMsg({
      type: 'success',
      text: 'Se han restablecido las credenciales oficiales de fábrica (Dirección General, Directores, Planificación y Protocolo).',
    });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  const handleAddNewUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword.trim()) {
      alert('El usuario/correo y la contraseña son requeridos.');
      return;
    }

    const newCred: UserCredential = {
      id: `cred-${Date.now()}`,
      usernameOrEmail: newUsername.trim(),
      plainPassword: newPassword.trim(),
      name: newName.trim() || newUsername.trim(),
      role: newRole,
      title: newTitle.trim() || 'Usuario Registrado',
      dependencia: newDependencia.trim() || 'ALCALDÍA DE TINAQUILLO',
      isActive: true,
      fechaCreacion: new Date().toISOString(),
    };

    const updated = [...credentials, newCred];
    setCredentials(updated);
    await saveStoredCredentials(updated, true);

    setNewUsername('');
    setNewPassword('');
    setNewName('');
    setNewTitle('');
    setNewDependencia('');
    setShowAddForm(false);

    setFeedbackMsg({
      type: 'success',
      text: `Usuario "${newCred.usernameOrEmail}" creado con éxito y habilitado para inicio de sesión.`,
    });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  const handleDeleteUser = async (id: string, username: string) => {
    if (
      username.toLowerCase() === 'sistemasdegestion26@gmail.com' ||
      username.toLowerCase() === 'dg.municipiotinaquillo@gmail.com'
    ) {
      alert('No es posible eliminar la cuenta principal del sistema.');
      return;
    }
    if (!window.confirm(`¿Está seguro de eliminar el acceso para "${username}"?`)) {
      return;
    }
    const filtered = credentials.filter((c) => c.id !== id);
    setCredentials(filtered);
    await saveStoredCredentials(filtered, true);
    setFeedbackMsg({
      type: 'success',
      text: `Usuario "${username}" eliminado.`,
    });
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'PRIMARY_ADMIN':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300">
            Usuario Principal (Dirección General)
          </span>
        );
      case 'SECONDARY_USER':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-300">
            Directores y Presidentes (Informes)
          </span>
        );
      case 'PLANIFICACION_USER':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
            Planificación y Organización (POA)
          </span>
        );
      case 'PROTOCOLO_USER':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
            Protocolo (Registro de Actividades)
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-800 border border-slate-300">
            {role}
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[92vh] animate-in fade-in-0 zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between border-b border-slate-700/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-600/30 border border-violet-400/40 text-violet-300 flex items-center justify-center shrink-0 shadow-xs">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black tracking-tight text-white">
                  Editar Credenciales de Acceso y Contraseñas
                </h2>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950">
                  Exclusivo Principal
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Administre usuarios, correos institucionales y contraseñas con sincronización en tiempo real
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Banner */}
        {feedbackMsg && (
          <div
            className={`p-3 text-xs font-semibold flex items-center gap-2 border-b shrink-0 ${
              feedbackMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : 'bg-rose-50 text-rose-900 border-rose-200'
            }`}
          >
            {feedbackMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="flex-1">{feedbackMsg.text}</span>
          </div>
        )}

        {/* Main Content Area */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 bg-slate-50/60">
          
          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <div className="text-xs text-slate-600 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Total de cuentas configuradas: <strong className="font-bold text-slate-900">{credentials.length}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAddForm(!showAddForm)}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nuevo Usuario</span>
              </button>
              <button
                type="button"
                onClick={handleResetDefaults}
                className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 transition flex items-center gap-1.5 cursor-pointer"
                title="Restablecer cuentas oficiales iniciales"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restablecer Fábrica</span>
              </button>
            </div>
          </div>

          {/* New User Form Collapse */}
          {showAddForm && (
            <form
              onSubmit={handleAddNewUser}
              className="p-4 bg-emerald-50/70 border border-emerald-300 rounded-2xl space-y-3.5 animate-in fade-in-0 duration-150 shadow-xs"
            >
              <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                <h3 className="text-xs font-bold text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-emerald-700" />
                  Agregar Nuevo Usuario de Acceso
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-emerald-800 hover:text-emerald-950 text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Usuario o Correo <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="Ej. Protocolo1 o correo"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:ring-2 focus:ring-emerald-700"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Contraseña de Acceso <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Ej. Protocolo2026"
                      className="w-full pl-3 pr-8 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-medium text-slate-900 focus:ring-2 focus:ring-emerald-700"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Rol en el Sistema <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-700"
                  >
                    <option value="PROTOCOLO_USER">Protocolo (Registro de Actividades)</option>
                    <option value="SECONDARY_USER">Directores y Presidentes (Carga de Informes)</option>
                    <option value="PLANIFICACION_USER">Planificación (Registro POA)</option>
                    <option value="PRIMARY_ADMIN">Usuario Principal (Administrador)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Nombre del Encargado / Dirección
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Ej. Dirección de Protocolo y Eventos"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:ring-2 focus:ring-emerald-700"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Cargo / Título Oficial
                  </label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Ej. Registro de Actividades"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:ring-2 focus:ring-emerald-700"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Dependencia Adscrita
                  </label>
                  <input
                    type="text"
                    value={newDependencia}
                    onChange={(e) => setNewDependencia(e.target.value)}
                    placeholder="Ej. DIRECCIÓN EJECUTIVA DE DESPACHO"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:ring-2 focus:ring-emerald-700"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Guardar y Habilitar Usuario</span>
                </button>
              </div>
            </form>
          )}

          {/* List of Configured Credentials */}
          <div className="space-y-3.5">
            {credentials.map((cred) => {
              const isVisible = showPasswords[cred.id];
              const isMainAccount =
                cred.usernameOrEmail.toLowerCase() === 'sistemasdegestion26@gmail.com' ||
                cred.usernameOrEmail.toLowerCase() === 'dg.municipiotinaquillo@gmail.com';

              return (
                <div
                  key={cred.id}
                  className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition space-y-3"
                >
                  {/* Card Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 font-bold text-xs shrink-0">
                        {cred.usernameOrEmail.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-slate-900">
                            {cred.name || cred.usernameOrEmail}
                          </h4>
                          {getRoleBadge(cred.role)}
                        </div>
                        <p className="text-[10px] text-slate-500">
                          {cred.title || 'Acceso Municipal'} {cred.dependencia ? `• ${cred.dependencia}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={cred.isActive}
                          onChange={(e) =>
                            handleUpdateField(cred.id, 'isActive', e.target.checked)
                          }
                          className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-[11px] font-semibold">
                          {cred.isActive ? 'Activo' : 'Inactivo'}
                        </span>
                      </label>

                      {!isMainAccount && (
                        <button
                          type="button"
                          onClick={() =>
                            handleDeleteUser(cred.id, cred.usernameOrEmail)
                          }
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          title="Eliminar este usuario de acceso"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Form Fields for Credential */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* Username or Email */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                        Usuario o Correo de Acceso
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                          <User className="w-3.5 h-3.5" />
                        </div>
                        <input
                          type="text"
                          required
                          value={cred.usernameOrEmail}
                          onChange={(e) =>
                            handleUpdateField(cred.id, 'usernameOrEmail', e.target.value)
                          }
                          className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-slate-700"
                        />
                      </div>
                    </div>

                    {/* Password */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                        Contraseña / Clave
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                          <Lock className="w-3.5 h-3.5" />
                        </div>
                        <input
                          type={isVisible ? 'text' : 'password'}
                          required
                          value={cred.plainPassword || ''}
                          onChange={(e) =>
                            handleUpdateField(cred.id, 'plainPassword', e.target.value)
                          }
                          placeholder="Ingrese contraseña"
                          className="w-full pl-8 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-slate-700"
                        />
                        <button
                          type="button"
                          onClick={() => togglePasswordVisibility(cred.id)}
                          className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                          title={isVisible ? 'Ocultar' : 'Ver contraseña'}
                        >
                          {isVisible ? (
                            <EyeOff className="w-3.5 h-3.5" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Nombre del Responsable */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                        Nombre o Dirección
                      </label>
                      <input
                        type="text"
                        value={cred.name || ''}
                        onChange={(e) =>
                          handleUpdateField(cred.id, 'name', e.target.value)
                        }
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-slate-700"
                      />
                    </div>

                    {/* Rol */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                        Módulo / Rol Asignado
                      </label>
                      <select
                        value={cred.role}
                        disabled={isMainAccount}
                        onChange={(e) =>
                          handleUpdateField(cred.id, 'role', e.target.value as UserRole)
                        }
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-slate-700 disabled:opacity-60"
                      >
                        <option value="PRIMARY_ADMIN">Usuario Principal</option>
                        <option value="SECONDARY_USER">Directores y Presidentes (Informes)</option>
                        <option value="PLANIFICACION_USER">Planificación (POA)</option>
                        <option value="PROTOCOLO_USER">Protocolo (Actividades)</option>
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <span>Los cambios de credenciales se aplican de inmediato en el inicio de sesión.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              Cerrar
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSaveAll}
              className="px-5 py-2 bg-gradient-to-r from-slate-900 to-slate-800 hover:from-black hover:to-slate-900 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-75"
            >
              <Save className="w-3.5 h-3.5 text-amber-300" />
              <span>{isSaving ? 'Guardando...' : 'Guardar Todas las Credenciales'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
