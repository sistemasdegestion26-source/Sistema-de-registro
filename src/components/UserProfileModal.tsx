import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  CreditCard,
  Building2,
  FileCheck2,
  Calendar,
  Save,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Eraser,
} from 'lucide-react';
import { AppUser } from '../types';
import { DEPENDENCIAS_MUNICIPALES } from '../data/dependenciasData';
import { saveStoredUserProfile, syncFuncionarioToDirectorio } from '../utils/storage';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AppUser;
  onSaveUser: (updatedUser: AppUser) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSaveUser,
}) => {
  const [name, setName] = useState(currentUser.name || '');
  const [cedula, setCedula] = useState(currentUser.cedula || '');
  const [dependencia, setDependencia] = useState(
    currentUser.dependencia || 'DIRECCIÓN GENERAL'
  );
  const [numeroResolucion, setNumeroResolucion] = useState(
    currentUser.numeroResolucion || ''
  );
  const [fechaEmisionResolucion, setFechaEmisionResolucion] = useState(
    currentUser.fechaEmisionResolucion || ''
  );

  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(currentUser.name || '');
      setCedula(currentUser.cedula || '');
      setDependencia(currentUser.dependencia || 'DIRECCIÓN GENERAL');
      setNumeroResolucion(currentUser.numeroResolucion || '');
      setFechaEmisionResolucion(currentUser.fechaEmisionResolucion || '');
      setSuccessMsg(null);
      setErrorMsg(null);
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg('El nombre y apellido son obligatorios.');
      return;
    }

    const updated: AppUser = {
      ...currentUser,
      name: name.trim(),
      cedula: cedula.trim(),
      dependencia: dependencia.trim(),
      numeroResolucion: numeroResolucion.trim(),
      fechaEmisionResolucion: fechaEmisionResolucion.trim(),
    };

    saveStoredUserProfile(updated);

    // Sync official to director list if dependency is indicated
    if (updated.dependencia && updated.name) {
      syncFuncionarioToDirectorio({
        nombresApellidos: updated.name,
        cedula: updated.cedula || '',
        dependencia: updated.dependencia,
        cargo: updated.title || 'DIRECTOR(A) GENERAL',
        numeroResolucion: updated.numeroResolucion,
        fechaResolucion: updated.fechaEmisionResolucion,
      });
    }

    onSaveUser(updated);
    setSuccessMsg('¡Datos de funcionario guardados y respaldados exitosamente!');

    setTimeout(() => {
      setSuccessMsg(null);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-fade-in">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-zinc-800 to-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-200">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold tracking-widest uppercase text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                  Usuario Principal
                </span>
              </div>
              <h3 className="text-base font-bold tracking-tight text-white mt-0.5">
                Perfil y Registro de Funcionario Principal
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Success */}
          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs font-semibold text-emerald-800 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Error */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs font-semibold text-rose-800 animate-fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Email (Readonly reference) */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex items-center justify-between">
            <span className="font-semibold text-slate-500 uppercase tracking-wider text-[11px]">
              Correo Institucional:
            </span>
            <span className="font-mono font-bold text-slate-800">{currentUser.email}</span>
          </div>

          {/* Nombre y Apellido */}
          <div>
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
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Dr. Juan Pérez"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:ring-2 focus:ring-slate-700 focus:bg-white"
              />
            </div>
          </div>

          {/* Cédula */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Cédula de Identidad
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <CreditCard className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={cedula}
                onChange={(e) => setCedula(e.target.value)}
                placeholder="Ej. V-12.345.678"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:ring-2 focus:ring-slate-700 focus:bg-white font-mono"
              />
            </div>
          </div>

          {/* Dependencia */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Dependencia Asignada
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Building2 className="w-4 h-4" />
              </div>
              <select
                value={dependencia}
                onChange={(e) => setDependencia(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-slate-700 focus:bg-white"
              >
                <option value="DIRECCIÓN GENERAL">DIRECCIÓN GENERAL</option>
                <option value="DESPACHO DEL ALCALDE">DESPACHO DEL ALCALDE</option>
                {DEPENDENCIAS_MUNICIPALES.map((dep) => (
                  <option key={dep.id} value={dep.nombre}>
                    {dep.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Número de Resolución */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Número de Resolución de Designación
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <FileCheck2 className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={numeroResolucion}
                onChange={(e) => setNumeroResolucion(e.target.value)}
                placeholder="Ej. RES-DG-2026-001"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:ring-2 focus:ring-slate-700 focus:bg-white font-mono"
              />
            </div>
          </div>

          {/* Fecha de Emisión de Resolución */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Fecha de Emisión de Resolución
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Calendar className="w-4 h-4" />
              </div>
              <input
                type="date"
                value={fechaEmisionResolucion}
                onChange={(e) => setFechaEmisionResolucion(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:ring-2 focus:ring-slate-700 focus:bg-white font-mono"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 flex items-center justify-between gap-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => {
                setCedula('');
                setNumeroResolucion('');
                setFechaEmisionResolucion('');
                setSuccessMsg('Datos del formulario limpiados. Haga clic en "Guardar Datos" para confirmar.');
              }}
              className="px-3 py-2 text-xs font-bold text-rose-600 hover:text-rose-800 rounded-xl hover:bg-rose-50 border border-rose-200 transition cursor-pointer flex items-center gap-1.5"
              title="Borrar datos ingresados del funcionario"
            >
              <Eraser className="w-3.5 h-3.5 text-rose-500" />
              <span>Borrar Datos</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-sm cursor-pointer"
              >
                <Save className="w-4 h-4 text-emerald-400" />
                Guardar Datos de Funcionario
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
