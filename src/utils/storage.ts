import { ChurchLocation, MissionaryPair, RouteCorridor } from '../types';

const STORAGE_KEYS = {
  CHURCH: 'missao_church_config',
  PAIRS: 'missao_pairs_list',
  ROUTES: 'missao_routes_list',
};

// Initial default church coordinates (e.g. near São Paulo / Vila Mariana area)
export const DEFAULT_CHURCH: ChurchLocation = {
  name: 'Igreja Central',
  address: 'Rua Domingos de Morais, 1500 - Vila Mariana, São Paulo - SP',
  lat: -23.5855,
  lng: -46.6385,
  leaderName: 'Pr. Carlos Eduardo',
  bookTitle: 'O Grande Conflito',
  campaignDate: '2026-10-18',
};

export const DEFAULT_PAIRS: MissionaryPair[] = [
  {
    id: 'pair-01',
    name: 'Dupla 01: Polly e Enzo',
    members: ['Polly', 'Enzo'],
    phone: '',
    color: '#2563EB',
    targetBooks: 50,
    notes: 'Dupla 01',
  },
  {
    id: 'pair-02',
    name: 'Dupla 02: Hércules e Jader',
    members: ['Hércules', 'Jader'],
    phone: '',
    color: '#DC2626',
    targetBooks: 50,
    notes: 'Dupla 02',
  },
  {
    id: 'pair-03',
    name: 'Dupla 03: Antônio Carlos e Ana Lúcia',
    members: ['Antônio Carlos', 'Ana Lúcia'],
    phone: '',
    color: '#059669',
    targetBooks: 50,
    notes: 'Dupla 03',
  },
  {
    id: 'pair-04',
    name: 'Dupla 04: Neide e Mauro',
    members: ['Neide', 'Mauro'],
    phone: '',
    color: '#7C3AED',
    targetBooks: 50,
    notes: 'Dupla 04',
  },
  {
    id: 'pair-05',
    name: 'Dupla 05: Donzila e Rosenir',
    members: ['Donzila', 'Rosenir'],
    phone: '',
    color: '#D97706',
    targetBooks: 50,
    notes: 'Dupla 05',
  },
  {
    id: 'pair-06',
    name: 'Dupla 06: Rosilene e Marli',
    members: ['Rosilene', 'Marli'],
    phone: '',
    color: '#DB2777',
    targetBooks: 50,
    notes: 'Dupla 06',
  },
  {
    id: 'pair-07',
    name: 'Dupla 07: Francisco e Lidiane',
    members: ['Francisco', 'Lidiane'],
    phone: '',
    color: '#0891B2',
    targetBooks: 50,
    notes: 'Dupla 07',
  },
  {
    id: 'pair-08',
    name: 'Dupla 08: Fábio e Mara',
    members: ['Fábio', 'Mara'],
    phone: '',
    color: '#EA580C',
    targetBooks: 50,
    notes: 'Dupla 08',
  },
  {
    id: 'pair-09',
    name: 'Dupla 09: Saulo, Olívia e Janaína',
    members: ['Saulo', 'Olívia', 'Janaína'],
    phone: '',
    color: '#4F46E5',
    targetBooks: 60,
    notes: 'Trio missionário 09',
  },
  {
    id: 'pair-10',
    name: 'Dupla 10: Elizeu e Natan',
    members: ['Elizeu', 'Natan'],
    phone: '',
    color: '#16A34A',
    targetBooks: 50,
    notes: 'Dupla 10',
  },
  {
    id: 'pair-11',
    name: 'Dupla 11: Elena Melo e Raimunda',
    members: ['Elena Melo', 'Raimunda'],
    phone: '',
    color: '#9333EA',
    targetBooks: 50,
    notes: 'Dupla 11',
  },
  {
    id: 'pair-12',
    name: 'Dupla 12: Ana Rita, Rosilda e Irismar',
    members: ['Ana Rita', 'Rosilda', 'Irismar'],
    phone: '',
    color: '#0284C7',
    targetBooks: 60,
    notes: 'Trio missionário 12',
  },
  {
    id: 'pair-13',
    name: 'Dupla 13: Antônia Clemildes e Irmã Lina',
    members: ['Antônia Clemildes', 'Irmã Lina'],
    phone: '',
    color: '#C026D3',
    targetBooks: 50,
    notes: 'Dupla 13',
  },
  {
    id: 'pair-14',
    name: 'Dupla 14: Nenzinha e Marie',
    members: ['Nenzinha', 'Marie'],
    phone: '',
    color: '#0D9488',
    targetBooks: 50,
    notes: 'Dupla 14',
  },
  {
    id: 'pair-15',
    name: 'Dupla 15: Kaio e Ana',
    members: ['Kaio', 'Ana'],
    phone: '',
    color: '#E11D48',
    targetBooks: 50,
    notes: 'Dupla 15',
  },
  {
    id: 'pair-16',
    name: 'Dupla 16: Gabriel e Edi',
    members: ['Gabriel', 'Edi'],
    phone: '',
    color: '#65A30D',
    targetBooks: 50,
    notes: 'Dupla 16',
  },
  {
    id: 'pair-17',
    name: 'Dupla 17: Pedro e Cássia',
    members: ['Pedro', 'Cássia'],
    phone: '',
    color: '#475569',
    targetBooks: 50,
    notes: 'Dupla 17',
  },
  {
    id: 'pair-18',
    name: 'Dupla 18: Rafael e Marta',
    members: ['Rafael', 'Marta'],
    phone: '',
    color: '#B45309',
    targetBooks: 50,
    notes: 'Dupla 18',
  },
  {
    id: 'pair-19',
    name: 'Dupla 19: Alexandre e Valdiza',
    members: ['Alexandre', 'Valdiza'],
    phone: '',
    color: '#4338CA',
    targetBooks: 50,
    notes: 'Dupla 19',
  },
  {
    id: 'pair-20',
    name: 'Dupla 20: Iúzife e Elane',
    members: ['Iúzife', 'Elane'],
    phone: '',
    color: '#BE123C',
    targetBooks: 50,
    notes: 'Dupla 20',
  },
  {
    id: 'pair-21',
    name: 'Dupla 21: Isaque Costa e Valéria',
    members: ['Isaque Costa', 'Valéria'],
    phone: '',
    color: '#047857',
    targetBooks: 50,
    notes: 'Dupla 21',
  },
];

