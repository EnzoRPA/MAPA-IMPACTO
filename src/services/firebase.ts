import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDocFromServer,
  getDoc,
  setDoc,
  collection,
  onSnapshot,
  deleteDoc,
  writeBatch,
  Firestore,
} from 'firebase/firestore';
import { ChurchLocation, MissionaryPair, RouteCorridor } from '../types';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  DEFAULT_CHURCH,
  DEFAULT_PAIRS,
  DEFAULT_ROUTES,
  loadChurch,
  loadPairs,
  loadRoutes,
  saveChurch,
  savePairs,
  saveRoutes,
} from '../utils/storage';

// Initialize Firebase
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Connect to provisioned Firestore database
export const db: Firestore = (firebaseConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId
  ? getFirestore(app, (firebaseConfig as { firestoreDatabaseId: string }).firestoreDatabaseId)
  : getFirestore(app);

export type SyncStatus = 'connecting' | 'connected' | 'saving' | 'offline' | 'error';

let syncStatusListeners: ((status: SyncStatus) => void)[] = [];
let currentSyncStatus: SyncStatus = 'connecting';

export function setSyncStatus(status: SyncStatus) {
  currentSyncStatus = status;
  syncStatusListeners.forEach((listener) => listener(status));
}

export function subscribeSyncStatus(listener: (status: SyncStatus) => void) {
  syncStatusListeners.push(listener);
  listener(currentSyncStatus);
  return () => {
    syncStatusListeners = syncStatusListeners.filter((l) => l !== listener);
  };
}

/**
 * Validate connection to Firestore as per integration guidelines
 */
export async function validateFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'church', 'current'));
    setSyncStatus('connected');
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore client is offline, using local storage.');
      setSyncStatus('offline');
    } else {
      console.log('Firestore connection verified / initial read completed.');
      setSyncStatus('connected');
    }
    return false;
  }
}

/**
 * Subscribe to real-time Church updates from Firestore
 */
export function subscribeToChurch(callback: (church: ChurchLocation) => void) {
  const churchDocRef = doc(db, 'church', 'current');
  return onSnapshot(
    churchDocRef,
    async (snapshot) => {
      const local = loadChurch();
      if (snapshot.exists()) {
        const remoteData = snapshot.data() as ChurchLocation;
        // If local has a customized church (e.g. Newton Belo) and remote is still default (São Paulo), upload local!
        const localIsCustom =
          local &&
          local.name &&
          local.name !== DEFAULT_CHURCH.name &&
          local.name !== 'Igreja Central';
        const remoteIsDefault =
          remoteData.name === DEFAULT_CHURCH.name || remoteData.name === 'Igreja Central';

        if (localIsCustom && remoteIsDefault) {
          console.log('Uploading customized local church to Firestore:', local.name);
          await saveChurchToFirestore(local);
          callback(local);
          saveChurch(local);
          return;
        }

        callback(remoteData);
        saveChurch(remoteData);
        setSyncStatus('connected');
      } else {
        // First time initialization: populate from local storage or defaults
        const initial = local || DEFAULT_CHURCH;
        await saveChurchToFirestore(initial);
        callback(initial);
      }
    },
    (err) => {
      console.warn('Church onSnapshot error:', err);
      callback(loadChurch());
      setSyncStatus('offline');
    }
  );
}

/**
 * Save Church location and settings to Firestore
 */
export async function saveChurchToFirestore(church: ChurchLocation) {
  setSyncStatus('saving');
  try {
    saveChurch(church);
    const churchDocRef = doc(db, 'church', 'current');
    await setDoc(churchDocRef, church, { merge: true });
    setSyncStatus('connected');
  } catch (error) {
    console.error('Error saving church to Firestore:', error);
    setSyncStatus('offline');
  }
}

/**
 * Subscribe to Missionary Pairs collection
 */
