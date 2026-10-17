export type DensityType = 'padrao' | 'alta' | 'baixa' | 'edificios';

export interface ChurchLocation {
  name: string;
  address: string;
  lat: number;
  lng: number;
  leaderName: string;
  bookTitle: string;
  campaignDate: string;
}

export interface MissionaryPair {
  id: string;
  name: string;
  members: string[];
  phone: string;
  color: string;
  targetBooks: number;
  notes?: string;
}

export interface RouteCorridor {
  id: string;
  name: string;
  pairId: string | null;
  coordinates: [number, number][]; // [lat, lng]
  strokeStyle: 'dashed' | 'solid';
  color: string;
  weight: number;
  lengthMeters: number;
  densityType: DensityType;
  estimatedHouses: number;
  customHouseCount?: number;
  status: 'planejado' | 'em_andamento' | 'concluido';
  notes: string;
  osmBuildingCount?: number | null;
  createdAt: string;
}

export interface DensityOption {
  type: DensityType;
  label: string;
  description: string;
  metersPerHouse: number; // effective meters of street length per house (considering both sides)
  apartmentsMultiplier?: number;
}
