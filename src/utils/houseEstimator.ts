import { DensityOption, DensityType } from '../types';

export const DENSITY_OPTIONS: Record<DensityType, DensityOption> = {
  padrao: {
    type: 'padrao',
    label: 'Residencial Padrão',
    description: 'Casas térreas/sobrados (~10m de testada, ambos os lados)',
    metersPerHouse: 5.5, // 1 casa a cada 5.5m de rua (considerando ambos os lados)
  },
  alta: {
    type: 'alta',
    label: 'Alta Densidade / Vilas',
    description: 'Lotes estreitos, cortiços ou geminadas (~6m de testada)',
    metersPerHouse: 3.2,
  },
  baixa: {
    type: 'baixa',
    label: 'Baixa Densidade / Chácaras',
    description: 'Terrenos amplos, chácaras ou condomínios espaçados',
    metersPerHouse: 14.0,
  },
  edificios: {
    type: 'edificios',
    label: 'Área com Edifícios',
    description: 'Prédios residenciais (múltiplos apartamentos por entrada)',
    metersPerHouse: 1.2,
  },
};

/**
 * Calculates distance in meters between two lat/lng coordinates (Haversine formula)
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Calculates the total length of a polyline in meters
 */
export function calculatePolylineLength(coordinates: [number, number][]): number {
  if (coordinates.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < coordinates.length - 1; i++) {
    total += calculateDistanceMeters(
      coordinates[i][0],
      coordinates[i][1],
      coordinates[i + 1][0],
      coordinates[i + 1][1]
    );
  }
  return Math.round(total);
}

/**
 * Estimates number of houses based on street length and urban typology
 */
export function estimateHouses(lengthMeters: number, density: DensityType = 'padrao'): number {
  if (lengthMeters <= 0) return 0;
  const config = DENSITY_OPTIONS[density] || DENSITY_OPTIONS.padrao;
  const rawHouses = lengthMeters / config.metersPerHouse;
  // Apply a small corner/intersection factor (-8% for cross streets)
  const estimated = Math.max(1, Math.round(rawHouses * 0.92));
  return estimated;
}

/**
 * Formats distance nicely (e.g. "350 m" or "1.2 km")
 */
export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${meters} m`;
}

/**
 * Queries OpenStreetMap Overpass API for real registered building footprints around the path
 */
export async function queryOsmBuildingsAroundPath(
  coordinates: [number, number][],
  bufferRadiusMeters: number = 25
): Promise<number | null> {
  if (coordinates.length < 2) return null;

  try {
    // Simplify coordinates for query if too long (sample up to 10 points)
    let sampled = coordinates;
    if (coordinates.length > 10) {
      const step = Math.ceil(coordinates.length / 10);
      sampled = coordinates.filter((_, idx) => idx % step === 0 || idx === coordinates.length - 1);
    }

    // Build around polyline query
    const polyString = sampled.map((c) => `${c[0]} ${c[1]}`).join(' ');
    const query = `
      [out:json][timeout:8];
      (
        way["building"](around:${bufferRadiusMeters},${polyString});
      );
      out count;
    `;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;
    const data = await response.json();
    const count = data?.elements?.[0]?.tags?.total;
    if (count !== undefined && !isNaN(Number(count))) {
      return Number(count);
    }
    return null;
  } catch {
    return null; // Fallback smoothly to theoretical estimation
  }
}
