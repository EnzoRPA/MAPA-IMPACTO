import React from 'react';
import { ChurchLocation } from '../types';
import { PanelLeftClose, PanelLeft, Plus, Cloud, RefreshCw, CheckCircle2, UploadCloud } from 'lucide-react';
import { SyncStatus } from '../services/firebase';

interface NavbarProps {
  church: ChurchLocation;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  onStartDrawing: () => void;
  routesCount: number;
  totalHouses: number;
  syncStatus: SyncStatus;
  onSyncCloud: () => void;
  isSyncing?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  church,
  isSidebarOpen,
  onToggleSidebar,
  onStartDrawing,
  routesCount,
  totalHouses,
  syncStatus,
  onSyncCloud,
  isSyncing = false,
}) => {
  return (
    <header className="h-14 bg-white border-b border-slate-200 px-4 md:px-6 flex items-center justify-between gap-8 z-40 shrink-0">
      {/* Zone 1: Brand Wordmark (Single text element) */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={onToggleSidebar}
          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
          title={isSidebarOpen ? 'Ocultar Painel Lateral' : 'Exibir Painel Lateral'}
        >
          {isSidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeft className="w-5 h-5" />}
        </button>

        <a href="/" className="text-base font-extrabold tracking-tight text-slate-900 whitespace-nowrap">
          Mapeamento Missionário
        </a>
      </div>

      {/* Zone 2: Clean single-line nav links */}
      <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-600">
        <span className="text-slate-900 font-bold whitespace-nowrap">
          {church.name || 'Minha Igreja'}
        </span>
        <span className="text-slate-300">/</span>
        <span className="whitespace-nowrap font-mono text-slate-700">
          {routesCount} faixas mapeadas
        </span>
        <span className="text-slate-300">/</span>
        <span className="whitespace-nowrap font-mono text-emerald-700">
          ~{totalHouses} casas estimadas
        </span>
      </nav>

      {/* Zone 3: Database Sync Badge + Primary Action */}
      <div className="flex items-center gap-3 shrink-0">
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-lg border transition ${
            syncStatus === 'connected'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : syncStatus === 'saving'
              ? 'bg-blue-50 text-blue-700 border-blue-200'
              : syncStatus === 'offline'
              ? 'bg-amber-50 text-amber-700 border-amber-200'
              : 'bg-slate-100 text-slate-600 border-slate-200'
          }`}
          title={
            syncStatus === 'connected'
              ? 'Banco de Dados Firestore conectado. Sincronização em tempo real ativa.'
              : syncStatus === 'saving'
              ? 'Salvando alterações no banco de dados...'
              : syncStatus === 'offline'
              ? 'Modo offline: dados salvos localmente e sincronizados ao reconectar.'
              : 'Conectando ao banco de dados...'
          }
        >
          {syncStatus === 'saving' ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
          ) : syncStatus === 'connected' ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          ) : (
            <Cloud className="w-3.5 h-3.5" />
          )}
          <span className="hidden sm:inline">
            {syncStatus === 'connected'
              ? 'Nuvem Conectada'
              : syncStatus === 'saving'
              ? 'Salvando...'
              : syncStatus === 'offline'
              ? 'Offline'
              : 'Conectando...'}
          </span>
        </div>

        <button
          onClick={onSyncCloud}
          disabled={isSyncing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 hover:border-blue-300 rounded-xl transition whitespace-nowrap cursor-pointer shadow-xs disabled:opacity-50"
          title="Gravar todas as faixas e dados imediatamente no banco de dados na nuvem para ver no tablet"
        >
          {isSyncing ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
          ) : (
            <UploadCloud className="w-3.5 h-3.5 text-blue-600" />
          )}
          <span>{isSyncing ? 'Gravando...' : 'Gravar na Nuvem'}</span>
        </button>

        <button
          onClick={onStartDrawing}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-xs transition whitespace-nowrap cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Traçar Nova Faixa</span>
        </button>
      </div>
    </header>
  );
};