export const DEFAULT_ROUTES: RouteCorridor[] = [
  {
    id: 'route-1',
    name: 'Rua Domingos de Morais (Trecho A)',
    pairId: 'pair-01',
    coordinates: [
      [-23.5855, -46.6385],
      [-23.5842, -46.6381],
      [-23.5828, -46.6377],
    ],
    strokeStyle: 'dashed',
    color: '#2563EB',
    weight: 5,
    lengthMeters: 310,
    densityType: 'padrao',
    estimatedHouses: 52,
    status: 'planejado',
    notes: 'Casas com numeração de 1400 a 1650',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'route-2',
    name: 'Rua Sena Madureira (Faixa Inicial)',
    pairId: 'pair-02',
    coordinates: [
      [-23.5855, -46.6385],
      [-23.5862, -46.6405],
      [-23.5871, -46.6428],
    ],
    strokeStyle: 'dashed',
    color: '#DC2626',
    weight: 5,
    lengthMeters: 460,
    densityType: 'padrao',
    estimatedHouses: 77,
    status: 'planejado',
    notes: 'Muitos portões residenciais e pequenos comércios',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'route-3',
    name: 'Rua Doutor Pinto Ferraz',
    pairId: 'pair-03',
    coordinates: [
      [-23.5842, -46.6381],
      [-23.5838, -46.6398],
      [-23.5834, -46.6415],
    ],
    strokeStyle: 'dashed',
    color: '#059669',
    weight: 5,
    lengthMeters: 360,
    densityType: 'padrao',
    estimatedHouses: 60,
    status: 'planejado',
    notes: 'Rua tranquila e residencial',
    createdAt: new Date().toISOString(),
  },
];

export function loadChurch(): ChurchLocation {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CHURCH);
    return raw ? JSON.parse(raw) : DEFAULT_CHURCH;
  } catch {
    return DEFAULT_CHURCH;
  }
}

export function saveChurch(church: ChurchLocation) {
  try {
    localStorage.setItem(STORAGE_KEYS.CHURCH, JSON.stringify(church));
  } catch (e) {
    console.error(e);
  }
}

export function loadPairs(): MissionaryPair[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PAIRS);
    if (!raw) return DEFAULT_PAIRS;
    const parsed = JSON.parse(raw);
    if (
      !Array.isArray(parsed) ||
      parsed.length < 21 ||
      parsed.some((p: MissionaryPair) => p.members?.includes('Marcos Silva'))
    ) {
      savePairs(DEFAULT_PAIRS);
      return DEFAULT_PAIRS;
    }
    return parsed;
  } catch {
    return DEFAULT_PAIRS;
  }
}

export function savePairs(pairs: MissionaryPair[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.PAIRS, JSON.stringify(pairs));
  } catch (e) {
    console.error(e);
  }
}

export function loadRoutes(): RouteCorridor[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ROUTES);
    return raw ? JSON.parse(raw) : DEFAULT_ROUTES;
  } catch {
    return DEFAULT_ROUTES;
  }
}

export function saveRoutes(routes: RouteCorridor[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.ROUTES, JSON.stringify(routes));
  } catch (e) {
    console.error(e);
  }
}
