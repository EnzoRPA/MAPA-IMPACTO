import React, { useState } from 'react';
import { ChurchLocation, MissionaryPair, RouteCorridor, DensityType } from '../types';
import { formatDistance, estimateHouses } from '../utils/houseEstimator';
import {
  Map,
  Users,
  Church,
  BarChart3,
  Plus,
  Trash2,
  FileDown,
  Image,
  Pencil,
  ChevronRight,
  ExternalLink,
  MapPin,
  CheckCircle,
  Clock,
  Search,
  BookOpen,
  Phone,
  Layers,
  ChevronDown,
  Send,
  RotateCcw,
  Check,
  X,
  Download,
  Upload,
  HardDrive,
} from 'lucide-react';
import { WhatsAppDispatchModal } from './WhatsAppDispatchModal';
import {
  loadWhatsAppTemplate,
  saveWhatsAppTemplate,
  resetWhatsAppTemplate,
} from '../utils/whatsapp';
import { generateCampaignSummaryPdf } from '../utils/exporter';
import { DEFAULT_PAIRS } from '../utils/storage';
import { seedPairsToFirestore } from '../services/firebase';

interface SidebarProps {
  church: ChurchLocation;
  pairs: MissionaryPair[];
  routes: RouteCorridor[];
  selectedRouteId: string | null;
  onSelectRoute: (id: string | null) => void;
  onUpdateChurch: (church: ChurchLocation) => void;
  onUpdatePairs: (pairs: MissionaryPair[]) => void;
  onUpdateRoutes: (routes: RouteCorridor[]) => void;
  onDeleteRoute?: (routeId: string) => void;
  onDeletePair?: (pairId: string) => void;
  onOpenExportModal: (route: RouteCorridor) => void;
  onStartDrawing: () => void;
  isOpen: boolean;
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  church,
  pairs,
  routes,
  selectedRouteId,
  onSelectRoute,
  onUpdateChurch,
  onUpdatePairs,
  onUpdateRoutes,
  onDeleteRoute,
  onDeletePair,
  onOpenExportModal,
  onStartDrawing,
  isOpen,
  onToggle,
}) => {
  const [activeTab, setActiveTab] = useState<'routes' | 'pairs' | 'church' | 'stats'>('routes');
  const [routeSearch, setRouteSearch] = useState('');
  const [pairFilter, setPairFilter] = useState<string>('all');

  // Pair modal state
  const [showPairModal, setShowPairModal] = useState(false);
  const [editingPair, setEditingPair] = useState<MissionaryPair | null>(null);
  const [pairName, setPairName] = useState('');
  const [member1, setMember1] = useState('');
  const [member2, setMember2] = useState('');
  const [member3, setMember3] = useState('');
  const [pairPhone, setPairPhone] = useState('');
  const [pairColor, setPairColor] = useState('#2563EB');
  const [pairTarget, setPairTarget] = useState(50);

  // Edit Route state
  const [editingRoute, setEditingRoute] = useState<RouteCorridor | null>(null);
  const [whatsAppPairModal, setWhatsAppPairModal] = useState<MissionaryPair | null>(null);
  const [whatsappTemplate, setWhatsappTemplate] = useState<string>(loadWhatsAppTemplate);
  const [templateSavedFeedback, setTemplateSavedFeedback] = useState(false);

  const handleUpdatePairPhone = (pairId: string, newPhone: string) => {
    onUpdatePairs(
      pairs.map((p) => (p.id === pairId ? { ...p, phone: newPhone } : p))
    );
  };

  const handleSaveTemplate = () => {
    saveWhatsAppTemplate(whatsappTemplate);
    setTemplateSavedFeedback(true);
    setTimeout(() => setTemplateSavedFeedback(false), 2500);
  };

  const handleResetTemplate = () => {
    const def = resetWhatsAppTemplate();
    setWhatsappTemplate(def);
    setTemplateSavedFeedback(true);
    setTimeout(() => setTemplateSavedFeedback(false), 2500);
  };

  // Stats calculation
  const totalLengthMeters = routes.reduce((acc, r) => acc + r.lengthMeters, 0);
  const totalHouses = routes.reduce((acc, r) => acc + (r.customHouseCount ?? r.estimatedHouses), 0);
  const totalBooksSuggested = Math.round(totalHouses * 1.05);
  const completedRoutes = routes.filter((r) => r.status === 'concluido').length;

  // Filtered routes
  const filteredRoutes = routes.filter((route) => {
    const matchesSearch = route.name.toLowerCase().includes(routeSearch.toLowerCase());
    const matchesPair = pairFilter === 'all' || route.pairId === pairFilter;
    return matchesSearch && matchesPair;
  });

  // Open add pair modal
  const handleOpenAddPair = () => {
    setEditingPair(null);
    setPairName(`Dupla ${pairs.length + 1}`);
    setMember1('');
    setMember2('');
    setMember3('');
    setPairPhone('');
    setPairColor(['#2563EB', '#DC2626', '#059669', '#7C3AED', '#D97706', '#DB2777'][pairs.length % 6]);
    setPairTarget(50);
    setShowPairModal(true);
  };

  // Open edit pair modal
  const handleOpenEditPair = (pair: MissionaryPair) => {
    setEditingPair(pair);
    setPairName(pair.name);
    setMember1(pair.members[0] || '');
    setMember2(pair.members[1] || '');
    setMember3(pair.members[2] || '');
    setPairPhone(pair.phone || '');
    setPairColor(pair.color);
    setPairTarget(pair.targetBooks);
    setShowPairModal(true);
  };

  // Save Pair
  const handleSavePair = (e: React.FormEvent) => {
    e.preventDefault();
    const members = [member1.trim(), member2.trim(), member3.trim()].filter(Boolean);

    if (editingPair) {
      const updated = pairs.map((p) =>
        p.id === editingPair.id
          ? {
              ...p,
              name: pairName.trim() || p.name,
              members,
              phone: pairPhone.trim(),
              color: pairColor,
              targetBooks: pairTarget,
            }
          : p
      );
      onUpdatePairs(updated);
    } else {
      const newPair: MissionaryPair = {
        id: `pair-${Date.now()}`,
        name: pairName.trim() || `Dupla ${pairs.length + 1}`,
        members,
        phone: pairPhone.trim(),
        color: pairColor,
        targetBooks: pairTarget,
      };
      onUpdatePairs([...pairs, newPair]);
    }
    setShowPairModal(false);
  };

  // Export JSON backup file
  const handleExportBackup = () => {
    const backupData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      church,
      pairs,
      routes,
    };
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute(
      'download',
      `backup_mapeamento_${new Date().toISOString().slice(0, 10)}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Import JSON backup file
  const handleImportBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        if (parsed.church) onUpdateChurch(parsed.church);
        if (Array.isArray(parsed.pairs)) onUpdatePairs(parsed.pairs);
        if (Array.isArray(parsed.routes)) onUpdateRoutes(parsed.routes);
      } catch (err) {
        console.error('Backup import error:', err);
      }
    };
    reader.readAsText(file);
    // Reset input
    event.target.value = '';
  };

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'route' | 'pair';
    id: string;
    name: string;
  } | null>(null);

  const handleExecuteDelete = () => {
    if (!deleteConfirm) return;
    if (deleteConfirm.type === 'route') {
      if (onDeleteRoute) {
        onDeleteRoute(deleteConfirm.id);
      } else {
        onUpdateRoutes(routes.filter((r) => r.id !== deleteConfirm.id));
      }
      if (selectedRouteId === deleteConfirm.id) {
        onSelectRoute(null);
      }
    } else if (deleteConfirm.type === 'pair') {
      if (onDeletePair) {
        onDeletePair(deleteConfirm.id);
      } else {
        onUpdatePairs(pairs.filter((p) => p.id !== deleteConfirm.id));
      }
      onUpdateRoutes(
        routes.map((r) => (r.pairId === deleteConfirm.id ? { ...r, pairId: null } : r))
      );
    }
    setDeleteConfirm(null);
  };

  // Update Route assigned pair
  const handleAssignPair = (routeId: string, newPairId: string) => {
    const pair = pairs.find((p) => p.id === newPairId);
    onUpdateRoutes(
      routes.map((r) =>
        r.id === routeId
          ? {
              ...r,
              pairId: newPairId || null,
              color: pair?.color || r.color,
            }
          : r
      )
    );
  };

  // Update Route Status
  const handleToggleRouteStatus = (route: RouteCorridor) => {
    const nextStatus =
      route.status === 'planejado'
        ? 'em_andamento'
        : route.status === 'em_andamento'
        ? 'concluido'
        : 'planejado';

    onUpdateRoutes(
      routes.map((r) => (r.id === route.id ? { ...r, status: nextStatus } : r))
    );
  };

  return (
    <aside
      className={`h-full bg-white border-r border-slate-200 z-30 flex flex-col transition-all duration-300 shadow-xl ${
        isOpen ? 'w-80 md:w-96' : 'w-0 overflow-hidden border-none'
      }`}
    >
      {/* Sidebar Header & Tab Navigation */}
      <div className="border-b border-slate-200 bg-slate-50/70 p-3">
        <div className="grid grid-cols-4 gap-1 bg-slate-200/80 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setActiveTab('routes')}
            className={`py-1.5 px-2 rounded-lg transition flex items-center justify-center gap-1.5 ${
              activeTab === 'routes'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Map className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden sm:inline">Ruas</span>
            <span className="text-[10px] bg-slate-100 text-slate-600 px-1 rounded-full font-mono">
              {routes.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('pairs')}
            className={`py-1.5 px-2 rounded-lg transition flex items-center justify-center gap-1.5 ${
              activeTab === 'pairs'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">Duplas</span>
            <span className="text-[10px] bg-slate-100 text-slate-600 px-1 rounded-full font-mono">
              {pairs.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('church')}
            className={`py-1.5 px-2 rounded-lg transition flex items-center justify-center gap-1.5 ${
              activeTab === 'church'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Church className="w-3.5 h-3.5 text-amber-600" />
            <span className="hidden sm:inline">Igreja</span>
          </button>

          <button
            onClick={() => setActiveTab('stats')}
            className={`py-1.5 px-2 rounded-lg transition flex items-center justify-center gap-1.5 ${
              activeTab === 'stats'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-purple-600" />
            <span className="hidden sm:inline">Metas</span>
          </button>
        </div>
      </div>

      {/* TAB 1: ROUTES & STREETS */}
      {activeTab === 'routes' && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Controls bar: search and filter */}
          <div className="p-3 border-b border-slate-100 space-y-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filtrar por nome da rua..."
                  value={routeSearch}
                  onChange={(e) => setRouteSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <button
                onClick={onStartDrawing}
                title="Traçar nova rua"
                className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-sm transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Traçar</span>
              </button>
            </div>

            {/* Filter by Pair */}
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className="text-[11px] font-medium text-slate-400">Dupla:</span>
              <select
                value={pairFilter}
                onChange={(e) => setPairFilter(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-md py-1 px-2 outline-none flex-1 truncate"
              >
                <option value="all">Todas as Duplas</option>
                {pairs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Routes List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {filteredRoutes.length === 0 ? (
              <div className="text-center py-10 px-4">
                <Map className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-medium text-slate-600">Nenhuma faixa encontrada</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Use o botão "Traçar Nova Faixa" no mapa para desenhar onde a dupla vai entregar.
                </p>
                <button
                  onClick={onStartDrawing}
                  className="mt-3 px-3 py-1.5 text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition"
                >
                  Começar a Traçar
                </button>
              </div>
            ) : (
              filteredRoutes.map((route) => {
                const pair = pairs.find((p) => p.id === route.pairId);
                const isSelected = route.id === selectedRouteId;
                const houses = route.customHouseCount ?? route.estimatedHouses;

                return (
                  <div
                    key={route.id}
                    onClick={() => onSelectRoute(route.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/40 shadow-sm ring-1 ring-blue-500/20'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
                    }`}
                  >
                    {/* Left color bar indicator */}
                    <div
                      className="absolute left-0 top-0 bottom-0 w-1.5"
                      style={{ backgroundColor: pair ? pair.color : route.color }}
                    />

                    <div className="pl-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-xs font-bold text-slate-900 leading-snug">
                          {route.name}
                        </h4>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleRouteStatus(route);
                          }}
                          className={`text-[10px] px-2 py-0.5 rounded font-semibold whitespace-nowrap transition ${
                            route.status === 'concluido'
                              ? 'bg-emerald-100 text-emerald-800'
                              : route.status === 'em_andamento'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {route.status === 'concluido'
                            ? 'Concluído'
                            : route.status === 'em_andamento'
                            ? 'Em andamento'
                            : 'Planejado'}
                        </button>
                      </div>

                      {/* Pair selector dropdown */}
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className="text-[11px] text-slate-500 font-medium">Dupla:</span>
                        <select
                          value={route.pairId || ''}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => handleAssignPair(route.id, e.target.value)}
                          className="text-[11px] font-semibold bg-slate-50 border border-slate-200 rounded px-2 py-0.5 outline-none max-w-[170px] truncate"
                          style={{
                            color: pair ? pair.color : '#64748B',
                          }}
                        >
                          <option value="">A Definir</option>
                          {pairs.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Distance and House count tags */}
                      <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono">
                        <span className="text-slate-600">{formatDistance(route.lengthMeters)}</span>
                        <span className="font-bold text-slate-900 bg-amber-50 px-2 py-0.5 rounded text-amber-900 border border-amber-200/60">
                          ~{houses} casas estimadas
                        </span>
                      </div>

                      {/* Quick Action buttons: WhatsApp, JPG/PDF, Delete */}
                      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-end gap-1.5">
                        {pair && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setWhatsAppPairModal(pair);
                            }}
                            title={`Convocar ${pair.name} no WhatsApp com trajeto e livros`}
                            className="px-2 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md flex items-center gap-1 transition"
                          >
                            <Send className="w-3 h-3 text-emerald-600" />
                            <span>WhatsApp</span>
                          </button>
                        )}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingRoute(route);
                          }}
                          title="Editar nome da rua, casas e detalhes"
                          className="px-2 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md flex items-center gap-1 transition"
                        >
                          <Pencil className="w-3 h-3 text-slate-600" />
                          <span>Editar</span>
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenExportModal(route);
                          }}
                          className="px-2 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md flex items-center gap-1 transition"
                        >
                          <FileDown className="w-3 h-3" />
                          <span>Ficha / Exportar</span>
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirm({
                              type: 'route',
                              id: route.id,
                              name: route.name,
                            });
                          }}
                          title="Excluir rota"
                          className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 2: MISSIONARY PAIRS (DUPLAS) */}
      {activeTab === 'pairs' && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="p-3 border-b border-slate-100 flex items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-xs font-bold text-slate-900">Duplas Missionárias</h3>
                <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                  {pairs.length} cadastradas
                </span>
              </div>
              <p className="text-[11px] text-slate-500">Equipes designadas para o campo</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  onUpdatePairs(DEFAULT_PAIRS);
                  seedPairsToFirestore(DEFAULT_PAIRS);
                }}
                title="Garantir sincronização das 21 duplas oficiais cadastradas"
                className="px-2 py-1.5 text-[11px] font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1 transition"
              >
                <RotateCcw className="w-3 h-3 text-slate-500" />
                <span className="hidden xl:inline">Sincronizar 21</span>
              </button>
              <button
                onClick={handleOpenAddPair}
                className="px-2.5 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center gap-1 shadow-sm transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nova Dupla</span>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {pairs.map((pair) => {
              const assignedRoutes = routes.filter((r) => r.pairId === pair.id);
              const assignedDistance = assignedRoutes.reduce((acc, r) => acc + r.lengthMeters, 0);
              const assignedHouses = assignedRoutes.reduce(
                (acc, r) => acc + (r.customHouseCount ?? r.estimatedHouses),
                0
              );

              return (
                <div
                  key={pair.id}
                  className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs relative overflow-hidden"
                >
                  <div
                    className="absolute top-0 left-0 right-0 h-1"
                    style={{ backgroundColor: pair.color }}
                  />

                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: pair.color }}
                      />
                      <h4 className="text-xs font-bold text-slate-900">{pair.name}</h4>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditPair(pair)}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded"
                        title="Editar Dupla"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() =>
                          setDeleteConfirm({
                            type: 'pair',
                            id: pair.id,
                            name: pair.name,
                          })
                        }
                        className="p-1 text-slate-400 hover:text-red-600 rounded"
                        title="Remover Dupla"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Members */}
                  <div className="mt-1.5 text-xs text-slate-600">
                    <span className="font-medium">
                      {pair.members.length > 0
                        ? pair.members.length === 2
                          ? `${pair.members[0]} & ${pair.members[1]}`
                          : pair.members.length > 2
                          ? `${pair.members.slice(0, -1).join(', ')} & ${pair.members[pair.members.length - 1]}`
                          : pair.members[0]
                        : 'Membros ainda não cadastrados'}
                    </span>
                    {pair.phone && (
                      <span className="text-[11px] text-slate-400 block mt-0.5">
                        Contato: {pair.phone}
                      </span>
                    )}
                  </div>

                  {/* Stats of this pair */}
                  <div className="mt-2.5 pt-2 border-t border-slate-100 grid grid-cols-3 gap-1 text-center font-mono">
                    <div className="bg-slate-50 p-1 rounded">
                      <span className="text-[10px] text-slate-400 block font-sans">Faixas</span>
                      <span className="text-xs font-bold text-slate-800">
                        {assignedRoutes.length}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-1 rounded">
                      <span className="text-[10px] text-slate-400 block font-sans">Extensão</span>
                      <span className="text-xs font-bold text-slate-800">
                        {formatDistance(assignedDistance)}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-1 rounded">
                      <span className="text-[10px] text-slate-400 block font-sans">Casas</span>
                      <span className="text-xs font-bold text-blue-700">~{assignedHouses}</span>
                    </div>
                  </div>

                  {/* WhatsApp Convocation Action Bar */}
                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="text-[11px] text-slate-500 font-medium">
                      Retirar na igreja:{' '}
                      <strong className="text-emerald-700 font-bold font-mono">
                        {Math.max(1, Math.round(assignedHouses * 1.05))} livros
                      </strong>
                    </div>

                    <button
                      onClick={() => setWhatsAppPairModal(pair)}
                      className="px-2.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 rounded-lg flex items-center gap-1.5 transition shadow-2xs"
                      title="Enviar convocação no WhatsApp com trajeto e quantidade de livros"
                    >
                      <Send className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Convocação WhatsApp</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: CHURCH & CAMPAIGN CONFIG */}
      {activeTab === 'church' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <h3 className="text-xs font-bold text-slate-900">Configuração da Igreja</h3>
            <p className="text-[11px] text-slate-500">
              Esses dados sairão no cabeçalho dos cartões em JPG e PDF
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nome da Igreja / Congregação
              </label>
              <input
                type="text"
                value={church.name}
                onChange={(e) => onUpdateChurch({ ...church, name: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Endereço / Ponto Central
              </label>
              <input
                type="text"
                value={church.address}
                onChange={(e) => onUpdateChurch({ ...church, address: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Pastor ou Líder do Ministério Pessoal
              </label>
              <input
                type="text"
                value={church.leaderName}
                onChange={(e) => onUpdateChurch({ ...church, leaderName: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Título do Livro Missionário a Ser Entregue
              </label>
              <input
                type="text"
                value={church.bookTitle}
                onChange={(e) => onUpdateChurch({ ...church, bookTitle: e.target.value })}
                placeholder="Ex: O Grande Conflito, O Desejado de Todas as Nações..."
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="pt-2 border-t border-slate-100">
              <span className="text-[11px] text-slate-500 block mb-1">Coordenadas da Igreja:</span>
              <div className="text-xs font-mono text-slate-700 bg-slate-50 p-2 rounded border border-slate-200">
                Lat: {church.lat.toFixed(6)}, Lng: {church.lng.toFixed(6)}
              </div>
            </div>

            {/* WhatsApp Message Matrix/Template Editor */}
            <div className="pt-3 border-t border-slate-200 mt-2">
              <div className="flex items-center justify-between mb-1.5">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Matriz da Mensagem WhatsApp</span>
                  </h4>
                  <p className="text-[10px] text-slate-500">
                    Edite o modelo de texto enviado automaticamente para as duplas
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleResetTemplate}
                  title="Restaurar modelo original"
                  className="text-[10px] text-slate-500 hover:text-slate-800 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-100"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Padrão</span>
                </button>
              </div>

              {/* Variable Insert Pills */}
              <div className="mb-2">
                <span className="text-[10px] text-slate-400 block mb-1">Clique para inserir variável:</span>
                <div className="flex flex-wrap gap-1">
                  {[
                    '{DUPLA}',
                    '{IGREJA}',
                    '{ENDERECO}',
                    '{DATA}',
                    '{LIVRO}',
                    '{LIVROS_RETIRADA}',
                    '{CASAS}',
                    '{EXTENSAO}',
                    '{ROTAS}',
                  ].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setWhatsappTemplate((prev) => prev + ` ${tag}`)}
                      className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-mono border border-slate-200"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                value={whatsappTemplate}
                onChange={(e) => setWhatsappTemplate(e.target.value)}
                rows={9}
                className="w-full text-xs font-mono p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500 text-slate-800 leading-relaxed resize-y"
              />

              <div className="flex items-center justify-between mt-2">
                {templateSavedFeedback ? (
                  <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" />
                    Matriz salva com sucesso!
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400">Salvo no navegador</span>
                )}

                <button
                  type="button"
                  onClick={handleSaveTemplate}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-xs transition"
                >
                  Salvar Matriz
                </button>
              </div>
            </div>

            {/* Backup & Data Safety (Export / Import JSON) */}
            <div className="pt-3 border-t border-slate-200 mt-3">
              <div className="mb-2">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-blue-600" />
                  <span>Backup & Segurança dos Dados</span>
                </h4>
                <p className="text-[10px] text-slate-500">
                  Baixe uma cópia de segurança de todas as faixas e duplas para guardar ou transferir para seu tablet
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleExportBackup}
                  className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 border border-slate-200 transition"
                  title="Baixar arquivo JSON com todas as faixas e configurações"
                >
                  <Download className="w-3.5 h-3.5 text-slate-600" />
                  <span>Baixar Backup</span>
                </button>

                <label
                  className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 border border-slate-200 transition cursor-pointer"
                  title="Restaurar faixas a partir de um arquivo de backup"
                >
                  <Upload className="w-3.5 h-3.5 text-slate-600" />
                  <span>Restaurar</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportBackup}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: STATS & OVERALL GOALS */}
      {activeTab === 'stats' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <h3 className="text-xs font-bold text-slate-900">Metas & Resumo Geral</h3>
            <p className="text-[11px] text-slate-500">
              Cálculo integrado de logística e cobertura territorial
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl">
              <span className="text-[11px] font-semibold text-blue-900 block">Total de Faixas</span>
              <span className="text-xl font-extrabold text-blue-950 font-mono">{routes.length}</span>
              <span className="text-[10px] text-blue-700 block mt-0.5">ruas traçadas</span>
            </div>

            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl">
              <span className="text-[11px] font-semibold text-amber-900 block">Extensão Total</span>
              <span className="text-xl font-extrabold text-amber-950 font-mono">
                {formatDistance(totalLengthMeters)}
              </span>
              <span className="text-[10px] text-amber-700 block mt-0.5">de caminhada</span>
            </div>

            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl">
              <span className="text-[11px] font-semibold text-emerald-900 block">
                Total de Casas
              </span>
              <span className="text-xl font-extrabold text-emerald-950 font-mono">
                ~{totalHouses}
              </span>
              <span className="text-[10px] text-emerald-700 block mt-0.5">residências</span>
            </div>

            <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl">
              <span className="text-[11px] font-semibold text-purple-900 block">Livros Necessários</span>
              <span className="text-xl font-extrabold text-purple-950 font-mono">
                {totalBooksSuggested}
              </span>
              <span className="text-[10px] text-purple-700 block mt-0.5">com 5% de margem</span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-slate-700">Conclusão do Território</span>
              <span className="font-mono text-slate-900">
                {routes.length > 0 ? Math.round((completedRoutes / routes.length) * 100) : 0}%
              </span>
            </div>
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-600 h-full transition-all duration-500"
                style={{
                  width: `${
                    routes.length > 0 ? (completedRoutes / routes.length) * 100 : 0
                  }%`,
                }}
              />
            </div>
            <span className="text-[11px] text-slate-500 block mt-1.5">
              {completedRoutes} de {routes.length} faixas finalizadas no campo
            </span>
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900">
            <span className="font-bold block mb-1">Como calcular o número de livros:</span>
            A aplicação calcula a extensão real de cada via traçada considerando as residências de ambos os lados da rua (com média de ~1 casa a cada 5 metros de via urbana).
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => generateCampaignSummaryPdf(church, pairs, routes)}
              disabled={routes.length === 0}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-sm transition"
            >
              <FileDown className="w-4 h-4 text-blue-400" />
              <span>Baixar Relatório Geral da Campanha (PDF)</span>
            </button>
            <p className="text-[10px] text-slate-400 text-center mt-1.5">
              Gera tabela completa com todas as faixas, duplas e metas
            </p>
          </div>
        </div>
      )}

      {/* Add/Edit Pair Modal */}
      {showPairModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 mb-3">
              {editingPair ? 'Editar Dupla Missionária' : 'Cadastrar Nova Dupla'}
            </h3>

            <form onSubmit={handleSavePair} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Identificação da Dupla
                </label>
                <input
                  type="text"
                  required
                  value={pairName}
                  onChange={(e) => setPairName(e.target.value)}
                  placeholder="Ex: Dupla 1, Dupla dos Jovens..."
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Missionário 1
                  </label>
                  <input
                    type="text"
                    value={member1}
                    onChange={(e) => setMember1(e.target.value)}
                    placeholder="Nome"
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Missionário 2
                  </label>
                  <input
                    type="text"
                    value={member2}
                    onChange={(e) => setMember2(e.target.value)}
                    placeholder="Nome"
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Missionário 3 <span className="text-slate-400 font-normal">(Opcional / Trios)</span>
                </label>
                <input
                  type="text"
                  value={member3}
                  onChange={(e) => setMember3(e.target.value)}
                  placeholder="Nome do 3º integrante (se houver)"
                  className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  WhatsApp / Telefone de Contato
                </label>
                <input
                  type="text"
                  value={pairPhone}
                  onChange={(e) => setPairPhone(e.target.value)}
                  placeholder="(00) 00000-0000"
                  className="w-full text-xs px-3 py-1.5 border border-slate-300 rounded-lg outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Cor da Rota no Mapa
                </label>
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    '#2563EB', '#DC2626', '#059669', '#7C3AED', '#D97706', '#DB2777',
                    '#0891B2', '#EA580C', '#4F46E5', '#16A34A', '#9333EA', '#0284C7',
                    '#C026D3', '#0D9488', '#E11D48', '#65A30D', '#475569', '#B45309'
                  ].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setPairColor(c)}
                      className={`w-5 h-5 rounded-full border-2 transition ${
                        pairColor === c ? 'border-slate-900 scale-110 shadow-sm' : 'border-white'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPairModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-sm"
                >
                  Salvar Dupla
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal for Deletions */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  {deleteConfirm.type === 'route' ? 'Excluir Faixa' : 'Excluir Dupla'}
                </h4>
                <p className="text-xs text-slate-500">Esta ação não pode ser desfeita.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-4 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
              Tem certeza que deseja remover <strong>"{deleteConfirm.name}"</strong>?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExecuteDelete}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg shadow-sm transition"
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Missionary Dispatch Modal */}
      {whatsAppPairModal && (
        <WhatsAppDispatchModal
          pair={whatsAppPairModal}
          church={church}
          assignedRoutes={routes.filter((r) => r.pairId === whatsAppPairModal.id)}
          onClose={() => setWhatsAppPairModal(null)}
          onUpdatePairPhone={handleUpdatePairPhone}
        />
      )}

      {/* Edit Route Modal */}
      {editingRoute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Editar Faixa / Nome da Rua</h4>
                <p className="text-xs text-slate-500">Altere o nome da rua, dupla responsável ou dados</p>
              </div>
              <button
                onClick={() => setEditingRoute(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const newName = (form.elements.namedItem('routeName') as HTMLInputElement).value;
                const newPairId = (form.elements.namedItem('routePair') as HTMLSelectElement).value;
                const newHouses = parseInt((form.elements.namedItem('routeHouses') as HTMLInputElement).value, 10);
                const newStatus = (form.elements.namedItem('routeStatus') as HTMLSelectElement).value as any;
                const newNotes = (form.elements.namedItem('routeNotes') as HTMLTextAreaElement).value;

                const selectedPair = pairs.find((p) => p.id === newPairId);
                const updatedRoutes = routes.map((r) =>
                  r.id === editingRoute.id
                    ? {
                        ...r,
                        name: newName.trim() || r.name,
                        pairId: newPairId || null,
                        color: selectedPair?.color || r.color,
                        customHouseCount: isNaN(newHouses) ? r.customHouseCount : newHouses,
                        status: newStatus,
                        notes: newNotes,
                      }
                    : r
                );
                onUpdateRoutes(updatedRoutes);
                setEditingRoute(null);
              }}
              className="space-y-3.5"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome da Rua / Faixa
                </label>
                <input
                  name="routeName"
                  type="text"
                  defaultValue={editingRoute.name}
                  required
                  placeholder="Ex: Rua São Luís"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Dupla Missionária Responsável
                </label>
                <select
                  name="routePair"
                  defaultValue={editingRoute.pairId || ''}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 bg-white"
                >
                  <option value="">-- Não atribuída --</option>
                  {pairs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.members.join(', ')})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Número de Casas
                  </label>
                  <input
                    name="routeHouses"
                    type="number"
                    min={1}
                    defaultValue={editingRoute.customHouseCount ?? editingRoute.estimatedHouses}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Status da Rota
                  </label>
                  <select
                    name="routeStatus"
                    defaultValue={editingRoute.status}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 bg-white"
                  >
                    <option value="planejado">Planejado</option>
                    <option value="em_andamento">Em andamento</option>
                    <option value="concluido">Concluído</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Observações para a Dupla
                </label>
                <textarea
                  name="routeNotes"
                  rows={2}
                  defaultValue={editingRoute.notes || ''}
                  placeholder="Ex: Começar pelo início da numeração..."
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingRoute(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-sm"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </aside>
  );
};