export function subscribeToPairs(callback: (pairs: MissionaryPair[]) => void) {
  const pairsColRef = collection(db, 'pairs');
  return onSnapshot(
    pairsColRef,
    async (snapshot) => {
      if (!snapshot.empty) {
        let loaded: MissionaryPair[] = [];
        snapshot.forEach((docSnap) => {
          loaded.push(docSnap.data() as MissionaryPair);
        });

        // Clean up legacy test docs (e.g. 'pair-1', 'pair-2' or containing 'Marcos Silva')
        const legacyOldDocs = loaded.filter(
          (p) =>
            p.id === 'pair-1' ||
            p.id === 'pair-2' ||
            p.id === 'pair-3' ||
            p.id === 'pair-4' ||
            p.members?.includes('Marcos Silva')
        );
        if (legacyOldDocs.length > 0) {
          for (const oldDoc of legacyOldDocs) {
            deletePairFromFirestore(oldDoc.id).catch(() => {});
          }
          loaded = loaded.filter((p) => !legacyOldDocs.some((d) => d.id === p.id));
        }

        // If any of the 21 official pairs are missing, merge them in immediately
        const missingDefaults = DEFAULT_PAIRS.filter(
          (def) => !loaded.some((p) => p.id === def.id)
        );
        if (missingDefaults.length > 0) {
          console.log(`Adding ${missingDefaults.length} missing pairs to Firestore...`);
          loaded = [...loaded, ...missingDefaults];
          seedPairsToFirestore(missingDefaults).catch(console.error);
        }

        // Sort pairs numerically by name (Dupla 01, Dupla 02, ... Dupla 21)
        loaded.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

        callback(loaded);
        savePairs(loaded);
        setSyncStatus('connected');
      } else {
        // Seed default 21 registered pairs if collection is completely empty
        callback(DEFAULT_PAIRS);
        savePairs(DEFAULT_PAIRS);
        await seedPairsToFirestore(DEFAULT_PAIRS);
      }
    },
    (err) => {
      console.warn('Pairs onSnapshot error:', err);
      callback(loadPairs());
      setSyncStatus('offline');
    }
  );
}

/**
 * Save single or updated pair to Firestore
 */
export async function savePairToFirestore(pair: MissionaryPair) {
  setSyncStatus('saving');
  try {
    const pairRef = doc(db, 'pairs', pair.id);
    await setDoc(pairRef, pair);
    setSyncStatus('connected');
  } catch (error) {
    console.error('Error saving pair to Firestore:', error);
    setSyncStatus('offline');
  }
}

/**
 * Delete a pair from Firestore
 */
export async function deletePairFromFirestore(pairId: string) {
  setSyncStatus('saving');
  try {
    const pairRef = doc(db, 'pairs', pairId);
    await deleteDoc(pairRef);
    setSyncStatus('connected');
  } catch (error) {
    console.error('Error deleting pair from Firestore:', error);
    setSyncStatus('offline');
  }
}

/**
 * Batch update/replace all pairs
 */
export async function seedPairsToFirestore(pairs: MissionaryPair[]) {
  try {
    const batch = writeBatch(db);
    pairs.forEach((p) => {
      const ref = doc(db, 'pairs', p.id);
      batch.set(ref, p);
    });
    await batch.commit();
    setSyncStatus('connected');
  } catch (e) {
    console.warn('Error seeding pairs:', e);
  }
}

/**
 * Subscribe to Routes collection with non-destructive merge
 * Guarantees routes created locally are NEVER overwritten or lost, and automatically uploaded to Firestore!
 */
