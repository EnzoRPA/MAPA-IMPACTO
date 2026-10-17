import { ChurchLocation, MissionaryPair, RouteCorridor } from '../types';
import { calculateDistanceMeters, formatDistance } from './houseEstimator';

export interface GenerateMapOptions {
  width?: number;
  height?: number;
  layer?: 'streets' | 'osm' | 'satellite';
  center?: { lat: number; lng: number };
  zoom?: number;
}

/**
 * Converts latitude and longitude to world pixel coordinate at a given zoom level (Web Mercator)
 */
function latLngToWorldPixel(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const sinLat = Math.sin((lat * Math.PI) / 180);
  const clampedSinLat = Math.max(-0.9999, Math.min(0.9999, sinLat));
  const scale = 256 * Math.pow(2, zoom);
  const x = scale * ((lng + 180) / 360);
  const y = scale * (0.5 - Math.log((1 + clampedSinLat) / (1 - clampedSinLat)) / (4 * Math.PI));
  return { x, y };
}

/**
 * Loads an image from a URL with crossOrigin anonymous and a strict timeout
 */
function loadTileImage(url: string, timeoutMs = 2500): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const timer = setTimeout(() => {
      img.src = '';
      reject(new Error(`Tile timeout: ${url}`));
    }, timeoutMs);

    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };

    img.onerror = (e) => {
      clearTimeout(timer);
      reject(e);
    };

    img.src = url;
  });
}

/**
 * Returns the tile URL for a given tile coordinate (x, y, z) and layer
 * Defaults to rich OpenStreetMap (OSM) style
 */
function getTileUrl(x: number, y: number, z: number, layer: 'streets' | 'osm' | 'satellite' = 'osm'): string {
  const n = Math.pow(2, z);
  const wrappedX = ((x % n) + n) % n;

  if (layer === 'satellite') {
    const s = Math.abs((x + y) % 4);
    return `https://mt${s}.google.com/vt/lyrs=y&x=${wrappedX}&y=${y}&z=${z}`;
  }

  if (layer === 'streets') {
    const s = Math.abs((x + y) % 4);
    return `https://mt${s}.google.com/vt/lyrs=m&x=${wrappedX}&y=${y}&z=${z}`;
  }

  // 'osm': Standard OpenStreetMap Cartography (not clean/pale, full street map with details)
  return `https://tile.openstreetmap.de/${z}/${wrappedX}/${y}.png`;
}

/**
 * Fallback tile URL if primary fails
 */
function getAlternativeTileUrl(x: number, y: number, z: number): string {
  const n = Math.pow(2, z);
  const wrappedX = ((x % n) + n) % n;
  const s = Math.abs((x + y) % 4);
  return `https://mt${s}.google.com/vt/lyrs=m&x=${wrappedX}&y=${y}&z=${z}`;
}

/**
 * Generates a high-resolution, pixel-perfect street map canvas with actual raster tiles,
 * route polyline, START/END badges, street badge and legend.
 * 
 * Works 100% reliably in any environment without depending on Leaflet DOM transforms or html2canvas.
 */
