import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import {
  ChurchLocation,
  MissionaryPair,
  RouteCorridor,
  DensityType,
} from '../types';
import {
  calculateDistanceMeters,
  calculatePolylineLength,
  estimateHouses,
  formatDistance,
  queryOsmBuildingsAroundPath,
} from '../utils/houseEstimator';
import {
  Search,
  MapPin,
  Layers,
  Crosshair,
  Check,
  X,
  RotateCcw,
  Pencil,
  Eye,
  FileDown,
  Navigation,
  Sparkles,
} from 'lucide-react';

interface TerritoryMapProps {
  church: ChurchLocation;
  pairs: MissionaryPair[];
  routes: RouteCorridor[];
  selectedRouteId: string | null;
  onSelectRoute: (id: string | null) => void;
  onUpdateChurch: (church: ChurchLocation) => void;
  onCreateRoute: (newRoute: RouteCorridor) => void;
  onOpenExportModal: (route: RouteCorridor) => void;
  activeMode: 'navigate' | 'draw' | 'set_church';
  setActiveMode: (mode: 'navigate' | 'draw' | 'set_church') => void;
}

export type TileLayerId = 'satellite_google' | 'streets' | 'satellite_esri' | 'carto';

interface TileLayerDef {
  id: TileLayerId;
  name: string;
  label: string;
  badge?: string;
  url: string;
  subdomains?: string[] | string;
  attribution: string;
  maxZoom: number;
  maxNativeZoom?: number;
}

const TILE_LAYERS: Record<TileLayerId, TileLayerDef> = {
  satellite_google: {
    id: 'satellite_google',
    name: 'Satélite HD (Google Híbrido)',
    label: 'Satélite HD',
    badge: 'HD',
    url: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    subdomains: ['0', '1', '2', '3'],
    attribution: '&copy; Google Maps',
    maxZoom: 22,
    maxNativeZoom: 20,
  },
  streets: {
    id: 'streets',
    name: 'Ruas (OpenStreetMap)',
    label: 'Ruas',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    subdomains: ['a', 'b', 'c'],
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
    maxNativeZoom: 19,
  },
  satellite_esri: {
    id: 'satellite_esri',
    name: 'Satélite Esri (Ajustado)',
    label: 'Satélite Esri',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri, Maxar',
    maxZoom: 19,
    maxNativeZoom: 16, // Previne "Map data not yet available" em cidades do interior ao fazer upscaling nativo
  },
  carto: {
    id: 'carto',
    name: 'Mapa Limpo (CartoDB)',
    label: 'Claro',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    subdomains: ['a', 'b', 'c', 'd'],
    attribution: '&copy; CARTO, &copy; OpenStreetMap',
    maxZoom: 20,
    maxNativeZoom: 19,
  },
};

const createTileLayerInstance = (config: TileLayerDef): L.TileLayer => {
  return L.tileLayer(config.url, {
    attribution: config.attribution,
    maxZoom: config.maxZoom,
    maxNativeZoom: config.maxNativeZoom ?? config.maxZoom,
    subdomains: config.subdomains || 'abc',
    crossOrigin: 'anonymous',
  });
};

