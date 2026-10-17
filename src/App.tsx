import React, { useState, useEffect, useCallback } from 'react';
import { ChurchLocation, MissionaryPair, RouteCorridor } from './types';
import {
  loadChurch,
  loadPairs,
  loadRoutes,
  saveChurch,
  savePairs,
  saveRoutes,
} from './utils/storage';
import {
  SyncStatus,
  subscribeSyncStatus,
  subscribeToChurch,
  subscribeToPairs,
  subscribeToRoutes,
  saveChurchToFirestore,
  saveRouteToFirestore,
  deleteRouteFromFirestore,
  deletePairFromFirestore,
  seedPairsToFirestore,
  seedRoutesToFirestore,
  validateFirestoreConnection,
  syncEntireAppToFirestore,
} from './services/firebase';
import { TerritoryMap } from './components/TerritoryMap';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { TerritoryCardModal } from './components/TerritoryCardModal';

export default function App() {
  const [church, setChurch] = useState<ChurchLocation>(loadChurch);
  const [pairs, setPairs] = useState<MissionaryPair[]>(loadPairs);
  const [routes, setRoutes] = useState<RouteCorridor[]>(loadRoutes);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<'navigate' | 'draw' | 'set_church'>('navigate');
  const [exportModalRoute, setExportModalRoute] = useState<RouteCorridor | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('connecting');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  const handleSyncCloud = async () => {
    setIsSyncing(true);
    const result = await syncEntireAppToFirestore(routes, church, pairs);
    setIsSyncing(false);
    if (result.success) {
      setSyncNotice(
        `✅ ${result.routesCount} faixas e configurações salvas com sucesso no banco de dados na nuvem! Agora você já pode abrir no seu tablet.`
      );
    } else {
      setSyncNotice('⚠️ Não foi possível sincronizar no momento. Verifique sua conexão e tente novamente.');
    }
    setTimeout(() => {
      setSyncNotice(null);
    }, 8000);
  };

  // Firebase Real-time Subscriptions and Offline-first sync
  useEffect(() => {
    validateFirestoreConnection();

    const unsubStatus = subscribeSyncStatus((status) => {
      setSyncStatus(status);
    });

    const unsubChurch = subscribeToChurch((remoteChurch) => {
      setChurch(remoteChurch);
    });

    const unsubPairs = subscribeToPairs((remotePairs) => {
      setPairs(remotePairs);
    });

    const unsubRoutes = subscribeToRoutes((remoteRoutes) => {
      setRoutes(remoteRoutes);
    });

    return () => {
      unsubStatus();
      unsubChurch();
      unsubPairs();
      unsubRoutes();
    };
  }, []);

  // Sync to local storage as fallback
  useEffect(() => {
    saveChurch(church);
  }, [church]);

  useEffect(() => {
    savePairs(pairs);
  }, [pairs]);

  useEffect(() => {
    saveRoutes(routes);
  }, [routes]);

  // Keyboard shortcut: Escape cancels drawing or closes modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (exportModalRoute) {
          setExportModalRoute(null);
        } else if (activeMode !== 'navigate') {
          setActiveMode('navigate');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [exportModalRoute, activeMode]);

  const handleUpdateChurch = useCallback((updated: ChurchLocation) => {
    setChurch(updated);
    saveChurchToFirestore(updated);
  }, []);

  const handleUpdatePairs = useCallback((updated: MissionaryPair[]) => {
    setPairs(updated);
    seedPairsToFirestore(updated);
  }, []);

  const handleUpdateRoutes = useCallback((updated: RouteCorridor[]) => {
    setRoutes(updated);
    seedRoutesToFirestore(updated);
  }, []);

  const handleDeleteRoute = useCallback((routeId: string) => {
    setRoutes((prev) => prev.filter((r) => r.id !== routeId));
    deleteRouteFromFirestore(routeId);
  }, []);

  const handleDeletePair = useCallback((pairId: string) => {
    setPairs((prev) => prev.filter((p) => p.id !== pairId));
    deletePairFromFirestore(pairId);
  }, []);

  const handleCreateRoute = (newRoute: RouteCorridor) => {
    const updated = [newRoute, ...routes];
    setRoutes(updated);
    setSelectedRouteId(newRoute.id);
    saveRouteToFirestore(newRoute);
  };

  const handleUpdateRoute = (updatedRoute: RouteCorridor) => {
    const updated = routes.map((r) => (r.id === updatedRoute.id ? updatedRoute : r));
    setRoutes(updated);
    if (exportModalRoute?.id === updatedRoute.id) {
      setExportModalRoute(updatedRoute);
    }
    saveRouteToFirestore(updatedRoute);
  };

  const totalHouses = routes.reduce(
    (acc, r) => acc + (r.customHouseCount ?? r.estimatedHouses),
    0
  );

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-900 select-none">
      {/* Top Bar Header with Cloud Database Sync Badge */}
      <Navbar
        church={church}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        onStartDrawing={() => setActiveMode(activeMode === 'draw' ? 'navigate' : 'draw')}
        routesCount={routes.length}
        totalHouses={totalHouses}
        syncStatus={syncStatus}
        onSyncCloud={handleSyncCloud}
        isSyncing={isSyncing}
      />

      {/* Floating Sync Notification Toast */}
      {syncNotice && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 max-w-xl w-[90%] bg-emerald-600 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xl flex items-center justify-between gap-3 animate-fade-in border border-emerald-400">
          <span>{syncNotice}</span>
          <button
            onClick={() => setSyncNotice(null)}
            className="text-emerald-100 hover:text-white p-1 rounded"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Workspace: Sidebar + Interactive Map */}
      <div className="flex flex-1 min-h-0 relative">
        <Sidebar
          church={church}
          pairs={pairs}
          routes={routes}
          selectedRouteId={selectedRouteId}
          onSelectRoute={setSelectedRouteId}
          onUpdateChurch={handleUpdateChurch}
          onUpdatePairs={handleUpdatePairs}
          onUpdateRoutes={handleUpdateRoutes}
          onDeleteRoute={handleDeleteRoute}
          onDeletePair={handleDeletePair}
          onOpenExportModal={(route) => setExportModalRoute(route)}
          onStartDrawing={() => setActiveMode('draw')}
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen((prev) => !prev)}
        />

        <main className="flex-1 h-full relative">
          <TerritoryMap
            church={church}
            pairs={pairs}
            routes={routes}
            selectedRouteId={selectedRouteId}
            onSelectRoute={setSelectedRouteId}
            onUpdateChurch={handleUpdateChurch}
            onCreateRoute={handleCreateRoute}
            onOpenExportModal={(route) => setExportModalRoute(route)}
            activeMode={activeMode}
            setActiveMode={setActiveMode}
          />
        </main>
      </div>

      {/* Territory Export Modal (JPG / PDF) */}
      {exportModalRoute && (
        <TerritoryCardModal
          route={exportModalRoute}
          church={church}
          pairs={pairs}
          onClose={() => setExportModalRoute(null)}
          onUpdateRoute={handleUpdateRoute}
        />
      )}
    </div>
  );
}
