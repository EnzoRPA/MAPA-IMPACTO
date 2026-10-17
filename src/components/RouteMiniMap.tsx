import React, { useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import L from 'leaflet';
import { ChurchLocation, MissionaryPair, RouteCorridor } from '../types';
import { calculateDistanceMeters, formatDistance } from '../utils/houseEstimator';
import { generateStreetRouteMapDataUrl } from '../utils/mapSnapshot';
import { Layers } from 'lucide-react';

export interface RouteMiniMapRef {
  captureDataUrl: () => Promise<string | null>;
  getViewState: () => {
    center: { lat: number; lng: number };
    zoom: number;
    layer: 'osm' | 'streets' | 'satellite';
  } | null;
}

interface RouteMiniMapProps {
  route: RouteCorridor;
  church: ChurchLocation;
  pair: MissionaryPair | null;
}

const MINI_TILE_LAYERS = {
  osm: {
    id: 'osm',
    name: 'OpenStreetMap (OSM)',
    label: 'OSM',
    url: 'https://tile.openstreetmap.de/{z}/{x}/{y}.png',
    subdomains: ['a', 'b', 'c'],
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
    maxNativeZoom: 19,
  },
  streets: {
    id: 'streets',
    name: 'Google Ruas',
    label: 'Ruas',
    url: 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    subdomains: ['0', '1', '2', '3'],
    attribution: '&copy; Google Maps',
    maxZoom: 20,
    maxNativeZoom: 20,
  },
  satellite: {
    id: 'satellite',
    name: 'Satélite HD',
    label: 'Satélite',
    url: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    subdomains: ['0', '1', '2', '3'],
    attribution: '&copy; Google Maps',
    maxZoom: 22,
    maxNativeZoom: 20,
  },
};

export const RouteMiniMap = forwardRef<RouteMiniMapRef, RouteMiniMapProps>(
  ({ route, church, pair }, ref) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<L.Map | null>(null);
    const tileLayerRef = useRef<L.TileLayer | null>(null);
    const [activeLayer, setActiveLayer] = useState<'osm' | 'streets' | 'satellite'>('osm');

    const routeColor = pair?.color || route.color || '#2563EB';
    const houseCount = route.customHouseCount ?? route.estimatedHouses;

    // Helper: Draw high-res canvas vector map fallback if HTML2Canvas cannot capture tiles
    const generateCanvasFallback = (): string => {
      const canvas = document.createElement('canvas');
      canvas.width = 1000;
      canvas.height = 400;
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';

      // Background
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Border
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, canvas.width, canvas.height);

      // Grid
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      for (let x = 40; x < canvas.width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 30; y < canvas.height; y += 30) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      const coords = route.coordinates;
      if (coords && coords.length >= 2) {
        let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
        coords.forEach(([lat, lng]) => {
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
          if (lng < minLng) minLng = lng;
          if (lng > maxLng) maxLng = lng;
        });

        const latSpan = Math.max(maxLat - minLat, 0.0006);
        const lngSpan = Math.max(maxLng - minLng, 0.0006);

        const padX = 120;
        const padY = 70;
        const usableW = canvas.width - padX * 2;
        const usableH = canvas.height - padY * 2;

        const toX = (lng: number) => padX + ((lng - minLng) / lngSpan) * usableW;
        const toY = (lat: number) => canvas.height - padY - ((lat - minLat) / latSpan) * usableH;

        // Route Glow
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 14;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(toX(coords[0][1]), toY(coords[0][0]));
        for (let i = 1; i < coords.length; i++) {
          ctx.lineTo(toX(coords[i][1]), toY(coords[i][0]));
        }
        ctx.stroke();

        // Main Route Line
        ctx.strokeStyle = routeColor;
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(toX(coords[0][1]), toY(coords[0][0]));
        for (let i = 1; i < coords.length; i++) {
          ctx.lineTo(toX(coords[i][1]), toY(coords[i][0]));
        }
        ctx.stroke();

        // Waypoints
        ctx.fillStyle = routeColor;
        coords.forEach(([lat, lng]) => {
          ctx.beginPath();
          ctx.arc(toX(lng), toY(lat), 4, 0, Math.PI * 2);
          ctx.fill();
        });

        // Start Pin
        const sX = toX(coords[0][1]);
        const sY = toY(coords[0][0]);
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(sX, sY, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Start label badge
        ctx.fillStyle = '#065f46';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText('Início', sX + 10, sY + 3);

        // End Pin
        const eX = toX(coords[coords.length - 1][1]);
        const eY = toY(coords[coords.length - 1][0]);
        ctx.fillStyle = '#e11d48';
        ctx.beginPath();
        ctx.arc(eX, eY, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // End label badge
        ctx.fillStyle = '#9f1239';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText('Fim', eX + 10, eY + 3);
      }

      // Title Badge
      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.roundRect?.(20, 20, 360, 60, 8);
      ctx.fill();

      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(route.name || 'Faixa de Ruas', 35, 45);

      ctx.fillStyle = '#f8fafc';
      ctx.font = '14px sans-serif';
      ctx.fillText(`Extensão: ${formatDistance(route.lengthMeters)}  •  ~${houseCount} casas`, 35, 68);

      return canvas.toDataURL('image/jpeg', 0.92);
    };

    // Expose capture method and current view state to parent modal
    useImperativeHandle(ref, () => ({
      getViewState: () => {
        if (!mapInstanceRef.current) return null;
        const c = mapInstanceRef.current.getCenter();
        return {
          center: { lat: c.lat, lng: c.lng },
          zoom: Math.round(mapInstanceRef.current.getZoom()),
          layer: activeLayer,
        };
      },
      captureDataUrl: async () => {
        try {
          const currentMap = mapInstanceRef.current;
          let userCenter: { lat: number; lng: number } | undefined;
          let userZoom: number | undefined;

          if (currentMap) {
            const c = currentMap.getCenter();
            userCenter = { lat: c.lat, lng: c.lng };
            userZoom = Math.round(currentMap.getZoom());
          }

          return await generateStreetRouteMapDataUrl(route, church, pair, {
            width: 1200,
            height: 520,
            layer: activeLayer,
            center: userCenter,
            zoom: userZoom,
          });
        } catch (captureErr) {
          console.warn('generateStreetRouteMapDataUrl capture issue, using canvas vector fallback:', captureErr);
          return generateCanvasFallback();
        }
      },
    }));

    // Dynamically update tile layer when user switches between OSM / Ruas / Satélite without resetting zoom or pan
    useEffect(() => {
      if (tileLayerRef.current && MINI_TILE_LAYERS[activeLayer]) {
        tileLayerRef.current.setUrl(MINI_TILE_LAYERS[activeLayer].url);
      }
    }, [activeLayer]);

    useEffect(() => {
      if (!mapContainerRef.current) return;

      // Destroy previous map instance
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: true,
        dragging: true,
        doubleClickZoom: true,
      });

      L.control.zoom({ position: 'topright' }).addTo(map);

      const tileConfig = MINI_TILE_LAYERS[activeLayer];
      const tileLayer = L.tileLayer(tileConfig.url, {
        attribution: tileConfig.attribution,
        maxZoom: tileConfig.maxZoom,
        maxNativeZoom: tileConfig.maxNativeZoom,
        subdomains: tileConfig.subdomains,
        crossOrigin: 'anonymous',
      }).addTo(map);

      tileLayerRef.current = tileLayer;

      // Draw Route Polyline
      if (route.coordinates && route.coordinates.length >= 2) {
        // Glow underlay
        L.polyline(route.coordinates, {
          color: '#FFFFFF',
          weight: 7,
          opacity: 0.9,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);

        // Main Route Line
        L.polyline(route.coordinates, {
          color: routeColor,
          weight: 4.5,
          opacity: 1,
          dashArray: route.strokeStyle === 'dashed' ? '8, 8' : undefined,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);

        // Start Marker (Início) - Smaller & discreet so the traced street is clearly visible
        const startCoord = route.coordinates[0];
        const startIcon = L.divIcon({
          className: 'route-start-pin',
          html: `
            <div class="flex items-center -translate-x-1/2 -translate-y-1/2 pointer-events-none">
              <span class="px-1.5 py-0.5 bg-emerald-600 text-white text-[9px] font-bold rounded border border-white flex items-center gap-1 shadow-sm whitespace-nowrap">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-300"></span>
                Início
              </span>
            </div>
          `,
          iconSize: [0, 0],
        });
        L.marker(startCoord, { icon: startIcon }).addTo(map);

        // End Marker (Fim) - Smaller & discreet
        const endCoord = route.coordinates[route.coordinates.length - 1];
        const endIcon = L.divIcon({
          className: 'route-end-pin',
          html: `
            <div class="flex items-center -translate-x-1/2 -translate-y-1/2 pointer-events-none">
              <span class="px-1.5 py-0.5 bg-rose-600 text-white text-[9px] font-bold rounded border border-white flex items-center gap-1 shadow-sm whitespace-nowrap">
                <span class="w-1.5 h-1.5 rounded-full bg-rose-300"></span>
                Fim
              </span>
            </div>
          `,
          iconSize: [0, 0],
        });
        L.marker(endCoord, { icon: endIcon }).addTo(map);

        // Intermediate Waypoints (tiny dots)
        route.coordinates.forEach((coord, idx) => {
          if (idx !== 0 && idx !== route.coordinates.length - 1) {
            const midIcon = L.divIcon({
              className: 'route-mid-pin',
              html: `
                <div class="w-2 h-2 rounded-full bg-white border shadow-xs flex items-center justify-center -translate-x-1/2 -translate-y-1/2 pointer-events-none" style="border-color: ${routeColor}">
                  <div class="w-1 h-1 rounded-full" style="background-color: ${routeColor}"></div>
                </div>
              `,
              iconSize: [0, 0],
            });
            L.marker(coord, { icon: midIcon }).addTo(map);
          }
        });
      }

      // Check distance between Church and Route Start
      const bounds = L.latLngBounds(route.coordinates);
      if (church.lat && church.lng && route.coordinates[0]) {
        const dist = calculateDistanceMeters(
          route.coordinates[0][0],
          route.coordinates[0][1],
          church.lat,
          church.lng
        );

        if (dist < 3500) {
          bounds.extend([church.lat, church.lng]);

          const churchIcon = L.divIcon({
            className: 'church-mini-pin',
            html: `
              <div class="flex flex-col items-center -translate-x-1/2 -translate-y-full pointer-events-none">
                <div class="px-1.5 py-0.5 bg-amber-600 text-white rounded text-[9px] font-bold shadow-md whitespace-nowrap border border-white mb-0.5 flex items-center gap-1">
                  <span>⛪ ${church.name || 'Igreja'}</span>
                </div>
                <div class="w-4 h-4 rounded-full bg-amber-500 border border-white shadow-md flex items-center justify-center text-white">
                  <span class="text-[9px]">✝</span>
                </div>
              </div>
            `,
            iconSize: [0, 0],
          });
          L.marker([church.lat, church.lng], { icon: churchIcon }).addTo(map);
        }
      }

      map.fitBounds(bounds, { padding: [32, 32], maxZoom: 18 });

      const timeout = setTimeout(() => {
        map.invalidateSize();
      }, 200);

      mapInstanceRef.current = map;

      return () => {
        clearTimeout(timeout);
        map.remove();
        mapInstanceRef.current = null;
      };
    }, [route, church, pair]);

    return (
      <div className="relative w-full h-64 bg-slate-100 rounded-lg overflow-hidden border border-slate-300 shadow-inner group">
        {/* Real Leaflet Map Container */}
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Top Left Route Identity Badge */}
        <div className="absolute top-2.5 left-2.5 z-10 pointer-events-none flex flex-col gap-1 max-w-[80%]">
          <div className="bg-slate-900/90 backdrop-blur-md text-white px-3 py-1.5 rounded-lg border border-white/20 shadow-lg text-left">
            <div className="text-[11px] font-bold text-amber-300 truncate">
              {route.name}
            </div>
            <div className="text-[10px] text-slate-200 flex items-center gap-2 mt-0.5">
              <span>
                Extensão: <strong className="text-white font-mono">{formatDistance(route.lengthMeters)}</strong>
              </span>
              <span>•</span>
              <span>
                Estimativa: <strong className="text-emerald-300 font-mono">~{houseCount} casas</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Layer Switcher: OSM (default) / Ruas / Satélite HD */}
        <div className="absolute bottom-2.5 right-2.5 z-10 flex items-center gap-1 bg-white/95 backdrop-blur-sm p-1 rounded-lg border border-slate-300 shadow-md">
          <button
            type="button"
            onClick={() => setActiveLayer('osm')}
            className={`px-2 py-0.5 text-[10px] font-bold rounded transition ${
              activeLayer === 'osm'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            OSM (Padrão)
          </button>
          <button
            type="button"
            onClick={() => setActiveLayer('streets')}
            className={`px-2 py-0.5 text-[10px] font-bold rounded transition ${
              activeLayer === 'streets'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Ruas
          </button>
          <button
            type="button"
            onClick={() => setActiveLayer('satellite')}
            className={`px-2 py-0.5 text-[10px] font-bold rounded transition ${
              activeLayer === 'satellite'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Satélite HD
          </button>
        </div>

        {/* Bottom Left Legend */}
        <div className="absolute bottom-2.5 left-2.5 z-10 pointer-events-none bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-md border border-slate-300 shadow-sm flex items-center gap-2 text-[10px] text-slate-700">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="font-semibold">Início</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            <span className="font-semibold">Fim</span>
          </div>
          <div className="flex items-center gap-1 font-mono">
            <span className="w-3.5 h-1 border-t-2 border-dashed" style={{ borderColor: routeColor }}></span>
            <span className="font-semibold text-slate-900">Trecho</span>
          </div>
        </div>
      </div>
    );
  }
);