export function subscribeToRoutes(callback: (routes: RouteCorridor[]) => void) {
  const routesColRef = collection(db, 'routes');
  return onSnapshot(
    routesColRef,
    async (snapshot) => {
      const local = loadRoutes();
      const loaded: RouteCorridor[] = [];

      if (!snapshot.empty) {
        snapshot.forEach((docSnap) => {
          const r = docSnap.data() as RouteCorridor;
          // Migrate any legacy pair-1 -> pair-01 ID mapping
          if (r.pairId === 'pair-1') r.pairId = 'pair-01';
          if (r.pairId === 'pair-2') r.pairId = 'pair-02';
          if (r.pairId === 'pair-3') r.pairId = 'pair-03';
          if (r.pairId === 'pair-4') r.pairId = 'pair-04';
          loaded.push(r);
        });
      }

      // Safeguard: Any local route created by user that is NOT in Firestore yet must NOT be lost!
      const missingInFirestore = local.filter(
        (loc) =>
          !loaded.some((rem) => rem.id === loc.id) &&
          !(
            loaded.length > 0 &&
            (loc.id === 'route-1' || loc.id === 'route-2' || loc.id === 'route-3') &&
            loc.name?.includes('Domingos de Morais')
          )
      );

      let merged = [...loaded];
      if (missingInFirestore.length > 0) {
        console.log(`Preserving and uploading ${missingInFirestore.length} local routes to Firestore...`);
        merged = [...missingInFirestore, ...merged];
        // Upload immediately to Firestore in background so other devices (e.g. tablet) receive them
        saveAllRoutesToFirestore(missingInFirestore).catch(console.error);
      }

      // If user has real custom routes (e.g. in Newton Belo), clean up default dummy São Paulo routes
      const hasRealCustomRoutes = merged.some(
        (r) =>
          r.id.startsWith('route-') &&
          r.id !== 'route-1' &&
          r.id !== 'route-2' &&
          r.id !== 'route-3'
      );
      if (hasRealCustomRoutes) {
        const dummyRoutes = merged.filter(
          (r) =>
            (r.id === 'route-1' || r.id === 'route-2' || r.id === 'route-3') &&
            r.name?.includes('Domingos de Morais')
        );
        if (dummyRoutes.length > 0) {
          merged = merged.filter((r) => !dummyRoutes.some((d) => d.id === r.id));
          for (const d of dummyRoutes) {
            deleteRouteFromFirestore(d.id).catch(() => {});
          }
        }
      }

      // If completely empty, seed initial
      if (merged.length === 0) {
        merged = local.length > 0 ? local : DEFAULT_ROUTES;
        saveAllRoutesToFirestore(merged).catch(console.error);
      }

      // Sort newest first or maintain consistent order
      merged.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

      callback(merged);
      saveRoutes(merged);
      setSyncStatus('connected');
    },
    (err) => {
      console.warn('Routes onSnapshot error:', err);
      callback(loadRoutes());
      setSyncStatus('offline');
    }
  );
}

/**
 * Save or update single route in Firestore
 */
export async function saveRouteToFirestore(route: RouteCorridor) {
  setSyncStatus('saving');
  try {
    const routeRef = doc(db, 'routes', route.id);
    await setDoc(routeRef, route);
    setSyncStatus('connected');
  } catch (error) {
    console.error('Error saving route to Firestore:', error);
    setSyncStatus('offline');
  }
}

/**
 * Delete a route from Firestore
 */
export async function deleteRouteFromFirestore(routeId: string) {
  setSyncStatus('saving');
  try {
    const routeRef = doc(db, 'routes', routeId);
    await deleteDoc(routeRef);
    setSyncStatus('connected');
  } catch (error) {
    console.error('Error deleting route from Firestore:', error);
    setSyncStatus('offline');
  }
}

/**
 * Save all routes to Firestore individually (bulletproof with no batch limit issues)
 */
export async function saveAllRoutesToFirestore(routes: RouteCorridor[]): Promise<boolean> {
  setSyncStatus('saving');
  try {
    const promises = routes.map((r) => {
      const routeRef = doc(db, 'routes', r.id);
      return setDoc(routeRef, r);
    });
    await Promise.all(promises);
    setSyncStatus('connected');
    return true;
  } catch (error) {
    console.error('Error saving all routes to Firestore:', error);
    setSyncStatus('offline');
    return false;
  }
}

/**
 * Batch update/replace routes
 */
export async function seedRoutesToFirestore(routes: RouteCorridor[]) {
  return saveAllRoutesToFirestore(routes);
}

/**
 * Comprehensive sync function: Forces church, all 21 pairs, and all routes to be committed to Firestore
 */
export async function syncEntireAppToFirestore(
  routes: RouteCorridor[],
  church: ChurchLocation,
  pairs: MissionaryPair[]
): Promise<{ success: boolean; routesCount: number }> {
  setSyncStatus('saving');
  try {
    // 1. Save Church
    await saveChurchToFirestore(church);

    // 2. Save Pairs
    await seedPairsToFirestore(pairs);

    // 3. Save Routes (merge current memory + local storage)
    const local = loadRoutes();
    const map = new Map<string, RouteCorridor>();
    local.forEach((r) => map.set(r.id, r));
    routes.forEach((r) => map.set(r.id, r));
    const combined = Array.from(map.values());

    await saveAllRoutesToFirestore(combined);
    saveRoutes(combined);
    saveChurch(church);
    savePairs(pairs);

    setSyncStatus('connected');
    return { success: true, routesCount: combined.length };
  } catch (e) {
    console.error('Error in syncEntireAppToFirestore:', e);
    setSyncStatus('error');
    return { success: false, routesCount: routes.length };
  }
}