export async function generateStreetRouteMapCanvas(
  route: RouteCorridor,
  church: ChurchLocation,
  pair?: MissionaryPair | null,
  options: GenerateMapOptions = {}
): Promise<HTMLCanvasElement> {
  const width = options.width || 1200;
  const height = options.height || 520;
  const layer = options.layer || 'osm';

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context not available');
  }

  // 1. Fill base canvas with clean light slate
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, width, height);

  const coords = route.coordinates || [];
  if (coords.length < 2) {
    // Return empty styled canvas if no coordinates
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, width, height);
    return canvas;
  }

  // Include church in bounds if close enough (< 2.5km) to keep route readable
  const pointsToFit = [...coords];
  if (church?.lat && church?.lng && coords[0]) {
    const distChurch = calculateDistanceMeters(
      coords[0][0],
      coords[0][1],
      church.lat,
      church.lng
    );
    if (distChurch < 2500) {
      pointsToFit.push([church.lat, church.lng]);
    }
  }

  // 2. Determine zoom level & center position (uses user defined zoom & center if available)
  let optimalZoom: number;
  let centerWorldX: number;
  let centerWorldY: number;

  if (options.zoom && options.center) {
    // User explicitly defined zoom and pan in the interactive map before clicking export!
    optimalZoom = Math.max(12, Math.min(20, Math.round(options.zoom)));
    const cPix = latLngToWorldPixel(options.center.lat, options.center.lng, optimalZoom);
    centerWorldX = cPix.x;
    centerWorldY = cPix.y;
  } else {
    const padX = 140;
    const padY = 100;
    const usableWidth = width - padX * 2;
    const usableHeight = height - padY * 2;

    optimalZoom = 17;
    for (let z = 18; z >= 13; z--) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const [lat, lng] of pointsToFit) {
        const p = latLngToWorldPixel(lat, lng, z);
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      const spanX = maxX - minX;
      const spanY = maxY - minY;

      if (spanX <= usableWidth && spanY <= usableHeight) {
        optimalZoom = z;
        break;
      }
      optimalZoom = z;
    }

    optimalZoom = Math.max(14, Math.min(18, optimalZoom));

    let minWorldX = Infinity, maxWorldX = -Infinity, minWorldY = Infinity, maxWorldY = -Infinity;
    for (const [lat, lng] of pointsToFit) {
      const p = latLngToWorldPixel(lat, lng, optimalZoom);
      if (p.x < minWorldX) minWorldX = p.x;
      if (p.x > maxWorldX) maxWorldX = p.x;
      if (p.y < minWorldY) minWorldY = p.y;
      if (p.y > maxWorldY) maxWorldY = p.y;
    }

    centerWorldX = (minWorldX + maxWorldX) / 2;
    centerWorldY = (minWorldY + maxWorldY) / 2;
  }

  const originWorldX = centerWorldX - width / 2;
  const originWorldY = centerWorldY - height / 2;

  // 4. Compute which tiles to load
  const startTileX = Math.floor(originWorldX / 256);
  const endTileX = Math.floor((originWorldX + width) / 256);
  const startTileY = Math.floor(originWorldY / 256);
  const endTileY = Math.floor((originWorldY + height) / 256);

  const tileLoadTasks: Promise<void>[] = [];

  for (let tx = startTileX; tx <= endTileX; tx++) {
    for (let ty = startTileY; ty <= endTileY; ty++) {
      const destX = Math.round(tx * 256 - originWorldX);
      const destY = Math.round(ty * 256 - originWorldY);

      const task = (async () => {
        try {
          const primaryUrl = getTileUrl(tx, ty, optimalZoom, layer);
          const img = await loadTileImage(primaryUrl, 2500);
          ctx.drawImage(img, destX, destY, 256, 256);
        } catch {
          try {
            // Secondary fallback tile
            const altUrl = getAlternativeTileUrl(tx, ty, optimalZoom);
            const altImg = await loadTileImage(altUrl, 2000);
            ctx.drawImage(altImg, destX, destY, 256, 256);
          } catch {
            // Draw subtle placeholder square if offline/unavailable
            ctx.fillStyle = '#f1f5f9';
            ctx.fillRect(destX, destY, 256, 256);
            ctx.strokeStyle = '#e2e8f0';
            ctx.strokeRect(destX, destY, 256, 256);
          }
        }
      })();

      tileLoadTasks.push(task);
    }
  }

  // Wait for tiles to draw
  await Promise.all(tileLoadTasks);

  // 5. Transform lat/lng to canvas pixel space
  const toCanvasPoint = (lat: number, lng: number) => {
    const p = latLngToWorldPixel(lat, lng, optimalZoom);
    return {
      x: p.x - originWorldX,
      y: p.y - originWorldY,
    };
  };

  const canvasPoints = coords.map(([lat, lng]) => toCanvasPoint(lat, lng));
  const routeColor = pair?.color || route.color || '#2563EB';

  // 6. Draw Route Polyline
  if (canvasPoints.length >= 2) {
    // Outer white glow/casing to make route stand out vividly over any street tiles
    ctx.save();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(canvasPoints[0].x, canvasPoints[0].y);
    for (let i = 1; i < canvasPoints.length; i++) {
      ctx.lineTo(canvasPoints[i].x, canvasPoints[i].y);
    }
    ctx.stroke();
    ctx.restore();

    // Main vibrant colored route line
    ctx.save();
    ctx.strokeStyle = routeColor;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (route.strokeStyle === 'dashed') {
      ctx.setLineDash([14, 10]);
    }
    ctx.beginPath();
    ctx.moveTo(canvasPoints[0].x, canvasPoints[0].y);
    for (let i = 1; i < canvasPoints.length; i++) {
      ctx.lineTo(canvasPoints[i].x, canvasPoints[i].y);
    }
    ctx.stroke();
    ctx.restore();

    // Intermediate waypoint circles
    for (let i = 1; i < canvasPoints.length - 1; i++) {
      const pt = canvasPoints[i];
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = routeColor;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 7. Start Marker (INÍCIO) - Compact & discreet so street line & intersections remain clearly visible
    const startPt = canvasPoints[0];

    // Subtle small pin dot
    ctx.fillStyle = '#10B981'; // Emerald-500
    ctx.beginPath();
    ctx.arc(startPt.x, startPt.y, 4.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Small discreet INÍCIO badge pill
    const startLabel = 'Início';
    ctx.font = 'bold 9px sans-serif';
    const sMetrics = ctx.measureText(startLabel);
    const sBadgeW = sMetrics.width + 12;
    const sBadgeH = 15;
    const sBadgeX = startPt.x - sBadgeW / 2;
    const sBadgeY = startPt.y - 19;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 1;

    ctx.fillStyle = '#059669'; // Emerald-600
    ctx.beginPath();
    ctx.roundRect(sBadgeX, sBadgeY, sBadgeW, sBadgeH, 3);
    ctx.fill();

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // Tiny green dot inside badge
    ctx.fillStyle = '#6ee7b7';
    ctx.beginPath();
    ctx.arc(sBadgeX + 5, sBadgeY + sBadgeH / 2, 2, 0, Math.PI * 2);
    ctx.fill();

    // Badge text
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 9px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(startLabel, sBadgeX + 10, sBadgeY + sBadgeH / 2);

    // 8. End Marker (FIM) - Compact & discreet
    const endPt = canvasPoints[canvasPoints.length - 1];

    ctx.fillStyle = '#E11D48'; // Rose-600
    ctx.beginPath();
    ctx.arc(endPt.x, endPt.y, 4.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Small discreet FIM badge pill
    const endLabel = 'Fim';
    ctx.font = 'bold 9px sans-serif';
    const eMetrics = ctx.measureText(endLabel);
    const eBadgeW = eMetrics.width + 12;
    const eBadgeH = 15;
    const eBadgeX = endPt.x - eBadgeW / 2;
    const eBadgeY = endPt.y - 19;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 1;

    ctx.fillStyle = '#E11D48';
    ctx.beginPath();
    ctx.roundRect(eBadgeX, eBadgeY, eBadgeW, eBadgeH, 3);
    ctx.fill();

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // Tiny red dot inside badge
    ctx.fillStyle = '#fda4af';
    ctx.beginPath();
    ctx.arc(eBadgeX + 5, eBadgeY + eBadgeH / 2, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 9px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(endLabel, eBadgeX + 10, eBadgeY + eBadgeH / 2);
  }

  // 9. Church Marker (if visible in canvas bounds)
  if (church?.lat && church?.lng) {
    const chPt = toCanvasPoint(church.lat, church.lng);
    if (chPt.x >= 20 && chPt.x <= width - 20 && chPt.y >= 20 && chPt.y <= height - 20) {
      // Church Pin
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 2;

      ctx.fillStyle = '#d97706'; // Amber-600
      ctx.beginPath();
      ctx.arc(chPt.x, chPt.y, 9, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();

      // Church Name Pill
      const chName = `⛪ ${church.name || 'Igreja'}`;
      ctx.font = 'bold 11px sans-serif';
      const chMetrics = ctx.measureText(chName);
      const chW = chMetrics.width + 16;
      const chH = 22;
      const chX = chPt.x - chW / 2;
      const chY = chPt.y - 32;

      ctx.save();
      ctx.fillStyle = '#b45309';
      ctx.beginPath();
      ctx.roundRect(chX, chY, chW, chH, 5);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.textBaseline = 'middle';
      ctx.fillText(chName, chX + 8, chY + chH / 2);
      ctx.restore();
    }
  }

  // 10. Top Left Route Identity Card (Exactly as requested by user)
  const houseCount = route.customHouseCount ?? route.estimatedHouses;
  const routeTitle = route.name || 'Faixa de Ruas';
  const subtitle = `Extensão: ${formatDistance(route.lengthMeters)}   •   Estimativa: ~${houseCount} casas`;

  ctx.save();
  ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const titleMetrics = ctx.measureText(routeTitle);
  ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const subMetrics = ctx.measureText(subtitle);

  const cardW = Math.max(titleMetrics.width, subMetrics.width) + 36;
  const cardH = 62;
  const cardX = 20;
  const cardY = 18;

  // Dark slate translucent background
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 10);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Reset shadow for text
  ctx.shadowColor = 'transparent';

  // Yellow Street Name
  ctx.fillStyle = '#FDE047'; // Amber-300
  ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillText(routeTitle, cardX + 18, cardY + 12);

  // Stats Subtitle
  ctx.fillStyle = '#E2E8F0'; // Slate-200
  ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(subtitle, cardX + 18, cardY + 36);
  ctx.restore();

  // 11. Bottom Left Legend Card
  const legW = 270;
  const legH = 28;
  const legX = 20;
  const legY = height - legH - 16;

  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
  ctx.beginPath();
  ctx.roundRect(legX, legY, legW, legH, 6);
  ctx.fill();

  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.shadowColor = 'transparent';

  ctx.font = 'bold 11px sans-serif';
  ctx.textBaseline = 'middle';
  const midY = legY + legH / 2;

  // Dot 1: Início
  ctx.fillStyle = '#059669';
  ctx.beginPath();
  ctx.arc(legX + 14, midY, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillText('Início', legX + 22, midY);

  // Dot 2: Fim
  ctx.fillStyle = '#E11D48';
  ctx.beginPath();
  ctx.arc(legX + 80, midY, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillText('Fim', legX + 88, midY);

  // Line 3: Traçado da Rua
  ctx.strokeStyle = routeColor;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(legX + 138, midY);
  ctx.lineTo(legX + 160, midY);
  ctx.stroke();

  ctx.fillStyle = '#1E293B';
  ctx.fillText('Traçado da Rua', legX + 166, midY);
  ctx.restore();

  // 12. Elegant border around the whole map
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(0, 0, width, height);

  return canvas;
}

/**
 * Returns a high quality JPEG data URL of the street route map
 */
export async function generateStreetRouteMapDataUrl(
  route: RouteCorridor,
  church: ChurchLocation,
  pair?: MissionaryPair | null,
  options: GenerateMapOptions = {}
): Promise<string> {
  const canvas = await generateStreetRouteMapCanvas(route, church, pair, options);
  return canvas.toDataURL('image/jpeg', 0.95);
}