export const TerritoryMap: React.FC<TerritoryMapProps> = ({
  church,
  pairs,
  routes,
  selectedRouteId,
  onSelectRoute,
  onUpdateChurch,
  onCreateRoute,
  onOpenExportModal,
  activeMode,
  setActiveMode,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const routesLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const churchMarkerRef = useRef<L.Marker | null>(null);
  const drawingLayerGroupRef = useRef<L.LayerGroup | null>(null);

  const [currentTile, setCurrentTile] = useState<TileLayerId>('satellite_google');
  const [drawingPoints, setDrawingPoints] = useState<[number, number][]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [showSaveRouteModal, setShowSaveRouteModal] = useState(false);
  const [pendingRouteName, setPendingRouteName] = useState('');
  const [pendingPairId, setPendingPairId] = useState<string>(pairs[0]?.id || '');
  const [pendingDensity, setPendingDensity] = useState<DensityType>('padrao');
  const [pendingNotes, setPendingNotes] = useState('');
  const [isQueryingOsm, setIsQueryingOsm] = useState(false);
  const [queriedOsmCount, setQueriedOsmCount] = useState<number | null>(null);
  const [isDetectingStreet, setIsDetectingStreet] = useState(false);
  const [detectedStreetName, setDetectedStreetName] = useState<string | null>(null);
  const userHasEditedNameRef = useRef(false);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [church.lat, church.lng],
      zoom: 16,
      zoomControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const initialTileConfig = TILE_LAYERS[currentTile];
    const tileLayer = createTileLayerInstance(initialTileConfig).addTo(map);

    tileLayerRef.current = tileLayer;

    const routesGroup = L.layerGroup().addTo(map);
    routesLayerGroupRef.current = routesGroup;

    const drawGroup = L.layerGroup().addTo(map);
    drawingLayerGroupRef.current = drawGroup;

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update base tile layer
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    if (tileLayerRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
    }
    const tileConfig = TILE_LAYERS[currentTile];
    const newTile = createTileLayerInstance(tileConfig).addTo(mapInstanceRef.current);
    tileLayerRef.current = newTile;
  }, [currentTile]);

  // Update Church Marker
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (churchMarkerRef.current) {
      churchMarkerRef.current.remove();
    }

    const churchIcon = L.divIcon({
      className: 'church-custom-marker',
      html: `
        <div class="flex flex-col items-center group cursor-pointer" style="transform: translate(-50%, -100%);">
          <div class="px-2.5 py-1 bg-amber-600 text-white rounded-md text-[11px] font-bold shadow-md whitespace-nowrap border border-amber-400 flex items-center gap-1.5 mb-1">
            <svg class="w-3.5 h-3.5 text-amber-200" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L4 7v2h1v11h14V9h1V7l-8-5zm-1 5h2v2h-2V7zm-2 5h6v7h-6v-7z"/>
            </svg>
            <span>${church.name || 'Igreja'}</span>
          </div>
          <div class="w-8 h-8 rounded-full bg-amber-500 border-2 border-white shadow-lg flex items-center justify-center text-white ring-2 ring-amber-600/30">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 2v20M5 8h14"/>
            </svg>
          </div>
          <div class="w-1.5 h-1.5 bg-amber-600 rounded-full mt-0.5"></div>
        </div>
      `,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });

    const marker = L.marker([church.lat, church.lng], {
      icon: churchIcon,
      draggable: activeMode === 'set_church',
    }).addTo(mapInstanceRef.current);

    marker.bindPopup(`
      <div class="p-3 text-sm">
        <h3 class="font-bold text-slate-900">${church.name || 'Igreja Local'}</h3>
        <p class="text-xs text-slate-600 mt-1">${church.address || 'Ponto de partida missionário'}</p>
        <div class="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Líder: ${church.leaderName || 'Pr. Local'}</span>
        </div>
      </div>
    `);

    marker.on('dragend', (e) => {
      const newPos = (e.target as L.Marker).getLatLng();
      onUpdateChurch({
        ...church,
        lat: newPos.lat,
        lng: newPos.lng,
      });
    });

    churchMarkerRef.current = marker;
  }, [church, activeMode]);

  // Render Routes (Dashed lines, pairs badges, click triggers)
  useEffect(() => {
    if (!routesLayerGroupRef.current || !mapInstanceRef.current) return;
    routesLayerGroupRef.current.clearLayers();

    routes.forEach((route) => {
      if (route.coordinates.length < 2) return;

      const pair = pairs.find((p) => p.id === route.pairId);
      const isSelected = route.id === selectedRouteId;
      const routeColor = pair ? pair.color : route.color || '#3B82F6';

      // Outer glow for selected route
      if (isSelected) {
        L.polyline(route.coordinates, {
          color: '#F59E0B',
          weight: 10,
          opacity: 0.5,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(routesLayerGroupRef.current!);
      }

      // Main polyline with dashed style
      const polyline = L.polyline(route.coordinates, {
        color: routeColor,
        weight: isSelected ? 6 : 5,
        opacity: 0.95,
        dashArray: route.strokeStyle === 'dashed' ? '9, 8' : undefined,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(routesLayerGroupRef.current!);

      // Tooltip with pair name and house count
      const houseCount = route.customHouseCount ?? route.estimatedHouses;
      polyline.bindTooltip(
        `<div>
          <div class="font-bold text-xs">${route.name}</div>
          <div class="text-[11px] text-slate-200 mt-0.5">
            Dupla: <span style="color: ${routeColor}; font-weight: bold;">${pair ? pair.name : 'Não atribuída'}</span>
          </div>
          <div class="text-[11px] text-amber-300 font-semibold mt-0.5">
            ${formatDistance(route.lengthMeters)} • ~${houseCount} casas
          </div>
        </div>`,
        {
          sticky: true,
          direction: 'top',
          className: 'custom-route-tooltip',
          offset: [0, -10],
        }
      );

      // Start and End Pins for this route
      const startCoord = route.coordinates[0];
      const endCoord = route.coordinates[route.coordinates.length - 1];

      const startIcon = L.divIcon({
        className: 'route-node-icon',
        html: `
          <div class="w-3.5 h-3.5 rounded-full border-2 border-white shadow-md flex items-center justify-center -translate-x-1/2 -translate-y-1/2" style="background-color: ${routeColor};">
            <span class="w-1 h-1 bg-white rounded-full"></span>
          </div>
        `,
        iconSize: [0, 0],
      });

      L.marker(startCoord, { icon: startIcon }).addTo(routesLayerGroupRef.current!);
      L.marker(endCoord, { icon: startIcon }).addTo(routesLayerGroupRef.current!);

      // Prominent Street Name Marker at Midpoint
      const midIndex = Math.floor(route.coordinates.length / 2);
      const midCoord = route.coordinates[midIndex];
      const streetLabelIcon = L.divIcon({
        className: 'route-street-label-marker',
        html: `
          <div class="cursor-pointer -translate-x-1/2 -translate-y-1/2 group pointer-events-auto select-none">
            <div class="px-2.5 py-1 rounded-lg text-[11px] font-extrabold shadow-lg flex items-center gap-1.5 whitespace-nowrap transition-transform duration-200 group-hover:scale-105 border ${
              isSelected
                ? 'bg-amber-400 text-slate-950 border-white ring-2 ring-amber-500/80 shadow-amber-500/30'
                : 'bg-slate-900/95 text-white border-white/30 backdrop-blur-md'
            }">
              <span class="w-2 h-2 rounded-full shrink-0" style="background-color: ${routeColor};"></span>
              <span class="tracking-tight">${route.name}</span>
              <span class="text-[9px] font-mono opacity-80 pl-1 border-l border-white/20">${formatDistance(route.lengthMeters)}</span>
            </div>
          </div>
        `,
        iconSize: [0, 0],
      });
      const labelMarker = L.marker(midCoord, { icon: streetLabelIcon }).addTo(routesLayerGroupRef.current!);
      labelMarker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        onSelectRoute(route.id);
      });

      polyline.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        onSelectRoute(route.id);
      });
    });
  }, [routes, pairs, selectedRouteId]);

  // Handle Map Clicks based on activeMode
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      if (activeMode === 'set_church') {
        onUpdateChurch({
          ...church,
          lat: e.latlng.lat,
          lng: e.latlng.lng,
        });
        setActiveMode('navigate');
      } else if (activeMode === 'draw') {
        setDrawingPoints((prev) => [...prev, [e.latlng.lat, e.latlng.lng]]);
      } else if (activeMode === 'navigate') {
        onSelectRoute(null);
      }
    };

    map.on('click', handleMapClick);

    return () => {
      map.off('click', handleMapClick);
    };
  }, [activeMode, church]);

  // Update in-progress drawing layer
  useEffect(() => {
    if (!drawingLayerGroupRef.current) return;
    drawingLayerGroupRef.current.clearLayers();

    if (drawingPoints.length === 0) return;

    // Draw lines connecting points
    if (drawingPoints.length >= 2) {
      L.polyline(drawingPoints, {
        color: '#2563EB',
        weight: 5,
        dashArray: '8, 8',
        opacity: 0.9,
      }).addTo(drawingLayerGroupRef.current);
    }

    // Draw circle markers on each point
    drawingPoints.forEach((pt, index) => {
      const isFirst = index === 0;
      const isLast = index === drawingPoints.length - 1;

      const dotIcon = L.divIcon({
        className: 'drawing-dot',
        html: `
          <div class="w-4 h-4 rounded-full border-2 border-white shadow-md flex items-center justify-center -translate-x-1/2 -translate-y-1/2 ${
            isFirst ? 'bg-emerald-500' : isLast ? 'bg-amber-500 animate-pulse' : 'bg-blue-600'
          }">
            <span class="text-[8px] font-bold text-white">${index + 1}</span>
          </div>
        `,
        iconSize: [0, 0],
      });

      L.marker(pt, { icon: dotIcon }).addTo(drawingLayerGroupRef.current!);
    });
  }, [drawingPoints]);

  // Real-time calculation for active drawing
  const currentDrawLength = calculatePolylineLength(drawingPoints);
  const currentEstimatedHouses = estimateHouses(currentDrawLength, pendingDensity);

  // Address search with Nominatim and intelligent fallback
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    setIsSearching(true);
    setShowSearchDropdown(true);

    try {
      // 1. Direct query
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          query
        )}&countrycodes=br,pt,us&limit=6&addressdetails=1`
      );
      let data = res.ok ? await res.json() : [];

      // 2. If no results and query contains "iasd", expand acronym to full denomination
      if ((!data || data.length === 0) && /\biasd\b/i.test(query)) {
        const expandedQuery = query.replace(/\biasd\b/gi, 'Igreja Adventista');
        const fallbackRes = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            expandedQuery
          )}&countrycodes=br,pt,us&limit=6&addressdetails=1`
        );
        if (fallbackRes.ok) {
          const fallbackData = await fallbackRes.json();
          if (fallbackData && fallbackData.length > 0) {
            data = fallbackData;
          }
        }
      }

      // 3. Fallback for "newton belo" / "governador newton bello"
      if ((!data || data.length === 0) && /newton\s*bel/i.test(query)) {
        const townRes = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            'Governador Newton Bello, Maranhão'
          )}&countrycodes=br&limit=3&addressdetails=1`
        );
        if (townRes.ok) {
          data = await townRes.json();
        }
      }

      setSearchResults(data || []);
      // If user hit Enter directly on the form and we got at least one clear result
      if (e && data && data.length === 1) {
        handleSelectSearchResult(data[0]);
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = (result: any) => {
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);

    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([lat, lon], 17, { duration: 1.5 });
    }

    onUpdateChurch({
      ...church,
      name: church.name || result.display_name.split(',')[0],
      address: result.display_name,
      lat,
      lng: lon,
    });

    setShowSearchDropdown(false);
    setSearchQuery('');
  };

  const handleGeolocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocalização não suportada no seu navegador.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([latitude, longitude], 17);
        }
        onUpdateChurch({
          ...church,
          lat: latitude,
          lng: longitude,
          address: 'Localização atual pelo GPS',
        });
      },
      (err) => {
        console.warn('Geolocation error:', err.message);
      }
    );
  };

  // Complete drawing and open assignment modal
  const handleFinishDrawing = async () => {
    if (drawingPoints.length < 2) return;
    userHasEditedNameRef.current = false;
    setDetectedStreetName(null);
    const defaultFallbackName = `Faixa ${routes.length + 1}`;
    setPendingRouteName(defaultFallbackName);
    setShowSaveRouteModal(true);

    // 1. Reverse-geocode to detect real street name
    setIsDetectingStreet(true);
    const midIdx = Math.floor(drawingPoints.length / 2);
    const midPoint = drawingPoints[midIdx];

    try {
      const revRes = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${midPoint[0]}&lon=${midPoint[1]}&zoom=18&addressdetails=1`
      );
      if (revRes.ok) {
        const revData = await revRes.json();
        const road =
          revData.address?.road ||
          revData.address?.street ||
          revData.address?.pedestrian ||
          revData.address?.residential;
        const candidateName = road || (revData.display_name ? revData.display_name.split(',')[0] : '');
        if (candidateName) {
          setDetectedStreetName(candidateName);
          // Only auto-fill if the user hasn't started manually typing
          if (!userHasEditedNameRef.current) {
            setPendingRouteName(candidateName);
          }
        }
      }
    } catch {
      // Keep default name
    } finally {
      setIsDetectingStreet(false);
    }

    // 2. Also trigger background OSM building footprint query
    setIsQueryingOsm(true);
    try {
      const count = await queryOsmBuildingsAroundPath(drawingPoints);
      setQueriedOsmCount(count);
    } finally {
      setIsQueryingOsm(false);
    }
  };

  const handleSaveRoute = () => {
    if (drawingPoints.length < 2) return;

    const length = calculatePolylineLength(drawingPoints);
    const houses = queriedOsmCount ?? estimateHouses(length, pendingDensity);
    const selectedPair = pairs.find((p) => p.id === pendingPairId);

    const newRoute: RouteCorridor = {
      id: `route-${Date.now()}`,
      name: pendingRouteName.trim() || `Faixa ${routes.length + 1}`,
      pairId: pendingPairId || null,
      coordinates: drawingPoints,
      strokeStyle: 'dashed',
      color: selectedPair?.color || '#3B82F6',
      weight: 5,
      lengthMeters: length,
      densityType: pendingDensity,
      estimatedHouses: houses,
      customHouseCount: houses,
      status: 'planejado',
      notes: pendingNotes.trim(),
      osmBuildingCount: queriedOsmCount,
      createdAt: new Date().toISOString(),
    };

    onCreateRoute(newRoute);
    setDrawingPoints([]);
    setShowSaveRouteModal(false);
    setActiveMode('navigate');
    setQueriedOsmCount(null);
    setPendingNotes('');
  };

  const handleCancelDrawing = () => {
    setDrawingPoints([]);
    setActiveMode('navigate');
  };

  const handleUndoPoint = () => {
    setDrawingPoints((prev) => prev.slice(0, -1));
  };

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden bg-slate-900">
      {/* Top Floating Bar: Address Search & Quick Controls */}
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        {/* Search Bar */}
        <div className="pointer-events-auto relative w-full sm:w-96 shadow-lg rounded-xl bg-white border border-slate-200">
          <form onSubmit={handleSearch} className="flex items-center px-3 py-2">
            <Search className="w-4 h-4 text-slate-400 shrink-0 mr-2" />
            <input
              type="text"
              placeholder="Buscar endereço ou nome da igreja..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-sm outline-none text-slate-800 placeholder-slate-400"
            />
            {isSearching ? (
              <span className="text-xs text-blue-600 animate-pulse font-medium">Buscando...</span>
            ) : (
              <button
                type="submit"
                className="text-xs font-semibold px-2.5 py-1 bg-slate-900 text-white rounded-md hover:bg-slate-800 transition"
              >
                Ir
              </button>
            )}
          </form>

          {/* Autocomplete Results Dropdown */}
          {showSearchDropdown && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-slate-100 max-h-64 overflow-y-auto">
              {searchResults.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectSearchResult(item)}
                  className="w-full px-3 py-2.5 text-left text-xs hover:bg-blue-50 flex items-start gap-2 transition"
                >
                  <MapPin className="w-3.5 h-3.5 text-blue-600 mt-0.5 shrink-0" />
                  <span className="text-slate-700 line-clamp-2">{item.display_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Map View & Layer Switcher */}
        <div className="pointer-events-auto flex items-center gap-1.5 bg-white/95 backdrop-blur-sm p-1.5 rounded-xl border border-slate-200 shadow-md">
          {(Object.values(TILE_LAYERS) as TileLayerDef[]).map((layer) => {
            const isActive = currentTile === layer.id;
            return (
              <button
                key={layer.id}
                onClick={() => setCurrentTile(layer.id)}
                title={layer.name}
                className={`relative px-2.5 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-700/50'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>{layer.label}</span>
                {layer.badge && (
                  <span
                    className={`text-[9px] font-extrabold px-1 py-0.5 rounded leading-none ${
                      isActive
                        ? 'bg-emerald-300 text-slate-900'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {layer.badge}
                  </span>
                )}
              </button>
            );
          })}

          <div className="h-4 w-px bg-slate-200 mx-1"></div>

          <button
            onClick={handleGeolocation}
            title="Minha Localização Atual"
            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition"
          >
            <Crosshair className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Drawing Mode Banner & Live Calculator */}
      {activeMode === 'draw' && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 pointer-events-auto bg-slate-900/95 text-white px-5 py-3 rounded-2xl border border-blue-500/50 shadow-2xl flex items-center gap-4 animate-in fade-in slide-in-from-top-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
            <div className="text-xs">
              <span className="font-semibold block text-slate-200">
                Clique no mapa ao longo da rua para traçar
              </span>
              <span className="text-slate-400">
                {drawingPoints.length} pontos • Extensão:{' '}
                <strong className="text-amber-400 font-mono">{formatDistance(currentDrawLength)}</strong>{' '}
                • Média:{' '}
                <strong className="text-emerald-400 font-mono">
                  ~{currentEstimatedHouses} casas
                </strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 border-l border-slate-700 pl-3">
            <button
              onClick={handleUndoPoint}
              disabled={drawingPoints.length === 0}
              className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded-lg flex items-center gap-1 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Desfazer</span>
            </button>
            <button
              onClick={handleCancelDrawing}
              className="px-2.5 py-1 text-xs bg-red-950/80 hover:bg-red-900 text-red-200 rounded-lg flex items-center gap-1 transition"
            >
              <X className="w-3.5 h-3.5" />
              <span>Cancelar</span>
            </button>
            <button
              onClick={handleFinishDrawing}
              disabled={drawingPoints.length < 2}
              className="px-3.5 py-1 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold rounded-lg flex items-center gap-1.5 shadow-md transition"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Concluir Faixa</span>
            </button>
          </div>
        </div>
      )}

      {/* Set Church Placement Banner */}
      {activeMode === 'set_church' && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 pointer-events-auto bg-amber-900/95 text-white px-5 py-2.5 rounded-2xl border border-amber-500 shadow-2xl flex items-center gap-3">
          <MapPin className="w-4 h-4 text-amber-300 animate-bounce" />
          <span className="text-xs font-semibold">
            Clique no mapa ou arraste o pin para definir o ponto da sua Igreja
          </span>
          <button
            onClick={() => setActiveMode('navigate')}
            className="px-2 py-0.5 text-xs bg-amber-800 hover:bg-amber-700 rounded-md font-medium"
          >
            Pronto
          </button>
        </div>
      )}

      {/* Bottom Floating Map Action Deck */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 pointer-events-auto flex items-center gap-3 bg-white/95 backdrop-blur-md p-2 rounded-2xl border border-slate-200 shadow-2xl">
        <button
          onClick={() => {
            if (activeMode === 'draw') {
              setActiveMode('navigate');
              setDrawingPoints([]);
            } else {
              setActiveMode('draw');
              setDrawingPoints([]);
            }
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs transition-all shadow-sm ${
            activeMode === 'draw'
              ? 'bg-blue-600 text-white ring-2 ring-blue-400/40'
              : 'bg-slate-900 text-white hover:bg-slate-800'
          }`}
        >
          <Pencil className="w-4 h-4" />
          <span>{activeMode === 'draw' ? 'Modo Traçado Ativo' : 'Traçar Nova Faixa de Rua'}</span>
        </button>

        <button
          onClick={() => {
            setActiveMode(activeMode === 'set_church' ? 'navigate' : 'set_church');
          }}
          className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-medium text-xs transition ${
            activeMode === 'set_church'
              ? 'bg-amber-600 text-white ring-2 ring-amber-400/40'
              : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
          }`}
        >
          <MapPin className="w-4 h-4 text-amber-600" />
          <span>Mudar Ponto da Igreja</span>
        </button>
      </div>

      {/* Main Map Container */}
      <div ref={mapContainerRef} className="w-full h-full relative" />

      {/* Modal: Save and Assign Route to Missionary Pair */}
      {showSaveRouteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Definir e Atribuir Faixa</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Extensão: {formatDistance(currentDrawLength)} • {drawingPoints.length} pontos
                  mapeados
                </p>
              </div>
              <button
                onClick={() => setShowSaveRouteModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 mt-4">
              {/* Route/Street Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Nome da Rua / Faixa Territorial</span>
                  {isDetectingStreet && (
                    <span className="text-[11px] text-blue-600 font-medium animate-pulse flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Identificando nome da via no mapa...
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  value={pendingRouteName}
                  onChange={(e) => {
                    userHasEditedNameRef.current = true;
                    setPendingRouteName(e.target.value);
                  }}
                  placeholder="Ex: Rua São Luís (do nº 100 ao 450)"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 font-medium"
                />

                {detectedStreetName && (
                  <div className="mt-1.5 flex items-center justify-between text-[11px] bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg">
                    <span className="text-slate-600 truncate">
                      Sugestão do mapa: <strong className="text-slate-900">{detectedStreetName}</strong>
                    </span>
                    {pendingRouteName !== detectedStreetName && (
                      <button
                        type="button"
                        onClick={() => {
                          userHasEditedNameRef.current = false;
                          setPendingRouteName(detectedStreetName);
                        }}
                        className="text-blue-600 hover:text-blue-800 font-semibold shrink-0 ml-2"
                      >
                        Usar sugestão
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Missionary Pair Assignment */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Dupla Missionária Responsável
                </label>
                <select
                  value={pendingPairId}
                  onChange={(e) => setPendingPairId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 bg-white"
                >
                  <option value="">-- Não atribuir no momento --</option>
                  {pairs.map((pair) => (
                    <option key={pair.id} value={pair.id}>
                      {pair.name} ({pair.members.join(', ')})
                    </option>
                  ))}
                </select>
              </div>

              {/* Urban Density Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tipo de Ocupação da Rua (para cálculo de casas)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'padrao', label: 'Padrão (~10m/lote)', desc: 'Casas residenciais' },
                    { id: 'alta', label: 'Alta Densidade', desc: 'Vilas, lotes estreitos' },
                    { id: 'baixa', label: 'Baixa Densidade', desc: 'Chácaras, terrenos' },
                    { id: 'edificios', label: 'Área com Edifícios', desc: 'Prédios / aptos' },
                  ].map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setPendingDensity(d.id as DensityType)}
                      className={`p-2.5 rounded-xl border text-left transition ${
                        pendingDensity === d.id
                          ? 'border-blue-600 bg-blue-50/70 text-blue-900 font-medium'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="text-xs font-semibold">{d.label}</div>
                      <div className="text-[10px] text-slate-500">{d.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* House Count Preview Box */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600 font-medium">
                    Média Estimada de Casas:
                  </span>
                  <div className="text-right">
                    <span className="text-lg font-bold text-slate-900 font-mono">
                      ~{estimateHouses(currentDrawLength, pendingDensity)}
                    </span>
                    <span className="text-xs text-slate-500 ml-1">residências</span>
                  </div>
                </div>

                {isQueryingOsm && (
                  <div className="mt-2 text-[11px] text-blue-600 flex items-center gap-1.5 animate-pulse">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Consultando dados de edificações no satélite OpenStreetMap...</span>
                  </div>
                )}

                {queriedOsmCount !== null && (
                  <div className="mt-2 pt-2 border-t border-slate-200/60 text-[11px] text-emerald-700 font-medium flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" />
                    <span>Edificações detectadas no OSM: {queriedOsmCount} imóveis</span>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Observações para a Dupla (Opcional)
                </label>
                <textarea
                  value={pendingNotes}
                  onChange={(e) => setPendingNotes(e.target.value)}
                  placeholder="Ex: Iniciar pelo lado ímpar, atenção à casa de esquina..."
                  rows={2}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowSaveRouteModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition"
              >
                Voltar ao Mapa
              </button>
              <button
                type="button"
                onClick={handleSaveRoute}
                className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-md transition"
              >
                Salvar e Fixar Rota
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
